<p align="center">
  <img src="build/icon.png" width="88" alt="Agent Signal" />
</p>

<h1 align="center">Agent Signal</h1>

<p align="center">
  A calm, local desktop dashboard for monitoring selected Codex and Claude Code sessions.
</p>

<p align="center">
  <img alt="Windows 10 and 11" src="https://img.shields.io/badge/Windows-10%20%7C%2011-2563eb" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-43-47848f" />
  <img alt="MIT License" src="https://img.shields.io/badge/license-MIT-3db47a" />
  <img alt="Local first" src="https://img.shields.io/badge/data-local--first-e4a62b" />
</p>

Agent Signal is not another chat client. It does not create tasks, send prompts,
or replace the official Codex and Claude Code applications. Instead, it lets
you choose existing sessions and keep their status visible in one focused
dashboard.

![Agent Signal 0.6.1 dashboard with project groups, pinned chats, and a new-session prompt](docs/screenshots/dashboard-projects-0.6.1.png)

> All screenshots use demonstration data. They do not contain real
> conversations or paths from the author's computer.

## Features

- Track selected Codex and Claude Code sessions in one place.
- Group watched chats by project, with optional automatic project detection.
- Pin important chats and keep them at the top of each project.
- Open the exact Codex conversation from its row or with a double-click.
- Show project groups in the chat picker.
- Automatically refresh status without sending prompts.
- Traffic-light states: working, approval needed, and idle.
- Detect pending Codex approval and user-input requests from local session logs.
- Detect newly opened sessions and offer to watch them from a bottom-right prompt.
- Distinct animated pets for Codex and Claude, including a configurable sleeping
  state after 15 minutes of inactivity.
- Native notifications when a session needs approval or finishes working.
- Search and filter tracked conversations.
- Collapse or expand the watched-chat list in the left sidebar.
- Configure language, projects, pinning, chat navigation, new-session detection,
  notifications, and idle behavior from the Settings view.
- Switch between naturally written Polish and English interface copy.
- Archive completed items, restore them later, or remove them from the
  dashboard archive.
- Light and dark themes.
- Compact aggregate traffic-light view.
- Optional Android dashboard paired by QR over the local Wi-Fi network.
- Installable Android PWA with live status updates from the desktop app.
- Android Web Push notifications while the desktop app remains active.
- Manage, revoke, or reset trusted phones from the desktop application.
- Persist tracked and archived sessions locally.
- Minimal interface designed to feel at home beside Codex.

### Add existing sessions

Select **Dodaj czat** (Add chat) to see sessions found in the local Codex and
Claude Code history. Selecting a session adds it only to the Agent Signal
dashboard.

![Selecting sessions to track](docs/screenshots/chat-picker.png)

Archiving or deleting an entry in Agent Signal never deletes the original
conversation. Permanent dashboard removal is intentionally available only
from the archive.

### Compact mode

Choose **Widok → Tryb kompaktowy** (View → Compact mode) to shrink Agent Signal
into a small traffic-light panel. It shows aggregate counts for every state
and an exact per-agent summary.

<p align="center">
  <img src="docs/screenshots/compact-dark.png" width="372" alt="Agent Signal compact mode" />
</p>

### Android dashboard

Agent Signal can serve an installable mobile dashboard directly from the
desktop application. There is no separate Agent Signal backend and no cloud
account. The computer continues to read the local Codex and Claude Code
sources, while a paired Android phone receives a privacy-reduced status
snapshot over the same private Wi-Fi network.

Requirements:

- Android 12 or newer with a current version of Chrome.
- The phone and computer connected to the same private IPv4 network.
- Agent Signal running on the computer, either open or in the Windows tray.
- Internet access only if background Web Push notifications are required.

To connect a phone:

1. Open **Urządzenia mobilne** from the phone icon in the dashboard header.
2. Enable mobile access and allow Agent Signal through Windows Firewall only
   for private networks.
3. Select **Połącz nowy telefon**.
4. Scan the certificate QR code, download the Agent Signal Local CA
   certificate, and install it from Android settings as a CA certificate.
5. Verify that the SHA-256 fingerprint shown by Android matches the value in
   Agent Signal.
6. Continue to the pairing step and scan the second, one-time QR code. The QR
   uses the computer's private IPv4 address directly, so Android does not need
   to resolve a `.local` hostname.
7. In Chrome, choose **Add to Home screen** or **Install app**.
8. Open the installed app and enable notifications.

The pairing code expires after 60 seconds. Once paired, a phone reconnects
automatically whenever Agent Signal is running. You can revoke an individual
phone or reset all mobile access from the same desktop dialog.

