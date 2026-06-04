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

// ── Sandbox setup ─────────────────────────────────────────────────────────────
const patched = rawScript
  .replace('const EXERCISE_SPLITS=', 'var EXERCISE_SPLITS=')
  .replace('const GROUP_COLORS=',    'var GROUP_COLORS=')
  .replace('const DAY_TEMPLATES=',   'var DAY_TEMPLATES=')
  .replace("const VERSION='",        "var VERSION='")
  .replace('const AGENT_URL=',       'var AGENT_URL=')
  .replace('const WEIGHTS_TOKEN=',   'var WEIGHTS_TOKEN=')
  .replace('const GOOGLE_CLIENT_ID=','var GOOGLE_CLIENT_ID=')
  .replace('let logs=',              'var logs=')
  .replace('let weights=',           'var weights=')
  .replace('let volWindow=',         'var volWindow=');

const noop = () => {};
const mockEl = () => {
  const el = {
    style:{cssText:''}, dataset:{},
    classList:{add:noop,remove:noop,contains:()=>false,toggle:noop},
    appendChild:noop, removeChild:noop, insertBefore:noop, addEventListener:noop,
    children:[], querySelectorAll:()=>[], querySelector:()=>mockEl(),
    offsetWidth:300,
    getContext:()=>({
      scale:noop,beginPath:noop,moveTo:noop,lineTo:noop,arc:noop,
      fill:noop,stroke:noop,fillText:noop,closePath:noop,
      save:noop,restore:noop,fillRect:noop,strokeRect:noop,setLineDash:noop,
      createLinearGradient:()=>({addColorStop:noop})
    }),
    onclick: null,
  };
  Object.defineProperty(el,'innerHTML',  {get:()=>'',set:noop});
  Object.defineProperty(el,'textContent',{get:()=>'',set:noop});
  Object.defineProperty(el,'value',      {get:()=>'0',set:noop});
  Object.defineProperty(el,'className',  {get:()=>'',set:noop});
  Object.defineProperty(el,'disabled',   {get:()=>false,set:noop});
  return el;
};
const sandbox = vm.createContext({
  window:     {addEventListener:noop,removeEventListener:noop,devicePixelRatio:1,location:{reload:noop,href:''}},
  localStorage:{_s:{},getItem(k){return this._s[k]||null;},setItem(k,v){this._s[k]=v;},removeItem(k){delete this._s[k];}},
  document:   {getElementById:()=>mockEl(),querySelectorAll:()=>[mockEl()],querySelector:()=>mockEl(),
                createElement:()=>mockEl(),body:mockEl(),head:mockEl(),addEventListener:noop,hidden:false},
  fetch:      async()=>({ok:false,json:async()=>({}),status:503}),
  google:undefined, confirm:()=>false, alert:noop,
  setTimeout:noop, clearTimeout:noop, setInterval:noop, console,
  AbortController:class{constructor(){this.signal={};}abort(){}},
  Date, Math, JSON, Promise, Set, Map, Array, Object, Number, String, Boolean, Error, parseInt, parseFloat, isNaN,
});
vm.runInContext(patched, sandbox);
const G = sandbox;

