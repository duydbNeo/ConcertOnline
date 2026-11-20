/* ===== performers: ban nhạc dựng bằng khối hình, hoạt ảnh theo nhịp ===== */
const Performers = (() => {
  const root = new THREE.Group();
  const bands = {};
  const focus = { x: 0, z: -7 };
  const G = { box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 14, 10), cyl: new THREE.CylinderGeometry(1, 1, 1, 16), cone: new THREE.ConeGeometry(1, 1, 6), cap: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2) };
  const dark = new THREE.MeshLambertMaterial({ color: 0x15121f, emissive: 0x050408 });
  const metal = new THREE.MeshLambertMaterial({ color: 0x3a3650, emissive: 0x0c0b12 });

  function lam(c, em) { const m = new THREE.MeshLambertMaterial({ color: c }); m.emissive = new THREE.Color(c).multiplyScalar(em == null ? 0.18 : em); return m; }
  function neon(c) { return new THREE.MeshBasicMaterial({ color: c }); }
  function mesh(geo, mat, sx, sy, sz, x, y, z) { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x || 0, y || 0, z || 0); return m; }

  function makeHair(style, color, head) {
    const m = lam(color, 0.25);
    if (style === 'spiky') {
      for (let i = 0; i < 5; i++) { const c = mesh(G.cone, m, 0.11, 0.34, 0.11, (i - 2) * 0.13, 0.34, (i % 2) * 0.06 - 0.03); c.rotation.z = -(i - 2) * 0.22; head.add(c); }
      head.add(mesh(G.cap, m, 0.325, 0.3, 0.325, 0, 0.02, -0.01));
    } else if (style === 'swoop') {
      head.add(mesh(G.cap, m, 0.335, 0.32, 0.335, 0, 0.03, -0.02));
      const s = mesh(G.box, m, 0.4, 0.12, 0.3, 0.12, 0.2, 0.18); s.rotation.z = -0.35; head.add(s);
    } else if (style === 'ponytail') {
      head.add(mesh(G.cap, m, 0.33, 0.32, 0.33, 0, 0.03, -0.02));
      const t = mesh(G.sph, m, 0.12, 0.4, 0.12, 0, -0.12, -0.36); t.rotation.x = 0.4; head.add(t);
      head.add(mesh(G.sph, neon(0xffffff), 0.06, 0.06, 0.06, 0, 0.1, -0.33));
    } else if (style === 'bob') {
      head.add(mesh(G.cap, m, 0.34, 0.32, 0.34, 0, 0.03, -0.02));
      head.add(mesh(G.box, m, 0.68, 0.38, 0.36, 0, -0.08, -0.12));
    } else {
      head.add(mesh(G.cap, m, 0.33, 0.3, 0.33, 0, 0.03, -0.01));
    }
  }

  function makeMember(spec, pal) {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const skin = lam(spec.skin, 0.2), outfit = lam(spec.outfit, 0.3), accent = neon(pal.accent);
    const legs = [-1, 1].map(s => {
      const p = new THREE.Group(); p.position.set(s * 0.17, 0.88, 0);
      p.add(mesh(G.box, dark, 0.3, 0.85, 0.32, 0, -0.43, 0));
      p.add(mesh(G.box, neon(pal.main), 0.32, 0.1, 0.38, 0, -0.84, 0.03));
      body.add(p); return p;
    });
    body.add(mesh(G.box, outfit, 0.8, 0.96, 0.44, 0, 1.36, 0));
    body.add(mesh(G.box, accent, 0.82, 0.07, 0.46, 0, 1.62, 0));
    body.add(mesh(G.box, accent, 0.07, 0.96, 0.46, 0, 1.36, 0));
    const head = new THREE.Group(); head.position.set(0, 2.12, 0); body.add(head);
    head.add(mesh(G.sph, skin, 0.3, 0.31, 0.3));
    [-1, 1].forEach(s => head.add(mesh(G.sph, dark, 0.04, 0.05, 0.03, s * 0.11, 0.03, 0.27)));
    head.add(mesh(G.box, lam(0xb04a5a, 0.1), 0.11, 0.03, 0.03, 0, -0.1, 0.285));
    makeHair(spec.hairStyle, spec.hair, head);
    const arms = [-1, 1].map(s => {
      const p = new THREE.Group(); p.position.set(s * 0.52, 1.74, 0);
      p.add(mesh(G.box, outfit, 0.22, 0.42, 0.24, 0, -0.2, 0));
      p.add(mesh(G.box, skin, 0.19, 0.4, 0.21, 0, -0.62, 0));
      body.add(p); return p;
    });
    const m = { root, body, head, legs, armL: arms[0], armR: arms[1], role: spec.role, seed: hashStr(spec.stage) % 100 / 100 * 6.28, parts: {} };

    if (spec.role === 'vocal') {
      const mic = new THREE.Group();
      mic.add(mesh(G.cyl, metal, 0.04, 0.22, 0.04, 0, 0, 0));
      mic.add(mesh(G.sph, neon(0xffffff), 0.075, 0.075, 0.075, 0, 0.15, 0));
      mic.position.set(0, -0.82, 0.08); m.armR.add(mic);
    } else if (spec.role === 'guitar' || spec.role === 'bass') {
      const g = new THREE.Group();
      const bodyM = lam(spec.role === 'bass' ? 0x2a1f3d : parseInt(pal.main.slice(1), 16), 0.3);
      g.add(mesh(G.box, bodyM, 0.62, 0.5, 0.14, 0, 0, 0));
      g.add(mesh(G.box, accent, 0.64, 0.05, 0.16, 0, 0.22, 0));
      const len = spec.role === 'bass' ? 1.25 : 1.0;
      g.add(mesh(G.box, dark, len, 0.09, 0.08, -0.5 - len / 2 + 0.3, 0.12, 0));
      g.position.set(0.05, 1.12, 0.3); g.rotation.z = -0.28; body.add(g); m.parts.inst = g;
    } else if (spec.role === 'keys') {
      const k = new THREE.Group();
      k.add(mesh(G.box, dark, 2.0, 0.14, 0.7, 0, 0, 0));
      k.add(mesh(G.box, lam(0xf0f0f8, 0.4), 1.9, 0.05, 0.3, 0, 0.1, 0.14));
      k.add(mesh(G.box, accent, 2.0, 0.05, 0.05, 0, 0.1, -0.3));
      [-0.8, 0.8].forEach(x => k.add(mesh(G.box, metal, 0.08, 1.0, 0.08, x, -0.55, 0)));
      k.position.set(0, 1.5, 0.75); root.add(k);
    } else if (spec.role === 'drums') {
      const kit = new THREE.Group();
      const shell = lam(parseInt(pal.main.slice(1), 16), 0.25);
      const kick = mesh(G.cyl, shell, 0.62, 0.5, 0.62, 0, 0.75, 1.15); kick.rotation.x = Math.PI / 2; kit.add(kick);
      const sn = mesh(G.cyl, metal, 0.36, 0.16, 0.36, -0.55, 1.2, 0.75); kit.add(sn);
      [-0.3, 0.3].forEach((x, i) => kit.add(mesh(G.cyl, shell, 0.3, 0.2, 0.3, x, 1.55, 1.1 + i * 0.0)));
      m.parts.cym = [-1.2, 1.2].map(x => { const c = mesh(G.cyl, lam(0xd9c36a, 0.6), 0.5, 0.025, 0.5, x, 2.05, 0.7); kit.add(c); kit.add(mesh(G.cyl, metal, 0.025, 2.0, 0.025, x, 1.0, 0.7)); return c; });
      kit.add(mesh(G.cyl, dark, 0.38, 0.8, 0.38, 0, 0.4, -0.2));
      root.add(kit);
      m.legs.forEach(l => l.rotation.x = -1.35);
      body.position.y = -0.05;
    }
    return m;
  }

  function init(THREE_scene) {
    BANDS.bands.forEach(b => {
      const g = new THREE.Group(); root.add(g);
      const members = b.members.map(spec => {
        const m = makeMember(spec, b.palette); const f = b.formation[spec.role] || [0, -9];
        m.base = new THREE.Vector3(f[0], 1.5, f[1]); m.root.position.copy(m.base);
        m.root.scale.setScalar(2.0); g.add(m.root); return m;
      });
      bands[b.id] = { spec: b, group: g, members, enter: 0, offX: 0, vocal: members.find(x => x.role === 'vocal') };
      g.position.y = -7; g.visible = false;
    });
    THREE_scene.add(root);
  }

  function update(W, time, dt) {
    const mode = W.seg ? W.seg.band : 'none';
    const e = W.energy, beat = W.bi.beat, h = Math.abs(Math.sin(Math.PI * beat)), P = W.bi.pulse;
    for (const id in bands) {
      const B = bands[id];
      const active = mode === 'both' || mode === id;
      B.enter = lerp(B.enter, active ? 1 : 0, 1 - Math.exp(-dt * 2.2));
      const targetX = mode === 'both' ? (id === 'solar' ? -7.5 : 7.5) : 0;
      B.offX = lerp(B.offX, targetX, 1 - Math.exp(-dt * 2));
      B.group.position.x = B.offX; B.group.position.y = lerp(-7, 0, B.enter);
      B.group.visible = B.enter > 0.02;
      if (!B.group.visible) continue;
      B.members.forEach((m, i) => animate(m, time, beat, h, P, e, id === 'luna'));
    }
    // điểm nhấn: ca sĩ đang hát
    let target = null;
    if (mode === 'both') target = bands[Math.floor(W.bi.bar) % 2 === 0 ? 'solar' : 'luna']; else target = bands[mode];
    if (target) {
      const v = target.vocal, wx = target.group.position.x + v.root.position.x;
      focus.x = lerp(focus.x, wx, 0.08); focus.z = lerp(focus.z, v.root.position.z, 0.08);
    }
  }

  function animate(m, time, beat, h, P, e, girl) {
    const s = m.seed, r = m.role, body = m.body;
    const sway = Math.sin(time * (1.6 + girl * 0.3) + s) * e;
    m.head.rotation.x = h * 0.12 * e; m.head.rotation.z = sway * 0.06;
    if (r === 'vocal') {
      m.root.position.x = m.base.x + Math.sin(time * 0.45 + s) * 2.6 * e;
      m.root.position.z = m.base.z + 0.5 + Math.sin(time * 0.3 + s) * 0.6 * e;
      body.position.y = h * 0.22 * e; body.rotation.z = sway * 0.05;
      m.armR.rotation.x = -2.1 + P * 0.15; m.armR.rotation.z = -0.15;
      const hype = e > 0.85;
      m.armL.rotation.z = hype ? 2.6 + Math.sin(time * 5 + s) * 0.35 : 0.35 + Math.sin(time * 2) * 0.1;
      m.armL.rotation.x = 0;
      m.legs[0].rotation.x = Math.sin(time * 3 + s) * 0.2 * e; m.legs[1].rotation.x = -m.legs[0].rotation.x;
    } else if (r === 'guitar' || r === 'bass') {
      body.position.y = h * 0.12 * e; body.rotation.z = sway * 0.1; body.rotation.y = Math.sin(time * 0.7 + s) * 0.2;
      m.armR.rotation.x = -0.9 + Math.sin(time * (r === 'guitar' ? 15 : 8) + s) * 0.3 * e;
      m.armL.rotation.x = -1.15; m.armL.rotation.z = -0.5;
      m.legs[0].rotation.z = 0.12 + h * 0.05; m.legs[1].rotation.z = -0.12 - h * 0.05;
    } else if (r === 'keys') {
      body.position.y = h * 0.1 * e; body.rotation.z = sway * 0.08;
      m.armL.rotation.x = -1.2 + Math.sin(time * 6 + s) * 0.25 * e; m.armR.rotation.x = -1.2 + Math.sin(time * 7 + 1) * 0.25 * e;
    } else if (r === 'drums') {
      const a = beat * Math.PI * 4;
      m.armR.rotation.x = -1.0 - Math.max(0, Math.sin(a)) * 0.9 * e - 0.2;
      m.armL.rotation.x = -1.0 - Math.max(0, Math.sin(a + Math.PI)) * 0.9 * e - 0.2;
      m.armR.rotation.z = -0.4; m.armL.rotation.z = 0.4;
      body.position.y = -0.05 + h * 0.06 * e;
      if (m.parts.cym) m.parts.cym.forEach((c, i) => { c.rotation.z = Math.sin(time * 30 + i) * 0.04 * P * e; });
    }
  }

  return { init, update, root, focusPoint() { return focus; } };
})();
