//! Global state management

use std::process::Child;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

/// CLI Proxy process state
pub static CLI_PROXY_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

/// Run in background setting (hide to tray on close) - default false, synced from frontend on startup
pub static RUN_IN_BACKGROUND: AtomicBool = AtomicBool::new(false);

pub fn get_run_in_background() -> bool {
    RUN_IN_BACKGROUND.load(Ordering::Relaxed)
}

pub fn set_run_in_background(enabled: bool) {
    RUN_IN_BACKGROUND.store(enabled, Ordering::Relaxed);
}
