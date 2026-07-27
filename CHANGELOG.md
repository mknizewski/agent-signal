# Changelog

Release artifacts and complete release notes are also available on the
[GitHub Releases](https://github.com/mknizewski/agent-signal/releases) page.

## 0.6.4

Version 0.6.4 improves live-state accuracy and startup behavior:

- watched Claude Code chats are read incrementally from their local JSONL
  transcripts, so long-running turns stay **Working** beyond the old
  activity-time window;
- unresolved Claude Code questions and plan approvals are reported as
  **Approval needed** until their matching tool result arrives;
- ordinary long-running commands remain **Working** instead of being guessed
  to be approval prompts;
- Claude Code sessions open directly in the Code tab of Claude Desktop through
  the official `claude://code/{session-id}` deep link, with the CLI retained as
  a fallback when Desktop is unavailable;
- watched chats can use a persistent custom display name in Agent Signal,
  independently of the title stored by Codex or Claude Code;
- fresh Codex subagents are recovered from their watched parent thread when
  they have not appeared in the general App Server list yet;
- Claude Code subagents are discovered from the explicit local `subagents`
  directory stored beside each watched transcript and appear in full and
  compact views;
- compact-mode controls share the native 38-pixel titlebar alignment;
- desktop and mobile notification baselines are established after the first
  full Codex and Claude sync, preventing historical status notifications from
  flooding a fresh app launch.

## 0.6.3

Version 0.6.3 adds independent chat organization:

- watched chats can be assigned manually to any visible project group,
  independently of the project detected by Codex or Claude Code;
- assignments use a dashboard-native group menu, and chats can also be dragged
  between project sections;
- selecting the automatic option removes the manual assignment and restores
  the existing source-based grouping behavior;
- chats can also be detached into the dedicated no-project group;
- manual assignments survive source refreshes, app restarts, archiving, and
  restoring;
- the mobile-device connection window is marked as a Preview feature.

## 0.6.2

Version 0.6.2 focuses on clarity and lighter interaction:

- parent pets always use the standard chat animations, including when subagents
  are present;
- subagents are presented as detected team members without unreliable live
  status labels, colors, or completion claims;
- all scrollbars use a slimmer, lower-contrast treatment;
- compact-mode return and theme controls follow a more natural order;
- the application and installer return to the three-light signal icon;
- project drag-and-drop has a larger handle, clear before/after insertion
  markers, a native drag preview, and keyboard reordering with arrow keys;
- the collapsed sidebar temporarily opens after a short hover delay and remains
  open while focus stays inside it.

## 0.6.1

Version 0.6.1 turns the flat watch list into a configurable project workspace:

- project grouping in the dashboard and in the Add chat window;
- optional automatic project detection from each session's working directory;
- editable project names, badge letters, and badge colors;
- persistent drag-and-drop project ordering;
- independently collapsible project sections;
- a collapsible watched-chat list and a compact icon-only sidebar;
- pinned chats, direct Open buttons, and optional double-click navigation;
- detection of newly opened chats with an optional bottom-right watch prompt;
- a Settings view for organization, navigation, discovery, notifications,
  language, and pet behavior;
- naturally written Polish and English interface copy;
- sleeping pets after a configurable idle period;
- a Codex subagent team panel with mini-pets, roles, and direct child-chat
  navigation;
- a corrected approval state that requires an explicit approval or input signal;
- a 10-second grace period and optional muting for approval-wait notifications;
- a refreshed application identity, promotional artwork, and bilingual Windows
  installer.
