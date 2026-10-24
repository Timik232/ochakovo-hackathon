// ================= DATA =================
const HH = q => 'https://hh.ru/search/vacancy?employer_id=871&text=' + encodeURIComponent(q);
const LEVELS = [
  { id: 'sklad', clock: '08:00', place: 'Складской комплекс', prof: 'Оператор склада и кладовщик', make: () => new StackScene(),
    real: 'Оператор склада работает с программой, документами и товарно-транспортными накладными. Кладовщик ведёт накладные и руководит комплектовщиками.',
    you: 'Собери паллет из 12 упаковок кваса. Тап опускает упаковку. Всё, что свисает, отваливается.',
    pay: 'Практика: оператор — от 60 000 ₽, кладовщик — от 56 000 ₽ до вычета налога, с ночными сменами больше.',
    mikh: 'Склад — это где всё начинается и всё заканчивается. Особенно терпение.',
    fact: 'Напитки «Очаково» уезжают в 60 регионов России и больше чем в 30 стран, включая США, Китай, Германию и Испанию.' },
  { id: 'rozliv', clock: '10:00', place: 'Цех розлива', prof: 'Оператор линии розлива', make: () => new BottlingScene(),
    real: 'Работа на линии розлива и на машинах: этикетировщик, упаковка, выдувная машина, паллетайзер; замена комплектующих.',
    you: 'Тапай по браку на конвейере: без крышки, недолив, кривая этикетка, мятая банка. И по всему, что вообще не должно там ехать.',
    pay: 'Практика: от 70 000 ₽ до вычета налога, смены 8:00–20:00 или 20:00–8:00.',
    mikh: 'Тут всё быстро. Моргнул — и бутылка уже в Тюмени.',
    fact: 'В 1994 году «Очаково» первым в России и в мире начало разливать пиво в ПЭТ-бутылки, а в 1995-м выпустило первое российское пиво в алюминиевой банке.' },
  { id: 'lab', clock: '12:00', place: 'Лаборатория', prof: 'Лаборант / химик-лаборант', make: () => new LabScene(),
    real: 'Контроль качества: отбор проб, органолептические и физико-химические анализы, проверка продукции на соответствие нормам.',
    you: '10 проб. Сравни с эталоном и нормой и вынеси вердикт: годен или брак. На каждую пробу — 8 секунд.',
    pay: 'Практика: от 60 000 ₽ до вычета налога, 2/2 дневные смены или с ночными.',
    mikh: 'Лаборант — последний рубеж. Если он пропустит, пропустят все.',
    fact: 'Над напитками «Очаково» работают технологи высшей квалификации, а у компании есть собственные солодовенное и сельскохозяйственные предприятия.' },
  { id: 'mash', clock: '14:00', place: 'Пульт управления', prof: 'Машинист оборудования', make: () => new GaugeScene(),
    real: 'Следит за работой оборудования, контролирует и управляет процессами с пульта, проверяет узлы в цеху.',
    you: 'Держи четыре стрелки в зелёной зоне: «−» сбрасывает, «+» поддаёт. Долго в красной — авария.',
    pay: 'Смотри открытые вакансии машинистов, наладчиков и операторов котельной на hh.ru.',
    mikh: 'Машинист смотрит на приборы так, как ты смотришь в телефон. Только внимательнее.',
    fact: 'Комбинат начал работу в 1978 году, в преддверии Олимпиады-80: ему поручили утолять жажду гостей Игр.' },
  { id: 'vkus', clock: '16:00', place: 'Отдел новых вкусов', prof: 'Технолог', make: () => new FlavorScene(),
    real: 'Разрабатывает рецептуры, варит пилотные партии, доводит новый вкус от идеи до полки вместе с лабораторией и дегустационной комиссией.',
    you: 'Выбери три ингредиента и отдай рецепт комиссии. Подсказка: квасу нужна зерновая основа.',
    pay: 'Смотри вакансии технологов и мастеров-технологов на hh.ru.',
    mikh: 'Самый вкусный отдел. Но носок я туда не клал, если что.',
    fact: 'С 1998 года выпускается самый известный бренд компании — квас «Очаковский». «Очаково» — лидер рынка натурального кваса.' },
  { id: 'varka', clock: '18:00', place: 'Технологический цех', prof: 'Оператор технологического цеха', make: () => new ClimbScene(),
    real: 'Работа в цехе варки и с сырьём: сахар, сироп и всё, из чего делают напитки.',
    you: 'Доберись до люка варочного котла с помощью мешалки. Тяни пальцем в любом месте экрана — мешалка повторит движение и зацепится за мешки, трубы и перила. Да, как в Getting Over It.',
    pay: 'Практика: от 70 000 ₽ до вычета налога, график 2/2 (день — ночь — отсыпной — выходной).',
    mikh: 'В технологическом цехе главное — рецептура. И не падать в котёл.',
    fact: 'В 1996 году «Очаково» впервые в промышленных масштабах воспроизвело технологию двойного брожения кваса: молочнокислого и дрожжевого.' }
];
const JOBS = {
  sklad: { t: 'Оператор склада / кладовщик', what: LEVELS[0].real, pay: 'от 56 000–60 000 ₽ на практике', q: 'склад' },
  rozliv: { t: 'Оператор линии розлива / наладчик', what: LEVELS[1].real, pay: 'от 70 000 ₽ на практике', q: 'розлива' },
  lab: { t: 'Лаборант / химик-лаборант', what: LEVELS[2].real, pay: 'от 60 000 ₽ на практике', q: 'химик' },
  mash: { t: 'Машинист оборудования / оператор котельной', what: LEVELS[3].real, pay: 'зарплата — в вакансии', q: 'оператор котельной' },
  vkus: { t: 'Технолог', what: LEVELS[4].real, pay: 'зарплата — в вакансии', q: 'технолог' },
  varka: { t: 'Оператор технологического цеха', what: LEVELS[5].real, pay: 'от 70 000 ₽ на практике', q: 'оператор' }
};
const QUIZ = [
  { q: 'В каком году начал работу комбинат «Очаково»?', a: ['1978, к Олимпиаде-80', '1961, к полёту Гагарина', '1991, к распаду СССР', '2003, к юбилею Михалыча'], r: 0, f: 'Комбинат построили в преддверии Олимпиады-80, чтобы утолять жажду её гостей.' },
  { q: 'Что «Очаково» сделало первым в мире в 1994 году?', a: ['Квас в тюбиках для космонавтов', 'Разлив пива в ПЭТ-бутылки', 'Газировку со вкусом борща', 'Пропуск по отпечатку кепки'], r: 1, f: 'Первыми в России и в мире. Потом пример подхватили другие производители.' },
  { q: 'Какой квас выпускают с 1998 года?', a: ['«Михалычевский»', '«Очаковский»', '«Рябиновый, 44»', '«Пилотная партия»'], r: 1, f: 'Самый известный бренд компании. «Очаково» — лидер рынка натурального кваса.' },
  { q: 'Что получает студент вместо испытательного срока?', a: ['Испытательный срок в двойном размере', 'Производственную практику', 'Мешалку и напутствие', 'Ничего, сразу в бой'], r: 1, f: 'Испытательного срока для студентов нет: вместо него производственная практика с наставником.' },
  { q: 'Где у «Очаково» производственные площадки?', a: ['Москва, Краснодар, Пенза, Тюмень', 'Только Москва', 'Москва и Антарктида', 'В каждом ларьке с квасом'], r: 0, f: 'А ещё солодовня в Липецкой области и винзавод на Таманском полуострове.' }
];
const PERKS = ['Официальное трудоустройство по ТК РФ, потом можно перейти на постоянную работу', 'Спецодежда и медосмотр за счёт компании', 'Столовая по льготной цене', '50% оплаты общежития (ул. Рябиновая, 36)', 'Скидка на продукцию', 'Наставник из опытных сотрудников и Учебный центр', 'График 2/2, смены 8:00–20:00 и 20:00–8:00', 'Практика с марта–апреля до июля–августа'];

