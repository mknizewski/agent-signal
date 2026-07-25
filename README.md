<p align="center">
  <img src="build/icon.png" width="88" alt="AgentSignal" />
</p>

<h1 align="center">AgentSignal</h1>

<p align="center">
  A calm, local desktop dashboard for monitoring selected Codex and Claude Code sessions.
</p>

<p align="center">
  <img alt="Windows 10 and 11" src="https://img.shields.io/badge/Windows-10%20%7C%2011-2563eb" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-43-47848f" />
  <img alt="MIT License" src="https://img.shields.io/badge/license-MIT-3db47a" />
  <img alt="Local first" src="https://img.shields.io/badge/data-local--first-e4a62b" />
</p>

AgentSignal is not another chat client. It does not create tasks, send prompts,
or replace the official Codex and Claude Code applications. Instead, it lets
you choose existing sessions and keep their status visible in one focused
dashboard.

![AgentSignal main dashboard](docs/screenshots/dashboard-dark.png)

> All screenshots use demonstration data. They do not contain real
> conversations or paths from the author's computer.

## Features

- Track selected Codex and Claude Code sessions in one place.
- Automatically refresh status without sending prompts.
- Traffic-light states: working, needs attention, and idle.
- Distinct animated pets for Codex and Claude.
- Native notifications when a session needs attention or finishes working.
- Search and filter tracked conversations.
- Archive completed items, restore them later, or remove them from the
  dashboard archive.
- Light and dark themes.
- Compact aggregate traffic-light view.
- Optional Android dashboard paired by QR over the local Wi-Fi network.
- Android Web Push notifications while the desktop app remains active.
- Persist tracked and archived sessions locally.
- Minimal interface designed to feel at home beside Codex.

### Add existing sessions

Select **Dodaj czat** (Add chat) to see sessions found in the local Codex and
Claude Code history. Selecting a session adds it only to the AgentSignal
dashboard.

![Selecting sessions to track](docs/screenshots/chat-picker.png)

Archiving or deleting an entry in AgentSignal never deletes the original
conversation. Permanent dashboard removal is intentionally available only
from the archive.

### Compact mode

Choose **Widok → Tryb kompaktowy** (View → Compact mode) to shrink AgentSignal
into a small traffic-light panel. It shows aggregate counts for every state
and an exact per-agent summary.

<p align="center">
  <img src="docs/screenshots/compact-dark.png" width="372" alt="AgentSignal compact mode" />
</p>

### Android dashboard

AgentSignal can serve an installable mobile dashboard directly from the
desktop application. There is no separate AgentSignal backend and no cloud
account. The computer continues to read the local Codex and Claude Code
sources, while a paired Android phone receives a privacy-reduced status
snapshot over the same private Wi-Fi network.

Requirements:

- Android 12 or newer with a current version of Chrome.
- The phone and computer connected to the same private IPv4 network.
- AgentSignal running on the computer, either open or in the Windows tray.
- Internet access only if background Web Push notifications are required.

To connect a phone:

1. Open **Urządzenia mobilne** from the phone icon in the dashboard header.
2. Enable mobile access and allow AgentSignal through Windows Firewall only
   for private networks.
3. Select **Połącz nowy telefon**.
4. Scan the certificate QR code, download the AgentSignal Local CA
   certificate, and install it from Android settings as a CA certificate.
5. Verify that the SHA-256 fingerprint shown by Android matches the value in
   AgentSignal.
6. Continue to the pairing step and scan the second, one-time QR code. The QR
   uses the computer's private IPv4 address directly, so Android does not need
   to resolve a `.local` hostname.
7. In Chrome, choose **Add to Home screen** or **Install app**.
8. Open the installed app and enable notifications.

The pairing code expires after 60 seconds. Once paired, a phone reconnects
automatically whenever AgentSignal is running. You can revoke an individual
phone or reset all mobile access from the same desktop dialog.

Closing the desktop window keeps AgentSignal active in the Windows tray.
Choose **Wyjście** from the application or tray menu to stop monitoring and
make the mobile dashboard go offline.

