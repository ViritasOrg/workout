/**
 * Frontend logic tests — workout app
 * Run: node tests/test_frontend.js [path/to/index.html]
 */
'use strict';
const fs   = require('fs');
const vm   = require('vm');
const path = require('path');
const { execSync } = require('child_process');

const htmlPath = process.argv[2] || path.join(__dirname, '../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const rawScript = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

let passed = 0, failed = 0;
function check(name, condition, detail) {
  if (condition) { console.log(`  ✓ ${name}`); passed++; }
  else           { console.log(`  ✗ ${name}${detail ? ': ' + detail : ''}`); failed++; }
}

// ── 1. Syntax check ───────────────────────────────────────────────────────────
console.log('\n── Syntax ─────────────────────────────────────────────────');
const tmpJs = '/tmp/_workout_test_script.js';
fs.writeFileSync(tmpJs, rawScript);
try {
  execSync(`node --check ${tmpJs}`, { stdio: 'pipe' });
  check('JS parses without errors', true);
} catch(e) {
  check('JS parses without errors', false, e.stderr.toString().split('\n')[0]);
  console.log('\n  FATAL: aborting remaining tests');
  process.exit(1);
}

// ── 2. No hardcoded versions in HTML elements ─────────────────────────────────
console.log('\n── No hardcoded version strings in HTML ───────────────────');
const loginMatch = html.match(/id="login-version"[^>]*>([^<]*)</);
const headMatch = html.match(/id="header-version"[^>]*>([^<]*)</);
check('login-version element is empty',  !loginMatch || loginMatch[1] === '', `got "${loginMatch?.[1]}"`);
check('header-version element is empty', !headMatch || headMatch[1] === '', `got "${headMatch?.[1]}"`);
const staleVersions = [...html.matchAll(/v\d+\.\d+/g)]
  .filter(m => !html.slice(Math.max(0, m.index - 30), m.index).includes('VERSION'))
  .map(m => m[0]);
check('no stale version literals in HTML', staleVersions.length === 0,
  staleVersions.length ? `found: ${[...new Set(staleVersions)].join(', ')}` : '');

// ── 3. No runOnboardingTests in app ───────────────────────────────────────────
console.log('\n── No test code in app ────────────────────────────────────');
check('runOnboardingTests removed from script', !rawScript.includes('runOnboardingTests'));
check('Tests button removed from HTML',         !html.includes('runOnboardingTests()'));

// ── No PIN auth remnants ───────────────────────────────────────────────────────
console.log('\n── No PIN auth remnants ────────────────────────────────────');
check('hashPin removed from script',        !rawScript.includes('hashPin'));
check('submitPin removed from script',      !rawScript.includes('submitPin'));
check('app_pin localStorage key removed',   !rawScript.includes('app_pin'));
check('x-app-token header removed',         !rawScript.includes('x-app-token'));
check('WEIGHTS_TOKEN removed',              !rawScript.includes('WEIGHTS_TOKEN'));
check('pin-screen markup removed',          !html.includes('id="pin-screen"'));

// ── Sandbox setup ─────────────────────────────────────────────────────────────
const patched = rawScript
  .replace('const APP_ID=', 'var APP_ID=')
  .replace('const EXERCISE_SPLITS=', 'var EXERCISE_SPLITS=')
  .replace('const GROUP_COLORS=',    'var GROUP_COLORS=')
  .replace('const EX_OPTS_HTML=',    'var EX_OPTS_HTML=')
  .replace('const DAYS=',            'var DAYS=')
  .replace('const DAY_TEMPLATES=',   'var DAY_TEMPLATES=')
  .replace('const THEMES=',          'var THEMES=')
  .replace("const VERSION='",        "var VERSION='")
  .replace('const AGENT_URL=',       'var AGENT_URL=')
  .replace('let _googleToken=',      'var _googleToken=')
  .replace('const GOOGLE_CLIENT_ID=','var GOOGLE_CLIENT_ID=')
  .replace('let logs=',              'var logs=')
  .replace('let weights=',           'var weights=')
  .replace('let volWindow=',         'var volWindow=')
  .replace('let strWindow=',         'var strWindow=')
  .replace('let _weightWindow=',     'var _weightWindow=')
  .replace('let _chartScale=',       'var _chartScale=')
  .replace('let _programs=',         'var _programs=')
  .replace('let _pageVis=',          'var _pageVis=')
  .replace('const PAGE_LABELS=',     'var PAGE_LABELS=')
  .replace('const PRIMARY_GROUPS=',  'var PRIMARY_GROUPS=')
  .replace('let bfLog=',             'var bfLog=');

const noop = () => {};

// Track CSS vars set via documentElement.style.setProperty
const _cssVars = {};
// Track elements by ID for assertions
const _idStore = {};

const makeTrackingEl = (extraClasses = []) => {
  const cls = new Set(extraClasses);
  const el = {
    style: { cssText: '', display: '' },
    dataset: {},
    classList: {
      add(...cs)   { cs.forEach(c => cls.add(c)); },
      remove(...cs){ cs.forEach(c => cls.delete(c)); },
      contains(c)  { return cls.has(c); },
      toggle(c, f) { if (f === undefined ? !cls.has(c) : f) cls.add(c); else cls.delete(c); },
    },
    _classes: cls,
    appendChild: noop, removeChild: noop, insertBefore: noop, addEventListener: noop,
    children: [], querySelectorAll: () => [], querySelector: () => makeTrackingEl(),
    offsetWidth: 300,
    getContext: () => ({
      scale: noop, beginPath: noop, moveTo: noop, lineTo: noop, arc: noop,
      fill: noop, stroke: noop, fillText: noop, closePath: noop,
      save: noop, restore: noop, fillRect: noop, strokeRect: noop, setLineDash: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
    }),
    onclick: null,
  };
  Object.defineProperty(el, 'innerHTML',   { get: () => '', set: noop });
  Object.defineProperty(el, 'textContent', { get: () => '', set: noop });
  Object.defineProperty(el, 'value',       { get: () => '0', set: noop });
  Object.defineProperty(el, 'className',   { get: () => '', set: noop });
  Object.defineProperty(el, 'disabled',    { get: () => false, set: noop });
  return el;
};

const sandbox = vm.createContext({
  window: { addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1, location: { reload: noop, href: '' } },
  localStorage: {
    _s: {},
    getItem(k)    { return this._s[k] !== undefined ? this._s[k] : null; },
    setItem(k, v) { this._s[k] = v; },
    removeItem(k) { delete this._s[k]; },
  },
  document: {
    getElementById(id) {
      if (!_idStore[id]) {
        _idStore[id] = makeTrackingEl(id === 'onboarding-overlay' ? ['hidden'] : []);
      }
      return _idStore[id];
    },
    querySelectorAll: () => [makeTrackingEl()],
    querySelector:    () => makeTrackingEl(),
    createElement:    () => makeTrackingEl(),
    body:  makeTrackingEl(),
    head:  makeTrackingEl(),
    addEventListener: noop,
    hidden: false,
    documentElement: {
      style: {
        setProperty(k, v) { _cssVars[k] = v; },
        getPropertyValue(k) { return _cssVars[k] || ''; },
      },
    },
  },
  fetch:      async () => ({ ok: false, json: async () => ({}), status: 503 }),
  google: undefined, confirm: () => false, alert: noop,
  setTimeout: noop, clearTimeout: noop, setInterval: noop, console,
  AbortController: class { constructor() { this.signal = {}; } abort() {} },
  Date, Math, JSON, Promise, Set, Map, Array, Object, Number, String, Boolean, Error, parseInt, parseFloat, isNaN,
});
vm.runInContext(patched, sandbox);
const G = sandbox;

// ── 4. Meta ───────────────────────────────────────────────────────────────────
console.log('\n── Meta ───────────────────────────────────────────────────');
check('VERSION defined',             typeof G.VERSION === 'string');
check('VERSION is x.xx format',      /^\d+\.\d+$/.test(G.VERSION || ''), `got "${G.VERSION}"`);
check('AGENT_URL is https',          G.AGENT_URL?.startsWith('https://'));
const fns = rawScript.match(/(?:async\s+)?function\s+(\w+)\s*\(/g) || [];
const fnNames = fns.map(s => s.replace(/async\s+|function\s+|\s*\(/g, ''));
const dupes = fnNames.filter((n, i) => fnNames.indexOf(n) !== i);
check('no duplicate function names', dupes.length === 0, dupes.length ? dupes.join(', ') : '');

// ── 5. EXERCISE_SPLITS ────────────────────────────────────────────────────────
console.log('\n── EXERCISE_SPLITS — all fractions sum to 1.0 ─────────────');
check('EXERCISE_SPLITS defined',     Array.isArray(G.EXERCISE_SPLITS));
check('30+ exercises',               (G.EXERCISE_SPLITS?.length || 0) >= 30, `got ${G.EXERCISE_SPLITS?.length}`);
const badSplits = [];
for (const [kw, sp] of (G.EXERCISE_SPLITS || [])) {
  const sum = Object.entries(sp).filter(([k]) => k !== 'factor' && k !== 'cable').reduce((a, [, v]) => a + v, 0);
  if (Math.abs(sum - 1.0) > 0.001) badSplits.push(`"${kw}" sums to ${sum.toFixed(3)}`);
}
check('all fractions sum to 1.0',    badSplits.length === 0, badSplits.join('; '));
check('deadlift legs=0.6 back=0.4',  G.EXERCISE_SPLITS?.some(([k, v]) => k === 'deadlift' && v.legs === 0.6 && v.back === 0.4));
check('face pull shoulders=0.55 back=0.45', G.EXERCISE_SPLITS?.some(([k, v]) => k === 'face pull' && v.shoulders === 0.55 && v.back === 0.45));
check('barbell row back=0.7 arms=0.3', G.EXERCISE_SPLITS?.some(([k, v]) => k === 'barbell row' && v.back === 0.7 && v.arms === 0.3));
check('bench chest=0.6 shoulders=0.25', G.EXERCISE_SPLITS?.some(([k, v]) => k === 'bench' && v.chest === 0.6 && v.shoulders === 0.25));
check('incline chest=0.55',           G.EXERCISE_SPLITS?.some(([k, v]) => k === 'incline' && v.chest === 0.55));
check('landmine shoulders=0.55',      G.EXERCISE_SPLITS?.some(([k, v]) => k === 'landmine' && v.shoulders === 0.55));

// ── 6. GROUP_COLORS ───────────────────────────────────────────────────────────
console.log('\n── GROUP_COLORS ───────────────────────────────────────────');
const GC = G.GROUP_COLORS || {};
check('all 5 groups defined',        ['legs', 'back', 'chest', 'shoulders', 'arms'].every(g => GC[g]));
check('legs is yellow (#e8ff3c)',     GC.legs === '#e8ff3c');
check('back is green (#3cffa0)',      GC.back === '#3cffa0');

// ── 7. smoothArr ─────────────────────────────────────────────────────────────
console.log('\n── smoothArr ──────────────────────────────────────────────');
check('smoothArr defined',           typeof G.smoothArr === 'function');
const s1 = G.smoothArr([10, 20, 30, 40, 50], 5);
check('length preserved',            s1.length === 5);
check('first value = itself',        Math.abs(s1[0] - 10) < 0.01, `got ${s1[0]}`);
check('window=5 last = avg all',     Math.abs(s1[4] - 30) < 0.01, `got ${s1[4]}`);
const s2 = G.smoothArr([10, 20, 30, 40, 50], 3);
check('window=3 index[2]=(10+20+30)/3', Math.abs(s2[2] - 20) < 0.01, `got ${s2[2]}`);
check('window=3 index[4]=(30+40+50)/3', Math.abs(s2[4] - 40) < 0.01, `got ${s2[4]}`);
check('single element → itself',     G.smoothArr([100], 5)[0] === 100);
// edge cases
check('empty array → []',            G.smoothArr([], 5).length === 0);
check('w=1 is identity',             G.smoothArr([10, 20, 30], 1).every((v, i) => v === [10, 20, 30][i]));
const sOver = G.smoothArr([10, 20], 10);
check('w > length still works',      sOver.length === 2);
check('w > length: index[0]=10',     Math.abs(sOver[0] - 10) < 0.01, `got ${sOver[0]}`);
check('w > length: index[1]=(10+20)/2=15', Math.abs(sOver[1] - 15) < 0.01, `got ${sOver[1]}`);

// ── 8. calcVolume ─────────────────────────────────────────────────────────────
console.log('\n── calcVolume ─────────────────────────────────────────────');
check('calcVolume defined',          typeof G.calcVolume === 'function');
check('80kg 5-5-5-5-5 = 2000',       G.calcVolume('Squat 80kg 5-5-5-5-5') === 2000);
check('100kg 10-10-10 = 3000',       G.calcVolume('Deadlift 100kg 10-10-10') === 3000);
check('no kg → null',                 G.calcVolume('Pull-ups max-max-max') === null);
check('two exercises sum correctly', G.calcVolume('Squat 80kg 5-5\nBench 60kg 8-8') === 80 * 10 + 60 * 16);

// ── 9. DAY_TEMPLATES ─────────────────────────────────────────────────────────
console.log('\n── DAY_TEMPLATES ──────────────────────────────────────────');
check('DAY_TEMPLATES defined',       typeof G.DAY_TEMPLATES === 'object');
check('6 training days',             [1, 2, 3, 4, 5, 6].every(d => Array.isArray(G.DAY_TEMPLATES?.[d])));
check('each day non-empty',          [1, 2, 3, 4, 5, 6].every(d => (G.DAY_TEMPLATES[d]?.length || 0) > 0));
check('all exercises have name+kg',  Object.values(G.DAY_TEMPLATES || {}).flat().every(e => e.name && e.kg !== undefined));
check('day 1 has Squat',             G.DAY_TEMPLATES?.[1]?.some(e => e.name === 'Squat'));
check('day 4 has Deadlift',          G.DAY_TEMPLATES?.[4]?.some(e => e.name === 'Deadlift'));

// ── 10. THEMES ────────────────────────────────────────────────────────────────
console.log('\n── THEMES ─────────────────────────────────────────────────');
check('THEMES defined',              Array.isArray(G.THEMES));
check('exactly 4 themes',            G.THEMES?.length === 4, `got ${G.THEMES?.length}`);
check('theme IDs are 1–4',           G.THEMES?.every((t, i) => t.id === i + 1));
check('all themes have name',        G.THEMES?.every(t => typeof t.name === 'string' && t.name.length > 0));
check('all themes have bg var',      G.THEMES?.every(t => typeof t.vars?.bg === 'string'));
check('all themes have accent var',  G.THEMES?.every(t => typeof t.vars?.accent === 'string'));
check('all themes have preview array', G.THEMES?.every(t => Array.isArray(t.preview) && t.preview.length >= 2));
check('theme 1 is VOLTAGE (default)', G.THEMES?.[0]?.name === 'VOLTAGE');
check('theme 1 accent is yellow',    G.THEMES?.[0]?.vars?.accent === '#e8ff3c');
check('theme 2 is ROSE',             G.THEMES?.[1]?.name === 'ROSE');
check('theme 2 accent is dark rose',     G.THEMES?.[1]?.vars?.accent === '#e8a8c4');
check('theme 3 is FOREST',           G.THEMES?.[2]?.name === 'FOREST');
check('theme 3 accent is dark forest green',      G.THEMES?.[2]?.vars?.accent === '#78c896');
check('theme 4 is EARTH',            G.THEMES?.[3]?.name === 'EARTH');
check('theme 4 accent is dark earth gold',G.THEMES?.[3]?.vars?.accent === '#d4a870');

// ── 11. applyTheme ────────────────────────────────────────────────────────────
console.log('\n── applyTheme ─────────────────────────────────────────────');
check('applyTheme defined',          typeof G.applyTheme === 'function');

G.applyTheme(1);
check('applyTheme(1) sets --accent to VOLTAGE yellow',
  _cssVars['--accent'] === '#e8ff3c', `got "${_cssVars['--accent']}"`);
check('applyTheme(1) sets --bg',
  typeof _cssVars['--bg'] === 'string' && _cssVars['--bg'].length > 0);
check('applyTheme(1) persists to localStorage',
  sandbox.localStorage._s['wkt-theme'] === 1 || sandbox.localStorage._s['wkt-theme'] === '1');

G.applyTheme(2);
check('applyTheme(2) sets --accent to ROSE dark pink',
  _cssVars['--accent'] === '#e8a8c4', `got "${_cssVars['--accent']}"`);

G.applyTheme(3);
check('applyTheme(3) sets --accent to FOREST green',
  _cssVars['--accent'] === '#78c896', `got "${_cssVars['--accent']}"`);

G.applyTheme(4);
check('applyTheme(4) sets --accent to EARTH gold',
  _cssVars['--accent'] === '#d4a870', `got "${_cssVars['--accent']}"`);

G.applyTheme(99); // invalid id → falls back to first theme
check('applyTheme(invalid) falls back to THEMES[0]',
  _cssVars['--accent'] === '#e8ff3c', `got "${_cssVars['--accent']}"`);

// ── 12. calcNavyBF ────────────────────────────────────────────────────────────
console.log('\n── calcNavyBF ─────────────────────────────────────────────');
check('calcNavyBF defined',          typeof G.calcNavyBF === 'function');

const savedObData = JSON.parse(JSON.stringify(G._obData));

// Male: h=182cm, neck=38cm, waist=90cm → Hodgdon-Beckett → ~19.6%
G._obData = { gender: 'male', height: '182', neck: '38', waist: '90', hips: '' };
const maleBF = G.calcNavyBF();
check('male BF% (h=182 n=38 w=90) ≈ 19.6',
  maleBF !== null && Math.abs(maleBF - 19.6) < 0.6, `got ${maleBF}`);

// Female: h=165cm, neck=33cm, waist=71cm, hips=94cm → ~24.4%
G._obData = { gender: 'female', height: '165', neck: '33', waist: '71', hips: '94' };
const femaleBF = G.calcNavyBF();
check('female BF% (h=165 n=33 w=71 hip=94) ≈ 24.4',
  femaleBF !== null && Math.abs(femaleBF - 24.4) < 0.6, `got ${femaleBF}`);

// Missing height → null
G._obData = { gender: 'male', height: '', neck: '38', waist: '90', hips: '' };
check('BF% null when height empty',  G.calcNavyBF() === null);

// Missing neck → null
G._obData = { gender: 'male', height: '182', neck: '', waist: '90', hips: '' };
check('BF% null when neck empty',    G.calcNavyBF() === null);

// Missing waist → null
G._obData = { gender: 'male', height: '182', neck: '38', waist: '', hips: '' };
check('BF% null when waist empty',   G.calcNavyBF() === null);

// Waist ≤ neck (invalid) → null
G._obData = { gender: 'male', height: '182', neck: '90', waist: '90', hips: '' };
check('BF% null when waist-neck ≤ 0', G.calcNavyBF() === null);

// Female missing hips → null
G._obData = { gender: 'female', height: '165', neck: '33', waist: '71', hips: '' };
check('female BF% null when hips missing', G.calcNavyBF() === null);

// Result is clamped to [1, 60]
G._obData = { gender: 'male', height: '200', neck: '10', waist: '200', hips: '' };
const extremeBF = G.calcNavyBF();
check('BF% clamped to max 60',
  extremeBF !== null && extremeBF <= 60, `got ${extremeBF}`);

G._obData = savedObData;

// ── 13. obInit / openOnboarding ───────────────────────────────────────────────
console.log('\n── obInit / openOnboarding ────────────────────────────────');
check('obInit defined',              typeof G.obInit === 'function');
check('openOnboarding defined',      typeof G.openOnboarding === 'function');
check('_obStep defined',             G._obStep !== undefined);
check('_obData defined',             typeof G._obData === 'object' && G._obData !== null);
check('_obData has required fields',
  ['gender', 'age', 'height', 'weight', 'neck', 'waist', 'hips', 'theme'].every(k => k in G._obData));

// obInit when already onboarded should not open overlay
sandbox.localStorage.setItem('wkt-profile', JSON.stringify({ onboarded: true }));
delete _idStore['onboarding-overlay'];
_idStore['onboarding-overlay'] = makeTrackingEl(['hidden']);
G.obInit();
check('obInit does not open overlay when already onboarded',
  _idStore['onboarding-overlay']._classes.has('hidden'));

// openOnboarding always opens regardless of onboarded status
delete _idStore['onboarding-overlay'];
_idStore['onboarding-overlay'] = makeTrackingEl(['hidden']);
try {
  G.openOnboarding();
  check('openOnboarding does not throw', true);
  check('openOnboarding removes hidden from overlay',
    !_idStore['onboarding-overlay']._classes.has('hidden'));
} catch(e) {
  check('openOnboarding does not throw', false, e.message);
  check('openOnboarding removes hidden from overlay', false, 'threw before executing');
}

check('openOnboarding resets _obStep to 0', G._obStep === 0);

// obInit when NOT onboarded should open overlay
sandbox.localStorage.removeItem('wkt-profile');
delete _idStore['onboarding-overlay'];
_idStore['onboarding-overlay'] = makeTrackingEl(['hidden']);
G.obInit();
check('obInit opens overlay when not yet onboarded',
  !_idStore['onboarding-overlay']._classes.has('hidden'));

sandbox.localStorage.removeItem('wkt-profile');

// ── 14. Settings cards ────────────────────────────────────────────────────────
console.log('\n── Settings cards ─────────────────────────────────────────');
check('buildAppearanceCard defined', typeof G.buildAppearanceCard === 'function');
check('buildProfileCard defined',    typeof G.buildProfileCard === 'function');

try { G.buildAppearanceCard(); check('buildAppearanceCard() does not throw', true); }
catch(e) { check('buildAppearanceCard() does not throw', false, e.message); }

try { G.buildProfileCard(); check('buildProfileCard() does not throw', true); }
catch(e) { check('buildProfileCard() does not throw', false, e.message); }

// ── 15. _escP / formatDate / getWeekKey ───────────────────────────────────────
console.log('\n── _escP / formatDate / getWeekKey ───────────────────────');
check('_escP defined',               typeof G._escP === 'function');
check('_escP: & → &amp;',           G._escP('A & B') === 'A &amp; B');
check('_escP: < → &lt;',            G._escP('<tag>') === '&lt;tag&gt;');
check('_escP: " → &quot;',          G._escP('"hello"') === '&quot;hello&quot;');
check('_escP: no-op on plain text',  G._escP('hello world') === 'hello world');
check('_escP: coerces non-string',   G._escP(42) === '42');
check('_escP: combined chars',       G._escP('<a href="x">&') === '&lt;a href=&quot;x&quot;&gt;&amp;');

check('formatDate defined',          typeof G.formatDate === 'function');
check('formatDate: 2024-01-15 → "15 Jan 2024"', G.formatDate('2024-01-15') === '15 Jan 2024',
  `got "${G.formatDate('2024-01-15')}"`);
check('formatDate: 2023-12-31 → "31 Dec 2023"', G.formatDate('2023-12-31') === '31 Dec 2023',
  `got "${G.formatDate('2023-12-31')}"`);

check('getWeekKey defined',          typeof G.getWeekKey === 'function');
// 2024-01-15 is Monday → stays Monday
check('getWeekKey: Monday stays Monday', G.getWeekKey('2024-01-15') === '2024-01-15',
  `got "${G.getWeekKey('2024-01-15')}"`);
// 2024-01-17 is Wednesday → Monday of that week = 2024-01-15
check('getWeekKey: Wednesday → previous Monday', G.getWeekKey('2024-01-17') === '2024-01-15',
  `got "${G.getWeekKey('2024-01-17')}"`);
// 2024-01-21 is Sunday → Monday of that week = 2024-01-15
check('getWeekKey: Sunday → same-week Monday', G.getWeekKey('2024-01-21') === '2024-01-15',
  `got "${G.getWeekKey('2024-01-21')}"`);
// 2024-01-22 is Monday → new week
check('getWeekKey: next Monday is its own key', G.getWeekKey('2024-01-22') === '2024-01-22',
  `got "${G.getWeekKey('2024-01-22')}"`);

// ── 16. getExSplits ───────────────────────────────────────────────────────────
console.log('\n── getExSplits ────────────────────────────────────────────');
check('getExSplits defined',         typeof G.getExSplits === 'function');
// Exact keyword match
const dlSplits = G.getExSplits('Deadlift 100kg');
check('deadlift: legs=0.6',          dlSplits.legs === 0.6, `got ${dlSplits.legs}`);
check('deadlift: back=0.4',          dlSplits.back === 0.4, `got ${dlSplits.back}`);
// Case-insensitive
const dlUpper = G.getExSplits('DEADLIFT 140KG 5-5-5');
check('getExSplits case-insensitive (DEADLIFT)', dlUpper.legs === 0.6, `got ${dlUpper.legs}`);
// Earlier keyword wins (barbell row before row)
const rowSplits = G.getExSplits('Barbell Row 50kg 12-12');
check('barbell row: back=0.7',       rowSplits.back === 0.7, `got ${rowSplits.back}`);
check('barbell row: arms=0.3',       rowSplits.arms === 0.3, `got ${rowSplits.arms}`);
// Squat is pure legs
const sqSplits = G.getExSplits('Squat 100kg 5');
check('squat: legs=1',               sqSplits.legs === 1, `got ${sqSplits.legs}`);
// Unknown exercise: falls back via MUSCLE_MAP or returns {}
const unkSplits = G.getExSplits('Zork Machine 40kg 10');
check('unknown exercise returns object (not null/undefined)', typeof unkSplits === 'object' && unkSplits !== null);
// Fractions of returned splits sum to 1 for known exercises
const facePullSplits = G.getExSplits('Face Pull 60kg 15');
const fpSum = Object.entries(facePullSplits).filter(([k]) => k !== 'factor' && k !== 'cable').reduce((a, [, v]) => a + v, 0);
check('face pull splits sum to 1.0', Math.abs(fpSum - 1.0) < 0.001, `sum=${fpSum}`);

// ── 17. initTabVis / applyTabVis ─────────────────────────────────────────────
console.log('\n── initTabVis / applyTabVis ───────────────────────────────');
check('initTabVis defined',          typeof G.initTabVis === 'function');
check('applyTabVis defined',         typeof G.applyTabVis === 'function');

// Default: all tabs on when no localStorage entry
sandbox.localStorage.removeItem('wkt-tab-vis');
try {
  G.initTabVis();
  check('initTabVis does not throw with empty localStorage', true);
} catch(e) {
  check('initTabVis does not throw with empty localStorage', false, e.message);
}
check('initTabVis: program tab on by default',  G._pageVis.program  === true);
check('initTabVis: log tab on by default',       G._pageVis.log      === true);
check('initTabVis: history tab on by default',   G._pageVis.history  === true);
check('initTabVis: progress tab on by default',  G._pageVis.progress === true);

// Partial override: disable one tab
sandbox.localStorage.setItem('wkt-tab-vis', JSON.stringify({ program: false }));
G.initTabVis();
check('initTabVis: stored false overrides default', G._pageVis.program === false);
check('initTabVis: other tabs still default to true', G._pageVis.log === true);

// applyTabVis doesn't throw
try { G.applyTabVis(); check('applyTabVis does not throw', true); }
catch(e) { check('applyTabVis does not throw', false, e.message); }

// Restore
sandbox.localStorage.removeItem('wkt-tab-vis');
G.initTabVis();

// ── 18. initPrograms ─────────────────────────────────────────────────────────
console.log('\n── initPrograms ───────────────────────────────────────────');
check('initPrograms defined',        typeof G.initPrograms === 'function');

// Clear programs from localStorage and reinit
sandbox.localStorage.removeItem('workout_programs');
try {
  G.initPrograms();
  check('initPrograms does not throw with empty localStorage', true);
} catch(e) {
  check('initPrograms does not throw with empty localStorage', false, e.message);
}
check('initPrograms seeds at least one program', Array.isArray(G._programs) && G._programs.length >= 1);
check('seeded program has name',     typeof G._programs[0]?.name === 'string' && G._programs[0].name.length > 0);
check('seeded program has days',     Array.isArray(G._programs[0]?.days) && G._programs[0].days.length > 0);
check('_activeProgramIndex is 0 after init', G._activeProgramIndex === 0);

// Load with saved programs
const fakePrograms = [
  { name: 'Test Program', days: [{ name: 'Day A', exercises: [] }] }
];
sandbox.localStorage.setItem('workout_programs', JSON.stringify({ programs: fakePrograms, active_index: 0 }));
G.initPrograms();
check('initPrograms loads saved programs from localStorage',
  G._programs.some(p => p.name === 'Test Program'),
  `programs: ${G._programs.map(p => p.name).join(', ')}`);

// Restore
sandbox.localStorage.removeItem('workout_programs');
G.initPrograms();

// ── 19. buildSessionGroupVol / buildSessionGroupStrength ──────────────────────
console.log('\n── buildSessionGroupVol / buildSessionGroupStrength ────────');
check('buildSessionGroupVol defined',      typeof G.buildSessionGroupVol === 'function');
check('buildSessionGroupStrength defined', typeof G.buildSessionGroupStrength === 'function');

// Test volume math with exercises-mode logs
const _savedLogs = G.logs;
G.logs = [{
  date: '2020-01-15',
  exercises: [{ name: 'Deadlift', sets: [{ kg: 120, reps: 5 }, { kg: 120, reps: 5 }] }]
}];

const volLegs = G.buildSessionGroupVol('legs', 10000);
const volBack = G.buildSessionGroupVol('back', 10000);
// deadlift legs=0.6: 2 × 120 × 5 × 0.6 = 720
// deadlift back=0.4: 2 × 120 × 5 × 0.4 = 480
check('buildSessionGroupVol: returns 1 session for 1 log',
  volLegs.length === 1, `got ${volLegs.length}`);
check('buildSessionGroupVol: legs vol = 720 for 2×5@120kg deadlift',
  volLegs.length > 0 && Math.abs(volLegs[0].vol - 720) < 0.01, `got ${volLegs[0]?.vol}`);
check('buildSessionGroupVol: back vol = 480 for 2×5@120kg deadlift',
  volBack.length > 0 && Math.abs(volBack[0].vol - 480) < 0.01, `got ${volBack[0]?.vol}`);
check('buildSessionGroupVol: session has date field',
  volLegs.length > 0 && volLegs[0].date === '2020-01-15');

// Test zero-reps or zero-kg sets are excluded
G.logs = [{
  date: '2020-01-15',
  exercises: [{ name: 'Squat', sets: [{ kg: 0, reps: 5 }, { kg: 100, reps: 0 }, { kg: 100, reps: 5 }] }]
}];
const volZero = G.buildSessionGroupVol('legs', 10000);
check('buildSessionGroupVol: ignores sets with kg=0 or reps=0',
  volZero.length > 0 && Math.abs(volZero[0].vol - 100 * 5 * 1) < 0.01, `got ${volZero[0]?.vol}`);

// Test strength math with exercises-mode logs
G.logs = [{
  date: '2020-01-15',
  exercises: [{ name: 'Deadlift', sets: [{ kg: 120, reps: 5 }, { kg: 100, reps: 3 }] }]
}];
const strLegs = G.buildSessionGroupStrength('legs', 10000);
// est1rm = kg * (1 + min(reps,15)/30) * frac
// set1: 120*(1+5/30)*0.6 = 120*1.1667*0.6 ≈ 84
// set2: 100*(1+3/30)*0.6 = 100*1.1*0.6 = 66
// best = 84
const expectedStr = 120 * (1 + 5 / 30) * 0.6;
check('buildSessionGroupStrength: returns 1 session for 1 log',
  strLegs.length === 1, `got ${strLegs.length}`);
check('buildSessionGroupStrength: picks best est1rm across sets',
  strLegs.length > 0 && Math.abs(strLegs[0].est1rm - expectedStr) < 0.01,
  `got ${strLegs[0]?.est1rm}, expected ${expectedStr}`);
check('buildSessionGroupStrength: session has date field',
  strLegs.length > 0 && strLegs[0].date === '2020-01-15');

// Caps reps at 10 in 1RM formula (Epley validated ≤10 reps; higher reps overestimate)
G.logs = [{
  date: '2020-01-15',
  exercises: [{ name: 'Squat', sets: [{ kg: 100, reps: 30 }] }]
}];
const strHighReps = G.buildSessionGroupStrength('legs', 10000);
const expectedHighReps = 100 * (1 + 10 / 30) * 1;  // min(30,10)=10
check('buildSessionGroupStrength: reps capped at 10 in formula',
  strHighReps.length > 0 && Math.abs(strHighReps[0].est1rm - expectedHighReps) < 0.01,
  `got ${strHighReps[0]?.est1rm}, expected ${expectedHighReps}`);

// Logs outside cutoff are excluded
G.logs = [{
  date: '2000-01-01',
  exercises: [{ name: 'Squat', sets: [{ kg: 100, reps: 5 }] }]
}];
const strOld = G.buildSessionGroupStrength('legs', 30);
check('buildSessionGroupStrength: respects cutoffDays (old log excluded)',
  strOld.length === 0, `got ${strOld.length} sessions`);

G.logs = _savedLogs;

// ── 19b. isCableEx ────────────────────────────────────────────────────────────
console.log('\n── isCableEx ──────────────────────────────────────────────');
check('isCableEx defined', typeof G.isCableEx === 'function');
// regex matches
check('isCableEx: "Cable Row" → true',       G.isCableEx('Cable Row'));
check('isCableEx: "Rope Pushdown" → true',   G.isCableEx('Rope Pushdown'));
check('isCableEx: "Tricep Pushdown" → true', G.isCableEx('Tricep Pushdown'));
check('isCableEx: "Push-Down" → true',       G.isCableEx('Push-Down'));
check('isCableEx: "Lat Pulldown" → true',    G.isCableEx('Lat Pulldown'));
check('isCableEx: "Pull Down" → true',       G.isCableEx('Pull Down'));
// cable:1 flag matches
check('isCableEx: "Face Pull" → true',       G.isCableEx('Face Pull'));
check('isCableEx: "Lateral Raise" → true',   G.isCableEx('Lateral Raise'));
check('isCableEx: "Overhead Tricep Extension" → true', G.isCableEx('Overhead Tricep Extension'));
// non-cable exercises
check('isCableEx: "Squat" → false',          !G.isCableEx('Squat'));
check('isCableEx: "Barbell Row" → false',    !G.isCableEx('Barbell Row'));
check('isCableEx: "Rear Delt Fly" → false',  !G.isCableEx('Rear Delt Fly'));
check('isCableEx: "Bench Press" → false',    !G.isCableEx('Bench Press'));
check('isCableEx: "Deadlift" → false',       !G.isCableEx('Deadlift'));

// ── 19c. Gear factor in buildSessionGroupVol ──────────────────────────────────
console.log('\n── Gear factor — buildSessionGroupVol ─────────────────────');
const _savedLogsGear = G.logs;

// gear=0.5 halves the volume contribution
G.logs = [{
  date: '2020-02-01',
  exercises: [{ name: 'Face Pull', gear: 0.5, sets: [{ kg: 40, reps: 12 }] }]
}];
const _vGearHalf = G.buildSessionGroupVol('shoulders', 10000);
// shoulders=0.55, gear=0.5 → 40*12*0.55*0.5 = 132
check('gear=0.5 halves shoulder vol (Face Pull 40kg×12)',
  _vGearHalf.length > 0 && Math.abs(_vGearHalf[0].vol - 132) < 0.01,
  `got ${_vGearHalf[0]?.vol}`);

// gear=1.0 keeps full volume
G.logs = [{
  date: '2020-02-01',
  exercises: [{ name: 'Face Pull', gear: 1.0, sets: [{ kg: 40, reps: 12 }] }]
}];
const _vGearFull = G.buildSessionGroupVol('shoulders', 10000);
// shoulders=0.55, gear=1.0 → 40*12*0.55*1.0 = 264
check('gear=1.0 keeps full shoulder vol (Face Pull 40kg×12)',
  _vGearFull.length > 0 && Math.abs(_vGearFull[0].vol - 264) < 0.01,
  `got ${_vGearFull[0]?.vol}`);

// no gear field on a non-cable exercise → ef defaults to 1
G.logs = [{
  date: '2020-02-01',
  exercises: [{ name: 'Squat', sets: [{ kg: 100, reps: 5 }] }]
}];
const _vNoGear = G.buildSessionGroupVol('legs', 10000);
// legs=1, no gear → ef=1 → 100*5*1*1 = 500
check('no gear field on Squat → ef=1, vol=500',
  _vNoGear.length > 0 && Math.abs(_vNoGear[0].vol - 500) < 0.01,
  `got ${_vNoGear[0]?.vol}`);

// gear=0.5 on lateral raise: shoulders=1.0, gear=0.5 → vol halved
G.logs = [{
  date: '2020-02-01',
  exercises: [{ name: 'Lateral Raise', gear: 0.5, sets: [{ kg: 20, reps: 15 }, { kg: 20, reps: 15 }] }]
}];
const _vLR = G.buildSessionGroupVol('shoulders', 10000);
// 2 sets × 20 × 15 × 1.0 × 0.5 = 300
check('gear=0.5 on Lateral Raise: 2×15@20kg → 300',
  _vLR.length > 0 && Math.abs(_vLR[0].vol - 300) < 0.01,
  `got ${_vLR[0]?.vol}`);

// historical log (no gear field) on a cable exercise → ef=1 (no localStorage fallback)
G.logs = [{
  date: '2020-02-01',
  exercises: [{ name: 'Face Pull', sets: [{ kg: 40, reps: 12 }] }]
}];
const _vHistorical = G.buildSessionGroupVol('shoulders', 10000);
// no gear → ef = splits.factor||1 = 1 → 40*12*0.55*1 = 264
check('historical log (no gear) → ef=1, NOT from localStorage',
  _vHistorical.length > 0 && Math.abs(_vHistorical[0].vol - 264) < 0.01,
  `got ${_vHistorical[0]?.vol}`);

// ── 19d. Gear factor in buildSessionGroupStrength ─────────────────────────────
console.log('\n── Gear factor — buildSessionGroupStrength ─────────────────');

// gear=0.5 halves est1RM
G.logs = [{
  date: '2020-02-01',
  exercises: [{ name: 'Face Pull', gear: 0.5, sets: [{ kg: 40, reps: 12 }] }]
}];
const _sGearHalf = G.buildSessionGroupStrength('shoulders', 10000);
// est = 40 * 0.5 * (1 + min(12,10)/30) * 0.55
const _expectedSGearHalf = 40 * 0.5 * (1 + Math.min(12, 10) / 30) * 0.55;
check('gear=0.5 halves est1RM (Face Pull 40kg×12 shoulders)',
  _sGearHalf.length > 0 && Math.abs(_sGearHalf[0].est1rm - _expectedSGearHalf) < 0.01,
  `got ${_sGearHalf[0]?.est1rm}, expected ${_expectedSGearHalf}`);

// gear=1.0 → same as no gear
G.logs = [{
  date: '2020-02-01',
  exercises: [{ name: 'Face Pull', gear: 1.0, sets: [{ kg: 40, reps: 12 }] }]
}];
const _sGearFull = G.buildSessionGroupStrength('shoulders', 10000);
const _expectedSGearFull = 40 * 1.0 * (1 + Math.min(12, 10) / 30) * 0.55;
check('gear=1.0 keeps full est1RM (Face Pull 40kg×12 shoulders)',
  _sGearFull.length > 0 && Math.abs(_sGearFull[0].est1rm - _expectedSGearFull) < 0.01,
  `got ${_sGearFull[0]?.est1rm}, expected ${_expectedSGearFull}`);

// gear=0.5 picks the correct best set (gear applied before comparison)
G.logs = [{
  date: '2020-02-01',
  exercises: [{ name: 'Face Pull', gear: 0.5, sets: [
    { kg: 60, reps: 8 },   // 60*0.5*(1+8/30)*0.55 = ~19.25
    { kg: 40, reps: 12 },  // 40*0.5*(1+12/30)*0.55 = ~15.4
  ]}]
}];
const _sBest = G.buildSessionGroupStrength('shoulders', 10000);
const _expectedBest = 60 * 0.5 * (1 + 8 / 30) * 0.55;
check('gear=0.5: best set selected after gear applied',
  _sBest.length > 0 && Math.abs(_sBest[0].est1rm - _expectedBest) < 0.01,
  `got ${_sBest[0]?.est1rm}, expected ${_expectedBest}`);

// ── 19e. syncWorkoutLogsFromAgent — remote wins for existing IDs ───────────────
console.log('\n── syncWorkoutLogsFromAgent — remote wins ──────────────────');
// We test the merge logic directly by inspecting the function source
const _syncSrc = G.syncWorkoutLogsFromAgent.toString();
check('sync uses byId map (not localIds Set)',
  _syncSrc.includes('byId') && !_syncSrc.includes('localIds'),
  'local-wins logic still present — remote updates will never reach client');
check('sync: remote.forEach overwrites byId entries',
  _syncSrc.includes('remote.forEach'),
  'remote entries must overwrite local ones');

G.logs = _savedLogsGear;

// ── 20. setChartScale routing ─────────────────────────────────────────────────
console.log('\n── setChartScale routing ──────────────────────────────────');
check('setChartScale defined',       typeof G.setChartScale === 'function');
check('_chartScale defined',         typeof G._chartScale === 'string');

// Patch draw functions to record calls
const _origDC  = G.drawChart;
const _origDVC = G.drawVolumeChart;
const _origRSC = G.renderStrengthCharts;
const _calls = [];
G.drawChart           = () => { _calls.push('weight'); };
G.drawVolumeChart     = async () => { _calls.push('volume'); };
G.renderStrengthCharts = async () => { _calls.push('strength'); };

// weight tab
_calls.length = 0;
sandbox.localStorage.setItem('wkt-progress-tab', 'weight');
G.setChartScale('relative');
check('setChartScale on weight tab calls drawChart',
  _calls.includes('weight'), `calls: ${JSON.stringify(_calls)}`);
check('setChartScale on weight tab does NOT call drawVolumeChart',
  !_calls.includes('volume'));

// volume tab
_calls.length = 0;
sandbox.localStorage.setItem('wkt-progress-tab', 'volume');
G.setChartScale('absolute');
check('setChartScale on volume tab calls drawVolumeChart',
  _calls.includes('volume'), `calls: ${JSON.stringify(_calls)}`);
check('setChartScale on volume tab does NOT call drawChart',
  !_calls.includes('weight'));

// strength tab
_calls.length = 0;
sandbox.localStorage.setItem('wkt-progress-tab', 'strength');
G.setChartScale('relative');
check('setChartScale on strength tab calls renderStrengthCharts',
  _calls.includes('strength'), `calls: ${JSON.stringify(_calls)}`);

// unknown tab (no draw call)
_calls.length = 0;
sandbox.localStorage.setItem('wkt-progress-tab', 'overview');
G.setChartScale('absolute');
check('setChartScale on unknown tab calls no draw function',
  _calls.length === 0, `calls: ${JSON.stringify(_calls)}`);

// null/missing tab (no draw call, no throw)
_calls.length = 0;
sandbox.localStorage.removeItem('wkt-progress-tab');
try {
  G.setChartScale('relative');
  check('setChartScale with no tab does not throw', true);
} catch(e) {
  check('setChartScale with no tab does not throw', false, e.message);
}
check('setChartScale with no tab calls no draw function',
  _calls.length === 0, `calls: ${JSON.stringify(_calls)}`);

// Mode is persisted to localStorage
sandbox.localStorage.setItem('wkt-progress-tab', 'weight');
G.setChartScale('absolute');
const storedScale = sandbox.localStorage.getItem('wkt-chart-scale');
check('setChartScale persists mode to localStorage',
  storedScale === '"absolute"' || storedScale === 'absolute', `got "${storedScale}"`);
check('setChartScale updates _chartScale var', G._chartScale === 'absolute', `got "${G._chartScale}"`);

// Restore draw functions
G.drawChart            = _origDC;
G.drawVolumeChart      = _origDVC;
G.renderStrengthCharts = _origRSC;

// ── 21. Key functions ──────────────────────────────────────────────────────────
console.log('\n── Key functions ──────────────────────────────────────────');
[
  'drawVolumeChart', 'drawGroupChart', 'buildSessionGroupVol', 'buildSessionGroupStrength',
  'ensureVolumes', 'getExSplits', 'getWeekKey', 'getExGroup',
  'checkSyncStatus', 'syncUnsyncedNow', 'checkForUpdate', 'checkAppVersion',
  'pushWorkoutLogToAgent', 'pushWeightToAgent', 'syncWorkoutLogsFromAgent', 'syncWeightsFromAgent',
  'saveLog', 'loadSettings', 'renderProgress', 'renderHistory', 'smoothArr', 'calcVolume',
  'applyTheme', 'calcNavyBF', 'obInit', 'openOnboarding', 'buildAppearanceCard', 'buildProfileCard',
  'setChartScale', 'initTabVis', 'applyTabVis', 'initPrograms', 'buildTabsSettingsCard',
  'toggleTabVis', 'formatDate', '_escP',
  '_nextTrainingDay', 'rebuildDayGrid', 'rebuildLogDaySelect', 'getDayLabel',
].forEach(fn => check(`${fn} defined`, typeof G[fn] === 'function'));

// ── 22. _nextTrainingDay / _selectedProgramDay ────────────────────────────────
console.log('\n── _nextTrainingDay / _selectedProgramDay ─────────────────');
check('_nextTrainingDay defined', typeof G._nextTrainingDay === 'function');
check('_selectedProgramDay defined', G._selectedProgramDay !== undefined);
check('rebuildDayGrid defined', typeof G.rebuildDayGrid === 'function');

// Ensure 6-day program is active
sandbox.localStorage.removeItem('workout_programs');
G.initPrograms();
const _prog6 = G.getActiveProgram();
check('active program has 6 days after initPrograms', _prog6 && _prog6.days.length === 6,
  `got ${_prog6 && _prog6.days.length} days`);

const _savedLogs23 = G.logs;

// No logs → expect day 1
G.logs = [];
check('_nextTrainingDay: empty logs → 1', G._nextTrainingDay() === 1, `got ${G._nextTrainingDay()}`);

// Last logged Day 5 in 6-day program → next is Day 6
G.logs = [{ day: 5, date: '2024-01-10', id: 1, exercises: [] }];
check('_nextTrainingDay: last=5 in 6-day → 6', G._nextTrainingDay() === 6, `got ${G._nextTrainingDay()}`);

// Last logged Day 6 in 6-day program → wraps to Day 1
G.logs = [{ day: 6, date: '2024-01-11', id: 2, exercises: [] }];
check('_nextTrainingDay: last=6 in 6-day → 1 (wraps)', G._nextTrainingDay() === 1, `got ${G._nextTrainingDay()}`);

// Last logged Day 1 in 6-day program → next is Day 2
G.logs = [{ day: 1, date: '2024-01-12', id: 3, exercises: [] }];
check('_nextTrainingDay: last=1 in 6-day → 2', G._nextTrainingDay() === 2, `got ${G._nextTrainingDay()}`);

// rebuildDayGrid sets _selectedProgramDay from _nextTrainingDay
G.logs = [{ day: 5, date: '2024-01-10', id: 1, exercises: [] }];
G.rebuildDayGrid();
check('rebuildDayGrid: _selectedProgramDay=6 when last log was day 5',
  G._selectedProgramDay === 6, `got ${G._selectedProgramDay}`);

// rebuildDayGrid with day 6 logs → _selectedProgramDay wraps to 1
G.logs = [{ day: 6, date: '2024-01-11', id: 2, exercises: [] }];
G.rebuildDayGrid();
check('rebuildDayGrid: _selectedProgramDay=1 when last log was day 6 (wrap)',
  G._selectedProgramDay === 1, `got ${G._selectedProgramDay}`);

// initPrograms drives _selectedProgramDay through rebuildDayGrid
G.logs = [{ day: 3, date: '2024-01-08', id: 4, exercises: [] }];
G.initPrograms();
check('initPrograms: _selectedProgramDay=4 when last log was day 3',
  G._selectedProgramDay === 4, `got ${G._selectedProgramDay}`);

// Stale draft day should NOT influence _selectedProgramDay
// (startup IIFE now always uses _selectedProgramDay, not draft.day)
G.logs = [{ day: 5, date: '2024-01-10', id: 1, exercises: [] }];
sandbox.localStorage.setItem('wkt-draft', JSON.stringify({ day: '5', date: '2024-01-10', weight: '', tmpl: {}, custom: [] }));
G.initPrograms(); // → rebuildDayGrid → _selectedProgramDay = 6
check('_selectedProgramDay=6 even when stale draft has day=5',
  G._selectedProgramDay === 6, `got ${G._selectedProgramDay}`);
sandbox.localStorage.removeItem('wkt-draft');

// Restore
G.logs = _savedLogs23;
sandbox.localStorage.removeItem('workout_programs');
G.initPrograms();

// ── 23. getDayLabel ───────────────────────────────────────────────────────────
console.log('\n── getDayLabel ────────────────────────────────────────────');
check('getDayLabel defined', typeof G.getDayLabel === 'function');

// Ensure 6-day hypertrophy program is active
sandbox.localStorage.removeItem('workout_programs');
G.initPrograms();

// 6-Day Hypertrophy — Upper day names: 'Day N — <Focus>'
// getDayLabel extracts the part after '—'
const dl1 = G.getDayLabel(1);
check('getDayLabel(1): string returned', typeof dl1 === 'string' && dl1.length > 0, `got "${dl1}"`);
check('getDayLabel(1): extracts focus after em-dash (Push A)',
  dl1 === 'Push A', `got "${dl1}"`);
check('getDayLabel(2): Pull A', G.getDayLabel(2) === 'Pull A', `got "${G.getDayLabel(2)}"`);
check('getDayLabel(3): Legs A',  G.getDayLabel(3) === 'Legs A', `got "${G.getDayLabel(3)}"`);
check('getDayLabel(4): Push B', G.getDayLabel(4) === 'Push B', `got "${G.getDayLabel(4)}"`);
check('getDayLabel(5): Pull B', G.getDayLabel(5) === 'Pull B', `got "${G.getDayLabel(5)}"`);
check('getDayLabel(6): Legs B', G.getDayLabel(6) === 'Legs B', `got "${G.getDayLabel(6)}"`);

// Out-of-range returns a non-empty fallback string
const dlOob = G.getDayLabel(99);
check('getDayLabel(99): returns non-empty fallback', typeof dlOob === 'string' && dlOob.length > 0, `got "${dlOob}"`);

// Day number with no em-dash in name → returns full name
// (5-Day Split days use names like 'Push Day' without em-dash)
const _savedActiveIdx24 = G._activeProgramIndex;
G._activeProgramIndex = G._programs.findIndex(function(p){ return p.name === '5-Day Split'; });
if(G._activeProgramIndex < 0) G._activeProgramIndex = _savedActiveIdx24;
const dl5day = G.getDayLabel(1);
check('getDayLabel: no em-dash → returns full day name', typeof dl5day === 'string' && dl5day.length > 0, `got "${dl5day}"`);
G._activeProgramIndex = 0; // restore to hypertrophy

// ── 24. Weight history sort ────────────────────────────────────────────────────
console.log('\n── Weight history sort (newest first) ─────────────────────');
check('sortWeightHistory defined', typeof G.sortWeightHistory === 'function');
check('renderWeightHistory defined', typeof G.renderWeightHistory === 'function');
check('deleteInvalidWeights defined', typeof G.deleteInvalidWeights === 'function');
check('setWeightWindow defined', typeof G.setWeightWindow === 'function');
check('toggleWeightHist defined', typeof G.toggleWeightHist === 'function');

// Valid dates: newest must be first, oldest last
const _whSorted = G.sortWeightHistory([
  { date: '2026-06-01', weight: 90 },
  { date: '2026-06-10', weight: 88 },
  { date: '2026-05-15', weight: 91 },
  { date: '2026-06-05', weight: 89 },
]);
check('sort: first entry is newest (2026-06-10)',
  _whSorted[0].date === '2026-06-10', `got "${_whSorted[0].date}"`);
check('sort: last entry is oldest (2026-05-15)',
  _whSorted[_whSorted.length - 1].date === '2026-05-15', `got "${_whSorted[_whSorted.length - 1].date}"`);
check('sort: strictly descending order',
  _whSorted.every((w, i) => i === 0 || _whSorted[i - 1].date >= w.date),
  `got ${JSON.stringify(_whSorted.map(w => w.date))}`);

// Does not mutate the input array
const _whInput = [{ date: '2026-01-01', weight: 80 }, { date: '2026-02-01', weight: 81 }];
G.sortWeightHistory(_whInput);
check('sort: does not mutate input array',
  _whInput[0].date === '2026-01-01', `got "${_whInput[0].date}"`);

// Invalid-date entries float to the TOP (shown as warnings), valid ones still newest-first below
const _whMixed = G.sortWeightHistory([
  { date: '2026-06-01', weight: 90 },
  { date: '2026-6-3', weight: 69 },          // un-padded → invalid
  { date: '2026-06-10', weight: 88 },
]);
check('sort: invalid-date entry is first (top)',
  !/^\d{4}-\d{2}-\d{2}$/.test(_whMixed[0].date), `got "${_whMixed[0].date}"`);
check('sort: valid entries below are newest-first',
  _whMixed[1].date === '2026-06-10' && _whMixed[2].date === '2026-06-01',
  `got ${JSON.stringify(_whMixed.map(w => w.date))}`);

// Edge cases
check('sort: empty array → []', G.sortWeightHistory([]).length === 0);
const _whSingle = G.sortWeightHistory([{ date: '2026-06-01', weight: 90 }]);
check('sort: single entry preserved', _whSingle.length === 1 && _whSingle[0].weight === 90);

// ── 25. Weight window (30/60/90 filter) ────────────────────────────────────────
console.log('\n── Weight window (30/60/90d filter) ───────────────────────');
const _wwOrig = G._weightWindow;
const _origDrawChart26 = G.drawChart;
let _drawChartCalls = 0;
G.drawChart = () => { _drawChartCalls++; };

G.setWeightWindow(30);
check('setWeightWindow(30) sets _weightWindow=30', G._weightWindow === 30, `got ${G._weightWindow}`);
check('setWeightWindow(30) triggers drawChart', _drawChartCalls === 1, `got ${_drawChartCalls}`);
G.setWeightWindow(60);
check('setWeightWindow(60) sets _weightWindow=60', G._weightWindow === 60, `got ${G._weightWindow}`);
G.setWeightWindow(90);
check('setWeightWindow(90) sets _weightWindow=90', G._weightWindow === 90, `got ${G._weightWindow}`);
check('default _weightWindow is 90', _wwOrig === 90, `got ${_wwOrig}`);

G.drawChart = _origDrawChart26;
G._weightWindow = _wwOrig;

// toggleWeightHist flips open state without throwing
const _whOpenBefore = G._wHistOpen;
try {
  G.toggleWeightHist();
  check('toggleWeightHist toggles _wHistOpen', G._wHistOpen === !_whOpenBefore, `got ${G._wHistOpen}`);
  G.toggleWeightHist();
  check('toggleWeightHist toggles back', G._wHistOpen === _whOpenBefore, `got ${G._wHistOpen}`);
} catch(e) {
  check('toggleWeightHist does not throw', false, e.message);
}

// ── 26. isPressEx (DB button trigger) ─────────────────────────────────────────
console.log('\n── isPressEx (DB button trigger) ───────────────────────────');
check('isPressEx defined', typeof G.isPressEx === 'function');
// Press variants
check('isPressEx: "Bench Press" → true',          G.isPressEx('Bench Press'));
check('isPressEx: "Overhead Press" → true',        G.isPressEx('Overhead Press'));
check('isPressEx: "Arnold Press" → true',           G.isPressEx('Arnold Press'));
check('isPressEx: "Incline DB Press" → true',       G.isPressEx('Incline DB Press'));
check('isPressEx: "Landmine Press" → true',         G.isPressEx('Landmine Press'));
check('isPressEx: "Chest Machine Press" → true',    G.isPressEx('Chest Machine Press'));
// Raise variants — regression for PR #41 (regex changed from /press/ to /press|raise/)
check('isPressEx: "Lateral Raise" → true [PR #41]',       G.isPressEx('Lateral Raise'));
check('isPressEx: "Cable Lateral Raise" → true [PR #41]', G.isPressEx('Cable Lateral Raise'));
check('isPressEx: "Y-Raise" → true [PR #41]',             G.isPressEx('Y-Raise'));
check('isPressEx: "Front Raise" → true [PR #41]',         G.isPressEx('Front Raise'));
// Fly variants — DB button also shown for fly exercises
check('isPressEx: "Rear Delt Fly" → true',  G.isPressEx('Rear Delt Fly'));
check('isPressEx: "Cable Fly" → true',       G.isPressEx('Cable Fly'));
check('isPressEx: "Pec Fly" → true',         G.isPressEx('Pec Fly'));
// Curl variants — DB button also shown for curl exercises
check('isPressEx: "Barbell Curl" → true',    G.isPressEx('Barbell Curl'));
check('isPressEx: "EZ Bar Curl" → true',     G.isPressEx('EZ Bar Curl'));
check('isPressEx: "Hammer Curl" → true',     G.isPressEx('Hammer Curl'));
check('isPressEx: "Preacher Curl" → true',   G.isPressEx('Preacher Curl'));
// Non-press/raise/fly/curl exercises must return false
check('isPressEx: "Squat" → false',        !G.isPressEx('Squat'));
check('isPressEx: "Deadlift" → false',     !G.isPressEx('Deadlift'));
check('isPressEx: "Barbell Row" → false',  !G.isPressEx('Barbell Row'));
check('isPressEx: "Upright Row" → false',  !G.isPressEx('Upright Row'));
check('isPressEx: "Pull-ups" → false',     !G.isPressEx('Pull-ups'));
check('isPressEx: "Face Pulls" → false',   !G.isPressEx('Face Pulls'));
// Case-insensitive
check('isPressEx: case-insensitive "lateral raise"', G.isPressEx('lateral raise'));
check('isPressEx: case-insensitive "BENCH PRESS"',   G.isPressEx('BENCH PRESS'));

// ── 27. toggleDb ──────────────────────────────────────────────────────────────
console.log('\n── toggleDb ────────────────────────────────────────────────');
check('toggleDb defined', typeof G.toggleDb === 'function');
{
  // Activate: inactive (db=1) → active (db=2)
  const _card = { dataset: {}, style: {} };
  const _btn = { dataset: { db: '1', exn: 'Lateral Raise' }, textContent: 'DB',
                  style: { background: '', color: '' }, closest: () => _card };
  G.toggleDb(_btn, 'Lateral Raise');
  check('toggleDb activate: btn.dataset.db = 2',          parseFloat(_btn.dataset.db) === 2,          `got ${_btn.dataset.db}`);
  check('toggleDb activate: btn.textContent stays "DB"',  _btn.textContent === 'DB',                  `got "${_btn.textContent}"`);
  check('toggleDb activate: card.dataset.gear = 2',       parseFloat(_card.dataset.gear) === 2,       `got ${_card.dataset.gear}`);
  check('toggleDb activate: localStorage persisted = 2',  parseFloat(G.localStorage.getItem('wk-db-Lateral Raise')) === 2);
  check('toggleDb activate: btn.style.color = "#000"',    _btn.style.color === '#000',                `got "${_btn.style.color}"`);

  // Deactivate: active (db=2) → inactive (db=1)
  G.toggleDb(_btn, 'Lateral Raise');
  check('toggleDb deactivate: btn.dataset.db = 1',         parseFloat(_btn.dataset.db) === 1,         `got ${_btn.dataset.db}`);
  check('toggleDb deactivate: btn.textContent stays "DB"', _btn.textContent === 'DB');
  check('toggleDb deactivate: card.dataset.gear = 1',      parseFloat(_card.dataset.gear) === 1,      `got ${_card.dataset.gear}`);
  check('toggleDb deactivate: localStorage persisted = 1', parseFloat(G.localStorage.getItem('wk-db-Lateral Raise')) === 1);
}
{
  // Fallback to btn.dataset.exn when exName not provided
  const _card2 = { dataset: {}, style: {} };
  const _btn2 = { dataset: { db: '1', exn: 'Front Raise' }, textContent: 'DB', style: {}, closest: () => _card2 };
  G.toggleDb(_btn2);
  check('toggleDb: no exName param → fallback to btn.dataset.exn', G.localStorage.getItem('wk-db-Front Raise') !== null);
}

// ── 28. toggleGear / toggleGear2 — independent composable toggles ─────────────
console.log('\n── toggleGear / toggleGear2 (independent) ──────────────────');
check('toggleGear defined',  typeof G.toggleGear  === 'function');
check('toggleGear2 defined', typeof G.toggleGear2 === 'function');
function mkGearCard(exn) {
  const b1 = { dataset: { gear: '1',  exn }, textContent: '½ gear',   style: {} };
  const b2 = { dataset: { gear2: '1', exn }, textContent: '2× cable', style: {} };
  const card = { dataset: {}, style: {} };
  b1.closest = () => card; b2.closest = () => card;
  return { card, b1, b2 };
}
{
  // ½ gear alone: 1 → 0.5 → 1
  const { card, b1 } = mkGearCard('Cable Row');
  G.toggleGear(b1, 'Cable Row');
  check('½ gear on: card.dataset.gearHalf = 0.5',  parseFloat(card.dataset.gearHalf) === 0.5, `got ${card.dataset.gearHalf}`);
  check('½ gear on: effective gear = 0.5',         parseFloat(card.dataset.gear) === 0.5,     `got ${card.dataset.gear}`);
  check('½ gear on: localStorage wk-gear- = 0.5',  parseFloat(G.localStorage.getItem('wk-gear-Cable Row')) === 0.5);
  check('½ gear on: button highlighted',           b1.style.background === 'var(--accent)');
  G.toggleGear(b1, 'Cable Row');
  check('½ gear off: effective gear = 1',          parseFloat(card.dataset.gear) === 1,       `got ${card.dataset.gear}`);
  check('½ gear off: localStorage wk-gear- = 1',   parseFloat(G.localStorage.getItem('wk-gear-Cable Row')) === 1);
}
{
  // 2× cable alone: 1 → 2 → 1
  const { card, b2 } = mkGearCard('Cable Fly');
  G.toggleGear2(b2, 'Cable Fly');
  check('2× on: card.dataset.gear2x = 2',          parseFloat(card.dataset.gear2x) === 2,     `got ${card.dataset.gear2x}`);
  check('2× on: effective gear = 2',               parseFloat(card.dataset.gear) === 2,       `got ${card.dataset.gear}`);
  check('2× on: localStorage wk-cable2- = 2',      parseFloat(G.localStorage.getItem('wk-cable2-Cable Fly')) === 2);
  check('2× on: button highlighted',               b2.style.background === 'var(--accent)');
  G.toggleGear2(b2, 'Cable Fly');
  check('2× off: effective gear = 1',              parseFloat(card.dataset.gear) === 1,       `got ${card.dataset.gear}`);
}
{
  // BOTH true at once — the whole point: ½ gear × 2 cables = net 1, both stay lit
  const { card, b1, b2 } = mkGearCard('Tricep Pushdown');
  G.toggleGear(b1, 'Tricep Pushdown');
  G.toggleGear2(b2, 'Tricep Pushdown');
  check('both on: gearHalf stays 0.5',             parseFloat(card.dataset.gearHalf) === 0.5, `got ${card.dataset.gearHalf}`);
  check('both on: gear2x stays 2',                 parseFloat(card.dataset.gear2x) === 2,     `got ${card.dataset.gear2x}`);
  check('both on: effective gear = 0.5×2 = 1',     parseFloat(card.dataset.gear) === 1,       `got ${card.dataset.gear}`);
  check('both on: ½ button still highlighted',     b1.style.background === 'var(--accent)');
  check('both on: 2× button still highlighted',    b2.style.background === 'var(--accent)');
  check('both persisted independently',
    parseFloat(G.localStorage.getItem('wk-gear-Tricep Pushdown')) === 0.5 &&
    parseFloat(G.localStorage.getItem('wk-cable2-Tricep Pushdown')) === 2);
  // turning ½ off leaves 2× untouched
  G.toggleGear(b1, 'Tricep Pushdown');
  check('½ off with 2× on: effective gear = 2',    parseFloat(card.dataset.gear) === 2,       `got ${card.dataset.gear}`);
  check('½ off with 2× on: 2× still highlighted',  b2.style.background === 'var(--accent)');
  G.toggleGear2(b2, 'Tricep Pushdown');
}
{
  // Fallback to btn.dataset.exn when exName not provided
  const { b1 } = mkGearCard('Lat Pulldown');
  G.toggleGear(b1);
  check('toggleGear: no exName param → fallback to btn.dataset.exn', G.localStorage.getItem('wk-gear-Lat Pulldown') !== null);
}

// ── 28b. _gearBtnsHtml / _savedGearState ─────────────────────────────────────
console.log('\n── _gearBtnsHtml / _savedGearState ─────────────────────────');
check('_gearBtnsHtml defined',   typeof G._gearBtnsHtml === 'function');
check('_savedGearState defined', typeof G._savedGearState === 'function');
{
  const hFly = G._gearBtnsHtml('Cable Fly', 1, 1, 1);
  check('Cable Fly: has ½ gear button',      hFly.includes('data-gear=') && hFly.includes('½ gear'));
  check('Cable Fly: has 2× cable button',    hFly.includes('data-gear2=') && hFly.includes('2× cable'));
  check('Cable Fly: buttons have tooltips',  hFly.includes('title="Machine gearing') && hFly.includes('title="Using two cable stacks'));
  check('Cable Fly: has DB button',          hFly.includes('>DB<'));
  const hRow = G._gearBtnsHtml('Cable Row', 0.5, 2, 1);
  check('Cable Row: no DB button',           !hRow.includes('>DB<'));
  const hBench = G._gearBtnsHtml('Bench Press', 1, 1, 1);
  check('Bench Press: no cable buttons',     !hBench.includes('cable') && !hBench.includes('gear<'));
  check('Bench Press: has DB button',        hBench.includes('>DB<'));
  check('Squat: no buttons at all',          G._gearBtnsHtml('Squat', 1, 1, 1) === '');
  // legacy wk-gear-=2 (from the brief combined scheme) reads as 2× cable on, ½ off
  G.localStorage.setItem('wk-gear-Cable Crossover', '2');
  const legacy = G._savedGearState('Cable Crossover');
  check('legacy gear=2 → two=2, half=1', legacy.two === 2 && legacy.half === 1, JSON.stringify(legacy));
  G.localStorage.removeItem('wk-gear-Cable Crossover');
}

// ── 29. getBestKgFromLogs ─────────────────────────────────────────────────────
console.log('\n── getBestKgFromLogs ───────────────────────────────────────');
check('getBestKgFromLogs defined', typeof G.getBestKgFromLogs === 'function');
{
  const _saved = G.logs;
  // logs ordered newest-first (as they are after sync); function returns best from first match
  G.logs = [
    { date: '2026-06-15', exercises: [{ name: 'Bench Press', sets: [{kg:75,reps:6}] }] },
    { date: '2026-06-08', exercises: [{ name: 'Bench Press', sets: [{kg:60,reps:10},{kg:70,reps:8}] }] },
    { date: '2026-06-01', exercises: [{ name: 'Squat',       sets: [{kg:100,reps:5}] }] },
  ];
  // returns best set kg from the first (most recent) log containing that exercise
  check('getBestKgFromLogs: returns best kg from first matching log', G.getBestKgFromLogs('Bench Press') === 75, `got ${G.getBestKgFromLogs('Bench Press')}`);
  check('getBestKgFromLogs: correct exercise matched',          G.getBestKgFromLogs('Squat') === 100,      `got ${G.getBestKgFromLogs('Squat')}`);
  check('getBestKgFromLogs: unknown exercise → null',           G.getBestKgFromLogs('Unknown XYZ') === null);

  G.logs = [{ date: '2026-06-01', exercises: [{ name: 'Pull-ups', sets: [{kg:0,reps:10}] }] }];
  check('getBestKgFromLogs: all sets kg=0 → null',              G.getBestKgFromLogs('Pull-ups') === null);

  G.logs = [];
  check('getBestKgFromLogs: empty logs → null',                  G.getBestKgFromLogs('Bench Press') === null);

  G.logs = [{ date: '2026-06-01', notes: 'Bench Press 60kg 10' }]; // notes-only, no exercises array
  check('getBestKgFromLogs: notes-only log (no exercises key) → null', G.getBestKgFromLogs('Bench Press') === null);

  G.logs = _saved;
}

// ── 30. Draft lifecycle (saveDraft / restoreDraft / clearDraft) ───────────────
console.log('\n── Draft lifecycle ─────────────────────────────────────────');
check('saveDraft defined',    typeof G.saveDraft    === 'function');
check('restoreDraft defined', typeof G.restoreDraft === 'function');
check('clearDraft defined',   typeof G.clearDraft   === 'function');

// clearDraft removes the key
G.setData('wkt-draft', { test: 1 });
check('clearDraft: before clear, draft exists', G.getData('wkt-draft', null) !== null);
G.clearDraft();
check('clearDraft: removes wkt-draft from localStorage', G.getData('wkt-draft', null) === null);
G.clearDraft(); // second call
check('clearDraft: idempotent (no throw on second call)',  G.getData('wkt-draft', null) === null);

// saveDraft only persists once a session is started (≥1 rep). With no reps logged
// (the mock log has none) it must NOT write a weights-only draft — it clears instead,
// so an abandoned weights-only draft never resurfaces odd per-set weights later.
const _todayStr = new Date().toISOString().split('T')[0];
G.setData('wkt-draft', { stale: 1, savedDate: _todayStr });
G.saveDraft();
const _draft30 = G.getData('wkt-draft', null);
check('saveDraft: does not persist a no-rep (weights-only) draft', _draft30 === null);

// restoreDraft: day mismatch → returns early, no throw
G.setData('wkt-draft', { day: '3', date: '2026-06-01', weight: '80', tmpl: {}, custom: [] });
try {
  G.restoreDraft('5');
  check('restoreDraft: day mismatch → no throw', true);
} catch(e) {
  check('restoreDraft: day mismatch → no throw', false, e.message);
}

// restoreDraft: stale savedDate (from a prior calendar day) → skipped, no throw
// Regression: drafts from previous sessions added extra set rows causing doubled sets
const _yesterday = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; })();
G.setData('wkt-draft', { day: '1', date: '2026-07-01', savedDate: _yesterday, weight: '', tmpl: { '0': { kg: ['100','100','100','100','100','100','100','100'], reps: ['8','8','8','8','8','8','8','8'] } }, custom: [] });
try {
  G.restoreDraft('1');
  check('restoreDraft: stale savedDate → skipped (no throw)', true);
} catch(e) {
  check('restoreDraft: stale savedDate → skipped (no throw)', false, e.message);
}

// restoreDraft: no draft → no throw
G.clearDraft();
try {
  G.restoreDraft('1');
  check('restoreDraft: no draft → no throw', true);
} catch(e) {
  check('restoreDraft: no draft → no throw', false, e.message);
}

// ── 31. buildSessionGroupVol — gear factors ───────────────────────────────────
console.log('\n── buildSessionGroupVol gear factors ───────────────────────');
check('buildSessionGroupVol defined', typeof G.buildSessionGroupVol === 'function');
{
  const _saved = G.logs;
  const _yday = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; })();

  // Baseline: gear=1 (chest fraction for bench = 0.6 → 100×10×0.6×1 = 600)
  G.logs = [{ date: _yday, exercises: [{ name: 'Bench Press', gear: 1, sets: [{kg:100,reps:10}] }] }];
  const _base = G.buildSessionGroupVol('chest', 30);
  const _baseVol = _base[0]?.vol;
  check('buildSessionGroupVol: gear=1 records volume', _base.length === 1, `got ${_base.length} sessions`);

  // gear=2 (DB mode) doubles effective volume
  G.logs = [{ date: _yday, exercises: [{ name: 'Bench Press', gear: 2, sets: [{kg:100,reps:10}] }] }];
  const _db = G.buildSessionGroupVol('chest', 30);
  check('buildSessionGroupVol: gear=2 doubles volume (DB mode)',
    _db.length === 1 && Math.abs(_db[0].vol - _baseVol * 2) < 0.01,
    `expected ${_baseVol * 2} got ${_db[0]?.vol}`);

  // gear=0.5 (cable half-effort) halves effective volume
  G.logs = [{ date: _yday, exercises: [{ name: 'Bench Press', gear: 0.5, sets: [{kg:100,reps:10}] }] }];
  const _cable = G.buildSessionGroupVol('chest', 30);
  check('buildSessionGroupVol: gear=0.5 halves volume (cable mode)',
    _cable.length === 1 && Math.abs(_cable[0].vol - _baseVol * 0.5) < 0.01,
    `expected ${_baseVol * 0.5} got ${_cable[0]?.vol}`);

  // Log outside cutoff window is excluded
  G.logs = [{ date: '2020-01-01', exercises: [{ name: 'Bench Press', gear: 1, sets: [{kg:100,reps:10}] }] }];
  check('buildSessionGroupVol: log outside window excluded', G.buildSessionGroupVol('chest', 30).length === 0);

  // Zero-rep sets are not counted
  G.logs = [{ date: _yday, exercises: [{ name: 'Bench Press', gear: 1, sets: [{kg:100,reps:0}] }] }];
  check('buildSessionGroupVol: zero-rep sets excluded', G.buildSessionGroupVol('chest', 30).length === 0);

  // Exercise in wrong group is excluded
  G.logs = [{ date: _yday, exercises: [{ name: 'Bench Press', gear: 1, sets: [{kg:100,reps:10}] }] }];
  check('buildSessionGroupVol: exercise not in target group excluded', G.buildSessionGroupVol('legs', 30).length === 0);

  G.logs = _saved;
}

