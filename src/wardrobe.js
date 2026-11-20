/* ===== wardrobe: phòng thay đồ, xem trước 3D xoay được, lưu lựa chọn ===== */
const Wardrobe = (() => {
  const KEY = 'nm_look_v1';
  let renderer, scene, cam, geo, mesh, uni, sparkles, spk = [];
  let active = false, ready = false, look = null, confirmed = false;
  let yaw = 0, dragYaw = 0, idle = 0, tab = 0, onDone = () => { };
  const $ = id => document.getElementById(id);

  function load() { try { const a = JSON.parse(localStorage.getItem(KEY) || 'null'); return Crowd.Look.valid(a) ? a : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(look)); } catch (e) { } }
  const saved = load();
  if (saved) { look = saved; confirmed = true; }

  const W = WARDROBE;
  const TABS = [
    { name: 'Áo', groups: [{ label: 'Kiểu', i: 0, items: W.tops.map(t => ({ v: t.id, name: t.name })) }, { label: 'Màu áo', i: 1, swatch: true, items: W.topColors.map((c, v) => ({ v, c, name: 'Màu ' + (v + 1) })) }] },
    { name: 'Tóc', groups: [{ label: 'Kiểu', i: 2, items: W.hairStyles.map(t => ({ v: t.id, name: t.name })) }, { label: 'Màu tóc', i: 3, swatch: true, items: W.hairColors.map((c, v) => ({ v, c, name: 'Màu ' + (v + 1) })) }] },
    { name: 'Phụ kiện', groups: [{ label: 'Trên đầu', i: 4, items: W.headAcc.map(t => ({ v: t.id, name: t.name })) }, { label: 'Sau lưng', i: 5, items: W.backAcc.map(t => ({ v: t.id, name: t.name })) }] },
    { name: 'Gậy sáng', groups: [{ label: 'Màu phát sáng', i: 7, swatch: true, items: W.stickColors.map((c, v) => ({ v, c, name: c === 'follow' ? 'Đổi màu theo bài' : 'Màu ' + v })) }] },
    { name: 'Da', groups: [{ label: 'Màu da', i: 6, swatch: true, items: W.skins.map((c, v) => ({ v, c, name: 'Tông ' + (v + 1) })) }] }
  ];

  function build() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x07050f);
    cam = new THREE.PerspectiveCamera(36, 1, 0.1, 60); cam.position.set(0, 1.25, 4.9); cam.lookAt(0, 1.0, 0);
    uni = Crowd.newUniforms(); uni.uFogD.value = 0; uni.uLdir.value.set(0.35, 0.5, 1); uni.uLit.value = 1.2; uni.uAmb.value = 0.55; uni.uEnergy.value = 0.5;
    uni.uColA.value.set('#19e3ff'); uni.uColB.value.set('#ff2bd6');
    geo = Crowd.makeInstGeo(Crowd.buildBase(true), 1); geo.instanceCount = 1;
    geo.attributes.iAnim.array.set([0.3, 3.4, 1.0, 1], 0);
    mesh = new THREE.Mesh(geo, Crowd.makeMaterial(uni)); mesh.frustumCulled = false; scene.add(mesh);
    // bệ đứng và vòng sáng
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.14, 40), new THREE.MeshBasicMaterial({ color: 0x14102a })); base.position.y = -0.07; scene.add(base);
    const r1 = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.2, 48), new THREE.MeshBasicMaterial({ color: 0x19e3ff })); r1.rotation.x = -Math.PI / 2; r1.position.y = 0.01; scene.add(r1);
    const r2 = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.36, 48), new THREE.MeshBasicMaterial({ color: 0xff2bd6 })); r2.rotation.x = -Math.PI / 2; r2.position.y = 0.01; scene.add(r2);
    const arc = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.82, 64), new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.8 })); arc.position.set(0, 1.25, -1.4); scene.add(arc);
    const arc2 = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.4, 64), new THREE.MeshBasicMaterial({ color: 0x19e3ff, transparent: true, opacity: 0.7 })); arc2.position.set(0, 1.25, -1.35); scene.add(arc2);
    [[-1.6, 0x19e3ff], [1.6, 0xff2bd6]].forEach(([x, c]) => {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.9, 5, 16, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      s.position.set(x, 2.4, -0.8); scene.add(s);
    });
    const N = 70, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, r = 0.6 + Math.random() * 1.8; spk.push({ a, r, y: Math.random() * 3, s: 0.1 + Math.random() * 0.25 }); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sparkles = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.05, color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    sparkles.frustumCulled = false; scene.add(sparkles);
    ready = true;
  }

  function applyLook() { Crowd.Look.apply(geo, 0, look); Crowd.touch(geo); }

  function renderTabs() {
    const t = $('wdTabs'); t.innerHTML = '';
    TABS.forEach((x, i) => {
      const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', i === tab); b.textContent = x.name;
      b.addEventListener('click', () => { tab = i; renderTabs(); renderOpts(); });
      t.appendChild(b);
    });
  }
  function renderOpts() {
    const box = $('wdOpts'); box.innerHTML = '';
    TABS[tab].groups.forEach(g => {
      const d = document.createElement('div'); d.className = 'wd-g';
      const h = document.createElement('h3'); h.textContent = g.label; d.appendChild(h);
      const row = document.createElement('div'); row.className = g.swatch ? 'wd-row sw' : 'wd-row';
      g.items.forEach(it => {
        const b = document.createElement('button'); b.className = g.swatch ? 'swatch' : 'opt';
        b.setAttribute('aria-pressed', look[g.i] === it.v); b.setAttribute('aria-label', it.name); b.title = it.name;
        if (g.swatch) { b.style.setProperty('--c', it.c === 'follow' ? 'conic-gradient(#19e3ff,#ff2bd6,#ffd34d,#19e3ff)' : it.c); if (it.c === 'follow') b.classList.add('follow'); } else b.textContent = it.name;
        b.addEventListener('click', () => { look[g.i] = it.v; applyLook(); renderOpts(); });
        row.appendChild(b);
      });
      d.appendChild(row); box.appendChild(d);
    });
  }

  function layout() {
    if (!cam) return;
    const w = window.innerWidth, h = window.innerHeight;
    cam.aspect = w / h;
    if (w >= 760) cam.setViewOffset(w, h, Math.min(420, w * 0.4) / 2, 0, w, h);
    else cam.setViewOffset(w, h, 0, h * 0.2, w, h);
    cam.updateProjectionMatrix();
  }

  function finish() {
    confirmed = true; save(); active = false; $('wardrobe').hidden = true; onDone(look.slice());
  }

  function init(r) {
    renderer = r;
    $('wdDone').addEventListener('click', finish);
    $('wdRandom').addEventListener('click', () => { look = Crowd.Look.random(); applyLook(); renderOpts(); });
    document.addEventListener('keydown', e => { if (active && e.key === 'Escape') finish(); });
  }

  return {
    init, resize: layout,
    open(cb) {
      if (!ready) build();
      if (cb) onDone = cb;
      if (!look) look = W.defaultLook.slice();
      active = true; tab = 0; $('wardrobe').hidden = false;
      applyLook(); renderTabs(); renderOpts(); layout();
      const f = $('wdDone'); if (f) f.focus();
    },
    isActive() { return active; },
    hasSaved() { return confirmed; },
    getLook() { return look ? look.slice() : W.defaultLook.slice(); },
    rotate(dx) { dragYaw += dx; idle = 0; },
    render(time, dt) {
      idle += dt; if (idle > 2.2) yaw += dt * 0.7;
      uni.uYaw.value = Math.PI + yaw + dragYaw; uni.uTime.value = time; uni.uPulse.value = 0.5 + 0.5 * Math.sin(time * 2.2);
      const p = sparkles.geometry.attributes.position.array;
      for (let i = 0; i < spk.length; i++) { const s = spk[i]; s.y += dt * s.s; if (s.y > 3.2) s.y = 0; s.a += dt * 0.15; p[i * 3] = Math.cos(s.a) * s.r; p[i * 3 + 1] = s.y; p[i * 3 + 2] = Math.sin(s.a) * s.r - 0.4; }
      sparkles.geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, cam);
    }
  };
})();