// ---------- форма: данные и оценка (вынесено в чистые функции для тестов) ----------
const UNIFORM_ITEMS = [
  ['cap', 'Кепка с логотипом', 'фирменная', true], ['vest', 'Жилет «Я делаю натуральные напитки»', 'спецодежда', true], ['boots', 'Спецобувь', 'носки ног целы', true], ['pass', 'Пропуск', 'без него не пустят', true],
  ['hawaii', 'Гавайская рубашка', 'ну пятница же', false], ['slippers', 'Шлёпки', 'удобно', false], ['headphones', 'Наушники с басами', 'чтобы не скучно', false], ['bowtie', 'Галстук-бабочка', 'для дегустации', false]
];
function uniformPenalty(sel){
  const wrong = UNIFORM_ITEMS.filter(i => !i[3] && sel.has(i[0])).map(i => i[1]), missing = UNIFORM_ITEMS.filter(i => i[3] && !sel.has(i[0])).map(i => i[1]);
  return { pen: (wrong.length + missing.length) * 5, wrong, missing };
}
function listRu(items){ return items.length <= 1 ? (items[0] || '') : items.slice(0, -1).join(', ') + ' и ' + items[items.length - 1]; }
function uniformMissingMsg(missing){ return missing.length ? `А ${listRu(missing)} где? Так на смену не пускают! ` : ''; }

