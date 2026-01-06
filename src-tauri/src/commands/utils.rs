//! Utility commands

use tauri::command;

use crate::error::{CommandError, CommandResult};
use crate::state;

/// Open URL in system browser
#[command]
pub async fn open_external_url(url: String) -> CommandResult<()> {
    opener::open(&url).map_err(|e| CommandError::General(e.to_string()))
}

/// Set run in background mode
#[command]
pub async fn set_run_in_background(enabled: bool) -> CommandResult<()> {
    state::set_run_in_background(enabled);
    Ok(())
}
