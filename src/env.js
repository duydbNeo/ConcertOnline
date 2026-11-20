/* ===== env: không gian nền quanh khu concert (trời, đường chân trời, đèn pha, đèn lồng, pháo hoa).
   Cấu hình ở runtime qua SHOW.venue do Event Agent viết; không có gì cứng trong mã. ===== */
const Env = (() => {
  let scene, V, root, quality = 1;
  const U = { uTime: { value: 0 }, uE: { value: 0.2 }, uP: { value: 0 }, uC0: { value: null }, uC1: { value: null } };
  const lights = [], lanterns = [], bursts = [], poles = {};
  let hills, skyline, windows, sky, lastBurst = -9, burstIdx = 0, lastCheer = 0;
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const col = h => new THREE.Color(h);

  const DEFAULT = {
    preset: 'festival', name: '',
    sky: { top: '#02010a', mid: '#140a33', horizon: '#3a1450' },
    ground: '#07050f', moon: true, stars: true,
    searchlights: 5, lanterns: true, fireworks: true, towers: true
  };

  function merge(v) {
    const o = JSON.parse(JSON.stringify(DEFAULT));
    if (v) { Object.assign(o, v); o.sky = Object.assign({}, DEFAULT.sky, v.sky || {}); }
    return o;
  }

  function skyDome() {
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: Object.assign({ uTop: { value: col(V.sky.top) }, uMid: { value: col(V.sky.mid) }, uHor: { value: col(V.sky.horizon) }, uMoon: { value: V.moon ? 1 : 0 }, uStars: { value: V.stars ? 1 : 0 } }, U),
      vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uTop,uMid,uHor,uC0,uC1; uniform float uTime,uE,uP,uMoon,uStars; varying vec3 vP;
        float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        void main(){
          float y=max(vP.y,0.0);
          vec3 c=mix(uHor,uMid,smoothstep(0.0,0.22,y)); c=mix(c,uTop,smoothstep(0.18,0.75,y));
          vec2 g=vec2(atan(vP.x,vP.z)*46.0,y*90.0); vec2 id=floor(g); float r=h(id);
          float st=step(0.982,r)*smoothstep(0.04,0.25,y)*(0.45+0.55*sin(uTime*(1.5+r*2.0)+r*60.0));
          st*=smoothstep(0.38,0.0,length(fract(g)-0.5)); c+=vec3(0.8,0.85,1.0)*st*uStars;
          vec3 md=normalize(vec3(-0.5,0.38,-0.78)); float d=dot(vP,md);
          c+=vec3(1.0,0.94,0.78)*smoothstep(0.9988,0.9994,d)*uMoon+vec3(0.55,0.6,0.9)*smoothstep(0.975,1.0,d)*0.22*uMoon;
          float back=smoothstep(0.1,-0.9,vP.z);
          vec3 glow=mix(uC0,uC1,0.5+0.5*sin(atan(vP.x,-vP.z)*2.0+uTime*0.2));
          c+=glow*exp(-y*5.0)*(0.1+0.55*uE+0.25*uP*uE)*(0.35+0.65*back);
          gl_FragColor=vec4(c,1.0);
        }`
    });
    sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), m); sky.renderOrder = -10; root.add(sky);
  }

  function ground() {
    const g = new THREE.Mesh(new THREE.CircleGeometry(420, 48), new THREE.MeshBasicMaterial({ color: col(V.ground) }));
    g.rotation.x = -Math.PI / 2; g.position.y = -0.06; root.add(g);
  }

  const windowMat = (size) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: Object.assign({ uSize: { value: size } }, U),
    vertexShader: 'attribute float aS; attribute float aT; varying float vS; varying float vT; uniform float uSize; void main(){ vS=aS; vT=aT; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=uSize*(300.0/-mv.z); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform float uTime,uE,uP; uniform vec3 uC0,uC1; varying float vS; varying float vT; void main(){ vec2 q=gl_PointCoord-0.5; float a=smoothstep(0.5,0.1,length(q)); float tw=0.55+0.45*sin(uTime*(0.6+vS*2.5)+vS*40.0); vec3 base=vT<0.5?vec3(1.0,0.82,0.5):(vT<0.85?vec3(0.6,0.8,1.0):mix(uC0,uC1,vS)); gl_FragColor=vec4(base*tw*(0.7+0.5*uE*uP),a*(0.5+0.5*tw)); }'
  });

  function cityline() {
    const N = quality > 0.6 ? 90 : 50, geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x090716, fog: false });
    skyline = new THREE.InstancedMesh(geo, mat, N);
    const d = new THREE.Object3D(), pos = [], aS = [], aT = [];
    for (let i = 0; i < N; i++) {
      const a = (-Math.PI * 0.95 + (i / N) * Math.PI * 1.9) * (i % 5 === 0 ? 1.0 : 1.0), rad = 150 + rnd() * 70;
      // phía sau sân khấu (z âm) dày và cao, hai bên thấp dần
      const x = Math.sin(a) * rad * 1.15, z = -Math.cos(a) * rad * 0.9 - 40, side = Math.abs(a) / Math.PI;
      const w = 8 + rnd() * 14, dp = 8 + rnd() * 10, hgt = (18 + rnd() * 70) * (1.05 - 0.55 * side);
      d.position.set(x, hgt / 2, z); d.scale.set(w, hgt, dp); d.rotation.y = Math.atan2(-x, -z + 0); d.updateMatrix(); skyline.setMatrixAt(i, d.matrix);
      const cnt = Math.floor(hgt * w / 55 * quality);
      for (let k = 0; k < cnt; k++) {
        const u = (rnd() - 0.5) * (w - 1.4), v = 1.5 + rnd() * (hgt - 3), lp = new THREE.Vector3(u, v - hgt / 2, dp / 2 + 0.08);
        lp.applyEuler(d.rotation).add(d.position); pos.push(lp.x, lp.y + hgt / 2 - hgt / 2, lp.z); aS.push(rnd()); aT.push(rnd());
      }
    }
    root.add(skyline);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pg.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1)); pg.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
    windows = new THREE.Points(pg, windowMat(2.4)); windows.frustumCulled = false; root.add(windows);
  }

  function hillring() {
    const seg = 160, pos = [], idx = [], H = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, r = 300;
      const hh = 14 + 18 * Math.abs(Math.sin(a * 3 + 0.6)) + 9 * Math.sin(a * 7 + 2) + 5 * Math.sin(a * 17);
      H.push(hh);
      pos.push(Math.sin(a) * r, 0, -Math.cos(a) * r, Math.sin(a) * r * 0.9, Math.max(hh, 4), -Math.cos(a) * r * 0.9);
      if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    hills = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x07050f, side: THREE.DoubleSide, fog: false }));
    root.add(hills);
    // đèn làng mạc dưới chân đồi
    const n = Math.floor(260 * quality), p2 = [], s2 = [], t2 = [];
    for (let i = 0; i < n; i++) {
      const j = Math.floor(rnd() * seg), a = (j / seg) * Math.PI * 2, r = 280 - rnd() * 14, hh = Math.max(4, H[j] * (0.15 + rnd() * 0.5));
      p2.push(Math.sin(a) * r + (rnd() - 0.5) * 6, hh, -Math.cos(a) * r); s2.push(rnd()); t2.push(rnd() * 0.5);
    }
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3)); g2.setAttribute('aS', new THREE.Float32BufferAttribute(s2, 1)); g2.setAttribute('aT', new THREE.Float32BufferAttribute(t2, 1));
    windows = new THREE.Points(g2, windowMat(3.2)); windows.frustumCulled = false; root.add(windows);
  }

  function searchlights() {
    const n = Math.round(V.searchlights * (quality > 0.6 ? 1 : 0.5));
    for (let i = 0; i < n; i++) {
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        uniforms: { uColor: { value: new THREE.Color('#19e3ff') }, uI: { value: 0.3 } },
        vertexShader: 'varying float vY; void main(){ vY=uv.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 uColor; uniform float uI; varying float vY; void main(){ gl_FragColor=vec4(uColor*uI*(1.0-vY*0.85),(1.0-vY)*0.55*uI); }'
      });
      const geo = new THREE.CylinderGeometry(0.5, 7, 260, 14, 1, true); geo.translate(0, 130, 0);
      const mesh = new THREE.Mesh(geo, m), pv = new THREE.Group(), a = (i / n) * Math.PI - Math.PI * 0.5;
      pv.position.set(Math.sin(a) * 150 * 1.2, 0, -90 - Math.cos(a) * 60 - 40); pv.add(mesh); root.add(pv);
      lights.push({ pv, m, ph: i * 1.7, sp: 0.25 + rnd() * 0.3 });
    }
  }

  function towers() {
    const dark = new THREE.MeshLambertMaterial({ color: 0x14102a }), glow = new THREE.MeshBasicMaterial({ color: 0x19e3ff });
    poles.glow = glow;
    [-1, 1].forEach(sx => {
      const x = sx * 21;
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.1, 17, 1.1), dark); t.position.set(x, 8.5, -9); root.add(t);
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 1.7), dark); sp.position.set(x, 1.4 + i * 1.75, -8.2); root.add(sp);
        const gl = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.07, 0.07), glow); gl.position.set(x, 2.25 + i * 1.75, -7.3); root.add(gl);
      }
    });
  }

  function lanternRows() {
    const rows = [8, 26, 46], per = Math.floor(26 * Math.min(1, quality + 0.3)), N = rows.length * per * 2;
    const geo = new THREE.SphereGeometry(0.42, 8, 6); geo.scale(1, 1.25, 1);
    const mA = new THREE.MeshBasicMaterial({ color: 0xff3b3b, fog: false }), mB = new THREE.MeshBasicMaterial({ color: 0xffc23d, fog: false });
    const A = new THREE.InstancedMesh(geo, mA, N / 2), B = new THREE.InstancedMesh(geo, mB, N / 2);
    const d = new THREE.Object3D(); let ia = 0, ib = 0;
    const strings = [];
    rows.forEach((z, ri) => {
      for (let i = 0; i < per * 2; i++) {
        const u = i / (per * 2 - 1), x = (u - 0.5) * 84, y = 10.5 - 2.2 * (1 - Math.pow(2 * u - 1, 2)) - ri * 0.3;
        d.position.set(x, y, z); d.updateMatrix();
        if (i % 2) B.setMatrixAt(ib++, d.matrix); else A.setMatrixAt(ia++, d.matrix);
        lanterns.push({ i, x, y, z });
      }
      // dây
      const pts = []; for (let k = 0; k <= 24; k++) { const u = k / 24; pts.push(new THREE.Vector3((u - 0.5) * 84, 10.5 - 2.2 * (1 - Math.pow(2 * u - 1, 2)) + 0.4 - ri * 0.3, z)); }
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a2a40, fog: false })));
      [-1, 1].forEach(sx => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 11, 6), new THREE.MeshBasicMaterial({ color: 0x1a1426 })); p.position.set(sx * 42, 5.5, z); root.add(p); });
    });
    root.add(A); root.add(B); poles.lanA = mA; poles.lanB = mB; poles.lanMesh = [A, B];
  }

  function fireworks() {
    for (let b = 0; b < 4; b++) {
      const n = Math.floor(150 * Math.min(1, quality + 0.3)), dir = [], sp = [];
      for (let i = 0; i < n; i++) { const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1); dir.push(Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph)); sp.push(0.5 + rnd() * 0.5); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3)); g.setAttribute('aSp', new THREE.Float32BufferAttribute(sp, 1));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        uniforms: { uC: { value: new THREE.Vector3() }, uAge: { value: 99 }, uCol: { value: new THREE.Color('#ffffff') } },
        vertexShader: 'attribute vec3 aDir; attribute float aSp; uniform vec3 uC; uniform float uAge; varying float vF; void main(){ vec3 p=uC+aDir*aSp*(1.0-exp(-uAge*1.7))*34.0; p.y-=3.2*uAge*uAge; vF=clamp(1.0-uAge/3.4,0.0,1.0); vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize=(3.0+5.0*vF)*(300.0/-mv.z)*2.0; gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uCol; varying float vF; void main(){ float a=smoothstep(0.5,0.0,length(gl_PointCoord-0.5)); gl_FragColor=vec4(uCol*(0.6+vF),a*vF); }'
      });
      const pt = new THREE.Points(g, m); pt.frustumCulled = false; pt.visible = false; root.add(pt); bursts.push({ pt, m, age: 99 });
    }
  }

  function init(THREE_, sc, venue) {
    scene = sc; V = merge(venue); root = new THREE.Group(); scene.add(root);
    U.uC0.value = col('#19e3ff'); U.uC1.value = col('#ff2bd6');
    skyDome(); ground();
    if (V.preset === 'city') cityline(); else hillring();
    if (V.searchlights > 0) searchlights();
    if (V.towers) towers();
    if (V.lanterns && V.preset !== 'city') lanternRows();
    if (V.fireworks) fireworks();
  }

  const t0 = new THREE.Color(), t1 = new THREE.Color();
  function update(W, time, dt) {
    if (!root) return;
    t0.set(W.colors[0]); t1.set(W.colors[1]);
    U.uC0.value.lerp(t0, 0.05); U.uC1.value.lerp(t1, 0.05);
    U.uTime.value = time; U.uE.value += (W.energy - U.uE.value) * 0.08; U.uP.value = W.bi.pulse;
    const e = W.energy, p = W.bi.pulse;
    lights.forEach((L, i) => {
      L.pv.rotation.z = Math.sin(time * L.sp + L.ph) * (0.35 + 0.45 * e) + (i % 2 ? 0.12 : -0.12);
      L.pv.rotation.x = Math.cos(time * L.sp * 0.8 + L.ph) * 0.3 - 0.1;
      L.m.uniforms.uColor.value.copy(i % 2 ? U.uC0.value : U.uC1.value); L.m.uniforms.uI.value = (W.phase === 'show' ? 0.2 + 0.7 * e : 0.12) * (0.75 + 0.25 * p);
    });
    if (poles.glow) poles.glow.color.copy(U.uC0.value).multiplyScalar(0.5 + 0.8 * p * e);
    if (poles.lanA) {
      poles.lanA.color.setRGB(1, 0.2 + 0.1 * p, 0.2).multiplyScalar(0.65 + 0.5 * e + 0.4 * p * e);
      poles.lanB.color.setRGB(1, 0.76, 0.24).multiplyScalar(0.65 + 0.5 * e + 0.4 * p * e);
      poles.lanMesh.forEach((m, k) => { m.rotation.z = Math.sin(time * 0.7 + k) * 0.004; });
    }
    // pháo hoa: bắn khi khán giả hò reo mạnh, hoặc cue cheer cao
    const ch = W.cue && W.cue.cheer || 0;
    if (bursts.length && W.phase === 'show' && ch > 0.6 && time - lastBurst > 1.4 && (ch > lastCheer || Math.random() < 0.02)) {
      const b = bursts[burstIdx++ % bursts.length];
      b.m.uniforms.uC.value.set((Math.random() - 0.5) * 220, 55 + Math.random() * 50, -170 - Math.random() * 60);
      b.m.uniforms.uCol.value.copy(Math.random() < 0.5 ? U.uC0.value : U.uC1.value).lerp(new THREE.Color(1, 1, 1), 0.35);
      b.age = 0; b.pt.visible = true; lastBurst = time;
    }
    lastCheer = ch;
    bursts.forEach(b => { if (b.age < 4) { b.age += dt; b.m.uniforms.uAge.value = b.age; if (b.age >= 3.5) b.pt.visible = false; } });
  }

  return { init, update, setQuality(q) { quality = q; }, get venue() { return V; } };
})();