// ================= UI HELPERS =================
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function panel(html){ ov.innerHTML = `<div class="card">${html}</div>`; ov.hidden = false; ov.scrollTop = 0; stageEl.classList.add('has-ov'); mainFor(ov.querySelector('.btns .btn[data-v]:not(.ghost)')); return ov.firstChild; }
function hidePanel(){ mainOff(); ov.hidden = true; ov.innerHTML = ''; stageEl.classList.remove('has-ov'); }
function waitBtn(root, sel = '[data-v]'){ return new Promise(r => root.querySelectorAll(sel).forEach(b => b.addEventListener('click', () => { audioInit(); SFX.click(); r(b.dataset.v); }, { once: true }))); }
const mikhLine = (text, mood) => `<div class="mikh">${MIKH_SVG(mood)}<div class="say">${esc(text)}</div></div>`;

// ================= SCREENS =================
async function titleScreen(){
  setScene(new IdleScene('ok'));
  const el = panel(`
    <div class="eyebrow">Смена 2/2 · день · Москва, ул. Рябиновая, 44</div>
    <h1>Симулятор заводчанина</h1>
    <p class="hand">Ты — новенький на заводе «Очаково». Квас, пиво, напитки. Двенадцать часов, шесть профессий и один наставник. Задача простая: не уволься.</p>
    ${mikhLine('Держи вводную, стажёр. Вечером — аттестация: спрошу всё, что по смене увидишь и услышишь, факты запоминай! А если на задании совсем застрянешь — зови меня: на самой упорной работе, варке, есть кнопка «Позвать Михалыча». Смену зачту, но премию за подмогу заберу.')}
    <label for="nm" class="small">Как записать тебя в табель?</label>
    <input id="nm" type="text" maxlength="24" placeholder="Например, Стажёр Петя" autocomplete="nickname" value="${esc(tgUserName())}">
    <div class="btns"><button class="btn" data-v="go" type="button">Заступить на смену</button></div>
    <p class="small">Игра шуточная, а профессии, зарплаты на практике и факты о компании — настоящие. Играть лучше со звуком.</p>`);
  const nm = el.querySelector('#nm'); nm.addEventListener('keydown', e => { if (e.key === 'Enter') el.querySelector('[data-v]').click(); });
  await waitBtn(el);
  G.name = (nm.value.trim() || 'Стажёр без имени').slice(0, 24);
}
async function uniformScreen(){
  const el = panel(`
    <div class="eyebrow">07:55 · Раздевалка</div>
    <h2>Надень форму</h2>
    ${mikhLine('Спецодежду выдаём бесплатно. Выбирай, что надеть на смену, и не позорь меня.')}
    <div class="tiles">${UNIFORM_ITEMS.map(([k, n, s]) => `<button class="tile" type="button" aria-pressed="false" data-k="${k}">${esc(n)}<small>${esc(s)}</small></button>`).join('')}</div>
    <div class="btns"><button class="btn" data-v="go" type="button">Я готов</button></div>`);
  const sel = new Set();
  el.querySelectorAll('.tile').forEach(b => b.addEventListener('click', () => { const k = b.dataset.k; if (sel.has(k)) sel.delete(k); else sel.add(k); b.setAttribute('aria-pressed', sel.has(k)); SFX.pop(); }));
  await waitBtn(el);
  G.outfit = {}; for (const [k] of UNIFORM_ITEMS) G.outfit[k] = sel.has(k);
  const { pen, wrong, missing } = uniformPenalty(sel);
  G.patience -= pen; hud();
  setScene(new IdleScene(pen ? 'sad' : 'ok'));
  let msg = pen ? '' : 'Отлично, по форме! Сразу видно — наш человек.';
  if (wrong.length) msg += `${wrong.join(', ')}? Серьёзно? Это завод, а не пляж. `;
  if (missing.length) msg += uniformMissingMsg(missing);
  if (missing.includes('Пропуск')) msg += 'Кстати, потерянный пропуск — штраф 500 ₽, это по-настоящему. ';
  const el2 = panel(`<div class="eyebrow">Проходная</div><h2>${pen ? 'Ну такое' : 'К смене допущен'}</h2>${mikhLine(msg.trim(), pen ? 'angry' : 'ok')}
    ${pen ? `<p class="stamp">−${pen} терпения</p>` : ''}<div class="btns"><button class="btn" data-v="go" type="button">На склад</button></div>`);
  await waitBtn(el2);
}
async function briefing(L, i){
  setClock(L.clock); setScene(new IdleScene('ok'));
  const el = panel(`
    <div class="eyebrow">${L.clock} · ${esc(L.place)} · профессия ${i + 1} из ${LEVELS.length}</div>
    <h2>${esc(L.prof)}</h2>
    <dl class="facts"><dt>В жизни</dt><dd>${esc(L.real)}</dd><dt>В игре</dt><dd>${esc(L.you)}</dd><dt>Деньги</dt><dd>${esc(L.pay)}</dd></dl>
    ${mikhLine(L.mikh)}
    <div class="btns"><button class="btn" data-v="go" type="button">Погнали</button></div>`);
  await waitBtn(el); hidePanel();
}
function gradeWord(g){ return g >= .85 ? ['Огонь', 'Михалыч прослезился. Говорит, такого с восьмидесятого не видел.'] : g >= .6 ? ['Нормально', 'Работать можно. Ещё пару смен — и будешь учить новеньких.'] : g >= .35 ? ['Ну такое', 'Михалыч молча пьёт свой чай. Это плохой знак.'] : ['Позорище', 'Мастер уже ищет бланк. Но пока не нашёл.']; }
async function resultScreen(L, r){
  const g = clamp(r.grade || 0, 0, 1); G.res[L.id] = g;
  const dp = Math.round((g - .5) * 30); const prize = Math.round(g * 50) * 100;
  G.patience = clamp(G.patience + dp, 0, 100); G.bonus += prize; hud();
  const [w, m] = gradeWord(g);
  setScene(new IdleScene(g >= .5 ? 'ok' : 'sad'));
  const el = panel(`
    <div class="eyebrow">${esc(L.prof)} · итог</div>
    <h2>${w}</h2>
    <p>${esc(r.line || '')}</p>
    ${mikhLine(m, g < .35 ? 'angry' : 'ok')}
    <dl class="facts"><dt>Премия</dt><dd>+${prize.toLocaleString('ru-RU')} ₽</dd><dt>Терпение</dt><dd>${dp >= 0 ? '+' : ''}${dp}</dd><dt>А ты знал?</dt><dd>${esc(L.fact)}</dd></dl>
    <div class="btns"><button class="btn" data-v="go" type="button">Дальше по смене</button></div>`);
  await waitBtn(el);
}
async function firedScreen(L){
  setScene(new IdleScene('sad'));
  const el = panel(`
    <div class="eyebrow">Отдел кадров · ${esc(L.place)}</div>
    <h1>Вы уволены</h1>
    <p class="stamp">приказ №0 от сегодня</p>
    ${mikhLine('…Да шучу я. У студентов в «Очаково» нет испытательного срока, есть практика и наставник. Выдохни, попей кваску и давай заново.')}
    <div class="btns"><button class="btn" data-v="go" type="button">Попробовать ещё раз</button></div>`);
  await waitBtn(el); G.patience = 45; hud(); hidePanel();
}
async function quizScreen(){
  setClock('19:30');
  let score = 0;
  for (let i = 0; i < QUIZ.length; i++){
    const Q = QUIZ[i]; setScene(new IdleScene('ok'));
    const el = panel(`<div class="eyebrow">19:30 · Аттестация у наставника · вопрос ${i + 1} из ${QUIZ.length}</div><h2>${esc(Q.q)}</h2>
      <div class="opts">${Q.a.map((a, j) => `<button class="opt" type="button" data-v="${j}">${esc(a)}</button>`).join('')}</div><div id="qf"></div>`);
    const v = +(await waitBtn(el, '.opt'));
    el.querySelectorAll('.opt').forEach((b, j) => { b.disabled = true; if (j === Q.r) b.classList.add('right'); else if (j === v) b.classList.add('wrong'); });
    const ok = v === Q.r; if (ok){ score++; G.bonus += 300; SFX.ok(); } else { G.patience = clamp(G.patience - 5, 0, 100); SFX.bad(); } hud();
    el.querySelector('#qf').innerHTML = `${mikhLine((ok ? 'Верно! ' : 'Мимо. ') + Q.f, ok ? 'ok' : 'angry')}<div class="btns" style="margin-top:12px"><button class="btn" data-v="n" type="button">${i < QUIZ.length - 1 ? 'Следующий вопрос' : 'Закрыть смену'}</button></div>`;
    mainFor(el.querySelector('#qf .btn')); el.querySelector('#qf').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    await waitBtn(el.querySelector('#qf'));
  }
  G.quiz = score;
}

