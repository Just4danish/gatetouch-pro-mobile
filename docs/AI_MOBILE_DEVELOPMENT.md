# AI Mobile Development

Validated setup for Cursor-assisted Expo / React Native development on this Windows machine.

## Architecture

```
Cursor
   |
   +-- Expo Skills (.agents/skills/expo-*)
   |
   +-- Expo MCP (https://mcp.expo.dev/mcp)  [OAuth required]
   |      +-- optional local capabilities via expo-mcp + EXPO_UNSTABLE_MCP_SERVER=1
   |
   +-- agent-device (CLI + MCP)
          |
          +-- Android Emulator (Pixel_6)
          +-- Physical Device (ADB)
          +-- Screenshots
          +-- UI interaction (accessibility / testID)
          +-- Events / overlays / debugging help
          +-- Network dump (session log based; flaky on Windows — see Troubleshooting)
```

## Setup

Confirmed on this project:

| Piece | Status |
| --- | --- |
| Expo SDK 57 / RN 0.86 / React 19.2 | Healthy (`npx expo-doctor` 21/21) |
| Expo Skills | Installed (`npx skills add expo/skills --skill '*' --agent cursor -y`) |
| agent-device CLI | `0.21.5` global (`npm install -g agent-device@latest`) |
| agent-device skills | Installed (`npx skills add callstack/agent-device --agent cursor -y`) |
| Project MCP | `.cursor/mcp.json` → Expo + agent-device |
| Expo Go on emulator | Installed from `npx expo-go download android 57` |
| AVD | `Pixel_6` |

## Starting the project

```bash
# From gatetouch_pro/
npm start
# or with Expo MCP local capabilities:
npm run start:mcp
```

Dev server for this workspace commonly uses **port 8082** when 8081 is occupied.

Ensure ADB reverse:

```bash
adb reverse tcp:8082 tcp:8082
adb reverse tcp:8081 tcp:8081
```

## Starting Android

```bash
# Boot emulator (if needed)
emulator -avd Pixel_6

# Confirm device
adb devices

# Open Expo Go into this project
agent-device open host.exp.exponent "exp://127.0.0.1:8082" --platform android --foreground
```

Alternate: with Metro already running, press `a` in the Expo terminal, or:

```bash
npm run android
```

## agent-device

```bash
agent-device doctor
agent-device devices
agent-device open host.exp.exponent "exp://127.0.0.1:8082" --platform android --foreground
agent-device snapshot -i
agent-device press 'id="app.theme.toggle"' --settle
agent-device screenshot docs/artifacts/verify.png
agent-device back --settle
agent-device events 20
agent-device close
```

Prefer stable selectors (`testID` → agent-device `id="..."`). Confirmed working: `id="app.help.open"`, `id="app.help.close"`.

```text
id="app.corridor.name"
id="app.theme.toggle"
id="app.help.open"
id="app.help.close"
id="app.mode.build"
id="app.mode.operate"
id="build.tab.layout"
id="build.tab.lanes"
id="build.tab.look"
id="build.corridors.open"
id="operate.lanes.openAll"
id="operate.lanes.closeAll"
id="operate.lane.<laneId>"
```

Accessibility labels also appear in snapshots (for example `Toggle theme`, `Open guide`, `Layout tab`).

## Expo MCP

Configured in `.cursor/mcp.json`:

```json
"expo": { "url": "https://mcp.expo.dev/mcp" }
```

**ACTION REQUIRED (one-time):** In Cursor, open MCP settings, enable `expo`, complete the Expo OAuth browser login with the same account as `npx expo whoami` (`just4danish`).

Optional local capabilities (screenshots / tap by testID via Expo MCP):

```bash
npm run start:mcp
```

Then reconnect the Expo MCP server in Cursor after starting/stopping Metro.

## Testing a screen

1. Implement the change.
2. `npx tsc --noEmit`
3. Reload Metro / relaunch Expo Go.
4. `agent-device open host.exp.exponent "exp://127.0.0.1:8082" --platform android --foreground`
5. `agent-device snapshot -i`
6. Navigate with `press 'id="..."'` or labels.
7. `agent-device screenshot`
8. Fix issues; repeat.

## Screenshot verification

```bash
agent-device screenshot docs/artifacts/before.png
# make code change + reload
# Prefer relaunch against the real Metro port (this project often uses 8082).
# Plain `agent-device metro reload` may target 8081 if that port also has a bundler.
agent-device open host.exp.exponent "exp://127.0.0.1:8082" --platform android --relaunch --foreground
agent-device screenshot docs/artifacts/after.png
```

