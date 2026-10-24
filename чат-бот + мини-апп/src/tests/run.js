// Тесты «Симулятора заводчанина» — без зависимостей: node tests/run.js
// Часть 1: реальный бандл public/index.html исполняется в VM с DOM-заглушками;
//          проверяются данные (LEVELS/JOBS/QUIZ), оценка формы и логика всех сцен.
// Часть 2: живой server.js на ephemeral-порте: API, подпись initData, лимитеры.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const http = require('http');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
const failures = [];
const pending = [];
let chain = Promise.resolve();
function t(name, fn){
  const p = chain.then(async () => { try { await fn(); passed++; } catch (e){ failed++; failures.push({ name, e }); console.error('FAIL', name, '-', e.message); } });
  chain = p;
  pending.push(p);
}
function eq(a, b, msg){ if (a !== b) throw new Error(`${msg || 'eq'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
function ok(v, msg){ if (!v) throw new Error(msg || 'expected truthy'); }
function close(a, b, eps = 1e-9, msg){ if (Math.abs(a - b) > eps) throw new Error(`${msg || 'close'}: ${a} !== ${b}`); }

// ---------- DOM/canvas заглушки ----------
const noop = () => {};
const ctxStub = new Proxy({ canvas: null }, {
  get(target, p){ if (p in target) return target[p]; if (p === 'measureText') return () => ({ width: 10 }); return noop; },
  set(target, p, v){ target[p] = v; return true; }
});
function makeEl(id){
  const el = {
    id, style: {}, dataset: {}, hidden: false, disabled: false,
    innerHTML: '', textContent: '', value: '', src: '', width: 0, height: 0, scrollTop: 0,
    classList: { add: noop, remove: noop, toggle: noop },
    addEventListener: noop, removeEventListener: noop, setAttribute: noop, getAttribute: () => null,
    appendChild: noop, scrollIntoView: noop, click: noop, focus: noop,
    querySelector: () => makeEl('q'), querySelectorAll: () => [],
    getContext: () => ctxStub, getBoundingClientRect: () => ({ width: 540, height: 960, left: 0, top: 0 })
  };
  Object.defineProperty(el, 'firstChild', { get: () => makeEl(id + '-child') });
  return el;
}
const els = {};
const documentStub = {
  documentElement: makeEl('html'),
  body: makeEl('body'),
  getElementById: id => (els[id] || (els[id] = makeEl(id))),
  createElement: tag => makeEl(tag),
  addEventListener: noop
};
const sandbox = {
  console, Math, Date, Promise, URLSearchParams,
  setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0; }, clearTimeout: noop, setInterval: () => 0,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  fetch: async () => { throw new Error('no fetch in tests'); },
  navigator: { clipboard: { writeText: async () => {} } },
  window: { addEventListener: noop },
  document: documentStub,
  Image: class { constructor(){ this.src = ''; this.complete = true; this.naturalWidth = 64; this.naturalHeight = 64; } },
  getSelection: () => ({ removeAllRanges: noop, addRange: noop })
};
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

// ---------- загрузка реального бандла ----------
const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
const m = html.match(/<script>\n([\s\S]*)\n<\/script>/);
ok(m, 'в бандле есть <script>');
vm.runInContext(m[1], ctx, { filename: 'bundle.js' });
const T = expr => vm.runInContext(expr, ctx);

// ================= ЧАСТЬ 1: ИГРОВАЯ ЛОГИКА =================

// ---------- регрессии прошлых правок ----------
t('БАНДЛ: порядок игр — варка (молот) последняя', () => {
  eq(T('LEVELS.map(l => l.id).join(",")'), 'sklad,rozliv,lab,mash,vkus,varka');
});
t('БАНДЛ: часы смены идут по возрастанию без дыр', () => {
  const clocks = T('LEVELS.map(l => +l.clock.slice(0,2))');
  eq(clocks.length, 6);
  for (let i = 1; i < clocks.length; i++) ok(clocks[i] > clocks[i - 1], `часы не по возрастанию: ${clocks}`);
});
t('БАНДЛ: реплика Михалыча про аттестацию на титульном экране', () => {
  ok(html.includes('Вечером — аттестация'), 'нет фразы про аттестацию');
  ok(html.includes('Позвать Михалыча'), 'нет упоминания кнопки помощи');
});
t('БАНДЛ: shareUrl ведёт на нашего бота', () => {
  ok(html.includes('https://t.me/Ochakovo_hackathon_bot/play'), 'shareUrl не зашит');
});
t('БАНДЛ: favicon подключён', () => {
  ok(/<link rel="icon"[^>]*href="\/favicon\.ico"/.test(html), 'нет <link rel=icon>');
});

// ---------- данные ----------
t('LEVELS: у каждой профессии заполнены место/профессия/факты', () => {
  const places = T('LEVELS.map(l => l.place)');
  eq(new Set(places).size, 6, 'места дублируются');
  ok(T('LEVELS.every(l => l.id && l.place && l.prof && l.real && l.you && l.pay && l.mikh && l.fact)'), 'есть пустые поля');
});
t('JOBS: описания соответствуют своим LEVELS (регрессия переноса варки в конец)', () => {
  for (const id of T('LEVELS.map(l => l.id)')) eq(T(`JOBS[${JSON.stringify(id)}].what`), T(`LEVELS.find(l => l.id === ${JSON.stringify(id)}).real`), id);
  ok(T('Object.values(JOBS).every(j => j.q && j.t && j.pay)'), 'в JOBS есть пустые поля');
});
t('JOBS: набор ключей совпадает с LEVELS', () => {
  eq(T('Object.keys(JOBS).sort().join(",")'), T('LEVELS.map(l => l.id).sort().join(",")'));
});
t('QUIZ: 5 вопросов, верный ответ в пределах вариантов', () => {
  eq(T('QUIZ.length'), 5);
  ok(T('QUIZ.every(q => q.q && q.a.length >= 2 && q.r >= 0 && q.r < q.a.length && q.f)'), 'кривой вопрос в QUIZ');
});
t('QUIZ: ответы честно покрыты фактами из игры (вне самого QUIZ)', () => {
  // корпус = бандл без массива QUIZ: если ответ не встречается в игре — вопрос нечестный
  const corpus = html.replace(/const QUIZ = \[[\s\S]*?\];/, '');
  const facts = ['1978', 'ПЭТ', 'Очаковский', 'испытательного срока', 'Краснодар'];
  for (const f of facts) ok(corpus.includes(f), `факт «${f}» не встречается в игре вне квиза — вопрос нечестный`);
});

// ---------- форма (раздевалка): репорт «сказали всё правильно, а получили 0/10» ----------
t('ФОРМА: выбрал всё правильно → штраф 0, замечаний нет', () => {
  const r = T('uniformPenalty(new Set(["cap","vest","boots","pass"]))');
  eq(r.pen, 0, 'штраф');
  eq(r.wrong.length, 0, 'лишние вещи');
  eq(r.missing.length, 0, 'недостающие вещи');
});
t('ФОРМА: ничего не выбрал → штраф 20, все 4 обязательных в замечании', () => {
  const r = T('uniformPenalty(new Set())');
  eq(r.pen, 20, 'штраф');           // 4 обязательных × 5
  eq(r.missing.length, 4);
  eq(r.wrong.length, 0);
});
t('ФОРМА: только гавайка и шлёпки сверху формы → штраф 10, ровно они в замечании', () => {
  const r = T('uniformPenalty(new Set(["cap","vest","boots","pass","hawaii","slippers"]))');
  eq(r.pen, 10);
  eq(r.wrong.length, 2);
  ok(r.wrong.some(w => w.includes('Гавайская')) && r.wrong.some(w => w.includes('Шлёпки')), 'замечание: ' + r.wrong.join('; '));
});
t('ФОРМА: обязательных 4, всего 8, пустой выбор не падает', () => {
  eq(T('UNIFORM_ITEMS.filter(i => i[3]).length'), 4);
  eq(T('UNIFORM_ITEMS.length'), 8);
  eq(T('uniformPenalty(new Set()).pen'), 20);
});
t('ФОРМА: идеальный выбор не трогает терпение (pen=0 → ветка похвалы)', () => {
  T('G.patience = 100');
  eq(T('uniformPenalty(new Set(["cap","vest","boots","pass"])).pen'), 0);
  eq(T('G.patience'), 100, 'терпение изменилось');
});
t('ФОРМА: похвала начинается с «Отлично, по форме!» (без «О,»)', () => {
  ok(T('uniformMissingMsg([])') === '', 'пустой missing даёт пустую фразу');
  // ветка похвалы — константа в коде; проверяем прямо в бандле
  ok(html.includes('Отлично, по форме!'), 'нет фразы «Отлично, по форме!»');
  ok(!html.includes('О, по форме!'), 'старая фраза «О, по форме!» осталась');
});
t('ФОРМА: перечисление отсутствующих в именительном падеже, через «и», без склейки «кто надевать будет»', () => {
  eq(T('listRu(["Кепка с логотипом"])'), 'Кепка с логотипом');
  eq(T('listRu(["Кепка с логотипом", "Пропуск"])'), 'Кепка с логотипом и Пропуск');
  const three = T('listRu(["Кепка с логотипом", "Спецобувь", "Пропуск"])');
  eq(three, 'Кепка с логотипом, Спецобувь и Пропуск');
  const msg = T('uniformMissingMsg(["Кепка с логотипом", "Спецобувь"])');
  eq(msg, 'А Кепка с логотипом и Спецобувь где? Так на смену не пускают! ');
  ok(!html.includes('кто надевать будет'), 'старая падежная склейка осталась в бандле');
});

// ---------- оценки ----------
t('gradeWord: пороги 0.85/0.6/0.35', () => {
  eq(T('gradeWord(1)[0]'), 'Огонь');
  eq(T('gradeWord(.85)[0]'), 'Огонь');
  eq(T('gradeWord(.84)[0]'), 'Нормально');
  eq(T('gradeWord(.6)[0]'), 'Нормально');
  eq(T('gradeWord(.59)[0]'), 'Ну такое');
  eq(T('gradeWord(.35)[0]'), 'Ну такое');
  eq(T('gradeWord(.34)[0]'), 'Позорище');
  eq(T('gradeWord(0)[0]'), 'Позорище');
});
t('rankTitle: пороги среднего балла, пустой результат без NaN', () => {
  T('G.res = { a: 1, b: 1 }'); eq(T('rankTitle()'), 'Заводчанин года');
  T('G.res = { a: .7, b: .5 }'); eq(T('rankTitle()'), 'Крепкий профессионал');
  T('G.res = { a: .5, b: .3 }'); eq(T('rankTitle()'), 'Держится на мешалке');
  T('G.res = { a: .1, b: .2 }'); eq(T('rankTitle()'), 'Любимчик Михалыча (из жалости)');
  T('G.res = {}');
  ok(!T('rankTitle()').includes('NaN'), 'rankTitle даёт NaN на пустых результатах');
});

// ---------- ЛАБОРАТОРИЯ: источник «N из 10» ----------
t('ЛАБА: 10 верных приговоров → grade 1 и строка «10 из 10»', () => {
  const r = T(`(() => {
    const s = new LabScene(); s.init();
    s.samples = s.samples.map((x, i) => ({ ...x, bad: i % 2 === 0, why: x.why || 'не по регламенту' }));
    let res = null; s.resolve = x => { res = x; };
    for (let i = 0; i < 10; i++){ s.i = i; s.tLeft = 8; s.answer(s.samples[i].bad); s.fbT = 0.001; s.update(0.01); }
    return res;
  })()`);
  ok(r, 'сцена не завершилась');
  eq(r.grade, 1, 'grade');
  ok(r.line.includes('10 из 10'), 'строка: ' + r.line);
});
t('ЛАБА: все приговоры мимо → grade 0 и строка «0 из 10» (репорт-кейс)', () => {
  T('G.patience = 100');
  const r = T(`(() => {
    const s = new LabScene(); s.init();
    s.samples = s.samples.map((x, i) => ({ ...x, bad: i % 2 === 0, why: x.why || 'не по регламенту' }));
    let res = null; s.resolve = x => { res = x; };
    for (let i = 0; i < 10; i++){ s.i = i; s.tLeft = 8; s.answer(!s.samples[i].bad); s.fbT = 0.001; s.update(0.01); }
    return res;
  })()`);
  ok(r, 'сцена не завершилась');
  eq(r.grade, 0, 'grade');
  ok(r.line.includes('0 из 10'), 'строка: ' + r.line);
});
t('ЛАБА: чай Михалыча (проба №7) — всегда брак', () => {
  const s = T(`(() => { const s = new LabScene(); s.init(); return s.samples[6]; })()`);
  eq(s.tea, true); eq(s.bad, true);
});
t('ЛАБА: таймаут пробы = ошибка, терпение −5', () => {
  T('G.patience = 100');
  const r = T(`(() => {
    const s = new LabScene(); s.init();
    s.samples = [{ color:'x', foam:2, gas:true, smell:'хлебный', bad:false }];
    s.n = 1; s.i = 0; s.tLeft = 0.01;
    let res = null; s.resolve = x => { res = x; };
    s.update(0.05); s.fbT = 0.001; s.update(0.01);
    return { res, pat: G.patience };
  })()`);
  eq(r.res.grade, 0);
  ok(r.res.line.includes('0 из 1'), 'строка: ' + r.res.line);
  eq(r.pat, 95, 'терпение после таймаута');
});

// ---------- ВКУС (дегустация): второй источник «из 10» ----------
t('ВКУС: солод+яблоко → 8.1, тип «Квас»', () => {
  const r = T(`(() => { const s = new FlavorScene(); s.init(); s.sel = [0, 3]; s.compute(); return { sc: s.score, name: s.name }; })()`);
  close(r.sc, 8.1, 1e-9, 'score');
  ok(r.name.startsWith('Квас'), 'тип: ' + r.name);
});
t('ВКУС: носок Михалыча → 2 балла, лимитка', () => {
  const r = T(`(() => { const s = new FlavorScene(); s.init(); s.sel = [8, 0, 3]; s.compute(); return { sc: s.score, name: s.name, c: s.comment }; })()`);
  eq(r.sc, 2);
  ok(r.name.includes('Носок'), 'имя: ' + r.name);
  ok(r.c.includes('второй носок'), 'комментарий: ' + r.c);
});
t('ВКУС: без зерна → «компот», балл < 7', () => {
  const r = T(`(() => { const s = new FlavorScene(); s.init(); s.sel = [3, 4, 6]; s.compute(); return { sc: s.score, c: s.comment }; })()`);
  ok(r.sc < 7, 'балл без зерна слишком высок: ' + r.sc);
  ok(r.c.includes('компот'), 'комментарий: ' + r.c);
});
t('ВКУС: три зерна → штраф за перебор, ровно 5.0', () => {
  const r = T(`(() => { const s = new FlavorScene(); s.init(); s.sel = [0, 1, 2]; s.compute(); return s.score; })()`);
  close(r, 5.0, 1e-9, 'score');
});
t('ВКУС: солод+рожь+хмель → 8.5, тип «Пиво»', () => {
  const r = T(`(() => { const s = new FlavorScene(); s.init(); s.sel = [0, 1, 7]; s.compute(); return { sc: s.score, name: s.name }; })()`);
  close(r.sc, 8.5, 1e-9, 'score');
  ok(r.name.startsWith('Пиво'), 'тип: ' + r.name);
});

// ---------- СКЛАД ----------
t('СКЛАД: точное попадание = «Идеально», +100 ₽, терпение цело', () => {
  T('G.patience = 100; G.bonus = 0');
  const r = T(`(() => {
    const s = new StackScene(); s.init();
    s.cur = { x: 160, w: 220, y: s.topY() - 41, vy: 0, dir: 1, falling: true, c: 1 };
    let n = 0; while (!s.perfects && n++ < 200) s.update(0.05);
    return { perfects: s.perfects, bonus: G.bonus, pat: G.patience };
  })()`);
  eq(r.perfects, 1, 'perfects');
  eq(r.bonus, 100, 'бонус');
  eq(r.pat, 100, 'терпение');
});
t('СКЛАД: три промаха — конец смены с grade 0', () => {
  T('G.patience = 100');
  const r = T(`(() => {
    const s = new StackScene(); s.init();
    let res = null; s.resolve = x => { res = x; };
    for (let k = 0; k < 3; k++){ s.cur = { x: -220, w: 220, y: s.topY() - 41, vy: 0, dir: -1, falling: true, c: 1 }; s.land(); }
    s.update(3);
    return { res, misses: s.misses };
  })()`);
  eq(r.misses, 3, 'промахи');
  ok(r.res, 'сцена не завершилась');
  eq(r.res.grade, 0, 'grade');
  ok(r.res.line.includes('0 из 12'), 'строка: ' + r.res.line);
});

// ---------- РОЗЛИВ ----------
t('РОЗЛИВ: grade = поймал/(поймал+пустил) − 0.06×зря выброшенные', () => {
  const r = T(`(() => {
    const s = new BottlingScene(); s.init();
    s.t = 100; s.items = []; s.caught = 8; s.missed = 2; s.wrong = 1;
    let res = null; s.resolve = x => { res = x; };
    s.update(0.01);
    return res;
  })()`);
  close(r.grade, 8 / 10 - 0.06, 1e-9, 'grade');
  ok(r.line.includes('8') && r.line.includes('2') && r.line.includes('1'), 'строка: ' + r.line);
});
t('РОЗЛИВ: всё пустил, ничего не поймал → grade 0', () => {
  const r = T(`(() => {
    const s = new BottlingScene(); s.init();
    s.t = 100; s.items = []; s.caught = 0; s.missed = 5; s.wrong = 0;
    let res = null; s.resolve = x => { res = x; };
    s.update(0.01);
    return res;
  })()`);
  eq(r.grade, 0);
});

// ---------- ПУЛЬТ ----------
t('ПУЛЬТ: grade = (доля зелёного − 0.25)/0.6', () => {
  const r = T(`(() => {
    const s = new GaugeScene(); s.init();
    s.t = 100; s.green = 100; s.booms = 0;
    let res = null; s.resolve = x => { res = x; };
    s.update(0.01);
    return res;
  })()`);
  close(r.grade, (100 / 144 - .25) / .6, 1e-9, 'grade');
});
t('ПУЛЬТ: ноль зелёного → grade 0, не отрицательный', () => {
  const r = T(`(() => {
    const s = new GaugeScene(); s.init();
    s.t = 100; s.green = 0;
    let res = null; s.resolve = x => { res = x; };
    s.update(0.01);
    return res;
  })()`);
  eq(r.grade, 0);
});

// ---------- ВАРКА (молот) ----------
t('ВАРКА: «Позвать Михалыча» = −10 терпения, победа с помощью = grade 0.3', () => {
  T('G.patience = 100');
  const r = T(`(() => {
    const s = new ClimbScene(); s.init();
    s.helpBtn = { x: 290, y: 18, w: 236, h: 50 };
    s.down(400, 40);
    const patAfterHelp = G.patience;
    s.B = { x: 375, y: 420 }; s.V = { x: 0, y: 0 }; s.anchor = null;
    s.update(0.05);
    s.t = s.wonAt + 3; s.update(0.01);
    return { helped: s.helped, patAfterHelp, res: s.result };
  })()`);
  eq(r.helped, true);
  eq(r.patAfterHelp, 90, 'терпение после помощи');
  eq(r.res.grade, .3, 'grade с помощью');
  ok(r.res.line.includes('помощью наставника'), 'строка: ' + r.res.line);
});
t('ВАРКА: сам залез быстро → grade 1', () => {
  T('G.patience = 100');
  const r = T(`(() => {
    const s = new ClimbScene(); s.init();
    s.t = 30; s.B = { x: 375, y: 420 }; s.V = { x: 0, y: 0 }; s.anchor = null;
    s.update(0.05);
    s.t = s.wonAt + 3; s.update(0.01);
    return s.result;
  })()`);
  eq(r.grade, 1);
  ok(r.line.includes('Залез за'), 'строка: ' + r.line);
});

// ================= ЧАСТЬ 2: СЕРВЕР =================
const TEST_TOKEN = '111:test-token';
const PORT = 18390;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ochakovo-test-'));
process.env.BOT_TOKEN = TEST_TOKEN;
process.env.WEBAPP_URL = '';
process.env.BOT_POLLING = '0';
process.env.PORT = String(PORT);
process.env.DATA_DIR = DATA_DIR;
const { checkInitData } = require(path.join(ROOT, 'server.js'));
const base = `http://127.0.0.1:${PORT}`;

function signInitData(user, authDate){
  const p = new URLSearchParams({ user: JSON.stringify(user), auth_date: String(authDate) });
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TEST_TOKEN).digest();
  p.set('hash', crypto.createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}
const USER = { id: 424242, first_name: 'Тест', username: 'tester' };
const initData = signInitData(USER, Math.floor(Date.now() / 1000));

async function j(pathname, opt = {}){
  const r = await fetch(base + pathname, opt);
  const b = await r.json().catch(() => ({}));
  return { status: r.status, b };
}

t('SRV: /health отвечает ok', async () => {
  const r = await j('/health');
  eq(r.status, 200); eq(r.b.ok, true);
});
t('SRV: GET /api/top без подписи доступен и пуст', async () => {
  const r = await j('/api/top');
  eq(r.status, 200); eq(r.b.top.length, 0);
});
t('SRV: POST /api/score без подписи → 401', async () => {
  const r = await j('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  eq(r.status, 401);
});
t('SRV: подписанный /api/score пишется, меньший не перетирает, больший обновляет', async () => {
  const h = { 'Content-Type': 'application/json', 'X-Init-Data': initData };
  let r = await j('/api/score', { method: 'POST', headers: h, body: JSON.stringify({ name: 'Тест', title: 'Крепкий профессионал', score: 5000 }) });
  eq(r.status, 200); eq(r.b.best, 5000);
  r = await j('/api/score', { method: 'POST', headers: h, body: JSON.stringify({ score: 100 }) });
  eq(r.b.best, 5000, 'лучший результат перезаписан меньшим');
  r = await j('/api/score', { method: 'POST', headers: h, body: JSON.stringify({ score: 9000 }) });
  eq(r.b.best, 9000);
  const top = await j('/api/top');
  eq(top.b.top[0].score, 9000);
  eq(!!top.b.top[0].me, false, 'me выставился без подписи');
  const topAuth = await j('/api/top', { headers: { 'X-Init-Data': initData } });
  eq(topAuth.b.top[0].me, true, 'me=true для своего рекорда');
});
t('SRV: score капится сверху 1e6 и мусор не портит рекорд', async () => {
  const h = { 'Content-Type': 'application/json', 'X-Init-Data': initData };
  const r = await j('/api/score', { method: 'POST', headers: h, body: JSON.stringify({ score: 1e9 }) });
  eq(r.b.best, 1e6);
  const r2 = await j('/api/score', { method: 'POST', headers: h, body: JSON.stringify({ score: 'abc' }) });
  eq(r2.b.best, 1e6, 'мусорный score испортил рекорд');
});
t('SRV: анкета с валидной подписью пишется в applications.jsonl', async () => {
  const form = { fio: 'Иванов Иван', birth: '2000-01-01', phone: '+79990001122', email: 'a@b.c', study: 'МГУПП, 4 курс', job: 'Лаборант', when: 'Прямо сейчас' };
  const r = await j('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData }, body: JSON.stringify({ form, result: { title: 'Крепкий профессионал', bonus: 3000, quiz: 4, scores: { lab: 1 } } }) });
  eq(r.status, 200); eq(r.b.ok, true);
  const lines = fs.readFileSync(path.join(DATA_DIR, 'applications.jsonl'), 'utf8').trim().split('\n');
  eq(lines.length, 1);
  const rec = JSON.parse(lines[0]);
  eq(rec.fio, 'Иванов Иван');
  eq(rec.tg.id, USER.id);
  eq(rec.result.quiz, 4);
});
t('SRV: несовершеннолетнему — 422', async () => {
  const form = { fio: 'Молодой', birth: String(new Date().getFullYear() - 16) + '-01-01', phone: '+7', study: 'школа' };
  const r = await j('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData }, body: JSON.stringify({ form }) });
  eq(r.status, 422);
});
t('SRV: анкета без обязательных полей — 422', async () => {
  const r = await j('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Init-Data': initData }, body: JSON.stringify({ form: { fio: 'Только имя' } }) });
  eq(r.status, 422);
});
t('SRV: подделка подписи не проходит', async () => {
  const bad = signInitData({ id: 1, first_name: 'hacker' }, Math.floor(Date.now() / 1000)).replace(/hash=.{8}/, 'hash=00000000');
  const r = await j('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Init-Data': bad }, body: '{}' });
  eq(r.status, 401);
});
t('SRV: path traversal /../server.js не отдаёт исходники', async () => {
  const code = await new Promise(res => {
    const rq = http.request({ host: '127.0.0.1', port: PORT, path: '/../server.js' }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => res({ s: r.statusCode, d })); });
    rq.end();
  });
  ok(code.s === 404 || code.s === 403, 'код: ' + code.s);
  ok(!code.d.includes('BOT_TOKEN'), 'утечка исходника сервера');
});
t('SRV: checkInitData — валидная подпись читает пользователя', () => {
  const u = checkInitData(initData);
  ok(u && u.id === USER.id, 'user не распознан');
});
t('SRV: checkInitData — просроченная (25ч) initData отклоняется', () => {
  const old = signInitData(USER, Math.floor(Date.now() / 1000) - 25 * 3600);
  eq(checkInitData(old), null);
});
t('SRV: checkInitData — подпись под чужим токеном не подходит', () => {
  const p = new URLSearchParams(initData);
  const dcs = [...p.entries()].filter(([k]) => k !== 'hash' && k !== 'signature').sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
  const otherSecret = crypto.createHmac('sha256', 'WebAppData').update('999:other').digest();
  p.set('hash', crypto.createHmac('sha256', otherSecret).update(dcs).digest('hex'));
  eq(checkInitData(p.toString()), null);
});
t('SRV: рейт-лимит — 11-й POST в минуту получает 429', async () => {
  const fresh = signInitData({ id: 777, first_name: 'Flood' }, Math.floor(Date.now() / 1000));
  const h = { 'Content-Type': 'application/json', 'X-Init-Data': fresh };
  let last = 0;
  for (let i = 0; i < 11; i++) last = (await j('/api/score', { method: 'POST', headers: h, body: JSON.stringify({ score: i }) })).status;
  eq(last, 429, '11-й запрос не зарейтлимитился');
});

// ---------- запуск ----------
(async () => {
  await Promise.all(pending);
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed){ console.error(failures.map(f => `  ✗ ${f.name}`).join('\n')); process.exit(1); }
  process.exit(0); // server.js держит event loop — выходим явно
})().catch(e => { console.error(e); process.exit(1); });