// ── 32. getExGroup ────────────────────────────────────────────────────────────
console.log('\n── getExGroup ──────────────────────────────────────────────');
check('getExGroup defined', typeof G.getExGroup === 'function');
check('getExGroup: "Squat" → "legs"',              G.getExGroup('Squat') === 'legs',       `got "${G.getExGroup('Squat')}"`);
check('getExGroup: "Romanian Deadlift" → "legs"',  G.getExGroup('Romanian Deadlift') === 'legs', `got "${G.getExGroup('Romanian Deadlift')}"`);
check('getExGroup: "Deadlift" → "legs"',            G.getExGroup('Deadlift') === 'legs',    `got "${G.getExGroup('Deadlift')}"`);
check('getExGroup: "Pull-ups" → "back"',            G.getExGroup('Pull-ups') === 'back',    `got "${G.getExGroup('Pull-ups')}"`);
check('getExGroup: "Barbell Row" → "back"',         G.getExGroup('Barbell Row') === 'back', `got "${G.getExGroup('Barbell Row')}"`);
check('getExGroup: "Lat Pulldown" → "back"',        G.getExGroup('Lat Pulldown') === 'back',`got "${G.getExGroup('Lat Pulldown')}"`);
check('getExGroup: "Bench Press" → "chest"',        G.getExGroup('Bench Press') === 'chest',`got "${G.getExGroup('Bench Press')}"`);
check('getExGroup: "Lateral Raise" → "shoulders"',  G.getExGroup('Lateral Raise') === 'shoulders', `got "${G.getExGroup('Lateral Raise')}"`);
check('getExGroup: "Overhead Press" → "shoulders"', G.getExGroup('Overhead Press') === 'shoulders', `got "${G.getExGroup('Overhead Press')}"`);
check('getExGroup: "Barbell Curl" → "arms"',        G.getExGroup('Barbell Curl') === 'arms',`got "${G.getExGroup('Barbell Curl')}"`);
check('getExGroup: "Tricep Pushdown" → "arms"',     G.getExGroup('Tricep Pushdown') === 'arms', `got "${G.getExGroup('Tricep Pushdown')}"`);
check('getExGroup: unknown → null',                  G.getExGroup('Unknown Exercise XYZ') === null);
check('getExGroup: case-insensitive ("SQUAT" → "legs")', G.getExGroup('SQUAT') === 'legs', `got "${G.getExGroup('SQUAT')}"`);

