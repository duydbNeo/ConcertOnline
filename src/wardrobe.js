/* ===== wardrobe: phòng thay đồ 3D, tủ đồ riêng cho nam và nữ, xem trước xoay được ===== */
const Wardrobe = (() => {
  const KEY = 'nm_look_v3';
  let renderer, scene, cam, sparkles, spk = [], av = null, avG = -1, loading = false;
  let active = false, ready = false, look = null, confirmed = false;
  let yaw = 0, dragYaw = 0, idle = 0, tab = 0, onDone = () => { }, hi = 0;
  const $ = id => document.getElementById(id);
  const V3 = Avatar.V3, G = Avatar.G, L = Avatar.Look, gk = i => (i ? 'M' : 'F');

  function load() { try { const a = JSON.parse(localStorage.getItem(KEY) || 'null'); return L.valid(a) ? a : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(look)); } catch (e) { } }
  const saved = load();
  if (saved) { look = saved; confirmed = true; }

  const cwItems = () => V3.colorways.map((c, v) => ({ v, c: c.hex, name: c.name }));
  function tabs() {
    const d = G[gk(look[0])];
    return [
      { name: 'Giới', groups: [{ label: 'Chọn nhân vật', i: 0, items: [{ v: 0, name: 'Nữ' }, { v: 1, name: 'Nam' }], gender: true }] },
      { name: 'Áo', groups: [{ label: 'Kiểu áo', i: 1, items: d.tops.map((t, v) => ({ v, name: t.name })) }, { label: 'Màu áo', i: 2, swatch: true, items: cwItems() }] },
      { name: d.bottoms.some(b => b.id === 'skirt') ? 'Quần, váy' : 'Quần', groups: [{ label: 'Kiểu', i: 3, items: d.bottoms.map((t, v) => ({ v, name: t.name })) }, { label: 'Màu', i: 4, swatch: true, items: cwItems() }] },
      { name: 'Giày', groups: [{ label: 'Kiểu giày', i: 5, items: d.shoes.map((t, v) => ({ v, name: t.name })) }, { label: 'Màu giày', i: 6, swatch: true, items: cwItems() }] },
      { name: 'Tóc', groups: [{ label: 'Kiểu tóc', i: 7, items: d.hair.map((t, v) => ({ v, name: t.name })) }, { label: 'Màu tóc', i: 8, swatch: true, items: V3.hairColors.map((c, v) => ({ v, c, name: 'Màu ' + (v + 1) })) }] },
      { name: 'Phụ kiện', groups: [
        { label: 'Trên đầu', i: 11, items: V3.acc.head.map((t, v) => ({ v, name: t.name })) },
        { label: 'Cổ', i: 12, items: V3.acc.neck.map((t, v) => ({ v, name: t.name })) },
        { label: 'Cổ tay', i: 13, items: V3.acc.wrist.map((t, v) => ({ v, name: t.name })) },
        { label: 'Sau lưng', i: 14, items: V3.acc.back.map((t, v) => ({ v, name: t.name })) },
        { label: 'Cầm tay', i: 15, items: V3.acc.hand.map((t, v) => ({ v, name: t.name })) },
        { label: 'Món ghép thêm', mask: true, items: d.extras.map((t, v) => ({ v, name: t.name })) }] },
      { name: 'Da', groups: [{ label: 'Màu da', i: 9, swatch: true, items: V3.skins.map((c, v) => ({ v, c, name: 'Tông ' + (v + 1) })) }] }
    ];
  }

  function build() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x07050f);
    cam = new THREE.PerspectiveCamera(34, 1, 0.1, 60); cam.position.set(0, 1.15, 4.6); cam.lookAt(0, 0.92, 0);
    scene.add(new THREE.HemisphereLight(0x8a8ad8, 0x1a1030, 0.9));
    const k = new THREE.DirectionalLight(0xffffff, 0.9); k.position.set(1.5, 3, 4); scene.add(k);
    const r = new THREE.DirectionalLight(0x19e3ff, 1.1); r.position.set(-3, 2.2, -2); scene.add(r);
    const r2 = new THREE.DirectionalLight(0xff2bd6, 1.1); r2.position.set(3, 2.2, -2); scene.add(r2);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.08, 0.12, 40), new THREE.MeshBasicMaterial({ color: 0x14102a })); base.position.y = -0.06; scene.add(base);
    const r1 = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.95, 48), new THREE.MeshBasicMaterial({ color: 0x19e3ff })); r1.rotation.x = -Math.PI / 2; r1.position.y = 0.01; scene.add(r1);
    const rr = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.1, 48), new THREE.MeshBasicMaterial({ color: 0xff2bd6 })); rr.rotation.x = -Math.PI / 2; rr.position.y = 0.01; scene.add(rr);
    const arc = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.55, 64), new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.8 })); arc.position.set(0, 1.0, -1.4); scene.add(arc);
    const arc2 = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.15, 64), new THREE.MeshBasicMaterial({ color: 0x19e3ff, transparent: true, opacity: 0.7 })); arc2.position.set(0, 1.0, -1.35); scene.add(arc2);
    [[-1.4, 0x19e3ff], [1.4, 0xff2bd6]].forEach(([x, c]) => {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.8, 4.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      s.position.set(x, 2.0, -0.8); scene.add(s);
    });
    const N = 60, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, rr2 = 0.6 + Math.random() * 1.5; spk.push({ a, r: rr2, y: Math.random() * 2.6, s: 0.1 + Math.random() * 0.25 }); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sparkles = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.04, color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    sparkles.frustumCulled = false; scene.add(sparkles);
    ready = true;
  }

  async function sync() {
    if (loading) { return; }
    loading = true; $('wdLoad').hidden = false;
    try {
      while (true) {
        const want = look.slice();
        if (!av || avG !== want[0]) { if (av) { scene.remove(av.root); av = null; } const a = await Avatar.create(want); av = a; avG = want[0]; scene.add(av.root); av.play('dance'); }
        else av.setLook(want);
        if (look.join() === want.join()) break;
      }
    } catch (e) { console.error('AVATAR', e && (e.stack || e.message || e)); $('wdLoad').textContent = 'Không tải được nhân vật. Kiểm tra mạng rồi thử lại.'; loading = false; return; }
    $('wdLoad').hidden = true; loading = false;
  }
  function change(i, v) {
    if (i === 0 && look[0] !== v) { const n = L.def(v); n[9] = look[9]; look = n; tab = 0; } else look[i] = v;
    sync(); renderTabs(); renderOpts();
  }

  function renderTabs() {
    const t = $('wdTabs'); t.innerHTML = '';
    tabs().forEach((x, i) => {
      const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', i === tab); b.textContent = x.name;
      b.addEventListener('click', () => { tab = i; renderTabs(); renderOpts(); });
      t.appendChild(b);
    });
  }
  function renderOpts() {
    const box = $('wdOpts'); box.innerHTML = '';
    tabs()[tab].groups.forEach(g => {
      const d = document.createElement('div'); d.className = 'wd-g';
      const h = document.createElement('h3'); h.textContent = g.label; d.appendChild(h);
      const row = document.createElement('div'); row.className = g.swatch ? 'wd-row sw' : 'wd-row';
      g.items.forEach(it => {
        const b = document.createElement('button'); b.className = g.swatch ? 'swatch' : 'opt';
        const on = g.mask ? !!(look[10] & (1 << it.v)) : look[g.i] === it.v;
        b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', it.name); b.title = it.name;
        if (g.swatch) b.style.setProperty('--c', it.c); else b.textContent = it.name;
        b.addEventListener('click', () => {
          if (g.mask) { look[10] ^= (1 << it.v); sync(); renderOpts(); } else change(g.i, it.v);
        });
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

  function finish() { confirmed = true; save(); active = false; $('wardrobe').hidden = true; onDone(look.slice()); }

  function init(r) {
    renderer = r;
    $('wdDone').addEventListener('click', finish);
    $('wdRandom').addEventListener('click', () => { look = L.random(look[0]); sync(); renderTabs(); renderOpts(); });
    document.addEventListener('keydown', e => { if (active && e.key === 'Escape') finish(); });
  }

  return {
    init, resize: layout,
    open(cb) {
      if (!ready) build();
      if (cb) onDone = cb;
      if (!look) look = L.def(0);
      active = true; tab = look && confirmed ? 1 : 0; $('wardrobe').hidden = false;
      sync(); renderTabs(); renderOpts(); layout();
      const f = $('wdDone'); if (f) f.focus();
    },
    isActive() { return active; }, _av() { return av; },
    hasSaved() { return confirmed; },
    getLook() { return look ? look.slice() : L.def(0); },
    rotate(dx) { dragYaw += dx; idle = 0; },
    render(time, dt) {
      idle += dt; if (idle > 2.2) yaw += dt * 0.6;
      if (av) { av.root.rotation.y = yaw + dragYaw; av.update(dt, 118); }
      const p = sparkles.geometry.attributes.position.array;
      for (let i = 0; i < spk.length; i++) { const s = spk[i]; s.y += dt * s.s; if (s.y > 2.8) s.y = 0; s.a += dt * 0.15; p[i * 3] = Math.cos(s.a) * s.r; p[i * 3 + 1] = s.y; p[i * 3 + 2] = Math.sin(s.a) * s.r - 0.4; }
      sparkles.geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, cam);
    }
  };
})();
