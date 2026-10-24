// Симулятор заводчанина — сервер Telegram Mini App.
// Node.js 18+, без зависимостей. Раздаёт ./public, принимает анкеты и очки,
// проверяет подпись Telegram (initData) и отвечает боту на /start.
//
//   BOT_TOKEN=123:ABC WEBAPP_URL=https://game.example.ru HR_CHAT_ID=-100123 node server.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const WEBAPP_URL = process.env.WEBAPP_URL || '';
const HR_CHAT_ID = process.env.HR_CHAT_ID || '';          // чат/группа HR, куда бот пересылает анкеты
const PORT = Number(process.env.PORT || 8080);
const POLLING = process.env.BOT_POLLING !== '0';           // 0 — если /start обрабатывает другой бэкенд
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_AGE_SEC = 24 * 3600;

if (!BOT_TOKEN) console.warn('[warn] BOT_TOKEN не задан: анкеты и доска почёта работать не будут.');
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- storage (JSON files; for a big launch swap to a real DB) ----------
const file = n => path.join(DATA_DIR, n);
function load(n, def){ try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch (e) { return def; } }
function save(n, v){ const tmp = file(n) + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(v, null, 1)); fs.renameSync(tmp, file(n)); }
let scores = load('scores.json', {});          // { [userId]: { name, score, title, ts } }
const appendApplication = a => fs.appendFileSync(file('applications.jsonl'), JSON.stringify(a) + '\n');

// ---------- Telegram initData validation ----------
// secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token); hash = hex(HMAC_SHA256(key=secret_key, msg=data_check_string))
function checkInitData(initData){
  if (!initData || !BOT_TOKEN) return null;
  const p = new URLSearchParams(initData);
  const hash = p.get('hash'); if (!hash) return null;
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const dcs = skip => [...p.entries()].filter(([k]) => !skip.includes(k)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
  const ok = [['hash'], ['hash', 'signature']].some(skip => {
    const calc = crypto.createHmac('sha256', secret).update(dcs(skip)).digest('hex');
    return calc.length === hash.length && crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash));
  });
  if (!ok) return null;
  const authDate = Number(p.get('auth_date') || 0);
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SEC) return null;
  try { return JSON.parse(p.get('user') || 'null'); } catch (e) { return null; }
}

// ---------- Bot API ----------
async function bot(method, payload){
  if (!BOT_TOKEN) return null;
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) console.warn('[bot]', method, j.description || r.status);
  return j.result;
}
const escHtml = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// ---------- helpers ----------
const clean = (v, n = 200) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
function ageOf(d){ const b = new Date(d); if (isNaN(b)) return -1; const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; }
function send(res, code, obj){ const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(b); }
function readBody(req, limit = 32 * 1024){
  return new Promise((ok, bad) => { let n = 0, chunks = []; req.on('data', c => { n += c.length; if (n > limit){ bad(new Error('too_large')); req.destroy(); } else chunks.push(c); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { bad(e); } }); req.on('error', bad); });
}
const rate = new Map();   // naive per-user limiter for writes
function limited(uid){ const now = Date.now(), r = rate.get(uid) || []; const recent = r.filter(t => now - t < 60000); recent.push(now); rate.set(uid, recent); return recent.length > 10; }