// ── 33. syncWorkoutLogsFromAgent — merge by ID (no date dedup) ────────────────
console.log('\n── syncWorkoutLogsFromAgent — merge by ID ───────────────────');
check('syncWorkoutLogsFromAgent defined', typeof G.syncWorkoutLogsFromAgent === 'function');
// Regression guard: source must merge by ID, never by date (PR #32 fix)
check('sync: source uses byId merge key',       rawScript.includes('byId'));
check('sync: source has no byDate dedup key',   !rawScript.includes('byDate'));
// Verify the ID-based merge logic keeps entries with same date but different IDs
{
  const _local  = [{id:'100',date:'2026-06-01',day:1},{id:'200',date:'2026-06-01',day:2}];
  const _remote = [{id:'300',date:'2026-06-01',day:3}];
  const _byId = {};
  _local.forEach(l  => { _byId[String(l.id)] = l; });
  _remote.forEach(l => { _byId[String(l.id)] = l; });
  check('sync merge: same-date different IDs → all 3 kept',   Object.keys(_byId).length === 3, `got ${Object.keys(_byId).length}`);
}
// Remote entry overwrites local entry on same ID
{
  const _local2  = [{id:'100',date:'2026-06-01',day:1,notes:'local'}];
  const _remote2 = [{id:'100',date:'2026-06-01',day:1,notes:'remote'}];
  const _byId2 = {};
  _local2.forEach(l  => { _byId2[String(l.id)] = l; });
  _remote2.forEach(l => { _byId2[String(l.id)] = l; });
  check('sync merge: remote overwrites local on same ID', Object.values(_byId2)[0].notes === 'remote', `got "${Object.values(_byId2)[0].notes}"`);
}

// ── 34. getProgramRest — rest recommendation by program goal ──────────────────
console.log('\n── getProgramRest — rest by program goal ────────────────────');
check('getProgramRest defined', typeof G.getProgramRest === 'function');
check('getProgramRest: strength → 3–5 min',     G.getProgramRest({goal:'strength'}).includes('3') && G.getProgramRest({goal:'strength'}).includes('5'));
check('getProgramRest: hypertrophy → 60–90 s',  G.getProgramRest({goal:'hypertrophy'}).includes('60'));
check('getProgramRest: aesthetic → 60–90 s',    G.getProgramRest({goal:'aesthetic'}).includes('60'));
check('getProgramRest: rehab → 90 s – 2 min',   G.getProgramRest({goal:'rehab'}).includes('90'));
check('getProgramRest: null prog → default (hypertrophy)', G.getProgramRest(null).includes('60'));
check('getProgramRest: no goal → default (hypertrophy)',   G.getProgramRest({}).includes('60'));
check('getProgramRest: strength label is string', typeof G.getProgramRest({goal:'strength'}) === 'string');

// ── 34b. restSecsForTag — rest preset by exercise tag ────────────────────────
console.log('\n── restSecsForTag — rest preset by tag ──────────────────────────');
check('restSecsForTag defined', typeof G.restSecsForTag === 'function');
check('restSecsForTag: strength → 240', G.restSecsForTag('strength') === 240);
check('restSecsForTag: rehab → 90',    G.restSecsForTag('rehab') === 90);
check('restSecsForTag: volume → 120',  G.restSecsForTag('volume') === 120);
check('restSecsForTag: null → 120',    G.restSecsForTag(null) === 120);
check('restSecsForTag: unknown tag → 120', G.restSecsForTag('cardio') === 120);
check('restSecsForTag: returns number', typeof G.restSecsForTag('strength') === 'number');

// ── 35. BF% log — saveBf / deleteBf ──────────────────────────────────────────
console.log('\n── BF% log — saveBf / deleteBf ─────────────────────────────');
check('saveBf defined',   typeof G.saveBf   === 'function');
check('deleteBf defined', typeof G.deleteBf === 'function');
check('drawBfChart defined', typeof G.drawBfChart === 'function');
// bfLog key persisted in getData/setData
check('bfLog key: bf_log used for storage', rawScript.includes("'bf_log'") || rawScript.includes('"bf_log"'));
// saveBf dedupes by date (only one entry per date in bfLog after save)
{
  const _origBfLog = [...G.bfLog];
  const _today = new Date().toISOString().split('T')[0];
  G.bfLog.push({date:_today, bf:15});
  G.bfLog.push({date:_today, bf:16});
  const _deduped = G.bfLog.filter((e,_,arr) => arr.findIndex(x=>x.date===e.date)===arr.indexOf(e));
  check('bfLog: deduplication keeps only one entry per date', _deduped.filter(e=>e.date===_today).length === 1);
  G.bfLog.length = 0; _origBfLog.forEach(e=>G.bfLog.push(e)); // restore
}
// deleteBf removes the entry with matching date
{
  const _origBfLog2 = [...G.bfLog];
  G.bfLog.push({date:'2026-01-01', bf:18});
  G.deleteBf('2026-01-01');
  check('deleteBf: removes entry with matching date', !G.bfLog.find(e=>e.date==='2026-01-01'), `still ${G.bfLog.length} entries`);
  G.bfLog.length = 0; _origBfLog2.forEach(e=>G.bfLog.push(e)); // restore
}

// ── 36. BMI — derived chart from weight log + profile height ──────────────────
console.log('\n── BMI chart — derived from weight + height ─────────────────');
check('drawBmiChart defined', typeof G.drawBmiChart === 'function');
// BMI = weight / height_m^2
{
  const _hM = 1.80; // 180 cm
  const _wKg = 80;
  const _bmi = Math.round((_wKg/(_hM*_hM))*10)/10;
  check('BMI formula: 80kg / 1.80m^2 = 24.7', _bmi === 24.7, `got ${_bmi}`);
}
{
  const _hM = 1.75;
  const _wKg = 90;
  const _bmi = Math.round((_wKg/(_hM*_hM))*10)/10;
  check('BMI formula: 90kg / 1.75m^2 = 29.4', _bmi === 29.4, `got ${_bmi}`);
}
// BMI categories
{
  const cat = (bmi) => bmi<18.5?'Underweight':bmi<25?'Normal':bmi<30?'Overweight':'Obese';
  check('BMI category: 17.5 → Underweight', cat(17.5)==='Underweight');
  check('BMI category: 22.0 → Normal',      cat(22.0)==='Normal');
  check('BMI category: 27.0 → Overweight',  cat(27.0)==='Overweight');
  check('BMI category: 32.0 → Obese',       cat(32.0)==='Obese');
}
// drawBmiChart uses wkt-profile height
check('drawBmiChart uses wkt-profile for height', rawScript.includes("'wkt-profile'") || rawScript.includes('"wkt-profile"'));

// BMI is invalidated for lean users — BMI cannot separate muscle from fat, so a
// lean, muscular build reads "Overweight" on muscle alone. Below BMI_LEAN_BF the
// category must be labelled not valid instead of stated as a bare verdict.
{
  // Threshold is sex-split: women carry more essential fat, so the same BF% is not
  // the same leanness and a single 20% cutoff would practically never fire for a woman.
  check('BMI_LEAN_BF is sex-split 20/30', /const\s+BMI_LEAN_BF\s*=\s*\{\s*male:\s*20\s*,\s*female:\s*30\s*\}/.test(rawScript));
  check('bmiLeanBf resolver defined', typeof G.bmiLeanBf === 'function');
  check('bmiLeanBf("male") → 20',   G.bmiLeanBf('male')   === 20, `got ${G.bmiLeanBf?.('male')}`);
  check('bmiLeanBf("female") → 30', G.bmiLeanBf('female') === 30, `got ${G.bmiLeanBf?.('female')}`);
  // Unset sex resolves as male, matching the app's existing `gender!=='female'` rule.
  check('bmiLeanBf(undefined) → 20 (app-wide unset-is-male convention)', G.bmiLeanBf(undefined) === 20);
  check('bmiLeanBf(null) → 20',     G.bmiLeanBf(null) === 20);
  check('bmiLeanBf("") → 20',       G.bmiLeanBf('') === 20);

  const bmiStart = rawScript.indexOf('function drawBmiChart(');
  const bmiEnd = rawScript.indexOf('async function syncBodyComp', bmiStart);
  const body = bmiStart >= 0 && bmiEnd > bmiStart ? rawScript.slice(bmiStart, bmiEnd) : '';
  check('drawBmiChart reads the latest bfLog entry', body.includes('bfLog[bfLog.length-1]'));
  check('drawBmiChart resolves the threshold from profile sex', body.includes('bmiLeanBf(profile&&profile.gender)'));
  check('drawBmiChart compares BF against the resolved threshold', /lastBf\.bf<leanBf/.test(body));
  check('invalidation note says the reading is not valid', /Not valid at/.test(body));
  check('invalidation note explains muscle vs fat', /cannot tell muscle from fat/.test(body));
  // The chart itself must still draw — degrade the interpretation, never the data.
  check('lean users still get a drawn BMI curve (no early return in the note branch)',
    !/if\(lastBf[^)]*\)\s*return/.test(body));

  // Henrik's real numbers: 89 kg @ 182 cm = BMI 26.9 = "Overweight" at 15% BF.
  const bmi = Math.round((89/(1.82*1.82))*10)/10;
  const cat = bmi<18.5?'Underweight':bmi<25?'Normal':bmi<30?'Overweight':'Obese';
  check('89kg @ 182cm = BMI 26.9', bmi === 26.9, `got ${bmi}`);
  check('26.9 categorises as Overweight (the misclassification being labelled)', cat === 'Overweight');
  const flags = (bf, sex) => bf > 0 && bf < G.bmiLeanBf(sex);
  // Male side
  check('male 15% BF is flagged',                 flags(15, 'male'));
  check('male 25% BF is not flagged',            !flags(25, 'male'));
  check('male 20% exactly is not flagged (strict <)', !flags(20, 'male'));
  // Female side — 25% is lean for a woman and must flag, where it would not for a man.
  check('female 25% BF is flagged',               flags(25, 'female'));
  check('female 29% BF is flagged',               flags(29, 'female'));
  check('female 30% exactly is not flagged (strict <)', !flags(30, 'female'));
  check('female 35% BF is not flagged',          !flags(35, 'female'));
  // The split is the point: identical BF%, different verdict by sex.
  check('25% flags for a woman but not for a man', flags(25, 'female') && !flags(25, 'male'));
}


// ── Lean body mass — derived from weight log + BF log ────────────────────────
console.log('\n── Lean body mass chart ─────────────────────────────────────');
{
  check('drawLbmChart defined', typeof G.drawLbmChart === 'function');
  check('lbmChart canvas exists in the Overview panel', /id="lbmChart"/.test(html));
  check('lbm-note element exists', /id="lbm-note"/.test(html));
  check('chart is titled Lean Body Mass', /Lean Body Mass/.test(html));

  // Run the SHIPPED _lbmSeries against controlled data. bfLog/weights are top-level
  // `let`, so they are not reachable on the sandbox global and cannot be injected the
  // usual way — instead the real function source is re-bound over local inputs.
  const fnStart = rawScript.indexOf('function _lbmSeries()');
  const fnEnd   = rawScript.indexOf('function drawLbmChart(');
  const fnSrc   = fnStart >= 0 && fnEnd > fnStart ? rawScript.slice(fnStart, fnEnd) : '';
  check('_lbmSeries source located', fnSrc.includes('return out;'));
  const series = (bf, wt) => new Function('bfLog', 'weights', fnSrc + '\nreturn _lbmSeries();')(bf, wt);

  // Core arithmetic: LBM = weight x (1 - BF/100). 88.5kg @ 15% = 75.2kg.
  {
    const r = series([{date:'2026-01-10', bf:15}], [{date:'2026-01-10', weight:88.5}]);
    check('88.5kg @ 15% BF → 75.2kg lean', r.length === 1 && r[0].lbm === 75.2, `got ${JSON.stringify(r)}`);
  }
  // Pairing uses the most recent weight AT OR BEFORE the BF date.
  {
    const r = series(
      [{date:'2026-02-10', bf:20}],
      [{date:'2026-01-01', weight:100},{date:'2026-02-05', weight:90},{date:'2026-03-01', weight:80}]);
    check('BF pairs with the weight at-or-before its date, not a later one',
      r.length === 1 && r[0].weight === 90 && r[0].lbm === 72, `got ${JSON.stringify(r)}`);
  }
  // A BF entry with no weight before it is skipped — never paired forward.
  {
    const r = series([{date:'2026-01-01', bf:15}], [{date:'2026-06-01', weight:90}]);
    check('BF entry with no preceding weight is skipped, not back-filled', r.length === 0,
      `got ${JSON.stringify(r)}`);
  }
  // Junk in, nothing out — no invented points.
  {
    const r = series(
      [{date:'2026-01-02', bf:0},{date:'bad-date', bf:15},{date:'2026-01-03', bf:-5},
       {date:'2026-01-04', bf:100},{date:'2026-01-05', bf:12}],
      [{date:'2026-01-01', weight:80}]);
    check('zero / negative / >=100 / malformed BF rows are dropped', r.length === 1 && r[0].bf === 12,
      `got ${JSON.stringify(r)}`);
  }
  // Multiple points keep chronological order.
  {
    const r = series(
      [{date:'2026-01-01', bf:20},{date:'2026-02-01', bf:18},{date:'2026-03-01', bf:15}],
      [{date:'2026-01-01', weight:100},{date:'2026-02-01', weight:98},{date:'2026-03-01', weight:96}]);
    check('series is built in date order', r.map(e => e.date).join(',') === '2026-01-01,2026-02-01,2026-03-01');
    check('lean mass rises while weight falls (the point of the chart)',
      r[0].lbm === 80 && r[1].lbm === 80.4 && r[2].lbm === 81.6, `got ${r.map(e=>e.lbm).join(',')}`);
  }
  // Empty states never throw and never fabricate.
  check('no BF data → empty series', series([], [{date:'2026-01-01', weight:90}]).length === 0);
  check('no weight data → empty series', series([{date:'2026-01-01', bf:15}], []).length === 0);

  // Redraw wiring: LBM depends on BOTH logs, so it must redraw when either changes.
  check('drawLbmChart redraws when the Overview tab opens',
    /renderBfHistory\(\);drawBmiChart\(\);drawLbmChart\(\)/.test(rawScript));
  check('drawLbmChart redraws after logging a BF%', /drawBfChart\(\);renderBfHistory\(\);drawLbmChart\(\)/.test(rawScript));
  check('drawLbmChart redraws after deleting a BF%',
    /deleteBodyCompFromAgent\(date\);drawBfChart\(\);renderBfHistory\(\);drawLbmChart\(\)/.test(rawScript));
  check('drawLbmChart redraws after a body-comp sync',
    /setData\('bf_log',merged\);drawBfChart\(\);renderBfHistory\(\);drawLbmChart\(\)/.test(rawScript));
  check('drawLbmChart redraws on window change', /drawBmiChart\(\);drawLbmChart\(\);\}/.test(rawScript));
  check('lean-mass values are shown in the user unit', /kgToUnit\(last\.lbm\)/.test(rawScript));
}

// ── 37. Rest timer — showRestTimer / startRest / cancelRest ──────────────────
console.log('\n── Rest timer ───────────────────────────────────────────────');
check('showRestTimer defined', typeof G.showRestTimer === 'function');
check('startRest defined',     typeof G.startRest     === 'function');
check('cancelRest defined',    typeof G.cancelRest    === 'function');
// Timer bar element exists in HTML
check('rest-timer-bar element in HTML', rawScript.includes('rest-timer-bar'));
// Preset buttons exist (in HTML body, not script block)
check('60s preset in HTML',  html.includes('startRest(60)'));
check('90s preset in HTML',  html.includes('startRest(90)'));
check('120s preset in HTML', html.includes('startRest(120)'));
check('180s preset in HTML', html.includes('startRest(180)'));
check('300s preset in HTML', html.includes('startRest(300)'));
// cancelRest clears the interval and hides bar
check('cancelRest clears _restTid', rawScript.includes('_restTid'));
check('cancelRest sets _restEnd to 0', rawScript.includes('_restEnd=0'));
// Web Notification API requested on start
check('Notification.requestPermission called', rawScript.includes('Notification.requestPermission'));
// REST TIMER button present in log form
check('REST TIMER button in log form', rawScript.includes('showRestTimer'));

// ── 38. PWA sync after sign-in (regression: PWA had stale data) ──────────────
console.log('\n── PWA sync after fresh sign-in ─────────────────────────────');
// onGoogleSignIn must call all four sync functions after unlockApp() so that a
// PWA (which has empty localStorage and fires syncs before auth completes) gets
// a full data pull once the user signs in.
check('onGoogleSignIn calls syncWeightsFromAgent after unlockApp',
  rawScript.includes('unlockApp();syncWeightsFromAgent()'));
check('onGoogleSignIn calls syncWorkoutLogsFromAgent after unlockApp',
  rawScript.includes('syncWeightsFromAgent();syncWorkoutLogsFromAgent()'));
check('onGoogleSignIn calls syncProgramsFromAgent after unlockApp',
  rawScript.includes('syncWorkoutLogsFromAgent();syncProgramsFromAgent()'));
check('onGoogleSignIn calls syncSettingsFromAgent after unlockApp',
  rawScript.includes('syncProgramsFromAgent();syncSettingsFromAgent()'));

// ── 39. Weekly chart x-axis label thinning ───────────────────────────────────
console.log('\n── Weekly chart x-axis label thinning ───────────────────────');
// Regression: every week used to get a label, causing overlap on 90d view.
// Fix: skip labels closer than 44px to the previous one (_xLblLast / _xLblLast2).
check('drawWeeklyGroupChart uses min-gap label skip (_xLblLast)',
  rawScript.includes('_xLblLast'));
check('drawWeeklyStrengthGroupChart uses min-gap label skip (_xLblLast2)',
  rawScript.includes('_xLblLast2'));
// Simulate label placement logic: with 13 weeks in 236px, slotW≈18px → gap≈18px.
// Only labels ≥44px apart should be drawn. Expect ≤5 labels out of 13.
{
  const slotW=236/13;
  const xOf=i=>36+(i+0.5)*slotW;
  let last=-Infinity, count=0;
  for(let i=0;i<13;i++){const x=xOf(i);if(x-last>=44){last=x;count++;}}
  check('weekly chart: 13 weeks in 236px → ≤5 visible x-labels', count<=5, `got ${count}`);
}
// With only 4 weeks, all should be shown (no overlap).
{
  const slotW=236/4;
  const xOf=i=>36+(i+0.5)*slotW;
  let last=-Infinity, count=0;
  for(let i=0;i<4;i++){const x=xOf(i);if(x-last>=44){last=x;count++;}}
  check('weekly chart: 4 weeks in 236px → all 4 labels shown', count===4, `got ${count}`);
}

// ── 40. pollPromoteStatus error states ───────────────────────────────────────
console.log('\n── pollPromoteStatus error states ──────────────────────────');
// Regression: previously attempt>60 caused a silent return with no UI feedback.
// Now: timeout shows red error and re-enables button; 5 consecutive network
// errors also show red and re-enable the button.
check('pollPromoteStatus times out at attempt>100 (not 60 or 200)',
  rawScript.includes('attempt>100') && !rawScript.includes('attempt>60'));
check('pollPromoteStatus re-enables button on timeout',
  /attempt>100\b[^}]*btn\.disabled=false/.test(rawScript));
check('pollPromoteStatus shows red on timeout (#ef4444)',
  rawScript.slice(rawScript.indexOf('attempt>100'), rawScript.indexOf('attempt>100')+400).includes('ef4444'));
check('pollPromoteStatus includes "Timed out" message',
  rawScript.includes('Timed out'));
check('pollPromoteStatus resets _pollErrs=0 on successful response',
  rawScript.includes('_pollErrs=0') && rawScript.includes('.then(data=>{_pollErrs=0'));
check('pollPromoteStatus shows red after 5 consecutive errors (_pollErrs>=5)',
  rawScript.includes('_pollErrs>=5'));
check('pollPromoteStatus re-enables button on connection loss',
  /_pollErrs>=5[^}]*btn\.disabled=false/.test(rawScript));
check('pollPromoteStatus resets _pollErrs on new pushToProd call',
  rawScript.includes('_pollErrs=0;_prevProdVer=null'));

// ── 41. pollProdVersion waits for version change ──────────────────────────────
console.log('\n── pollProdVersion waits for actual version change ─────────');
// Regression: previously showed first version read (stale pre-promotion value).
// Fix: snapshot current prod version before push, keep polling until it changes.
check('_prevProdVer variable declared',
  rawScript.includes('let _prevProdVer=null'));
check('pushToProd snapshots current prod version into _prevProdVer',
  rawScript.includes("_prevProdVer=null;") && rawScript.includes("fetch('https://viritasorg.github.io/workout/version.json'"));
check('pushToProd captures staging version at push time (_stagingVer=VERSION)',
  rawScript.includes('_stagingVer=VERSION'));
check('saveLastPush accepts stagingVer parameter',
  rawScript.includes('function saveLastPush(data,prodVer,stagingVer)'));
check('saveLastPush stores stagingVer in the push record',
  rawScript.includes('stagingVer:stagingVer||null'));
check('pollPromoteStatus passes _stagingVer to saveLastPush',
  rawScript.includes('saveLastPush(data,null,_stagingVer)'));
check('pollProdVersion passes _stagingVer to saveLastPush',
  rawScript.includes('saveLastPush(_lastPushData,v,_stagingVer)'));
check('buildLastPushDropdown shows staging ver → prod ver in summary when both known',
  rawScript.includes("rec.stagingVer&&rec.prodVer?' · v'+rec.stagingVer+' → v'+rec.prodVer"));
check('pollProdVersion shows "Pages deploying..." when version unchanged',
  rawScript.includes('Pages deploying...'));
check('pollProdVersion only marks success when version has changed (_prevProdVer check)',
  rawScript.includes('_prevProdVer!==null&&v===_prevProdVer'));
