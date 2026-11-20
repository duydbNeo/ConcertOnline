/* ===== net: khán giả thật. Ba cách kết nối, chọn tự động:
   1) relay WebSocket riêng (bản đưa lên Cloudflare, không cần tài khoản)
   2) capability room + user của Claude artifact
   3) chạy một mình ===== */
const Net = (() => {
  let room = null, cb = () => { }, ws = null, wsTimer = null, tries = 0, closed = false;
  const st = { uid: 'g-' + Math.random().toString(36).slice(2, 7), name: 'Khách', emote: null, et: 0, look: null };
  let peers = [], status = 'offline', account = null, cap = 0;

  function norm(p) {
    let arr = [];
    if (Array.isArray(p)) arr = p;
    else if (p && typeof p === 'object') arr = Object.entries(p).map(([k, v]) => Object.assign({ __k: k }, typeof v === 'object' && v ? v : {}));
    const out = [];
    arr.forEach(it => {
      if (!it || typeof it !== 'object') return;
      const s = it.state || it.presence || it.data || it;
      const id = s.uid || it.id || it.clientId || it.__k; if (!id) return;
      out.push({ id: String(id), name: String(s.name || it.name || 'Khách'), emote: s.emote || null, et: s.et || 0, look: s.look || null, you: !!(it.you || it.self || it.isYou) });
    });
    return out;
  }
  function emit() {
    let list = peers.slice();
    const flagged = list.find(p => p.you);
    if (flagged) flagged.id = st.uid;
    if (!list.some(p => p.id === st.uid)) list.push({ id: st.uid, name: st.name, emote: st.emote, et: st.et, look: st.look, you: true });
    const seen = new Set(); list = list.filter(p => seen.has(p.id) ? false : seen.add(p.id));
    cb(list);
  }

  /* ---------- relay WebSocket ---------- */
  function relayUrl() {
    const r = window.NM_RELAY; if (!r) return null;
    const room = 'main';
    if (r === 'auto') {
      if (!/^https?:$/.test(location.protocol)) return null;
      return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?room=' + room;
    }
    return String(r) + (String(r).includes('?') ? '&' : '?') + 'room=' + room;
  }
  function wsSend(o) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(o)); } catch (e) { } } }
  function connectWs(url, resolve) {
    let settled = false; const done = s => { if (!settled) { settled = true; resolve(s); } };
    try { ws = new WebSocket(url); } catch (e) { done('solo'); return; }
    const to = setTimeout(() => { if (!settled) { try { ws.close(); } catch (e) { } status = 'solo'; emit(); done('solo'); } }, 6000);
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'welcome') {
        clearTimeout(to); tries = 0; st.uid = m.id; cap = m.cap || 0; status = 'relay';
        wsSend({ t: 'state', name: st.name, look: st.look });
        clearInterval(wsTimer); wsTimer = setInterval(() => { if (ws && ws.readyState === 1) ws.send('ping'); }, 20000);
        emit(); done('relay');
      } else if (m.t === 'full') {
        clearTimeout(to); closed = true; cap = m.cap || 0; status = 'full'; emit(); done('full');
      } else if (m.t === 'peers') {
        const now = Date.now();
        peers = m.list.map(p => ({ id: p.id, name: p.name, emote: p.emote, et: p.emote ? now - (p.ea || 0) : 0, look: p.look, you: p.id === st.uid }));
        cap = m.cap || cap; emit();
      }
    };
    ws.onclose = () => {
      clearTimeout(to); clearInterval(wsTimer);
      if (closed) return;
      if (!settled) { status = 'solo'; emit(); done('solo'); return; }
      status = 'reconnecting'; peers = []; emit();
      const wait = Math.min(15000, 1000 * Math.pow(2, tries++)) + Math.random() * 500;
      setTimeout(() => connectWs(url, () => { }), wait);
    };
    ws.onerror = () => { };
  }

  return {
    async init(onPeers) {
      cb = onPeers;
      const url = relayUrl();
      if (url) { status = await new Promise(res => connectWs(url, res)); emit(); return status; }
      if (!(window.claude && typeof claude.use === 'function')) { status = 'offline'; emit(); return status; }
      try {
        const user = await claude.use('user');
        if (user) {
          let id = null, nm = '';
          try { const me = user.me ? await user.me() : null; if (me && typeof me === 'object') { id = me.id || null; nm = me.name || ''; } else if (typeof me === 'string') id = me; } catch (e) { }
          try { if (!id && user.id) { const v = await user.id(); if (typeof v === 'string' || typeof v === 'number') id = v; } } catch (e) { }
          try { if (id && user.profiles) { const ps = await user.profiles([id]); nm = (ps && ps[id] && ps[id].name) || nm; } } catch (e) { }
          if (id) st.uid = String(id).slice(0, 10) + '-' + Math.random().toString(36).slice(2, 7);
          if (nm) { st.name = nm; account = nm; }
        }
      } catch (e) { }
      try {
        room = await claude.use('room');
        if (room) {
          room.onPeers(p => { peers = norm(p); emit(); });
          room.presence({ uid: st.uid, name: st.name, emote: null, et: 0, look: st.look });
          status = 'room';
        }
      } catch (e) { room = null; }
      if (!room) status = 'solo';
      emit();
      return status;
    },
    setName(n) {
      st.name = (n || 'Khách').slice(0, 20);
      if (room) { try { room.presence({ uid: st.uid, name: st.name }); } catch (e) { } }
      wsSend({ t: 'state', name: st.name }); emit();
    },
    setLook(l) {
      st.look = l;
      if (room) { try { room.presence({ look: l }); } catch (e) { } }
      wsSend({ t: 'state', look: l }); emit();
    },
    emote(e) {
      st.emote = e; st.et = Date.now();
      if (room) { try { room.presence({ emote: e, et: st.et }); } catch (er) { } }
      wsSend({ t: 'state', emote: e }); emit();
    },
    id() { return st.uid; }, name() { return st.name; }, status() { return status; }, account() { return account; }, cap() { return cap; },
    relay() { return !!window.NM_RELAY; }
  };
})();