For sparse accessibility trees, use plain screenshots and coordinates, then retry `snapshot -i`.

## Debugging

| Signal | How |
| --- | --- |
| RedBox / LogBox | `agent-device react-native dismiss-overlay` after `snapshot -i` |
| Session timeline | `agent-device events` |
| JS console in Expo terminal | Watch the Metro terminal running `npm start` |
| RN component / profiler | `agent-device help react-devtools` (may require npm spawn; see Troubleshooting) |
| Overlay visual proof | `agent-device screenshot --overlay-refs` |

## Network debugging

agent-device supports:

```bash
agent-device network dump 20 --include headers
```

On this Windows setup, `network dump` / `logs path` currently hit a file-identity race on the session `app.log`. Treat network dump as **partially available**. Fallbacks:

- Expo / Metro terminal request failures
- Temporary `console.log` around `fetch` (remove before commit)
- Argent MCP (optional) for JS + native network inspection — see recommendation below

Do not log auth tokens or secrets.

## Physical Android device

1. Enable Developer options → USB debugging.
2. `adb devices` must show `device` (not `unauthorized`).
3. `adb reverse tcp:8082 tcp:8082`
4. Same `agent-device open host.exp.exponent "exp://127.0.0.1:8082" --platform android` flow.
5. For deeper native inspection, prefer an EAS development build (`eas.json` already has a `development` profile) over Expo Go.

## testID convention

Use stable dotted semantic IDs. Only on important interactive controls.

```text
<area>.<control>[.<id>]

app.theme.toggle
app.mode.build
build.tab.lanes
operate.lane.<id>
```

Avoid layout-only views. Prefer `accessibilityLabel` alongside `testID`.

## Argent MCP (optional)

**Recommendation: Needs Review / Not Required for baseline.**

Useful because:

1. React fiber / component tree inspection via Metro CDP
2. JS + native network payload inspection
3. React + native performance profiling

Overlap with agent-device:

1. Emulator control / taps / screenshots / accessibility
2. Log / overlay handling
3. Basic automation loops

Do **not** install Argent unless the team needs component-tree or deep network/profiling beyond agent-device. Ask before installing.

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `Unable to resolve module react-native-worklets` | Ensure dependency installed; restart Metro with `--clear` |
| Port in use | Use existing Metro port or free it; keep `adb reverse` in sync |
| Expo Go missing | `npx expo-go download android 57` then `adb install -r Expo-Go-57.0.9.apk` |
| Empty interactive snapshot | Wait for load; dismiss RN overlay; retry `snapshot -i` |
| `npm not found` inside agent-device React DevTools/CDP | Windows spawn quirk with nvm; MCP `env.Path` includes `C:\nvm4w\nodejs` — reopen Cursor after MCP changes |
| agent-device `logs` / `network dump` race | Use Metro terminal + `events`; retry after `close` / new session |
| Expo MCP unauthorized | Complete OAuth in Cursor MCP settings |

## Common commands

```bash
npx expo-doctor
npx expo whoami
npm start
npm run start:mcp
npm run android
adb devices
adb reverse tcp:8082 tcp:8082
emulator -avd Pixel_6
agent-device doctor
agent-device open host.exp.exponent "exp://127.0.0.1:8082" --platform android --foreground
agent-device snapshot -i
agent-device screenshot
agent-device press 'id="app.help.open"' --settle
agent-device back --settle
agent-device events 20
npx skills list
```

## Reusable Cursor prompts

### IMPLEMENT + TEST

Implement the requested feature following the existing architecture.
After implementation:

- run type checking
- run relevant tests
- launch/reload Android
- use agent-device
- navigate to the feature
- test the main user flow
- inspect logs / overlays
- take a screenshot
- fix any issue found
- retest

Do not stop after simply writing the code.

### VISUAL UI REVIEW

Open the specified screen using agent-device.
Take a screenshot.
Review:

- spacing
- typography
- alignment
- hierarchy
- responsiveness
- touch targets
- consistency with our existing design system (`src/theme/tokens`, glass chrome)

Fix visible issues and repeat screenshot verification.

### BUG INVESTIGATION

Reproduce the reported issue on Android using agent-device.
Observe the UI behaviour.
Inspect console / Metro logs and network calls where available.
Determine the root cause.
Implement the smallest safe fix.
Reproduce the original flow again and confirm the issue is resolved.
