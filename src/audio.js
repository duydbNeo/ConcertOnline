/* ===== audio: nhạc tổng hợp gốc bằng WebAudio (không dùng bản ghi nào, không dính bản quyền) ===== */
const Aud = (() => {
  let ctx = null, master, comp, analyser, noiseBuf, murmurGain;
  let on = false, timer = null, nextT = 0, DRY = null;
  const fbuf = new Uint8Array(64);
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.0;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    analyser = ctx.createAnalyser(); analyser.fftSize = 128; analyser.smoothingTimeConstant = 0.78;
    master.connect(comp); comp.connect(analyser); analyser.connect(ctx.destination);
    const len = ctx.sampleRate * 1.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // tiếng ồn khán giả nền
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.5;
    murmurGain = ctx.createGain(); murmurGain.gain.value = 0.0;
    ns.connect(bp); bp.connect(murmurGain); murmurGain.connect(master); ns.start();
    return true;
  }

  function noiseSrc(t, dur) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); return s;
  }
  function g(t, peak, a, d, sus, r, dur) {
    const n = ctx.createGain();
    n.gain.setValueAtTime(0.0001, t);
    n.gain.linearRampToValueAtTime(peak, t + a);
    n.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * sus), t + a + d);
    n.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    return n;
  }

  /* --- giọng đơn --- */
  const V = {
    kick(t, v) {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      const n = g(t, 0.95 * v, 0.002, 0.12, 0.2, 0.2, 0.18);
      o.connect(n); n.connect(master); o.start(t); o.stop(t + 0.4);
    },
    snare(t, v) {
      const s = noiseSrc(t, 0.2), f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400;
      const n = g(t, 0.38 * v, 0.001, 0.07, 0.15, 0.1, 0.12);
      s.connect(f); f.connect(n); n.connect(master);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
      const n2 = g(t, 0.22 * v, 0.001, 0.06, 0.1, 0.05, 0.08); o.connect(n2); n2.connect(master); o.start(t); o.stop(t + 0.2);
    },
    hat(t, v, open) {
      const s = noiseSrc(t, open ? 0.3 : 0.08), f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
      const n = g(t, 0.17 * v, 0.001, open ? 0.12 : 0.03, 0.1, 0.05, open ? 0.2 : 0.05);
      s.connect(f); f.connect(n); n.connect(master);
    },
    clap(t, v) {
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.011;
        const s = noiseSrc(tt, 0.15), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.8;
        const n = g(tt, 0.3 * v, 0.001, i === 2 ? 0.09 : 0.012, 0.1, 0.04, i === 2 ? 0.1 : 0.014);
        s.connect(f); f.connect(n); n.connect(master);
      }
    },
    bass(t, m, dur) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(220, t + dur * 0.9);
      const n = g(t, 0.34, 0.005, 0.08, 0.6, 0.06, dur);
      o.connect(f); f.connect(n); n.connect(master); o.start(t); o.stop(t + dur + 0.1);
    },
    pad(t, notes, dur) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1300; f.Q.value = 0.5;
      const n = g(t, 0.09, 0.35, 0.4, 0.8, 0.5, dur);
      f.connect(n); n.connect(master);
      notes.forEach(m => [-6, 6].forEach(det => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + dur + 0.6);
      }));
    },
    pluck(t, m, dur) {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(m);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
      f.frequency.setValueAtTime(3600, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.14);
      const n = g(t, 0.085, 0.002, 0.1, 0.1, 0.06, dur * 0.6);
      o.connect(f); f.connect(n); n.connect(master); o.start(t); o.stop(t + dur + 0.2);
    },
    voice(t, m, dur, kind) {
      const girl = kind === 'girl';
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2; const lg = ctx.createGain(); lg.gain.value = 5;
      lfo.connect(lg); lg.connect(o.detune);
      const form = girl ? [850, 1350] : [680, 1080];
      const out = g(t, girl ? 0.2 : 0.22, 0.03, 0.08, 0.8, 0.1, dur);
      form.forEach((fr, i) => {
        const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fr; b.Q.value = 7;
        const gg = ctx.createGain(); gg.gain.value = i === 0 ? 1 : 0.6;
        o.connect(b); b.connect(gg); gg.connect(out);
      });
      out.connect(master); o.start(t); lfo.start(t); o.stop(t + dur + 0.2); lfo.stop(t + dur + 0.2);
    },
    riser(t, dur) {
      const s = noiseSrc(t, dur), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5;
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
      const n = ctx.createGain(); n.gain.setValueAtTime(0.0001, t); n.gain.exponentialRampToValueAtTime(0.16, t + dur); n.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
      s.connect(f); f.connect(n); n.connect(master);
    },
    cheer(t, amt, dur) {
      [[900, 0.6], [2400, 0.9]].forEach(([fr, q]) => {
        const s = noiseSrc(t, dur + 1), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = q;
        const n = ctx.createGain(); n.gain.setValueAtTime(0.0001, t);
        n.gain.linearRampToValueAtTime(0.12 * amt, t + 0.5);
        n.gain.linearRampToValueAtTime(0.1 * amt, t + dur);
        n.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.0);
        s.connect(f); f.connect(n); n.connect(master);
      });
    }
  };

  const CH = { m: [0, 3, 7], M: [0, 4, 7] };
  const ARP = [0, 1, 2, 3, 2, 1, 0, 2];

  function emit(kind, fn) { if (DRY) { DRY.count++; DRY.kinds[kind] = (DRY.kinds[kind] || 0) + 1; } else fn(); }

  function playStep(song, k, stepDur, delay, cue, t0) {
    const L = cue.layerSet, st = k % 16, bar = Math.floor(k / 16);
    const chord = song.prog[bar % 4], tones = CH[chord.q];
    const t = DRY ? 0 : t0 + Math.max(0, delay);
    const d = song.drums;
    if (L.has('kick') && d.kick[st] === 'x') emit('kick', () => V.kick(t, 1));
    if (L.has('snare') && d.snare[st] === 'x') emit('snare', () => V.snare(t, 1));
    if (L.has('hat') && d.hat[st] === 'x') emit('hat', () => V.hat(t, st % 4 === 2 ? 1 : 0.65, st === 14));
    if (L.has('clap') && d.clap[st] === 'x') emit('clap', () => V.clap(t, 0.8));
    if (L.has('bass') && song.bass[st] === 'x') emit('bass', () => V.bass(t, song.root + chord.r - 12, stepDur * 1.8));
    if (L.has('pad') && st === 0) emit('pad', () => V.pad(t, tones.map(x => song.root + chord.r + x), stepDur * 16));
    if (L.has('arp') && song.arp[st] === 'x') {
      const ti = ARP[k % 8]; const off = ti === 3 ? 12 : tones[ti];
      emit('arp', () => V.pluck(t, song.root + chord.r + 12 + off, stepDur));
    }
    if (L.has('riser') && st === 0 && bar % 2 === 0) emit('riser', () => V.riser(t, stepDur * 32));
    if (L.has('vocal') && song.hook.length) {
      const hb = song.hook[bar % 4];
      for (let i = 0; i < hb.length; i++) {
        const h = hb[i];
        if (h[1] !== st) continue;
        const m = song.root + 12 + h[0], dur = h[2] * stepDur;
        if (song.voice === 'duet') {
          emit('vocal', () => { V.voice(t, m, dur, 'boy'); V.voice(t, m + 12, dur, 'girl'); });
        } else {
          emit('vocal', () => V.voice(t, m, dur, song.voice));
        }
      }
    }
  }

  function tick() {
    if (!ctx || !on) return;
    const T = Clock.now(), horizon = T + 0.35;
    if (nextT < T - 0.1) nextT = T;
    let guard = 0;
    while (nextT < horizon && guard++ < 200) {
      const L = layout(nextT);
      if (L.phase !== 'show') { nextT += Math.max(0.1, -L.t); continue; }
      const seg = segAt(L.t), song = seg && SHOW.songs[seg.song];
      if (!song) { nextT += 0.1; continue; }
      const stepDur = 60 / song.bpm / 4;
      let k = Math.round((L.t - seg.start) / stepDur);
      if (seg.start + k * stepDur < L.t - 1e-6) k++;
      const stepShow = seg.start + k * stepDur;
      if (stepShow >= seg.end - 1e-6) { nextT += (seg.end - L.t) + 0.0005; continue; }
      const absStep = nextT + (stepShow - L.t);
      const cue = cueStateAt(stepShow);
      if (cue) playStep(song, k, stepDur, absStep - T, cue, ctx.currentTime);
      nextT = absStep + stepDur;
    }
    const L0 = layout(T);
    murmurGain.gain.setTargetAtTime(L0.phase === 'lobby' ? 0.05 : 0.018, ctx.currentTime, 0.6);
  }

  return {
    available() { return !!(window.AudioContext || window.webkitAudioContext); },
    async enable() {
      if (!init()) return false;
      try { await ctx.resume(); } catch (e) { }
      on = true; nextT = Clock.now();
      master.gain.setTargetAtTime(0.6, ctx.currentTime, 0.1);
      if (!timer) timer = setInterval(tick, 50);
      return ctx.state === 'running';
    },
    disable() { on = false; if (ctx) master.gain.setTargetAtTime(0.0, ctx.currentTime, 0.05); },
    isOn() { return on; },
    resync() { nextT = Clock.now(); },
    cheer(amt) { if (on && ctx) V.cheer(ctx.currentTime, amt, 2.2); },
    spectrum(n) {
      if (!on || !analyser) return null;
      analyser.getByteFrequencyData(fbuf);
      const out = new Float32Array(n), bins = 40;
      for (let i = 0; i < n; i++) {
        const a = Math.floor(Math.pow(i / n, 1.5) * bins), b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / n, 1.5) * bins));
        let s = 0; for (let j = a; j < b; j++) s += fbuf[j]; out[i] = s / (b - a) / 255;
      }
      return out;
    },
    /* Diễn tập khô: chạy bộ lập lịch nốt trên cả buổi, đếm số sự kiện âm thanh, không phát gì. */
    dryRun() {
      const res = {};
      DRY = { count: 0, kinds: {} };
      try {
        SHOW.segments.forEach(seg => {
          const song = SHOW.songs[seg.song]; if (!song) { res[seg.id] = { events: 0, perSec: 0, kinds: {} }; return; }
          DRY.count = 0; DRY.kinds = {};
          const stepDur = 60 / song.bpm / 4;
          for (let k = 0; seg.start + k * stepDur < seg.end; k++) {
            const cue = cueStateAt(seg.start + k * stepDur); if (cue) playStep(song, k, stepDur, 0, cue, 0);
          }
          res[seg.id] = { events: DRY.count, perSec: DRY.count / (seg.end - seg.start), kinds: Object.assign({}, DRY.kinds) };
        });
      } finally { DRY = null; }
      return res;
    }
  };
})();
