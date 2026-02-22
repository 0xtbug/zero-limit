# How to Use ZeroLimit
## Getting Started

### 1. Installation
- Download `ZeroLimit_x.x.x_x64-setup` from Releases
- Run the installer
- Launch ZeroLimit from Start Menu

### 2. First Launch - Onboarding

On first launch, you'll be guided through a setup wizard to configure CLIProxyAPI. You can choose between two setup modes:

---

#### Option A: Auto Download (Recommended)

The easiest way to get started. ZeroLimit will automatically download and configure the CLI Proxy for you.

1. Click **Get Started** on the welcome screen
2. Select **Auto Download**
3. Choose your version:
   - **Standard** — The original CLI Proxy API
   - **Plus** — Enhanced version with GitHub Copilot and Kiro support
4. ZeroLimit will download and extract the correct binary for your OS
5. Set a **Management Key** — this is the secret key used to protect the management API
6. Click **Finish Setup** — the proxy starts automatically and you're logged in

> [!TIP]
> The Auto Download mode handles everything: downloading the binary, writing the `config.yaml`, starting the server, and logging you in — all in one flow.

---

#### Option B: Manual Setup

If you already have CLIProxyAPI downloaded or prefer to manage it yourself:

1. Click **Get Started** on the welcome screen
2. Select **Manual Location**
3. Browse and select your `cli-proxy-api.exe` (or `cli-proxy-api-plus.exe`)
4. Set a **Management Key**
5. Click **Finish Setup**



> [!NOTE]
> For the Plus version with Kiro & GitHub Copilot support, download from [CLIProxyAPI Plus Releases](https://github.com/router-for-me/CLIProxyAPIPlus/releases).
> For the Standard version, download from [CLIProxyAPI Releases](https://github.com/router-for-me/CLIProxyAPI/releases).

---

#### Option C: Remote Server

If you're connecting to a remote HTTPS server, click **Skip For Now** during onboarding and log in manually:

1. Enter your **API Base URL** (e.g., `https://llm.yourdomain.com`)
2. Enter the **Management Key** from your server's `config.yaml`
3. Check **Remember credentials** to save for next time
4. Click **Login**

## Settings

### CLI Proxy Server

| Setting | Description |
|---------|-------------|
| **Executable Path** | Path to `cli-proxy-api.exe` (local only) |
| **Auto-start on launch** | Start proxy when app opens |
| **Run in background** | Hide to system tray when closing |
| **Check for Updates** | Check if a newer CLI Proxy version is available |
| **Update Proxy** | Download and install the latest version automatically |

### Theme & Language

- **Theme**: Light, Dark, or System
- **Language**: English, Chinese, Indonesian, Japanese, Vietnamese, Thai, Korean

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

### Proxy Won't Start (Local)
- Verify the executable path is correct
- Check if another instance is already running
- Try running as Administrator

### Auto Download Failed
- Check your internet connection
- GitHub API may be rate-limited — try again in a few minutes
- Fall back to Manual Setup and download the binary yourself

### Connection Failed
- Ensure CLI Proxy is running (green status for local)
- Check the API Base URL is correct
- For HTTPS: verify the SSL certificate is valid
- Verify no firewall is blocking the port

### Login Failed
- In your CLIProxyAPI folder, rename `config-example.yaml` to `config.yaml`
- Open `config.yaml` and find the `secret-key` value
- Use this key as your Management Key in ZeroLimit

## Support

For issues, visit the GitHub repository.
