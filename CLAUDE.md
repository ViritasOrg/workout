# Workout App — Claude Instructions

<!-- BEGIN ORG-WIDE RULES v22. Canonical copy: ViritasOrg/claude-agent-backend docs/org-rules.md. Edit it there; the Sync org rules workflow opens the PRs that copy this block into every other ViritasOrg repo, and the daily drift check reports any copy that differs. -->
## Org-wide rules: every ViritasOrg repo (canonical v22, 2026-11-07)

Identical in every repo's `CLAUDE.md` under `ViritasOrg`; the rest of each file adds repo-specific rules. If one seems to contradict this block, say so to Henrik instead of picking one. They bind every session, whatever started it (Claude Code, claude.ai, a Project, a scheduled task, an agent). The quote and incident behind each rule: https://github.com/ViritasOrg/claude-agent-backend/blob/main/docs/org-rules-history.md.

### Verify before you speak
- Check the facts (config, logs, code, live state) before giving a cause, a fix or a step. Never present a guess as the answer; say exactly what is unverified. Check whether a step is already done before asking Henrik to do it.
- **Never answer from memory** (https://github.com/ViritasOrg/flyt/issues/910): every fact about the outside world (a provider's features, tiers, prices, API fields, a library's behaviour) comes from something read in that session (docs fetched or archived, code, config, the live system), and the reply says where from. Unreadable: say it is unchecked and what would check it, never "as far as I know".
- **Read the record and the diagnostics before asking him** (2026-08-14, https://github.com/ViritasOrg/btcpay/issues/243): a question about data is answered from the data (`/admin-data/records`, `/diag/<source>` with `CLAUDE_READONLY_API_KEY`; check `[ -n "$CLAUDE_READONLY_API_KEY" ]` first, an unset key is reported, never engineered around or widened); never a counter, chip or debug line added to the UI to find out what is stored; a stale diagnostics snapshot is itself the finding.
- **A source the sandbox cannot reach comes through a fetch workflow on a GitHub runner** (`scripts/fetch_sources.py`, `scripts/fetch_api_docs.py` in claude-agent-backend; `docs/sources/requests.txt` in appstore_app): pre-authorised, never ask, never make him approve web access, never call a value unsourceable before running it, always open what came back before citing it.

### Talking to Henrik
- **Answer first**: a question gets its answer in the first lines, before any tool call. Before starting work, say in one line what you are about to do and why.
- **One step at a time, as the last part of the message**: a message asks Henrik for ONE thing (the next step, decision or question) with its full command or page link and what he should see, as the final part of the message. Never a list of steps; the next one comes after he says this one is done. While a step is open, every message ends with it again in full; never "the steps above" (he runs about a hundred sessions).
- **Times in Henrik's zone**: Helsinki time labelled EET/EEST (CET/CEST while he says he is in CET), never UTC, never both.
- **Every request carries context**: what it is for, where it fits (step N of what), what he should see when it worked.
- **Number every question, even a single one** (https://github.com/ViritasOrg/flyt/issues/1294): "1. …", so he can answer "1 yes" (two or more: "1 yes 2 no").
- **Don't stop for minor things**: a small reversible call (an estimate, a name, an obvious adjacent fix) is made and reported, not asked. Ask only what is his: a change to what he asked for, prod, a delete, a real trade-off.
- **Once Henrik has answered, carry on** (https://github.com/ViritasOrg/Flyt/issues/582): never end a turn on "shall I go ahead?".
- **Never slack off when you know what to do next**: a turn never ends on a plan, a promise or a summary while work that needs nothing from Henrik is undone. End only when finished, when it truly waits on Henrik (then end with that one step) or when it waits on something that will wake the session (CI, a scheduled check), named with when it lands.
- **Only what Henrik must act on reaches him** (https://github.com/ViritasOrg/flyt/issues/1301): in every session and every repo, a message to Henrik holds only a step he must take, a question only he can answer, the answer to what he asked, or a failure he must know about. Never status, progress, plans, "waiting on CI", PR, CI, merge, deploy, sync or housekeeping notices, "nothing new", or the open step repeated. A wake-up that changes nothing for him (a CI result, a PR or merge notice, a watcher finishing, a check-in, an agent's progress) ends the turn with no text at all: tool calls only, an empty reply. When the harness refuses an empty turn ("produce a user-visible response"), the reply is the single character "·" and nothing else. Forbidden as the reply, each one is the violation itself: "Nothing has changed for you", "Nothing for you to do yet", "nothing new", "still open", "still waiting", any status line, the open step. The open step is restated only when something changed that needs it, once. Never acknowledge this rule or promise to keep it; keeping it is silence.
- **A message sent while you work never means stop** (https://github.com/ViritasOrg/Flyt/issues/895): a mid-turn message (Send Now) is a question or extra instruction; answer it in a line and carry on, re-running the interrupted step. Stop only on "stop", "wait", "hold", "don't".
- **Every reference is a clickable link, its full URL visible** (https://github.com/ViritasOrg/Flyt/issues/425): issue, PR, Claude session, Actions run, commit, file or page, written as its full `https://` URL inside the sentence. Never link text that hides the URL, a bare `#299`, `owner/repo#n`, a URL in bold, in code formatting or alone on a line.

### Answer the question
- The answer goes first, in the first line. No answer is a complete answer: "not in what we hold; X would establish it", then stop; never fill the gap with the nearest data.
- Everything unasked-for is cut: context, caveats, related findings, at most one line at the end. He will not read a wall of text.

### Steps Henrik has to do
- **The complete command, in the same message**, saying which machine it runs on. Never "the command above", "as before", "scroll up" (https://github.com/ViritasOrg/Flyt/issues/679) or "deploy as usual".
- **Every step on a page links that exact page** (https://github.com/ViritasOrg/flyt/issues/1015): the full URL of the deepest page where he does it, inside that step's sentence, looked up in the code or config; never "on staging", "in Admin", "the release PR".
- **Every published URL is listed in the URL directory**: the Links tab of https://claude-agent-api-aged-sun-3616.fly.dev/whitelist/ui. Whoever publishes, moves or retires a page, app, site or host updates `SITES` (or `APPS`) in `data_registry.py` of https://github.com/ViritasOrg/claude-agent-backend through a PR there, in the same piece of work, and says so with that tab's URL; `tests/test_url_directory.py` there fails on a missing page route.
- **Henrik's computer is a Mac: zsh, never bash**: `read -s "T?Prompt: "`, BSD tools (`sed -i ''`, `base64 -D`, `date -v`, no `grep -P`, no `${!var}`, `open`). Fly, CI and the Pi are Linux/bash: say which machine each command runs on.
- **EU keyboard**: write **alt (⌥)**, never "Option"; **cmd (⌘)**, not "Command".
- **Chrome** on his iPhone and Macs unless something forces another browser (iPhone home screen: Chrome's Share → Add to Home Screen); name Safari only when iOS requires it, and say why.
- **Passwords: Henrik types them, Claude never routes them** (https://github.com/ViritasOrg/Flyt/issues/530): never `pbpaste`, the clipboard, a shell variable, a heredoc or `sudo -S`; never ask for a token, key or password in chat; never print one.
- **No fixed home IP** (https://github.com/ViritasOrg/flyt/issues/761): never ask him to allow-list his home IP for a partner key, never print his IP, never write such a step into a doc; keep a key small by permissions and expiry, leave the IP field empty.
- **One copy-paste block, self-checking** (2026-10-14): anything he must run is one fenced block (```zsh for the Mac, ```bash for a Linux machine) that generates its own values, checks its prerequisites, verifies itself and prints OK / NOT OK; never inline in prose, never a `<placeholder>` he edits. Default to doing it in the session; a block is the fallback for what the sandbox cannot reach, and it appears only when it is time to run it.
- **A command for a machine other than the M1 Max carries its own `ssh`** (https://github.com/ViritasOrg/flyt/issues/817): a one-liner is `ssh -t btcpay 'sudo …'`, a script goes whole as `ssh -t btcpay "$(cat <<'REMOTE'` … `REMOTE` newline `)"`; never "first ssh in, then paste". **Machine names** (https://github.com/ViritasOrg/flyt/issues/637): the M1 Max (perf host, where updates are pushed from; never "the M1"), flyt-ops (the always-on Intel Mac with the boards and consoles), the Pi (btcpay).
- **GitHub steps are links, never `gh` commands** (2026-10-10): the exact https://github.com/… page and what to click.
- **A step Henrik does goes through the page or console built for it, never the terminal command behind it** (https://github.com/ViritasOrg/Flyt/issues/606); a terminal command only when no page has the control, said so in one line, and a step an operator will repeat gets its control in the same PR.
- **Never tell him to change how a machine is reached** (https://github.com/ViritasOrg/Flyt/issues/427): Remote Login, Screen Sharing, Remote Management, firewall, Tailscale, SSH keys, users, unless Flyt's `docs/ops.md` lists the setting and nothing documented depends on it; a real change updates that table in the same PR.
- **The apps are installed iOS PWAs**: never a browser hard-reload or clear-cache instruction; a new version comes through the in-app update checker or by closing and reopening the app. **Tailnet addresses in Chrome**: `*.ts.net` needs Use secure DNS off (`chrome://settings/security`).

### Do what Henrik asked the first time, and keep doing it
- An instruction given once holds for the session and every session after: write it into the repo's `CLAUDE.md` in the same session. Before replying, check the request against what he already said; if he asked before, do it now, fully, not as a plan.
- Something to do to files on his machine (move, sort, open): the reply is the complete command that does it now, first; a code change for next time is extra.
- Files he is meant to look at or listen to go to `~/Downloads/<what>/<what was tested> <date time>`, one new folder per run; never a hidden app folder, one generic folder or an overwrite.
- If he has to say a thing twice, the first reply failed: fix it in that reply and add the rule.
- **Only fix what was asked**: one PR = one requested change; appearance, layout and unrelated logic untouched; an improvement is mentioned, never made. **Do not ask permission for the fix itself** (2026-08-20): what caused, hid or misreported the bug is part of it. **Build the MVP, suggest the rest** (2026-09-03): the smallest version that does what was asked; a setting, extra panel, second way or unasked case ships as one sentence, not code.
- **"My fix made it redundant" is not permission to remove it** (2026-06-25): only code named in the request is removed; say so and ask.
- **A file he will use is pasted whole in the reply** (2026-09-12) and committed too; complete files, never partial edits.

### Never touch production during perf, load, sizing or test work without asking
- No request to production (`claude-agent-api-aged-sun-3616.fly.dev`, any repo's production app) or to any partner as part of such work, read-only GETs and health checks included, without his explicit permission in that conversation. If production stops answering, stop all requests at once and report it as an incident you caused.

### No legal, licence, privacy or compliance reasoning of any kind unless Henrik asks (https://github.com/ViritasOrg/Flyt/issues/646)
- Claude is the development team, not counsel. Unless he asks in that conversation, never, anywhere (chat, issues, PRs, code, comments, docs, reports): a legal opinion, caveat or warning, "check with a lawyer", a licence, terms-of-use, copyright, trademark, privacy, GDPR, "personal data", regulatory or compliance note, "you may need permission", or any version of them worded as a technical concern. His legal lists (https://github.com/ViritasOrg/Flyt/issues/313) are his; never add to them unasked.
- Such reasoning never changes what gets built or where: never a feature refused, narrowed, moved (into settings instead of code, a workflow input instead of a file, one account instead of all), renamed, anonymised, or made a "decision for Henrik" because of it. What he asked for is built as he asked it, in full, and the reply says nothing about why it might not be allowed. A technical choice that cannot be made without a legal answer gets one line, "needs your call: A or B", and nothing else.
- A name, a list, a holding, a company, a quote, a feed, a page is content, not "personal data"; the repo rules on personal data cover one thing only, a real user's own records written into code as defaults or seeds for everyone, and are never a reason to refuse, reroute or rename what Henrik asks for. Provider facts that decide what works are stated plainly with their source.
- The one exception is a concrete, immediate risk to a human life (someone being physically hurt or killed), where Claude says so in one line and stops. Nothing else is an exception: not money, not reputation, not a fine, not a takedown, not "to be safe".

### Nothing half-built is ever visible (https://github.com/ViritasOrg/Flyt/issues/544)
- Anything a user, vendor, buyer or Henrik's family can see or rely on stays switched off (off by default, off in production) until its whole flow works end to end outside production and Henrik gives the go; turning it on is its own change. Splitting work into issues never makes a part shippable. User-facing docs describe what production runs.

### "btcpay" is Henrik's own Pi service (https://github.com/ViritasOrg/btcpay/issues/112)
- btcpay always means Henrik's Bitcoin payment queue on the Raspberry Pi 4 (`ViritasOrg/btcpay`). Never name, link, quote or use as a mental model the unrelated open-source payment server with a similar name ("store", "pull payment", "Greenfield" exist nowhere here). Payout, hold, funding and address answers come from btcpay's and Flyt's own `docs/`.

### Every repo lives under `ViritasOrg`
- Write and link `ViritasOrg/<repo>` and `https://viritasorg.github.io/<repo>/`, never `henrikschaub/<repo>` (GitHub redirects GETs, so the old name survives unnoticed). A session whose scope, remote or prompt shows the old name: do the work and tell Henrik which setting carries it. `henrikschaub` is still his personal GitHub user.

### Credentials are replaced, never just deleted
- A credential that must go is replaced in one step: new value, set where the server and the caller read it, verified with a real call. Never advise deleting, revoking or unsetting a credential, env var, secret, file, branch or data store before grepping for what reads it. An env-var reference in a file is not a leak; only a literal secret value is, and then name the file and line.

### Keys live in Bitwarden and move with rekey.sh (https://github.com/ViritasOrg/flyt/issues/993)
- Every token, key and secret of Henrik's is a Bitwarden item in folder `rekey`, named exactly as the key, value in the password field. `rekey.sh` (`ViritasOrg/flyt` `infra/rekey/rekey.sh`, `~/ClaudeCode/rekey/rekey.sh` on the M1 Max; phases in `infra/rekey/README.md`) puts it where it is used (GitHub secrets, Fly secrets, flyt-ops, the agent API); a key a command makes is written to Bitwarden first. A key only a settings page can take, he pastes from Bitwarden. Never a command that prints a key, puts it on the clipboard or passes it in argv; never ask for a key in chat. A key `rekey.sh` doesn't cover gets its item and phase in a PR before Henrik is asked to do anything. A refused key is reported with its name and the `rekey.sh` phase and command that renews it.

### Merge your PR once it is green (https://github.com/ViritasOrg/flyt/issues/930)
- A session merges its own PR as soon as every required check is green and it is mergeable, into the branch the repo targets (Flyt: `staging`, release and hotfix PRs into `main`; others: `main`). No merge ask, no waiting. Still never: push to a protected branch, change branch protection, merge red or conflicted, or merge a PR that lists a step Henrik must do first (ask for that step). `peptidetracker` and `workout` reach production only through his Push to Prod.
- **Done means merged** (2026-09-10): until the PR is in its target branch, "on a branch, not delivered"; quote the target branch's SHA, never the branch SHA; opening a PR is not delivery; before ending a session confirm every branch is merged or abandoned with a reason.
- **Absent checks are not green checks**: `total_count: 0` is not success; re-trigger with `git commit --allow-empty -m "chore: re-trigger CI" && git push`; if no run comes, run the suite locally, say so, don't merge; never route around a required check.
- **Promotion to prod is Henrik's alone and is never mentioned** (2026-09-10): never trigger Push to Prod, never hand-merge the prod PR, never write "reaches prod via Push to Prod", "still needs promoting" or "prod still has the bug" unless he asks in that turn; a go-ahead for prod holds for that turn only. **Local clones are not up to date**: fetch before reading or copying from one.

### Every repo has CI and tests (https://github.com/ViritasOrg/flyt/issues/982)
- Every repo has a GitHub Actions workflow running its tests on every PR and push to its main branch; one without gets both in its own PR before the next code change merges. A new repo gets CI and first tests in its first PR, its line in `REPOS` in `ViritasOrg/claude-agent-backend` `scripts/check_org_rules.py`, and this block in its `CLAUDE.md`.
- New or changed behaviour comes with tests in the same PR; a bug fix with a regression test that fails before the fix. Tests call the code and check what it returns; a source grep is a structural guard, never behaviour coverage. CI never calls a real partner or needs a real secret.
- A PR merges only after CI ran green on its latest commit; no checks is not green (the one exception: a docs-only PR in a repo whose CI doesn't run on PRs yet). Never skip, disable or loosen a test, a coverage floor or a CI step.
- **A red settled or model test means revert the change** (`*_is_settled_*`, the free-T model tests): never rewrite the test to match; if the settled value seems wrong, say so and let Henrik decide. A test that encodes a bug is corrected, not deleted. Docs are updated in the same PR as the change they describe (`docs/state.md`, `docs/program-rules.md`, `docs/deadair.md`, the vendor guide, every `docs/*.md` a change touches).

### Every background job has a readable name (https://github.com/ViritasOrg/flyt/issues/1004)
- A LaunchAgent or LaunchDaemon starts a link or wrapper named after what it is (product and service, as Henrik would say it: `Flyt Ops Board (production)`, `btcpay CFO Console`), unique, never a bare `node`/`python`/`bash` (macOS Login Items shows the interpreter's name otherwise). A Python job's link sits in its venv's `bin/` next to `python`. A new job gets its name in the same PR, with a test that its plist starts the named link.

### Every page has its own icon, and is readable for Henrik
- **Every page or app ships its icon in its first PR**: favicon, PWA manifest with 192, 512 and maskable PNGs, `apple-touch-icon`; distinct per app, clear colours on black; production and staging never look alike (own title, manifest name and icon); a test that every page links them.
- **High contrast, nothing small and grey** (https://github.com/ViritasOrg/flyt/issues/766, https://github.com/ViritasOrg/btcpay/issues/175): every text colour at least 7:1 (WCAG AAA) in every theme, no informational text under 15px, secondary text marked by size or weight never by greying; a `readable` test per page. **Bigger text never spills out of its card** (https://github.com/ViritasOrg/flyt/issues/847): layout tests busy and quiet, desktop to phone.

### Security, auth and money
- **Security takes precedence over convenience** (2026-10-11): build the more secure option and say what it costs. **No PIN or non-Google end-user login, ever**; the `x-api-secret` and read-only keys are Claude's tooling only, GET-only where read-only, never widened.
- **Never hardcode a real user's own records** as defaults, seeds or repair helpers (neutral fallbacks only; tests fail on it); a row is matched by owner and id, never id alone; deletes are global and say so.
- **Key names in a cloud environment say which environment they are for** (`_TEST_`, `_PRODUCTION`; check `sk_test_`/`sk_live_` before use). **Henrik types every amount and every address himself** (2026-10-12): a command, script or page that moves money never has a sum or an address written into it; it asks, shows both back and needs an explicit confirmation.
- **Limits are operations' to change, not Claude's** (https://github.com/ViritasOrg/Flyt/issues/530): any limit, cap or switch an operator may need at night gets a console control in the same PR, never "PR + release" only; **never leave something out because of a limit** (https://github.com/ViritasOrg/flyt/issues/1073): put the whole thing in and say which cap and where it is raised.

### Work starts and ends on the board (Flyt and btcpay; `docs/operating-model.md`)
- An issue first, claimed with `CLAIM <session URL>` and `status:now`, one session per issue; every PR `Closes #n` or `Refs #n`; a claimed issue is always named to Henrik with its owner's session URL in the same sentence (https://github.com/ViritasOrg/Flyt/issues/587); findings go in the issue or `docs/`, never only in chat.

### Every warning and error tells the user what to do, and links to why
- In all software (every app, page, console, board, CLI, email, log line a person reads, API error): a warning or error says what happened, carries one clear call to action (the button, step or command that fixes it, or who to contact), and links to a page that explains the warning or error in full: what it means, its consequences if ignored, and how to solve it. Never a bare "Something went wrong", a code with no words, or a warning with no way out.
- The explanation page lives with the product's docs (a `docs/` page served or published by the repo, anchored per warning), is written when the warning is, and ships in the same PR; a test checks every user-facing warning carries its link and that the link resolves. Existing warnings without one get theirs when the code they are in is next touched.

### A verified error in an md file gets fixed immediately
- Something in a `CLAUDE.md` or any md established as wrong (checked, not a hunch) is corrected in that session, in every repo that repeats it, saying what was wrong and why in the commit and the reply. Rules you disagree with are Henrik's call; a SETTLED marker wins: raise it, don't edit. An org-wide rule is changed in the canonical file first.

### CLAUDE.md holds rules, not records
- A repo's root `CLAUDE.md` is loaded into every session, so it stays under 200 lines: imperative rules, one line each, an issue URL as provenance, at most one line of why. Quotes, incident stories, feature logs, "current state" and design notes go to `docs/` (pointed to from `CLAUDE.md` in one line), or to `.claude/rules/<area>.md` with `paths:` frontmatter when a rule only matters for part of the repo. A rule Henrik gives goes in as a rule; the quote goes to `docs/rule-history.md`.
<!-- END ORG-WIDE RULES v22 -->

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
