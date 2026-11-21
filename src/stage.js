/* ===== stage: renderer, sân khấu, tường LED, đèn, hiệu ứng, camera ===== */
/* ===== phân khu khán giả + lối catwalk ra giữa sân ===== */
const Zones = (() => {
  const runway = { w: 4.6, z0: -4, z1: 22 }, bst = { x: 0, z: 29.5, r: 8 };
  const list = [
    { id: 'pit', name: 'PIT', sub: 'Sát sân khấu', color: '#ff2bd6', rects: [[-27, -5.5, 4.5, 15], [5.5, 27, 4.5, 15]], w: 0.3 },
    { id: 'a', name: 'KHU A', sub: 'Đứng giữa sân', color: '#19e3ff', rects: [[-27, -6, 17, 33], [6, 27, 17, 33]], w: 0.3 },
    { id: 'b', name: 'KHU B', sub: 'Đứng phía sau', color: '#ffc23d', rects: [[-27, 27, 38.5, 53]], w: 0.2 },
    { id: 'vip', name: 'VIP', sub: 'Khán đài hai cánh', color: '#a15cff', rects: [[-44, -30, 6, 30], [30, 44, 6, 30]], w: 0.2 }
  ];
  function blocked(x, z, pad) {
    pad = pad || 0;
    if (Math.abs(x) < runway.w / 2 + 1.2 + pad && z > runway.z0 - 1 && z < runway.z1 + 2) return true;
    const dx = x - bst.x, dz = z - bst.z; return dx * dx + dz * dz < (bst.r + 1.6 + pad) * (bst.r + 1.6 + pad);
  }
  // lưới vị trí cho từng khu, cách nhau step
  function grid(z, step) {
    const out = [];
    z.rects.forEach(r => { for (let zz = r[2] + 0.8; zz <= r[3] - 0.5; zz += step) for (let x = r[0] + 0.8; x <= r[1] - 0.5; x += step) if (!blocked(x, zz, 0.2)) out.push([x, zz]); });
    out.sort((a, b) => Math.abs(a[0]) - Math.abs(b[0]) || a[1] - b[1]);
    return out;
  }
  const cell = {}; list.forEach(z => { cell[z.id] = grid(z, 1.55); });
  function zoneOf(h) { let u = (h % 1000) / 1000, acc = 0; for (const z of list) { acc += z.w; if (u < acc) return z; } return list[0]; }
  return { runway, bst, list, blocked, cell, zoneOf };
})();

