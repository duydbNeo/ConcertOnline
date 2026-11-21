/* ===== avatar: nhân vật glTF (bộ xương dùng chung), tủ đồ module theo giới, che da bằng shader ===== */
const Avatar = (() => {
  const V3 = WARDROBE.v3;
  const BASE = (window.NM_ASSET_BASE != null ? window.NM_ASSET_BASE : '') + '/a3d/';
  const CWS = V3.colorways.map(c => c.id);
  const loader = new THREE.GLTFLoader(), texLoader = new THREE.TextureLoader();
  const kitP = {}, texC = {}, accP = {};
  let animP = null;

  function glb(url) { return new Promise((res, rej) => loader.load(url, res, undefined, rej)); }
  function tex(name, linear) {
    const k = name; if (texC[k]) return texC[k];
    const t = texLoader.load(BASE + 'tex/' + name); t.flipY = false; t.encoding = THREE.LinearEncoding; t.anisotropy = 4; texC[k] = t; return t;
  }
  function kit(g) {
    if (!kitP[g]) kitP[g] = glb(BASE + 'kit_' + (g === 'F' ? 'Female' : 'Male') + '.glb').then(r => {
      r.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (o.material && o.material.map) { o.material.map.encoding = THREE.LinearEncoding; o.material.map.needsUpdate = true; } } });
      return r.scene;
    });
    return kitP[g];
  }
  function anims() {
    if (!animP) animP = glb(BASE + 'anim.glb').then(r => { const m = {}; r.animations.forEach(a => { m[a.name] = a; }); return m; });
    return animP;
  }
  function acc(name) { if (!accP[name]) accP[name] = glb(BASE + 'acc/' + name + '.glb').then(r => r.scene); return accP[name]; }
  const ready = g => Promise.all([kit(g), anims()]);

  // ---- mã hoá look: [g, top, topc, bot, botc, shoe, shoec, hair, hairc, skin, exmask, head, neck, wrist, back, hand, stickc]
  const G = V3.G;
  const gk = i => (i ? 'M' : 'F');
  const L = {
    valid(a) {
      if (!Array.isArray(a) || a.length !== 17) return false;
      for (let i = 0; i < 17; i++) if (!Number.isInteger(a[i]) || a[i] < 0) return false;
      const d = G[gk(a[0])]; if (a[0] > 1) return false;
      return a[1] < d.tops.length && a[2] < CWS.length && a[3] < d.bottoms.length && a[4] < CWS.length && a[5] < d.shoes.length && a[6] < CWS.length &&
        a[7] < d.hair.length && a[8] < V3.hairColors.length && a[9] < V3.skins.length && a[10] < (1 << d.extras.length) &&
        a[11] < V3.acc.head.length && a[12] < V3.acc.neck.length && a[13] < V3.acc.wrist.length && a[14] < V3.acc.back.length && a[15] < V3.acc.hand.length && a[16] < V3.stickColors.length;
    },
    def(g) { return [g, 0, g ? 5 : 0, 0, g ? 5 : 1, 0, g ? 1 : 2, 0, g ? 0 : 4, g ? 2 : 1, 0, 0, 0, 0, 0, 0, 0]; },
    random(g) {
      const d = G[gk(g)], r = n => Math.floor(Math.random() * n);
      let ex = 0; d.extras.forEach((e, i) => { if (Math.random() < 0.25) ex |= (1 << i); });
      return [g, r(d.tops.length), r(CWS.length), r(d.bottoms.length), r(CWS.length), r(d.shoes.length), r(CWS.length), r(d.hair.length), r(V3.hairColors.length), r(V3.skins.length), ex,
        r(V3.acc.head.length), r(V3.acc.neck.length), r(V3.acc.wrist.length), r(V3.acc.back.length), r(V3.acc.hand.length), 0];
    },
    // tương thích với khán giả ảo dựng instancing (look 8 số)
    legacy(a) { return [a[1] % 4, a[2] % 8, a[7] % 3, a[8] % 6, 0, 0, a[9] % 8, 0]; },
    fallback(id) { const h = (hashStr(id) >>> 0), g = h & 1; const l = L.def(g); l[1] = (h >> 1) % G[gk(g)].tops.length; l[2] = (h >> 4) % CWS.length; l[3] = (h >> 7) % G[gk(g)].bottoms.length; l[4] = (h >> 10) % CWS.length; l[7] = (h >> 13) % G[gk(g)].hair.length; l[8] = (h >> 16) % V3.hairColors.length; l[9] = (h >> 19) % V3.skins.length; return l; }
  };

  // ---- vật liệu
  const SKIN_REF = new THREE.Color(0.9, 0.72, 0.6);
  function patchSkin(mat, cover) {
    const arr = []; for (let i = 0; i < 8; i++) arr.push(new THREE.Vector3(0, 0, 0));
    cover.forEach((c, i) => { if (i < 8) arr[i].set(c[0] === 'y' ? 1 : 2, c[1], c[2]); });
    mat.userData.cover = arr; mat.userData.coverN = Math.min(8, cover.length);
    mat.onBeforeCompile = sh => {
      sh.uniforms.uCover = { value: arr }; sh.uniforms.uCoverN = { value: Math.min(8, cover.length) };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest; uniform vec3 uCover[8]; uniform int uCoverN;')
        .replace('void main() {', 'void main() {\n for(int i=0;i<8;i++){ if(i>=uCoverN) break; vec3 c=uCover[i]; float ax=abs(vRest.x);\n  if(c.x<1.5){ float lim=vRest.y>1.0?0.22:0.31; if(vRest.y>=c.y && vRest.y<=c.z && ax<lim) discard; }\n  else { if(ax>=c.y && ax<=c.z && ax>=0.2) discard; } }');
    };
    mat.customProgramCacheKey = () => 'skincover';
    mat.needsUpdate = true;
  }
  const cwOf = i => V3.colorways[i];
  function atlasMat(kind, cw, cache) {
    const key = kind + cw; if (cache[key]) return cache[key];
    const id = CWS[cw]; let m;
    if (kind === 'ranger') { m = new THREE.MeshStandardMaterial({ skinning: true, map: tex('ranger_' + id + '.jpg'), emissive: new THREE.Color(1, 1, 1), emissiveMap: tex('ranger_' + id + '_em.jpg'), emissiveIntensity: 1.6, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide }); }
    else if (kind === 'peasant') { m = new THREE.MeshStandardMaterial({ skinning: true, map: tex('peasant_' + id + '.jpg'), roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide }); }
    else if (kind === 'solid') { m = new THREE.MeshStandardMaterial({ skinning: true, color: new THREE.Color(cwOf(cw).hex).multiplyScalar(0.55), roughness: 0.7, side: THREE.DoubleSide }); }
    else { const c = new THREE.Color(cwOf(cw).neon); m = new THREE.MeshStandardMaterial({ skinning: true, color: c, emissive: c, emissiveIntensity: 1.6 }); }
    cache[key] = m; return m;
  }

  // ---- tạo nhân vật
  async function create(look0) {
    const g = gk(look0[0]); const [src, clips] = await ready(g);
    const root = new THREE.Group(); const body = THREE.SkeletonUtils.clone(src); root.add(body);
    const D = G[g], mats = {}; const own = [];
    const meshes = {}; body.traverse(o => { if (o.isMesh) meshes[o.name] = o; });
    const bones = {}; body.traverse(o => { if (o.isBone) bones[o.name] = o; });
    { const known = new Set([D.skin, 'eyes', 'brows']); [...D.tops, ...D.bottoms, ...D.shoes, ...D.extras, ...D.hair].forEach(it => it.parts.forEach(n => known.add(n))); Object.keys(meshes).forEach(n => { if (!known.has(n)) meshes[n].visible = false; }); }
    body.updateMatrixWorld(true);
    const restW = {}; Object.keys(bones).forEach(n => { const p = new THREE.Vector3(), q = new THREE.Quaternion(); bones[n].matrixWorld.decompose(p, q, new THREE.Vector3()); restW[n] = { p, q }; });
    const restP = {}; Object.keys(bones).forEach(n => { const b = bones[n]; restP[n] = [b.position.clone(), b.quaternion.clone(), b.scale.clone()]; });
    const mixer = new THREE.AnimationMixer(body);
    const A = {}; Object.keys(clips).forEach(k => { A[k] = mixer.clipAction(clips[k]); });
    function resetPose() { mixer.stopAllAction(); Object.keys(restP).forEach(n => { const b = bones[n], r = restP[n]; b.position.copy(r[0]); b.quaternion.copy(r[1]); b.scale.copy(r[2]); }); }
    let handQ = new THREE.Quaternion();
    if (A.dance && bones.hand_r) { A.dance.reset().play(); mixer.update(0.0001); body.updateMatrixWorld(true); bones.hand_r.getWorldQuaternion(handQ); resetPose(); body.updateMatrixWorld(true); }
    let cur = null, look = null, accObjs = [];
    const skinMat = new THREE.MeshStandardMaterial({ skinning: true, map: meshes[D.skin].material.map, roughness: 0.55, color: new THREE.Color(1, 1, 1) });
    meshes[D.skin].material = skinMat;
    const hairMats = {};
    function hairMat(tx, ci) { const k = tx + ci; if (!hairMats[k]) { hairMats[k] = new THREE.MeshStandardMaterial({ skinning: true, map: tex('hair' + tx + '.png'), color: new THREE.Color(V3.hairColors[ci]), alphaTest: 0.5, transparent: false, side: THREE.DoubleSide, roughness: 0.5 }); } return hairMats[k]; }

    function setPart(names, on, mat) { names.forEach(n => { const m = meshes[n]; if (!m) return; m.visible = on; if (on && mat) m.material = mat; }); }

    function apply(l) {
      look = l.slice(); const cover = [];
      [...D.tops, ...D.bottoms, ...D.shoes, ...D.extras, ...D.hair].forEach(it => setPart(it.parts, false));
      const it = (list, i) => list[i];
      const top = it(D.tops, l[1]), bot = it(D.bottoms, l[3]), shoe = it(D.shoes, l[5]), hair = it(D.hair, l[7]);
      setPart(top.parts, true, atlasMat(top.atlas, l[2], mats)); cover.push(...top.cover);
      setPart(bot.parts, true, atlasMat(bot.atlas, l[4], mats)); cover.push(...bot.cover);
      if (bot.id === 'skirt') { // viền neon
        const trim = meshes['bot_skirt_1']; if (trim) { trim.visible = true; trim.material = atlasMat('trim', l[4], mats); }
        const sk = meshes['bot_skirt_0']; if (sk) sk.material = atlasMat('solid', l[4], mats);
      }
      setPart(shoe.parts, true, atlasMat(shoe.atlas, l[6], mats)); cover.push(...shoe.cover);
      let hood = false;
      D.extras.forEach((e, i) => {
        if (!(l[10] & (1 << i))) return;
        if (e.id === 'hood') hood = true;
        if (e.atlas === 'hair') setPart(e.parts, true, hairMat(e.tex, l[8])); else setPart(e.parts, true, atlasMat(e.atlas, l[2], mats));
      });
      if (!hood) setPart(hair.parts, true, hairMat(hair.tex, l[8]));
      { const c = new THREE.Color(V3.skins[l[9]]); skinMat.color.setRGB(c.r / (SKIN_REF.r || 1) * 0.92, c.g / (SKIN_REF.g || 1) * 0.92, c.b / (SKIN_REF.b || 1) * 0.92); }
      patchSkin(skinMat, cover);
      // phụ kiện gắn xương
      accObjs.forEach(o => o.parent && o.parent.remove(o)); accObjs = [];
      body.updateMatrixWorld(true);
      const M = g === 'M';
      const HEAD_Y = M ? 1.654 : 1.612;
      const Q0 = new THREE.Quaternion();
      const mid = (a, b, t) => restW[a].p.clone().lerp(restW[b].p, t);
      const slots = [
        ['head', l[11], 'Head', () => new THREE.Vector3(0, HEAD_Y, 0), Q0],
        ['neck', l[12], 'neck_01', () => restW.neck_01.p.clone(), Q0],
        ['wrist', l[13], 'lowerarm_r', () => mid('lowerarm_r', 'hand_r', 0.78), Q0],
        ['back', l[14], 'spine_03', () => restW.spine_03.p.clone().add(new THREE.Vector3(0, 0.03, -0.09)), Q0],
        ['hand', l[15], 'hand_r', () => { const d = restW.middle_01_r ? restW.middle_01_r.p.clone().sub(restW.hand_r.p).normalize().multiplyScalar(0.035) : new THREE.Vector3(); return restW.hand_r.p.clone().add(d); }, 'hand']
      ];
      slots.forEach(([slot, idx, bn, anchor, qd]) => {
        const ent = V3.acc[slot][idx]; const id = ent.id; if (!id) return;
        acc(id).then(src => {
          if (look !== l && look.join() !== l.join()) return;
          const o = src.clone(true); o.traverse(x => { if (x.isMesh) { x.frustumCulled = false; if (x.material && x.material.map) x.material.map.encoding = THREE.LinearEncoding; } });
          const b = bones[bn]; if (!b || !restW[bn]) return;
          const f = (ent.fit && (ent.fit[g] || ent.fit.all)) || {}, sc = f.s || 1, of = f.o || [0, 0, 0];
          const r = restW[bn], qi = r.q.clone().invert();
          const wp = anchor().add(new THREE.Vector3(of[0], of[1], of[2]));
          o.position.copy(wp.sub(r.p).applyQuaternion(qi));
          const want = qd === 'hand' ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0.25).normalize()) : qd;
          if (qd === 'hand') o.quaternion.copy(handQ.clone().invert().multiply(want)); else o.quaternion.copy(qi.multiply(want));
          if (f.r) { const e = new THREE.Quaternion().setFromEuler(new THREE.Euler(f.r[0], f.r[1], f.r[2])); o.quaternion.multiply(e); }
          o.scale.setScalar(sc);
          b.add(o); accObjs.push(o);
        }).catch(() => { });
      });
    }
    function play(name, fade) {
      const a = A[name]; if (!a || cur === a) return; a.reset().play(); if (cur) cur.crossFadeTo(a, fade == null ? 0.25 : fade, false); cur = a;
    }
    apply(look0); play('dance'); mixer.update(Math.random() * 0.8);
    return {
      root, g, mixer, resetPose, setLook: apply, play, getLook: () => look.slice(),
      update(dt, bpm) { if (A.dance) A.dance.timeScale = (bpm || 118) / 75; mixer.update(dt); },
      dispose() { root.parent && root.parent.remove(root); }
    };
  }
  return { create, ready, Look: L, kit, V3, G, CWS };
})();