// ── 3. Meta ───────────────────────────────────────────────────────────────────
console.log('\n── Meta ───────────────────────────────────────────────────');
check('VERSION defined',             typeof G.VERSION === 'string');
check('VERSION is x.xx format',      /^\d+\.\d+$/.test(G.VERSION || ''), `got "${G.VERSION}"`);
check('AGENT_URL is https',          G.AGENT_URL?.startsWith('https://'));
check('WEIGHTS_TOKEN defined',       G.WEIGHTS_TOKEN?.length > 0);
const fns = rawScript.match(/(?:async\s+)?function\s+(\w+)\s*\(/g) || [];
const fnNames = fns.map(s => s.replace(/async\s+|function\s+|\s*\(/g, ''));
const dupes = fnNames.filter((n,i) => fnNames.indexOf(n) !== i);
check('no duplicate function names', dupes.length === 0, dupes.length ? dupes.join(', ') : '');

// ── 4. EXERCISE_SPLITS ────────────────────────────────────────────────────────
console.log('\n── EXERCISE_SPLITS — all fractions sum to 1.0 ─────────────');
check('EXERCISE_SPLITS defined',     Array.isArray(G.EXERCISE_SPLITS));
check('30+ exercises',               (G.EXERCISE_SPLITS?.length||0) >= 30, `got ${G.EXERCISE_SPLITS?.length}`);
const badSplits = [];
for (const [kw, sp] of (G.EXERCISE_SPLITS || [])) {
  const sum = Object.entries(sp).filter(([k])=>k!=='factor').reduce((a,[,v])=>a+v, 0);
  if (Math.abs(sum - 1.0) > 0.001) badSplits.push(`"${kw}" sums to ${sum.toFixed(3)}`);
}
check('all fractions sum to 1.0',    badSplits.length === 0, badSplits.join('; '));
check('deadlift legs=0.6 back=0.4',  G.EXERCISE_SPLITS?.some(([k,v])=>k==='deadlift'&&v.legs===0.6&&v.back===0.4));
check('face pull shoulders=0.55 back=0.45', G.EXERCISE_SPLITS?.some(([k,v])=>k==='face pull'&&v.shoulders===0.55&&v.back===0.45));
check('barbell row back=0.7 arms=0.3',G.EXERCISE_SPLITS?.some(([k,v])=>k==='barbell row'&&v.back===0.7&&v.arms===0.3));
check('bench chest=0.6 shoulders=0.25',G.EXERCISE_SPLITS?.some(([k,v])=>k==='bench'&&v.chest===0.6&&v.shoulders===0.25));
check('incline chest=0.55',           G.EXERCISE_SPLITS?.some(([k,v])=>k==='incline'&&v.chest===0.55));
check('landmine shoulders=0.55',      G.EXERCISE_SPLITS?.some(([k,v])=>k==='landmine'&&v.shoulders===0.55));

// ── 5. GROUP_COLORS ───────────────────────────────────────────────────────────
console.log('\n── GROUP_COLORS ───────────────────────────────────────────');
const GC = G.GROUP_COLORS || {};
check('all 5 groups defined',        ['legs','back','chest','shoulders','arms'].every(g=>GC[g]));
check('legs is yellow (#e8ff3c)',     GC.legs === '#e8ff3c');
check('back is green (#3cffa0)',      GC.back === '#3cffa0');

// ── 6. smoothArr ─────────────────────────────────────────────────────────────
console.log('\n── smoothArr ──────────────────────────────────────────────');
check('smoothArr defined',           typeof G.smoothArr === 'function');
const s1 = G.smoothArr([10,20,30,40,50], 5);
check('length preserved',            s1.length === 5);
check('first value = itself',        Math.abs(s1[0] - 10) < 0.01,           `got ${s1[0]}`);
check('window=5 last = avg all',     Math.abs(s1[4] - 30) < 0.01,           `got ${s1[4]}`);
const s2 = G.smoothArr([10,20,30,40,50], 3);
check('window=3 index[2]=(10+20+30)/3', Math.abs(s2[2] - 20) < 0.01,       `got ${s2[2]}`);
check('window=3 index[4]=(30+40+50)/3', Math.abs(s2[4] - 40) < 0.01,       `got ${s2[4]}`);
check('single element → itself',     G.smoothArr([100], 5)[0] === 100);

// ── 7. calcVolume ─────────────────────────────────────────────────────────────
console.log('\n── calcVolume ─────────────────────────────────────────────');
check('calcVolume defined',          typeof G.calcVolume === 'function');
check('80kg 5-5-5-5-5 = 2000',       G.calcVolume('Squat 80kg 5-5-5-5-5') === 2000);
check('100kg 10-10-10 = 3000',       G.calcVolume('Deadlift 100kg 10-10-10') === 3000);
check('no kg → null',                 G.calcVolume('Pull-ups max-max-max') === null);
check('two exercises sum correctly', G.calcVolume('Squat 80kg 5-5\nBench 60kg 8-8') === 80*10 + 60*16);

// ── 8. DAY_TEMPLATES ─────────────────────────────────────────────────────────
console.log('\n── DAY_TEMPLATES ──────────────────────────────────────────');
check('DAY_TEMPLATES defined',       typeof G.DAY_TEMPLATES === 'object');
check('6 training days',             [1,2,3,4,5,6].every(d=>Array.isArray(G.DAY_TEMPLATES?.[d])));
check('each day non-empty',          [1,2,3,4,5,6].every(d=>(G.DAY_TEMPLATES[d]?.length||0)>0));
check('all exercises have name+kg',  Object.values(G.DAY_TEMPLATES||{}).flat().every(e=>e.name&&e.kg!==undefined));
check('day 1 has Squat',             G.DAY_TEMPLATES?.[1]?.some(e=>e.name==='Squat'));
check('day 4 has Deadlift',          G.DAY_TEMPLATES?.[4]?.some(e=>e.name==='Deadlift'));

// ── 9. Key functions ──────────────────────────────────────────────────────────
console.log('\n── Key functions ──────────────────────────────────────────');
[
  'drawVolumeChart','drawGroupChart','buildSessionGroupVol','ensureVolumes','getExSplits',
  'fetchPeptideMilestones','checkSyncStatus','syncUnsyncedNow','checkForUpdate','checkAppVersion',
  'pushWorkoutLogToAgent','pushWeightToAgent','syncWorkoutLogsFromAgent','syncWeightsFromAgent',
  'saveLog','loadSettings','renderProgress','renderHistory','smoothArr','calcVolume',
].forEach(fn => check(`${fn} defined`, typeof G[fn] === 'function'));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(59)}`);
console.log(`  ${passed} passed  ${failed} failed  ${passed+failed} total`);
process.exit(failed === 0 ? 0 : 1);