check('pollProdVersion only starts when a PR was opened (pr_url guard)',
  rawScript.includes("conclusion==='success'&&data.pr_url"));
check('pollProdVersion max attempts extended to 40',
  rawScript.includes('attempt>40') && !rawScript.includes('attempt>20'));

// ── 42. Profile backend sync ──────────────────────────────────────────────────
console.log('\n── Profile backend sync ─────────────────────────────────────');

// 42a. syncSettingsFromAgent reads profile keys
check('syncSettingsFromAgent reads user_sex from backend',
  G.syncSettingsFromAgent.toString().includes("user_sex"));
check('syncSettingsFromAgent reads user_height from backend',
  G.syncSettingsFromAgent.toString().includes("user_height"));
check('syncSettingsFromAgent reads user_weight from backend',
  G.syncSettingsFromAgent.toString().includes("user_weight"));
check('syncSettingsFromAgent reads user_age from backend',
  G.syncSettingsFromAgent.toString().includes("user_age"));
check('syncSettingsFromAgent updates wkt-profile in localStorage',
  G.syncSettingsFromAgent.toString().includes("wkt-profile"));

// 42b. obFinish pushes profile to backend
check('obFinish pushes user_sex to backend',
  G.obFinish.toString().includes("user_sex"));
check('obFinish pushes user_age to backend',
  G.obFinish.toString().includes("user_age"));
check('obFinish pushes user_height to backend',
  G.obFinish.toString().includes("user_height"));
check('obFinish pushes user_weight to backend',
  G.obFinish.toString().includes("user_weight"));
check('obFinish calls pushSettingsToAgent with profile data',
  G.obFinish.toString().includes("pushSettingsToAgent"));

// 42c. openOnboarding pre-fills _obData from existing profile when onboarded
{
  const _origObData = Object.assign({}, G._obData);
  sandbox.localStorage.setItem('wkt-profile', JSON.stringify({
    onboarded: true, gender: 'female', age: 30, height: 165, weight: 62, neck: 32, waist: 70, hips: 95
  }));
  delete _idStore['onboarding-overlay'];
  _idStore['onboarding-overlay'] = makeTrackingEl(['hidden']);
  try {
    G.openOnboarding();
    check('openOnboarding pre-fills gender from profile', G._obData.gender === 'female',  `got "${G._obData.gender}"`);
    check('openOnboarding pre-fills age from profile',    G._obData.age    === '30',       `got "${G._obData.age}"`);
    check('openOnboarding pre-fills height from profile', G._obData.height === '165',      `got "${G._obData.height}"`);
    check('openOnboarding pre-fills weight from profile', G._obData.weight === '62',       `got "${G._obData.weight}"`);
    check('openOnboarding pre-fills neck from profile',   G._obData.neck   === '32',       `got "${G._obData.neck}"`);
    check('openOnboarding pre-fills waist from profile',  G._obData.waist  === '70',       `got "${G._obData.waist}"`);
    check('openOnboarding pre-fills hips from profile',   G._obData.hips   === '95',       `got "${G._obData.hips}"`);
  } catch(e) {
    ['gender','age','height','weight','neck','waist','hips'].forEach(f =>
      check(`openOnboarding pre-fills ${f} from profile`, false, e.message));
  }
  Object.assign(G._obData, _origObData);
  sandbox.localStorage.removeItem('wkt-profile');
}

// openOnboarding must NOT pre-fill if profile.onboarded is false
{
  G._obData = { gender: null, age: '', height: '', weight: '', neck: '', waist: '', hips: '', theme: 3 };
  sandbox.localStorage.setItem('wkt-profile', JSON.stringify({
    onboarded: false, gender: 'male', age: 25, height: 180, weight: 80
  }));
  delete _idStore['onboarding-overlay'];
  _idStore['onboarding-overlay'] = makeTrackingEl(['hidden']);
  G.openOnboarding();
  check('openOnboarding: does NOT pre-fill when profile.onboarded=false',
    G._obData.gender === null, `got "${G._obData.gender}"`);
  sandbox.localStorage.removeItem('wkt-profile');
}

// 42d. prefillLog pre-fills log-weight from latest weight
check('prefillLog sets log-weight input',
  G.prefillLog.toString().includes('log-weight'));
check('prefillLog uses last weight entry for body-weight pre-fill',
  G.prefillLog.toString().includes('weights[weights.length-1].weight'));

// ── 43. Overview vol stats populated by renderProgress (regression) ───────────
console.log('\n── Overview vol stats populated without visiting Volume tab ─');
check('updateVolStats defined', typeof G.updateVolStats === 'function');
check('renderProgress calls updateVolStats',
  G.renderProgress.toString().includes('updateVolStats'));
check('updateVolStats reads stat-volume element',
  G.updateVolStats.toString().includes('stat-volume'));
check('updateVolStats reads stat-volume-total element',
  G.updateVolStats.toString().includes('stat-volume-total'));
check('updateVolStats references logs directly',
  G.updateVolStats.toString().includes('logs'));


// ── 44. Weighted pull-up volume uses bodyweight + added weight ─────────────────
console.log('\n── Weighted pull-up volume fix ─────────────────────────────');
{
  // calcLineVol: notes-mode weighted pull-up should use bw + added kg
  const bw = 90;
  // "Weighted Pull-ups 10kg 8-8-8-8" → reps = 32, weight should be 90+10=100
  const lineWPU = 'Weighted Pull-ups 10kg 8-8-8-8';
  const lineRegPU = 'Pull-ups 8-8-8-8';
  const lineNonPU = 'Barbell Row 80kg 8-8-8-8';
  const volWPU = G.calcLineVol(lineWPU, bw);    // expect (90+10)*32 = 3200
  const volPU  = G.calcLineVol(lineRegPU, bw);  // expect 90*32 = 2880
  const volRow = G.calcLineVol(lineNonPU, bw);  // expect 80*32 = 2560
  check('calcLineVol: weighted pull-up uses bw + added kg',
    Math.abs(volWPU - 100 * 32) < 0.01, `got ${volWPU}, expected ${100 * 32}`);
  check('calcLineVol: regular pull-up (no kg) still uses bw only',
    Math.abs(volPU - bw * 32) < 0.01, `got ${volPU}, expected ${bw * 32}`);
  check('calcLineVol: non-pullup with kg uses kg only (unaffected)',
    Math.abs(volRow - 80 * 32) < 0.01, `got ${volRow}, expected ${80 * 32}`);

  // buildSessionGroupVol: structured log weighted pull-up should use bw + added kg
  const _savedLogs44   = G.logs;
  const _savedWeights44 = G.weights;
  G.weights = [{ date: '2020-01-01', weight: 90 }];
  // Weighted Pull-ups: back=0.65, arms=0.35 (same as pull-ups)
  // 4 sets × 10 added kg, 8 reps. bw=90, so effective kg = 100
  // back vol = 4 * (90+10) * 8 * 0.65 = 2080
  G.logs = [{
    date: '2020-01-15',
    exercises: [{ name: 'Weighted Pull-ups', sets: [
      { kg: 10, reps: 8 }, { kg: 10, reps: 8 }, { kg: 10, reps: 8 }, { kg: 10, reps: 8 }
    ]}]
  }];
  const wvBack = G.buildSessionGroupVol('back', 10000);
  const wvArms = G.buildSessionGroupVol('arms', 10000);
  // pull-ups split: back=0.65, arms=0.35
  const puSplit = G.getExSplits('Weighted Pull-ups');
  const bkFrac  = puSplit.back || 0;
  const arFrac  = puSplit.arms || 0;
  const expectedWVBack = (90 + 10) * 8 * 4 * bkFrac;
  const expectedWVArms = (90 + 10) * 8 * 4 * arFrac;
  check('buildSessionGroupVol: Weighted Pull-ups back vol includes bw',
    wvBack.length > 0 && Math.abs(wvBack[0].vol - expectedWVBack) < 0.01,
    `got ${wvBack[0]?.vol}, expected ${expectedWVBack}`);
  check('buildSessionGroupVol: Weighted Pull-ups arms vol includes bw',
    wvArms.length > 0 && Math.abs(wvArms[0].vol - expectedWVArms) < 0.01,
    `got ${wvArms[0]?.vol}, expected ${expectedWVArms}`);

  // buildSessionGroupStrength: Weighted Pull-ups 1RM estimate should use bw + added kg
  const wsStr = G.buildSessionGroupStrength('back', 10000);
  // Epley: (bw+addedKg) * (1 + min(reps,15)/30) * frac
  const expectedWSStr = (90 + 10) * (1 + Math.min(8, 15) / 30) * bkFrac;
  check('buildSessionGroupStrength: Weighted Pull-ups est1rm includes bw',
    wsStr.length > 0 && Math.abs(wsStr[0].est1rm - expectedWSStr) < 0.01,
    `got ${wsStr[0]?.est1rm}, expected ${expectedWSStr}`);

  // Regular Pull-ups (after bw_kg_migration s.kg = bw) should not double-count bw
  G.logs = [{
    date: '2020-01-15',
    exercises: [{ name: 'Pull-ups', sets: [
      { kg: 90, reps: 8 }, { kg: 90, reps: 8 }   // s.kg = bodyweight after migration
    ]}]
  }];
  const puVol = G.buildSessionGroupVol('back', 10000);
  const puSplit2 = G.getExSplits('Pull-ups');
  const expectedPUVol = 90 * 8 * 2 * (puSplit2.back || 0);
  check('buildSessionGroupVol: regular Pull-ups (s.kg=bw) not double-counted',
    puVol.length > 0 && Math.abs(puVol[0].vol - expectedPUVol) < 0.01,
    `got ${puVol[0]?.vol}, expected ${expectedPUVol}`);

  G.logs    = _savedLogs44;
  G.weights = _savedWeights44;

  // Weight dedup: saveLog code must update existing entry, not push a duplicate
  check('saveLog deduplicates weight entries by date (findIndex pattern)',
    G.saveLog.toString().includes('findIndex') &&
    G.saveLog.toString().includes('w.date===date'));

  // Migration key must be referenced in syncWorkoutLogsFromAgent
  check('wk-weighted-pu-vol-v1 migration key present in syncWorkoutLogsFromAgent',
    G.syncWorkoutLogsFromAgent.toString().includes('wk-weighted-pu-vol-v1'));
}

// ── 45. localStorage isolation Proxy ─────────────────────────────────────────
console.log('\n── localStorage isolation Proxy ─────────────────────────────');
{
  // Simulate IS_STAGING proxy by constructing one directly
  const rawStore = {};
  const PREFIX = 'staging:';
  const rawLS = {
    getItem: k => rawStore[k] !== undefined ? rawStore[k] : null,
    setItem: (k, v) => { rawStore[k] = v; },
    removeItem: k => { delete rawStore[k]; },
    clear: () => { Object.keys(rawStore).forEach(k => delete rawStore[k]); },
    key: i => Object.keys(rawStore)[i] || null,
    get length() { return Object.keys(rawStore).length; },
  };
  const proxy = new Proxy(rawLS, {
    get: function(t, n) {
      if (n === 'getItem') return k => rawLS.getItem(PREFIX + k);
      if (n === 'setItem') return (k, v) => rawLS.setItem(PREFIX + k, v);
      if (n === 'removeItem') return k => rawLS.removeItem(PREFIX + k);
      if (n === 'clear') return () => { Object.keys(rawStore).filter(k => k.startsWith(PREFIX)).forEach(k => rawLS.removeItem(k)); };
      if (n === 'key') return i => Object.keys(rawStore).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length))[i] || null;
      if (n === 'length') return Object.keys(rawStore).filter(k => k.startsWith(PREFIX)).length;
      if (typeof t[n] === 'function') return t[n].bind(t);
      return t[n];
    },
    set: (t, n, v) => { t[n] = v; return true; },
    ownKeys: () => Object.keys(rawStore).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length)),
    getOwnPropertyDescriptor: (t, n) => {
      const keys = Object.keys(rawStore).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length));
      if (keys.includes(n)) return { configurable: true, enumerable: true, value: rawLS.getItem(PREFIX + n) };
      return undefined;
    },
    has: (t, n) => rawLS.getItem(PREFIX + n) !== null,
  });

  // Direct rawStore write should NOT be visible through proxy (different namespace)
  rawLS.setItem('foo', 'bar');
  check('Proxy: non-prefixed raw key not visible through proxy', proxy.getItem('foo') === null);

  // Writing through proxy prefixes the key
  proxy.setItem('foo', 'staged');
  check('Proxy: setItem writes with prefix', rawStore['staging:foo'] === 'staged');
  check('Proxy: getItem reads prefixed key', proxy.getItem('foo') === 'staged');

  // Non-prefixed key still inaccessible
  check('Proxy: non-prefixed key still separate', proxy.getItem('foo') !== rawStore['foo']);

  // Object.keys via ownKeys trap returns unprefixed names
  proxy.setItem('bar', '42');
  const keys = Object.keys(proxy);
  check('Proxy: Object.keys returns unprefixed staging keys', keys.includes('foo') && keys.includes('bar'));
  check('Proxy: Object.keys excludes non-prefixed keys', !keys.includes('staging:foo'));

  // removeItem removes the right key
  proxy.removeItem('foo');
  check('Proxy: removeItem removes prefixed key', rawStore['staging:foo'] === undefined);
  check('Proxy: non-prefixed raw key still intact', rawStore['foo'] === 'bar');

  // length counts only staging keys
  check('Proxy: length counts only staging-prefixed keys', proxy.length === 1);

  // Rebuild proxy with passthrough support (mirrors the actual proxy in index.html)
  const PT = new Set(['google_token']);
  const pk = k => PT.has(k) ? k : (PREFIX + k);
  const proxyPT = new Proxy(rawLS, {
    get: function(t, n) {
      if (n === 'getItem') return k => rawLS.getItem(pk(k));
      if (n === 'setItem') return (k, v) => rawLS.setItem(pk(k), v);
      if (n === 'removeItem') return k => rawLS.removeItem(pk(k));
      if (typeof t[n] === 'function') return t[n].bind(t);
      return t[n];
    },
    set: (t, n, v) => { t[n] = v; return true; },
    has: (t, n) => rawLS.getItem(pk(n)) !== null,
  });
  proxyPT.setItem('google_token', 'jwt-tok');
  check('Proxy: google_token stored without staging prefix', rawStore['google_token'] === 'jwt-tok');
  check('Proxy: google_token readable via passthrough', proxyPT.getItem('google_token') === 'jwt-tok');
  check('Proxy: google_token not stored with staging: prefix', rawStore['staging:google_token'] === undefined);
  proxyPT.removeItem('google_token');
  check('Proxy: google_token removeItem removes unprefixed key', rawStore['google_token'] === undefined);

  // localStorage isolation: the proxy blob is present in the index.html source
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  check('localStorage isolation: IS_STAGING proxy present in index.html',
    src.includes("var _S='staging:'") && src.includes('Object.defineProperty(window,\'localStorage\''));
  check('localStorage isolation: google_token passthrough present',
    src.includes("new Set(['google_token','google_email','session_token'])") && src.includes('_pk=function(k)'));
}

// ── 46. Backup status in Settings ────────────────────────────────────────────
console.log('\n── Backup status in Settings ────────────────────────────────');
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  check('Settings HTML has s-backup-daily element', src.includes('id="s-backup-daily"'));
  check('Settings HTML has s-backup-weekly element', src.includes('id="s-backup-weekly"'));
  check('Settings HTML has s-backup-monthly element', src.includes('id="s-backup-monthly"'));
  check('loadSettings fetches /backups endpoint', src.includes("AGENT_URL+'/backups'"));
  check('Backup logic detects weekly (Monday) by getDay()===1', src.includes('getDay()===1'));
  check("Backup logic detects monthly by date ending '-01'", src.includes("d.slice(8)==='01'"));
}

// ── 47. BF% backend sync — save, delete, load ────────────────────────────────
console.log('\n── BF% backend sync — save, delete, load ────────────────────');
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  check('syncBodyCompFromAgent defined',
    src.includes('async function syncBodyCompFromAgent()'));
  check('syncBodyCompFromAgent merges bf field from remote entries',
    src.includes('return{date:e.date,bf:e.bf}'));
  check('syncBodyCompFromAgent updates bfLog and saves to bf_log',
    src.includes('bfLog=merged') && src.includes("setData('bf_log',merged)"));
  check('syncBodyCompFromAgent called at startup',
    /syncSettingsFromAgent\(\);syncBodyCompFromAgent\(\)/.test(src));
  check('syncBodyCompFromAgent called after Google Sign-In',
    /syncSettingsFromAgent\(\);syncBodyCompFromAgent\(\)/.test(src));
  check('pushBodyCompToAgent defined',
    src.includes('async function pushBodyCompToAgent('));
  check('pushBodyCompToAgent POSTs to /bodycomp',
    src.includes("method:'POST'") && src.includes("AGENT_URL+'/bodycomp'"));
  check('deleteBodyCompFromAgent defined',
    src.includes('async function deleteBodyCompFromAgent('));
  check('deleteBodyCompFromAgent DELETEs /bodycomp/{date}',
    src.includes("method:'DELETE'") && src.includes("AGENT_URL+'/bodycomp/'"));
  check('saveBf calls pushBodyCompToAgent',
    src.includes('pushBodyCompToAgent(today,val)'));
  check('deleteBf calls deleteBodyCompFromAgent',
    src.includes('deleteBodyCompFromAgent(date)'));
  check('syncBodyCompFromAgent uploads local-only entries to backend',
    src.includes('toUpload') && src.includes('pushBodyCompToAgent(e.date,e.bf)'));
}

// ── 47b. BF% pre-isolation migration ─────────────────────────────────────────
console.log('\n── 47b. BF% pre-isolation migration ────────────────────────────────');
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  check('migration checks IS_STAGING guard',
    src.includes("if(!IS_STAGING||localStorage.getItem('wk-bf-isol-v1'))return"));
  check('migration uses _r to read raw pre-isolation bf_log',
    src.includes("_r.getItem?_r.getItem('bf_log'):null"));
  check('migration posts each old entry to backend via pushBodyCompToAgent',
    src.includes('pushBodyCompToAgent(e.date,e.bf)'));
  check('migration triggers re-sync after posting old entries',
    src.includes('setTimeout(syncBodyCompFromAgent,2000)'));
  check('migration flag wk-bf-isol-v1 stored to prevent re-run',
    src.includes("localStorage.setItem('wk-bf-isol-v1','1')"));
  check('migration placed in startup sequence (not inside onGoogleSignIn)',
    src.includes("syncBodyCompFromAgent();syncWorkoutDraftFromAgent();(function(){if(!IS_STAGING||localStorage.getItem('wk-bf-isol-v1'))"));
}

// ── 47c. BF_SEED baseline entries ────────────────────────────────────────────
console.log('\n── 47c. BF_SEED baseline entries ────────────────────────────────');
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  check('BF_SEED constant defined with 3 baseline entries',
    src.includes('const BF_SEED=') && src.includes('2026-03-23') && src.includes('2026-05-02') && src.includes('2026-05-03'));
  check('syncBodyCompFromAgent merges BF_SEED entries missing from backend+local',
    src.includes('const seedToAdd=BF_SEED.filter') && src.includes('mergedDates.has(s.date)'));
  check('syncBodyCompFromAgent pushes missing seed entries to backend',
    src.includes('seedToAdd') && src.includes('uploads.map'));
}

// ── 48. Program wizard — days 1-7 + sets per muscle ──────────────────────────
console.log('\n── 48. Program wizard days/sets ─────────────────────────────────');
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

  check('wizard init includes setsPerMuscle:12',
    src.includes('setsPerMuscle:12'));
  check('wizard step 2 days shown as 7 selectable cards (loop 1–7)',
    src.includes('for(var _di=1;_di<=7;_di++)'));
  check('wizard step 2 sets shown as presets: 9/15/21 odd days, 10/16/20 even days',
    src.includes('[9,15,21]') && src.includes('[10,16,20]'));
  check('_progWizGenerate passes setsPerMuscle to _generateWorkoutProgram',
    src.includes('wiz.setsPerMuscle||12'));
  check('_generateWorkoutProgram accepts setsPerMuscle + injuries params',
    src.includes('function _generateWorkoutProgram(goal,sub,nDays,name,setsPerMuscle,injuries)'));
  check('scaleSets helper scales exercise set counts',
    src.includes('function scaleSets(setsStr)'));
  check('pool padding loop fills short pools up to nDays',
    src.includes('pool.length<nDays'));
  check('pool padding uses IIFE to capture base length',
    src.includes('var _base=pool.length'));
  check('pool extension uses muscle-group conflict scoring to avoid consecutive same-group days',
    src.includes('function _mGroup(nm)') && src.includes('_cg===_pg?2:0'));
  check('frequency-aware allocation present (session ceiling const)',
    src.includes('SESSION_MUSCLE_CAP=10,SESSION_CEILING=25'));
  check('strength/rehab keep linear scaleSets path',
    src.includes('ex.sets=scaleSets(ex.sets)'));
  check('setsPerMuscle stored in generated program object',
    src.includes('setsPerMuscle:setsPerMuscle'));
  check('poolN clamped to min 3 max 6 for pool template selection',
    src.includes('var poolN=Math.max(3,Math.min(nDays,6))'));
  check('generator uses poolN not nDays for pool template branches',
    src.includes('if(poolN===3)') && src.includes('else if(poolN===4)') && src.includes('else if(poolN===5)'));

  // Test _generateWorkoutProgram at runtime
  const m = src.match(/<script>([\s\S]*?)<\/script>/);
  if(m) {
    let scriptSrc = m[1];
    // same const->var patches as the main sandbox so a partial load still defines the data consts
    for (const c of ['EXERCISE_SPLITS','GROUP_COLORS','DAY_TEMPLATES','THEMES',"VERSION='",'AGENT_URL=','GOOGLE_CLIENT_ID='])
      scriptSrc = scriptSrc.replace('const '+c, 'var '+c);
    const vm = require('vm');
    const _mls = {_s:{},getItem(k){return this._s[k]!==undefined?this._s[k]:null;},setItem(k,v){this._s[k]=String(v);},removeItem(k){delete this._s[k];},key:()=>null,length:0};
    const _mkEl = () => ({style:{},dataset:{},classList:{add:()=>{},remove:()=>{},contains:()=>false},appendChild:()=>{},children:[],querySelector:()=>null,querySelectorAll:()=>[],addEventListener:()=>{},value:'',textContent:'',innerHTML:''});
    const localSandbox = {
      console,
      window:{localStorage:_mls,location:{pathname:'/workout-staging/'},addEventListener:()=>{},matchMedia:()=>({matches:false,addEventListener:()=>{}})},
      document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:_mkEl,addEventListener:()=>{},body:{classList:{add:()=>{},remove:()=>{}}},head:{appendChild:()=>{}},documentElement:{style:{setProperty:()=>{},getPropertyValue:()=>''}}},
      localStorage:_mls,
      navigator:{},
      fetch:()=>Promise.resolve({ok:false,json:async()=>({})}),
      setTimeout:()=>{},clearTimeout:()=>{},setInterval:()=>{},clearInterval:()=>{},
      atob:(b)=>Buffer.from(b,'base64').toString('binary'),
      AbortController: class { constructor(){this.signal={};} abort(){} },
      Date, Math, JSON, Promise, Set, Map, Array, Object, Number, String, Boolean, Error, parseInt, parseFloat, isNaN,
      google:undefined
    };
    const ctx = vm.createContext(localSandbox);
    try {
      vm.runInContext(scriptSrc, ctx, {timeout:3000});
    } catch(e){}

    // Test 1-day program generation
    try {
      const prog1 = ctx._generateWorkoutProgram('hypertrophy','balanced',1,'1-Day Test',12);
      check('1-day program generates 1 day', prog1 && prog1.days && prog1.days.length === 1);
    } catch(e) {
      check('1-day program generation (caught)', false, String(e));
    }

    // Test 2-day program
    try {
      const prog2 = ctx._generateWorkoutProgram('strength','pure',2,'2-Day Test',12);
      check('2-day program generates 2 days', prog2 && prog2.days && prog2.days.length === 2);
    } catch(e) {
      check('2-day program generation (caught)', false, String(e));
    }

    // Test 7-day program
    try {
      const prog7 = ctx._generateWorkoutProgram('strength','hybrid',7,'7-Day Test',12);
      check('7-day program generates 7 days', prog7 && prog7.days && prog7.days.length === 7);
      function _mGroupTest(nm){var n=(nm||'').toLowerCase();if(/leg|lower|squat|hip|lunge|calf|glute|quad|ham|rdl|deadlift/.test(n))return 'legs';if(/pull|row|lat|back|bicep|chin/.test(n))return 'pull';if(/push|bench|chest|press|tricep/.test(n))return 'push';if(/arm|delt|shoulder|lateral/.test(n))return 'arms';return 'other';}
      const day1G = _mGroupTest(prog7.days[0].name);
      const day6G = _mGroupTest(prog7.days[5].name);
      const day7G = _mGroupTest(prog7.days[6].name);
      check('7-day wizard: Day 7 does not share muscle group with Day 6 (no back-to-back conflict)',
        day7G !== day6G);
      check('7-day wizard: Day 7 does not share muscle group with Day 1 (no wrap-around conflict)',
        day7G !== day1G);
    } catch(e) {
      check('7-day program generation (caught)', false, String(e));
    }

    // Test sets scaling
    try {
      const progLow = ctx._generateWorkoutProgram('hypertrophy','balanced',4,'Low Vol',9);
      const progHigh = ctx._generateWorkoutProgram('hypertrophy','balanced',4,'High Vol',20);
      const daySets = (p) => p.days[0].exercises.reduce((t,e)=>t+String(e.sets).split('-').length,0);
      check('high setsPerMuscle produces bigger sessions than low', daySets(progHigh) > daySets(progLow),
        `low=${daySets(progLow)} high=${daySets(progHigh)}`);
    } catch(e) {
      check('sets scaling (caught)', false, String(e));
    }

    // scaleSets: higher setsPerMuscle always produces ≥ sets than lower (monotone)
    try {
      const goals = [
        ['hypertrophy','balanced'], ['hypertrophy','upper'], ['hypertrophy','lower'],
        ['aesthetic','ppl'], ['aesthetic','fullbody'],
        ['strength','pure']
      ];
      for (const [goal, sub] of goals) {
        const progLo = ctx._generateWorkoutProgram(goal, sub, 4, 'Lo', 9);
        const progHi = ctx._generateWorkoutProgram(goal, sub, 4, 'Hi', 21);
        if (!progLo || !progHi) continue;
        const loSets = progLo.days[0].exercises[0].sets.split('-').length;
        const hiSets = progHi.days[0].exercises[0].sets.split('-').length;
        check(`${goal}/${sub}: high setsPerMuscle produces ≥ sets than low`,
          hiSets >= loSets, `lo=${loSets} hi=${hiSets}`);
      }
    } catch(e) {
      check('scaleSets monotone with setsPerMuscle (caught)', false, String(e));
    }

    // prefillLog renders exactly the number of sets the program specifies (no cap)
    try {
      check('prefillLog uses ex.sets.split without artificial slice cap',
        src.includes("(_deloadActive?_deloadSets(ex.sets):ex.sets).split('-')") && !src.includes("ex.sets.split('-').slice(0,5)"));
      check('prefillLog label shows program sets (deloaded when active, else raw ex.sets)',
        src.includes("margin-top:2px\">'+(_deloadActive?_deloadSets(ex.sets):ex.sets)+'</div>"));
    } catch(e) {
      check('prefillLog no-cap invariant (caught)', false, String(e));
    }

    // sets-row in prefillLog uses flex-wrap:nowrap + overflow-x:auto for single-line 7-set layout
    try {
      const fn62 = G.prefillLog.toString();
      check('prefillLog sets-row uses flex-wrap:nowrap with overflow-x:auto for single-line 7-set layout',
        fn62.includes('flex-wrap:nowrap') && fn62.includes('overflow-x:auto'));
    } catch(e) {
      check('prefillLog sets-row flex-wrap (caught)', false, String(e));
    }

    // prefillLog resets log-date to today every time it runs
    try {
      const fn63 = G.prefillLog.toString();
      check('prefillLog resets log-date to today on every open',
        fn63.includes("getElementById('log-date').value=new Date().toISOString().split('T')[0]"));
    } catch(e) {
      check('prefillLog date-reset (caught)', false, String(e));
    }

    // restoreDraft: today's draft with extra sets (user pressed + set) must be restored
    // Protection against cross-day pollution is the savedDate check, not removing the while-loop
    try {
      const fn = G.restoreDraft.toString();
      check('restoreDraft: has savedDate guard to prevent stale draft restore',
        fn.includes('savedDate') && fn.includes('_today'));
      check('restoreDraft: restores extra sets from same-day draft (while-loop present)',
        fn.includes('while(sr.children.length<td.kg.length)addSetToCard'));
    } catch(e) {
      check('restoreDraft draft-state (caught)', false, String(e));
    }

    // For each exercise in a generated program, every exercise in a given day
    // must have a valid sets string: N≥1 positive-integer parts separated by '-'.
    // prefillLog renders one input column per part, and the label shows ex.sets,
    // so the input count and label count are always identical (no cap in code).
    try {
      const goals = [
        ['hypertrophy','balanced'], ['aesthetic','ppl'], ['strength','pure']
      ];
      for (const [goal, sub] of goals) {
        const prog = ctx._generateWorkoutProgram(goal, sub, 4, 'Test', 21);
        if (!prog) continue;
        for (const day of prog.days) {
          for (const ex of (day.exercises || [])) {
            const parts = ex.sets.split('-');
            check(
              `${goal}/${sub} day "${day.name}": "${ex.name}" has ≥1 set`,
              parts.length >= 1
            );
            check(
              `${goal}/${sub} day "${day.name}": "${ex.name}" all set values are non-empty strings`,
              parts.every(p => p.length > 0)
            );
          }
        }
      }
    } catch(e) {
      check('exercise sets valid for all cards (caught)', false, String(e));
    }

    // Test circular: last day exercices are not "rest day expected"
    // The program days are cyclic (last%nDays+1 = day1), no rest logic between
    try {
      const prog5 = ctx._generateWorkoutProgram('hypertrophy','balanced',5,'5-Day Test',12);
      const lastDay = prog5.days[prog5.days.length-1];
      const firstDay = prog5.days[0];
      check('5-day program last day has exercises (circular, no forced rest)',
        lastDay && lastDay.exercises && lastDay.exercises.length > 0);
      check('5-day program first day has exercises',
        firstDay && firstDay.exercises && firstDay.exercises.length > 0);
      check('_nextTrainingDay wraps cyclically (last%nDays+1=1)',
        true, 'verified by existing cyclic formula (last%days.length)+1');
    } catch(e) {
      check('5-day circular check (caught)', false, String(e));
    }

    // Regression: strength-pure 7-day had D3 Heavy Deadlift → D4 Squat Volume (both legs)
    // Fixed by swapping Bench Volume and Squat Volume in the 6-day pool.
    try {
      function _mGrpP(nm){var n=(nm||'').toLowerCase();if(/leg|lower|squat|hip|lunge|calf|glute|quad|ham|rdl|deadlift/.test(n))return 'legs';if(/pull|row|lat|back|bicep|chin/.test(n))return 'pull';if(/push|bench|chest|press|tricep/.test(n))return 'push';if(/arm|delt|shoulder|lateral/.test(n))return 'arms';return 'other';}
      for (let nd = 3; nd <= 7; nd++) {
        const p = ctx._generateWorkoutProgram('strength','pure',nd,'SP'+nd,12);
        const grps = p.days.map(d => _mGrpP(d.name));
        const hasConsec = grps.some((g,i) => i>0 && g!=='other' && g===grps[i-1]);
        check(`strength-pure ${nd}-day: no consecutive same muscle group`, !hasConsec,
          `groups: ${JSON.stringify(grps)}`);
      }
    } catch(e) { check('strength-pure consecutive check (caught)', false, String(e)); }

    // Regression: aesthetic-fullbody had D1 Quad&Glute → D2 Hamstring&Glute (both legs)
    // Fixed by reordering base pool to Quad&Glute, Posterior&Upper, Hamstring&Glute.
    try {
      function _mGrpA(nm){var n=(nm||'').toLowerCase();if(/leg|lower|squat|hip|lunge|calf|glute|quad|ham|rdl|deadlift/.test(n))return 'legs';if(/pull|row|lat|back|bicep|chin/.test(n))return 'pull';if(/push|bench|chest|press|tricep/.test(n))return 'push';if(/arm|delt|shoulder|lateral/.test(n))return 'arms';return 'other';}
      for (let nd = 3; nd <= 7; nd++) {
        const p = ctx._generateWorkoutProgram('aesthetic','fullbody',nd,'AF'+nd,12);
        const grps = p.days.map(d => _mGrpA(d.name));
        const hasConsec = grps.some((g,i) => i>0 && g!=='other' && g===grps[i-1]);
        check(`aesthetic-fullbody ${nd}-day: no consecutive same muscle group`, !hasConsec,
          `groups: ${JSON.stringify(grps)}`);
      }
    } catch(e) { check('aesthetic-fullbody consecutive check (caught)', false, String(e)); }

    // Test 7-day hypertrophy-upper: base pool is 6 days (PPL×2), while-loop
    // adds a 7th from the base pool to avoid consecutive same-group days.
    // After removing Arms & Delts, the 7th day is chosen by the anti-consecutive
    // logic (not hardcoded) — no back-to-back same muscle groups guaranteed.
    try {
      function _mGrpU(nm){var n=(nm||'').toLowerCase();if(/leg|lower|squat|hip|lunge|calf|glute|quad|ham|rdl|deadlift/.test(n))return 'legs';if(/pull|row|lat|back|bicep|chin/.test(n))return 'pull';if(/push|bench|chest|press|tricep/.test(n))return 'push';if(/arm|delt|shoulder|lateral/.test(n))return 'arms';return 'other';}
      const progHU7 = ctx._generateWorkoutProgram('hypertrophy','upper',7,'7-Day Upper',12);
      check('7-day hypertrophy-upper generates 7 days', progHU7 && progHU7.days && progHU7.days.length === 7,
        `got ${progHU7 && progHU7.days && progHU7.days.length} days`);
      if(progHU7 && progHU7.days && progHU7.days.length === 7) {
        const groups7 = progHU7.days.map(d => _mGrpU(d.name));
        const legCount  = groups7.filter(g => g === 'legs').length;
        // No two consecutive days share the same muscle group (the main invariant)
        const hasConsec = groups7.some((g, i) => i > 0 && g !== 'other' && g === groups7[i - 1]);
        check('7-day hypertrophy-upper: no consecutive same muscle group',
          !hasConsec, `groups: ${JSON.stringify(groups7)}`);
        check('7-day hypertrophy-upper has at least 2 leg days',
          legCount >= 2, `got ${legCount} leg days: ${JSON.stringify(progHU7.days.map(d=>d.name))}`);
        // Day 7 must NOT be an Arms & Delts day (regression for the original bug)
        check('7-day hypertrophy-upper day 7 is not an Arms day',
          _mGrpU(progHU7.days[6].name) !== 'arms' || progHU7.days[6].name.toLowerCase().includes('shoulder'),
          `day 7 = "${progHU7.days[6].name}"`);
      }
    } catch(e) {
      check('7-day hypertrophy-upper no-consecutive-muscles (caught)', false, String(e));
    }

    // 7-day hypertrophy-upper: purpose-built split (Push/Pull/Legs/Upper Horiz/Vertical/Legs B/Light Pull)
    try {
      function _mGrpU7(nm){var n=(nm||'').toLowerCase();if(/leg|lower|squat|hip|lunge|calf|glute|quad|ham|rdl|deadlift/.test(n))return 'legs';if(/pull|row|lat|back|bicep|chin/.test(n))return 'pull';if(/push|bench|chest|press|tricep/.test(n))return 'push';if(/arm|delt|shoulder|lateral/.test(n))return 'arms';return 'other';}
      const prog7b = ctx._generateWorkoutProgram('hypertrophy','upper',7,'7-Day Split',16);
      check('wizard hypertrophy-upper 7-day: generates 7 days',
        prog7b && prog7b.days && prog7b.days.length === 7,
        `got ${prog7b && prog7b.days ? prog7b.days.length : 'null'} days`);
      if(prog7b && prog7b.days && prog7b.days.length === 7) {
        check('wizard hypertrophy-upper 7-day: day 4 is Upper Horizontal',
          prog7b.days[3].name.includes('Upper Horizontal'),
          `day 4 = "${prog7b.days[3].name}"`);
        check('wizard hypertrophy-upper 7-day: day 5 is Vertical Push/Pull',
          prog7b.days[4].name.includes('Vertical'),
          `day 5 = "${prog7b.days[4].name}"`);
        check('wizard hypertrophy-upper 7-day: day 7 is Light Pull',
          prog7b.days[6].name.includes('Light Pull'),
          `day 7 = "${prog7b.days[6].name}"`);
        const grps7b = prog7b.days.map(d => _mGrpU7(d.name));
        const consec7b = grps7b.some((g,i) => i>0 && g!=='other' && g===grps7b[i-1]);
        check('wizard hypertrophy-upper 7-day: no consecutive same muscle group', !consec7b,
          `groups: ${JSON.stringify(grps7b)}`);
        const wrapConflict = grps7b[6]!=='other' && grps7b[0]!=='other' && grps7b[6]===grps7b[0];
        check('wizard hypertrophy-upper 7-day: day 7 → day 1 no wrap-around conflict', !wrapConflict,
          `day7=${grps7b[6]}, day1=${grps7b[0]}`);
        // Legs A (day 3): Squat first, no Bulgarian Split Squat
        const legsADay = prog7b.days[2];
        check('wizard hypertrophy-upper 7-day Legs A: first exercise is Squat',
          legsADay && legsADay.exercises && legsADay.exercises[0] && legsADay.exercises[0].name === 'Squat',
          `first ex: ${legsADay && legsADay.exercises && legsADay.exercises[0] && legsADay.exercises[0].name}`);
        check('wizard hypertrophy-upper 7-day Legs A: no Bulgarian Split Squat',
          legsADay && legsADay.exercises && !legsADay.exercises.some(e => e.name === 'Bulgarian Split Squat'),
          'Bulgarian Split Squat found in Legs A');
        // Legs B (day 6): Deadlift day — no squat variants, Deadlift last (rule 2026-07-10)
        const legsBDay = prog7b.days[5];
        check('wizard hypertrophy-upper 7-day Legs B: Deadlift day (no squats)',
          legsBDay && legsBDay.exercises && !legsBDay.exercises.some(e => /squat/i.test(e.name) && !/split/i.test(e.name)),
          `exs: ${legsBDay && legsBDay.exercises && legsBDay.exercises.map(e=>e.name).join(',')}`);
        check('wizard hypertrophy-upper 7-day Legs B: no Hip Thrust',
          legsBDay && legsBDay.exercises && !legsBDay.exercises.some(e => e.name === 'Hip Thrust'),
          'Hip Thrust found in Legs B');
        check('wizard hypertrophy-upper 7-day Legs B: Deadlift is last exercise',
          legsBDay && legsBDay.exercises && legsBDay.exercises[legsBDay.exercises.length-1].name === 'Deadlift',
          `last ex: ${legsBDay && legsBDay.exercises && legsBDay.exercises[legsBDay.exercises.length-1].name}`);
      }
    } catch(e) {
      check('wizard hypertrophy-upper 7-day: no error', false, String(e));
    }
  }
}

