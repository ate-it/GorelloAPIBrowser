# Gorelo API Browser

A desktop application for exploring and testing the [Gorelo Public API](https://api.usw.gorelo.io/swagger/v1/swagger.json). Fetches the latest API specification on every launch so you're always working against the current API.

![Windows](https://img.shields.io/badge/platform-Windows-blue)
![macOS](https://img.shields.io/badge/platform-macOS-lightgrey)
![Linux](https://img.shields.io/badge/platform-Linux-orange)
![Release](https://img.shields.io/github/v/release/ate-it/GorelloAPIBrowser)

## Features

- **Live Swagger docs** - fetches the latest spec from Gorelo on startup, always up to date
- **Endpoint explorer** - endpoints grouped by tag in a collapsible sidebar with live search
- **Try it** - fill in parameters, set a request body, and send real API requests directly from the app
- **Request history** - last 50 requests shown in the History tab; click any entry to jump back to that endpoint
- **Copy as cURL** - one-click button generates a ready-to-paste `curl` command for the current request
- **Response viewer** - syntax-highlighted JSON, headers tab, response time indicator, and Export JSON button
- **Command palette** - press `Ctrl+K` to fuzzy-search and jump to any endpoint instantly
- **API key management** - prompted on first launch; optionally saved encrypted to disk (AES-256-GCM)
- **Auto-update check** - silently checks GitHub Releases on startup and shows a banner if a newer version is available
- **Light / dark mode** - toggle in the title bar, preference saved between sessions
- **Custom title bar** - frameless dark window with native minimize / maximize / close controls

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Open command palette |
| `Ctrl+Enter` | Send the current request |
| `Esc` | Close palette / modal |
| `↑` / `↓` | Navigate palette results |
| `Enter` | Select palette result |

## Installation

Download the latest release from the [Releases](../../releases) page:

### Windows

| File | Description |
|------|-------------|
| `Gorelo API Browser Setup x.x.x.exe` | NSIS installer - installs to Program Files with a Start Menu entry |
| `Gorelo API Browser-x.x.x-portable.exe` | Portable - runs directly, no installation needed |

### macOS

| File | Description |
|------|-------------|
| `Gorelo API Browser-x.x.x.dmg` | Disk image - open, drag to Applications |
| `Gorelo API Browser-x.x.x-mac.zip` | Zip archive - extract and run (Intel + Apple Silicon) |

> **Note:** The app is unsigned. On first launch, right-click → Open to bypass Gatekeeper.

### Linux

| File | Description |
|------|-------------|
| `Gorelo API Browser-x.x.x.AppImage` | AppImage - make executable and run, no install needed |
| `gorelo-api-browser_x.x.x_amd64.deb` | Debian/Ubuntu package - install with `dpkg -i` |

```bash
# AppImage
chmod +x "Gorelo API Browser-x.x.x.AppImage"
./"Gorelo API Browser-x.x.x.AppImage"

# Debian/Ubuntu
sudo dpkg -i gorelo-api-browser_x.x.x_amd64.deb
```

## API Key

On first launch you will be prompted for your Gorelo API key. You can choose to:

- **Remember on this device** - the key is encrypted with AES-256-GCM using a machine-derived key and stored at `%APPDATA%\gorelo-api-browser\api-key.enc` (Windows), `~/Library/Application Support/gorelo-api-browser/api-key.enc` (macOS), or `~/.config/gorelo-api-browser/api-key.enc` (Linux). It is automatically loaded on subsequent launches.
- **Skip for now** - the key is held in memory for the session only and not written to disk.

The key status is always visible in the sidebar. Use the **Change** button to update it or **Remove** to delete the stored key.

## Development

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Run in development
npm start
```

**VS Code:** Use the `Electron: All` launch compound (`F5`) to start the app with the debugger attached to both the main and renderer processes.

## Building

```bash
# Build Windows installer + portable exe
npm run build

# Build Linux AppImage + deb
npm run build:linux

# Build macOS dmg + zip
npm run build:mac

# Build to a directory (faster, no installer - useful for testing)
npm run build:dir
```

Output goes to `dist/`.

## Releases

Every push to `main` automatically:

1. Bumps the patch version in `package.json` and commits it back
2. Builds Windows (NSIS installer + portable `.exe`), macOS (DMG + zip, Intel + Apple Silicon), and Linux (AppImage + `.deb`) in parallel
3. Publishes a [GitHub Release](../../releases) with all artifacts attached and auto-generated release notes