// ================= FINALE =================
function rankTitle(){ const avg = Object.values(G.res).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(G.res).length); return avg >= .8 ? 'Заводчанин года' : avg >= .6 ? 'Крепкий профессионал' : avg >= .4 ? 'Держится на мешалке' : 'Любимчик Михалыча (из жалости)'; }
const money = n => Number(n || 0).toLocaleString('ru-RU') + ' ₽';

async function finale(){
  setClock('20:00'); hidePanel(); closingGuard(false);
  document.body.classList.add('finale'); stageEl.hidden = true;
  const fin = document.getElementById('final'); fin.hidden = false;
  const order = LEVELS.map(L => L.id).sort((a, b) => (G.res[b] || 0) - (G.res[a] || 0));
  const title = rankTitle();
  const canContact = tgv('6.9');
  fin.innerHTML = `
    <section class="sheet hero-final">
      <div class="eyebrow">20:00 · Смена закрыта · ${esc(G.name)}</div>
      <h2>${esc(title)}</h2>
      <div class="stats">
        <div><b>${money(G.bonus)}</b><span>премия</span></div>
        <div><b>${Math.max(0, Math.round(G.patience))}%</b><span>терпение</span></div>
        <div><b>${G.quiz}/${QUIZ.length}</b><span>аттестация</span></div>
      </div>
      <p class="hand">Тебя не уволили. Михалыч говорит, что ты бы и по-настоящему справился. Вот что он советует.</p>
      <div class="btns"><button class="btn light" type="button" id="share">Позвать друга на смену</button></div>
    </section>
    <section class="sheet">
      <div class="eyebrow">Тебе подходит</div>
      <h2>Профессии по итогам смены</h2>
      <div class="jobs">${order.map((id, k) => { const J = JOBS[id]; const g = G.res[id] || 0; return `<article class="job ${k < 2 ? 'top' : ''}"><span class="match">${k === 0 ? 'Лучшее совпадение' : k === 1 ? 'Тоже твоё' : 'Совпадение'} · ${Math.round(g * 100)}%</span><h3>${esc(J.t)}</h3><p class="small">${esc(J.what)}</p><p class="pay">${esc(J.pay)}</p><a href="${HH(J.q)}" target="_blank" rel="noopener">Вакансии на hh.ru →</a></article>`; }).join('')}</div>
      <div class="btns"><a class="btn" href="https://hh.ru/employer/871" target="_blank" rel="noopener">Все вакансии на hh.ru</a><a class="btn ghost" href="https://ochakovo.ru/rabota/" target="_blank" rel="noopener">Карьера на ochakovo.ru</a></div>
    </section>
    <section class="sheet">
      <div class="eyebrow">Оплачиваемая практика для студентов</div>
      <h2>Что дают по-настоящему</h2>
      <p>Четыре подразделения: лаборатория, цех розлива, технологический цех и складской комплекс. С марта–апреля до июля–августа. С 18 лет, приоритет — 4-й курс и выпускники.</p>
      <ul class="perks">${PERKS.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      <h3>Отдел подбора</h3>
      <div class="contacts">
        <span class="copy"><span>rabota@ochakovo.ru</span><button type="button" data-copy="rabota@ochakovo.ru">Копировать</button></span>
        <span class="copy"><span>8 800 100-77-77, доб. 1155</span><button type="button" data-copy="88001007777">Копировать</button></span>
      </div>
      <p class="small">Офис: Москва, ул. Рябиновая, 44. Автобусы 275 и 610 от м. Кунцевская, от м. Озёрная — корпоративный автобус.</p>
    </section>
    <section class="sheet" id="applySheet">
      <div class="eyebrow">Анкета в отдел кадров</div>
      <h2>Хочу на практику</h2>
      <form id="apply" novalidate>
        <label for="fFio">ФИО<input id="fFio" type="text" required autocomplete="name" value="${esc(tgUserName())}"></label>
        <label for="fBirth">Дата рождения<input id="fBirth" type="date" required></label>
        <label for="fPhone">Телефон<span class="row"><input id="fPhone" type="tel" required autocomplete="tel" inputmode="tel" placeholder="+7">${canContact ? '<button type="button" class="mini" id="fPhoneTg">Из Telegram</button>' : ''}</span></label>
        <label for="fMail">E-mail<input id="fMail" type="email" autocomplete="email" inputmode="email"></label>
        <label for="fUni">Вуз или колледж, курс<input id="fUni" type="text" required placeholder="МГУПП, 4 курс"></label>
        <label for="fJob">Интересует<select id="fJob">${order.map(id => `<option value="${esc(JOBS[id].t)}">${esc(JOBS[id].t)}</option>`).join('')}</select></label>
        <label for="fWhen">Готов выйти<select id="fWhen"><option>На практику этой весной–летом</option><option>Прямо сейчас</option><option>После выпуска</option><option>Пока присматриваюсь</option></select></label>
        <label class="chk" for="fOk"><input id="fOk" type="checkbox" required> <span>Согласен на обработку персональных данных для связи по вакансиям «Очаково»</span></label>
        <div class="btns"><button class="btn" type="submit" id="applyBtn">Отправить анкету</button></div>
        <div id="applyMsg" role="status"></div>
      </form>
    </section>
    <section class="sheet">
      <div class="eyebrow">Доска почёта</div>
      <h2>Лучшие смены</h2>
      <ol class="board" id="board"><li><span>Загружаем доску…</span><span></span></li></ol>
      <div class="btns"><button class="btn ghost" type="button" id="again">Сыграть ещё раз</button></div>
    </section>`;
  fin.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => { hap('select'); try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Скопировано'; } catch (e) { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Выделено'; } }));
  fin.querySelector('#again').addEventListener('click', () => { location.reload(); });
  fin.querySelector('#share').addEventListener('click', () => { hap('light'); shareResult(`Отработал смену на заводе «Очаково»: «${title}», премия ${money(G.bonus)}. Спорим, ты не залезешь в варочный котёл быстрее?`); });
  const pt = fin.querySelector('#fPhoneTg'); if (pt) pt.addEventListener('click', async () => { const ph = await askPhone(); if (ph){ document.getElementById('fPhone').value = ph; hap('success'); } });
  fin.querySelector('#apply').addEventListener('submit', submitApply);
  // Native bottom button: first scrolls to the form, then submits it.
  const sheet = document.getElementById('applySheet');
  if (mainAction('Хочу на практику', () => sheet.scrollIntoView({ behavior: 'smooth', block: 'start' }))){
    fin.querySelector('#applyBtn').classList.add('tg-mirrored');
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !G.applied){ mainAction('Отправить анкету', () => fin.querySelector('#apply').requestSubmit()); io.disconnect(); } }, { threshold: .25 });
    io.observe(sheet);
  }
  window.scrollTo({ top: 0 });
  SFX.fanfare();
  saveScore().then(loadBoard);
}