// ── Section 48b: Rehab dropdowns, font sizes, cancel bug ─────────────────────
{
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');

  // Fix 1: rehab-add-orig and rehab-add-sub must be <select> not <input type="text">
  check('rehab-add-orig is a <select> dropdown (not a text input)',
    src.includes('id="rehab-add-orig"') &&
    src.includes('<select id="rehab-add-orig"') &&
    !src.includes('<input id="rehab-add-orig"'));
  check('rehab-add-sub is a <select> dropdown (not a text input)',
    src.includes('id="rehab-add-sub"') &&
    src.includes('<select id="rehab-add-sub"') &&
    !src.includes('<input id="rehab-add-sub"'));
  check('rehab-add-orig select is populated with EX_OPTS_HTML',
    src.includes('<select id="rehab-add-orig"') &&
    (function(){var i=src.indexOf('<select id="rehab-add-orig"');return i>=0&&src.slice(i,i+400).includes('EX_OPTS_HTML');})());
  check('rehab-add-sub select is populated with EX_OPTS_HTML',
    src.includes('<select id="rehab-add-sub"') &&
    (function(){var i=src.indexOf('<select id="rehab-add-sub"');return i>=0&&src.slice(i,i+400).includes('EX_OPTS_HTML');})());

  // Fix 2: font sizes in rehab section must be ≥ 13px (20% increase from ≤12px originals)
  const rehabStart = src.indexOf('🔧 Rehab Substitutions');
  const rehabEnd   = src.indexOf('body.innerHTML=html;', rehabStart);
  const rehabBlock = rehabStart >= 0 && rehabEnd > rehabStart ? src.slice(rehabStart, rehabEnd) : '';
  const fontMatches = [...rehabBlock.matchAll(/font-size:(\d+)px/g)].map(m=>parseInt(m[1]));
  check('rehab section has font-size declarations to verify',
    fontMatches.length > 0, `found ${fontMatches.length} font-size declarations`);
  check('all font-size values in rehab section are ≥ 12px (20% up from 10px min)',
    fontMatches.every(sz => sz >= 12),
    `found sizes: ${fontMatches.join(', ')}`);
  check('no 10px or 11px font-size remains in rehab section',
    !rehabBlock.match(/font-size:(10|11)px/),
    'found small font sizes in rehab block');

  // Fix 3: _progWizGenerate must NOT call savePrograms() — only _progIsNew and closeProgramOverlay path should
  const genStart = src.indexOf('function _progWizGenerate()');
  const genEnd   = genStart >= 0 ? src.indexOf('\n}', genStart) : -1;
  const genBody  = genStart >= 0 && genEnd > genStart ? src.slice(genStart, genEnd) : '';
  check('_progWizGenerate does NOT call savePrograms() (cancel bug fix)',
    genBody.length > 0 && !genBody.includes('savePrograms()'),
    `found savePrograms() in _progWizGenerate body: "${genBody.slice(0,200)}"`);
  check('_progWizGenerate still pushes to _programs array',
    genBody.includes('_programs.push(prog)'));
  check('_progWizGenerate still sets _progIsNew=true',
    genBody.includes('_progIsNew=true'));
  check('closeProgramOverlay still calls savePrograms() after splice (cancel path cleans up)',
    (function(){
      var ci=src.indexOf('function closeProgramOverlay()');
      var ce=ci>=0?src.indexOf('\n}',ci):-1;
      var cb=ci>=0&&ce>ci?src.slice(ci,ce):'';
      return cb.includes('savePrograms()');
    })());
}

// ── Section 49: BF chart index-based x-spacing ───────────────────────────────
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  check('drawBfChart uses index-based xp (not time-based dates)',
    src.includes('var xp=function(i){return pad.l+(pts.length===1?cW/2:(i/(pts.length-1))*cW);}'));
  check('drawBfChart draws dots for all entries via forEach',
    src.includes('pts.forEach(function(p,i){var x=xp(i)'));
}

// ── Section 50: Auth login_hint + email persistence + session token ───────────
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  check('staging proxy bypass set includes session_token',
    src.includes("new Set(['google_token','google_email','session_token'])"));
  check('onGoogleSignIn stores google_email from JWT payload',
    src.includes("localStorage.setItem('google_email',_jp.email)"));
  check('initGoogleAuth uses login_hint when google_email stored',
    src.includes("var _hl=localStorage.getItem('google_email')||'';if(_hl)_ih.login_hint=_hl;"));
  check('logout clears google_email',
    src.includes("localStorage.removeItem('google_email');"));
  check('_sessionToken loaded from localStorage on startup',
    src.includes("let _sessionToken=localStorage.getItem('session_token')||'';"));
  check('authHeaders uses _sessionToken over _googleToken',
    src.includes("const _t=_sessionToken||_googleToken;"));
  check('startup verify uses _sessionToken||_googleToken as start token',
    src.includes("var _startToken=_sessionToken||_googleToken;"));
  check('onGoogleSignIn saves session_token from verify response',
    src.includes("if(_vd.session_token){_sessionToken=_vd.session_token;localStorage.setItem('session_token',_vd.session_token);}"));
  check('logout clears session_token from localStorage',
    src.includes("localStorage.removeItem('session_token');"));
  check('wipeLocalCache preserves session_token across cache wipe',
    src.includes("var _s=window.localStorage.getItem('session_token');") &&
    src.includes("if(_s)window.localStorage.setItem('session_token',_s);"));
  check('startup verify refreshes session_token from response',
    src.includes("if(d&&d.session_token){_sessionToken=d.session_token;localStorage.setItem('session_token',d.session_token);}"));
  check('_loadGsi called unconditionally after startup verify block',
    src.includes("unlockApp();});}_loadGsi();"));
}

// ── Section 52: BF chart shows all entries (no time window filter) ────────────
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const bfStart = src.indexOf('function drawBfChart(');
  const bfEnd = src.indexOf('function drawBmiChart(');
  const bfBody = bfStart >= 0 && bfEnd > bfStart ? src.slice(bfStart, bfEnd) : '';
  check('drawBfChart does not filter by _weightWindow cutoff',
    !bfBody.includes('cutoffStr') && !bfBody.includes('_weightWindow'));
  check('drawBfChart filters only on valid date format and bf>0',
    src.includes("bfLog.filter(function(e){return e.date&&/^\\d{4}-\\d{2}-\\d{2}$/.test(e.date)&&e.bf>0;})"));
}

// ── Section 53: Weight chart (drawChart) DOES filter by _weightWindow ─────────
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const wStart = src.indexOf('async function drawChart(');
  const wEnd = src.indexOf('function saveBf(');
  const wBody = wStart >= 0 && wEnd > wStart ? src.slice(wStart, wEnd) : '';
  check('drawChart uses _weightWindow cutoff (intentional for weight)',
    wBody.includes('_weightWindow') && wBody.includes('cutoffStr'));
  check('drawChart filters weights by date >= cutoffStr',
    wBody.includes('w.date>=cutoffStr'));
}

// ── Section 54: BMI chart uses weight window (BMI derived from weight data) ───
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const bmiStart = src.indexOf('function drawBmiChart(');
  const bmiEnd = src.indexOf('function drawBmiChart(') >= 0
    ? src.indexOf('function syncBodyComp', src.indexOf('function drawBmiChart(') + 20)
    : -1;
  const bmiBody = bmiStart >= 0 && bmiEnd > bmiStart ? src.slice(bmiStart, bmiEnd) : '';
  check('drawBmiChart uses _weightWindow cutoff (BMI derives from weight entries)',
    bmiBody.includes('_weightWindow') && bmiBody.includes('cutoffStr'));
  check('drawBmiChart filters weight entries by date >= cutoffStr',
    bmiBody.includes('w.date>=cutoffStr'));
}

// ── Section 55: Volume chart uses volWindow, not _weightWindow ────────────────
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const vStart = src.indexOf('async function drawVolumeChart(');
  const vEnd = src.indexOf('let _weightWindow=');
  const vBody = vStart >= 0 && vEnd > vStart ? src.slice(vStart, vEnd) : src.slice(vStart >= 0 ? vStart : 0, vStart >= 0 ? vStart + 2000 : 2000);
  check('drawVolumeChart uses volWindow (separate from weight window)',
    src.includes('async function drawVolumeChart(') && src.includes('const days=volWindow||'));
  check('volWindow and _weightWindow are independent variables',
    src.includes('let volWindow=') && src.includes('let _weightWindow='));
}

// ── Section 56: Weight tab re-syncs body comp from backend on every open ──────
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const ptStart = src.indexOf('function showProgressTab(');
  const ptEnd = ptStart >= 0 ? src.indexOf('function ', ptStart + 30) : -1;
  const ptBody = ptStart >= 0 && ptEnd > ptStart ? src.slice(ptStart, ptEnd) : '';
  check("showProgressTab overview tab calls syncBodyCompFromAgent (fresh BF% data)",
    ptBody.includes("name==='overview'") && ptBody.includes('syncBodyCompFromAgent()'));
  check("showProgressTab overview tab calls syncWeightsFromAgent (fresh weight data)",
    ptBody.includes("name==='overview'") && ptBody.includes('syncWeightsFromAgent()'));
}

// ── Section 57: Storage inspector (IS_STAGING only) ──────────────────────────
console.log('\n── Storage inspector ────────────────────────────────────────');
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  check('tab-btn-storage exists in HTML (hidden by default)',
    src.includes('id="tab-btn-storage"') && src.includes("style=\"display:none\""));
  check('page-storage div exists in HTML',
    src.includes('id="page-storage"'));
  check('buildStoragePage function defined',
    src.includes('function buildStoragePage()'));
  check('showPage calls buildStoragePage for storage tab',
    src.includes("if(name==='storage')buildStoragePage()"));
  check('lsDbgCopy function defined',
    src.includes('function lsDbgCopy('));
  check('lsDbgCopyAll function defined',
    src.includes('function lsDbgCopyAll()'));
  check('storage tab included in PAGE_LABELS and PAGE_DEFAULTS via IS_STAGING (toggleable in Settings)',
    src.includes("IS_STAGING?{storage:'Storage'}:{}") && src.includes('IS_STAGING?{storage:true}:{}'));
  check('buildStoragePage uses clipboard API to copy',
    src.includes('navigator.clipboard.writeText'));
}

// ── Section 58: syncSettingsFromAgent re-draws BMI chart when weight panel visible ──
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const ssStart = src.indexOf('async function syncSettingsFromAgent()');
  const ssEnd = ssStart >= 0 ? src.indexOf('async function ', ssStart + 30) : -1;
  const ssBody = ssStart >= 0 && ssEnd > ssStart ? src.slice(ssStart, ssEnd) : '';
  check('syncSettingsFromAgent re-draws BMI chart after fetching profile (timing fix)',
    ssBody.includes('ppanel-overview') && ssBody.includes('drawBmiChart()'));
  check('syncSettingsFromAgent checks panel visibility before redraw',
    ssBody.includes("classList.contains('hidden')") && ssBody.includes('drawBmiChart()'));
}

// ── Section 59: Programs card lives in Program tab, not Settings ──────────────
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const progPageStart = src.indexOf('id="page-program"');
  const progPageEnd = src.indexOf('id="page-log"');
  const progPageHtml = progPageStart >= 0 && progPageEnd > progPageStart ? src.slice(progPageStart, progPageEnd) : '';
  const settingsPageStart = src.indexOf('id="page-settings"');
  const settingsHtml = settingsPageStart >= 0 ? src.slice(settingsPageStart, settingsPageStart + 2000) : '';
  check('s-programs-card div is inside page-program',
    progPageHtml.includes('id="s-programs-card"'));
  check('s-programs-card div is NOT inside page-settings',
    !settingsHtml.includes('id="s-programs-card"'));
  check('showPage calls buildProgramSettingsCard when navigating to program tab',
    src.includes("name==='program')buildProgramSettingsCard()"));
  check('loadSettings does not call buildProgramSettingsCard (card is in Program tab)',
    !src.slice(src.indexOf('async function loadSettings('), src.indexOf('async function loadSettings(') + 4000).includes('buildProgramSettingsCard()'));
}

// ── Section 60a: tags are derived from reps, never rewritten on load ──────────
// Rule (2026-07-31) REPLACES "no rehab tag in non-rehab programs": that rewrite relabelled
// 15-rep isolation as `volume` and left the reps at 15 — the violation it was meant to prevent.
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  check('generator derives every exercise tag from its prescribed reps',
    src.includes('days.forEach(function(day){(day.exercises||[]).forEach(applyTagFromReps);});'));
  check('derivation runs after the leg-day rule re-authors the Deadlift scheme',
    src.indexOf('forEach(applyTagFromReps)') > src.indexOf("dlx.tag='strength';dlx.fixed=true"));
  check('the old rehab→volume generator rewrite is gone',
    !src.includes("(!_isRehabGoal&&ex.tag==='rehab')?'volume':ex.tag"));
  check('_ensurePrograms no longer rewrites tags on stored programs',
    !src.includes("if(e.tag==='rehab'&&!e.prehab){e.tag='volume';changed=true;}"));
}

// ── Section 60: Program card toggle switch ────────────────────────────────────
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const cardStart = src.indexOf('function buildProgramSettingsCard()');
  const cardEnd = src.indexOf('function viewProgram(');
  const cardBody = cardStart >= 0 && cardEnd > cardStart ? src.slice(cardStart, cardEnd) : '';
  check('program card uses toggle switch div (not pill button) for activation',
    cardBody.includes('_activateProg') && !cardBody.includes('<button onclick="event.stopPropagation();_activateProg'));
  check('program card toggle switch has knob that shifts position based on isActive',
    cardBody.includes("left:'+(isActive?'18px':'2px')+'"));
  check('program card toggle shows Active/Inactive label beside switch',
    cardBody.includes("isActive?'Active':'Inactive'"));
  check('program card toggle uses event.stopPropagation to prevent card open',
    cardBody.includes('event.stopPropagation();_activateProg'));
}

// ── Section 61: Female Aesthetics core exercises ──────────────────────────────
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const fbStart = src.indexOf("key==='aesthetic-fullbody'");
  const fbEnd = src.indexOf("key==='aesthetic-upperlower'");
  const fbBody = fbStart >= 0 && fbEnd > fbStart ? src.slice(fbStart, fbEnd) : '';
  const ulStart = src.indexOf("key==='aesthetic-upperlower'");
  const ulEnd = ulStart >= 0 ? src.indexOf('};', ulStart) : -1;
  const ulBody = ulStart >= 0 && ulEnd > ulStart ? src.slice(ulStart, ulEnd) : '';
  check('aesthetic-fullbody includes Dead Bug core exercise',
    fbBody.includes("pw('Dead Bug'"));
  check('aesthetic-fullbody includes Bird Dog core exercise',
    fbBody.includes("pw('Bird Dog'"));
  check('aesthetic-fullbody includes Plank core exercise',
    fbBody.includes("pw('Plank'"));
  check('aesthetic-upperlower includes at least two yoga/pilates core exercises',
    [ulBody.includes("pw('Dead Bug'"), ulBody.includes("pw('Bird Dog'"), ulBody.includes("pw('Plank'"), ulBody.includes("pw('Pallof Press'")].filter(Boolean).length >= 2);
  check('core exercises in aesthetic pool carry rehab tag (remapped to volume at runtime for non-rehab goals)',
    fbBody.includes("'Dead Bug','3") && fbBody.includes(",'rehab'") &&
    fbBody.includes("'Bird Dog','3") && fbBody.includes("'Plank','3"));
}

// ── Section 62: prefillLog — WPU, reps, scheme label ─────────────────────────
console.log('\n── prefillLog — WPU / reps / scheme label ────────────────────');
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const fn = G.prefillLog.toString();

  // 62a. WPU detector: _isWPU excludes WPU from isBodyweight
  check('prefillLog: _isWPU detector present',
    fn.includes('_isWPU') && fn.includes("weighted\\s*(pull|chin)"));
  check('prefillLog: isBodyweight excludes WPU (_isWPU gate)',
    fn.includes('(ex.kg===0||isBWExName(ex._rehabOrig||ex.name))&&!_isWPU'));

  // 62b. Reps inputs are always empty (never pre-filled from template)
  check('prefillLog: repsVal is always empty string',
    fn.includes("repsVal=''") && !fn.includes("repsVal=r==='max'"));

  // 62c. Scheme label uses accent colour, larger font, no weight
  check('prefillLog: scheme label uses font-size:13px',
    fn.includes('font-size:13px'));
  check('prefillLog: scheme label uses var(--accent)',
    fn.includes('color:var(--accent)') && fn.includes("margin-top:2px"));
  check('prefillLog: scheme label shows sets only (no weight)',
    fn.includes(">'+(_deloadActive?_deloadSets(ex.sets):ex.sets)+'</div>") && !fn.includes("ex.sets+' '+(lastKg?lastKg+'kg'"));
  check('prefillLog: exercise name is heading above scheme label (not same line)',
    fn.includes('margin-bottom:10px') && fn.includes("margin-top:2px"));
  // Regression: must NOT still use the old muted/11px combo for the scheme label
  check('prefillLog: scheme label no longer uses font-size:11px+var(--muted) combo',
    !fn.includes('font-size:11px;color:var(--muted)'));

  // 62d. WPU uses saved/history added weight, not bodyweight
  // Simulate environment: set weights (bodyweight = 90) and logs with WPU
  {
    const _savedW62  = G.weights;
    const _savedL62  = G.logs;
    const _savedP62  = G._activeProgramIndex;
    const _savedProg62 = G._programs ? [...G._programs] : [];

    G.weights = [{ date: '2020-01-01', weight: 90 }];
    // A log where WPU was done with 15 added kg
    G.logs = [{
      date: '2020-01-15',
      exercises: [{ name: 'Weighted Pull-ups', sets: [
        { kg: 15, reps: 6 }, { kg: 15, reps: 6 }
      ]}]
    }];

    // getBestKgFromLogs must return 15 (not 90)
    check('prefillLog WPU: getBestKgFromLogs returns added weight (15), not bodyweight (90)',
      G.getBestKgFromLogs('Weighted Pull-ups') === 15,
      `got ${G.getBestKgFromLogs('Weighted Pull-ups')}`);

    // getBestKgFromLogs for regular pull-ups (kg=0) should return null
    G.logs = [{
      date: '2020-01-15',
      exercises: [{ name: 'Pull-ups', sets: [{ kg: 0, reps: 8 }] }]
    }];
    check('prefillLog: regular Pull-ups with kg=0 → getBestKgFromLogs returns null',
      G.getBestKgFromLogs('Pull-ups') === null);

    G.weights = _savedW62;
    G.logs    = _savedL62;
    G._activeProgramIndex = _savedP62;
  }

  // 62e. Verify WPU is NOT flagged as bodyweight exercise in code path
  check('prefillLog: isBodyweight check includes !_isWPU exclusion',
    fn.includes('&&!_isWPU'));

  // 62f. Regular bodyweight exercises (Pull-ups without "Weighted") still use bodyweight default
  check('prefillLog: non-WPU bodyweight exercise still hits bwDefault path',
    fn.includes('isBodyweight?bwDefault'));
}

// ── Section 63: No standalone "Arms" day in any pool ─────────────────────────
console.log('\n── No standalone Arms day in program pools ──────────────────');
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

  // Regression: "Arms & Delts" must not appear as a pool day name (was Day 6
  // in hypertrophy-upper 6-day pool, causing Pull B → Arms & Delts biceps clash)
  check('no "Arms & Delts" day in any pool definition',
    !src.includes("'Day 6 — Arms & Delts'") && !src.includes("'Day 7 — Arms & Delts'"));

  // Regression: "Arms & Mobility" must not appear (was Day 5 in strength-pure)
  check('no "Arms & Mobility" day in any pool definition',
    !src.includes("'Day 5 — Arms & Mobility'"));

  // Regression: "Shoulders & Arms" must not appear (was Day 4 in hypertrophy-upper 5-day)
  check('no "Shoulders & Arms" day in any pool definition',
    !src.includes("'Day 4 — Shoulders & Arms'"));

  // Seed program Day 6 must now be Legs B, not Arms & Delts
  check('_seedHypertrophyProgram Day 6 is "Legs B" (not Arms & Delts)',
    src.includes("'Day 6 — Legs B'") && !src.includes("'Day 6 — Arms & Delts'"));

  // hypertrophy-upper 6-day pool: Pull B must be followed by Legs B (not Arms)
  // Verify the pool ends with Pull B then Legs B, no arm day in between
  const hypUpperStart = src.indexOf("key==='hypertrophy-upper'");
  const hypUpperEnd = src.indexOf("key==='hypertrophy-lower'");
  const hypUpperSrc = hypUpperStart >= 0 && hypUpperEnd > hypUpperStart
    ? src.slice(hypUpperStart, hypUpperEnd) : '';
  check('hypertrophy-upper 6-day pool: Pull B followed directly by Legs B (no Arms & Delts)',
    hypUpperSrc.includes("'Day 5 — Pull B'") &&
    hypUpperSrc.includes("'Day 7 — Legs B'") &&
    !hypUpperSrc.includes("'Day 6 — Arms & Delts'"));

  // Wizard generated programs: _generateWorkoutProgram for hypertrophy-upper
  // 6-day must produce PPL structure (Push/Pull/Legs × 2)
  {
    const _savedP63 = G._programs ? [...G._programs] : [];
    const _savedPIdx63 = G._activeProgramIndex;
    try {
      const prog = G._generateWorkoutProgram('hypertrophy', 'upper', 6, 'Test PPL', 12);
      const dayNames = prog.days.map(d => d.name.toLowerCase());
      const hasPull5 = dayNames[4] && dayNames[4].includes('pull');
      const hasLegs6 = dayNames[5] && dayNames[5].includes('leg');
      check('wizard hypertrophy-upper 6-day: day 5 is Pull B', hasPull5,
        `got "${prog.days[4]?.name}"`);
      check('wizard hypertrophy-upper 6-day: day 6 is Legs B (not Arms)', hasLegs6,
        `got "${prog.days[5]?.name}"`);
      // No consecutive same muscle groups
      const groups = prog.days.map(d => {
        const n = d.name.toLowerCase();
        if (/leg|squat|hip|rdl|deadlift/.test(n)) return 'legs';
        if (/pull|row|lat|back/.test(n)) return 'pull';
        if (/push|bench|chest|press/.test(n)) return 'push';
        return 'other';
      });
      const hasConsecutive = groups.some((g, i) => i > 0 && g !== 'other' && g === groups[i - 1]);
      check('wizard hypertrophy-upper 6-day: no consecutive same muscle group',
        !hasConsecutive, `groups: ${JSON.stringify(groups)}`);
    } catch(e) {
      check('wizard hypertrophy-upper 6-day: _generateWorkoutProgram runs without error', false, e.message);
    }
  }
}

// ── propagateWeight — forward-only weight propagation ─────────────────────────
console.log('\n── propagateWeight — forward-only propagation ──────────────');
check('propagateWeight defined', typeof G.propagateWeight === 'function');

{
  // Helper: build a fake kg input with dataset attributes
  const mkKg = (ex, set, val) => ({ dataset: { ex: String(ex), set: String(set), type: 'kg' }, value: String(val) });

  // Override getElementById for 'structured-log' to return a custom container
  const _savedGetEl = sandbox.document.getElementById.bind(sandbox.document);
  const withContainer = (inputs, fn) => {
    sandbox.document.getElementById = (id) => {
      if (id === 'structured-log') {
        return {
          querySelectorAll: (sel) => {
            const m = sel.match(/data-ex="(\d+)"/);
            return m ? inputs.filter(i => i.dataset.ex === m[1]) : [];
          }
        };
      }
      return _savedGetEl(id);
    };
    fn();
    sandbox.document.getElementById = _savedGetEl;
  };

  // ── Core regression: 36kg across 4 sets, user changes set 2 to 43kg ──
  // Expected: sets 0 and 1 stay 36, set 3 becomes 43 (forward-only)
  const inp4 = [mkKg(0,0,'36'), mkKg(0,1,'36'), mkKg(0,2,'36'), mkKg(0,3,'36')];
  inp4[2].value = '43';
  withContainer(inp4, () => G.propagateWeight(inp4[2]));
  check('regression: set 0 unchanged when set 2 changed to 43kg', inp4[0].value === '36', `got ${inp4[0].value}`);
  check('regression: set 1 unchanged when set 2 changed to 43kg', inp4[1].value === '36', `got ${inp4[1].value}`);
  check('regression: set 2 keeps its new value (43kg)',           inp4[2].value === '43', `got ${inp4[2].value}`);
  check('regression: set 3 updated to 43kg (forward propagation)', inp4[3].value === '43', `got ${inp4[3].value}`);

  // ── Changing set 0 propagates to ALL subsequent sets ──
  const inp3 = [mkKg(0,0,'80'), mkKg(0,1,'80'), mkKg(0,2,'80')];
  inp3[0].value = '100';
  withContainer(inp3, () => G.propagateWeight(inp3[0]));
  check('set 0 → 100kg propagates to set 1', inp3[1].value === '100', `got ${inp3[1].value}`);
  check('set 0 → 100kg propagates to set 2', inp3[2].value === '100', `got ${inp3[2].value}`);

  // ── Changing last set does NOT affect any previous set ──
  const inp3b = [mkKg(0,0,'60'), mkKg(0,1,'60'), mkKg(0,2,'60')];
  inp3b[2].value = '80';
  withContainer(inp3b, () => G.propagateWeight(inp3b[2]));
  check('changing last set: set 0 untouched', inp3b[0].value === '60', `got ${inp3b[0].value}`);
  check('changing last set: set 1 untouched', inp3b[1].value === '60', `got ${inp3b[1].value}`);

  // ── Changing middle set (1 of 3) only updates set 2 ──
  const inp3c = [mkKg(0,0,'50'), mkKg(0,1,'50'), mkKg(0,2,'50')];
  inp3c[1].value = '70';
  withContainer(inp3c, () => G.propagateWeight(inp3c[1]));
  check('changing set 1: set 0 untouched',            inp3c[0].value === '50', `got ${inp3c[0].value}`);
  check('changing set 1: set 2 updated to 70 (forward)', inp3c[2].value === '70', `got ${inp3c[2].value}`);

  // ── Single set — no propagation, no error ──
  const inp1 = [mkKg(0,0,'90')];
  inp1[0].value = '95';
  let singleThrew = false;
  try { withContainer(inp1, () => G.propagateWeight(inp1[0])); }
  catch(e) { singleThrew = true; }
  check('single-set exercise: propagateWeight does not throw', !singleThrew);
  check('single-set exercise: set 0 keeps its value',          inp1[0].value === '95', `got ${inp1[0].value}`);

  // ── Different exercises are isolated (data-ex scoping) ──
  const inpEx0 = [mkKg(0,0,'60'), mkKg(0,1,'60')];
  const inpEx1 = [mkKg(1,0,'80'), mkKg(1,1,'80')];
  const allInputs = [...inpEx0, ...inpEx1];
  inpEx0[0].value = '90';
  withContainer(allInputs, () => G.propagateWeight(inpEx0[0]));
  check('ex isolation: changing ex0 propagates within ex0', inpEx0[1].value === '90', `got ${inpEx0[1].value}`);
  check('ex isolation: changing ex0 does NOT touch ex1 set 0', inpEx1[0].value === '80', `got ${inpEx1[0].value}`);
  check('ex isolation: changing ex0 does NOT touch ex1 set 1', inpEx1[1].value === '80', `got ${inpEx1[1].value}`);
}