const Stage = (() => {
  let renderer, scene, camera, canvas;
  const beams = [], lamps = [], stripMats = [], panelMats = [];
  let ptA, ptB, hemi, edgeMat, barrier;
  let fx = null;
  const FXN = 1600;
  const camPos = new THREE.Vector3(0, 5.5, 32), camTgt = new THREE.Vector3(0, 6, -10);
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0);
  const view = { yaw: 0, pitch: 0, fov: 60 };
  let camMode = 'director';
  let myPos = new THREE.Vector3(0, 2.15, 14);
  let quality = { beams: 14, fxScale: 1 };

  const PRESET = {
    wide: [[0, 7, 34], [0, 8, -10]],
    crane: [[0, 16, 25], [0, 3, -10]],
    stagel: [[-30, 4, 12], [0, 3.5, -9]],
    stager: [[30, 4, 12], [0, 3.5, -9]]
  };

  function gridTexture(c) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d'); g.fillStyle = '#0b0914'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = c; g.lineWidth = 2; g.globalAlpha = 0.5; g.strokeRect(1, 1, 126, 126);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }

  function beamMaterial() {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color('#19e3ff') }, uI: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.0); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uI; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float edge=abs(dot(normalize(vN),normalize(vV))); float a=uI*(0.08+0.55*pow(vUv.y,1.6))*(0.25+0.75*edge); gl_FragColor=vec4(uColor*a,a); }'
    });
  }

  function init(cv) {
    canvas = cv;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.setClearColor(0x05030c, 1);
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05030c, 0.013);
    renderer.setClearColor(0x05030c, 1);
    camera = new THREE.PerspectiveCamera(60, 1, 0.3, 700);

    hemi = new THREE.HemisphereLight(0x4a4a9a, 0x0a0614, 0.55); scene.add(hemi);
    ptA = new THREE.PointLight(0x19e3ff, 1.3, 70, 1.6); ptA.position.set(-13, 11, -2); scene.add(ptA);
    ptB = new THREE.PointLight(0xff2bd6, 1.3, 70, 1.6); ptB.position.set(13, 11, -2); scene.add(ptB);

    // sàn khán đài
    const ft = gridTexture('#6a5cff'); ft.repeat.set(88, 88);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(190, 190), new THREE.MeshLambertMaterial({ map: ft }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 10); scene.add(floor);

    // sân khấu
    const deck = new THREE.Mesh(new THREE.BoxGeometry(56, 1.5, 15), new THREE.MeshLambertMaterial({ color: 0x17122a }));
    deck.position.set(0, 0.75, -11.5); scene.add(deck);
    edgeMat = new THREE.MeshBasicMaterial({ color: 0x19e3ff });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(56, 0.14, 0.16), edgeMat); edge.position.set(0, 1.46, -4.05); scene.add(edge);
    const edge2 = new THREE.Mesh(new THREE.BoxGeometry(56, 0.14, 0.16), edgeMat); edge2.position.set(0, 0.2, -4.02); scene.add(edge2);
    for (let i = 0; i < 9; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0xff2bd6 }); panelMats.push(m);
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 13.2), m); s.position.set(-24 + i * 6, 1.52, -11.5); scene.add(s);
    }
    // barrier trước đám đông
    barrier = new THREE.Mesh(new THREE.BoxGeometry(58, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0x6a5cff }));
    barrier.position.set(0, 1.1, 1.6); scene.add(barrier);


    // lối catwalk ra giữa sân + sân khấu phụ tròn
    {
      const R = Zones.runway, B = Zones.bst, len = R.z1 - R.z0;
      const rw = new THREE.Mesh(new THREE.BoxGeometry(R.w, 1.5, len), new THREE.MeshLambertMaterial({ color: 0x17122a }));
      rw.position.set(0, 0.75, R.z0 + len / 2); scene.add(rw);
      [-1, 1].forEach(sx => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, len), edgeMat); e.position.set(sx * R.w / 2, 1.5, R.z0 + len / 2); scene.add(e); });
      for (let z = R.z0 + 2; z < R.z1; z += 4) { const st = new THREE.Mesh(new THREE.BoxGeometry(R.w - 0.5, 0.04, 0.22), panelMats[(z / 4 | 0) % panelMats.length] || edgeMat); st.position.set(0, 1.52, z); scene.add(st); }
      const bs = new THREE.Mesh(new THREE.CylinderGeometry(B.r, B.r, 1.5, 48), new THREE.MeshLambertMaterial({ color: 0x17122a })); bs.position.set(B.x, 0.75, B.z); scene.add(bs);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(B.r, 0.1, 6, 64), edgeMat); ring.rotation.x = Math.PI / 2; ring.position.set(B.x, 1.52, B.z); scene.add(ring);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(B.r * 0.55, 0.07, 6, 48), panelMats[1] || edgeMat); ring2.rotation.x = Math.PI / 2; ring2.position.set(B.x, 1.53, B.z); scene.add(ring2);
      // giàn đèn nhỏ trên sân khấu phụ
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0x1b1730 })); m.position.set(B.x + Math.cos(a) * (B.r + 0.6), 5, B.z + Math.sin(a) * (B.r + 0.6)); scene.add(m); const h = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.7), new THREE.MeshBasicMaterial({ color: 0xffffff })); h.position.set(m.position.x, 10, m.position.z); scene.add(h); lamps.push(h); }
    }
    // phân khu: sàn tô màu, hàng rào, bảng tên
    Zones.list.forEach(z => {
      const c = new THREE.Color(z.color);
      const rail = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.7), fog: false });
      z.rects.forEach(r => {
        const w = r[1] - r[0], d = r[3] - r[2], cx = (r[0] + r[1]) / 2, cz = (r[2] + r[3]) / 2;
        const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        f.rotation.x = -Math.PI / 2; f.position.set(cx, 0.03, cz); scene.add(f);
        [[w, 0.07, 0.07, cx, 1.0, r[2]], [w, 0.07, 0.07, cx, 1.0, r[3]], [0.07, 0.07, d, r[0], 1.0, cz], [0.07, 0.07, d, r[1], 1.0, cz]].forEach(q => { const m = new THREE.Mesh(new THREE.BoxGeometry(q[0], q[1], q[2]), rail); m.position.set(q[3], q[4], q[5]); scene.add(m); });
      });
      // bảng tên
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192; const g = cv.getContext('2d');
      g.fillStyle = 'rgba(8,6,16,0.82)'; g.beginPath(); g.roundRect ? g.roundRect(6, 6, 500, 180, 28) : g.rect(6, 6, 500, 180); g.fill(); g.strokeStyle = z.color; g.lineWidth = 6; g.stroke();
      g.fillStyle = z.color; g.font = '800 92px "Be Vietnam Pro",system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(z.name, 256, 84);
      g.fillStyle = '#fff'; g.font = '500 34px "Be Vietnam Pro",system-ui,sans-serif'; g.fillText(z.sub, 256, 150);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: false }));
      const r0 = z.rects[0], r1 = z.rects[z.rects.length - 1];
      const px = z.id === 'b' ? 0 : (r0[0] + r0[1]) / 2, pz = z.id === 'b' ? r1[2] : z.id === 'vip' ? r0[2] + 1 : r0[2];
      [z.id === 'b' ? [0, pz] : [px, pz], z.rects.length > 1 ? [(r1[0] + r1[1]) / 2, pz] : null].forEach(q => {
        if (!q) return; const s2 = sp.clone(); s2.material = sp.material; s2.scale.set(7.2, 2.7, 1); s2.position.set(q[0], 7.4, q[1]); scene.add(s2);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 6), rail); pole.position.set(q[0], 3, q[1]); scene.add(pole);
      });
    });

    // tường LED
    const tex = LED.init(THREE);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(41.5, 19.2, 0.5), new THREE.MeshLambertMaterial({ color: 0x0c0a16 }));
    frame.position.set(0, 11.6, -18.7); scene.add(frame);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 17.5), new THREE.MeshBasicMaterial({ map: tex.main, fog: false }));
    wall.position.set(0, 11.6, -18.4); scene.add(wall);
    [-1, 1].forEach(sx => {
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(17.8, 40), new THREE.MeshBasicMaterial({ map: tex.side, fog: false }));
      sc.position.set(sx * 40, 21.5, -12); sc.rotation.y = -sx * 0.38; scene.add(sc);
      const post = new THREE.Mesh(new THREE.BoxGeometry(18.6, 41.2, 0.6), new THREE.MeshLambertMaterial({ color: 0x0c0a16 }));
      post.position.set(sx * 40, 21.5, -12.35); post.rotation.y = -sx * 0.38; scene.add(post);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2, 1.0, 2), new THREE.MeshBasicMaterial({ color: 0x19e3ff })); leg.position.set(sx * 40, 0.5, -12); scene.add(leg);
    });

    // giàn truss
    const metal = new THREE.MeshLambertMaterial({ color: 0x2a2a3e });
    [[-6, 14], [-14, 14]].forEach(([z, y]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(50, 0.4, 0.4), metal); b.position.set(0, y, z); scene.add(b);
    });
    [-24.5, 24.5].forEach(x => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 14, 8.4), metal); p.position.set(x, 7, -10); scene.add(p);
    });

    // đèn beam
    const geo = new THREE.CylinderGeometry(0.15, 2.7, 34, 14, 1, true); geo.translate(0, -17, 0);
    for (let i = 0; i < 14; i++) {
      const row = i < 7 ? 0 : 1, k = i % 7;
      const x = -21 + k * 7, z = row ? -14 : -6;
      const piv = new THREE.Object3D(); piv.position.set(x, 13.6, z);
      const mesh = new THREE.Mesh(geo, beamMaterial()); piv.add(mesh); scene.add(piv);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); lamp.position.copy(piv.position); lamp.position.y -= 0.3; scene.add(lamp);
      beams.push({ piv, mesh, lamp, x, z, row, k, cur: new THREE.Vector3(x, 0, 10), tgt: new THREE.Vector3() }); lamps.push(lamp);
    }

    // hạt hiệu ứng
    const pos = new Float32Array(FXN * 3), col = new Float32Array(FXN * 3);
    for (let i = 0; i < FXN; i++) pos[i * 3 + 1] = -100;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false; scene.add(pts);
    fx = { pts, pos, col, vel: new Float32Array(FXN * 3), life: new Float32Array(FXN), max: new Float32Array(FXN), base: new Float32Array(FXN * 3), grav: new Float32Array(FXN), next: 0 };

    return { scene, camera, renderer };
  }

  /* --- hạt --- */
  function spawn(p, v, c, life, grav) {
    const i = fx.next; fx.next = (fx.next + 1) % FXN;
    fx.pos[i * 3] = p[0]; fx.pos[i * 3 + 1] = p[1]; fx.pos[i * 3 + 2] = p[2];
    fx.vel[i * 3] = v[0]; fx.vel[i * 3 + 1] = v[1]; fx.vel[i * 3 + 2] = v[2];
    fx.base[i * 3] = c[0]; fx.base[i * 3 + 1] = c[1]; fx.base[i * 3 + 2] = c[2];
    fx.life[i] = fx.max[i] = life; fx.grav[i] = grav;
  }
  function burst(kind, colors) {
    const cs = colors.map(hex2rgb), sc = quality.fxScale;
    if (kind === 'confetti') {
      const n = (260 * sc) | 0;
      for (let i = 0; i < n; i++) spawn([rnd(-16, 16), rnd(13, 18), rnd(-8, 22)], [rnd(-1.5, 1.5), rnd(-2.5, -0.8), rnd(-1.5, 1.5)], i % 5 === 0 ? [1, 1, 1] : cs[i % cs.length], rnd(5, 8), 0.5);
    } else if (kind === 'sparks') {
      [-24, -16, -8, 8, 16, 24].forEach(x => {
        const n = (70 * sc) | 0;
        for (let i = 0; i < n; i++) spawn([x + rnd(-.3, .3), 1.6, -4.3], [rnd(-2.5, 2.5), rnd(10, 17), rnd(-1, 3)], cs[i % cs.length], rnd(1.2, 2), 12);
      });
    } else if (kind === 'fireworks') {
      const centers = 5;
      for (let c = 0; c < centers; c++) {
        const cx = rnd(-22, 22), cy = rnd(16, 26), cz = rnd(-14, 8), col = [cs[c % cs.length], [1, 0.9, 0.5], [1, 1, 1]][c % 3];
        const n = (110 * sc) | 0;
        for (let i = 0; i < n; i++) {
          const th = Math.random() * 6.283, ph = Math.acos(rnd(-1, 1)), sp = rnd(6, 13);
          spawn([cx, cy, cz], [Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp], col, rnd(1.6, 2.4), 6);
        }
      }
    }
  }
  function updateFx(dt) {
    const f = fx;
    for (let i = 0; i < FXN; i++) {
      if (f.life[i] <= 0) continue;
      f.life[i] -= dt;
      if (f.life[i] <= 0) { f.pos[i * 3 + 1] = -100; f.col[i * 3] = f.col[i * 3 + 1] = f.col[i * 3 + 2] = 0; continue; }
      f.vel[i * 3 + 1] -= f.grav[i] * dt;
      const drag = f.grav[i] > 5 ? 0.985 : 0.995;
      f.vel[i * 3] *= drag; f.vel[i * 3 + 2] *= drag;
      f.pos[i * 3] += f.vel[i * 3] * dt; f.pos[i * 3 + 1] += f.vel[i * 3 + 1] * dt; f.pos[i * 3 + 2] += f.vel[i * 3 + 2] * dt;
      const k = Math.min(1, f.life[i] / f.max[i] * 1.6);
      f.col[i * 3] = f.base[i * 3] * k; f.col[i * 3 + 1] = f.base[i * 3 + 1] * k; f.col[i * 3 + 2] = f.base[i * 3 + 2] * k;
    }
    f.pts.geometry.attributes.position.needsUpdate = true; f.pts.geometry.attributes.color.needsUpdate = true;
  }

  /* --- đèn --- */
  function updateLights(W, time, dt) {
    const mode = W.cue ? W.cue.light : 'dim', c0 = W.colors[0], c1 = W.colors[1];
    const col0 = new THREE.Color(c0), col1 = new THREE.Color(c1);
    const P = W.bi.pulse, beat = W.bi.beat, e = W.energy;
    const focus = Performers.focusPoint();
    const N = quality.beams;
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i], u = b.k / 6;
      if (N < 14 && b.row === 1) { b.mesh.visible = false; b.lamp.visible = false; continue; }
      b.mesh.visible = true; b.lamp.visible = true;
      let I = 0.1;
      const t = b.tgt;
      switch (mode) {
        case 'sweep': t.set(Math.sin(time * 0.9 + i * 0.55) * 30, 0, 8 + Math.cos(time * 0.7 + i) * 14); I = 0.8; break;
        case 'fan': t.set((u - 0.5) * 56 * (1 + 0.18 * P), 0, 9 + b.row * 6); I = 0.85; break;
        case 'cross': t.set((b.k % 2 ? 1 : -1) * (6 + Math.sin(time * 0.8) * 7) + (u - 0.5) * 8, 0, 4 + b.row * 8); I = 0.9; break;
        case 'chase': t.set((u - 0.5) * 40, 0, 7 + b.row * 6); I = ((Math.floor(beat * 2) + i) % 4 === 0) ? 1 : 0.08; break;
        case 'strobe': t.set((u - 0.5) * 36, 0, 8 + b.row * 6); I = P > 0.5 ? 1 : 0.04; break;
        case 'spot': t.set(focus.x + Math.sin(time * 1.3 + i) * 0.8, 2, focus.z + 0.5); I = 0.95; break;
        case 'converge': t.set(focus.x * 0.5, 3 + 3 * P, focus.z + 0.5); I = 0.7 + 0.3 * P; break;
        default: t.set((u - 0.5) * 24, 0, 6); I = 0.16;
      }
      b.cur.lerp(t, 1 - Math.exp(-dt * 6));
      tmpV.copy(b.cur).sub(b.piv.position).normalize();
      tmpQ.setFromUnitVectors(DOWN, tmpV); b.piv.quaternion.copy(tmpQ);
      const col = (i % 2) ? col0 : col1;
      b.mesh.material.uniforms.uColor.value.copy(col);
      b.mesh.material.uniforms.uI.value = I * (0.55 + 0.6 * e) * (mode === 'dim' ? 1 : (0.75 + 0.35 * P));
      b.lamp.material.color.copy(col).multiplyScalar(0.3 + I);
    }
    ptA.color.copy(col0); ptB.color.copy(col1);
    const base = mode === 'dim' ? 0.7 : 1.2 + 0.8 * P * e;
    ptA.intensity = base; ptB.intensity = base;
    edgeMat.color.copy(col0).multiplyScalar(0.5 + 0.8 * P);
    panelMats.forEach((m, i) => m.color.copy(i % 2 ? col0 : col1).multiplyScalar(mode === 'dim' ? 0.25 : 0.35 + 0.65 * (((Math.floor(beat * 2) + i) % 3 === 0) ? 1 : 0.35)));
  }

  /* --- camera --- */
  function updateCamera(W, time, dt) {
    const k = 1 - Math.exp(-dt * 2.4);
    if (camMode === 'audience') {
      camera.position.lerp(myPos, 1 - Math.exp(-dt * 5));
      camTgt.set(0, 5.5, -10);
      camera.lookAt(camTgt);
      camera.rotateY(view.yaw); camera.rotateX(view.pitch);
      camera.position.y += Math.sin(time * 2.2) * 0.012 * W.energy;
      camera.fov = lerp(camera.fov, view.fov - 3 * W.bi.pulse * W.energy, 0.2);
    } else {
      const m = W.cue ? W.cue.cam : 'wide';
      let p, tg;
      if (m === 'closeup') { const f = Performers.focusPoint(); p = [f.x * 0.4, 4.2, 3.5]; tg = [f.x, 3.4, f.z]; }
      else if (m === 'orbit') { const a = Math.sin(time * 0.18) * 0.95; p = [Math.sin(a) * 25, 8 + Math.sin(time * 0.3) * 1.5, -8 + Math.cos(a) * 25]; tg = [0, 4, -10]; }
      else { const pr = PRESET[m] || PRESET.wide; p = pr[0]; tg = pr[1]; }
      camPos.x = lerp(camPos.x, p[0], k); camPos.y = lerp(camPos.y, p[1], k); camPos.z = lerp(camPos.z, p[2], k);
      camTgt.x = lerp(camTgt.x, tg[0], k * 1.4); camTgt.y = lerp(camTgt.y, tg[1], k * 1.4); camTgt.z = lerp(camTgt.z, tg[2], k * 1.4);
      camera.position.copy(camPos); camera.lookAt(camTgt);
      camera.fov = lerp(camera.fov, 56 - 3 * W.bi.pulse * W.energy, 0.15);
    }
    camera.updateProjectionMatrix();
  }

  function resize(w, h, pr) {
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  return {
    init, resize, burst, updateFx, updateLights, updateCamera,
    get scene() { return scene; }, get camera() { return camera; }, get renderer() { return renderer; },
    render() { renderer.render(scene, camera); },
    setCamMode(m) { camMode = m; }, getCamMode() { return camMode; },
    setMyPos(x, z) { myPos.set(x, 2.15, z); },
    look(dx, dy) { view.yaw = clamp(view.yaw + dx, -3.2, 3.2); view.pitch = clamp(view.pitch + dy, -0.45, 0.5); },
    zoom(d) { view.fov = clamp(view.fov + d, 34, 80); },
    resetLook() { view.yaw = 0; view.pitch = 0; view.fov = 60; },
    setQuality(q) { quality = q; },
    info() { return renderer.info.render; }
  };
})();
