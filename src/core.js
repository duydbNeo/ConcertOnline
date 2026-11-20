/* ===== core: data, clock, helpers ===== */
const SHOW = JSON.parse(document.getElementById('show-data').textContent);
const BANDS = JSON.parse(document.getElementById('bands-data').textContent);
const WARDROBE = JSON.parse(document.getElementById('wardrobe-data').textContent);
const LOBBY = SHOW.cycle.lobby, SHOW_LEN = SHOW.cycle.show, CYCLE = LOBBY + SHOW_LEN;

const Clock = {
  mode: 'live',      // 'live' = đồng bộ theo giờ thật, 'demo' = chạy riêng từ đầu
  demoBase: LOBBY,
  demoPerf: 0,
  warp: 1,
  now() {
    if (this.mode === 'live') return Date.now() / 1000;
    return this.demoBase + ((performance.now() - this.demoPerf) / 1000) * this.warp;
  },
  startDemo(warp) {
    this.mode = 'demo';
    this.warp = warp || 1;
    this.demoBase = LOBBY;
    this.demoPerf = performance.now();
  },
  goLive() { this.mode = 'live'; this.warp = 1; }
};

function layout(T) {
  const c = ((T % CYCLE) + CYCLE) % CYCLE;
  if (c < LOBBY) return { phase: 'lobby', t: c - LOBBY, countdown: LOBBY - c };
  return { phase: 'show', t: c - LOBBY, countdown: 0 };
}
function segAt(t) {
  const s = SHOW.segments;
  for (let i = 0; i < s.length; i++) if (t >= s[i].start && t < s[i].end) return s[i];
  return null;
}
function cueIndexAt(t) {
  const c = SHOW.cues; let idx = -1;
  for (let i = 0; i < c.length; i++) { if (c[i].t <= t) idx = i; else break; }
  return idx;
}
// Gộp các cue từ đầu đến t: trường nào cue sau không ghi thì giữ giá trị trước.
const _cueCache = new Map();
function cueStateAt(t) {
  const idx = cueIndexAt(t);
  if (idx < 0) return null;
  if (_cueCache.has(idx)) return _cueCache.get(idx);
  const st = { _idx: idx };
  for (let i = 0; i <= idx; i++) {
    const c = SHOW.cues[i];
    for (const k in c) { if (k !== 'fx' && k !== 'cheer') st[k] = c[k]; }
  }
  st.fx = SHOW.cues[idx].fx || null;
  st.cheer = SHOW.cues[idx].cheer || 0;
  st.layerSet = new Set(st.layers || []);
  st.colors = SHOW.palettes[st.pal] || SHOW.palettes.neon;
  _cueCache.set(idx, st);
  return st;
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (a, b) => a + Math.random() * (b - a);
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

// Nhịp hiện tại: beat là số nhịp từ đầu đoạn, pulse là xung tắt dần trong mỗi nhịp.
function beatInfo(t) {
  const seg = segAt(t);
  if (!seg) return { beat: 0, pulse: 0, bpm: 110, bar: 0 };
  const song = SHOW.songs[seg.song];
  const bpm = song ? song.bpm : 110;
  const beat = (t - seg.start) * bpm / 60;
  const f = beat - Math.floor(beat);
  return { beat, pulse: Math.exp(-f * 4.5), bpm, bar: Math.floor(beat / 4), f };
}