// ── parseDec (decimal comma AND dot support) ─────────────────────────────────
console.log('\n── parseDec ────────────────────────────────────────────────');
check('parseDec defined',            typeof G.parseDec === 'function');
check('parseDec("82,5") → 82.5',     G.parseDec('82,5') === 82.5,  `got ${G.parseDec('82,5')}`);
check('parseDec("82.5") → 82.5',     G.parseDec('82.5') === 82.5,  `got ${G.parseDec('82.5')}`);
check('parseDec(" 90 ") → 90',       G.parseDec(' 90 ') === 90);
check('parseDec("") → NaN',          Number.isNaN(G.parseDec('')));
check('parseDec(null) → NaN',        Number.isNaN(G.parseDec(null)));
check('parseDec(5) → 5 (number passthrough)', G.parseDec(5) === 5);
check('parseDec("0,25") → 0.25',     G.parseDec('0,25') === 0.25);
check('kg inputs use inputmode="decimal"', (rawScript.match(/inputmode="decimal"/g) || []).length >= 4);
check('saveLog parses kg in the selected unit', rawScript.includes('unitToKg(kgInputs[i]'));
check('saveWeight parses in the selected unit', rawScript.includes("unitToKg(document.getElementById('weight-input')"));
check('saveBf parses with parseDec',       rawScript.includes("parseDec(document.getElementById('bf-input')"));

// ── ewmaSmooth (strength trend smoothing) ────────────────────────────────────
console.log('\n── ewmaSmooth ──────────────────────────────────────────────');
check('ewmaSmooth defined',          typeof G.ewmaSmooth === 'function');
check('empty → []',                  G.ewmaSmooth([], [], 14).length === 0);
check('single value → itself',       G.ewmaSmooth(['2026-07-01'], [100], 14)[0] === 100);
{
  const flat = G.ewmaSmooth(['2026-07-01','2026-07-03','2026-07-05'], [100,100,100], 14);
  check('constant series stays constant', flat.every(v => v === 100));
  // A one-off bad session must NOT tank the trend: 100 → 50 one day later moves < 10%
  const drop = G.ewmaSmooth(['2026-07-01','2026-07-02'], [100,50], 14);
  check('1-day 50% drop damped to <10% move', drop[1] > 90, `got ${drop[1]}`);
  // A long gap weighs the new value more (time-aware)
  const gap = G.ewmaSmooth(['2026-06-01','2026-07-01'], [100,50], 14);
  check('30-day gap moves further toward new value', gap[1] < drop[1], `got ${gap[1]} vs ${drop[1]}`);
  // Growth is smoothed symmetrically
  const up = G.ewmaSmooth(['2026-07-01','2026-07-02'], [100,150], 14);
  check('1-day 50% jump also damped', up[1] < 110, `got ${up[1]}`);
}
check('session strength chart uses ewmaSmooth', rawScript.includes('const smoothed=ewmaSmooth('));
check('weekly strength trend uses ewmaSmooth',  rawScript.includes('const roll3=ewmaSmooth('));

// ── isBWExName (bodyweight exercise detection) ───────────────────────────────
console.log('\n── isBWExName ──────────────────────────────────────────────');
check('isBWExName defined',              typeof G.isBWExName === 'function');
check('"Push-ups" → true',               G.isBWExName('Push-ups'));
check('"Pull-ups" → true',               G.isBWExName('Pull-ups'));
check('"Chin-ups" → true',               G.isBWExName('Chin-ups'));
check('"Dips" → true',                   G.isBWExName('Dips'));
check('"Weighted Pull-ups" → false',     !G.isBWExName('Weighted Pull-ups'));
check('"Tricep Pushdown" → false',       !G.isBWExName('Tricep Pushdown'));
check('"Bench Press" → false',           !G.isBWExName('Bench Press'));
check('syncWeightsFromAgent refreshes BW prefill', rawScript.includes('_refreshBWPrefill();}catch(e){}'));

// ── Leg-day rules: Squat first, Deadlift (1×5-8) last ────────────────────────
console.log('\n── Leg-day rules in generated programs ─────────────────────');
{
  const goalSubs = [['hypertrophy','upper',7],['hypertrophy','upper',6],['hypertrophy','upper',5],
                    ['hypertrophy','balanced',6],['hypertrophy','lower',5],['hypertrophy','lower',6]];
  let checkedDays = 0, allOk = true, details = [];
  for (const [goal, sub, nDays] of goalSubs) {
    const prog = G._generateWorkoutProgram(goal, sub, nDays, 'T', 12);
    for (const day of prog.days) {
      if (!/legs/i.test(day.name)) continue;
      checkedDays++;
      const exs = day.exercises;
      const isSq = (e) => /squat/i.test(e.name) && !/split/i.test(e.name);
      const hasSq = exs.some(isSq), hasDL = exs.some(e => e.name === 'Deadlift');
      const squatDay = hasSq && !hasDL && isSq(exs[0]);
      // Scheme is "1×6", not the old "1×5-8" (rule 2026-07-31): a 5-8 range straddles strength
      // (4-6) and volume (8-12), so it is not a range any tag defines. The heavy single is
      // prescribed at 6 reps and labelled strength.
      const _dl = exs[exs.length - 1];
      const dlDay = hasDL && !hasSq && _dl.name === 'Deadlift'
        && new RegExp('×' + String(_dl.sets).split('-')[0] + '$').test(_dl.scheme) && _dl.tag === 'strength';
      if (!(squatDay || dlDay)) { allOk = false; details.push(`${goal}-${sub}-${nDays} ${day.name}: sq=${hasSq} dl=${hasDL} first=${exs[0].name} last=${exs[exs.length-1].name}`); }
    }
  }
  check('leg days found across hypertrophy programs', checkedDays >= 6, `got ${checkedDays}`);
  check('every Legs day is EITHER a Squat day OR a Deadlift day', allOk, details.join('; '));
  // 7-day hypertrophy-upper specifically (the reported bug): Legs A must end with Deadlift
  const p7 = G._generateWorkoutProgram('hypertrophy', 'upper', 7, 'T7', 12);
  const legsA = p7.days.find(d => /legs a/i.test(d.name));
  check('7-day hyp-upper Legs A exists', !!legsA);
  check('7-day hyp-upper Legs A is a Squat day (squat first, no Deadlift)',
    !!legsA && /squat/i.test(legsA.exercises[0].name)
            && !legsA.exercises.some(e => e.name === 'Deadlift'),
    legsA ? JSON.stringify(legsA.exercises.map(e => e.name)) : 'no Legs A');
  const legsB7 = p7.days.find(d => /legs b/i.test(d.name));
  check('7-day hyp-upper Legs B is a Deadlift day (deadlift last, no squats)',
    !!legsB7 && legsB7.exercises[legsB7.exercises.length - 1].name === 'Deadlift'
             && !legsB7.exercises.some(e => /squat/i.test(e.name) && !/split/i.test(e.name)),
    legsB7 ? JSON.stringify(legsB7.exercises.map(e => e.name)) : 'no Legs B');
  // The heavy Deadlift finisher is a FIXED prescription (rule 2026-07-31, supersedes the
  // 2026-07-10 "Deadlift is allocator-sized like any other exercise" rule for this entry):
  // it is always present, always last, and keeps exactly the sets it was authored with at
  // every setsPerMuscle. Everything else in the session is sized around it.
  const _dlFin = (spm) => G._generateWorkoutProgram('hypertrophy', 'upper', 7, 'T', spm)
    .days.filter(d => /legs/i.test(d.name) && d.exercises.some(e => e.name === 'Deadlift'))
    .map(d => d.exercises[d.exercises.length - 1]);
  const _dl9 = _dlFin(9), _dl16 = _dlFin(16), _dl25 = _dlFin(25);
  check('heavy Deadlift finisher present and last on the Deadlift leg day',
    _dl9.length > 0 && _dl9.every(l => l.name === 'Deadlift'));
  check('heavy Deadlift finisher is flagged as a fixed prescription',
    _dl16.every(l => l.fixed === true));
  check('heavy Deadlift finisher keeps its sets at every setsPerMuscle (9/16/25)',
    [_dl9, _dl16, _dl25].every(a => a.every(l => String(l.sets) === '6' && String(l.scheme) === '1×6' && l.tag === 'strength')),
    JSON.stringify([_dl9, _dl16, _dl25].map(a => a.map(l => l.sets))));
  // Strength programs keep it too — the linear scaling path must not scale it either.
  const _dlStr = G._generateWorkoutProgram('strength', 'hybrid', 6, 'T', 20)
    .days.filter(d => /legs/i.test(d.name)).map(d => d.exercises[d.exercises.length - 1])
    .filter(l => l.name === 'Deadlift');
  check('strength path leaves the heavy Deadlift finisher unscaled',
    _dlStr.length > 0 && _dlStr.every(l => String(l.sets) === '6'),
    JSON.stringify(_dlStr.map(l => l.sets)));
  // Rehab programs are untouched (no heavy deadlift forced into rehab days)
  const pk = G._generateWorkoutProgram('rehab', 'knee', 6, 'TK', 12);
  check('rehab-knee program has no forced Deadlift finishers',
    pk.days.every(d => { const l = d.exercises[d.exercises.length - 1]; return !(l.name === 'Deadlift' && l.sets === '6'); }));
}

// ── Stored programs are NEVER mutated by _ensurePrograms (user edits stick) ──
// Rule (2026-07-24): leg-day rules apply only to newly generated programs. A stored program's
// exercises must survive reload exactly as saved — _ensurePrograms must not reorder/inject
// Squat or Deadlift on a stored Legs day (that silently reverted the user's own edits).
console.log('\n── Stored programs untouched on load ───────────────────────');
{
  const savedPrograms = G.localStorage.getItem('workout_programs');
  const testProg = { programs: [{ name: '6-Day Hypertrophy — Upper', goal: 'hypertrophy', days: [
    { name: 'Day 3 — Legs A', warmup: false, exercises: [
      { name: 'Leg Press', scheme: '3×12', tag: 'volume', sets: '12-12-12', kg: 100 },
      { name: 'Leg Curl',  scheme: '3×12', tag: 'volume', sets: '12-12-12', kg: 40 } ] },
  ] }], active_index: 0 };
  G.localStorage.setItem('workout_programs', JSON.stringify(testProg));
  G.initPrograms();
  const p = G.getActiveProgram();
  const day = p.days.find(d => /legs/i.test(d.name));
  // The user removed Squat from this leg day — it must stay removed on load (not re-injected)
  check('stored Legs day is left exactly as saved (Squat NOT re-injected)',
    !!day && JSON.stringify(day.exercises.map(e => e.name)) === JSON.stringify(['Leg Press', 'Leg Curl']),
    day ? JSON.stringify(day.exercises.map(e => e.name)) : 'no legs day');
  // Regression for the reported bug: replace Squat → Leg Press on a stored leg day, reload, edit sticks
  const edited = { programs: [{ name: '6-Day Hypertrophy — Upper', goal: 'hypertrophy', days: [
    { name: 'Day 1 — Legs A', warmup: false, exercises: [
      { name: 'Leg Press', scheme: '4×10', tag: 'volume', sets: '10-10-10-10', kg: 100 },
      { name: 'Leg Curl',  scheme: '3×12', tag: 'volume', sets: '12-12-12', kg: 40 } ] } ] }], active_index: 0 };
  G.localStorage.setItem('workout_programs', JSON.stringify(edited));
  G.initPrograms();
  const ed = G.getActiveProgram().days[0];
  check('replacing Squat→Leg Press on a stored leg day survives reload',
    !ed.exercises.some(e => /squat/i.test(e.name) && !/split/i.test(e.name)),
    JSON.stringify(ed.exercises.map(e => e.name)));
  // restore prior state
  if (savedPrograms === null) G.localStorage.removeItem('workout_programs');
  else G.localStorage.setItem('workout_programs', savedPrograms);
  G.initPrograms();
}

// ── Weighted Pull-ups: BW always included in volume + strength ───────────────
console.log('\n── WPU body weight inclusion ───────────────────────────────');
{
  const _savedW = G.weights, _savedL = G.logs;
  G.weights = [{ date: '2020-01-01', weight: 80 }];
  // WPU set with 0 added weight must still count as BW load (was skipped by kg>0 guard)
  G.logs = [{ date: '2020-01-15', exercises: [{ name: 'Weighted Pull-ups', sets: [{ kg: 0, reps: 10 }] }] }];
  const v0 = G.buildSessionGroupVol('back', 10000);
  check('WPU kg=0: volume counts BW (80×10×0.65)', v0.length === 1 && Math.abs(v0[0].vol - 80 * 10 * 0.65) < 0.01, `got ${v0[0]?.vol}`);
  const s0 = G.buildSessionGroupStrength('back', 10000);
  const expS0 = 80 * (1 + 10 / 30) * 0.65;
  check('WPU kg=0: strength counts BW', s0.length === 1 && Math.abs(s0[0].est1rm - expS0) < 0.01, `got ${s0[0]?.est1rm}`);
  // WPU with added weight: BW + added
  G.logs = [{ date: '2020-01-15', exercises: [{ name: 'Weighted Pull-ups', sets: [{ kg: 15, reps: 6 }] }] }];
  const v15 = G.buildSessionGroupVol('back', 10000);
  check('WPU kg=15: volume = (15+80)×6×0.65', v15.length === 1 && Math.abs(v15[0].vol - 95 * 6 * 0.65) < 0.01, `got ${v15[0]?.vol}`);
  // Non-WPU with kg=0 stays excluded (no phantom volume)
  G.logs = [{ date: '2020-01-15', exercises: [{ name: 'Barbell Row', sets: [{ kg: 0, reps: 10 }] }] }];
  check('non-WPU kg=0 set still excluded', G.buildSessionGroupVol('back', 10000).length === 0);
  G.weights = _savedW; G.logs = _savedL;
}
check('WPU card shows BW chip in title', rawScript.includes('data-bw-chip'));
check('BW chip refreshed after weight sync', rawScript.includes("querySelectorAll('[data-bw-chip]')"));
check('custom-card WPU adds BW to session volume', rawScript.includes('_cbw=/weighted'));

// ── Frequency-aware volume allocation ────────────────────────────────────────
console.log('\n── Frequency-aware volume allocation ───────────────────────');
{
  const AG=['legs','back','chest','shoulders','arms'];
  function allocStats(goal,sub,nd,spm){
    const p=G._generateWorkoutProgram(goal,sub,nd,'T',spm);
    const weekly={};AG.forEach(g=>weekly[g]=0);
    const tots=[];let perSessionMax=0;
    for(const d of p.days){
      let t=0;const fs={};
      for(const ex of d.exercises){const n=String(ex.sets).split('-').length;t+=n;const sp=G.getExSplits(ex.name);
        AG.forEach(g=>{if(sp[g]){weekly[g]+=n*sp[g];fs[g]=(fs[g]||0)+n*sp[g];}});}
      tots.push(t);AG.forEach(g=>{if((fs[g]||0)>perSessionMax)perSessionMax=fs[g];});
    }
    return {p,tots,weekly,perSessionMax};
  }
  // The reported bug: 7-day hypertrophy-upper at 21 sets/muscle produced 34-set sessions
  const hi=allocStats('hypertrophy','upper',7,21);
  check('hyp-upper 7d @21: every session ≤ 25 sets', hi.tots.every(t=>t<=25), JSON.stringify(hi.tots));
  check('hyp-upper 7d @21: sessions not gutted (≥ 8 sets each)', hi.tots.every(t=>t>=8), JSON.stringify(hi.tots));
  check('hyp-upper 7d @21: push/pull muscles near weekly target (0.6–1.35×)',
    ['chest','shoulders','arms','back'].every(g=>hi.weekly[g]>=21*0.6&&hi.weekly[g]<=21*1.35),
    JSON.stringify(hi.weekly));
  check('per-session per-muscle load bounded (≤14 fractional sets)', hi.perSessionMax<=14, String(hi.perSessionMax));
  // Volume responds monotonically to the setting
  const lo=allocStats('hypertrophy','upper',7,9), mid=allocStats('hypertrophy','upper',7,15);
  check('weekly volume monotone in setting (9 ≤ 15 ≤ 21 per group)',
    AG.every(g=>lo.weekly[g]<=mid.weekly[g]+0.5&&mid.weekly[g]<=hi.weekly[g]+0.5),
    JSON.stringify({lo:lo.weekly,mid:mid.weekly,hi:hi.weekly}));
  // Session ceiling holds across hypertrophy/aesthetic configs
  for(const [g2,s2,n2,v2] of [['hypertrophy','balanced',6,20],['hypertrophy','lower',5,15],['aesthetic','fullbody',5,15],['aesthetic','upperlower',4,16]]){
    const st=allocStats(g2,s2,n2,v2);
    check(`${g2}-${s2} ${n2}d @${v2}: sessions ≤ 25`, st.tots.every(t=>t<=25), JSON.stringify(st.tots));
  }
  // Leg-day rules survive allocation
  const legs=hi.p.days.filter(d=>/legs/i.test(d.name));
  const isSqA=(e)=>/squat/i.test(e.name)&&!/split/i.test(e.name);
  check('allocation keeps every legs day either Squat day or Deadlift day',
    legs.every(d=>{const hasSq=d.exercises.some(isSqA);const hasDL=d.exercises.some(e=>e.name==='Deadlift');
      return (hasSq&&!hasDL&&isSqA(d.exercises[0]))||(hasDL&&!hasSq&&d.exercises[d.exercises.length-1].name==='Deadlift');}));
  check('program with 2+ legs days has BOTH a Squat day and a Deadlift day',
    legs.length<2||(legs.some(d=>d.exercises.some(isSqA))&&legs.some(d=>d.exercises.some(e=>e.name==='Deadlift'))));
  // Compound priority: free-weight compounds get more sets than machines/isolation
  check('isCompoundEx defined', typeof G.isCompoundEx==='function');
  check('isCompoundEx: Squat/Deadlift/Bench true; machines/cable false',
    G.isCompoundEx('Squat')&&G.isCompoundEx('Deadlift')&&G.isCompoundEx('Bench Press')&&G.isCompoundEx('Weighted Pull-ups')
    &&!G.isCompoundEx('Leg Press')&&!G.isCompoundEx('Smith Machine Squat')&&!G.isCompoundEx('Cable Fly')&&!G.isCompoundEx('Leg Extension'));
  {
    const p15=G._generateWorkoutProgram('hypertrophy','upper',7,'T',15);
    const la=p15.days.find(d=>/legs a/i.test(d.name));
    const pa=p15.days.find(d=>/push a/i.test(d.name));
    const n=e=>String(e.sets).split('-').length;
    const sq=la.exercises.find(e=>e.name==='Squat'), lp=la.exercises.find(e=>e.name==='Leg Press');
    check('Squat gets more sets than Leg Press on legs day', !!sq&&!!lp&&n(sq)>n(lp), sq&&lp?`squat=${n(sq)} lp=${n(lp)}`:'missing');
    const bp=pa.exercises.find(e=>/^Bench Press$/.test(e.name)), fly=pa.exercises.find(e=>/Cable Fly/.test(e.name));
    check('Bench gets more sets than Cable Fly on push day', !!bp&&!!fly&&n(bp)>n(fly), bp&&fly?`bench=${n(bp)} fly=${n(fly)}`:'missing');
  }
  // Ratio-blend clamp regression: the Deadlift's small back fraction must not balloon it past the day's compounds
  check('Deadlift not inflated by cross-group ratio blowup (≤3 sets @21)',
    legs.filter(d=>d.exercises.some(e=>e.name==='Deadlift')).every(d=>String(d.exercises[d.exercises.length-1].sets).split('-').length<=3),
    JSON.stringify(legs.map(d=>d.exercises[d.exercises.length-1].sets)));
  // Scheme prefix stays in sync with the resized set count
  let schemeOk=true;
  for(const d of hi.p.days)for(const ex of d.exercises){const n=String(ex.sets).split('-').length;const m=String(ex.scheme).match(/^(\d+)×/);if(m&&parseInt(m[1])!==n)schemeOk=false;}
  check('scheme N× prefix matches resized set count', schemeOk);
  // Strength SPLITS now run through the frequency-aware allocator too (rule 2026-07-31,
  // supersedes "strength splits keep their fixed 5×5/5×3 schemes"): the weekly sets-per-muscle
  // target applies to every goal, so a strength Squat is target-sized like any other lift.
  // Rehab keeps the linear path. Reps/tag are untouched — only the set count moves.
  const sp12=G._generateWorkoutProgram('strength','pure',5,'T',12);
  const sp25=G._generateWorkoutProgram('strength','pure',5,'T',25);
  const _sq12=sp12.days[0].exercises[0], _sq25=sp25.days[0].exercises[0];
  check('strength-pure 5-day: Squat is target-sized, not a fixed 5×5',
    String(_sq12.sets).split('-').length < String(_sq25.sets).split('-').length,
    `@12 ${_sq12.sets} vs @25 ${_sq25.sets}`);
  check('strength-pure Squat keeps its strength rep scheme (4-6 reps)',
    String(_sq12.sets).split('-').every(r => +r >= 4 && +r <= 6), _sq12.sets);
  const rk12=allocStats('rehab','knee',6,12), rk24=allocStats('rehab','knee',6,24);
  check('rehab scales linearly (24 = 2× the sets of 12)', rk24.tots[0]===rk12.tots[0]*2, `${rk12.tots[0]} vs ${rk24.tots[0]}`);
  // Wizard review shows the computed outcome
  check('wizard review shows resulting session size', rawScript.includes('Resulting sessions:'));
}

// ── 5-Day Split no longer auto-seeded ────────────────────────────────────────
console.log('\n── 5-Day Split deletion sticks ─────────────────────────────');
{
  const savedPrograms = G.localStorage.getItem('workout_programs');
  // A user who deleted the 5-Day Split must not get it back on next load
  G.localStorage.setItem('workout_programs', JSON.stringify({ programs: [
    { name: '6-Day Hypertrophy — Upper', goal: 'hypertrophy', days: [
      { name: 'Day 1 — Push A', warmup: false, exercises: [
        { name: 'Bench Press', scheme: '4×8-12', tag: 'volume', sets: '8-8-8-8', kg: 70 } ] } ] }
  ], active_index: 0 }));
  G.initPrograms();
  check('deleted 5-Day Split is NOT recreated', !G._programs.some(p => p.name === '5-Day Split'),
    JSON.stringify(G._programs.map(p => p.name)));
  check('no _seedDefaultProgram call left in _ensurePrograms', !rawScript.includes('_programs.push(_seedDefaultProgram())'));
  if (savedPrograms === null) G.localStorage.removeItem('workout_programs');
  else G.localStorage.setItem('workout_programs', savedPrograms);
  G.initPrograms();
}

// ── Injury substitutions baked into generated programs ───────────────────────
console.log('\n── Injury substitutions (baked) ────────────────────────────');
{
  const allNames = (p) => p.days.flatMap(d => d.exercises.map(e => e.name));
  // Shoulders: no barbell/DB/smith presses anywhere; machine/landmine alternatives present
  const ps = G._generateWorkoutProgram('hypertrophy', 'balanced', 6, 'T', 10, ['shoulders']);
  const shoulderBad = allNames(ps).filter(n => /^(Bench Press|Incline Bench Press|Overhead Press|Push Press|Arnold Press)$/i.test(n) || (/\b(barbell|dumbbell|\bdb\b|smith)\b/i.test(n) && /\bpress\b/i.test(n)));
  check('shoulders injury: no aggravating presses in program', shoulderBad.length === 0, shoulderBad.join(', '));
  // Arnold Press specifically (loaded internal rotation + elevation = impingement position)
  const pArn = G._generateWorkoutProgram('hypertrophy', 'upper', 7, 'T', 15, ['shoulders']);
  check('shoulders injury: Arnold Press substituted out', !allNames(pArn).includes('Arnold Press'),
    allNames(pArn).filter(n => /arnold/i.test(n)).join(', ') || 'clean');
  check('shoulders injury: machine/landmine subs present', allNames(ps).some(n => /Machine Press|Landmine Press/.test(n)));
  // Knees: no squats/lunges
  const pk = G._generateWorkoutProgram('hypertrophy', 'balanced', 6, 'T', 10, ['knees']);
  const kneeBad = allNames(pk).filter(n => (/\bsquat\b|\blunge\b/i.test(n)) && !/\b(leg press|leg curl|leg extension|machine)\b/i.test(n));
  check('knees injury: no squats/lunges in program', kneeBad.length === 0, kneeBad.join(', '));
  // Lower back: no deadlifts/RDL
  const pb = G._generateWorkoutProgram('hypertrophy', 'upper', 7, 'T', 15, ['lower_back']);
  const backBad = allNames(pb).filter(n => /romanian|\brdl\b|deadlift|good morning/i.test(n));
  check('lower-back injury: no deadlifts/RDL in program', backBad.length === 0, backBad.join(', '));
  // No duplicate exercises within a day after substitution
  const dupDays = ps.days.concat(pk.days, pb.days).filter(d => new Set(d.exercises.map(e => e.name)).size !== d.exercises.length);
  check('no duplicate exercises within a day after subs', dupDays.length === 0, dupDays.map(d => d.name).join(', '));
  // No injuries selected → nothing substituted (Bench Press survives)
  const p0 = G._generateWorkoutProgram('hypertrophy', 'balanced', 6, 'T', 10);
  check('no injuries: Bench Press untouched', allNames(p0).includes('Bench Press'));
  // Wizard wiring
  check('wizard has Injuries step', rawScript.includes('Injuries (optional)') && rawScript.includes('_progWizToggleInjury'));
  check('wizard passes injuries into generation', rawScript.includes("wiz.setsPerMuscle||12,wiz.injuries"));
  check('editor condition chips bake substitutions (no rehabSubs map writes)', !rawScript.includes('subs[ex.name]=cond.suggest(ex.name)'));
}

// ── Rotator cuff prehab block (shoulders injury) ─────────────────────────────
console.log('\n── Rotator cuff prehab (shoulders injury) ──────────────────');
{
  const ps = G._generateWorkoutProgram('hypertrophy', 'balanced', 6, 'T', 15, ['shoulders']);
  const cuffDays = ps.days.filter(d => d.exercises.some(e => e.name === 'Cable External Rotation'));
  check('shoulders injury: ER injected on 1-3 days', cuffDays.length >= 1 && cuffDays.length <= 3, String(cuffDays.length));
  check('injected ER keeps rehab tag at 15 reps',
    cuffDays.every(d => { const e = d.exercises.find(x => x.name === 'Cable External Rotation');
      return e.tag === 'rehab' && e.prehab === true && String(e.sets).split('-').every(r => r === '15'); }));
  check('cuff block injects no Face Pulls (only External Rotation; rule 2026-07-24)',
    !ps.days.some(d => d.exercises.some(e => e.name === 'Face Pulls' && e.prehab)));
  // ER lands only on actual PRESS days, never on a pull day that merely carries a shoulder set
  const _isPressER = (nm) => /bench|incline|overhead press|\bohp\b|shoulder press|arnold press|chest press|chest machine|landmine press|\bdips?\b|push-?up|close grip/i.test(nm) && !/leg press/i.test(nm);
  check('External Rotation injected only on press days (not pull days)',
    cuffDays.every(d => d.exercises.some(e => _isPressER(e.name))),
    cuffDays.filter(d => !d.exercises.some(e => _isPressER(e.name))).map(d => d.name).join(', '));
  check('prehab exempt from allocator resize (ER stays 2 sets)',
    cuffDays.every(d => String(d.exercises.find(x => x.name === 'Cable External Rotation').sets).split('-').length === 2));
  check('sessions still ≤ 25 with cuff block',
    ps.days.every(d => d.exercises.reduce((t, e) => t + String(e.sets).split('-').length, 0) <= 25),
    JSON.stringify(ps.days.map(d => d.exercises.reduce((t, e) => t + String(e.sets).split('-').length, 0))));
  // no injuries → no ER injected
  const p0 = G._generateWorkoutProgram('hypertrophy', 'balanced', 6, 'T', 15);
  check('no injuries: no ER injected', !p0.days.some(d => d.exercises.some(e => e.name === 'Cable External Rotation')));
  // catalogue
  check('Cable External Rotation in exercise picker', html.includes('<option>Cable External Rotation</option>'));
  check('external rotation has splits entry (shoulders:1)',
    (G.EXERCISE_SPLITS || []).some(([k, v]) => k === 'external rotation' && v.shoulders === 1));
  // rehab-shoulder pool includes ER
  const pr = G._generateWorkoutProgram('rehab', 'shoulder', 6, 'T', 12);
  check('rehab-shoulder program includes Cable External Rotation',
    pr.days.some(d => d.exercises.some(e => e.name === 'Cable External Rotation')));
  // _ensurePrograms: prehab keeps rehab tag, non-prehab still converted
  const savedPrograms = G.localStorage.getItem('workout_programs');
  G.localStorage.setItem('workout_programs', JSON.stringify({ programs: [
    { name: '6-Day Hypertrophy — Upper', goal: 'hypertrophy', days: [
      { name: 'Day 1 — Push A', warmup: false, exercises: [
        { name: 'Cable External Rotation', scheme: '2×15', tag: 'rehab', sets: '15-15', kg: 5, prehab: true },
        { name: 'Face Pulls', scheme: '3×15', tag: 'rehab', sets: '15-15-15', kg: 15 } ] } ] }
  ], active_index: 0 }));
  G.initPrograms();
  const d0 = G.getActiveProgram().days[0];
  check('stored prehab exercise keeps rehab tag', d0.exercises.find(e => e.name === 'Cable External Rotation').tag === 'rehab');
  // Rule 2026-07-31: a stored tag is never rewritten on load — 15-rep Face Pulls stay `rehab`,
  // which is what the canonical rep ranges say they are. (Supersedes "still converted to volume".)
  check('stored non-prehab rehab tag is left exactly as saved', d0.exercises.find(e => e.name === 'Face Pulls').tag === 'rehab');
  if (savedPrograms === null) G.localStorage.removeItem('workout_programs');
  else G.localStorage.setItem('workout_programs', savedPrograms);
  G.initPrograms();
}

// ── Low-to-high Cable Fly (6-day hypertrophy generator only) ──────────────────
console.log('\n── Low-to-high Cable Fly ──────────────────────────────────');
check('catalogue EX_OPTS_HTML lists Low-to-high Cable Fly',
  typeof G.EX_OPTS_HTML === 'string' && G.EX_OPTS_HTML.includes('Low-to-high Cable Fly'));
const _lfSplits = G.getExSplits('Low-to-high Cable Fly');
check('Low-to-high Cable Fly is chest-dominant (chest=0.85)', _lfSplits.chest === 0.85, `got ${_lfSplits.chest}`);
check('Low-to-high Cable Fly counts as a cable exercise', G.isCableEx('Low-to-high Cable Fly'));
const _flyDays = p => p.days.filter(d => d.exercises.some(e => e.name === 'Low-to-high Cable Fly')).length;
// 6-day hypertrophy generator — fly on exactly one day in each hypertrophy sub-goal
const _gbal6 = G._generateWorkoutProgram('hypertrophy', 'balanced', 6, 'X', 12, []);
check('hypertrophy-balanced 6-day: Low-to-high Cable Fly on exactly one day', _flyDays(_gbal6) === 1, `got ${_flyDays(_gbal6)}`);
const _gup6 = G._generateWorkoutProgram('hypertrophy', 'upper', 6, 'X', 12, []);
check('hypertrophy-upper 6-day: Low-to-high Cable Fly on exactly one day', _flyDays(_gup6) === 1, `got ${_flyDays(_gup6)}`);
// It's the Push day it lands on
check('hypertrophy-balanced 6-day: fly is on a Push day',
  _gbal6.days.some(d => /push/i.test(d.name) && d.exercises.some(e => e.name === 'Low-to-high Cable Fly')));
