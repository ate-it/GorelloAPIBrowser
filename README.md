# Gorelo API Browser

A Windows desktop application for exploring and testing the [Gorelo Public API](https://api.usw.gorelo.io/swagger/v1/swagger.json). Fetches the latest API specification on every launch so you're always working against the current API.

## Features

- **Live swagger docs** — fetches the latest spec from Gorelo on startup
- **Endpoint explorer** — endpoints grouped by tag in a collapsible sidebar with search
- **Try it** — fill in parameters, set a request body, and send requests directly from the app
- **API key management** — prompted on first launch; optionally saved encrypted to disk
- **Syntax-highlighted responses** — JSON responses are pretty-printed and colour-coded
- **Response schema previews** — shows expected response shapes for each status code

## Installation

Download the latest release from the [Releases](../../releases) page:

| File | Description |
|------|-------------|
| `Gorelo API Browser Setup x.x.x.exe` | NSIS installer — installs to Program Files with Start Menu entry |
| `Gorelo API Browser-x.x.x-portable.exe` | Portable — runs directly, no installation needed |

## API Key

On first launch you will be prompted for your Gorelo API key. You can choose to:

- **Remember on this device** — the key is encrypted with AES-256-GCM using a machine-derived key and stored at `%APPDATA%\gorelo-api-browser\api-key.enc`. It is automatically loaded on subsequent launches.
- **Skip for now** — the key is held in memory for the session only and not written to disk.

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

# Build to a directory (faster, no installer — useful for testing)
npm run build:dir
```

Output goes to `dist/`.

## Releases

Every push to `main` automatically:

1. Bumps the patch version in `package.json` and commits it back
2. Builds the NSIS installer and portable `.exe`
3. Publishes a [GitHub Release](../../releases) with both files attached


