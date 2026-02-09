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
