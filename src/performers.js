/* ===== performers: chỉ có ca sĩ (không nhạc cụ). Số người theo từng bài, nhảy đồng bộ, bộ động tác trình diễn dựng chồng lên clip ===== */
const Performers = (() => {
  const root = new THREE.Group();
  const bands = {};
  const focus = { x: 0, z: -7 };
  const SC = 1.12;
  const CAST = { s1: 1, s2: 3, finale: 2, outro: 3 };   // số ca sĩ mỗi ban nhạc theo bài
  const FORM = {
    1: [[0, -7]],
    2: [[-3.4, -7], [3.4, -7]],
    3: [[0, -6.6], [-4.8, -8.4], [4.8, -8.4]],
    4: [[0, -6.4], [-4.6, -8], [4.6, -8], [0, -10.6]]
  };
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a86a0, roughness: 0.35, metalness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15121f, roughness: 0.6, metalness: 0.3 });

  function near(list, hex) {
    const t = new THREE.Color(hex); let bi = 0, bd = 9;
    list.forEach((c, i) => { const k = new THREE.Color(c), d = (k.r - t.r) ** 2 + (k.g - t.g) ** 2 + (k.b - t.b) ** 2; if (d < bd) { bd = d; bi = i; } });
    return bi;
  }
  /* trang phục sân khấu: áo khoác ranger + quần/váy tối, ủng, phụ kiện */
  const STY = {
    M: { top: [5, 4, 5, 3], tcw: { solar: [1, 5, 3, 1], luna: [5, 5, 5, 5] }, bot: [0, 1, 0, 0], bcw: [5, 5, 5, 1], head: [1, 2, 2, 0] },
    F: { top: [5, 4, 5, 4], tcw: { solar: [2, 5, 3, 2], luna: [2, 5, 4, 2] }, bot: [4, 2, 4, 2], bcw: [2, 5, 2, 5], head: [1, 2, 0, 2] }
  };
  const HAIR = { M: { spiky: 0, swoop: 0, short: 1, bob: 0, ponytail: 0 }, F: { ponytail: 0, bob: 3, spiky: 2, swoop: 3, short: 2 } };
  function lookFor(spec, band, i) {
    const g = band.type === 'girl' ? 0 : 1, G = g ? 'M' : 'F', V = Avatar.V3, S = STY[G];
    const l = Avatar.Look.def(g);
    l[1] = S.top[i % 4]; l[2] = S.tcw[band.id === 'luna' ? 'luna' : 'solar'][i % 4];
    l[3] = S.bot[i % 4]; l[4] = S.bcw[i % 4]; l[5] = 1; l[6] = 5;
    l[7] = HAIR[G][spec.hairStyle] != null ? HAIR[G][spec.hairStyle] : 0; l[8] = near(V.hairColors, spec.hair); l[9] = near(V.skins, spec.skin);
    l[10] = 0; l[11] = S.head[i % 4]; l[12] = 1; l[13] = 1;
    return l;
  }

  /* ---- micro: đặt theo toạ độ thế giới (tay phải → hướng về miệng) ---- */
  function makeMic() {
    const m = new THREE.Group();
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.17, 12), dark); h.position.y = 0.0; m.add(h);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), metal); c.position.y = 0.115; m.add(c);
    return m;
  }

  /* ---- chỉnh xương theo hướng thế giới (không phụ thuộc trục xương) ---- */
  const _p = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _w = new THREE.Quaternion(), _pq = new THREE.Quaternion();
  function aim(bone, dirW, w) {
    if (!bone) return;
    const ch = bone.children.find(x => x.isBone); if (!ch) return;
    bone.updateWorldMatrix(true, false); ch.updateWorldMatrix(true, false);
    bone.getWorldPosition(_p); ch.getWorldPosition(_c); _d.copy(_c).sub(_p).normalize();
    _q.setFromUnitVectors(_d, dirW);
    bone.getWorldQuaternion(_w); _w.premultiply(_q);
    bone.parent.getWorldQuaternion(_pq); _pq.invert(); _w.premultiply(_pq);
    bone.quaternion.slerp(_w, w);
    bone.updateMatrixWorld(true);
  }

  /* ---- bộ động tác. toạ độ nhân vật: x = trái nhân vật, y = lên, z = phía trước (khán giả) ---- */
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  function pose(name, b, P) {
    // trả về {lu, lf, ru, rf, wl, wr} hướng cánh tay trên/dưới của tay trái (L) và tay phải cầm micro (R)
    const s = Math.sin(b * Math.PI * 2), s2 = Math.sin(b * Math.PI), beatUp = Math.abs(s2);
    const mic = { ru: V3(-0.2, -0.5, 0.85), rf: V3(0.05, 0.85, 0.55), wr: 1 };
    switch (name) {
      case 'sing': return Object.assign({ lu: V3(0.75, -0.15 + 0.35 * s2, 0.4), lf: V3(0.8, 0.1 + 0.4 * s, 0.5), wl: 0.9 }, mic);
      case 'wave': return Object.assign({ lu: V3(0.7, 0.55, 0.25), lf: V3(0.25 + 0.55 * Math.sin(b * Math.PI * 4), 0.9, 0.1), wl: 1 }, mic);
      case 'point': { const a = Math.floor(b / 2) % 2 ? -0.6 : 0.85; return Object.assign({ lu: V3(a, 0.15, 0.55), lf: V3(a, 0.25 + 0.1 * s, 0.6), wl: 1 }, mic); }
      case 'pump': return Object.assign({ lu: V3(0.35, 0.6 + 0.2 * beatUp, 0.5), lf: V3(0.1, 0.9 + 0.3 * beatUp, 0.25), wl: 1 }, mic);
      case 'clap': { const k = Math.abs(Math.sin(b * Math.PI * 2)); return { lu: V3(0.3, 0.95, 0.2), lf: V3(0.55 - 0.9 * k, 0.8, 0.3), wl: 1, ru: V3(-0.3, 0.95, 0.2), rf: V3(-0.55 + 0.9 * k, 0.8, 0.3), wr: 1 }; }
      case 'hype': return { lu: V3(0.55, 0.8, 0.2), lf: V3(0.3 + 0.35 * s, 0.9, 0.1), wl: 1, ru: V3(-0.55, 0.8, 0.2), rf: V3(-0.3 - 0.35 * s, 0.9, 0.1), wr: 1 };
      case 'jump': return { lu: V3(0.5, 0.9, 0.2), lf: V3(0.35, 0.95, 0.1), wl: 1, ru: V3(-0.5, 0.9, 0.2), rf: V3(-0.35, 0.95, 0.1), wr: 1 };
      case 'spin': return Object.assign({ lu: V3(1, 0.05, 0.05), lf: V3(1, 0.1, 0.05), wl: 1 }, mic);
      case 'dance': return Object.assign({ lu: V3(0.6, -0.1 + 0.5 * beatUp, 0.55), lf: V3(0.7, 0.4 + 0.4 * s, 0.5), wl: 0.85 }, mic);
      default: return null;
    }
  }
  const SEQ = {
    lo: ['sing', 'wave', 'sing', 'point'],
    mid: ['dance', 'point', 'pump', 'sing', 'clap', 'wave'],
    hi: ['hype', 'spin', 'pump', 'dance', 'clap', 'jump', 'point', 'hype']
  };

  async function make(B, spec, i) {
    const a = await Avatar.create(lookFor(spec, B.spec, i));
    const m = { a, root: new THREE.Group(), idx: i, spec, vis: 0, mode: '', move: 'sing', seed: hashStr(spec.stage) % 100 / 100 * 6.28, pos: new THREE.Vector3(), cur: { lu: V3(0.2, -1, 0), lf: V3(0.2, -1, 0), ru: V3(-0.2, -1, 0), rf: V3(-0.2, -1, 0), wl: 0, wr: 0 }, spin: 0 };
    m.root.add(a.root); m.root.scale.setScalar(0.001); B.group.add(m.root);
    const f = FORM[1][0]; m.pos.set(f[0], 1.5, f[1]); m.root.position.copy(m.pos);
    m.mic = makeMic(); m.mic.scale.setScalar(SC); root.add(m.mic);
    m.hand = a.bones.hand_r; m.head = a.bones.head || a.bones.neck_01;
    a.play('dance', 0.01); a.speed('dance', 0.6); m.mode = 'dance';
    B.members[i] = m; if (i === 0) B.vocal = m;
  }

  function init(THREE_scene) {
    BANDS.bands.forEach(b => {
      const gp = new THREE.Group(); root.add(gp);
      const B = { spec: b, group: gp, members: [], enter: 0, offX: 0, vocal: null, ready: false, vp: 0, vdir: 0, es: 0.3 };
      bands[b.id] = B; gp.position.y = -7; gp.visible = false;
      const order = b.members.filter(s => s.role === 'vocal').concat(b.members.filter(s => s.role !== 'vocal'));
      Promise.all(order.map((spec, i) => make(B, spec, i))).then(() => { B.ready = true; }).catch(e => console.warn('band', e));
      THREE_scene.add(root);
    });
  }

  function update(W, time, dt) {
    const mode = W.seg ? W.seg.band : 'none';
    const e = W.energy, cast = (W.seg && CAST[W.seg.id]) || 1;
    for (const id in bands) {
      const B = bands[id];
      const active = mode === 'both' || mode === id;
      B.enter = lerp(B.enter, active ? 1 : 0, 1 - Math.exp(-dt * 2.2));
      B.es = lerp(B.es, e, 1 - Math.exp(-dt * 0.8));
      const targetX = mode === 'both' ? (id === 'solar' ? -13 : 13) : 0;
      B.offX = lerp(B.offX, targetX, 1 - Math.exp(-dt * 2));
      B.group.position.x = B.offX; B.group.position.y = lerp(-7, 0, B.enter);
      B.group.visible = B.enter > 0.02 && B.ready;
      if (!B.group.visible) { B.members.forEach(m => { if (m) m.mic.visible = false; }); continue; }
      const featured = mode === 'both' ? Math.floor(W.bi.bar) % 2 === (id === 'solar' ? 0 : 1) : active;
      const want = featured && B.es > 0.55 && cast <= 2 && Math.floor(W.bi.bar / 2) % 2 === 1 ? 1 : 0;
      B.vdir = Math.sign(want - B.vp); B.vp += clamp(want - B.vp, -dt * 0.085, dt * 0.085);
      B.members.forEach(m => m && animate(m, B, dt, time, W, cast));
    }
    let target = null;
    if (mode === 'both') target = bands[Math.floor(W.bi.bar) % 2 === 0 ? 'solar' : 'luna']; else target = bands[mode];
    if (target && target.vocal) {
      const v = target.vocal, wx = target.group.position.x + v.root.position.x;
      focus.x = lerp(focus.x, wx, 0.08); focus.z = lerp(focus.z, v.root.position.z, 0.08);
    }
  }

  const _hp = new THREE.Vector3(), _hh = new THREE.Vector3(), _bq = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
  function animate(m, B, dt, time, W, cast) {
    const bpm = B.spec.bpm || 118, bps = bpm / 60, e = W.energy, s = m.seed;
    const on = m.idx < cast; m.vis = clamp(m.vis + (on ? 1 : -1) * dt * 1.2, 0, 1);
    const vv = m.vis * m.vis * (3 - 2 * m.vis);
    m.root.visible = m.vis > 0.02; m.root.scale.setScalar(Math.max(0.001, SC * vv));
    if (!m.root.visible) { m.mic.visible = false; return; }
    // vị trí theo đội hình của bài
    const f = (FORM[Math.min(4, cast)] || FORM[1])[Math.min(m.idx, Math.min(4, cast) - 1)] || [0, -8];
    const k = 1.35; m.pos.x += (f[0] * k - m.pos.x) * Math.min(1, dt * 1.5); m.pos.z += (f[1] - m.pos.z) * Math.min(1, dt * 1.5);
    // chọn động tác theo nhịp (đồng bộ cả nhóm, lệch nhẹ theo người)
    const b = time * bps - m.idx * 0.15;
    const seq = B.es < 0.4 ? SEQ.lo : B.es < 0.72 ? SEQ.mid : SEQ.hi;
    const si = Math.floor(b / 8), name = seq[(si + (m.idx === 0 && cast > 2 ? 0 : 0)) % seq.length];
    const ph = (b / 8) % 1, bb = b;
    // đường chạy ra sân khấu phụ (ca sĩ chính)
    let ep = 0, moving = false;
    if (m.idx === 0) { const p = B.vp; ep = p * p * (3 - 2 * p); moving = Math.abs(B.vdir) > 0 && p > 0.004 && p < 0.996; }
    const wantClip = moving ? 'jog' : 'dance';
    if (wantClip !== m.mode) { m.a.play(wantClip, 0.4); m.mode = wantClip; if (wantClip === 'jog') m.a.speed('jog', 0.9); }
    if (!moving) m.a.speed('dance', name === 'sing' || name === 'wave' || name === 'point' ? 0.55 : name === 'hype' || name === 'jump' || name === 'pump' ? bpm / 75 * 1.15 : bpm / 75);
    const wx = Math.sin(time * 0.45 + s) * (name === 'sing' ? 1.6 : 2.6) * e;
    m.root.position.x = (m.pos.x + wx * (m.idx === 0 ? 1 : 0.4)) * (1 - ep) - B.group.position.x * ep + Math.sin(time * 0.8 + s) * 1.2 * ep * e;
    m.root.position.z = m.pos.z + (27 - m.pos.z) * ep + (m.idx === 0 ? Math.sin(time * 0.3 + s) * 0.6 * e * (1 - ep) : 0);
    let y = m.pos.y, hop = Math.abs(Math.sin(Math.PI * b));
    if (name === 'jump' && !moving) y += hop * hop * 0.55; else if (name === 'pump' || name === 'hype') y += hop * 0.1;
    m.root.position.y = y;
    // xoay người: quay vòng, hoặc quay về khi chạy lại sân khấu
    let face = moving && B.vdir < 0 ? Math.PI : 0;
    if (name === 'spin' && !moving) face += Math.min(1, Math.max(0, (ph - 0.02) / 0.22)) * Math.PI * 2;
    if (name === 'point' || name === 'wave') face += Math.sin(time * 0.6 + s) * 0.3;
    m.spin += (face - m.spin) * Math.min(1, dt * (name === 'spin' ? 9 : 5)); m.root.rotation.y = m.spin;
    m.a.update(dt, bpm);
    // cột sống, cổ: nhún theo nhịp
    const P = W.bi.pulse, kk = e * 0.6 + 0.25, h = Math.abs(Math.sin(Math.PI * W.bi.beat)), bn = m.a.bones;
    sway(bn.spine_02, 0, Math.sin(time * 1.1 + s) * 0.05 * kk, Math.sin(time * 1.7 + s) * 0.04 * kk);
    sway(bn.spine_03, h * 0.05 * e + (name === 'point' ? 0.1 : 0), Math.sin(time * 0.9 + s * 2) * 0.05 * kk, 0);
    sway(bn.neck_01, Math.sin(time * 1.3 + s) * 0.04 * kk + h * 0.06 * e - (name === 'sing' ? P * 0.1 : 0), Math.sin(time * 0.6 + s) * 0.08 * kk, 0);
    // tay: hướng cánh tay theo động tác, làm mượt giữa các động tác
    m.root.updateWorldMatrix(true, true);
    const ps = pose(name, bb, P) || pose('sing', bb, P);
    const c = m.cur, kd = 1 - Math.exp(-dt * 9);
    if (moving) { ps.lu = V3(0.6, 0.1, 0.5); ps.lf = V3(0.5, 0.2, 0.6); ps.wl = 0.7; }
    ['lu', 'lf', 'ru', 'rf'].forEach(key => c[key].lerp(ps[key], kd));
    c.wl += (ps.wl - c.wl) * kd; c.wr += (ps.wr - c.wr) * kd;
    m.a.root.getWorldQuaternion(_bq);
    const dirs = { lu: c.lu.clone().normalize().applyQuaternion(_bq), lf: c.lf.clone().normalize().applyQuaternion(_bq), ru: c.ru.clone().normalize().applyQuaternion(_bq), rf: c.rf.clone().normalize().applyQuaternion(_bq) };
    aim(bn.upperarm_l, dirs.lu, c.wl); aim(bn.lowerarm_l, dirs.lf, c.wl);
    aim(bn.upperarm_r, dirs.ru, c.wr); aim(bn.lowerarm_r, dirs.rf, c.wr);
    // micro bám tay phải, hướng về miệng
    if (m.hand && m.head) {
      m.hand.getWorldPosition(_hp); m.head.getWorldPosition(_hh); _hh.y -= 0.02;
      root.worldToLocal(_hp); root.worldToLocal(_hh);
      m.mic.visible = true; m.mic.position.copy(_hp);
      _hh.sub(_hp); if (_hh.lengthSq() > 1e-6) { _hh.normalize(); m.mic.quaternion.setFromUnitVectors(_up, _hh); }
    }
  }
  const _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
  function sway(b, x, y, z) { if (b) b.quaternion.multiply(_q2.setFromEuler(_e.set(x, y, z))); }

  return { init, update, root, focusPoint() { return focus; } };
})();
