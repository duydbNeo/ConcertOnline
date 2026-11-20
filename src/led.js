/* ===== LED: màn hình vẽ bằng canvas 2D, dùng làm texture cho tường LED ===== */
const LED = (() => {
  const mainC = document.createElement('canvas'); mainC.width = 640; mainC.height = 280;
  const sideC = document.createElement('canvas'); sideC.width = 160; sideC.height = 360;
  const mg = mainC.getContext('2d'), sg = sideC.getContext('2d');
  let mainTex = null, sideTex = null;
  const FONT = '"Unbounded","Be Vietnam Pro",system-ui,sans-serif';

  function fakeSpec(n, time, pulse) {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = clamp(0.18 + 0.55 * pulse * (0.55 + 0.45 * Math.sin(i * 0.8 + time * 3.1)) + 0.12 * Math.sin(i * 0.37 + time * 1.3), 0, 1);
    return a;
  }
  function rgba(hex, a) { const [r, g, b] = hex2rgb(hex); return `rgba(${r * 255 | 0},${g * 255 | 0},${b * 255 | 0},${a})`; }
  function bg(g, w, h, c0, c1, a) {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#05030c'); gr.addColorStop(1, rgba(c1, a == null ? 0.35 : a));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  function text(g, lines, w, h, c0, c1, size, pulse) {
    if (!lines || !lines.length) return;
    const n = lines.length, lh = size * 1.12;
    let y = h / 2 - (n - 1) * lh / 2;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      g.font = `800 ${size}px ${FONT}`;
      let s = size; while (g.measureText(ln).width > w * 0.92 && s > 12) { s -= 2; g.font = `800 ${s}px ${FONT}`; }
      g.shadowColor = i % 2 ? c1 : c0; g.shadowBlur = 14 + 22 * pulse;
      g.fillStyle = '#fff'; g.fillText(ln, w / 2, y + i * lh);
      g.shadowBlur = 0;
    });
  }

  const scenes = {
    title(g, w, h, t, P, spec, c0, c1, lines) {
      bg(g, w, h, c0, c1, 0.5);
      g.strokeStyle = rgba(c0, 0.25); g.lineWidth = 1;
      for (let i = -4; i < 14; i++) { const x = ((i * 70 + t * 18) % (w + 140)) - 70; g.beginPath(); g.moveTo(x, 0); g.lineTo(x - 120, h); g.stroke(); }
      text(g, lines || [SHOW.title], w, h, c0, c1, h * 0.26, P);
    },
    grid(g, w, h, t, P, spec, c0, c1, lines) {
      const hz = h * 0.52;
      const sky = g.createLinearGradient(0, 0, 0, hz); sky.addColorStop(0, '#07040f'); sky.addColorStop(1, rgba(c1, 0.55));
      g.fillStyle = sky; g.fillRect(0, 0, w, hz);
      g.fillStyle = '#05030c'; g.fillRect(0, hz, w, h - hz);
      const r = h * (0.26 + 0.02 * P);
      const sun = g.createLinearGradient(0, hz - r * 1.6, 0, hz); sun.addColorStop(0, c0); sun.addColorStop(1, c1);
      g.save(); g.beginPath(); g.arc(w / 2, hz - r * 0.2, r, Math.PI, 0); g.closePath(); g.clip();
      g.fillStyle = sun; g.fillRect(0, 0, w, h);
      g.fillStyle = '#05030c'; for (let i = 0; i < 6; i++) g.fillRect(0, hz - r * 0.9 + i * r * 0.18 + ((t * 8) % (r * 0.18)), w, 1 + i);
      g.restore();
      g.strokeStyle = rgba(c0, 0.9); g.lineWidth = 1.2;
      for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(w / 2 + i * 14, hz); g.lineTo(w / 2 + i * 120, h); g.stroke(); }
      for (let i = 0; i < 9; i++) { const k = ((i + (t * 0.7 % 1)) / 9); const y = hz + (h - hz) * k * k; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      if (lines) text(g, lines, w, h * 0.5, c0, c1, h * 0.17, P);
    },
    bars(g, w, h, t, P, spec, c0, c1, lines) {
      bg(g, w, h, c0, c1, 0.3);
      const n = 32, bw = w / n;
      for (let i = 0; i < n; i++) {
        const v = Math.pow(spec[i], 1.1), bh = v * h * 0.9;
        const gr = g.createLinearGradient(0, h, 0, h - bh); gr.addColorStop(0, c1); gr.addColorStop(1, c0);
        g.fillStyle = gr; g.fillRect(i * bw + 2, h - bh, bw - 4, bh);
        g.fillStyle = '#fff'; g.fillRect(i * bw + 2, h - bh - 4, bw - 4, 3);
      }
      if (lines) text(g, lines, w, h * 0.55, c0, c1, h * 0.14, P);
    },
    rings(g, w, h, t, P, spec, c0, c1, lines) {
      bg(g, w, h, c0, c1, 0.25);
      g.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const k = ((i / 7) + t * 0.18) % 1, r = k * w * 0.42 * (1 + 0.1 * P);
        g.strokeStyle = rgba(i % 2 ? c0 : c1, (1 - k) * 0.9);
        g.beginPath(); g.ellipse(w / 2, h / 2, r, r * 0.55, 0, 0, Math.PI * 2); g.stroke();
      }
      text(g, lines || [], w, h, c0, c1, h * 0.2, P);
    },
    stars(g, w, h, t, P, spec, c0, c1, lines) {
      g.fillStyle = '#04020a'; g.fillRect(0, 0, w, h);
      const R = mulberry(7);
      for (let i = 0; i < 90; i++) {
        const x = R() * w, y = R() * h, tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.6 + R()) + i));
        g.fillStyle = `rgba(255,255,255,${tw})`; g.fillRect(x, y, 1 + R() * 2, 1 + R() * 2);
      }
      const cx = ((t * 120) % (w + 300)) - 150, cy = h * 0.2 + cx * 0.3;
      const tr = g.createLinearGradient(cx - 120, cy - 36, cx, cy); tr.addColorStop(0, 'rgba(0,0,0,0)'); tr.addColorStop(1, c0);
      g.strokeStyle = tr; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 120, cy - 36); g.lineTo(cx, cy); g.stroke();
      text(g, lines || [], w, h, c0, c1, h * 0.2, P);
    },
    sunburst(g, w, h, t, P, spec, c0, c1, lines) {
      bg(g, w, h, c0, c1, 0.4);
      const n = 18, cx = w / 2, cy = h / 2, rot = t * 0.35;
      for (let i = 0; i < n; i++) {
        const a0 = rot + i * Math.PI * 2 / n, a1 = a0 + Math.PI / n;
        g.fillStyle = i % 2 ? rgba(c0, 0.55 + 0.3 * P) : rgba(c1, 0.35);
        g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, w, a0, a1); g.closePath(); g.fill();
      }
      text(g, lines || [], w, h, c0, c1, h * 0.2, P);
    },
    wave(g, w, h, t, P, spec, c0, c1, lines) {
      bg(g, w, h, c0, c1, 0.3);
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = rgba(k % 2 ? c0 : c1, 0.85 - k * 0.15); g.lineWidth = 3;
        g.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const y = h / 2 + Math.sin(x * 0.018 + t * (1.4 + k * 0.4) + k) * (22 + 18 * P) * (1 + k * 0.25);
          x ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      }
      text(g, lines || [], w, h, c0, c1, h * 0.2, P);
    },
    countdown(g, w, h, t, P, spec, c0, c1, lines) {
      bg(g, w, h, c0, c1, 0.35);
      text(g, lines || ['DOORS OPEN'], w, h, c0, c1, h * 0.16, P);
    },
    thanks(g, w, h, t, P, spec, c0, c1, lines) {
      scenes.stars(g, w, h, t, P, spec, c0, c1, null);
      g.fillStyle = rgba(c1, 0.18); g.fillRect(0, h * 0.62, w, h * 0.38);
      text(g, lines || ['THANK YOU'], w, h, c0, c1, h * 0.2, P);
    }
  };

  function drawSide(g, w, h, t, P, spec, c0, c1) {
    g.fillStyle = '#05030c'; g.fillRect(0, 0, w, h);
    const n = 14, bh = h / n;
    for (let i = 0; i < n; i++) {
      const v = spec[(i * 2) % 32] * 0.9 + 0.06, bw = v * w;
      const gr = g.createLinearGradient(0, 0, bw, 0); gr.addColorStop(0, c1); gr.addColorStop(1, c0);
      g.fillStyle = gr; g.fillRect(0, i * bh + 2, bw, bh - 4);
    }
    g.fillStyle = rgba(c0, 0.25 * P); g.fillRect(0, 0, w, h);
  }

  return {
    init(THREE) {
      mainTex = new THREE.CanvasTexture(mainC); sideTex = new THREE.CanvasTexture(sideC);
      mainTex.minFilter = sideTex.minFilter = THREE.LinearFilter;
      mainTex.generateMipmaps = sideTex.generateMipmaps = false;
      return { main: mainTex, side: sideTex };
    },
    scenes: Object.keys(scenes),
    draw(cue, t, bi, spec, lobbyCountdown) {
      const [c0, c1] = cue ? cue.colors : SHOW.palettes.deep;
      const sp = spec || fakeSpec(32, performance.now() / 1000, bi.pulse);
      const time = performance.now() / 1000;
      if (lobbyCountdown != null) {
        scenes.countdown(mg, mainC.width, mainC.height, time, bi.pulse, sp, c0, c1, ['DOORS OPEN', fmtTime(lobbyCountdown)]);
      } else {
        const fn = scenes[cue && cue.led] || scenes.title;
        fn(mg, mainC.width, mainC.height, time, bi.pulse, sp, c0, c1, cue && cue.text);
      }
      drawSide(sg, sideC.width, sideC.height, time, bi.pulse, sp, c0, c1);
      mainTex.needsUpdate = true; sideTex.needsUpdate = true;
    }
  };
})();