// ---------- API ----------
async function handleApi(req, res, url){
  const user = checkInitData(req.headers['x-init-data']);
  if (url.pathname === '/api/top' && req.method === 'GET'){
    const top = Object.entries(scores).map(([id, v]) => ({ ...v, id })).sort((a, b) => b.score - a.score).slice(0, 10)
      .map(v => ({ name: v.name, title: v.title, score: v.score, me: !!user && String(user.id) === v.id }));
    return send(res, 200, { top });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!user) return send(res, 401, { error: 'Откройте игру в Telegram.' });
  if (limited(String(user.id))) return send(res, 429, { error: 'Слишком часто. Попробуйте через минуту.' });
  let body; try { body = await readBody(req); } catch (e) { return send(res, 400, { error: 'bad_json' }); }

  if (url.pathname === '/api/score'){
    const score = Math.max(0, Math.min(1e6, Math.round(Number(body.score) || 0)));
    const id = String(user.id), prev = scores[id];
    if (!prev || score > prev.score){ scores[id] = { name: clean(body.name, 24) || clean(user.first_name, 24) || 'Стажёр', title: clean(body.title, 60), score, ts: Date.now() }; save('scores.json', scores); }
    return send(res, 200, { ok: true, best: scores[id].score });
  }

  if (url.pathname === '/api/apply'){
    const f = body.form || {};
    const a = { fio: clean(f.fio, 120), birth: clean(f.birth, 10), phone: clean(f.phone, 32), email: clean(f.email, 120), study: clean(f.study, 160), job: clean(f.job, 120), when: clean(f.when, 80) };
    if (!a.fio || !a.birth || !a.phone || !a.study) return send(res, 422, { error: 'Заполните ФИО, дату рождения, телефон и место учёбы.' });
    const age = ageOf(a.birth); if (age >= 0 && age < 18) return send(res, 422, { error: '«Очаково» принимает на практику с 18 лет.' });
    const r = body.result || {};
    const rec = { ...a, tg: { id: user.id, username: user.username || null, first_name: user.first_name || null, last_name: user.last_name || null },
      result: { title: clean(r.title, 60), bonus: Number(r.bonus) || 0, quiz: Number(r.quiz) || 0, scores: r.scores && typeof r.scores === 'object' ? r.scores : {} }, ts: new Date().toISOString() };
    appendApplication(rec);
    if (HR_CHAT_ID){
      const best = Object.entries(rec.result.scores).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(', ');
      const who = user.username ? `@${escHtml(user.username)}` : `<a href="tg://user?id=${user.id}">${escHtml(user.first_name || 'профиль')}</a>`;
      const text = [`<b>Новая анкета из «Симулятора заводчанина»</b>`, '',
        `<b>${escHtml(a.fio)}</b>, ${escHtml(a.birth)} (${age >= 0 ? age + ' лет' : 'возраст ?'})`,
        `Телефон: ${escHtml(a.phone)}`, a.email ? `E-mail: ${escHtml(a.email)}` : '', `Учёба: ${escHtml(a.study)}`,
        `Интересует: ${escHtml(a.job)}`, `Готов выйти: ${escHtml(a.when)}`, `Telegram: ${who}`, '',
        `Игра: ${escHtml(rec.result.title)}, премия ${rec.result.bonus} ₽, аттестация ${rec.result.quiz}/5`, best ? `Сильнее всего: ${escHtml(best)}` : ''].filter(Boolean).join('\n');
      bot('sendMessage', { chat_id: HR_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }).catch(() => {});
    }
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: 'not_found' });
}

// ---------- static ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
function serveStatic(req, res, url){
  let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
  const fp = path.normalize(path.join(PUBLIC_DIR, p));
  if (!fp.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (err, buf) => {
    if (err){ res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Не найдено'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': p.endsWith('.html') ? 'no-cache' : 'public, max-age=86400' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (url.pathname === '/health') return send(res, 200, { ok: true });
    serveStatic(req, res, url);
  } catch (e) { console.error(e); send(res, 500, { error: 'server' }); }
});

// ---------- bot: /start + menu button (long polling) ----------
async function startBot(){
  if (!BOT_TOKEN || !WEBAPP_URL) return console.warn('[bot] BOT_TOKEN или WEBAPP_URL не заданы — бот не запущен.');
  await bot('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Играть', web_app: { url: WEBAPP_URL } } });
  await bot('setMyCommands', { commands: [{ command: 'start', description: 'Заступить на смену' }, { command: 'jobs', description: 'Вакансии и практика' }] });
  if (!POLLING) return;
  await bot('deleteWebhook', { drop_pending_updates: false });
  let offset = 0;
  for (;;){
    try {
      const ups = await bot('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] }) || [];
      for (const u of ups){
        offset = u.update_id + 1;
        const m = u.message; if (!m || !m.text) continue;
        const kb = { inline_keyboard: [[{ text: 'Заступить на смену', web_app: { url: WEBAPP_URL } }]] };
        if (m.text.startsWith('/start')){
          await bot('sendMessage', { chat_id: m.chat.id, reply_markup: kb, parse_mode: 'HTML',
            text: '<b>Симулятор заводчанина</b>\n\nТы — новенький на заводе «Очаково». Шесть профессий, двенадцать часов и наставник Михалыч. Задача простая: не уволься.\n\nВ конце — настоящие вакансии и оплачиваемая практика.' });
        } else if (m.text.startsWith('/jobs')){
          await bot('sendMessage', { chat_id: m.chat.id, parse_mode: 'HTML', disable_web_page_preview: true,
            text: 'Вакансии «Очаково»: https://hh.ru/employer/871\nКарьера: https://ochakovo.ru/rabota/\nОтдел подбора: rabota@ochakovo.ru, 8 800 100-77-77 (доб. 1155)' });
        }
      }
    } catch (e) { console.warn('[bot] polling', e.message); await new Promise(r => setTimeout(r, 3000)); }
  }
}

server.listen(PORT, () => { console.log(`Симулятор заводчанина: http://localhost:${PORT}`); startBot().catch(e => console.warn('[bot] не запустился:', e.message)); });
module.exports = { checkInitData };
