// Демо-режим без сервера: тот же API, но база живёт в localStorage этого браузера.
// Подключается только в демо-сборке (node build-demo.js), на настоящем сервере не используется.
'use strict';
(function () {
  const KEY = 'ochakovo.demo.db.v2';
  const VACS = [
    ['lab', 'Лаборант / химик-лаборант', 'Лаборатория', 'от 60 000 ₽', 'funnel'],
    ['rozliv', 'Оператор линии розлива', 'Цех розлива', 'от 70 000 ₽', 'bottle'],
    ['tech', 'Оператор технологического цеха', 'Технологический цех', 'от 70 000 ₽', 'kettle'],
    ['sklad', 'Оператор склада', 'Складской комплекс', 'от 60 000 ₽', 'crate'],
    ['kladov', 'Кладовщик', 'Складской комплекс', 'от 56 000 ₽', 'crate'],
    ['mash', 'Машинист оборудования / оператор котельной', 'Производство', 'по итогам собеседования', 'tank'],
    ['technolog', 'Технолог', 'Отдел новых вкусов', 'по итогам собеседования', 'hops'],
    ['free', 'Бесплатная практика по договорённости', 'Разные отделы', 'учебная практика', 'wheat'],
    ['open', 'Пока не знаю — открыт к предложениям', 'Любой отдел', '', 'can']
  ].map(([id, title, dept, pay, icon], i) => ({ id, title, dept, pay, schedule: '', icon, active: 1, sort: (i + 1) * 10 }));

  function seed() {
    const cands = window.OCHAKOVO_SAMPLE(36).map((c, i) => ({ ...c, id: i + 1 }));
    cands.push({ ...cands[3], id: 37, source: 'self', created_at: new Date().toISOString(), rating: 0, hot: 0, comment: '', stage: 'new', archived: 0 }); // повтор для примера
    const notes = cands.filter(c => c.comment).map((c, i) => ({ id: i + 1, candidate_id: c.id, created_at: c.created_at, author: c.staff_name, text: c.comment }));
    return { vacancies: VACS, candidates: cands, notes, seq: 38, nseq: notes.length + 1 };
  }
  let mem = null;
  const load = () => { if (mem) return mem; try { mem = JSON.parse(localStorage.getItem(KEY)); } catch { /* нет доступа */ } return (mem ||= seed()); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* приватный режим: живём в памяти */ } };
  const err = (status, error, fields) => Object.assign(new Error(error), { status, fields: fields || {} });
  const now = () => new Date().toISOString();
  const clone = o => JSON.parse(JSON.stringify(o));

  function normPhone(p) { let d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1); if (d.length === 10) d = '7' + d;
    return d.length === 11 && d[0] === '7' ? `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}` : '+' + d; }
  function insert(db, b, source) {
    const t = now(); const c = { id: db.seq++, created_at: t, updated_at: t, source, consent_at: t, archived: 0, archived_at: null,
      stage: 'new', rating: 0, hot: 0, comment: '', next_step: '', staff_name: '' };
    for (const k of ['event', 'last_name', 'first_name', 'middle_name', 'email', 'who', 'edu_level', 'grad_year', 'school', 'specialty', 'employment', 'start_date', 'shifts', 'resume_url', 'experience', 'about']) c[k] = String(b[k] || '').trim();
    c.full_name = [c.last_name, c.first_name, c.middle_name].filter(Boolean).join(' '); c.still_studying = b.still_studying ? 1 : 0;
    c.phone = normPhone(b.phone); c.telegram = b.telegram ? '@' + String(b.telegram).replace(/^@+/, '') : ''; c.age = b.age ? +b.age : null; c.vacancy_id = b.vacancy_id || null;
    if (source === 'staff') Object.assign(c, { stage: b.stage || 'new', rating: +b.rating || 0, hot: b.hot ? 1 : 0, comment: b.comment || '', next_step: b.next_step || '', staff_name: b.staff_name || '' });
    db.candidates.push(c);
    if (c.comment) db.notes.push({ id: db.nseq++, candidate_id: c.id, created_at: t, author: c.staff_name, text: c.comment });
    save(); return c.id;
  }

  window.DEMO_API = async function (method, path, body) {
    await new Promise(r => setTimeout(r, 120)); // как будто сеть
    const db = load(); const [p, qs] = path.split('?'); const q = new URLSearchParams(qs);
    if (p === '/api/vacancies') return clone(db.vacancies.filter(v => q.get('all') === '1' || v.active).sort((a, b) => a.sort - b.sort));
    if (p === '/api/me') return { staff: true };
    if (p === '/api/login' || p === '/api/logout') return { ok: true };
    if (p === '/api/candidates' && method === 'POST') return { ok: true, id: insert(db, body, 'self') };
    if (p === '/api/staff/candidates' && method === 'GET') {
      return clone(db.candidates).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(c => ({ ...c,
        dupes: db.candidates.filter(d => d.phone === c.phone && d.id !== c.id).length, notes_count: db.notes.filter(n => n.candidate_id === c.id).length }));
    }
    if (p === '/api/staff/candidates' && method === 'POST') return { ok: true, id: insert(db, body, 'staff') };
    if (p === '/api/staff/candidates/bulk') {
      for (const id of body.ids) {
        const i = db.candidates.findIndex(c => c.id === id); if (i < 0) continue;
        if (body.action === 'delete') { db.candidates.splice(i, 1); db.notes = db.notes.filter(n => n.candidate_id !== id); }
        else if (body.action === 'stage') db.candidates[i].stage = body.stage;
        else Object.assign(db.candidates[i], { archived: body.action === 'archive' ? 1 : 0, archived_at: body.action === 'archive' ? now() : null });
      }
      save(); return { ok: true };
    }
    let m = p.match(/^\/api\/staff\/candidates\/(\d+)(\/notes)?$/);
    if (m) {
      const id = +m[1]; const c = db.candidates.find(x => x.id === id); if (!c) throw err(404, 'Кандидат не найден');
      if (m[2] && method === 'GET') return clone(db.notes.filter(n => n.candidate_id === id)).sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (m[2] && method === 'POST') { db.notes.push({ id: db.nseq++, candidate_id: id, created_at: now(), author: body.author || '', text: body.text }); save(); return { ok: true }; }
      if (method === 'PATCH') { Object.assign(c, body, { updated_at: now() }); if ('hot' in body) c.hot = body.hot ? 1 : 0; save(); return { ok: true }; }
      if (method === 'DELETE') { db.candidates = db.candidates.filter(x => x.id !== id); save(); return { ok: true }; }
    }
    if (p === '/api/staff/vacancies' && method === 'POST') { db.vacancies.push({ id: 'v' + Date.now().toString(36), title: body.title, dept: body.dept || '', pay: body.pay || '', schedule: '', icon: 'bottle', active: 1, sort: 85 }); save(); return { ok: true }; }
    m = p.match(/^\/api\/staff\/vacancies\/(.+)$/);
    if (m && method === 'PATCH') { const v = db.vacancies.find(x => x.id === m[1]); if (v) v.active = body.active ? 1 : 0; save(); return { ok: true }; }
    throw err(404, 'Нет такого метода');
  };
  window.DEMO_RESET = () => { mem = seed(); save(); location.reload(); };

  // CSV и печать в демо недоступны — подсказываем, что они есть в полной версии.
  document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = 'button[onclick="window.print()"]{display:none!important}';
    document.head.append(st);
    const csv = document.getElementById('csv');
    if (csv) { csv.removeAttribute('download'); csv.addEventListener('click', e => { e.preventDefault(); toast('Выгрузка в CSV (Excel) работает в полной версии на сервере'); }); }
  });
})();