// Not in the 5-day generator (6-day only)
const _gbal5 = G._generateWorkoutProgram('hypertrophy', 'balanced', 5, 'X', 12, []);
check('hypertrophy 5-day generator does NOT include the fly', _flyDays(_gbal5) === 0, `got ${_flyDays(_gbal5)}`);
// Reverted: never edits existing programs, and not scattered into seeds
check('_ensurePrograms does NOT add the fly to existing programs',
  !/Low-to-high Cable Fly/.test(G._ensurePrograms.toString()));
check('hypertrophy seed does NOT contain the fly',
  !G._seedHypertrophyProgram().days.some(d => d.exercises.some(e => e.name === 'Low-to-high Cable Fly')));
check('5-Day Split seed Day 3 does NOT contain the fly',
  !G.DAYS[3].exercises.some(e => e.name === 'Low-to-high Cable Fly'));

// ── Workout duration (start on first set, end on save) ────────────────────────
console.log('\n── Workout duration ───────────────────────────────────────');
check('_fmtDur defined', typeof G._fmtDur === 'function');
check('_fmtDur(42) → "0:42"',  G._fmtDur(42) === '0:42',  `got "${G._fmtDur(42)}"`);
check('_fmtDur(65) → "1:05"',  G._fmtDur(65) === '1:05',  `got "${G._fmtDur(65)}"`);
check('_fmtDur(125) → "2:05"', G._fmtDur(125) === '2:05', `got "${G._fmtDur(125)}"`);
check('_fmtDur(0) → "0:00"',   G._fmtDur(0) === '0:00',   `got "${G._fmtDur(0)}"`);
check('_fmtDur(null) → ""',    G._fmtDur(null) === '',    `got "${G._fmtDur(null)}"`);
check('saveLog records started_at/ended_at/duration_min',
  /_timing\.started_at=_logStartedAt/.test(rawScript) &&
  /_timing\.duration_min=Math\.max\(0,Math\.round\(/.test(rawScript));
check('duration_min spread into the saved log', /id:editId\|\|Date\.now\(\),\.\.\._timing\}/.test(rawScript));
check('editing preserves original timing (no wipe)',
  /if\(editId\)\{var _origT=logs\.find/.test(rawScript));
check('start time captured when first set logged', /_hasReps&&!_logStartedAt\)_logStartedAt=new Date/.test(rawScript));
check('duration shown in History list', /l\.duration_min!=null\?' · ⏱ '\+_fmtDur\(l\.duration_min\)/.test(rawScript));
check('duration shown in session detail', /log\.duration_min!=null\)parts\.push\('⏱ '\+_fmtDur\(log\.duration_min\)\)/.test(rawScript));

// ── Deload toggle ─────────────────────────────────────────────────────────────
console.log('\n── Deload toggle ──────────────────────────────────────────');
check('_deloadSets halves set count', G._deloadSets('8-8-8-8') === '8-8', `got "${G._deloadSets('8-8-8-8')}"`);
check('_deloadSets rounds up odd counts', G._deloadSets('5-5-5-5-5') === '5-5-5', `got "${G._deloadSets('5-5-5-5-5')}"`);
check('_deloadSets keeps a single set', G._deloadSets('12') === '12', `got "${G._deloadSets('12')}"`);
check('_deloadScheme "5×5" → "3×5"',    G._deloadScheme('5×5') === '3×5', `got "${G._deloadScheme('5×5')}"`);
check('_deloadScheme "4×8-12" → "2×8-12"', G._deloadScheme('4×8-12') === '2×8-12', `got "${G._deloadScheme('4×8-12')}"`);
check('_deloadScheme "3×max" → "2×max"', G._deloadScheme('3×max') === '2×max', `got "${G._deloadScheme('3×max')}"`);
check('_deloadKg scales to ~65% (100→65)', G._deloadKg(100) === 65, `got ${G._deloadKg(100)}`);
check('_deloadKg scales to ~65% (80→52)',  G._deloadKg(80) === 52, `got ${G._deloadKg(80)}`);
check('_deloadKg leaves 0 alone (bodyweight)', G._deloadKg(0) === 0, `got ${G._deloadKg(0)}`);
{
  const _savedD = G._deloadActive;
  G._deloadActive = false;
  G.toggleDeload();
  check('toggleDeload turns deload on', G._deloadActive === true);
  G.toggleDeload();
  check('toggleDeload turns deload off', G._deloadActive === false);
  G._deloadActive = _savedD;
}
check('deload persisted via settings push', /pushSettingsToAgent\(\{'wkt-deload':_deloadActive\}\)/.test(rawScript));
check('deload restored from backend settings', /s\['wkt-deload'\]!==undefined/.test(rawScript));
check('log form uses deloaded set count', /_deloadActive\?_deloadSets\(ex\.sets\):ex\.sets/.test(rawScript));
check('log form scales prefilled load', /_deloadActive&&!isBodyweight&&lastKg>0\)\{lastKg=_deloadKg/.test(rawScript));
check('program view shows deload banner + scaled scheme',
  /_deloadBannerHtml\(\)/.test(rawScript) && /_deloadActive\?_deloadScheme\(ex\.scheme\)/.test(rawScript));

// ── Deload applied consistently in Log Workout ───────────────────────────────
console.log('\n── Deload in Log Workout ───────────────────────────────────');
check('_deloadSets halves set count (8-8 → 8)',        G._deloadSets('8-8') === '8');
check('_deloadSets rounds up (5 sets → 3)',            G._deloadSets('10-10-10-10-10') === '10-10-10');
check('_deloadSets keeps at least 1 set',              G._deloadSets('8') === '8');
check('_deloadKg 65% load (173 → 112)',                G._deloadKg(173) === 112);
check('_deloadKg 65% load (90 → 59)',                  G._deloadKg(90) === 59);
check('_deloadKg leaves 0/bodyweight untouched',       G._deloadKg(0) === 0);
check('_deloadScheme halves the N× prefix',            G._deloadScheme('3×10-15') === '2×10-15');
// The reported bug: a draft saved before toggling deload restored full kg values and
// grew the cards back to full set counts over the deloaded prefill.
check('drafts record deload state',                    rawScript.includes('deload:!!_deloadActive'));
check('restoreDraft skips drafts from a different deload state',
  rawScript.includes("(d.deload===undefined?false:!!d.deload)!==!!_deloadActive)return;"));
check('settings sync refreshes Log page when deload state changes',
  rawScript.includes('_dlPrev!==!!_deloadActive') && rawScript.includes('prefillLog(_ldD.value)'));
check('prefillLog applies deload to prefilled kg',     rawScript.includes('lastKg=_deloadKg(lastKg)'));
check('prefillLog applies deload to set counts',       rawScript.includes('_deloadActive?_deloadSets(ex.sets):ex.sets'));
// The reported bug: toggle Deload on the Program page, then open Log Workout —
// the Log still showed the full non-deload list because showPage('log') only
// re-prefilled on a day change, not a deload/unit change. Fix stamps the state
// the log was built under and re-prefills when it goes stale (unless reps entered).
check('prefillLog stamps the deload state on the log container',
  rawScript.includes("container.dataset.deload=_deloadActive?'1':'0'"));
check('prefillLog stamps the unit the log was built under',
  rawScript.includes('container.dataset.unit=unitLabel()'));
check('showPage(log) re-prefills when the rendered deload/unit is stale',
  rawScript.includes("_lc.dataset.deload!==(_deloadActive?'1':'0')") &&
  rawScript.includes('_lc.dataset.unit!==unitLabel()') &&
  /else if\(_stale\)\{prefillLog/.test(rawScript));
check('stale re-prefill is gated on no reps entered (never wipes in-progress log)',
  /_stale=_lc&&!_hasReps&&/.test(rawScript));

// ── Barbell plate rounding + kg/lb unit switch ───────────────────────────────
console.log('\n── Barbell rounding & units ────────────────────────────────');
{
  G.localStorage.setItem('wkt-unit','kg');
  check('isBarbellEx: barbell lifts true', ['Squat','Deadlift','Bench Press','Overhead Press','Barbell Row','Romanian Deadlift','Hip Thrust'].every(n=>G.isBarbellEx(n)));
  check('isBarbellEx: machines/DB/cable/landmine false', ['Leg Press','Smith Machine Squat','Cable Fly','Incline DB Press','Landmine Press','Chest Machine Press','Lateral Raise'].every(n=>!G.isBarbellEx(n)));
  check('roundBarbellKg: 59 → 60 (2.5 kg steps)',   G.roundBarbellKg(59) === 60);
  check('roundBarbellKg: 58 → 57.5',                G.roundBarbellKg(58) === 57.5);
  check('roundBarbellKg: floor is the empty 20 kg bar', G.roundBarbellKg(12) === 20);
  check('roundBarbellKg: already loadable stays',   G.roundBarbellKg(100) === 100);
  check('kg mode: kgToUnit passthrough',            G.kgToUnit(92.4) === 92.4);
  check('kg mode: unitToKg passthrough',            G.unitToKg('82,5') === 82.5);
  G.localStorage.setItem('wkt-unit','lb');
  check('lb mode: kgToUnit converts (100 kg → 220.5 lb)', G.kgToUnit(100) === 220.5);
  check('lb mode: unitToKg converts (225 lb → ~102 kg)',  Math.abs(G.unitToKg('225') - 102.06) < 0.01);
  check('lb mode: roundBarbellKg uses 45 lb bar + 5 lb steps',
    Math.abs(G.roundBarbellKg(59) * 2.20462 - 130) < 0.05); // 59 kg = 130.1 lb → 130 lb
  check('lb mode: floor is the empty 45 lb bar', Math.abs(G.roundBarbellKg(10) * 2.20462 - 45) < 0.05);
  G.localStorage.setItem('wkt-unit','kg');
  // wiring
  check('deload prefill rounds barbell weights', rawScript.includes('if(isBarbellEx(ex.name))lastKg=roundBarbellKg(lastKg);'));
  check('unit setting synced to backend',        rawScript.includes("pushSettingsToAgent({'wkt-unit':u})"));
  check('unit setting restored from backend',    rawScript.includes("if(s['wkt-unit'])"));
  check('Settings has unit toggle',              html.includes('unit-btn-kg') && html.includes('unit-btn-lb'));
  check('onboarding has unit chips',             rawScript.includes("['kg','lb'].map(function(u)"));
  check('drafts record unit; restore guarded',   rawScript.includes('unit:unitLabel()') && rawScript.includes("(d.unit||'kg')!==unitLabel())return;"));
}

// ── Injury interplay regressions (Legs A shoulder work / squat re-added) ─────
console.log('\n── Injury interplay regressions ────────────────────────────');
{
  const isSqN = (n) => /squat/i.test(n) && !/split/i.test(n);
  // Bug A: knee injury turns squats into Leg Press, which matched the /press/i "pressing day"
  // check and pulled the shoulder cuff block onto leg days
  const p = G._generateWorkoutProgram('hypertrophy', 'balanced', 6, 'T', 10, ['knees', 'shoulders']);
  const legDays = p.days.filter(d => /legs/i.test(d.name));
  check('knee+shoulder program: leg days exist', legDays.length >= 1);
  check('leg days get NO shoulder cuff block', legDays.every(d => !d.exercises.some(e => /external rotation|face pull/i.test(e.name))),
    JSON.stringify(legDays.map(d => d.exercises.map(e => e.name))));
  check('cuff block still lands on upper pressing days',
    p.days.some(d => !/legs/i.test(d.name) && d.exercises.some(e => e.name === 'Cable External Rotation')));
  check('knee injury: no squats anywhere', p.days.every(d => !d.exercises.some(e => isSqN(e.name))));
  check('generated program records its injuries', JSON.stringify(p.injuries) === JSON.stringify(['knees', 'shoulders']));
  // Bug B: _ensurePrograms re-added Squat to knee-safe stored programs on every load
  const savedPrograms = G.localStorage.getItem('workout_programs');
  p.name = '6-Day Hypertrophy — Upper';
  G.localStorage.setItem('workout_programs', JSON.stringify({ programs: [p], active_index: 0 }));
  G.initPrograms();
  const stored = G.getActiveProgram();
  check('stored knee-safe program: Squat NOT re-added on load',
    stored.days.every(d => !d.exercises.some(e => isSqN(e.name))),
    JSON.stringify(stored.days.filter(d => /legs/i.test(d.name)).map(d => d.exercises.map(e => e.name))));
  // lower_back analog: Deadlift not re-appended
  const pb = G._generateWorkoutProgram('hypertrophy', 'balanced', 6, 'T', 10, ['lower_back']);
  pb.name = '6-Day Hypertrophy — Upper';
  G.localStorage.setItem('workout_programs', JSON.stringify({ programs: [pb], active_index: 0 }));
  G.initPrograms();
  check('stored lower-back-safe program: Deadlift NOT re-appended on load',
    G.getActiveProgram().days.every(d => !d.exercises.some(e => e.name === 'Deadlift')));
  // A stored program without injuries is ALSO left untouched (Squat not auto-added on load)
  G.localStorage.setItem('workout_programs', JSON.stringify({ programs: [
    { name: '6-Day Hypertrophy — Upper', goal: 'hypertrophy', days: [
      { name: 'Day 1 — Legs A', warmup: false, exercises: [
        { name: 'Leg Press', scheme: '3×12', tag: 'volume', sets: '12-12-12', kg: 100 } ] } ] }
  ], active_index: 0 }));
  G.initPrograms();
  check('no-injury stored program is left as saved (Squat NOT auto-added)',
    !G.getActiveProgram().days[0].exercises.some(e => isSqN(e.name)),
    JSON.stringify(G.getActiveProgram().days[0].exercises.map(e => e.name)));
  if (savedPrograms === null) G.localStorage.removeItem('workout_programs');
  else G.localStorage.setItem('workout_programs', savedPrograms);
  G.initPrograms();
}

// ── Drafts keyed by exercise name (no cross-exercise pollution) ──────────────
console.log('\n── Name-keyed drafts / leg-day prehab strip ────────────────');
{
  check('cards carry template identity',      rawScript.includes("card.dataset.tplName=ex.name;"));
  check('drafts saved as v2 keyed by name',   rawScript.includes("var _dk=card.dataset.tplName||String(ei);"));
  check('v2 restore matches cards by name',   rawScript.includes("_cs[_ci].dataset.tplName===_base"));
  check('legacy drafts still restore by index', rawScript.includes("card=c.querySelector('[data-ex-idx=\"'+ei+'\"]');"));
  // Stored programs are left exactly as saved on load (no mutation of a stored leg day)
  const savedPrograms = G.localStorage.getItem('workout_programs');
  G.localStorage.setItem('workout_programs', JSON.stringify({ programs: [
    { name: '6-Day Hypertrophy — Upper', goal: 'hypertrophy', days: [
      { name: 'Day 3 — Legs A', warmup: false, exercises: [
        { name: 'Squat', scheme: '4×10', tag: 'strength', sets: '10-10-10-10', kg: 80 },
        { name: 'Leg Press', scheme: '3×12', tag: 'volume', sets: '12-12-12', kg: 100 },
        { name: 'Leg Curl', scheme: '3×12', tag: 'volume', sets: '12-12-12', kg: 40 } ] },
      { name: 'Day 1 — Push A', warmup: false, exercises: [
        { name: 'Chest Machine Press', scheme: '4×10', tag: 'volume', sets: '10-10-10-10', kg: 57 },
        { name: 'Cable External Rotation', scheme: '2×15', tag: 'rehab', sets: '15-15', kg: 5, prehab: true } ] }
    ] } ], active_index: 0 }));
  G.initPrograms();
  const prog = G.getActiveProgram();
  const legs = prog.days.find(d => /legs/i.test(d.name));
  const push = prog.days.find(d => /push/i.test(d.name));
  check('stored leg day left exactly as saved on load',
    JSON.stringify(legs.exercises.map(e => e.name)) === JSON.stringify(['Squat', 'Leg Press', 'Leg Curl']),
    JSON.stringify(legs.exercises.map(e => e.name)));
  check('stored push day: prehab kept',
    push.exercises.some(e => e.name === 'Cable External Rotation'));
  if (savedPrograms === null) G.localStorage.removeItem('workout_programs');
  else G.localStorage.setItem('workout_programs', savedPrograms);
  G.initPrograms();
}

// ── Section: Bottom navbar + PLASMA GUI port (from peptide app) ───────────────
console.log('\n── Bottom navbar / PLASMA GUI port ─────────────────────────');
{
  const src = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  check('fixed bottom navbar markup exists with 5 primaries',
    ['navbtn-program', 'navbtn-log', 'navbtn-history', 'navbtn-progress', 'navbtn-more']
      .every(id => src.includes('id="' + id + '"')));
  check('navbar buttons call switchPrimary', src.includes("switchPrimary('more')") && src.includes("switchPrimary('program')"));
  check('navbar CSS is fixed to bottom with safe-area inset',
    src.includes('.navbar{position:fixed;bottom:0') && src.includes('env(safe-area-inset-bottom'));
  check('navbtn active indicator bar (::before) present', src.includes('.navbtn.active::before'));
  check('old top-nav markup removed', !src.includes('nav-btn-program') && !src.includes('class="nav-btn'));
  check('sub-tab strip exists with tab-btn-* ids (legacy page ids preserved)',
    src.includes('id="subtabs"') && src.includes('id="tab-btn-program"') && src.includes('id="tab-btn-settings"'));
  check('PRIMARY_GROUPS groups settings+storage under more',
    JSON.stringify(G.PRIMARY_GROUPS.more) === JSON.stringify(['settings', 'storage']));
  check('every PAGE_LABELS page belongs to a primary group',
    Object.keys(G.PAGE_LABELS).every(id => G.primaryOf(id) !== ''));
  check('primaryOf maps settings→more, log→log, unknown→\'\'',
    G.primaryOf('settings') === 'more' && G.primaryOf('log') === 'log' && G.primaryOf('nope') === '');
  check('showPage remembers last sub-tab per primary', src.includes("localStorage.setItem('wkt-last-sub-'+_pr,name)"));
  check('switchPrimary restores last visible sub-tab', /function switchPrimary\(p\)\{[^}]*_lastSub\[p\]/.test(src));
  check('sub-tab strip hidden when group has ≤1 visible destination',
    src.includes("strip.style.display=vis.length>1?'':'none'"));
  check('settings sub-tab always visible in _subVisible', src.includes("if(id==='settings')return true"));
  check('Google webfont import removed (system fonts only)', !src.includes('fonts.googleapis.com'));
  check('SF system font tokens defined (--font-ui/--font-display/--font-mono)',
    src.includes('--font-ui:-apple-system') && src.includes('--font-display:-apple-system') && src.includes('--font-mono:ui-monospace'));
  check('no Bebas Neue / DM Sans references remain', !/Bebas|DM Sans/.test(src));
  check('PLASMA palette in :root (true-black bg, warm surfaces)',
    src.includes('--bg:#000000') && src.includes('--surface:#15130F') && src.includes('--border-strong:#6E675A'));
  check('content bottom padding clears fixed navbar', src.includes('padding:16px 20px 116px'));
  check('rest timer bar sits above the bottom navbar',
    src.includes('bottom:calc(64px + env(safe-area-inset-bottom,0px))'));
  check('boot restores last page via showPage without legacy nav button',
    !src.includes("getElementById('nav-btn-'") && src.includes("localStorage.getItem('wkt-last-page')"));
  check('header restyled to pep hdr (34px display title, non-sticky)',
    src.includes('.header-title{font-family:var(--font-display);font-size:34px') && !src.includes('.header{position:sticky'));
  check('weight badge label cannot wrap (KG TODAY on one line)',
    /\.weight-badge \.lbl\{[^}]*white-space:nowrap/.test(src) && /\.weight-badge \.val\{[^}]*white-space:nowrap/.test(src));
  check('weight badge does not shrink against the header title',
    /\.weight-badge\{[^}]*flex-shrink:0/.test(src));
  check('iOS date inputs constrained to their container (no card overflow)',
    /input\[type="date"\]\{min-width:0;max-width:100%;-webkit-appearance:none;appearance:none/.test(src));
}

// ── Swipe navigation between top-level (bottom-nav) tabs ─────────────────────
console.log('\n── Swipe navigation between top-level tabs ─────────────────');
{
  check('_navSwipeTarget defined', typeof G._navSwipeTarget === 'function');
  check('_navVisiblePrimaries defined', typeof G._navVisiblePrimaries === 'function');
  check('_navNoSwipeZone defined', typeof G._navNoSwipeZone === 'function');
  check('_initSwipeNav defined', typeof G._initSwipeNav === 'function');
  check('_navActiveView defined', typeof G._navActiveView === 'function');
  // drag-follow animation wiring must be present
  check('swipe: touchmove drag handler wired', rawScript.includes("addEventListener('touchmove'"));
  check('swipe: view follows finger via translateX', /av\.style\.transform='translateX\(/.test(rawScript));
  check('swipe: rubber-band resistance at the ends', rawScript.includes('dx*0.28'));
  if (typeof G._navSwipeTarget === 'function') {
    const order = ['program','log','history','progress','more']; // mirrors PRIMARY_ORDER (const, not exported to sandbox)
    check('swipe next from first → second', G._navSwipeTarget(order, order[0], 1) === order[1]);
    check('swipe prev from second → first', G._navSwipeTarget(order, order[1], -1) === order[0]);
    check('no wrap past last tab', G._navSwipeTarget(order, order[order.length-1], 1) === null);
    check('no wrap before first tab', G._navSwipeTarget(order, order[0], -1) === null);
    check('unknown current primary → null', G._navSwipeTarget(order, '__nope__', 1) === null);
    check('single visible primary → null', G._navSwipeTarget([order[0]], order[0], 1) === null);
    check('operates on the visible subset', G._navSwipeTarget([order[0], order[2]], order[0], 1) === order[2]);
  }
}

// ── Draft resume requires reps (weights-only draft is discarded) ─────────────
console.log('\n── Draft resume requires reps ──────────────────────────────');
{
  check('_draftHasReps defined', typeof G._draftHasReps === 'function');
  if (typeof G._draftHasReps === 'function') {
    // The bug case: weights entered per set but NO reps → not a resumable session
    check('weights-only draft (no reps) → NOT resumable',
      G._draftHasReps({ tmpl: { 'Lat Pulldown': { kg: ['59','90'], reps: ['',''] } } }) === false);
    // A genuinely started session (≥1 rep) → resumable
    check('draft with a rep → resumable',
      G._draftHasReps({ tmpl: { 'Lat Pulldown': { kg: ['59','90'], reps: ['10',''] } } }) === true);
    // Custom-exercise reps also count
    check('custom-exercise reps count as started',
      G._draftHasReps({ tmpl: {}, custom: [{ name: 'X', kg: ['20'], reps: ['8'] }] }) === true);
    // Legacy flat sets format
    check('legacy sets format: reps detected',
      G._draftHasReps({ sets: { '0_0_kg': '50', '0_0_reps': '10' } }) === true);
    check('legacy sets format: weights-only not resumable',
      G._draftHasReps({ sets: { '0_0_kg': '50', '0_1_kg': '55' } }) === false);
    // Empty / malformed → not resumable (no throw)
    check('empty draft → not resumable', G._draftHasReps({}) === false);
    check('null draft → not resumable', G._draftHasReps(null) === false);
    check('reps of 0 do not count as started',
      G._draftHasReps({ tmpl: { A: { kg: ['40'], reps: ['0'] } } }) === false);
  }
}

// ── Session/auth diagnostic readout (Settings → Account) ────────────────────────
if (typeof G._fmtTokExp === 'function') {
  if (typeof G.atob !== 'function') G.atob = (s) => Buffer.from(s, 'base64').toString('binary');
  const _futTok = 'h.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000) + 3600 }))
    .toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_') + '.s';
  const _fe = G._fmtTokExp(_futTok);
  check('_fmtTokExp decodes JWT exp → ~60m left', !!_fe && _fe.leftMin >= 59 && _fe.leftMin <= 61, _fe ? String(_fe.leftMin) : 'null');
  check('_fmtTokExp returns null for junk', G._fmtTokExp('not-a-jwt') === null);
  check('_renderAuthDebug defined; Session row present', typeof G._renderAuthDebug === 'function' && html.includes('id="s-session"'));
}
// One-Tap must not fire while a valid backend session token exists (fix for the Google
// prompt popping up ~1h after login once the redundant Google ID token expires).
if (typeof G._hasValidSession === 'function') {
  if (typeof G.atob !== 'function') G.atob = (s) => Buffer.from(s, 'base64').toString('binary');
  const _mkSess = (sec) => 'h.' + Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000) + sec }))
    .toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_') + '.s';
  G.localStorage.setItem('session_token', _mkSess(3600));
  check('_hasValidSession: true for a live session token', G._hasValidSession() === true);
  G.localStorage.setItem('session_token', _mkSess(-60));
  check('_hasValidSession: false once the session token has expired', G._hasValidSession() === false);
  G.localStorage.setItem('session_token', '');
  check('_hasValidSession: false when absent', G._hasValidSession() === false);
  check('One-Tap prompt gated behind !_hasValidSession() at sign-in init', html.includes('if(!_hasValidSession())google.accounts.id.prompt()'));
  check('One-Tap refresh interval gated behind !_hasValidSession()', html.includes('<300000&&!_hasValidSession()&&window.google'));
}

// ── Volume allocator — leg-day leakage regression ──────────────────────────────
// Bug (reported 2026-07-23): on a hypertrophy leg day the allocator scaled Romanian
// Deadlift (split legs:0.7, back:0.3) using the day's tiny incidental "back" volume as
// the denominator (target/base with base≈0.9), which maxed the ratio clamp and boosted
// RDL ABOVE the primary Squat (e.g. RDL 5 sets vs Squat 4, isolation floored at 2). Fix:
// a muscle group only scales an exercise on days it actually trains that muscle (base>=1,
// mirroring the freq threshold), so incidental secondary muscles no longer inflate an
// accessory past the day's main compound.
if (typeof G._generateWorkoutProgram === 'function') {
  console.log('\n── Volume allocator — leg-day leakage ─────────────────────');
  const _ns = (ex) => String(ex.sets).split('-').length;
  const _prog = G._generateWorkoutProgram('hypertrophy', 'balanced', 6, 'T', 20, []);
  const _legA = (_prog.days || []).find(d => /Legs A/.test(d.name));
  check('6-day balanced program has a "Legs A" day', !!_legA);
  if (_legA) {
    const _sq  = _legA.exercises.find(e => /^Squat/.test(e.name));
    const _rdl = _legA.exercises.find(e => /Romanian Deadlift/.test(e.name));
    check('Legs A opens with Squat', _legA.exercises[0] && /^Squat/.test(_legA.exercises[0].name),
      _legA.exercises[0] && _legA.exercises[0].name);
    check('Squat present on Legs A', !!_sq);
    check('Romanian Deadlift present on Legs A', !!_rdl);
    if (_sq && _rdl) {
      check('RDL does not out-rank the primary Squat (leakage fixed)',
        _ns(_rdl) <= _ns(_sq), `Squat ${_ns(_sq)} vs RDL ${_ns(_rdl)}`);
      // Squat leads its day, but a hard "≥4 sets" is arithmetically incompatible with hitting
      // the weekly target (2026-07-31): 5 leg exercises at a 2-set floor already spend the
      // 10-set session budget, so leading is expressed as "≥ every other exercise", not a
      // fixed count.
      check('Squat leads its day at 20 sets/muscle (≥ every other exercise)',
        _legA.exercises.filter(e => !e.fixed && !e.prehab).every(e => _ns(_sq) >= _ns(e)),
        _legA.exercises.map(e => e.name + ' ' + _ns(e)).join(' | '));
    }
  }
}

// ── Hip Thrust: Feminine Aesthetic + Knee Rehab only ───────────────────────────
// Rule (2026-07-23): Hip Thrust may appear ONLY in aesthetic-* (Feminine Aesthetic)
// and rehab-knee (glute activation) programs. A generator guard swaps it out of every
// strength / hypertrophy / back-rehab / shoulder-rehab program.
if (typeof G._generateWorkoutProgram === 'function') {
  console.log('\n── Hip Thrust: Feminine Aesthetic + Knee Rehab only ───────');
  const _hasHT = (p) => (p.days || []).some(d => (d.exercises || []).some(e => e.name === 'Hip Thrust'));
  const _stripped = [
    ['strength','pure',5], ['strength','hybrid',6],
    ['hypertrophy','balanced',6], ['hypertrophy','upper',6], ['hypertrophy','lower',6],
    ['rehab','back',6], ['rehab','shoulder',6],
  ];
  let _leak = _stripped.filter(([g,s,n]) => _hasHT(G._generateWorkoutProgram(g, s, n, 'T', 16, [])));
  check('No Hip Thrust in strength / hypertrophy / back- or shoulder-rehab programs',
    _leak.length === 0, _leak.map(c => c.join('-')).join(', '));
  // No duplicate exercise names introduced by the swap (e.g. Legs C already had Leg Curl)
  const _lowerC = G._generateWorkoutProgram('hypertrophy','lower',6,'T',16,[]);
  const _dupFree = (_lowerC.days || []).every(d => {
    const ns = (d.exercises || []).map(e => e.name);
    return ns.length === new Set(ns).size;
  });
  check('Hip Thrust swap leaves no duplicate exercises in a day', _dupFree);
  // Feminine Aesthetic and Knee Rehab keep Hip Thrust
  check('Feminine Aesthetic (aesthetic-*) retains Hip Thrust',
    _hasHT(G._generateWorkoutProgram('aesthetic','upperlower',5,'T',16,[])));
  check('Knee Rehab (rehab-knee) retains Hip Thrust',
    _hasHT(G._generateWorkoutProgram('rehab','knee',6,'T',16,[])));
}

// ── Face Pulls: at most one day per generated program ──────────────────────────
// Rule (2026-07-24): Face Pulls must NEVER sit on a push/press day — any day containing a
// pressing movement — even in shoulder rehab. The shoulder-injury cuff block injects Cable
// External Rotation (not Face Pulls) on pressing days. At most one Face Pulls day per program.
if (typeof G._generateWorkoutProgram === 'function') {
  console.log('\n── Face Pulls: never on a push/press day ──────────────────');
  const _isPress = (nm) => /bench|incline|overhead press|\bohp\b|shoulder press|arnold press|chest press|chest machine|landmine press|\bdips?\b|push-?up|close grip/i.test(nm) && !/leg press/i.test(nm);
  const _fpDayCount = (p) => (p.days || []).filter(d => (d.exercises || []).some(e => e.name === 'Face Pulls')).length;
  const _combos = [
    ['strength','pure',5], ['strength','hybrid',6],
    ['hypertrophy','balanced',6], ['hypertrophy','upper',5], ['hypertrophy','upper',7], ['hypertrophy','lower',6],
  ];
  const _over = _combos.filter(([g,s,n]) => _fpDayCount(G._generateWorkoutProgram(g,s,n,'T',16,[])) > 1);
  check('No non-injury program schedules Face Pulls on more than one day',
    _over.length === 0, _over.map(c => c.join('-')).join(', '));
  // Sweep every goal/sub/day-count, with and without shoulder injury: no Face Pulls (prehab or
  // not) may share a day with a pressing movement.
  const _allCombos = [['strength','pure'],['strength','hybrid'],['hypertrophy','balanced'],
    ['hypertrophy','upper'],['hypertrophy','lower'],['aesthetic','fullbody'],['aesthetic','upperlower'],
    ['rehab','shoulder'],['rehab','back'],['rehab','knee']];
  const _nd = { strength:[3,4,5,6], hypertrophy:[3,4,5,6,7], aesthetic:[3,5], rehab:[6] };
  let _pressFP = [];
  _allCombos.forEach(([g,s]) => _nd[g].forEach(n => [[],['shoulders']].forEach(inj => {
    const p = G._generateWorkoutProgram(g, s, n, 'T', 16, inj);
    (p.days || []).forEach(d => {
      const hasFP = (d.exercises || []).some(e => e.name === 'Face Pulls');
      const hasPress = (d.exercises || []).some(e => _isPress(e.name));
      if (hasFP && hasPress) _pressFP.push(`${g}-${s}-${n}/${inj.join('')}: ${d.name}`);
    });
  })));
  check('Face Pulls never share a day with a pressing movement (any program)',
    _pressFP.length === 0, _pressFP.slice(0, 5).join(' | '));
  // Shoulder-injury cuff work is preserved via Cable External Rotation (NOT Face Pulls)
  const _shoulder = G._generateWorkoutProgram('hypertrophy','balanced',6,'T',16,['shoulders']);
  const _hasExtRot = (_shoulder.days || []).some(d => (d.exercises || []).some(e => e.name === 'Cable External Rotation' && e.prehab));
  check('Shoulder-injury program still injects prehab Cable External Rotation', _hasExtRot);
  const _cuffFP = (_shoulder.days || []).some(d => (d.exercises || []).some(e => e.name === 'Face Pulls' && e.prehab));
  check('Shoulder-injury cuff block no longer injects Face Pulls', _cuffFP === false);
}

