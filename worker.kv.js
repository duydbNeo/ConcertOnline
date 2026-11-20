/* Neon Midnight relay: Cloudflare Worker + Durable Object (WebSocket hibernation).
   Một phòng = một Durable Object. Giới hạn số người, kiểm tra dữ liệu, chống spam. */
const EMOTES = ['👏', '🔦', '🔥', '❤️'];
const DEFAULT_CAP = 100;
const BROADCAST_MS = 250;
const MAX_MSG_BYTES = 512;
const RATE_PER_SEC = 8;
const LIM = [4, 8, 3, 6, 5, 2, 8, 7]; // số lựa chọn tối đa của từng ô trong look (khớp wardrobe.json)

function cleanName(s) {
  s = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20);
  return s || 'Khách';
}
function cleanLook(l) {
  if (!Array.isArray(l) || l.length !== 8) return null;
  for (let i = 0; i < 8; i++) if (!Number.isInteger(l[i]) || l[i] < 0 || l[i] >= LIM[i]) return null;
  return l;
}

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    this.rate = new WeakMap();
    this.cap = Math.max(1, parseInt(env.MAX_PER_ROOM || DEFAULT_CAP, 10) || DEFAULT_CAP);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/stats')) {
      return Response.json({ online: this.ctx.getWebSockets().length, cap: this.cap });
    }
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Cần WebSocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (this.ctx.getWebSockets().length >= this.cap) {
      server.accept();
      server.send(JSON.stringify({ t: 'full', cap: this.cap }));
      server.close(1013, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    const id = 'u' + crypto.randomUUID().slice(0, 8);
    server.serializeAttachment({ id, name: 'Khách', look: null, emote: null, et: 0 });
    server.send(JSON.stringify({ t: 'welcome', id, cap: this.cap }));
    this.schedule();
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MSG_BYTES) return;
    const now = Date.now();
    let r = this.rate.get(ws); if (!r || now - r.s > 1000) { r = { s: now, n: 0 }; this.rate.set(ws, r); }
    if (++r.n > RATE_PER_SEC) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || m.t !== 'state') return;
    const a = ws.deserializeAttachment() || {};
    if ('name' in m) a.name = cleanName(m.name);
    if ('look' in m) { const l = cleanLook(m.look); if (l) a.look = l; }
    if ('emote' in m && EMOTES.includes(m.emote)) { a.emote = m.emote; a.et = now; }
    ws.serializeAttachment(a);
    this.schedule();
  }

  webSocketClose(ws) { try { ws.close(); } catch (e) { } this.schedule(); }
  webSocketError() { this.schedule(); }

  schedule() { this.ctx.storage.getAlarm().then(t => { if (!t) this.ctx.storage.setAlarm(Date.now() + BROADCAST_MS); }); }

  async alarm() {
    const now = Date.now();
    const sockets = this.ctx.getWebSockets();
    const list = [];
    for (const ws of sockets) {
      const a = ws.deserializeAttachment(); if (!a) continue;
      list.push({ id: a.id, name: a.name, look: a.look, emote: a.emote, ea: a.emote ? now - a.et : 0 });
    }
    const msg = JSON.stringify({ t: 'peers', list, cap: this.cap });
    for (const ws of sockets) { try { ws.send(msg); } catch (e) { } }
  }
}

const PAGE_URL = 'https://raw.githubusercontent.com/duydbNeo/ConcertOnline/main/public/index.html';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'PUT,OPTIONS' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    if (p === '/ws' || p === '/stats') {
      const name = (url.searchParams.get('room') || 'main').replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'main';
      const stub = env.ROOM.get(env.ROOM.idFromName(name));
      const u = new URL(request.url); u.pathname = p;
      return stub.fetch(new Request(u, request));
    }
    // Tải nhạc lên KV: chỉ bật khi có UPLOAD_TOKEN (gỡ biến này để tắt)
    if (p.startsWith('/_up/') && env.UPLOAD_TOKEN) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      const name = p.slice(5);
      if (request.method !== 'PUT' || !/^[a-z0-9_-]{1,40}$/.test(name) || request.headers.get('authorization') !== 'Bearer ' + env.UPLOAD_TOKEN) return new Response('No', { status: 403, headers: CORS });
      const buf = await request.arrayBuffer();
      if (buf.byteLength > 24 * 1024 * 1024) return new Response('Too big', { status: 413, headers: CORS });
      await env.PAGE.put('a:' + name, buf);
      return new Response(JSON.stringify({ ok: true, bytes: buf.byteLength }), { headers: CORS });
    }
    const m = p.match(/^\/audio\/([a-z0-9_-]{1,40})\.mp3$/);
    if (m) {
      const buf = await env.PAGE.get('a:' + m[1], { type: 'arrayBuffer' });
      if (!buf) return new Response('Not found', { status: 404 });
      return new Response(buf, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=86400' } });
    }
    if (p === '/' || p === '/index.html') {
      let html = null;
      try { const r = await fetch(PAGE_URL, { cf: { cacheTtl: 60, cacheEverything: true } }); if (r.ok) html = await r.text(); } catch (e) { }
      if (!html) {
        const n = parseInt(await env.PAGE.get('n'), 10);
        const parts = await Promise.all(Array.from({ length: n }, (_, i) => env.PAGE.get('p' + i)));
        html = parts.join('');
        const show = await env.PAGE.get('show');
        if (show) html = html.replace(/(<script type="application\/json" id="show-data">)[\s\S]*?(<\/script>)/, (m2, a, b) => a + show + b);
      }
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } });
    }
    return new Response('Not found', { status: 404 });
  }
};