To remove mobile access completely, revoke the phone in AgentSignal, uninstall
the PWA, and remove **AgentSignal Local CA** from Android's user-installed
credentials.

## Status model

| Color | Status | Meaning |
| --- | --- | --- |
| Red | Working | The agent is currently executing a task. |
| Yellow | Needs attention | The session is waiting for a decision or user response. |
| Green | Idle | The agent is not currently working. |
| Gray | Unavailable | The current session state could not be confirmed. |

Codex exposes its session list through the local App Server. For tracked
conversations, AgentSignal also reads `task_started`, `task_complete`, and
`turn_aborted` events from the local JSONL history. This keeps long-running
tasks marked as active even when the log is briefly quiet.

Claude Code exposes local history through the official SDK's `listSessions`
method. Its working state is inferred from the time of the latest session
activity. Consumer Claude Chat and Cowork conversations are not imported.

## Installation

### Windows installer

1. Open the [latest AgentSignal release](https://github.com/mknizewski/agent-signal/releases/latest).
2. Download `AgentSignal-Setup-<version>.exe`.
3. Run the installer and choose an installation directory.

AgentSignal supports Windows 10 and Windows 11 on x64. It can run with Codex,
Claude Code, or both sources installed.

### Run from source

Requirements: Node.js 22+ and pnpm 11.

```powershell
git clone https://github.com/mknizewski/agent-signal.git
cd agent-signal
pnpm install
pnpm dev
```

Useful commands:

```powershell
pnpm typecheck       # TypeScript checks
pnpm test            # unit tests
pnpm test:sync-smoke # local provider integration smoke test
pnpm build           # production build
pnpm dist            # Windows installer in release/
```

## Privacy and security

AgentSignal is local-first:

- It has no AgentSignal backend or telemetry.
- It does not send conversation content to an AgentSignal server.
- It does not create agents or submit prompts.
- It does not modify or delete original sessions.
- It runs the Codex App Server locally over `stdio`.
- It uses the Claude SDK only to list local sessions.
- Its optional mobile gateway listens only on the selected private network
  interface and accepts paired devices from the same IPv4 subnet.
- It sends mobile clients only titles, agent kinds, status labels, and update
  times. Project paths, summaries, archives, and source session identifiers
  are not part of the mobile API.

Tracked and archived sessions are stored by Electron in
`agent-signal-state.json` inside the application's local data directory. That
file can contain titles, identifiers, and project paths for sessions added to
the dashboard. It is never included in this repository or uploaded by
AgentSignal.

The renderer runs with context isolation, sandboxing, and no Node.js access.
IPC is limited to explicitly defined and validated operations. The application
also uses a Content Security Policy, blocks new windows, and denies browser
permission requests.

The Android PWA requires a per-installation local CA because service workers
and Web Push require a secure HTTPS origin. Private certificate and VAPID keys
are encrypted with the operating-system-backed Electron `safeStorage` API.
Pairing uses a 256-bit, single-use secret valid for 60 seconds. Persistent
device tokens are stored on the phone in a Secure, HttpOnly, SameSite cookie;
AgentSignal stores only token hashes.

Web Push payloads contain the notification title, tracked session title, and
new status. They are encrypted according to the Web Push protocol and sent
directly from the running desktop application to the browser push endpoint.
There is no AgentSignal relay or hosted backend.

See [SECURITY.md](SECURITY.md) for vulnerability reporting instructions.

## Project layout

```text
electron/        main process, provider detection, and synchronization
src/             React interface and shared status models
docs/screenshots README assets
scripts/         provider smoke test and icon generator
build/           application icon
```

## Current limitations

- Claude Code activity detection is based on the latest activity time.
- AgentSignal does not control agents or answer approval requests.
- Session history availability depends on the local Codex or Claude Code
  installation.
- The current installer targets Windows x64.
- The mobile dashboard currently targets Android 12+ and works only within the
  same private IPv4 subnet.
- Some guest Wi-Fi networks block device-to-device traffic. AgentSignal uses
  the computer's private IPv4 address for pairing and does not depend on mDNS
  name resolution on Android.
- Background mobile notifications require internet access to the browser's
  Web Push service.

## License

[MIT](LICENSE)
