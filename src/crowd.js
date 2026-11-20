/* ===== crowd: khán giả ảo (instancing + shader), khán giả thật (avatar mặc đồ riêng + vòng sáng + tên) ===== */
const Crowd = (() => {
  const MAXV = 1100, MAXR = 128;
  let scene, vMesh, rMesh, rings, vGeo, rGeo, shared;
  let vCount = 900, vTotal = 0, vScale = null;
  const tags = [], emotes = [];
  const tagCache = new Map(), emoTex = {};
  const peersView = [];
  let mySlot = { x: 0, z: 14 }, myIdx = -1, selfVisible = false;
  let waveAmt = 0;

  /* ---------- hình học: thân, đầu, tóc, tay, gậy; bản đầy đủ thêm mắt, tóc dài/búi, váy, hoodie, mũ, kính, cánh ---------- */
  function buildBase(full) {
    const P = [], N = [], I = [], PT = []; let off = 0;
    function add(geo, part, tx, ty, tz, rx, ry, rz) {
      if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); if (rz) geo.rotateZ(rz);
      const p = geo.attributes.position.array, n = geo.attributes.normal.array, ix = geo.index.array;
      for (let i = 0; i < p.length; i += 3) { P.push(p[i] + tx, p[i + 1] + ty, p[i + 2] + tz); N.push(n[i], n[i + 1], n[i + 2]); PT.push(part); }
      for (let i = 0; i < ix.length; i++) I.push(ix[i] + off);
      off += p.length / 3;
    }
    add(new THREE.CylinderGeometry(0.26, 0.31, 1.15, 8, 1), 0, 0, 0.575, 0);
    add(new THREE.SphereGeometry(0.24, 8, 6), 1, 0, 1.42, 0);
    add(new THREE.SphereGeometry(0.265, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.45), 5, 0, 1.45, -0.01);
    add(new THREE.BoxGeometry(0.12, 0.66, 0.12), 2, -0.36, 1.1 - 0.33, 0);
    add(new THREE.BoxGeometry(0.12, 0.66, 0.12), 3, 0.36, 1.1 - 0.33, 0);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 5, 1), 4, 0.36, 1.1 - 0.66 - 0.28, 0);
    if (full) {
      add(new THREE.SphereGeometry(0.035, 6, 4), 6, -0.085, 1.42, -0.226);
      add(new THREE.SphereGeometry(0.035, 6, 4), 6, 0.085, 1.42, -0.226);
      add(new THREE.BoxGeometry(0.5, 0.72, 0.12), 7, 0, 1.2, 0.2);
      add(new THREE.SphereGeometry(0.14, 8, 6), 8, 0, 1.74, 0.03);
      add(new THREE.CylinderGeometry(0.3, 0.6, 0.5, 10, 1, true), 9, 0, 0.5, 0);
      add(new THREE.CylinderGeometry(0.292, 0.292, 0.14, 10, 1, true), 10, 0, 0.86, 0);
      add(new THREE.SphereGeometry(0.2, 8, 6), 11, 0, 1.2, 0.22);
      add(new THREE.ConeGeometry(0.085, 0.22, 5), 12, -0.14, 1.74, 0);
      add(new THREE.ConeGeometry(0.085, 0.22, 5), 12, 0.14, 1.74, 0);
      add(new THREE.TorusGeometry(0.21, 0.03, 5, 14), 13, 0, 1.92, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.255, 0.27, 0.14, 10), 14, 0, 1.7, 0);
      add(new THREE.BoxGeometry(0.34, 0.035, 0.24), 14, 0, 1.64, -0.26);
      add(new THREE.BoxGeometry(0.46, 0.09, 0.05), 15, 0, 1.45, -0.258);
      add(new THREE.BoxGeometry(0.34, 0.55, 0.03), 16, -0.3, 1.05, 0.2, 0, 0, 0.45);
      add(new THREE.BoxGeometry(0.34, 0.55, 0.03), 16, 0.3, 1.05, 0.2, 0, 0, -0.45);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('part', new THREE.Float32BufferAttribute(PT, 1));
    g.setIndex(I);
    return g;
  }

  const VS = `
    attribute float part; attribute vec3 iOff; attribute vec3 iCloth; attribute vec3 iSkin; attribute vec4 iAnim;
    attribute vec4 iLook; attribute vec3 iHair; attribute vec3 iStick;
    uniform float uTime, uEnergy, uWave, uPulse, uYaw; uniform vec3 uColA, uColB;
    varying vec3 vBase; varying vec3 vN; varying float vEm; varying float vDepth; varying float vWx; varying float vWz;
    float on(float v,float k){ return step(abs(v-k),0.5); }
    void main(){
      float ph=iAnim.x, sp=iAnim.y, hs=iAnim.z, stick=iAnim.w;
      vec3 p=position; vec3 n=normal;
      float hyped=step(1.5,stick), hasStick=step(0.5,stick);
      p.y*=hs;
      float act=clamp(uEnergy+hyped*0.6,0.0,1.0);
      float hop=abs(sin(uTime*sp+ph))*0.3*act*(0.35+0.65*fract(ph*7.0));
      if(part>1.5 && part<4.5){
        float side=(part<2.5)?-1.0:1.0;
        float R=step(0.35,fract(ph*5.0+0.2));
        float raise=clamp(0.12+0.88*act*R,0.0,1.0);
        if(side<0.0) raise*=0.55;
        raise=max(raise,hyped);
        float ang=mix(0.12,2.9,raise)+sin(uTime*sp*0.55+ph)*0.38*raise;
        float wv=2.75+sin(uTime*2.3-iOff.x*0.24-iOff.z*0.06)*0.55;
        ang=mix(ang,wv,uWave*(hasStick>0.5?1.0:0.35)*(side>0.0?1.0:0.5));
        float a=side*ang; float c=cos(a), s=sin(a);
        vec2 piv=vec2(side*0.36,1.1*hs); vec2 d=p.xy-piv;
        p.xy=piv+vec2(d.x*c-d.y*s, d.x*s+d.y*c);
        if(part>3.5 && hasStick<0.5) p=vec3(0.0,-20.0,0.0);
      }
      float hide=0.0;
      if(part>6.5){
        if(part<7.5) hide=1.0-on(iLook.y,1.0);
        else if(part<8.5) hide=1.0-on(iLook.y,2.0);
        else if(part<9.5) hide=1.0-on(iLook.x,2.0);
        else if(part<10.5) hide=1.0-on(iLook.x,1.0);
        else if(part<11.5) hide=1.0-on(iLook.x,3.0);
        else if(part<12.5) hide=1.0-on(iLook.z,1.0);
        else if(part<13.5) hide=1.0-on(iLook.z,2.0);
        else if(part<14.5) hide=1.0-on(iLook.z,3.0);
        else if(part<15.5) hide=1.0-on(iLook.z,4.0);
        else hide=1.0-on(iLook.w,1.0);
      }
      if(hide>0.5) p=vec3(0.0,-20.0,0.0);
      float cy=cos(uYaw), sy=sin(uYaw);
      p.xz=vec2(p.x*cy-p.z*sy, p.x*sy+p.z*cy);
      n.xz=vec2(n.x*cy-n.z*sy, n.x*sy+n.z*cy);
      p.y+=hop;
      vec3 w=iOff+p;
      vec4 mv=viewMatrix*vec4(w,1.0);
      gl_Position=projectionMatrix*mv;
      vDepth=length(mv.xyz); vN=n; vWx=w.x; vWz=w.z;
      vec3 stickC=(iStick.x<0.0)?mix(uColA,uColB,fract(ph*3.0)):iStick;
      float em=0.0;
      if(part<0.5) vBase=iCloth;
      else if(part<1.5) vBase=iSkin;
      else if(part<3.5) vBase=iSkin*0.9;
      else if(part<4.5){ vBase=stickC; em=1.0; }
      else if(part<5.5) vBase=iHair;
      else if(part<6.5) vBase=vec3(0.04);
      else if(part<8.5) vBase=iHair;
      else if(part<9.5) vBase=iCloth;
      else if(part<10.5){ vBase=stickC; em=1.0; }
      else if(part<11.5) vBase=iCloth*0.8;
      else if(part<12.5) vBase=iHair;
      else if(part<13.5){ vBase=stickC; em=1.0; }
      else if(part<14.5) vBase=iCloth*0.65;
      else { vBase=stickC; em=1.0; }
      vEm=em;
    }`;
  const FS = `
    precision highp float;
    uniform vec3 uColA, uColB, uFog, uLdir; uniform float uLit, uAmb, uPulse, uFogD;
    varying vec3 vBase; varying vec3 vN; varying float vEm; varying float vDepth; varying float vWx; varying float vWz;
    void main(){
      vec3 base=vBase;
      float lit=max(dot(normalize(vN),normalize(uLdir)),0.0);
      float fall=clamp(1.3-(vWz+4.0)/55.0,0.2,1.0);
      vec3 L=mix(uColA,uColB,smoothstep(-24.0,24.0,vWx))*uLit*fall;
      vec3 col=base*(uAmb+L*(0.25+1.1*lit));
      if(vEm>0.5){ col=base*(1.1+0.9*uPulse)+vec3(0.12); }
      float f=exp(-uFogD*uFogD*vDepth*vDepth);
      col=mix(uFog,col,f);
      gl_FragColor=vec4(col,1.0);
    }`;

  function newUniforms() {
    return {
      uTime: { value: 0 }, uEnergy: { value: 0.3 }, uWave: { value: 0 }, uPulse: { value: 0 }, uYaw: { value: 0 },
      uColA: { value: new THREE.Color('#19e3ff') }, uColB: { value: new THREE.Color('#ff2bd6') },
      uFog: { value: new THREE.Color(0x05030c) }, uLdir: { value: new THREE.Vector3(0, 0.3, -1) },
      uLit: { value: 0.9 }, uAmb: { value: 0.32 }, uFogD: { value: 0.013 }
    };
  }
  function makeMaterial(u) { return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: u }); }

  function makeInstGeo(base, n) {
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.normal = base.attributes.normal; g.attributes.part = base.attributes.part;
    g.setAttribute('iOff', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iCloth', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('iSkin', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('iAnim', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iLook', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4));
    g.setAttribute('iHair', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    const st = new Float32Array(n * 3); for (let i = 0; i < n; i++) st[i * 3] = -1;
    g.setAttribute('iStick', new THREE.InstancedBufferAttribute(st, 3));
    g.instanceCount = 0;
    return g;
  }
  const ATTRS = ['iOff', 'iCloth', 'iSkin', 'iAnim', 'iLook', 'iHair', 'iStick'];
  function touch(g) { ATTRS.forEach(k => g.attributes[k].needsUpdate = true); }

  /* ---------- trang phục ---------- */
  const Look = {
    valid(l) {
      if (!Array.isArray(l) || l.length !== 8) return false;
      const W = WARDROBE, lim = [W.tops.length, W.topColors.length, W.hairStyles.length, W.hairColors.length, W.headAcc.length, W.backAcc.length, W.skins.length, W.stickColors.length];
      return l.every((v, i) => Number.isInteger(v) && v >= 0 && v < lim[i]);
    },
    fallback(id) {
      const h = hashStr(String(id)) >>> 0, W = WARDROBE;
      return [h % W.tops.length, (h >>> 3) % W.topColors.length, (h >>> 6) % W.hairStyles.length, (h >>> 9) % W.hairColors.length, (h >>> 12) % W.headAcc.length, (h >>> 15) % W.backAcc.length, (h >>> 18) % W.skins.length, 0];
    },
    random() {
      const W = WARDROBE, r = n => Math.floor(Math.random() * n);
      return [r(W.tops.length), r(W.topColors.length), r(W.hairStyles.length), r(W.hairColors.length), r(W.headAcc.length), r(W.backAcc.length), r(W.skins.length), r(W.stickColors.length)];
    },
    apply(g, i, l) {
      const W = WARDROBE;
      g.attributes.iCloth.array.set(hex2rgb(W.topColors[l[1]]), i * 3);
      g.attributes.iSkin.array.set(hex2rgb(W.skins[l[6]]), i * 3);
      g.attributes.iHair.array.set(hex2rgb(W.hairColors[l[3]]), i * 3);
      const sc = W.stickColors[l[7]];
      g.attributes.iStick.array.set(sc === 'follow' ? [-1, 0, 0] : hex2rgb(sc), i * 3);
      g.attributes.iLook.array.set([l[0], l[2], l[4], l[5]], i * 4);
    }
  };

  const CLOTH = ['#2b2f4a', '#e8e4f0', '#ff4fa3', '#19e3ff', '#7a5cff', '#ff8a1f', '#1a1a22', '#c9ff4f', '#d24a4a', '#3a7bd5', '#f6d365', '#5b3a8f', '#101018', '#f0f0f0'];
  const SKIN = WARDROBE.skins;
  const HAIR = ['#14100d', '#52301a', '#d9b45a', '#0b0b12', '#d3205f'];

  function gen() {
    const R = mulberry(20260);
    const slots = [];
    for (let z = 2.6; z <= 50; z += 1.18) {
      for (let x = -27; x <= 27; x += 1.12) {
        const px = x + (R() - 0.5) * 0.55, pz = z + (R() - 0.5) * 0.5;
        const edge = clamp((Math.abs(px) - 19) / 10, 0, 1) * 0.8 + clamp((pz - 40) / 12, 0, 1) * 0.35;
        if (R() < 0.07 + edge) continue;
        slots.push([px, pz]);
      }
    }
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = slots[i]; slots[i] = slots[j]; slots[j] = t; }
    vTotal = Math.min(MAXV, slots.length); vScale = new Float32Array(vTotal);
    const off = vGeo.attributes.iOff.array, cl = vGeo.attributes.iCloth.array, sk = vGeo.attributes.iSkin.array, an = vGeo.attributes.iAnim.array, hr = vGeo.attributes.iHair.array;
    for (let i = 0; i < vTotal; i++) {
      off[i * 3] = slots[i][0]; off[i * 3 + 1] = 0; off[i * 3 + 2] = slots[i][1];
      cl.set(hex2rgb(CLOTH[Math.floor(R() * CLOTH.length)]), i * 3); sk.set(hex2rgb(SKIN[Math.floor(R() * SKIN.length)]), i * 3); hr.set(hex2rgb(HAIR[Math.floor(R() * HAIR.length)]), i * 3);
      an[i * 4] = R() * 100; an[i * 4 + 1] = 2.4 + R() * 3.2; an[i * 4 + 2] = vScale[i] = 0.9 + R() * 0.2; an[i * 4 + 3] = R() < 0.55 ? 1 : 0;
    }
    touch(vGeo);
    vGeo.instanceCount = Math.min(vCount, vTotal);
  }

  const SLOTS = (() => {
    const s = [];
    [14, 15.6, 17.2, 18.8, 20.4].forEach((z, r) => { for (let i = 0; i < 23; i++) { const x = (i - 11) * 1.5; s.push([x, z, r]); } });
    s.sort((a, b) => a[2] - b[2] || Math.abs(a[0]) - Math.abs(b[0]) || a[0] - b[0]);
    return s;
  })();

  function nameTex(name) {
    if (tagCache.has(name)) return tagCache.get(name);
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d'); g.font = '600 28px "Be Vietnam Pro",system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const t = name.length > 16 ? name.slice(0, 15) + '…' : name;
    g.fillStyle = 'rgba(8,6,16,0.72)'; const w = Math.min(250, g.measureText(t).width + 30);
    g.beginPath(); g.roundRect ? g.roundRect(128 - w / 2, 12, w, 40, 20) : g.rect(128 - w / 2, 12, w, 40); g.fill();
    g.fillStyle = '#fff'; g.fillText(t, 128, 33);
    const tx = new THREE.CanvasTexture(c); tagCache.set(name, tx); return tx;
  }
  function emojiTex(e) {
    if (emoTex[e]) return emoTex[e];
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d'); g.font = '64px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 48, 52);
    return emoTex[e] = new THREE.CanvasTexture(c);
  }

  function init(sc) {
    scene = sc;
    shared = newUniforms();
    vGeo = makeInstGeo(buildBase(false), MAXV);
    vMesh = new THREE.Mesh(vGeo, makeMaterial(shared)); vMesh.frustumCulled = false; scene.add(vMesh);
    rGeo = makeInstGeo(buildBase(true), MAXR);
    rMesh = new THREE.Mesh(rGeo, makeMaterial(shared)); rMesh.frustumCulled = false; scene.add(rMesh);
    const ringGeo = new THREE.RingGeometry(0.55, 0.78, 24); ringGeo.rotateX(-Math.PI / 2);
    rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), MAXR);
    rings.frustumCulled = false; rings.count = 0; scene.add(rings);
    for (let i = 0; i < 36; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false })); sp.scale.set(3.4, 0.85, 1); sp.visible = false; scene.add(sp); tags.push(sp);
    }
    for (let i = 0; i < 24; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false })); sp.scale.set(1, 1, 1); sp.visible = false; sp.userData.life = 0; scene.add(sp); emotes.push(sp);
    }
    gen();
  }

  function setPeers(list, myId) {
    const sorted = list.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    peersView.length = 0; myIdx = -1;
    const off = rGeo.attributes.iOff.array, an = rGeo.attributes.iAnim.array;
    let n = 0; const m = new THREE.Matrix4(), col = new THREE.Color();
    let ti = 0;
    sorted.forEach((p, idx) => {
      const sl = SLOTS[idx % SLOTS.length];
      const mine = p.id === myId;
      if (mine) { mySlot = { x: sl[0], z: sl[1] + 0.1 }; Stage.setMyPos(sl[0], sl[1] + 0.1); }
      if (n < MAXR) {
        const h = hashStr(p.id) >>> 0, look = Look.valid(p.look) ? p.look : Look.fallback(p.id);
        off[n * 3] = sl[0]; off[n * 3 + 1] = 0; off[n * 3 + 2] = sl[1];
        Look.apply(rGeo, n, look);
        const em = p.et && (Date.now() - p.et < 6000);
        an[n * 4] = (h % 1000) / 10 + 0.3; an[n * 4 + 1] = 3.2 + (h % 7) * 0.3; an[n * 4 + 2] = (mine && !selfVisible) ? 0.0001 : 1.0; an[n * 4 + 3] = em ? 2 : 1;
        m.makeTranslation(sl[0], 0.02, sl[1]); rings.setMatrixAt(n, m); col.set(WARDROBE.topColors[look[1]]); rings.setColorAt(n, col);
        if (mine) myIdx = n;
        if (!mine && ti < tags.length) {
          const sp = tags[ti++]; sp.material.map = nameTex(p.name || 'Khách'); sp.material.needsUpdate = true; sp.position.set(sl[0], 3.0, sl[1]); sp.visible = true;
        }
        n++;
      }
      peersView.push({ id: p.id, x: sl[0], z: sl[1], emote: p.emote, et: p.et, mine });
    });
    for (; ti < tags.length; ti++) tags[ti].visible = false;
    // ẩn khán giả ảo đứng trùng chỗ với khán giả thật
    const va = vGeo.attributes.iAnim.array, vo = vGeo.attributes.iOff.array;
    for (let i = 0; i < vTotal; i++) va[i * 4 + 2] = vScale[i];
    peersView.forEach(pv => { for (let i = 0; i < vTotal; i++) { const dx = vo[i * 3] - pv.x, dz = vo[i * 3 + 2] - pv.z; if (pv.mine ? (Math.abs(dx) < 1.4 && dz > -2.7 && dz < 1.0) : (dx * dx + dz * dz < 0.8)) va[i * 4 + 2] = 0.0001; } });
    vGeo.attributes.iAnim.needsUpdate = true;
    touch(rGeo);
    rGeo.instanceCount = n; rings.count = n; rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    return n;
  }

  function setSelfVisible(v) {
    selfVisible = v;
    if (myIdx >= 0) { rGeo.attributes.iAnim.array[myIdx * 4 + 2] = v ? 1.0 : 0.0001; rGeo.attributes.iAnim.needsUpdate = true; }
  }

  function spawnEmote(e, x, z) {
    const sp = emotes.find(s => s.userData.life <= 0); if (!sp) return;
    sp.material.map = emojiTex(e); sp.material.needsUpdate = true; sp.material.opacity = 1;
    sp.position.set(x + rnd(-0.3, 0.3), 2.8, z); sp.userData.life = 2.2; sp.userData.vx = rnd(-0.3, 0.3); sp.visible = true; sp.scale.set(1.2, 1.2, 1);
  }

  function update(W, time, dt) {
    const u = shared;
    u.uTime.value = time; u.uEnergy.value = lerp(u.uEnergy.value, W.energy, 0.06);
    const tw = W.cue && W.cue.crowd === 'wave' ? 1 : 0;
    waveAmt = lerp(waveAmt, tw, 0.04); u.uWave.value = waveAmt;
    u.uPulse.value = W.bi.pulse;
    u.uColA.value.set(W.colors[0]); u.uColB.value.set(W.colors[1]);
    u.uLit.value = W.phase === 'lobby' ? 0.5 : 0.6 + 0.6 * W.energy + 0.5 * W.bi.pulse * W.energy;
    emotes.forEach(sp => {
      if (sp.userData.life <= 0) return;
      sp.userData.life -= dt; sp.position.y += dt * 1.6; sp.position.x += sp.userData.vx * dt;
      sp.material.opacity = clamp(sp.userData.life, 0, 1);
      if (sp.userData.life <= 0) sp.visible = false;
    });
  }

  return {
    init, setPeers, update, spawnEmote, setSelfVisible,
    buildBase, makeInstGeo, makeMaterial, newUniforms, touch, Look,
    setCount(n) { vCount = n; vGeo.instanceCount = Math.min(n, vTotal); },
    total() { return vTotal; },
    count() { return vGeo.instanceCount; },
    mySlot() { return mySlot; },
    peersView() { return peersView; }
  };
})();
