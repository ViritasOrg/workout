# Workout App — Claude Instructions

## Git workflow — ALWAYS follow this
1. Make changes on a feature branch
2. Create a PR then **immediately merge it yourself** — never stop and ask the user to merge, never push directly to main
3. After merge the `version-bump` GitHub Action auto-increments the minor version in `version.json` and `const VERSION` in `index.html` and commits with `[skip ci]`
4. **After merging, poll `https://henrikschaub.github.io/workout/version.json` every 30 s until the new version appears, then tell the user "live as vX.XXX — test now"**

## Deployment
- GitHub Pages at `https://henrikschaub.github.io/workout/`
- Deploys automatically on push to `main`
- No Google Drive involved — deployment is entirely via GitHub
- Monitor live version: `https://henrikschaub.github.io/workout/version.json`

## User environment
- **Henrik uses Chrome on mobile, never Safari** — when troubleshooting caching/reload issues, give Chrome instructions (3-dot menu → More tools → Hard Reload, or chrome://settings/clearBrowserData)

## Pushing large files (index.html is ~87KB)
The GitHub MCP `push_files` tool handles raw content fine. If it fails due to size,
use the MCP HTTP endpoint directly with the session ingress token:
```python
with open('/home/claude/.claude/remote/.session_ingress_token') as f:
    token = f.read().strip()
# POST to https://api.anthropic.com/v2/ccr-sessions/{session}/github/mcp
# Headers: X-Session-UUID, X-MCP-Server-ID, Authorization: Bearer {token}
# Body: MCP JSON-RPC tools/call for push_files
```

## App structure
- Single-file app: `index.html` (JS, CSS, HTML all inline)
- `version.json` — current version, read by the update-checker in the app
- `const VERSION='x.xx'` in index.html must match `version.json`

## Muscle group volume fractions
All exercise splits are in `EXERCISE_SPLITS` array in index.html.
Fractions per exercise must sum to 1.0. Groups: `legs`, `back`, `arms`, `chest`, `shoulders`.
Key rules:
- Deadlift: legs 0.6, back 0.4
- RDL/Romanian: legs 0.7, back 0.3
- Rows (barbell): back 0.7, arms 0.3
- Rows (cable/machine): back 0.75, arms 0.25
- Face pulls: shoulders 0.55, back 0.45
- Pull-ups: back 0.65, arms 0.35
- Chin-ups: back 0.6, arms 0.4
- Incline press: chest 0.55, shoulders 0.3, arms 0.15
- Bench press: chest 0.6, shoulders 0.25, arms 0.15
- Landmine press: shoulders 0.55, chest 0.3, arms 0.15

## Feature parity with Peptide Tracker — be proactive
The two apps (workout + peptidetracker) should stay in sync on UX/settings features.
Whenever working on either app, check if a feature exists in the other and **proactively suggest or implement parity** without waiting to be asked.

### Known gaps — Workout is MISSING these Peptide Tracker features
- **Configurable tabs** — Peptide has per-tab ON/OFF toggles in Settings (stored in localStorage). Workout does not.
- **Update checker in Settings** — Peptide shows a "check for updates" / new-version banner. Workout has a version check button in Settings; keep them consistent if either changes.

### Known gaps — Peptide Tracker is MISSING these Workout features
- *(document here as discovered)*

### Rule
If you add a settings feature, UX polish, or structural improvement to one app, immediately note "the other app doesn't have this yet — want me to add it?" at the end of your reply.

## Volume chart smoothing
5-session index-based window (= 5 training days per muscle group). Do not change to calendar-based.
