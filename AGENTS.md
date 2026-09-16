# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Project notes for agents

- Expo SDK 57 managed workflow (no checked-in `android/` / `ios/`).
- Package manager in practice: **npm** (`package-lock.json`). The `packageManager` pnpm pin is currently broken on this machine — do not switch managers without an explicit request.
- AI mobile workflow guide: `docs/AI_MOBILE_DEVELOPMENT.md`
- Skills live under `.agents/skills/` (Expo + agent-device).
- MCP config: `.cursor/mcp.json` (Expo remote MCP + agent-device stdio MCP).
- Primary verification target: Android emulator via agent-device + Expo Go.

## Mobile verification rule

Do not mark UI work done until the running Android app has been inspected (screenshot / interaction / error check) when a device is available.
