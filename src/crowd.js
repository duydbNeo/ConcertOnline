/* ===== crowd: khán giả ảo (instancing + shader), khán giả thật (avatar mặc đồ riêng + vòng sáng + tên) ===== */
const Crowd = (() => {
  const MAXV = 1100, MAXR = 128;
  let scene, rings, shared;
  let vCount = 460, vTotal = 0;
  const tags = [], emotes = [];
  const tagCache = new Map(), emoTex = {};
  const peersView = [];
  let mySlot = { x: 0, z: 14 }, myIdx = -1, selfVisible = false;
  let waveAmt = 0;

  /* ---------- người 3D tĩnh (đã giảm mặt) dùng chung 1 shader instancing ---------- */
  const NV = 8;
  let vM = [], rM = [], variants = null, rCnt = new Array(NV).fill(0), loaded = false;
  let vX = null, vZ = null;
  const CAPV = Math.ceil(MAXV / NV) + 2, CAPR = MAXR;

  const VS = `
    attribute float part; attribute float cls; attribute float shade; attribute float aw; attribute float fw;
    attribute vec3 iOff; attribute vec3 iCloth; attribute vec3 iSkin; attribute vec4 iAnim; attribute vec3 iHair; attribute vec3 iStick;
    uniform float uTime, uEnergy, uWave, uPulse, uYaw; uniform vec3 uColA, uColB; uniform vec2 uPivot;
    varying vec3 vBase; varying vec3 vN; varying float vEm; varying float vDepth; varying float vWx; varying float vWz;
    void main(){
      float ph=iAnim.x, sp=iAnim.y, hs=iAnim.z, stick=iAnim.w;
      if(hs<0.01){ gl_Position=vec4(2.0,2.0,2.0,1.0); vBase=vec3(0.0); vN=vec3(0.0,1.0,0.0); vEm=0.0; vDepth=0.0; vWx=0.0; vWz=0.0; return; }
      vec3 p=position; vec3 n=normal;
      float hyped=step(1.5,stick), hasStick=step(0.5,stick);
      p.y*=hs;
      float act=clamp(uEnergy+hyped*0.6,0.0,1.0);
      float hk=0.5-0.5*cos(uTime*sp*2.0+ph*2.0);
      float hop=hk*hk*0.24*act*(0.35+0.65*fract(ph*7.0))+uPulse*0.1*act*(0.3+0.7*fract(ph*13.0));
      float sw=sin(uTime*sp*0.9+ph), sw2=sin(uTime*sp*0.45+ph*1.7);
      float up=smoothstep(0.75,1.35,position.y);
      if(part>1.5){
        float side=(part<2.5)?-1.0:1.0;
        float R=step(0.35,fract(ph*5.0+0.2));
        float raise=clamp(0.1+0.9*act*R,0.0,1.0);
        if(side<0.0) raise*=0.55;
        raise=max(raise,hyped);
        float ang=mix(0.08,2.9,raise)+sin(uTime*sp*0.55+ph)*0.38*raise;
        float wv=2.75+sin(uTime*2.3-iOff.x*0.24-iOff.z*0.06)*0.55;
        ang=mix(ang,wv,uWave*(hasStick>0.5?1.0:0.35)*(side>0.0?1.0:0.5));
        float bend=(0.12+0.55*raise)*(0.85+0.15*sin(uTime*sp*1.3+ph));
        vec3 q=p, qn=n;
        vec2 el=vec2(side*uPivot.x,uPivot.y*hs-0.28);
        float bc=cos(bend*fw), bs=sin(bend*fw);
        float yy=q.y-el.y, zz=q.z; q.y=el.y+yy*bc-zz*bs; q.z=yy*bs+zz*bc;
        float ny=qn.y, nz=qn.z; qn.y=ny*bc-nz*bs; qn.z=ny*bs+nz*bc;
        float a=side*ang; float c=cos(a), s=sin(a);
        vec2 piv=vec2(side*uPivot.x,uPivot.y*hs); vec2 d=q.xy-piv;
        q.xy=piv+vec2(d.x*c-d.y*s, d.x*s+d.y*c);
        qn.xy=vec2(qn.x*c-qn.y*s, qn.x*s+qn.y*c);
        p=mix(p,q,aw); n=normalize(mix(n,qn,aw));
      }
      p.x+=up*sw*0.05*act; p.z+=up*sw2*0.04*act; p.y-=0.03*hk*act;
      if(cls>6.5 && hasStick<0.5) p=vec3(0.0,-20.0,0.0);
      float cy=cos(uYaw), sy=sin(uYaw);
      p.xz=vec2(p.x*cy-p.z*sy, p.x*sy+p.z*cy);
      n.xz=vec2(n.x*cy-n.z*sy, n.x*sy+n.z*cy);
      p.y+=hop;
      vec3 w=iOff+p;
      vec4 mv=viewMatrix*vec4(w,1.0);
      gl_Position=projectionMatrix*mv;
      vDepth=length(mv.xyz); vN=n; vWx=w.x; vWz=w.z;
      vec3 stickC=(iStick.x<0.0)?mix(uColA,uColB,fract(ph*3.0)):iStick;
      float em=0.0; vec3 b;
      if(cls<0.5) b=iCloth*shade;
      else if(cls<1.5) b=iSkin*clamp(shade,0.8,1.15);
      else if(cls<2.5) b=iHair*clamp(shade,0.7,1.3);
      else if(cls<3.5) b=mix(vec3(0.07,0.08,0.14),iCloth.bgr*0.55,0.35)*shade;
      else if(cls<4.5) b=vec3(0.1,0.1,0.13)*shade;
      else if(cls<5.5){ b=stickC*0.9; em=0.7; }
      else { b=stickC; em=1.0; }
      vBase=b; vEm=em;
    }`;
  const FS = `
    precision highp float;
    uniform vec3 uColA, uColB, uFog, uLdir; uniform float uLit, uAmb, uPulse, uFogD;
    varying vec3 vBase; varying vec3 vN; varying float vEm; varying float vDepth; varying float vWx; varying float vWz;
    void main(){
      vec3 base=vBase;
      float lit=max(dot(normalize(vN),normalize(uLdir)),0.0);
      float rim=pow(1.0-abs(normalize(vN).y),2.0)*0.15;
      float fall=clamp(1.3-(vWz+4.0)/55.0,0.2,1.0);
      vec3 L=mix(uColA,uColB,smoothstep(-24.0,24.0,vWx))*uLit*fall;
      vec3 col=base*(uAmb+L*(0.25+1.1*lit+rim));
      if(vEm>0.5){ col=base*(1.1+0.9*uPulse)+vec3(0.12); }
      float f=exp(-uFogD*uFogD*vDepth*vDepth);
      col=mix(uFog,col,f);
      gl_FragColor=vec4(col,1.0);
    }`;

  function newUniforms() {
    return {
      uTime: { value: 0 }, uEnergy: { value: 0.3 }, uWave: { value: 0 }, uPulse: { value: 0 }, uYaw: { value: Math.PI },
      uColA: { value: new THREE.Color('#19e3ff') }, uColB: { value: new THREE.Color('#ff2bd6') },
      uFog: { value: new THREE.Color(0x05030c) }, uLdir: { value: new THREE.Vector3(0, 0.3, -1) },
      uLit: { value: 0.9 }, uAmb: { value: 0.32 }, uFogD: { value: 0.013 }
    };
  }
  function makeMaterial(u, pivot) { return new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: Object.assign({}, u, { uPivot: { value: new THREE.Vector2(pivot[0], pivot[1]) } }) }); }
  function b64(s, T) { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new T(u8.buffer); }
  function baseGeo(v) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(b64(v.pos, Float32Array), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(b64(v.nor, Float32Array), 3));
    g.setAttribute('part', new THREE.BufferAttribute(Float32Array.from(b64(v.part, Uint8Array)), 1));
    g.setAttribute('cls', new THREE.BufferAttribute(Float32Array.from(b64(v.cls, Uint8Array)), 1));
    g.setAttribute('shade', new THREE.BufferAttribute(Float32Array.from(b64(v.shade, Uint8Array), x => x / 127), 1));
    g.setAttribute('aw', new THREE.BufferAttribute(Float32Array.from(b64(v.aw, Uint8Array), x => x / 255), 1));
    g.setAttribute('fw', new THREE.BufferAttribute(Float32Array.from(b64(v.fw, Uint8Array), x => x / 255), 1));
    g.setIndex(new THREE.BufferAttribute(b64(v.idx, Uint16Array), 1));
    return g;
  }
  function makeInstGeo(base, n) {
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; ['position', 'normal', 'part', 'cls', 'shade', 'aw', 'fw'].forEach(k => g.attributes[k] = base.attributes[k]);
    g.setAttribute('iOff', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iCloth', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('iSkin', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('iAnim', new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iHair', new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3));
    const st = new Float32Array(n * 3); for (let i = 0; i < n; i++) st[i * 3] = -1;
    g.setAttribute('iStick', new THREE.InstancedBufferAttribute(st, 3));
    g.instanceCount = 0;
    return g;
  }
  const ATTRS = ['iOff', 'iCloth', 'iSkin', 'iAnim', 'iHair', 'iStick'];
  function touch(g) { ATTRS.forEach(k => g.attributes[k].needsUpdate = true); }
  function mkSet(cap, list) {
    variants.forEach((v, k) => {
      const geo = makeInstGeo(baseGeo(v), cap);
      const mesh = new THREE.Mesh(geo, makeMaterial(shared, v.g === 'F' ? variants.pF : variants.pM)); mesh.frustumCulled = false; scene.add(mesh);
      list.push({ geo, mesh });
    });
  }

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
    }
  };

  const CLOTH = ['#2b2f4a', '#e8e4f0', '#ff4fa3', '#19e3ff', '#7a5cff', '#ff8a1f', '#1a1a22', '#c9ff4f', '#d24a4a', '#3a7bd5', '#f6d365', '#5b3a8f', '#101018', '#f0f0f0'];
  const SKIN = WARDROBE.skins;
  const HAIR = ['#14100d', '#52301a', '#d9b45a', '#0b0b12', '#d3205f'];
  let vScale = null;
  function vAt(i) { return vM[i % NV].geo; }
  function vJ(i) { return (i / NV) | 0; }
  let vOver = new Uint8Array(MAXV), ghost = new Set();
  function applyHide() {
    for (let i = 0; i < vTotal; i++) vAt(i).attributes.iAnim.array[vJ(i) * 4 + 2] = (vOver[i] || ghost.has(i)) ? 0.0001 : vScale[i];
    vM.forEach(x => x.geo.attributes.iAnim.needsUpdate = true);
  }
  function nearest(x, z, k) {
    if (!loaded) return [];
    const n = Math.min(vCount, vTotal), r = [];
    for (let i = 0; i < n; i++) { if (vOver[i]) continue; const dx = vX[i] - x, dz = vZ[i] - z; r.push([dx * dx + dz * dz, i]); }
    r.sort((a, b) => a[0] - b[0]);
    return r.slice(0, k).map(a => ({ i: a[1], x: vX[a[1]], z: vZ[a[1]] }));
  }
  function setGhost(arr) { ghost = new Set(arr); if (loaded) applyHide(); }
  function vCountApply() {
    const n = Math.min(vCount, vTotal);
    vM.forEach((m, k) => { m.geo.instanceCount = Math.max(0, Math.ceil((n - k) / NV)); });
  }

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
    vTotal = Math.min(MAXV, slots.length); vScale = new Float32Array(vTotal); vX = new Float32Array(vTotal); vZ = new Float32Array(vTotal);
    for (let i = 0; i < vTotal; i++) {
      const g = vAt(i), j = vJ(i);
      g.attributes.iOff.array.set([slots[i][0], 0, slots[i][1]], j * 3); vX[i] = slots[i][0]; vZ[i] = slots[i][1];
      g.attributes.iCloth.array.set(hex2rgb(CLOTH[Math.floor(R() * CLOTH.length)]), j * 3);
      g.attributes.iSkin.array.set(hex2rgb(SKIN[Math.floor(R() * SKIN.length)]), j * 3);
      g.attributes.iHair.array.set(hex2rgb(HAIR[Math.floor(R() * HAIR.length)]), j * 3);
      vScale[i] = 0.92 + R() * 0.16;
      g.attributes.iAnim.array.set([R() * 100, 2.4 + R() * 3.2, vScale[i], R() < 0.55 ? 1 : 0], j * 4);
    }
    vM.forEach(m => touch(m.geo));
    vCountApply();
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
    const ringGeo = new THREE.RingGeometry(0.55, 0.78, 24); ringGeo.rotateX(-Math.PI / 2);
    rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), MAXR);
    rings.frustumCulled = false; rings.count = 0; scene.add(rings);
    for (let i = 0; i < 36; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false })); sp.scale.set(3.4, 0.85, 1); sp.visible = false; scene.add(sp); tags.push(sp);
    }
    for (let i = 0; i < 24; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false })); sp.scale.set(1, 1, 1); sp.visible = false; sp.userData.life = 0; scene.add(sp); emotes.push(sp);
    }
    const base = (window.NM_ASSET_BASE != null ? window.NM_ASSET_BASE : '') + '/a3d/crowd3.json';
    fetch(base).then(r => r.json()).then(j => {
      variants = j.variants; variants.pF = j.pivotF; variants.pM = j.pivotM;
      mkSet(CAPV, vM); mkSet(CAPR, rM); gen(); loaded = true;
      if (lastList.length) setPeers(lastList, lastMy);
    }).catch(e => console.warn('crowd load', e));
  }

  let avIds = new Set(), lastList = [], lastMy = null;
  function setAvatarIds(s) { avIds = s; if (lastList.length) setPeers(lastList, lastMy); }
  function rScaleSet(slot, v) { const m = rSlot[slot]; if (m) { m.geo.attributes.iAnim.array[m.j * 4 + 2] = v; m.geo.attributes.iAnim.needsUpdate = true; } }
  let rSlot = [];
  function setPeers(list, myId) {
    lastList = list; lastMy = myId;
    const sorted = list.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    peersView.length = 0; myIdx = -1; rSlot = [];
    let n = 0; const m = new THREE.Matrix4(), col = new THREE.Color();
    let ti = 0; rCnt.fill(0);
    sorted.forEach((p, idx) => {
      const sl = SLOTS[idx % SLOTS.length];
      const mine = p.id === myId;
      if (mine) { mySlot = { x: sl[0], z: sl[1] + 0.1 }; Stage.setMyPos(sl[0], sl[1] + 0.1); }
      if (n < MAXR) {
        const h = hashStr(p.id) >>> 0, look = Look.valid(p.look) ? p.look : Look.fallback(p.id);
        if (loaded) {
          const k = h % NV, j = rCnt[k]++, g = rM[k].geo;
          g.attributes.iOff.array.set([sl[0], 0, sl[1]], j * 3);
          Look.apply(g, j, look);
          const em = p.et && (Date.now() - p.et < 6000);
          g.attributes.iAnim.array.set([(h % 1000) / 10 + 0.3, 3.2 + (h % 7) * 0.3, ((mine && !selfVisible) || avIds.has(p.id)) ? 0.0001 : 1.0, em ? 2 : 1], j * 4);
          rSlot[n] = { geo: g, j };
        }
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
    if (loaded) {
      // đánh dấu khán giả ảo đứng trùng chỗ với khán giả thật
      vOver.fill(0);
      peersView.forEach(pv => { for (let i = 0; i < vTotal; i++) { const dx = vX[i] - pv.x, dz = vZ[i] - pv.z; if (pv.mine ? (Math.abs(dx) < 1.4 && dz > -2.7 && dz < 1.0) : (dx * dx + dz * dz < 0.8)) vOver[i] = 1; } });
      applyHide();
      rM.forEach((x, k) => { touch(x.geo); x.geo.instanceCount = rCnt[k]; });
    }
    rings.count = n; rings.instanceMatrix.needsUpdate = true; if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
    return n;
  }

  function setSelfVisible(v) {
    selfVisible = v;
    if (myIdx >= 0) rScaleSet(myIdx, (v && !avIds.has(lastMy)) ? 1.0 : 0.0001);
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
    makeInstGeo, makeMaterial, newUniforms, touch, Look,
    nearest, setGhost,
    setCount(n) { vCount = n; if (loaded) vCountApply(); },
    total() { return vTotal; },
    count() { return loaded ? Math.min(vCount, vTotal) : 0; },
    mySlot() { return mySlot; },
    peersView() { return peersView; }, setAvatarIds
  };
})();
