//! CLI Proxy server management commands

use std::process::Command;
use tauri::command;

use crate::error::{CommandError, CommandResult};
use crate::state::CLI_PROXY_PROCESS;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// Windows: CREATE_NO_WINDOW flag to hide console
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Start CLI Proxy server
#[command]
pub async fn start_cli_proxy(exe_path: String) -> CommandResult<u32> {
    let mut guard = CLI_PROXY_PROCESS.lock()
        .map_err(|e| CommandError::General(e.to_string()))?;

    // Check if already running
    if let Some(ref mut child) = *guard {
        if child.try_wait().ok().flatten().is_none() {
            return Ok(child.id());
        }
        *guard = None;
    }

    // Get working directory from exe path
    let exe = std::path::PathBuf::from(&exe_path);
    let work_dir = exe.parent()
        .ok_or_else(|| CommandError::General("Invalid path".into()))?;

    // Spawn process
    #[cfg(windows)]
    let child = Command::new(&exe_path)
        .current_dir(work_dir)
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| CommandError::General(format!("Failed: {}", e)))?;

    #[cfg(not(windows))]
    let child = Command::new(&exe_path)
        .current_dir(work_dir)
        .spawn()
        .map_err(|e| CommandError::General(format!("Failed: {}", e)))?;

    let pid = child.id();
    *guard = Some(child);

    // Store executable name for cleanup
    if let Ok(mut name_guard) = crate::state::CLI_PROXY_NAME.lock() {
        if let Some(name) = exe.file_name().and_then(|n| n.to_str()) {
            *name_guard = Some(name.to_string());
        }
    }

    Ok(pid)
}

/// Stop CLI Proxy server
#[command]
pub async fn stop_cli_proxy() -> CommandResult<()> {
    let mut guard = CLI_PROXY_PROCESS.lock()
        .map_err(|e| CommandError::General(e.to_string()))?;

    if let Some(ref mut child) = *guard {
        let pid = child.id();

        // On Windows, use taskkill for reliable termination
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }

        #[cfg(not(windows))]
        {
            let _ = child.kill();
        }

        let _ = child.wait();
    }

    *guard = None;

    // Fallback: kill by name if available
    if let Ok(mut name_guard) = crate::state::CLI_PROXY_NAME.lock() {
        if let Some(ref name) = *name_guard {
             if name.to_lowercase().contains("cliproxy") {
                #[cfg(windows)]
                {
                    use std::process::Command;
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x08000000;

                    let _ = Command::new("taskkill")
                        .args(["/F", "/T", "/IM", name])
                        .creation_flags(CREATE_NO_WINDOW)
                        .output();
                }
            }
        }
        *name_guard = None;
    }
    Ok(())
}

/// Check if CLI Proxy is running
#[command]
pub async fn is_cli_proxy_running() -> CommandResult<bool> {
    let mut guard = CLI_PROXY_PROCESS.lock()
        .map_err(|e| CommandError::General(e.to_string()))?;

    if let Some(ref mut child) = *guard {
        if child.try_wait().ok().flatten().is_none() {
            return Ok(true);
        }
        *guard = None;
    }

    Ok(false)
}

/// Run Kiro CLI authentication
/// This spawns the CLI proxy binary with auth flags and waits for completion
#[command]
pub async fn run_kiro_auth(exe_path: String, auth_method: String) -> CommandResult<String> {
    // Map auth method to CLI flag
    let auth_flag = match auth_method.as_str() {
        "google" => "-kiro-google-login",
        "aws" => "-kiro-aws-login",
        "aws-authcode" => "-kiro-aws-authcode",
        "import" => "-kiro-import",
        _ => return Err(CommandError::General(format!("Unknown auth method: {}", auth_method))),
    };

    // Get working directory from exe path
    let exe = std::path::PathBuf::from(&exe_path);
    let work_dir = exe.parent()
        .ok_or_else(|| CommandError::General("Invalid path".into()))?;

    // Spawn process and wait for completion
    #[cfg(windows)]
    let output = Command::new(&exe_path)
        .arg(auth_flag)
        .current_dir(work_dir)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| CommandError::General(format!("Failed to start auth: {}", e)))?;

    #[cfg(not(windows))]
    let output = Command::new(&exe_path)
        .arg(auth_flag)
        .current_dir(work_dir)
        .output()
        .map_err(|e| CommandError::General(format!("Failed to start auth: {}", e)))?;

    if output.status.success() {
        Ok("Authentication completed successfully".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let message = if !stderr.is_empty() { stderr.to_string() } else { stdout.to_string() };
        Err(CommandError::General(format!("Auth failed: {}", message.trim())))
    }
}
