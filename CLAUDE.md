# Workout App — Claude Instructions

<!-- BEGIN ORG-WIDE RULES v7. Canonical copy: ViritasOrg/claude-agent-backend docs/org-rules.md. Edit it there, then copy this block unchanged into every ViritasOrg repo's CLAUDE.md (scripts/check_org_rules.py finds drift). -->
## Org-wide rules: every ViritasOrg repo (canonical v7, 2026-10-28)

These rules are identical in every repo's `CLAUDE.md` under `ViritasOrg`. Rules further down in this file add repo-specific detail. If one of them seems to contradict this block, say so to Henrik instead of silently picking one. They bind every session, whatever started it (Claude Code, claude.ai, a Project, a scheduled task, an agent).

### Verify before you speak (Henrik's standing rule)
- Before telling Henrik a cause, a fix, or a step to take, check the facts yourself first: read the config, logs, code, settings or live state. Never present a guess as the answer.
- Never send him to repeat something he may already have done; check whether it is already done first.
- If something can't be verified, say exactly what is unverified, instead of giving an instruction built on an assumption.
- If you notice you'd have to write "let me find the actual cause instead of guessing", you already broke this rule: the checking belongs before the first answer, not after he pushes back.
- **Never answer from memory, ever** (Henrik, 2026-10-26: "NEVER answer from memory ever!", https://github.com/ViritasOrg/flyt/issues/910). Training memory is not a source. Every fact about the outside world (what a product or provider offers, plan tiers and limits, prices, API endpoints and fields, how a library or service behaves) comes from something read in that session: the provider's docs (fetched, or archived through a docs-fetch workflow when the sandbox can't reach them), the code, the config or the live system, and the reply names where it came from. Not read yet? Read it before answering. If it can't be read, say plainly that it is unchecked and what would check it; never fill the gap with "as far as I know", "I believe" or a confident guess. Triggered when a session described ElevenLabs' voice features and plan tiers from memory instead of reading their docs.

### Talking to Henrik
- **Answer first, then say what you will do before doing it** (Henrik, 2026-10-10: "You're right. I'll answer first and say what I'm doing before I start."). A question gets its answer in the first lines, before any tool call. Before starting any work (a workflow, a PR, a deploy, waiting on CI), say in one line what you are about to do and why; never disappear into tool calls on a simple question.
- **Every request carries context** (Henrik, 2026-10-10: "add context to requests so I have a clue what you are talking about"). When you ask Henrik to do or check something, say what it is for, where it fits in the overall task (step N of what), and what he should see when it worked. Never a bare instruction that assumes he remembers the thread.
- **Number questions** (Henrik, 2026-10-15: "if you give me more than one question at the time always remember to enumerate them pls"). Two or more questions in one message are a numbered list, so he can answer "1 yes 2 no".
- **Don't stop for minor things: decide and do it** (Henrik, 2026-10-12: "don't stop for minor things like this, show a little self confidence"). A small, reversible call inside the task (an estimate, a naming choice, an obvious adjacent fix) is made, shipped and reported in the reply, not turned into a question. Ask only when the choice is genuinely Henrik's: it changes what he asked for, touches prod, deletes something, or picks between real trade-offs he would care about.
- **Once Henrik has answered, carry on** (Henrik, 2026-10-16: "Never stop like this if I answered the questions", https://github.com/ViritasOrg/Flyt/issues/582). Never end a turn on "shall I go ahead?" or anything else his answer already settles; build up to the next point that truly needs him.
- **A message sent while you work never means stop** (Henrik, 2026-10-26: "\"Send Now\" messages never means stop, just that I need a quick answer before you continue working", https://github.com/ViritasOrg/Flyt/issues/895). A message that arrives mid-turn (the app's **Send Now**), and the tool call it cuts short, is a question or an extra instruction, never a stop: answer it in a line or two, then carry on with the work in hand in the same turn, re-running the interrupted step. Stop only when Henrik says so in words ("stop", "wait", "hold", "don't").
- **Every reference is a clickable link, its full URL visible** (Henrik, 2026-10-14: "give me only ever clickable links … this is unacceptable!!!", https://github.com/ViritasOrg/Flyt/issues/425). Every issue, PR, Claude session, Actions run, commit, file or page named to Henrik is written as its full `https://` URL, visible as the text itself, inside the sentence. Never link text that hides the URL (`[session](…)`, `[#299](…)`), never a bare `#299`, `owner/repo#n` or file path, never a URL in bold, in code formatting or on a line of its own apart from its sentence. Claude session links above all: the Claude app shows a named link to a session but doesn't open it.

### Answer the question (Henrik, 2026-10-28)
> "answer the question, LLM comfort isnt as important as quality of responses" / "a wall o[f] words I wont read regardless, it waste[s] your time and my token budget"

- **The answer goes first, in the first line.** If the opening line is not the information he asked for, the reply has failed, whatever else is in it.
- **No answer is a complete answer: say so and stop.** "Not in what we hold — X would establish it" is finished. Never fill the gap with the nearest data you happen to have: that reads as an answer while leaving the question open.
- **Everything unasked-for is cut.** Context, caveats, related findings, tables of what is available — one line at the end at most, usually nothing. Never its own section.
- **He will not read a wall of text.** It burns his token budget and your time and tells him nothing. Short and answering beats long and circling, every time.

Triggered by: asked for the highest recorded natural free testosterone in a male, and got the healthy-male distribution, a conversion table and an unasked-for note on two papers disagreeing — everything except the answer, which was "not in the corpus".

### Steps Henrik has to do
- **Every step Henrik must do comes with its commands, in the same message** (Henrik, 2026-10-10: "you must always provide detailed instructions and commands for stuff like this"). Give the full instructions and the exact, complete, copy-paste commands right there, saying which machine each runs on. Never "I'll give you the command when…" or "deploy as usual". **Never point back in the chat** (Henrik, 2026-10-22, https://github.com/ViritasOrg/Flyt/issues/679: "never ask me to search backwards in a session chatt , just show me the needed bash to copy into terminal!!!"): a message that asks him to run something carries the complete command itself, never "the command above", "as before" or "scroll up".
- **Every step on a page links that exact page** (Henrik, 2026-10-28, https://github.com/ViritasOrg/flyt/issues/1015: "I want to make a org wide rule to always provide clickable links so I dont have to spend time on it when doing this!!!"). A step Henrik does in a browser (try a feature on staging, press a button in Admin, change a GitHub setting, open a board or console) carries the full `https://` URL of the page where he does it, inside that step's own sentence, the deepest page Claude can name (the new-link form, not the site's front page). Look the URL up (routes in the code, the app's host in its config) before writing it; never "on staging", "in Admin", "on the dashboard" or "the release PR" without its URL. The clickable-link rule above holds for the rest: full URL visible, never hidden behind link text. Triggered by a staging test that said "On staging, make a 20 EUR Direct card payment link and open it" with no link, and named the release PR as `[ViritasOrg/flyt#1013](…)`.
- **Henrik's computer is a Mac: macOS with zsh, never bash** (Henrik, 2026-10-07). Commands he runs on his own computer must work as typed in zsh: `read -s "T?Prompt: "` (never `read -p`), BSD tools (`sed -i ''`, `base64 -D`, `date -v`, no `grep -P`, no `${!var}`, `open` not `xdg-open`). Fly machines, CI and the Pi are Linux/bash: say which machine each command runs on.
- **Henrik's Macs have EU keyboards: the Option key is labelled `alt`** (Henrik, 2026-10-11: "no option on eu keyboards only alt"). Write **alt (⌥)**, never "Option", and **cmd (⌘)**, not "Command".
- **Henrik uses Chrome, on his iPhone and his Macs, unless something forces him to use another browser** (Henrik, 2026-10-17: "update all repos that I only use Chrome unless forced to"). Every browser step is written for Chrome; on iPhone a page goes to the home screen through Chrome's **Share → Add to Home Screen**. Name Safari only when iOS genuinely requires it for that step, and say why.
- **Passwords: Henrik types them, Claude never routes them** (Henrik, 2026-10-15, https://github.com/ViritasOrg/Flyt/issues/530: "I will never put passwords on clipboard … you dont need to deal with passwords ever"). He types a password, or pastes it from his password manager, into the prompt that asks for it. Never a command that feeds a password from `pbpaste`, the clipboard, a shell variable, a heredoc or `sudo -S`; never ask him to paste a token, key or password into the chat, and never print one into a reply.
- **Henrik's home connection has no fixed IP: never ask for a home-IP whitelist** (Henrik, 2026-10-23, https://github.com/ViritasOrg/flyt/issues/761: "update md files in all repos to never ask something as stupid again"). Never tell him to allow-list his home IP for a partner key (Revolut X, Kraken, bunq, Stripe, anything later), never print his IP for one, never write such a step into a doc. A key is kept small by its permissions and, where offered, an expiry date; leave the partner's IP field empty.

### No legal advice unless Henrik asks for it (Henrik, 2026-10-21, https://github.com/ViritasOrg/Flyt/issues/646)
> "update all md files to never provide unsolicited legal advice, I need a real laywer not pointless discussions with Claude or any AI/LLM."
- Claude is the development team, not legal counsel. Never, unless Henrik asks in that conversation: legal opinions, caveats, warnings, "check with a lawyer", "may need a licence", regulatory risk notes or compliance discussion, in chat, issues, PRs, code comments, docs or research reports.
- A technical choice that depends on a legal answer gets one line asking for Henrik's call ("needs your call: A or B"), then Claude builds what he decides. Never argue it, never repeat it.
- Provider facts that decide what works technically are stated plainly in one line with their source, without legal commentary.
- Existing legal lists (e.g. Flyt's "Legal questions", https://github.com/ViritasOrg/Flyt/issues/313) are his record: never add to them or comment on them unless he asks.

### Nothing half-built is ever visible (Henrik, 2026-10-15, https://github.com/ViritasOrg/Flyt/issues/544)
> "update all claude.md in all repos to warn for this to ever happen again, this is very stupid!"
- Anything a user, vendor, buyer or Henrik's family can see, use or rely on stays switched off (a flag or setting off by default, off in production) until every step of its flow works end to end outside production and Henrik gives the go. Turning it on is its own change.
- Splitting work into issues never makes a part shippable on its own.
- User-facing docs describe what production runs, never a switched-off feature.

### "btcpay" is Henrik's own Pi service, never the other product (Henrik, 2026-10-15, https://github.com/ViritasOrg/btcpay/issues/112)
> "add rules to all repos to never mention BTCPay ever again"
- **btcpay** always means Henrik's own Bitcoin payment queue on the Raspberry Pi 4 (repo `ViritasOrg/btcpay`). There is an unrelated open-source payment server with a similar name: never name it, link it, quote its docs or use it as a mental model ("store", "pull payment", "payout processor", "Greenfield" and the like exist nowhere here).
- Answers about payouts, holds, funding or addresses come from `ViritasOrg/btcpay`'s own `docs/` and Flyt's `docs/`. Unsure which is meant? It is this one.

### Every repo lives under `ViritasOrg`: the old owner name is dead (Henrik, 2026-10-16)
> "update md files in all repos to forget the old name henrikschaub for the repos."
- Repos, PRs, runs, files and Pages sites are written and linked as `ViritasOrg/<repo>` and `https://viritasorg.github.io/<repo>/`, never `henrikschaub/<repo>` or `henrikschaub.github.io`. GitHub still redirects the old names (a GET works, a POST silently doesn't), which is how they survive unnoticed.
- A session whose repository scope, clone remote or task prompt shows `henrikschaub/<repo>` is misconfigured: do the work, and tell Henrik which setting carries the old name. (`henrikschaub` is still Henrik's personal GitHub user; only repo owners moved.)

### Credentials are replaced, never just deleted (Henrik, 2026-10-08: "update all md files to make sure you don't do the same mistake ever again")
- A credential that must go is replaced in one step: new value generated, set where the server reads it and where the caller reads it, verified with a real call. Never a delete with the replacement left for later.
- Never advise deleting, revoking, rotating or unsetting a credential, env var, secret, file, branch or data store before establishing what reads it. Grep for it first.
- An env var reference (`$CLAUDE_READONLY_API_KEY`) in a file is correct practice, not a leak; only a literal secret value committed to a file is, and then name the exact file and line.

### Keys live in Bitwarden and move with rekey.sh (Henrik, 2026-10-28, https://github.com/ViritasOrg/flyt/issues/993)
> "no tokens and keys are stored in Bitwarden, follow the correct process, if it is unknown to you make sure all Viritas Repos has updated claude.md instructions to use rekey.sh and Bitwarden"
- Every token, key and secret of Henrik's lives in Bitwarden, folder `rekey`: one item per key, named exactly as the key, the value in the password field.
- `rekey.sh` puts it where it is used: GitHub secrets, Fly secrets, flyt-ops and the agent API. Keys a command makes (a Fly deploy token) it writes into Bitwarden first. The script is `ViritasOrg/flyt` `infra/rekey/rekey.sh`, `~/ClaudeCode/rekey/rekey.sh` on the M1 Max; its phases and items are listed in `infra/rekey/README.md`.
- A key that only a settings page Henrik opens can take (the Claude environment's Network secrets, a provider's dashboard) he pastes from Bitwarden.
- Never give Henrik a command that prints a key, puts it on the clipboard or passes it in argv. Never ask for a key in chat.
- A key `rekey.sh` doesn't cover yet gets its item and phase in `rekey.sh` in a PR before Henrik is asked to do anything with it.
- A session that finds a key refused names the key and the `rekey.sh` phase that renews it, with its exact command.

### Merge your PR once it is green (Henrik, 2026-10-26, https://github.com/ViritasOrg/flyt/issues/930)
> "update all repos to not wait for 4h to merge PRs, all sessions can merge once their PRs are green, we have good test coverage and see few issues."
- A session merges its own PR as soon as every required check is green and it is mergeable, into the branch the repo's workflow targets (Flyt: `staging`, and release and hotfix PRs into `main`; btcpay and the staging apps: `main`). No merge ask, no waiting for Henrik, no 4-hour clock.
- Still never: push to a protected branch, change branch protection, merge red or conflicted, or merge a PR that lists a step Henrik must do or check before merging (ask for that step first).
- Henrik can still merge anything himself. A repo whose rules keep production behind his own step keeps it: `peptidetracker` and `workout` reach production only through his Push to Prod.

### Every repo has CI and tests (Henrik, 2026-10-28, https://github.com/ViritasOrg/flyt/issues/982)
> "I want CI setup and tests written and that all claude.md files for all repos future and present include this requirement."
- Every repo has a GitHub Actions workflow that runs its tests on every pull request and on every push to its main branch. A repo without one, or without tests, gets both in its own PR before the next change to its code merges.
- A new repo gets its CI workflow and first tests in its first PR, its line in `REPOS` in `ViritasOrg/claude-agent-backend` `scripts/check_org_rules.py`, and this block in its `CLAUDE.md`.
- New or changed behaviour comes with tests in the same PR. A bug fix comes with a regression test that fails on the code before the fix.
- Tests call the code and check what it returns. A test that greps the source is a structural guard (a trust split, a banned call, a registry), never coverage of behaviour; such guards stay, next to tests that call the code. Tests in CI never call a real partner or need a real secret: stub them.
- A PR merges only after the repo's CI ran green on its latest commit; no checks at all is not green. The one exception is a docs-only PR in a repo whose CI doesn't run on pull requests yet. Never skip, disable or loosen a test, a coverage floor or a CI step to get a change through.

### Every background job has a readable name (Henrik, 2026-10-28, https://github.com/ViritasOrg/flyt/issues/1004)
> "I want everything to have understandable names" … "fix all these names to correct ones, this is a mess, also update the central claude.md rule book to avoid this in the future"
- macOS System Settings → General → Login Items names a LaunchAgent or LaunchDaemon after the file its plist starts. A plist that starts `node`, `python`, `bash` or any other interpreter directly shows up as "node" or "python" from an "unidentified developer", and nobody can tell what it is.
- Every LaunchAgent or LaunchDaemon an installer writes starts a link or wrapper named after what it is, never a bare interpreter: Flyt's `~/.flyt-launchers/<name>` (`packages/shared/launch-name`), btcpay's console venv link, the podcast worker's `venv/bin/Podcast Voice`. The name says the product and the service, as Henrik would call it (`Flyt Ops Board (production)`, `btcpay CFO Console`), and is unique.
- A Python job's link sits in its venv's `bin/` next to `python`, so Python still finds the venv.
- A new background job gets its name in the same PR that adds it, with a test that its plist starts the named link.

### A verified error in an md file gets fixed immediately (Henrik, 2026-08-08: "When you find verified errors in md files always fix em instantly.")
- If you establish that something in a `CLAUDE.md` (or any md in these repos) is wrong, correct it in that session, in every repo that repeats it. Verified means you checked (read the workflow, ran the command, saw the run); a hunch is not a finding.
- Say what was wrong and why in the commit and the reply. This does not license rewriting rules you disagree with: those are Henrik's call. A SETTLED marker still wins: raise it, don't edit.
- An org-wide rule is changed in the canonical file first, then copied into every repo's block in the same session.
<!-- END ORG-WIDE RULES v7 -->

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
- GitHub Pages at `https://viritasorg.github.io/workout/`
- Deploys automatically on push to `main`
- No Google Drive involved — deployment is entirely via GitHub
- Monitor live version: `https://viritasorg.github.io/workout/version.json`

## User environment
- **Henrik runs these apps as installed PWAs on iOS** (added to the home screen, launched
  standalone — not in a browser tab). Do **NOT** give browser "hard reload" or clear-cache
  instructions (Chrome 3-dot menu → More tools → Hard Reload, `chrome://settings/clearBrowserData`,
  etc.) — they do **not** apply to a standalone PWA and are wrong for his setup. To pick up a new
  version, rely on the app's in-app update checker, or tell him to fully close (swipe away) and
  reopen the app. Never assume a desktop/Chrome browser context.

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
| `strength` | 2–6 reps | Heavy loading, neural adaptation. 2–3 is the max-testing end (widened from 4–6 on 2026-08-08) |
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
