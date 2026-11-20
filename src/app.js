/* ===== app: vòng lặp chính, giao diện, diễn tập ===== */
(function () {
  const $ = id => document.getElementById(id);
  const errorLog = [];
  window.addEventListener('error', e => errorLog.push(String(e.message || e)));

  /* ---------- khởi tạo 3D ---------- */
  const canvas = $('c');
  try {
    Stage.init(canvas); Crowd.init(Stage.scene); Performers.init(Stage.scene); Wardrobe.init(Stage.renderer);
  } catch (e) {
    console.error(e); $('nowebgl').style.display = 'flex'; $('gateStatus').textContent = 'Không khởi tạo được WebGL.'; return;
  }

  /* ---------- chất lượng tự thích ứng ---------- */
  const QUAL = [
    { id: 'high', name: 'Cao', s: 1, max: 1.5, crowd: 900, beams: 14, fx: 1, led: 24 },
    { id: 'mid', name: 'Vừa', s: 0.75, max: 1.1, crowd: 560, beams: 14, fx: 0.6, led: 15 },
    { id: 'low', name: 'Thấp', s: 0.5, max: 0.8, crowd: 300, beams: 7, fx: 0.35, led: 10 }
  ];
  let qLevel = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 1 : 0, autoQ = true, upStreak = 0, lastQChange = 0;
  function applyQuality() {
    const q = QUAL[qLevel];
    Crowd.setCount(q.crowd); Stage.setQuality({ beams: q.beams, fxScale: q.fx }); applySize();
  }
  function applySize() {
    const q = QUAL[qLevel], dpr = window.devicePixelRatio || 1;
    Stage.resize(window.innerWidth, window.innerHeight, clamp(dpr * q.s, 0.5, q.max)); Wardrobe.resize();
  }
  window.addEventListener('resize', applySize);
  applyQuality();

  /* ---------- trạng thái thế giới ---------- */
  const lobbyColors = SHOW.palettes.deep;
  const lobbyCue = { pal: 'deep', light: 'dim', led: 'countdown', cam: 'wide', energy: 0.22, layers: [], layerSet: new Set(), colors: lobbyColors, text: null, _idx: -1, crowd: null };
  let E = 0.3;
  function computeW(T, time, dt) {
    const L = layout(T); let W;
    if (L.phase === 'show') {
      const cue = cueStateAt(L.t) || lobbyCue;
      W = { phase: 'show', t: L.t, cue, seg: segAt(L.t), bi: beatInfo(L.t), energy: cue.energy, colors: cue.colors, countdown: 0 };
    } else {
      const p = Math.exp(-((time) % 1) * 4.5) * 0.35;
      W = { phase: 'lobby', t: L.t, cue: lobbyCue, seg: null, bi: { beat: time, pulse: p, bpm: 60, bar: 0, f: 0 }, energy: 0.22, colors: lobbyColors, countdown: L.countdown };
    }
    E = lerp(E, W.energy, 1 - Math.exp(-dt * 3)); W.energy = E;
    return W;
  }

  /* ---------- mạng: khán giả thật ---------- */
  let realCount = 1; const seenEmote = {};
  Net.init(list => {
    realCount = list.length;
    Crowd.setPeers(list, Net.id());
    const views = Crowd.peersView();
    list.forEach(p => {
      if (p.id === Net.id()) return;
      if (p.et && seenEmote[p.id] !== p.et && Date.now() - p.et < 5000) {
        seenEmote[p.id] = p.et; const v = views.find(x => x.id === p.id);
        if (v && p.emote) Crowd.spawnEmote(p.emote, v.x, v.z);
      }
    });
  }).then(() => {
    if (Wardrobe.hasSaved()) Net.setLook(Wardrobe.getLook());
    if (Net.account()) { $('nameIn').value = Net.name(); $('loginNote').textContent = 'Bạn đang đăng nhập bằng tài khoản Claude: ' + Net.account() + '.'; }
    else {
      const s = Net.status();
      $('loginNote').textContent = s === 'relay' ? 'Không cần tài khoản. Nhập tên rồi vào concert, tối đa ' + Net.cap() + ' người xem cùng lúc.'
        : s === 'full' ? 'Phòng concert đã đủ ' + Net.cap() + ' người. Bạn vẫn xem được show cùng khán giả ảo, vào lại sau để có chỗ đứng.'
        : s === 'room' ? 'Chưa đọc được tên tài khoản, bạn vào bằng tên nhập ở trên.'
        : 'Đang xem ở chế độ một mình, khán giả thật sẽ hiện khi mở bằng link chia sẻ.';
    }
    try { const sv = localStorage.getItem('nm_name'); if (sv && !$('nameIn').value) $('nameIn').value = sv; } catch (e) { }
  });

  /* ---------- vào concert ---------- */
  let entered = false;
  async function enter(demo) {
    if (entered && !demo) return;
    entered = true;
    const nm = $('nameIn').value.trim() || ('Khách ' + Math.floor(1000 + Math.random() * 9000));
    Net.setName(nm); try { localStorage.setItem('nm_name', nm); } catch (e) { }
    if (demo) Clock.startDemo(1); else Clock.goLive();
    $('gate').hidden = true;
    Stage.setCamMode('audience'); Stage.resetLook(); setCamBtn();
    if (Wardrobe.hasSaved()) { Net.setLook(Wardrobe.getLook()); $('hud').hidden = false; } else openWardrobe(true);
    const ok = await Aud.enable(); setSoundBtn();
    if (!ok) toast('Trình duyệt chặn âm thanh. Bấm "Âm thanh" để bật.');
    Aud.resync(); lastSegId = null;
  }
  $('enterBtn').addEventListener('click', () => enter(false));
  $('demoBtn').addEventListener('click', () => enter(true));
  $('nameIn').addEventListener('keydown', e => { if (e.key === 'Enter') enter(false); });

  function openWardrobe(first) {
    $('hud').hidden = true; $('wdDone').textContent = first ? 'Xong, vào concert' : 'Lưu và quay lại concert';
    Wardrobe.open(look => { Net.setLook(look); $('hud').hidden = false; lastSegId = null; });
  }
  $('dressBtn').addEventListener('click', () => openWardrobe(false));
  function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('on'), 3200); }
  function setSoundBtn() { const b = $('soundBtn'); b.setAttribute('aria-pressed', Aud.isOn()); b.textContent = 'Âm thanh: ' + (Aud.isOn() ? 'bật' : 'tắt'); }
  function setCamBtn() { $('camBtn').textContent = 'Góc nhìn: ' + (Stage.getCamMode() === 'audience' ? 'khán đài' : 'đạo diễn'); Crowd.setSelfVisible(Stage.getCamMode() === 'director'); }
  $('soundBtn').addEventListener('click', async () => { if (Aud.isOn()) Aud.disable(); else await Aud.enable(); setSoundBtn(); });
  $('camBtn').addEventListener('click', () => { Stage.setCamMode(Stage.getCamMode() === 'audience' ? 'director' : 'audience'); setCamBtn(); });
  document.querySelectorAll('.emotes button').forEach(b => b.addEventListener('click', () => {
    const e = b.dataset.e; Net.emote(e); const s = Crowd.mySlot(); Crowd.spawnEmote(e, s.x, s.z - 2.2);
  }));

  /* ---------- điều khiển nhìn quanh ---------- */
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.classList.add('drag'); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!drag) return; if (Wardrobe.isActive()) Wardrobe.rotate((e.clientX - drag.x) * 0.012); else if (Stage.getCamMode() === 'audience') Stage.look((e.clientX - drag.x) * 0.0045, -(e.clientY - drag.y) * 0.0035); drag.x = e.clientX; drag.y = e.clientY; });
  const endDrag = () => { drag = null; canvas.classList.remove('drag'); };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', e => { e.preventDefault(); Stage.zoom(e.deltaY * 0.02); }, { passive: false });
  canvas.addEventListener('dblclick', () => Stage.resetLook());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) Aud.resync(); });

  /* ---------- hậu trường ---------- */
  const drawer = $('drawer');
  $('stageBtn').addEventListener('click', () => { drawer.classList.toggle('open'); });
  $('closeDrawer').addEventListener('click', () => drawer.classList.remove('open'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') drawer.classList.remove('open'); });
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
    document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'p-' + b.dataset.p));
  }));

  const ROLE = { vocal: 'giọng chính', guitar: 'guitar', bass: 'bass', keys: 'keyboard', drums: 'trống' };
  $('p-design').innerHTML = '<p>' + BANDS.brief + '</p>' + BANDS.bands.map(b =>
    `<div class="band"><h4>${b.name}<span class="sw"><i style="background:${b.palette.main}"></i><i style="background:${b.palette.accent}"></i></span></h4>
     <p>${b.tagline}</p><p style="margin:4px 0 8px">${b.genre}, ${b.bpm} BPM</p>` +
    b.members.map(m => `<div class="mem"><b>${m.stage}</b><span>${ROLE[m.role] || m.role}</span><em></em><em>${m.trait}</em></div>`).join('') + '</div>').join('') +
    `<h3>Tủ đồ</h3><p>${WARDROBE.brief}</p><p style="margin-top:6px">${WARDROBE.tops.length} kiểu áo, ${WARDROBE.topColors.length} màu áo, ${WARDROBE.hairStyles.length} kiểu tóc, ${WARDROBE.headAcc.length - 1} phụ kiện đầu, ${WARDROBE.backAcc.length - 1} phụ kiện lưng, ${WARDROBE.stickColors.length} màu gậy sáng, ${WARDROBE.skins.length} màu da.</p><h3>Khán giả</h3><p>${BANDS.audience.virtual}</p><p style="margin-top:6px">${BANDS.audience.real}</p><h3>Lưu ý tên gọi</h3><p>${BANDS.namingNotes}</p>`
    + (SHOW.credits && SHOW.credits.length ? '<h3>Nhạc</h3>' + SHOW.credits.map(c => `<p>${c.title}, ${c.artist}, giấy phép ${c.license}. <a href="${c.source}" target="_blank" rel="noopener" style="color:inherit">Nguồn</a></p>`).join('') : '');

  const SEGCOL = { none: '#8a5cff', solar: '#ff8a1f', luna: '#ff4fa3', both: '#19e3ff' };
  $('p-script').innerHTML = `<h3>Chủ đề</h3><p>${SHOW.theme}</p><h3>Dòng thời gian (${SHOW_LEN} giây)</h3>
    <div class="tl" id="tl">${SHOW.segments.map(s => `<div style="width:${(s.end - s.start) / SHOW_LEN * 100}%;background:${SEGCOL[s.band]}" title="${s.label}">${s.label}</div>`).join('')}<span class="ph" id="tlph"></span></div>
    <table class="cues"><thead><tr><th>Giây</th><th>Đèn</th><th>LED</th><th>Camera</th><th>Nhạc</th></tr></thead><tbody id="cueRows">${SHOW.cues.map((c, i) =>
      `<tr data-i="${i}"><td>${c.t}</td><td>${c.light || ''}</td><td>${c.led || ''}${c.fx ? ' + ' + c.fx : ''}</td><td>${c.cam || ''}</td><td>${(c.layers || []).join(', ')}</td></tr>`).join('')}</tbody></table>`;

  /* ---------- hệ thống ---------- */
  const frames = []; let rehearsing = null;
  function renderSys() {
    const info = Stage.info(), q = QUAL[qLevel];
    const avg = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
    $('p-sys').innerHTML = `<h3>Hiệu năng</h3><div class="kv"><span>Khung hình</span><b>${avg ? (1000 / avg).toFixed(0) : '–'} FPS (${avg.toFixed(1)} ms)</b>
      <span>Chất lượng</span><b>${autoQ ? 'Tự động, đang ở mức ' : ''}${q.name}</b><span>Độ phân giải vẽ</span><b>${(Stage.renderer.getPixelRatio()).toFixed(2)}x</b>
      <span>Lệnh vẽ / tam giác</span><b>${info.calls} / ${info.triangles.toLocaleString('vi-VN')}</b>
      <span>Khán giả ảo / thật</span><b>${Crowd.count()} / ${realCount}</b><span>Đồng hồ</span><b>${Clock.mode === 'live' ? 'Trực tiếp, đồng bộ mọi người' : 'Demo, chạy riêng'}</b>
      <span>Kết nối khán giả thật</span><b>${{ relay: 'Đã kết nối máy chủ', room: 'Đã kết nối', full: 'Phòng đã đầy, chế độ xem', reconnecting: 'Đang kết nối lại', solo: 'Chạy một mình', offline: 'Không có' }[Net.status()] || Net.status()}</b></div>
      <h3>Chọn chất lượng</h3><div class="seg" id="qSeg"><button data-q="auto" aria-pressed="${autoQ}">Tự động</button>${QUAL.map((x, i) => `<button data-q="${i}" aria-pressed="${!autoQ && qLevel === i}">${x.name}</button>`).join('')}</div>
      <h3>Đồng hồ buổi diễn</h3><div class="seg"><button id="goLive" aria-pressed="${Clock.mode === 'live'}">Trực tiếp</button><button id="goDemo" aria-pressed="${Clock.mode === 'demo'}">Demo từ đầu</button></div>`;
    $('qSeg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { if (b.dataset.q === 'auto') autoQ = true; else { autoQ = false; qLevel = +b.dataset.q; applyQuality(); } renderSys(); }));
    $('goLive').addEventListener('click', () => { Clock.goLive(); Aud.resync(); renderSys(); });
    $('goDemo').addEventListener('click', () => { Clock.startDemo(1); Aud.resync(); renderSys(); });
  }

  /* ---------- diễn tập ---------- */
  function validateScript() {
    const R = [], V = SHOW.vocabulary;
    let pos = 0, gap = false;
    SHOW.segments.forEach(s => {
      if (Math.abs(s.start - pos) > 1e-6) { gap = true; R.push(['bad', `Đoạn "${s.id}" bắt đầu ở ${s.start}s nhưng đoạn trước kết thúc ở ${pos}s.`]); }
      pos = s.end;
      if (!SHOW.songs[s.song]) R.push(['bad', `Đoạn "${s.id}" dùng bài "${s.song}" không có trong thư viện.`]);
      if (V.bands.indexOf(s.band) < 0) R.push(['bad', `Đoạn "${s.id}" có ban nhạc "${s.band}" không hợp lệ.`]);
    });
    if (!gap) R.push(pos === SHOW_LEN ? ['ok', `${SHOW.segments.length} đoạn nối liền nhau, tổng ${SHOW_LEN} giây.`] : ['bad', `Các đoạn kết thúc ở ${pos}s, không khớp độ dài buổi diễn ${SHOW_LEN}s.`]);
    let sorted = true, vocab = true, prev = -1;
    SHOW.cues.forEach(c => {
      if (c.t < prev) sorted = false; prev = c.t;
      if (c.t < 0 || c.t >= SHOW_LEN) { sorted = false; R.push(['bad', `Cue ${c.t}s nằm ngoài buổi diễn.`]); }
      const chk = (v, list, name) => { if (v != null && list.indexOf(v) < 0) { vocab = false; R.push(['bad', `Cue ${c.t}s: ${name} "${v}" không hợp lệ.`]); } };
      chk(c.light, V.light, 'đèn'); chk(c.led, V.led, 'LED'); chk(c.cam, V.cam, 'camera'); chk(c.fx, V.fx, 'hiệu ứng');
      if (c.pal && !SHOW.palettes[c.pal]) { vocab = false; R.push(['bad', `Cue ${c.t}s: bảng màu "${c.pal}" không có.`]); }
      (c.layers || []).forEach(l => chk(l, V.layers, 'lớp nhạc'));
    });
    if (SHOW.cues[0] && SHOW.cues[0].t !== 0) R.push(['bad', 'Cue đầu tiên phải ở giây 0.']);
    if (sorted && vocab) R.push(['ok', `${SHOW.cues.length} cue đúng thứ tự, mọi giá trị đèn, LED, camera, màu, lớp nhạc đều hợp lệ.`]);
    // cue có rơi đúng đầu ô nhịp không
    let worst = 0, off = 0, n = 0;
    SHOW.cues.forEach(c => { const sg = segAt(c.t); if (!sg || !SHOW.songs[sg.song]) return; const bar = 240 / SHOW.songs[sg.song].bpm; const d = (c.t - sg.start - (sg.grid || 0) + 1000 * bar) % bar; const o = Math.min(d, bar - d); worst = Math.max(worst, o); off += o; n++; });
    if (n) R.push([worst > 1.2 ? 'warn' : 'ok', `Cue lệch đầu ô nhịp trung bình ${(off / n).toFixed(2)}s, tối đa ${worst.toFixed(2)}s. Đèn và nhạc đổi đúng cue nhưng có thể chưa khớp ô nhịp.`]);
    return R;
  }

  async function rehearse() {
    const out = $('rehOut'), btn = $('rehBtn'); out.innerHTML = ''; btn.disabled = true;
    const add = (lvl, txt) => { const li = document.createElement('li'); li.innerHTML = `<span class="${lvl}">${{ ok: '✓', warn: '!', bad: '✕' }[lvl]}</span><span></span>`; li.lastChild.textContent = txt; out.appendChild(li); };
    validateScript().forEach(r => add(r[0], r[1]));
    const dry = Aud.dryRun();
    let maxd = 0, empty = [];
    SHOW.segments.forEach(s => { const d = dry[s.id]; if (!d) return; maxd = Math.max(maxd, d.perSec); if (SHOW.songs[s.song] && d.events === 0) empty.push(s.id); });
    add(empty.length ? 'bad' : 'ok', empty.length ? 'Đoạn không có âm thanh: ' + empty.join(', ') : `Âm thanh: mọi đoạn đều có nhạc, đoạn dày nhất ${maxd.toFixed(0)} sự kiện mỗi giây.`);
    add(maxd > 45 ? 'warn' : 'ok', maxd > 45 ? 'Quá nhiều nốt cùng lúc có thể làm máy yếu bị rè tiếng.' : 'Số nốt cùng lúc nằm trong ngưỡng an toàn cho điện thoại.');
    const prev = { mode: Clock.mode, warp: Clock.warp, audio: Aud.isOn(), auto: autoQ, cam: Stage.getCamMode(), lvl: qLevel };
    if (prev.audio) Aud.disable();
    autoQ = false; const errs0 = errorLog.length;
    add('ok', 'Đang chạy cả buổi diễn nhanh 12 lần để đo khung hình…');
    Clock.startDemo(12); rehearsing = { f: [], t0: performance.now() };
    await new Promise(r => setTimeout(r, (SHOW_LEN / 12 + 0.8) * 1000));
    const f = rehearsing.f.slice(); rehearsing = null;
    if (f.length > 10) {
      f.sort((a, b) => a - b);
      const avg = f.reduce((a, b) => a + b, 0) / f.length, p95 = f[Math.floor(f.length * 0.95)], worst = f[f.length - 1];
      const lvl = p95 < 34 ? 'ok' : p95 < 55 ? 'warn' : 'bad';
      add(lvl, `Hiệu năng ở mức "${QUAL[qLevel].name}": trung bình ${(1000 / avg).toFixed(0)} FPS, 95% khung hình dưới ${p95.toFixed(0)} ms, khung chậm nhất ${worst.toFixed(0)} ms.`);
      if (lvl !== 'ok') add('warn', 'Máy này nên để chất lượng Tự động hoặc Thấp. Chế độ Tự động sẽ hạ mức khi tụt dưới 36 FPS.');
    } else add('warn', 'Tab đang ở nền nên chưa đo được khung hình. Hãy giữ tab mở khi diễn tập.');
    const newErr = errorLog.length - errs0;
    add(newErr ? 'bad' : 'ok', newErr ? `Có ${newErr} lỗi JavaScript trong lúc chạy: ${errorLog.slice(-1)[0]}` : 'Không có lỗi JavaScript trong cả buổi diễn.');
    autoQ = prev.auto;
    if (prev.mode === 'live') Clock.goLive(); else Clock.startDemo(1);
    if (prev.audio) await Aud.enable(); Aud.resync(); setSoundBtn();
    btn.disabled = false;
  }
  $('rehBtn').addEventListener('click', rehearse);

  /* ---------- vòng lặp ---------- */
  let last = performance.now(), lastSegId = null, lastCueIdx = -2, lastT = 0, ledAcc = 0, hudAcc = 0, sysAcc = 0, qAcc = 0, frameN = 0, lowT = 0;
  const lowerEl = $('lower');
  function frame(now) {
    requestAnimationFrame(frame);
    const dtms = now - last; last = now;
    const dt = Math.min(0.1, dtms / 1000), time = now / 1000;
    frames.push(dtms); if (frames.length > 90) frames.shift();
    if (rehearsing) rehearsing.f.push(dtms);

    const W = computeW(Clock.now(), time, dt);
    // kích hoạt hiệu ứng khi vào cue mới (chỉ khi thời gian trôi liên tục, không bắn lại khi tua)
    const idx = W.cue._idx;
    if (idx !== lastCueIdx) {
      if (W.phase === 'show' && Math.abs(W.t - lastT) < 3 && lastCueIdx !== -2) {
        if (W.cue.fx) Stage.burst(W.cue.fx, W.colors);
        if (W.cue.cheer) Aud.cheer(W.cue.cheer);
      }
      lastCueIdx = idx;
    }
    lastT = W.t;

    // đoạn mới thì hiện thanh tên bài
    const sid = W.seg ? W.seg.id : 'lobby';
    if (sid !== lastSegId) {
      lastSegId = sid;
      if (!$('hud').hidden) {
        if (W.seg) {
          const bn = W.seg.band === 'none' ? SHOW.title : W.seg.band === 'both' ? BANDS.bands.map(b => b.name).join(' x ') : BANDS.bands.find(b => b.id === W.seg.band).name;
          $('lowTitle').textContent = W.seg.label; $('lowSub').textContent = bn;
        } else { $('lowTitle').textContent = 'Mở cửa'; $('lowSub').textContent = 'Buổi diễn sắp bắt đầu'; }
        lowerEl.classList.remove('off'); clearTimeout(lowerEl._t); lowerEl._t = setTimeout(() => lowerEl.classList.add('off'), 6500);
        lowerEl.style.borderLeftColor = W.colors[0];
      }
    }

    Performers.update(W, time, dt);
    Crowd.update(W, time, dt);
    Stage.updateLights(W, time, dt);
    Stage.updateCamera(W, time, dt);
    Stage.updateFx(dt);

    ledAcc += dt;
    if (ledAcc > 1 / QUAL[qLevel].led) {
      ledAcc = 0;
      LED.draw(W.cue, W.t, W.bi, Aud.spectrum(32), W.phase === 'lobby' ? W.countdown : null);
    }
    if (Wardrobe.isActive()) Wardrobe.render(time, dt); else Stage.render();

    // chất lượng tự thích ứng
    qAcc += 1; frameN++;
    if (qAcc >= 60 && autoQ && !rehearsing) {
      qAcc = 0;
      const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
      if (avg > 28 && qLevel < QUAL.length - 1 && now - lastQChange > 2500) { qLevel++; lastQChange = now; upStreak = 0; applyQuality(); }
      else if (avg < 16.8 && qLevel > 0) { upStreak++; if (upStreak >= 6 && now - lastQChange > 8000) { qLevel--; lastQChange = now; upStreak = 0; applyQuality(); } }
      else upStreak = 0;
    }

    // HUD
    hudAcc += dt;
    if (hudAcc > 0.25) {
      hudAcc = 0;
      const demo = Clock.mode === 'demo' ? 'Demo, ' : '';
      const gs = W.phase === 'lobby' ? `Mở cửa. Bắt đầu sau ${fmtTime(W.countdown)}.` : `Đang diễn: ${W.seg ? W.seg.label : ''}.`;
      $('gateStatus').textContent = W.phase === 'lobby' ? `Cửa đã mở. Buổi diễn bắt đầu sau ${fmtTime(W.countdown)}.` : `Đang diễn "${W.seg ? W.seg.label : ''}". Vào ngay để xem tiếp.`;
      $('hudSub').textContent = demo + (W.phase === 'lobby' ? `Mở cửa, bắt đầu sau ${fmtTime(W.countdown)}` : `${W.seg ? W.seg.label : ''}, còn ${fmtTime(SHOW_LEN - W.t)}`);
      $('hudCount').textContent = `${realCount}${Net.cap() ? '/' + Net.cap() : ''} người thật, ${Crowd.count()} khán giả ảo`;
      $('liveDot').className = 'dot' + (W.phase === 'lobby' ? ' lobby' : '');
      if (drawer.classList.contains('open')) {
        document.querySelectorAll('#cueRows tr').forEach(r => r.classList.toggle('now', +r.dataset.i === W.cue._idx));
        $('tlph').style.left = (W.phase === 'show' ? W.t / SHOW_LEN * 100 : 0) + '%';
      }
    }
    sysAcc += dt;
    if (sysAcc > 1 && drawer.classList.contains('open') && $('p-sys').classList.contains('on')) { sysAcc = 0; if (!document.activeElement || !$('p-sys').contains(document.activeElement)) renderSys(); }
  }
  renderSys();
  requestAnimationFrame(frame);

  window.__concert = { Clock, Stage, Crowd, Aud, Net, Wardrobe, rehearse, validateScript, setQ(i) { autoQ = false; qLevel = i; applyQuality(); }, enter, errorLog, frames };
})();
