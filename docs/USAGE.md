# How to Use ZeroLimit

ZeroLimit is a Windows desktop application for monitoring AI coding assistant quotas. Track your usage across Antigravity, Anthropic Claude, Codex (OpenAI), and Gemini CLI accounts in one dashboard.

## Prerequisites

Before using ZeroLimit, you need to download CLIProxyAPI:

1. Go to [CLIProxyAPI Releases](https://github.com/router-for-me/CLIProxyAPI/releases)
2. Download `cli-proxy-api.exe` for Windows
3. Extract to a folder (e.g., `C:\CLIProxyAPI\`)

## Getting Started

### 1. Installation

**Windows:**
- Download `ZeroLimit_x.x.x_x64-setup.exe` from Releases
- Run the installer
- Launch ZeroLimit from Start Menu

### 2. First Launch - Login

On first launch, you'll see the login screen with these sections:

1. **CLI Proxy Server**
   - Click **Change** to browse and select your `cli-proxy-api.exe`
   - Click **Start** to launch the proxy server

2. **API Base URL**
   - Default: `http://localhost:8317`
   - This is the address where CLIProxyAPI runs

3. **Management Key** (required)
   - Enter the `secret-key` from your CLIProxyAPI `config.yaml`
   - This key is required for authentication

4. **Remember credentials**
   - Check to save your settings for next time

5. Click **Login** to connect to the dashboard

## Settings

### CLI Proxy Server

| Setting | Description |
|---------|-------------|
| **Executable Path** | Path to `cli-proxy-api.exe` |
| **Auto-start on launch** | Start proxy when app opens |
| **Run in background** | Hide to system tray when closing |

### Theme & Language

- **Theme**: Light, Dark, or System
- **Language**: English, Chinese, Indonesian

## System Tray

When "Run in background" is enabled:
- Closing the window hides to system tray
- Click tray icon to restore window
- Right-click for menu: Open / Quit

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Close Window | `Alt + F4` |
| Refresh | `Ctrl + R` |

## Troubleshooting

### Proxy Won't Start
- Verify the executable path is correct
- Check if another instance is already running
- Try running as Administrator

### Connection Failed
- Ensure CLI Proxy is running (green status)
- Check the API Base URL is correct
- Verify no firewall is blocking the port

### Login Failed
- In your CLIProxyAPI folder, rename `config-example.yaml` to `config.yaml`
- Open `config.yaml` and find the `secret-key` value
- Use this key as your Management Key in ZeroLimit

## Support

For issues, visit the GitHub repository.
