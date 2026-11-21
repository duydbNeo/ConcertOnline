/* ===== performers: ban nhạc là nhân vật 3D thật (cùng bộ xương, tủ đồ với khán giả), nhạc cụ dựng bằng hình học trơn ===== */
const Performers = (() => {
  const root = new THREE.Group();
  const bands = {};
  const focus = { x: 0, z: -7 };
  const SC = 2.6;
  const dark = new THREE.MeshStandardMaterial({ color: 0x15121f, roughness: 0.6, metalness: 0.3 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a86a0, roughness: 0.35, metalness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9c36a, roughness: 0.3, metalness: 0.85 });
  function paint(c, em) { const col = new THREE.Color(c); return new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.2, emissive: col.clone().multiplyScalar(em == null ? 0.25 : em) }); }
  function neon(c) { return new THREE.MeshBasicMaterial({ color: c }); }
  function put(parent, geo, mat, x, y, z, sx, sy, sz) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); if (sx != null) m.scale.set(sx, sy, sz); parent.add(m); return m; }
  const cyl = (r, h, n) => new THREE.CylinderGeometry(r, r, h, n || 24);
  const sph = () => new THREE.SphereGeometry(1, 20, 14);

  function near(list, hex) {
    const t = new THREE.Color(hex); let bi = 0, bd = 9;
    list.forEach((c, i) => { const k = new THREE.Color(c), d = (k.r - t.r) ** 2 + (k.g - t.g) ** 2 + (k.b - t.b) ** 2; if (d < bd) { bd = d; bi = i; } });
    return bi;
  }
  const OUT = {
    M: { vocal: [5, 0, 1, 1], guitar: [4, 1, 1, 0], bass: [2, 0, 1, 1], drums: [1, 2, 0, 1], keys: [3, 0, 1, 0] },
    F: { vocal: [5, 4, 1, 0], guitar: [4, 2, 1, 1], bass: [2, 3, 1, 0], drums: [1, 3, 0, 0], keys: [3, 0, 1, 0] }
  };
  const HAIR = { M: { spiky: 0, swoop: 0, short: 1, bob: 0, ponytail: 0 }, F: { ponytail: 0, bob: 3, spiky: 2, swoop: 3, short: 2 } };
  function lookFor(spec, band) {
    const g = band.type === 'girl' ? 0 : 1, G = g ? 'M' : 'F', V = Avatar.V3, cw = band.id === 'luna' ? V.colorways.findIndex(c => c.id === 'sakura') : V.colorways.findIndex(c => c.id === 'solar');
    const o = OUT[G][spec.role] || OUT[G].guitar, cwi = Math.max(0, cw);
    const l = Avatar.Look.def(g);
    l[1] = o[0]; l[2] = cwi; l[3] = o[1]; l[4] = cwi; l[5] = o[2]; l[6] = cwi;
    l[7] = HAIR[G][spec.hairStyle] != null ? HAIR[G][spec.hairStyle] : 0; l[8] = near(V.hairColors, spec.hair); l[9] = near(V.skins, spec.skin);
    return l;
  }

  function props(m, spec, pal) {
    const g = new THREE.Group(); m.rig = g; m.root.add(g);
    const main = new THREE.Color(pal.main), acc = new THREE.Color(pal.accent);
    if (spec.role === 'vocal') {
      const hb = m.a.bones.hand_r;
      if (hb) {
        const mic = new THREE.Group();
        put(mic, cyl(0.016, 0.16, 12), dark, 0, 0.05, 0);
        put(mic, sph(), metal, 0, 0.16, 0, 0.034, 0.04, 0.034);
        hb.add(mic); mic.position.set(0, 0.02, 0.02); mic.rotation.set(0.5, 0, 0);
        m.mic = mic;
      }
    } else if (spec.role === 'guitar' || spec.role === 'bass') {
      const gt = new THREE.Group(), bass = spec.role === 'bass';
      const col = bass ? 0x2a1f3d : main.getHex();
      put(gt, sph(), paint(col, 0.3), 0, -0.04, 0, 0.15, 0.19, 0.035);
      put(gt, sph(), paint(col, 0.3), 0, 0.15, 0, 0.11, 0.13, 0.035);
      put(gt, sph(), neon(acc.getHex()), 0, -0.02, 0.037, 0.045, 0.045, 0.006);
      const nl = bass ? 0.8 : 0.68;
      const neck = put(gt, cyl(0.022, nl, 10), dark, 0, 0.23 + nl / 2, 0.0); neck.scale.set(1, 1, 0.6);
      put(gt, sph(), gold, 0, 0.23 + nl + 0.05, 0, 0.035, 0.06, 0.018);
      gt.rotation.z = -1.15; gt.position.set(0.0, 1.0, 0.23); gt.rotation.y = 0.0;
      g.add(gt); m.inst = gt;
    } else if (spec.role === 'keys') {
      const k = new THREE.Group();
      put(k, new THREE.BoxGeometry(1.25, 0.08, 0.42), dark, 0, 0, 0);
      put(k, new THREE.BoxGeometry(1.15, 0.03, 0.2), paint(0xf0f0f8, 0.5), 0, 0.055, 0.08);
      put(k, new THREE.BoxGeometry(1.2, 0.03, 0.03), neon(acc.getHex()), 0, 0.06, -0.17);
      [-0.5, 0.5].forEach(x => put(k, cyl(0.025, 0.95, 10), metal, x, -0.5, 0));
      k.position.set(0, 1.0, 0.52); g.add(k);
    } else if (spec.role === 'drums') {
      const kit = new THREE.Group(), shell = paint(main.getHex(), 0.22);
      const kick = put(kit, cyl(0.26, 0.4, 28), shell, 0, 0.3, 0.62); kick.rotation.x = Math.PI / 2;
      put(kit, cyl(0.1, 0.3, 20), metal, 0, 0.3, 0.42).rotation.x = Math.PI / 2;
      put(kit, cyl(0.15, 0.12, 24), metal, -0.34, 0.82, 0.38);
      [-0.16, 0.18].forEach(x => put(kit, cyl(0.12, 0.14, 24), shell, x, 0.82, 0.62));
      put(kit, cyl(0.17, 0.18, 24), shell, 0.52, 0.55, 0.45);
      m.cym = [-0.7, 0.72].map((x, i) => { const c = put(kit, cyl(0.24, 0.012, 32), gold, x, 1.12, 0.38 + i * 0.1); put(kit, cyl(0.01, 1.1, 8), metal, x, 0.56, 0.38 + i * 0.1); return c; });
      put(kit, cyl(0.2, 0.05, 24), dark, 0, 0.5, -0.32);
      g.add(kit);
    }
  }

  function init(THREE_scene) {
    BANDS.bands.forEach(b => {
      const gp = new THREE.Group(); root.add(gp);
      const B = { spec: b, group: gp, members: [], enter: 0, offX: 0, vocal: null, ready: false };
      bands[b.id] = B; gp.position.y = -7; gp.visible = false;
      Promise.all(b.members.map(async spec => {
        const a = await Avatar.create(lookFor(spec, b));
        const m = { a, root: new THREE.Group(), role: spec.role, seed: hashStr(spec.stage) % 100 / 100 * 6.28, mode: '' };
        const f = b.formation[spec.role] || [0, -9];
        m.base = new THREE.Vector3(f[0], 1.5, f[1]); m.root.position.copy(m.base); m.root.scale.setScalar(SC);
        m.body = a.root; m.root.add(a.root); gp.add(m.root); m.a = a;
        props(m, spec, b.palette);
        const clip = { vocal: 'talk', guitar: 'strum', bass: 'strum', keys: 'keys', drums: 'hit' }[spec.role];
        a.play(clip, 0.01); m.mode = clip; m.clip = clip;
        if (spec.role === 'guitar' || spec.role === 'bass') m.root.rotation.y = spec.role === 'guitar' ? 0.25 : -0.25;
        B.members.push(m); if (spec.role === 'vocal') B.vocal = m;
      })).then(() => { B.ready = true; }).catch(e => console.warn('band', e));
      THREE_scene.add(root);
    });
  }

  function update(W, time, dt) {
    const mode = W.seg ? W.seg.band : 'none';
    const e = W.energy, beat = W.bi.beat, h = Math.abs(Math.sin(Math.PI * beat)), P = W.bi.pulse, M = W.live ? W.live.mid : 0;
    for (const id in bands) {
      const B = bands[id];
      const active = mode === 'both' || mode === id;
      B.enter = lerp(B.enter, active ? 1 : 0, 1 - Math.exp(-dt * 2.2));
      const targetX = mode === 'both' ? (id === 'solar' ? -7.5 : 7.5) : 0;
      B.offX = lerp(B.offX, targetX, 1 - Math.exp(-dt * 2));
      B.group.position.x = B.offX; B.group.position.y = lerp(-7, 0, B.enter);
      B.group.visible = B.enter > 0.02 && B.ready;
      if (!B.group.visible) continue;
      B.members.forEach(m => animate(m, B, dt, time, beat, h, P, e, id === 'luna', M));
    }
    let target = null;
    if (mode === 'both') target = bands[Math.floor(W.bi.bar) % 2 === 0 ? 'solar' : 'luna']; else target = bands[mode];
    if (target && target.vocal) {
      const v = target.vocal, wx = target.group.position.x + v.root.position.x;
      focus.x = lerp(focus.x, wx, 0.08); focus.z = lerp(focus.z, v.root.position.z, 0.08);
    }
  }

  function animate(m, B, dt, time, beat, h, P, e, girl, M) {
    const s = m.seed, r = m.role, bpm = B.spec.bpm || 118;
    if (r === 'vocal') {
      const want = e > 0.85 ? 'dance' : 'talk';
      if (want !== m.mode) { m.a.play(want, 0.5); m.mode = want; }
      m.root.position.x = m.base.x + Math.sin(time * 0.45 + s) * 2.6 * e;
      m.root.position.z = m.base.z + 0.5 + Math.sin(time * 0.3 + s) * 0.6 * e;
      m.root.position.y = m.base.y + h * 0.08 * e;
    } else if (r === 'drums') {
      m.a.speed('hit', bpm / 62);
      m.root.position.y = m.base.y + h * 0.02 * e;
      if (m.cym) m.cym.forEach((c, i) => { c.rotation.z = Math.sin(time * 30 + i) * 0.04 * P * e; });
    } else if (r === 'keys') {
      m.root.position.y = m.base.y + h * 0.03 * e; m.root.rotation.z = Math.sin(time * 1.6 + s) * 0.02 * e;
    } else {
      m.a.speed('strum', 0.8 + e * 1.2);
      m.root.position.y = m.base.y + h * 0.05 * e + P * 0.02;
      m.root.rotation.z = Math.sin(time * 1.6 + s) * 0.04 * e;
    }
    m.a.update(dt, bpm);
    const bn = m.a.bones, k = e * 0.6 + 0.25;
    sway(bn.spine_02, 0, Math.sin(time * 1.1 + s) * 0.05 * k, Math.sin(time * 1.7 + s) * 0.04 * k);
    sway(bn.spine_03, h * 0.04 * e, Math.sin(time * 0.9 + s * 2) * 0.05 * k, 0);
    sway(bn.neck_01, Math.sin(time * 1.3 + s) * 0.04 * k + h * 0.05 * e, Math.sin(time * 0.6 + s) * 0.08 * k, 0);
  }
  const _q = new THREE.Quaternion(), _e = new THREE.Euler();
  function sway(b, x, y, z) { if (b) b.quaternion.multiply(_q.setFromEuler(_e.set(x, y, z))); }

  return { init, update, root, focusPoint() { return focus; } };
})();
