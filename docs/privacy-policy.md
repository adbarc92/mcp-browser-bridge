# Privacy Policy — Browser Bridge MCP

**Last updated:** April 9, 2026

## Overview

Browser Bridge MCP is a Chrome extension and MCP server that connects AI coding assistants to the browser for local development and testing. It is designed with privacy as a core principle — no data ever leaves your machine.

## Data Collection

Browser Bridge MCP does **not** collect, store, transmit, or share any personal data or browsing activity.

## How It Works

- The extension communicates exclusively over a **local WebSocket connection** (`127.0.0.1:7483`) between the browser and a server running on your machine.
- No data is sent to any remote server, cloud service, or third party.
- No analytics, telemetry, or tracking of any kind is included.
- No cookies are set. No accounts are required.

## Permissions

The extension requests the following Chrome permissions, used solely for local browser automation:

| Permission | Purpose |
|------------|---------|
| `activeTab` | Interact with the currently active tab |
| `tabs` | List open tabs and respond to tab events |
| `scripting` | Execute JavaScript in page context for automation |
| `storage` | Save the WebSocket port setting locally |
| `<all_urls>` (host) | Enable automation on any page during development |

All permission usage is local. No data accessed through these permissions is transmitted externally.

## Third-Party Services

Browser Bridge MCP does not integrate with, send data to, or receive data from any third-party services.

## Changes

If this policy changes, the updated version will be posted at this URL with a new "Last updated" date.

## Contact

For questions about this privacy policy, open an issue at [github.com/adbarc92/mcp-browser-bridge](https://github.com/adbarc92/mcp-browser-bridge/issues).
