// Общие помощники для всех страниц: запросы к API, поля анкеты, тосты, очередь анкет без сети.
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } }
};

class ApiError extends Error { constructor(status, data) { super(data?.error || 'Ошибка ' + status); this.status = status; this.fields = data?.fields || {}; } }

async function api(method, path, body) {
  if (window.DEMO_API) return window.DEMO_API(method, path, body);
  let res;
  try {
    res = await fetch(path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new ApiError(0, { error: 'Нет связи с сервером' }); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

// Ссылки между страницами: на сервере — красивые адреса, в демо-версии — файлы.
const LINK = window.DEMO_API ? { staff: 'staff.html', candidates: 'candidates.html', form: 'anketa.html', home: 'index.html' } : { staff: 'staff', candidates: 'candidates', form: 'anketa', home: './' };

// Подтверждение внутри страницы (системный confirm() блокируется во встроенных окнах и выглядит чужеродно).
function askConfirm(text, okLabel = 'Удалить') {
  return new Promise(resolve => {
    const m = document.createElement('div'); m.className = 'ask';
    m.innerHTML = `<div class="card" role="alertdialog" aria-modal="true"><p></p><div class="ask-row"><button class="btn" data-ok></button><button class="btn white" data-no>Отмена</button></div></div>`;
    $('p', m).textContent = text; $('[data-ok]', m).textContent = okLabel;
    const done = v => { m.remove(); document.removeEventListener('keydown', key); resolve(v); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-no]')) done(false); else if (e.target.closest('[data-ok]')) done(true); });
    document.addEventListener('keydown', key, true);
    document.body.append(m); $('[data-no]', m).focus();
  });
}

function toast(text, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text;
  document.body.append(t); setTimeout(() => t.remove(), ms);
}

const STAGES = [
  ['new', 'Новый'], ['review', 'Рассматриваем'], ['interview', 'Собеседование'], ['offer', 'Оффер'], ['hired', 'Принят'], ['reject', 'Отказ']
];
const STAGE_RU = Object.fromEntries(STAGES);
const WHO = ['Студент колледжа', 'Студент вуза', 'Выпускник', 'Специалист с опытом', 'Ищу новую профессию'];
const STUDENTS = ['Студент колледжа', 'Студент вуза'];
const EDU_LEVELS = ['Среднее общее (11 классов)', 'Среднее профессиональное (колледж, техникум)', 'Неоконченное высшее', 'Высшее — бакалавриат', 'Высшее — специалитет', 'Высшее — магистратура', 'Два высших / учёная степень'];
const EMPLOYMENT = ['Оплачиваемая практика', 'Учебная практика', 'Стажировка', 'Постоянная работа'];
const SHIFTS = ['Только дневные', 'Можно с ночными', 'Без разницы'];
const GRAD_YEARS = (() => { const y = new Date().getFullYear(); return Array.from({ length: 8 }, (_, i) => String(y + i)); })();

const chips = (name, list, type = 'radio') => `<div class="chips" role="group">${list.map(v =>
  `<label class="chip"><input type="${type}" name="${name}" value="${esc(v)}"><span>${esc(v)}</span></label>`).join('')}</div>`;
const options = (list, empty) => `<option value="">${empty}</option>` + list.map(v => `<option>${esc(v)}</option>`).join('');

// Поля, общие для анкеты кандидата и анкеты от сотрудника.
function personFields({ staff = false } = {}) {
  const req = staff ? '' : ' <i>*</i>';
  return `
  <label class="field"><span>Фамилия <i>*</i></span><input name="last_name" autocomplete="family-name" required maxlength="60" placeholder="Смирнова"><em class="err"></em></label>
  <label class="field"><span>Имя <i>*</i></span><input name="first_name" autocomplete="given-name" required maxlength="60" placeholder="Анна"><em class="err"></em></label>
  <label class="field"><span>Отчество</span><input name="middle_name" autocomplete="additional-name" maxlength="60" placeholder="Сергеевна"><em class="err"></em></label>
  <label class="field"><span>Возраст${req}</span><input name="age" type="number" inputmode="numeric" min="14" max="80" placeholder="19"><em class="err"></em></label>
  <div class="note-u18 wide" hidden role="alert"><b>На стажировку и работу мы берём с 18 лет.</b> Но приходи на экскурсию в музей «Очаково» — расскажем, как варят квас, и покажем завод. Спроси про запись у нас на стенде.</div>
  <label class="field"><span>Телефон <i>*</i></span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="32" placeholder="+7 900 000-00-00"><em class="err"></em></label>
  <label class="field"><span>Telegram</span><input name="telegram" autocomplete="off" maxlength="64" placeholder="@nickname"><em class="err"></em></label>
  <label class="field wide"><span>E-mail</span><input name="email" type="email" inputmode="email" autocomplete="email" maxlength="120" placeholder="anna@mail.ru"><em class="err"></em></label>
  <div class="field wide"><span>Кто ты сейчас${req}</span>${chips('who', WHO)}<em class="err"></em></div>
  <label class="field" data-show="edu"><span>Уровень образования</span><select name="edu_level">${options(EDU_LEVELS, '— выбери —')}</select><em class="err"></em></label>
  <div class="field studying"><span>&nbsp;</span><label class="check"><input type="checkbox" name="still_studying"><span>Ещё учусь</span></label></div>
  <label class="field" data-show="grad"><span>Год выпуска</span><select name="grad_year">${options(GRAD_YEARS, '— год —')}</select><em class="err"></em></label>
  <label class="field wide"><span>Вуз или колледж</span><input name="school" maxlength="160" placeholder="МГУПП, РХТУ им. Менделеева, колледж…"><em class="err"></em></label>
  <label class="field wide"><span>Направление / специальность</span><input name="specialty" maxlength="160" placeholder="Биотехнология, пищевые производства…"><em class="err"></em></label>`;
}
function wishFields() {
  const today = new Date().toISOString().slice(0, 10);
  return `
  <div class="field wide"><span>Что интересно</span>${chips('employment', EMPLOYMENT)}</div>
  <label class="field"><span>Когда готов начать</span><input name="start_date" type="date" min="${today}"><em class="err"></em></label>
  <div class="field"><span>Смены</span>${chips('shifts', SHIFTS)}</div>
  <label class="field wide"><span>Ссылка на резюме</span><input name="resume_url" type="url" inputmode="url" maxlength="500" placeholder="https://hh.ru/resume/… или ссылка на Яндекс Диск, Google Drive"><em class="err"></em></label>
  <label class="field wide"><span>Опыт работы</span><textarea name="experience" maxlength="2000" placeholder="Где работал, практика, подработки. Если опыта нет — так и напиши, это нормально"></textarea></label>
  <label class="field wide"><span>Пара слов о себе</span><textarea name="about" maxlength="2000" placeholder="Чем увлекаешься, что хочешь попробовать на заводе"></textarea></label>`;
}

// Поведение анкеты: студентам — год выпуска, остальным — уровень образования; младше 18 — подсказка про экскурсию.
function wireForm(form) {
  const sync = () => {
    const who = form.querySelector('input[name="who"]:checked')?.value || '';
    const student = STUDENTS.includes(who);
    const still = form.elements.still_studying;
    if (student) still.checked = true;
    $('.studying', form).hidden = student; // студенту галочка не нужна — он и так учится
    $('[data-show="edu"]', form).hidden = !who || student;
    $('[data-show="grad"]', form).hidden = !still.checked;
    if (!still.checked) form.elements.grad_year.value = '';
    if (student) form.elements.edu_level.value = '';
    const age = form.elements.age.value;
    $('.note-u18', form).hidden = !(age !== '' && +age < 18);
  };
  form.addEventListener('change', sync); form.addEventListener('input', e => { if (e.target.name === 'age') sync(); });
  form.addEventListener('reset', () => setTimeout(sync));
  sync();
  return sync;
}
const fullName = d => [d.last_name, d.first_name, d.middle_name].map(x => String(x || '').trim()).filter(Boolean).join(' ');

function vacancyCards(vacs, name = 'vacancy_id') {
  return `<div class="vacs">${vacs.map(v => `<label class="vac"><input type="radio" name="${name}" value="${esc(v.id)}"><span>
    <i class="ico"><img src="img/${esc(v.icon)}.png" alt=""></i><b>${esc(v.title)}</b>
    <small>${esc([v.dept, v.pay].filter(Boolean).join(' · '))}</small></span></label>`).join('')}</div>`;
}

function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; else if (!(el.name in o)) o[el.name] = ''; }
    else if (el.type === 'checkbox') o[el.name] = el.checked;
    else o[el.name] = el.value;
  }
  return o;
}
function showErrors(form, fields) {
  $$('.field', form).forEach(f => { f.classList.remove('bad'); const e = $('.err', f); if (e) e.textContent = ''; });
  let first = null;
  for (const [name, msg] of Object.entries(fields || {})) {
    const el = form.elements[name]; const node = el?.length && !el.tagName ? el[0] : el;
    const f = node?.closest('.field') || node?.closest('.check')?.parentElement;
    if (!f) continue;
    f.classList.add('bad'); const e = $('.err', f); if (e) e.textContent = msg;
    first ??= f;
  }
  first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
// Проверка в браузере совпадает с серверной, чтобы ошибки были видны сразу.
function validate(d, { staff }) {
  const e = {};
  if (!String(d.last_name).trim()) e.last_name = 'Напиши фамилию';
  if (!String(d.first_name).trim()) e.first_name = 'Напиши имя';
  const ph = String(d.phone).replace(/\D/g, '');
  if (ph.length < 10 || ph.length > 15) e.phone = 'Проверь номер телефона';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) e.email = 'Проверь e-mail';
  if (d.resume_url && !/^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(d.resume_url)) e.resume_url = 'Нужна ссылка, начинающаяся с https://';
  if (d.age && (+d.age < 14 || +d.age > 80)) e.age = 'Возраст от 14 до 80';
  if (!staff) {
    if (!d.age) e.age = 'Укажи возраст';
    else if (+d.age < 18) e.age = 'На стажировку и работу берём с 18 лет';
    if (!d.who) e.who = 'Выбери, кто ты сейчас';
    if (!d.vacancy_id) e.vacancy_id = 'Выбери вакансию';
    if (!d.consent) e.consent = 'Без согласия мы не сможем сохранить анкету';
  }
  return e;
}

// Очередь анкет: на выставке Wi-Fi часто пропадает — анкета не теряется, а уходит, когда связь вернётся.
const QUEUE_KEY = 'ochakovo.queue';
async function flushQueue() {
  const q = store.get(QUEUE_KEY, []); if (!q.length) return 0;
  const left = []; let sent = 0;
  for (const item of q) {
    try { await api('POST', item.path, item.body); sent++; }
    catch (e) { if (e.status === 0 || e.status >= 500 || e.status === 429) left.push(item); }
  }
  store.set(QUEUE_KEY, left);
  document.dispatchEvent(new CustomEvent('queue', { detail: left.length }));
  return sent;
}
function enqueue(path, body) { const q = store.get(QUEUE_KEY, []); q.push({ path, body, at: Date.now() }); store.set(QUEUE_KEY, q); document.dispatchEvent(new CustomEvent('queue', { detail: q.length })); }
window.addEventListener('online', flushQueue);
setInterval(flushQueue, 20000);

function fmtDate(iso, withTime = true) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) + (withTime ? ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '');
}
