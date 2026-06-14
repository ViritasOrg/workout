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
const pinMatch  = html.match(/id="pin-version"[^>]*>([^<]*)</);
const headMatch = html.match(/id="header-version"[^>]*>([^<]*)</);
check('pin-version element is empty',    !pinMatch  || pinMatch[1]  === '', `got "${pinMatch?.[1]}"`);
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

// ── Sandbox setup ─────────────────────────────────────────────────────────────
const patched = rawScript
  .replace('const EXERCISE_SPLITS=', 'var EXERCISE_SPLITS=')
  .replace('const GROUP_COLORS=',    'var GROUP_COLORS=')
  .replace('const DAY_TEMPLATES=',   'var DAY_TEMPLATES=')
  .replace('const THEMES=',          'var THEMES=')
  .replace("const VERSION='",        "var VERSION='")
  .replace('const AGENT_URL=',       'var AGENT_URL=')
  .replace('let WEIGHTS_TOKEN=',      'var WEIGHTS_TOKEN=')
  .replace('const GOOGLE_CLIENT_ID=','var GOOGLE_CLIENT_ID=')
  .replace('let logs=',              'var logs=')
  .replace('let weights=',           'var weights=')
  .replace('let volWindow=',         'var volWindow=')
  .replace('let strWindow=',         'var strWindow=')
  .replace('let _weightWindow=',     'var _weightWindow=')
  .replace('let _chartScale=',       'var _chartScale=')
  .replace('let _programs=',         'var _programs=')
  .replace('let _pageVis=',          'var _pageVis=');

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
check('WEIGHTS_TOKEN defined',       typeof G.WEIGHTS_TOKEN === 'string');
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
check('theme 2 accent is blush',     G.THEMES?.[1]?.vars?.accent === '#D7A9BC');
check('theme 3 is FOREST',           G.THEMES?.[2]?.name === 'FOREST');
check('theme 3 accent is sage',      G.THEMES?.[2]?.vars?.accent === '#4A6B57');
check('theme 4 is EARTH',            G.THEMES?.[3]?.name === 'EARTH');
check('theme 4 accent is terracotta',G.THEMES?.[3]?.vars?.accent === '#7A5C48');

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
check('applyTheme(2) sets --accent to ROSE blush',
  _cssVars['--accent'] === '#D7A9BC', `got "${_cssVars['--accent']}"`);

G.applyTheme(3);
check('applyTheme(3) sets --accent to FOREST sage',
  _cssVars['--accent'] === '#4A6B57', `got "${_cssVars['--accent']}"`);

G.applyTheme(4);
check('applyTheme(4) sets --accent to EARTH terracotta',
  _cssVars['--accent'] === '#7A5C48', `got "${_cssVars['--accent']}"`);

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

// ── 16. hashPin ───────────────────────────────────────────────────────────────
console.log('\n── hashPin ────────────────────────────────────────────────');
check('hashPin defined',             typeof G.hashPin === 'function');
check('hashPin returns a string',    typeof G.hashPin('1234') === 'string');
check('hashPin is deterministic',    G.hashPin('8538') === G.hashPin('8538'));
check('hashPin differs for different inputs',
  G.hashPin('1111') !== G.hashPin('2222'));
check('hashPin is stable across calls',
  G.hashPin('8538') === G.hashPin('8538') && G.hashPin('0000') === G.hashPin('0000'));
check('hashPin non-empty for empty string', typeof G.hashPin('') === 'string');

// ── 17. getExSplits ───────────────────────────────────────────────────────────
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

// ── 18. initTabVis / applyTabVis ─────────────────────────────────────────────
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

// ── 19. initPrograms ─────────────────────────────────────────────────────────
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

// ── 20. buildSessionGroupVol / buildSessionGroupStrength ──────────────────────
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

// Caps reps at 15 in 1RM formula
G.logs = [{
  date: '2020-01-15',
  exercises: [{ name: 'Squat', sets: [{ kg: 100, reps: 30 }] }]
}];
const strHighReps = G.buildSessionGroupStrength('legs', 10000);
const expectedHighReps = 100 * (1 + 15 / 30) * 1;  // min(30,15)=15
check('buildSessionGroupStrength: reps capped at 15 in formula',
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

// ── 21. setChartScale routing ─────────────────────────────────────────────────
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

// ── 22. Key functions ──────────────────────────────────────────────────────────
console.log('\n── Key functions ──────────────────────────────────────────');
[
  'drawVolumeChart', 'drawGroupChart', 'buildSessionGroupVol', 'buildSessionGroupStrength',
  'ensureVolumes', 'getExSplits', 'getWeekKey', 'getExGroup',
  'checkSyncStatus', 'syncUnsyncedNow', 'checkForUpdate', 'checkAppVersion',
  'pushWorkoutLogToAgent', 'pushWeightToAgent', 'syncWorkoutLogsFromAgent', 'syncWeightsFromAgent',
  'saveLog', 'loadSettings', 'renderProgress', 'renderHistory', 'smoothArr', 'calcVolume',
  'applyTheme', 'calcNavyBF', 'obInit', 'openOnboarding', 'buildAppearanceCard', 'buildProfileCard',
  'setChartScale', 'initTabVis', 'applyTabVis', 'initPrograms', 'buildTabsSettingsCard',
  'toggleTabVis', 'formatDate', '_escP', 'hashPin',
  '_nextTrainingDay', 'rebuildDayGrid', 'rebuildLogDaySelect', 'getDayLabel',
].forEach(fn => check(`${fn} defined`, typeof G[fn] === 'function'));

// ── 23. _nextTrainingDay / _selectedProgramDay ────────────────────────────────
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

// ── 24. getDayLabel ───────────────────────────────────────────────────────────
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
check('getDayLabel(3): Legs',   G.getDayLabel(3) === 'Legs',   `got "${G.getDayLabel(3)}"`);
check('getDayLabel(4): Push B', G.getDayLabel(4) === 'Push B', `got "${G.getDayLabel(4)}"`);
check('getDayLabel(5): Pull B', G.getDayLabel(5) === 'Pull B', `got "${G.getDayLabel(5)}"`);
check('getDayLabel(6): Arms & Delts', G.getDayLabel(6) === 'Arms & Delts', `got "${G.getDayLabel(6)}"`);

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

// ── 25. Weight history sort ────────────────────────────────────────────────────
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

// ── 26. Weight window (30/60/90 filter) ────────────────────────────────────────
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

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(59)}`);
console.log(`  ${passed} passed  ${failed} failed  ${passed + failed} total`);
process.exit(failed === 0 ? 0 : 1);
