use tauri::command;
use reqwest;
use serde::Serialize;

use crate::error::{CommandError, CommandResult};

#[derive(Serialize)]
pub struct ProxyVersionInfo {
    pub current_version: Option<String>,
    pub build_date: Option<String>,
    pub latest_version: Option<String>,
}

#[command]
pub async fn check_proxy_version(api_base: String, management_key: String) -> CommandResult<ProxyVersionInfo> {
    let base_url = api_base
        .trim_end_matches('/')
        .to_string();

    let url = format!("{}/v0/management/latest-version", base_url);
    // println!("[Rust] Checking proxy version at: {}", url);

    let client = reqwest::Client::new();
    let response = client.get(&url)
        .header("Authorization", format!("Bearer {}", management_key))
        .header("Accept", "application/json")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| CommandError::General(format!("Request failed: {}", e)))?;

    if !response.status().is_success() {
        return Err(CommandError::General(format!("API returned status {}", response.status())));
    }

    let current_version = response.headers()
        .get("x-cpa-version")
        .or_else(|| response.headers().get("x-server-version"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let build_date = response.headers()
        .get("x-cpa-build-date")
        .or_else(|| response.headers().get("x-server-build-date"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let body: serde_json::Value = response.json().await
        .map_err(|e| CommandError::General(format!("Failed to parse response: {}", e)))?;

    let latest_version = body.get("latest-version")
        .or_else(|| body.get("latest_version"))
        .or_else(|| body.get("latest"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // println!("[Rust] Current: {:?}, Latest: {:?}, Build: {:?}", current_version, latest_version, build_date);

    Ok(ProxyVersionInfo {
        current_version,
        build_date,
        latest_version,
    })
}