async function saveScore(){
  if (!inTG) return;
  try { await api('/api/score', { name: G.name, score: G.bonus, title: rankTitle() }); } catch (e) { /* board stays read-only */ }
}
async function loadBoard(){
  const ol = document.getElementById('board'); if (!ol) return;
  try {
    const j = await api('/api/top');
    if (!j.top || !j.top.length){ ol.innerHTML = `<li><span>Пока пусто. Стань первым!</span><span></span></li>`; return; }
    ol.innerHTML = j.top.map(v => `<li class="${v.me ? 'me' : ''}"><span>${esc(v.name || 'Аноним')} <span class="small">· ${esc(v.title || '')}</span></span><span>${money(v.score)}</span></li>`).join('');
  } catch (e) { ol.innerHTML = `<li><span>${inTG ? 'Доску сейчас не загрузить.' : 'Доска почёта работает внутри Telegram.'} Твой результат: ${money(G.bonus)}.</span><span></span></li>`; }
}
function age(d){ const b = new Date(d); if (isNaN(b)) return -1; const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; }
async function submitApply(e){
  e.preventDefault();
  const f = id => document.getElementById(id); const msg = f('applyMsg');
  const data = { fio: f('fFio').value.trim(), birth: f('fBirth').value, phone: f('fPhone').value.trim(), email: f('fMail').value.trim(), study: f('fUni').value.trim(), job: f('fJob').value, when: f('fWhen').value };
  const err = t => { msg.innerHTML = `<div class="msg err">${t}</div>`; hap('error'); msg.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  if (!data.fio || !data.birth || !data.phone || !data.study) return err('Заполни ФИО, дату рождения, телефон и место учёбы.');
  if (!f('fOk').checked) return err('Отметь согласие на обработку данных, без него анкету не передать.');
  const a = age(data.birth); if (a >= 0 && a < 18) return err('«Очаково» берёт на работу и практику с 18 лет. Возвращайся, когда исполнится!');
  const letter = `Анкета из «Симулятора заводчанина»\nФИО: ${data.fio}\nДата рождения: ${data.birth}\nТелефон: ${data.phone}\nE-mail: ${data.email || '—'}\nУчёба: ${data.study}\nИнтересует: ${data.job}\nГотов выйти: ${data.when}\nРезультат в игре: ${rankTitle()}, ${G.bonus} ₽`;
  const fallback = reason => { msg.innerHTML = `<div class="msg err">${reason} Отправь этот текст на ${CONFIG.hrEmail} — в отделе подбора разберутся.</div><pre class="mail">${esc(letter)}</pre><div class="btns" style="margin-top:8px"><button class="btn ghost" type="button" id="cpL">Скопировать текст</button></div>`;
    document.getElementById('cpL').addEventListener('click', async ev => { try { await navigator.clipboard.writeText(letter); ev.target.textContent = 'Скопировано'; } catch (_) { const r = document.createRange(); r.selectNodeContents(msg.querySelector('pre')); getSelection().removeAllRanges(); getSelection().addRange(r); } }); };
  if (!inTG) return fallback('Анкета отправляется напрямую, только когда игра открыта в Telegram.');
  const btn = f('applyBtn'); btn.disabled = true; try { TG.MainButton.showProgress(); } catch (_) {}
  try {
    await api('/api/apply', { form: data, result: { title: rankTitle(), bonus: G.bonus, scores: G.res, quiz: G.quiz } });
    G.applied = true; mainOff(); btn.classList.remove('tg-mirrored'); btn.textContent = 'Отправить ещё раз'; hap('success');
    msg.innerHTML = '<div class="msg ok">Анкета у отдела подбора. С тобой свяжутся в Telegram или по телефону. Если нужно что-то поправить, отправь анкету ещё раз.</div>';
  } catch (er) { fallback(er.status === 422 ? (er.body.error || 'Проверь поля анкеты.') : 'Не получилось отправить анкету.'); }
  finally { btn.disabled = false; try { TG.MainButton.hideProgress(); } catch (_) {} }
}

// ================= MAIN =================
async function main(){
  hud();
  await titleScreen();
  closingGuard(true);
  await uniformScreen();
  for (let i = 0; i < LEVELS.length; i++){
    const L = LEVELS[i];
    await briefing(L, i);
    let r;
    for (;;){ r = await play(L.make()); speech = null; if (r && r.fired){ await firedScreen(L); continue; } break; }
    await resultScreen(L, r);
  }
  await quizScreen();
  await finale();
}
requestAnimationFrame(t => { last = t; frame(t); });
main();
