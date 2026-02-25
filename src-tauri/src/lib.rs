//! CLI Proxy Management Center - Tauri Backend
//!
//! Clean, organized Tauri backend with modular architecture.

mod commands;
mod error;
mod state;
mod tray;

use commands::*;

fn cleanup_on_exit() {
    if let Ok(mut guard) = state::CLI_PROXY_PROCESS.lock() {
        if let Some(ref mut child) = *guard {
            #[cfg(windows)]
            {
                use std::process::Command;
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;

                let pid = child.id();
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
    }

    if let Ok(mut name_guard) = state::CLI_PROXY_NAME.lock() {
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

                #[cfg(not(windows))]
                {
                    use std::process::Command;
                    let _ = Command::new("pkill")
                        .args(["-f", name])
                        .output();
                }
            }
        }
        *name_guard = None;
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            tray::setup_tray(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if state::get_run_in_background() {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_external_url,
            set_run_in_background,
            start_cli_proxy,
            stop_cli_proxy,
            is_cli_proxy_running,
            download_and_extract_proxy,
            check_proxy_version,
            github_request_device_code,
            github_poll_token,
            github_fetch_user_info,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                cleanup_on_exit();
            }
        });
}