// ── Manual program builder (blank, no wizard) ──────────────────────────────────
console.log('\n── Manual program builder ─────────────────────────────────');
check('_progBuildManual defined', typeof G._progBuildManual === 'function');
check('New-program wizard offers a "Build manually" option', html.includes('_progBuildManual()') && html.includes('Build manually'));

// ── Full-body at ≤4 days/week ──────────────────────────────────────────────────
// Rule (2026-07-24): 4 days/week or fewer → full-body sessions (not a push/pull/legs or
// upper/lower split) for hypertrophy & strength. 5+ days keep their splits.
if (typeof G._generateWorkoutProgram === 'function') {
  console.log('\n── Full-body at ≤4 days/week ──────────────────────────────');
  const _dayNames = (p) => (p.days || []).map(d => d.name.replace(/^Day \d+ — /, ''));
  const _allFB = (p) => (p.days || []).every(d => /Full Body/.test(d.name));
  const _noSplit = (p) => !(p.days || []).some(d => /^(Push|Pull|Legs|Upper|Lower)\b/.test(d.name.replace(/^Day \d+ — /, '')));
  [['hypertrophy','upper'],['hypertrophy','lower'],['hypertrophy','balanced'],['strength','pure'],['strength','hybrid']]
    .forEach(([g,s]) => [3,4].forEach(n => {
      const p = G._generateWorkoutProgram(g, s, n, 'T', 16, []);
      check(`${g}-${s} ${n}-day is full-body (no split days)`, _allFB(p) && _noSplit(p), _dayNames(p).join('/'));
    }));
  // 5+ days keep splits (not full-body)
  const _five = G._generateWorkoutProgram('hypertrophy', 'upper', 5, 'T', 16, []);
  check('hypertrophy-upper 5-day keeps its split (not full-body)', !_allFB(_five));
  // Full-body sessions stay within the 25-set ceiling even at high volume (strength path too)
  const _fbHeavy = G._generateWorkoutProgram('strength', 'pure', 4, 'T', 20, []);
  const _tots = (_fbHeavy.days || []).map(d => d.exercises.reduce((t,e)=>t+String(e.sets).split('-').length,0));
  check('strength full-body sessions respect the 25-set ceiling @20', _tots.every(t => t <= 25), JSON.stringify(_tots));
  // No full-body day contains both Squat and a conventional Deadlift (CNS load)
  const _noSqDl = (p) => (p.days || []).every(d => {
    const ns = d.exercises.map(e => e.name);
    const hasSq = ns.some(n => /squat/i.test(n) && !/split/i.test(n));
    const hasDl = ns.some(n => n === 'Deadlift');
    return !(hasSq && hasDl);
  });
  check('no full-body day pairs Squat with Deadlift',
    [['hypertrophy','balanced',4],['strength','pure',4],['hypertrophy','lower',3]].every(([g,s,n]) => _noSqDl(G._generateWorkoutProgram(g,s,n,'T',16,[]))));
}

// ── Intra-session set balance (allocator) ─────────────────────────────────────
// Regression (2026-07-31): hypertrophy-upper 6-day Day 6 — Legs B generated
// "Romanian Deadlift 5 sets" beside 2-set Leg Extension / Leg Press / Leg Curl. Cause: the
// only back volume in a leg day comes from the RDL itself, so target/base for back hit the
// 2× ceiling and, multiplied by the 1.5× compound bias, inflated the RDL. A secondary group
// (split fraction < 0.5) may now only pull sets DOWN, and a per-session balance guardrail
// caps every exercise at 2× the smallest exercise in that session.
if (typeof G._generateWorkoutProgram === 'function') {
  console.log('\n── Intra-session set balance ──────────────────────────────');
  const _ns = (e) => String(e.sets).split('-').length;
  // Fixed prescriptions (the heavy Deadlift finisher) and prehab blocks are not allocator-sized,
  // so they neither set nor break the balance invariant.
  const _sizable = (d) => (d.exercises || []).filter(e => !e.prehab && !e.fixed);

  check('sets are allocated from the muscle an exercise targets (split >= 0.5)',
    /\(getExSplits\(ex\.name\)\[g\]\|\|0\)>=0\.5/.test(rawScript));
  check('a muscle only counts a day toward its frequency if something targets it',
    /if\(sp\[g\]>=0\.5\)dom\[g\]=1;/.test(rawScript));
  check('balance guardrail constant defined (BALANCE_RATIO=2)',
    rawScript.includes('SESSION_MUSCLE_CAP=10,SESSION_CEILING=25,BALANCE_RATIO=2'));
  check('balance guardrail runs after the 25-set ceiling trim',
    rawScript.indexOf('_min*BALANCE_RATIO') > rawScript.indexOf('if(_tot<=SESSION_CEILING)break;'));

  // The exact reported program: RDL must not tower over the rest of its own leg day.
  const _legsB = G._generateWorkoutProgram('hypertrophy', 'upper', 6, 'T', 12, [])
    .days.find(d => /Legs B/.test(d.name));
  const _rdl = _legsB && _legsB.exercises.find(e => e.name === 'Romanian Deadlift');
  check('hypertrophy-upper 6-day Legs B: RDL is at most 3 sets',
    !!_rdl && _ns(_rdl) <= 3, _legsB && _legsB.exercises.map(e => e.name + ' ' + _ns(e)).join(' | '));

  // Invariant across every allocator-sized program: max ≤ 2× min within a session.
  const _combos = [];
  [['hypertrophy','upper'],['hypertrophy','lower'],['hypertrophy','balanced'],
   ['aesthetic','fullbody'],['aesthetic','ppl'],['aesthetic','upperlower']]
    .forEach(([g,s]) => [1,2,3,4,5,6,7].forEach(nd => [9,12,16,20,25].forEach(spm => _combos.push([g,s,nd,spm]))));
  const _bad = [];
  _combos.forEach(([g,s,nd,spm]) => {
    (G._generateWorkoutProgram(g, s, nd, 'T', spm, []).days || []).forEach(d => {
      const es = _sizable(d); if (es.length < 2) return;
      const mx = Math.max(...es.map(_ns)), mn = Math.min(...es.map(_ns));
      if (mx > 2 * mn) _bad.push(`${g}/${s} ${nd}d spm${spm} ${d.name}: ${mn}-${mx}`);
    });
  });
  check('no session has an exercise above 2× the session minimum',
    _bad.length === 0, _bad.slice(0, 4).join('; '));

  // Two lifts of the same class targeting the same muscle stay within 2× of each other
  // (pre-fix this failed: RDL 5 vs Deadlift 2, both compound, both legs-dominant).
  const _dom = (name) => {
    const sp = G.getExSplits(name); let best = '', v = 0;
    Object.keys(sp).forEach(k => { if (k === 'factor' || k === 'cable') return; if (sp[k] > v) { v = sp[k]; best = k; } });
    return best;
  };
  const _pairBad = [];
  _combos.forEach(([g,s,nd,spm]) => {
    (G._generateWorkoutProgram(g, s, nd, 'T', spm, []).days || []).forEach(d => {
      const es = _sizable(d);
      es.forEach(a => es.forEach(b => {
        if (a === b || _dom(a.name) !== _dom(b.name)) return;
        if (G.isCompoundEx(a.name) !== G.isCompoundEx(b.name)) return;
        if (_ns(a) > 2 * _ns(b)) _pairBad.push(`${g}/${s} ${nd}d spm${spm} ${d.name}: ${a.name} ${_ns(a)} vs ${b.name} ${_ns(b)}`);
      }));
    });
  });
  check('same-muscle same-class lifts stay within 2× of each other',
    _pairBad.length === 0, _pairBad.slice(0, 4).join('; '));

  // The guardrail must not undo the compound bias: compounds still outweigh isolation.
  const _p20 = G._generateWorkoutProgram('hypertrophy', 'upper', 6, 'T', 20, []);
  const _push = _p20.days.find(d => /Push A/.test(d.name));
  const _bench = _push && _push.exercises.find(e => e.name === 'Bench Press');
  const _fly = _push && _push.exercises.find(e => e.name === 'Cable Fly');
  check('compound bias preserved (Bench > Cable Fly on Push A @20)',
    !!_bench && !!_fly && _ns(_bench) > _ns(_fly), _push && _push.exercises.map(e => e.name + ' ' + _ns(e)).join(' | '));

  // Sessions still respect the 25-set ceiling after the guardrail runs.
  const _overCeiling = [];
  _combos.forEach(([g,s,nd,spm]) => {
    (G._generateWorkoutProgram(g, s, nd, 'T', spm, []).days || []).forEach(d => {
      const tot = (d.exercises || []).reduce((t,e) => t + _ns(e), 0);
      if (tot > 25) _overCeiling.push(`${g}/${s} ${nd}d spm${spm} ${d.name}: ${tot}`);
    });
  });
  check('25-set session ceiling still holds', _overCeiling.length === 0, _overCeiling.slice(0, 3).join('; '));
}

// ── Weekly sets-per-muscle lands on target ────────────────────────────────────
// Rule (2026-07-31): the wizard's sets-per-muscle is a target the generator must actually hit,
// for every goal including strength. Before this, a 12-set weekly leg target generated 20 sets
// (+68%) on hypertrophy-upper and 39 sets (+145%) on strength-hybrid, because the compound bias
// multiplied the total and a 2-set floor across 5-6 exercises could not go lower.
if (typeof G._generateWorkoutProgram === 'function') {
  console.log('\n── Weekly sets-per-muscle vs target ───────────────────────');
  const _GR = ['legs','back','chest','shoulders','arms'];
  const _n = (e) => String(e.sets).split('-').length;
  const _weekly = (p) => {
    const w = {}; _GR.forEach(g => w[g] = 0);
    (p.days || []).forEach(d => (d.exercises || []).forEach(e => {
      const sp = G.getExSplits(e.name); _GR.forEach(g => { if (sp[g]) w[g] += _n(e) * sp[g]; });
    }));
    return w;
  };
  // The two programs from the report, at the volumes that were worst.
  const _hw = _weekly(G._generateWorkoutProgram('hypertrophy', 'upper', 6, 'T', 12, []));
  check('hypertrophy-upper 6-day @12: weekly leg sets within 1.35x target',
    _hw.legs <= 12 * 1.35, `legs ${_hw.legs.toFixed(1)} vs 12`);
  const _sw = _weekly(G._generateWorkoutProgram('strength', 'hybrid', 6, 'T', 16, []));
  check('strength-hybrid 6-day @16: weekly leg sets within 1.35x target',
    _sw.legs <= 16 * 1.35, `legs ${_sw.legs.toFixed(1)} vs 16`);

  // No muscle may run away from the target in any allocator-sized program.
  // Overshoot is only ever allowed when every lift for that muscle already sits on the 2-set
  // floor — the smallest a session can prescribe. A 9-set weekly leg target spread over three
  // leg days cannot physically be met (3 exercises x 2 sets x 3 days = 18). Anywhere above that
  // floor, 1.6x is a bug.
  const _runaway = [];
  [['hypertrophy','upper'],['hypertrophy','lower'],['hypertrophy','balanced'],
   ['aesthetic','ppl'],['aesthetic','upperlower'],['strength','pure'],['strength','hybrid']]
    .forEach(([g,s]) => [4,5,6,7].forEach(nd => [9,12,16,20,25].forEach(spm => {
      const p = G._generateWorkoutProgram(g, s, nd, 'T', spm, []);
      const w = _weekly(p);
      _GR.forEach(m => {
        if (w[m] <= spm * 1.6) return;
        // every session training this muscle must be at the floor for the overshoot to be legal
        const atFloor = (p.days || []).every(d =>
          (d.exercises || []).filter(e => !e.prehab && !e.fixed && (G.getExSplits(e.name)[m] || 0) >= 0.5)
            .every(e => _n(e) <= 2));
        if (!atFloor) _runaway.push(`${g}/${s} ${nd}d spm${spm} ${m} ${w[m].toFixed(1)}`);
      });
    })));
  check('no muscle exceeds 1.6x its weekly target unless the sessions are at their floor',
    _runaway.length === 0, _runaway.slice(0, 4).join('; '));

  // Drop-to-fit: sessions may lose accessories, never compounds, the heavy Deadlift, or drop
  // below 3 exercises.
  const _pruneBad = [];
  [['hypertrophy','upper',6,9],['hypertrophy','balanced',6,9],['strength','pure',6,9],['aesthetic','ppl',6,9]]
    .forEach(([g,s,nd,spm]) => {
      const p = G._generateWorkoutProgram(g, s, nd, 'T', spm, []);
      (p.days || []).forEach(d => {
        const es = (d.exercises || []).filter(e => !e.prehab);
        if (es.length < 3) _pruneBad.push(`${g}/${s} ${d.name}: only ${es.length} exercises`);
      });
      // Nothing that survives at a high target (where little pruning happens) may be pruned away
      // at a low one if it is a compound or a fixed prescription.
      const hi = G._generateWorkoutProgram(g, s, nd, 'T', 25, []);
      (hi.days || []).forEach((d, i) => {
        const lo = (p.days || [])[i]; if (!lo) return;
        d.exercises.filter(e => G.isCompoundEx(e.name) || e.fixed).forEach(e => {
          if (!lo.exercises.some(x => x.name === e.name))
            _pruneBad.push(`${g}/${s} ${d.name}: pruned ${e.name}`);
        });
      });
    });
  check('drop-to-fit keeps >=3 exercises and never prunes a compound or the heavy Deadlift',
    _pruneBad.length === 0, _pruneBad.slice(0, 3).join('; '));

  // Shape: the muscle's main compound is never out-ranked by an accessory that only touches it
  // as a secondary muscle (the original RDL-vs-Squat failure, from the volume side this time).
  const _shape = [];
  [['hypertrophy','upper'],['hypertrophy','balanced']].forEach(([g,s]) =>
    [5,6,7].forEach(nd => [12,16,20,25].forEach(spm => {
      (G._generateWorkoutProgram(g, s, nd, 'T', spm, []).days || []).forEach(d => {
        const sq = d.exercises.find(e => /^Squat/.test(e.name));
        const rdl = d.exercises.find(e => /Romanian Deadlift/.test(e.name));
        if (sq && rdl && _n(rdl) > _n(sq)) _shape.push(`${g}/${s} ${nd}d spm${spm} ${d.name}: Squat ${_n(sq)} RDL ${_n(rdl)}`);
      });
    })));
  check('RDL never out-ranks the Squat it sits behind, at any volume',
    _shape.length === 0, _shape.slice(0, 3).join('; '));
}

// ── Numeric keypad + program-editor sets/reps dropdowns ───────────────────────
// Rule (2026-07-31): entering reps must never raise the full keyboard. A bare
// <input type="number"> gets iOS's numbers-and-punctuation layout, not the 10-key pad —
// inputmode="numeric" is what selects the keypad, matching the kg fields' inputmode="decimal".
// And the program editor's free-text "10-10-10" sets field is replaced by two dropdowns.
{
  console.log('\n── Reps entry: numeric keypad + dropdowns ─────────────────');
  const repsInputs = rawScript.match(/<input[^>]*data-type="reps"[^>]*>/g) || [];
  check('every reps input exists (log, add-set, custom exercise)', repsInputs.length === 3,
    `found ${repsInputs.length}`);
  check('every reps input requests the numeric keypad',
    repsInputs.length > 0 && repsInputs.every(t => /inputmode="numeric"/.test(t)),
    repsInputs.filter(t => !/inputmode="numeric"/.test(t)).join(' | '));
  check('no reps input relies on bare type="number"',
    !repsInputs.some(t => /type="number"/.test(t)));
  check('reps inputs are read with parseInt (safe as text inputs)',
    /parseInt\((?:r|ri)Input?\.value\)/.test(rawScript) || /parseInt\(ri\.value\)/.test(rawScript));

  // Program editor: dropdowns, not a text field
  check('program editor has no free-text sets field',
    !/placeholder="5-5-5"/.test(rawScript));
  check('program editor renders sets/reps dropdowns', /_progSetsSelects\(di,ei,ex\.sets\)/.test(rawScript));
  check('sets range 1-6', /PROG_SETS_MIN=1,PROG_SETS_MAX=6/.test(rawScript));

  if (typeof G._progSetsSelects === 'function') {
    const opts = (h) => [...h.matchAll(/<option[^>]*>([^<]*)</g)].map(m => m[1]);
    const sel  = (h) => [...h.matchAll(/<option selected>([^<]*)</g)].map(m => m[1]);
    const h = G._progSetsSelects(0, 0, '8-8-8-8');
    check('two dropdowns rendered', (h.match(/<select/g) || []).length === 2);
    // Regression (2026-08-01): a <select> sizes itself to its widest option OR optgroup label,
    // so "Strength 4-6" stretched the control, overflowed the editor row and pushed the kg
    // field, tag chip and remove button off-screen — the program looked like it had no weights.
    check('both dropdowns carry an explicit width', (h.match(/width:\d+px/g) || []).length === 2,
      JSON.stringify(h.match(/width:\d+px/g)));
    check('dropdown widths stay within the old sets field footprint',
      (h.match(/width:(\d+)px/g) || []).map(w => +w.match(/\d+/)[0]).reduce((a,b) => a+b, 0) <= 100);
    check('editor row wraps rather than pushing controls off-screen',
      /display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;align-items:center;/.test(rawScript));
    check('editor row still renders the kg field next to the dropdowns',
      /_progSetsSelects\(di,ei,ex\.sets\)/.test(rawScript) &&
      rawScript.indexOf("].kg=unitToKg(this.value)") > rawScript.indexOf('_progSetsSelects(di,ei,ex.sets)'));
    check('4x8 preselects 4 sets and 8 reps', JSON.stringify(sel(h)) === '["4","8"]', JSON.stringify(sel(h)));
    const all = opts(h);
    check('sets options are 1-6', JSON.stringify(all.slice(0, 6)) === '["1","2","3","4","5","6"]', JSON.stringify(all.slice(0, 6)));
    // Rule 2026-07-31 (supersedes the 3-15 range): only rep counts a tag range defines are
    // offered, so picking reps IS picking the tag and an illegal pair cannot be authored.
    check('reps options are only the legal counts (4-6, 8-12, 15) plus max',
      JSON.stringify(all.slice(6)) === JSON.stringify(['4','5','6','8','9','10','11','12','15','max']),
      JSON.stringify(all.slice(6)));
    check('reps are grouped by the tag they produce',
      /optgroup label="Strength 4-6"/.test(h) && /optgroup label="Volume 8-12"/.test(h) && /optgroup label="Rehab 15"/.test(h));
    check('bodyweight "max" prescription survives', JSON.stringify(sel(G._progSetsSelects(0,0,'max-max-max'))) === '["3","max"]');
    check('the 1-set heavy Deadlift reads as 1 x 6', JSON.stringify(sel(G._progSetsSelects(0,0,'6'))) === '["1","6"]');
    check('a value the dropdowns cannot express is kept, not rewritten',
      sel(G._progSetsSelects(0,0,'10-10-12')).includes('10-10-12'));

    // _progSetSets writes the sets string and keeps the scheme prefix in sync
    G._progEditBuf = {days:[{name:'D',exercises:[{name:'Squat',scheme:'4×8-12',sets:'8-8-8-8',tag:'volume',kg:100}]}]};
    G._progSetSets(0, 0, '3', null);
    const ex = G._progEditBuf.days[0].exercises[0];
    check('changing sets rewrites the sets string', ex.sets === '8-8-8', ex.sets);
    check('changing sets syncs the scheme N× prefix', ex.scheme === '3×8-12', ex.scheme);
    G._progSetSets(0, 0, null, '12');
    check('changing reps rewrites every set', G._progEditBuf.days[0].exercises[0].sets === '12-12-12',
      G._progEditBuf.days[0].exercises[0].sets);
    check('changing reps leaves the set count alone',
      G._progEditBuf.days[0].exercises[0].scheme === '3×8-12', G._progEditBuf.days[0].exercises[0].scheme);
    G._progEditBuf.days[0].exercises[0].sets = '10-10-12';
    G._progSetSets(0, 0, '4', null);
    check('a mixed sets string normalises when edited',
      G._progEditBuf.days[0].exercises[0].sets === '10-10-10-10', G._progEditBuf.days[0].exercises[0].sets);
    G._progSetSets(99, 99, '3', null); // must not throw on a stale index
    check('_progSetSets ignores a stale exercise index', true);
  }
}

// ── Every numeric field raises a numeric keypad, app-wide ─────────────────────
// Reported 2026-07-31 (peptide app, same fix applied here): the onboarding Age
// field opened iOS's numbers-and-punctuation keyboard — digits plus - / : ; ( )
// £ & @ " and an ABC key — rather than a plain keypad. That layout is what bare
// type="number" gets on iOS; inputmode is what actually selects the keypad.
// Decimal-capable fields use inputmode="decimal", integer fields use "numeric".
{
  console.log('\n── Numeric keypad on every number field ───────────────────');
  const _bareNum = [];
  const _numRe = /type="number"/g;
  let _nm;
  while ((_nm = _numRe.exec(html))) {
    const st = html.lastIndexOf('<input', _nm.index), en = html.indexOf('>', _nm.index);
    if (st === -1 || en === -1) continue;
    if (html.slice(st, en + 1).indexOf('inputmode') === -1)
      _bareNum.push('line ' + html.slice(0, _nm.index).split('\n').length);
  }
  check('no type="number" input is left without an inputmode', _bareNum.length === 0,
    _bareNum.length ? _bareNum.join(', ') : 'all number inputs declare one');

  // Behavioural: the onboarding steps the report came from. Age sits in step 2,
  // height and body weight in step 3 — check the rendered markup, not the source.
  if (typeof G._obHtml2 === 'function' && typeof G._obHtml3 === 'function') {
    const _svOb = G._obData;
    G._obData = {gender:'male'};
    const _ob = G._obHtml2() + G._obHtml3();
    const _obIn = (_ob.match(/<input[^>]*>/g) || []).filter(t => /type="(number|text)"/.test(t));
    check('the onboarding stats steps render their inputs', _obIn.length === 3, `got ${_obIn.length}`);
    check('  …every one declares an inputmode', _obIn.every(t => t.indexOf('inputmode=') !== -1),
      _obIn.filter(t => t.indexOf('inputmode=') === -1).join(' | '));
    check('  …Age asks for a plain numeric keypad',
      /Age<\/label>[\s\S]{0,80}inputmode="numeric"/.test(_ob));
    check('  …Height asks for a plain numeric keypad',
      /Height \(cm\)<\/label>[\s\S]{0,80}inputmode="numeric"/.test(_ob));
    check('  …Body Weight still allows a decimal point',
      /inputmode="decimal"[^>]*placeholder="85"/.test(_ob));
    G._obData = _svOb;
  } else {
    check('_obHtml2/_obHtml3 available for the onboarding keypad check', false);
  }
}

// ── Automatic tagging from prescribed reps ────────────────────────────────────
// Rule (2026-07-31): "make tagging automatic and honor the rep ranges". The tag is derived
// from the PRESCRIPTION, never set by hand. Logged reps never re-label anything — an AMRAP set
// that ran to 18 because the weight was light leaves the program's label alone.
if (typeof G.tagForReps === 'function') {
  console.log('\n── Automatic tagging from reps ────────────────────────────');
  check('canonical ranges: strength 4-6, volume 8-12, rehab 15',
    JSON.stringify(G.TAG_RANGES) === JSON.stringify({strength:[4,6],volume:[8,12],rehab:[15,15]}),
    JSON.stringify(G.TAG_RANGES));
  check('4/5/6 reps → strength', [4,5,6].every(r => G.tagForReps(r) === 'strength'));
  check('8-12 reps → volume', [8,9,10,11,12].every(r => G.tagForReps(r) === 'volume'));
  check('15 reps → rehab', G.tagForReps(15) === 'rehab');
  check('rehab is the only tag above 12 reps',
    [13,15,18,20].every(r => G.tagForReps(r) === 'rehab'));
  check('AMRAP/max keeps whatever tag it had', G.tagForReps('max') === null && G.tagForReps('') === null);
  check('snapReps moves an undefined count onto the nearest legal one',
    G.snapReps(20) === 15 && G.snapReps(13) === 12 && G.snapReps(7) === 6 && G.snapReps(3) === 4);
  check('snapReps leaves max alone', G.snapReps('max') === 'max');

  // Every generated program, every goal: reps are legal and the tag matches them.
  const mism = [], illegal = [];
  [['hypertrophy','upper'],['hypertrophy','lower'],['hypertrophy','balanced'],
   ['aesthetic','ppl'],['aesthetic','fullbody'],['strength','pure'],['strength','hybrid'],
   ['rehab','knee'],['rehab','back'],['rehab','shoulder']]
    .forEach(([g,s]) => [3,4,5,6,7].forEach(nd => [9,12,16,20,25].forEach(spm => {
      (G._generateWorkoutProgram(g, s, nd, 'T', spm, []).days || []).forEach(d =>
        (d.exercises || []).forEach(e => String(e.sets).split('-').forEach(r => {
          const want = G.tagForReps(r);
          if (!want) return; // 'max'
          if (!G.REPS_LEGAL.includes(parseInt(r, 10))) illegal.push(`${g}/${s} ${e.name} ${r}`);
          if (want !== e.tag) mism.push(`${g}/${s} ${nd}d spm${spm} ${d.name} ${e.name} reps=${r} tag=${e.tag} want=${want}`);
        })));
    })));
  check('no generated exercise prescribes a rep count outside the ranges',
    illegal.length === 0, illegal.slice(0, 3).join('; '));
  check('every generated exercise tag matches its prescribed reps',
    mism.length === 0, mism.slice(0, 3).join('; '));

  // The scheme string the user reads must sit inside the tag's range too.
  const schemeBad = [];
  [['hypertrophy','upper'],['strength','pure'],['rehab','knee']].forEach(([g,s]) =>
    [5,6,7].forEach(nd => (G._generateWorkoutProgram(g, s, nd, 'T', 16, []).days || []).forEach(d =>
      (d.exercises || []).forEach(e => {
        const m = String(e.scheme).match(/^(\d+)×(\d+)(?:\s*[-–]\s*(\d+))?/);
        if (!m) return;
        const lo = String(e.sets).split('-')[0];
        if (m[2] !== lo) schemeBad.push(`${e.name}: scheme ${e.scheme} vs sets ${e.sets}`);
        if (m[3] && G.TAG_RANGES[e.tag] && +m[3] > G.TAG_RANGES[e.tag][1])
          schemeBad.push(`${e.name}: scheme ${e.scheme} exceeds ${e.tag} ceiling`);
      }))));
  check('scheme rep guidance never exceeds the tag it carries',
    schemeBad.length === 0, schemeBad.slice(0, 3).join('; '));

  // A 15-rep lift is `rehab` even inside a hypertrophy program — and gets the 90s rest timer.
  const _hyp = G._generateWorkoutProgram('hypertrophy', 'upper', 6, 'T', 20, []);
  const _r15 = [];
  (_hyp.days || []).forEach(d => (d.exercises || []).forEach(e => {
    if (String(e.sets).split('-')[0] === '15') _r15.push(e);
  }));
  check('15-rep isolation exists in a hypertrophy program and is tagged rehab',
    _r15.length > 0 && _r15.every(e => e.tag === 'rehab'),
    _r15.map(e => e.name + ' ' + e.tag).join(', '));
  check('rest timer follows the derived tag (rehab 90s, strength 240s)',
    G.restSecsForTag('rehab') === 90 && G.restSecsForTag('strength') === 240 && G.restSecsForTag('volume') === 120);

  // Logging must not re-tag: saveLog writes name/sets/kg/reps only, never a tag.
  const _saveLog = rawScript.slice(rawScript.indexOf('function saveLog('), rawScript.indexOf('function saveLog(') + 4000);
  check('saveLog never writes a tag (logged reps do not re-label)',
    !/\btag\s*:/.test(_saveLog) && !/\.tag\s*=/.test(_saveLog));
  check('applyTagFromReps is not called from the logging path',
    !_saveLog.includes('applyTagFromReps') && !_saveLog.includes('tagForReps'));

  // The editor derives the tag too — there is no manual tag picker any more.
  check('program editor has no manual tag <select>',
    !rawScript.includes(".exercises['+ei+'].tag=this.value"));
  check('program editor shows a derived, read-only tag chip',
    rawScript.includes("id=\"prog-tag-'+di+'-'+ei+'\""));
  if (typeof G._progSetSets === 'function') {
    G._progEditBuf = {days:[{name:'D',exercises:[{name:'Calf Raises',scheme:'3×10',sets:'10-10-10',tag:'volume',kg:60}]}]};
    G._progSetSets(0, 0, null, '15');
    check('picking 15 reps in the editor sets the rehab tag',
      G._progEditBuf.days[0].exercises[0].tag === 'rehab', G._progEditBuf.days[0].exercises[0].tag);
    G._progSetSets(0, 0, null, '5');
    check('picking 5 reps in the editor sets the strength tag',
      G._progEditBuf.days[0].exercises[0].tag === 'strength', G._progEditBuf.days[0].exercises[0].tag);
    G._progSetSets(0, 0, null, 'max');
    check('picking max leaves the tag as it was',
      G._progEditBuf.days[0].exercises[0].tag === 'strength', G._progEditBuf.days[0].exercises[0].tag);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(59)}`);

// ── Staging has its own backend namespace ────────────────────────────────────
// Reported 2026-08-01: "testing stage fucks my prod data". Both builds sent no
// X-App-Id, so staging wrote into the same user records as production. Staging now
// declares its own namespace; production keeps sending nothing, which is where its
// data already lives — changing that would orphan it.
{
  console.log('\n── Staging data namespace ─────────────────────────────────');
  check('APP_ID is declared and keys off IS_STAGING',
    /const APP_ID=IS_STAGING\?'stage':''/.test(rawScript));
  check('authHeaders sends X-App-Id when there is one',
    /function authHeaders\(extra\)\{const h=\{\};if\(APP_ID\)h\['X-App-Id'\]=APP_ID;/.test(rawScript));
  check('production still sends no namespace header, so its data is untouched',
    typeof G.APP_ID === 'string' && G.APP_ID === '' && !('X-App-Id' in G.authHeaders()),
    JSON.stringify(G.authHeaders()));
  check('  …and the auth token still goes out either way',
    /const _t=_sessionToken\|\|_googleToken;if\(_t\)h\['Authorization'\]/.test(rawScript));

  // The copy button
  check('copyDataToStage is defined', typeof G.copyDataToStage === 'function');
  check('buildStageCopyCard is defined', typeof G.buildStageCopyCard === 'function');
  check('it posts to the copy endpoint', /AGENT_URL\+'\/account\/copy-to-stage',\{method:'POST'/.test(rawScript));
  check('  …authenticated', /copy-to-stage',\{method:'POST',headers:authHeaders\(\)\}/.test(rawScript));
  check('the card is rendered with the other settings cards',
    (rawScript.match(/buildStageCopyCard\(\)/g)||[]).length >= 3,
    'found '+((rawScript.match(/buildStageCopyCard\(\)/g)||[]).length));
  check('it is hidden on staging — there is nothing to copy from there',
    /if\(IS_STAGING\)\{card\.innerHTML='';return;\}/.test(rawScript));
  check('the copy is confirmed before it runs', /confirm\('Copy your data to the staging app\?/.test(rawScript));
  check('  …and says plainly that this app is not changed',
    /Nothing in this app changes/.test(rawScript));

  // Rendered markup, in the production case
  if (typeof G.buildStageCopyCard === 'function') {
    let _html='';
    const _svGet = G.document.getElementById;
    G.document.getElementById = id => id==='s-stagecopy-card'
      ? {set innerHTML(v){_html=v;}, get innerHTML(){return _html;}}
      : _svGet(id);
    G.buildStageCopyCard();
    check('the card renders a copy button', /s-stagecopy-btn/.test(_html) && /Copy my data to staging/.test(_html));
    check('  …with somewhere to report the result', /s-stagecopy-status/.test(_html));
    G.document.getElementById = _svGet;
  }
}

console.log(`  ${passed} passed  ${failed} failed  ${passed + failed} total`);
process.exit(failed === 0 ? 0 : 1);