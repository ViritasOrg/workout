# Workout App — Claude Instructions

## 🔒 PROD IS READ-ONLY — DO NOT TOUCH WITHOUT EXPLICIT PERMISSION
This repo (`workout`) is **PRODUCTION**. Claude may read, inspect, and
diagnose anything here freely (view files, check workflow runs, look at commit
history, etc.) but must **NEVER** create branches, commit, push, open PRs, or
merge into this repo on its own initiative — not even for "obvious" fixes,
hotfixes, or anything CI-related.

The **only** repo Claude may freely make changes to in this app pair is
`workout-staging`.

Changes only reach this repo via:
1. **Henrik explicitly tells Claude, in that specific conversation turn, to make
   a change directly to prod.** Authorization does not carry over to future
   turns or sessions — ask again next time.
2. **A staging → prod promotion mechanism**, if/when one exists for this repo
   (mirroring `peptidetracker-staging`'s "Push to Prod" button + promotion
   workflow). Even then, Claude must still **never merge the resulting PR**
   without Henrik's explicit go-ahead in the moment.

This rule exists because on 2026-06-16 Claude bypassed the agreed workflow on
the peptidetracker prod repo by directly hand-editing prod's `index.html`
locally instead of working through staging. The same rule now applies here
proactively. Never repeat that.

## ⚠️ UI CONSISTENCY — ALL COMPOUND TIERS MUST BE IDENTICAL ⚠️
Every compound tier (Peptides, TRT, Enhanced) must have **exactly the same UI features**. If one tier shows dose recommendations, all tiers must show dose recommendations. If one shows an info card, all must. If you add a UI element to one tier, immediately add it to all others in the same session.

**Non-negotiable parity rules:**
- Dose guidance shown in BOTH the add-compound modal AND the edit/configure view for every tier
- Unit dropdowns must include all units used by any compound in that tier (e.g. `IU/day`, `IU/week` for GH Axis; `mg/week`, `mg/day`, `mg/EOD` for androgens)
- Info cards (mechanism, side effects) shown consistently across all compound tiers
- No tier may have a feature that another tier is silently missing

When a new compound tier feature is added, check all other tiers before closing the PR.

## ⚠️ AUTH WARNING — READ BEFORE TOUCHING ANY AUTH CODE ⚠️
**PIN/passcode auth has been PERMANENTLY REMOVED.** Google Sign-In is the ONLY
end-user authentication method across this entire ecosystem (peptidetracker,
peptidetracker-staging, workout, workout-staging, claude-agent-backend). The
whitelist currently contains ONLY `henrik.schaub@gmail.com`. **NEVER
reintroduce a PIN, passcode, shared-secret, or any non-Google login for end
users** — not even as a "fallback" or "legacy" path. The only other credential
in the system is `x-api-secret`, used exclusively by Claude's own backend
tooling, never by end-user-facing apps.

## ⚠️ ONLY FIX WHAT WAS ASKED — NO UNSOLICITED CHANGES ⚠️
Fix exactly what Henrik asked. **Never change anything else**, even if it looks
like an improvement. This applies especially to:
- Visual appearance: colors, gradients, opacity, fills, chart styling
- Layout or spacing
- Unrelated logic or data handling

If you notice something that could be improved while fixing a bug, mention it
in your reply — do NOT silently change it. Unsolicited "improvements" cause
confusion, break things Henrik didn't intend to change, and waste debugging
time. **One PR = one explicitly requested change.**

## ⚠️ "MY FIX MADE IT REDUNDANT" IS NOT PERMISSION TO REMOVE IT ⚠️
This is the single most common way the rule above gets bypassed — through internal reasoning rather than intent.

**The exact failure (2026-06-25, peptidetracker-staging):** A bug was fixed where T3 users didn't always get the Enhanced wizard step. Fix: auto-include `'enhanced'` in `_wiz.goals` inside `initWizard()`. Claude then reasoned: *"The Enhanced toggle in Goals is now redundant — T3 users always have it auto-included."* Claude removed the toggle without being asked. Users lost the ability to opt out of Enhanced on a per-stack basis and saw a blank section with no explanation.

**Why this reasoning is always wrong:**
- "Redundant" is the user's call, not Claude's
- A default and a toggle serve different purposes even when the default is always-on — the toggle gives the user agency to override it per-stack
- A side-effect of your fix appearing "unnecessary" is not the same as being asked to remove it
- This is still a violation of "ONLY FIX WHAT WAS ASKED," just disguised as logical cleanup

**The rule:**
- Make the fix. Stop. Do not touch anything the fix made look unnecessary.
- You may only remove code that was **explicitly named** in the request.
- If your fix genuinely makes something obsolete, **say so in your reply and ask** — never remove it silently.

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

## ⚠️ TRAINING TAG RULES — NEVER DEVIATE ⚠️
Canonical source: `GET /training-rules` on the backend. All workout program
generators (`_generateWorkoutProgram()` and any helpers) must use these exactly:

| Tag | Rep range | Notes |
|-----|-----------|-------|
| `strength` | 4–6 reps | Heavy loading, neural adaptation |
| `volume` | 8–12 reps | Moderate loading, primary hypertrophy stimulus |
| `rehab` | 15 reps | **The ONLY tag permitted above 12 reps** |

**Never write rep counts above 12 in any `pw()` call except with the `rehab` tag.**
The `rehab` tag targets exactly 15 reps per set and is reserved for isolation/prehab
movements only (e.g. Calf Raises as prehab). If you see a `pw()` with reps >12 and
tag `volume` or `strength`, that is a bug — fix it immediately.

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
