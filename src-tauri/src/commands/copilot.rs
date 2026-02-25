//! GitHub Copilot Device Flow Commands
//!
//! Proxies GitHub OAuth device flow requests through Rust/reqwest to avoid
//! CORS restrictions in the Tauri webview. GitHub's device flow endpoints
//! do not set CORS headers, so they cannot be called directly from JS.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const GITHUB_CLIENT_ID: &str = "Iv1.b507a08c87ecfe98";
const DEVICE_CODE_URL: &str = "https://github.com/login/device/code";
const TOKEN_URL: &str = "https://github.com/login/oauth/access_token";
const USER_INFO_URL: &str = "https://api.github.com/user";

// ── Request device code ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

/// Step 1: Request a device code from GitHub.
#[tauri::command]
pub async fn github_request_device_code() -> Result<DeviceCodeResponse, String> {
    let client = Client::new();

    let mut params = HashMap::new();
    params.insert("client_id", GITHUB_CLIENT_ID);
    params.insert("scope", "read:user user:email");

    let res = client
        .post(DEVICE_CODE_URL)
        .header("Accept", "application/json")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to request device code: {e}"))?;

    if !res.status().is_success() {
        let status = res.status().as_u16();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("GitHub returned {status}: {body}"));
    }

    res.json::<DeviceCodeResponse>()
        .await
        .map_err(|e| format!("Failed to parse device code response: {e}"))
}

// ── Poll for token ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenPollResponse {
    /// Populated when auth succeeds.
    pub access_token: Option<String>,
    pub token_type: Option<String>,
    pub scope: Option<String>,
    /// Populated when still waiting or on error.
    pub error: Option<String>,
    pub error_description: Option<String>,
}

/// Step 2: Poll GitHub once for an access token.
/// Returns the raw response so the frontend can handle all error cases.
#[tauri::command]
pub async fn github_poll_token(device_code: String) -> Result<TokenPollResponse, String> {
    let client = Client::new();

    let mut params = HashMap::new();
    params.insert("client_id", GITHUB_CLIENT_ID);
    params.insert(
        "grant_type",
        "urn:ietf:params:oauth:grant-type:device_code",
    );
    let device_code_ref = device_code.as_str();
    params.insert("device_code", device_code_ref);

    let res = client
        .post(TOKEN_URL)
        .header("Accept", "application/json")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Failed to poll for token: {e}"))?;

    res.json::<TokenPollResponse>()
        .await
        .map_err(|e| format!("Failed to parse token response: {e}"))
}

// ── Fetch user info ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfoResponse {
    pub login: Option<String>,
    pub email: Option<String>,
    pub name: Option<String>,
}

/// Step 3: Fetch the authenticated user's GitHub profile.
#[tauri::command]
pub async fn github_fetch_user_info(access_token: String) -> Result<UserInfoResponse, String> {
    let client = Client::new();

    let res = client
        .get(USER_INFO_URL)
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Accept", "application/json")
        .header("User-Agent", "zero-limit")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch user info: {e}"))?;

    if !res.status().is_success() {
        let status = res.status().as_u16();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("GitHub returned {status}: {body}"));
    }

    res.json::<UserInfoResponse>()
        .await
        .map_err(|e| format!("Failed to parse user info: {e}"))
}