Mobile access is disabled on a fresh installation and can be started only
from the desktop application. Agent Signal does not announce the gateway
through mDNS. Knowing the computer's address or scanning the LAN is not enough
to read any status data: mobile API calls require a trusted-device token
created by the single-use QR pairing flow.

Closing the desktop window keeps Agent Signal active in the Windows tray.
Choose **Wyjście** from the application or tray menu to stop monitoring and
make the mobile dashboard go offline.

To remove mobile access completely, revoke the phone in Agent Signal, uninstall
the PWA, and remove **Agent Signal Local CA** from Android's user-installed
credentials.

## Status model

| Color | Status | Meaning |
| --- | --- | --- |
| Red | Working | The agent is currently executing a task. |
| Yellow | Approval needed | The session is waiting for approval or user input. |
| Green | Idle | The agent is not currently working. |
| Gray | Unavailable | The current session state could not be confirmed. |

Codex exposes its session list through the local App Server. For tracked
conversations, Agent Signal also reads `task_started`, `task_complete`, and
`turn_aborted` events from the local JSONL history. Pending
`request_user_input` calls and commands requesting elevated permission are
tracked until their matching response, so approval prompts switch the session
to **Approval needed**. If the last active Codex log entry is reasoning and no
follow-up event arrives after a short grace period, Agent Signal treats it as
a host-level approval prompt; these prompts are not written to the
conversation log before the user responds. Explicit task events keep
long-running work marked as active even when the log is briefly quiet.

Claude Code exposes local history through the official SDK's `listSessions`
method. Its working state is inferred from the time of the latest session
activity. Consumer Claude Chat and Cowork conversations are not imported.

## Installation

### Windows installer

1. Open the [latest Agent Signal release](https://github.com/mknizewski/agent-signal/releases/latest).
2. Download `Agent Signal Setup <version>.exe`.
3. Run the installer and choose an installation directory.

Agent Signal supports Windows 10 and Windows 11 on x64. It can run with Codex,
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
pnpm test:mobile-smoke # paired mobile gateway smoke test
pnpm test:app-smoke  # packaged Windows application smoke test
pnpm build           # production build
pnpm dist            # Windows installer in release/
```

## Privacy and security

Agent Signal is local-first:

- It has no Agent Signal backend or telemetry.
- It does not send conversation content to an Agent Signal server.
- It does not create agents or submit prompts.
- It does not modify or delete original sessions.
- It runs the Codex App Server locally over `stdio`.
- It uses the Claude SDK only to list local sessions.
- Its optional mobile gateway listens only on the selected private network
  interface and accepts paired devices from the same IPv4 subnet.
- It does not advertise the mobile gateway through mDNS; an unauthenticated
  client cannot read the mobile API.
- It sends mobile clients only titles, agent kinds, status labels, and update
  times. Project paths, summaries, archives, and source session identifiers
  are not part of the mobile API.

Tracked and archived sessions are stored by Electron in
`agent-signal-state.json` inside the application's local data directory. That
file can contain titles, identifiers, and project paths for sessions added to
the dashboard. It is never included in this repository or uploaded by
Agent Signal.

The renderer runs with context isolation, sandboxing, and no Node.js access.
IPC is limited to explicitly defined and validated operations. The application
also uses a Content Security Policy, blocks new windows, and denies browser
permission requests.

The Android PWA requires a per-installation local CA because service workers
and Web Push require a secure HTTPS origin. Private certificate and VAPID keys
are encrypted with the operating-system-backed Electron `safeStorage` API.
Pairing uses a 256-bit, single-use secret valid for 60 seconds. Persistent
device tokens are stored on the phone in a Secure, HttpOnly, SameSite cookie;
Agent Signal stores only token hashes.

Web Push payloads contain the notification title, tracked session title, and
new status. They are encrypted according to the Web Push protocol and sent
directly from the running desktop application to the browser push endpoint.
There is no Agent Signal relay or hosted backend.

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
- Agent Signal does not control agents or answer approval requests.
- Session history availability depends on the local Codex or Claude Code
  installation.
- The current installer targets Windows x64.
- The mobile dashboard currently targets Android 12+ and works only within the
  same private IPv4 subnet.
- Some guest Wi-Fi networks block device-to-device traffic. Agent Signal uses
  the computer's private IPv4 address for pairing and does not use mDNS.
- Background mobile notifications require internet access to the browser's
  Web Push service.

## License

[MIT](LICENSE)
