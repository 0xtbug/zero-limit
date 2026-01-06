//! Error types for Tauri commands

use serde::Serialize;

/// Command error type
#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error("{0}")]
    General(String),
}

impl Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Result type alias for commands
pub type CommandResult<T> = Result<T, CommandError>;
