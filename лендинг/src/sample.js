// Примерные кандидаты для показа. Общий код для seed.js (сервер) и demo.js (демо в браузере).
'use strict';
(function (root) {
  function makeSample(count = 36) {
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647; const pick = a => a[Math.floor(rnd() * a.length)];
    const F = [['Анна', 'Сергеевна'], ['Мария', 'Андреевна'], ['Алина', 'Олеговна'], ['Софья', 'Дмитриевна'], ['Полина', 'Игоревна'], ['Дарья', 'Павловна'], ['Ксения', 'Александровна'], ['Виктория', 'Романовна']];
    const M = [['Иван', 'Сергеевич'], ['Дмитрий', 'Андреевич'], ['Кирилл', 'Олегович'], ['Артём', 'Викторович'], ['Никита', 'Игоревич'], ['Егор', 'Павлович'], ['Максим', 'Александрович'], ['Тимур', 'Ринатович']];
    const L = ['Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Петров', 'Соколов', 'Михайлов', 'Новиков', 'Морозов', 'Волков', 'Лебедев', 'Семёнов'];
    const SCH = [['МГУПП', 'Биотехнология'], ['РХТУ им. Менделеева', 'Химическая технология'], ['МГТУ им. Баумана', 'Машиностроение'], ['Колледж «Царицыно»', 'Технология продукции общепита'],
      ['РЭУ им. Плеханова', 'Логистика'], ['МИСИС', 'Автоматизация'], ['Пищевой колледж № 33', 'Технология хлеба и напитков']];
    const EV = ['Ярмарка вакансий МГУПП', 'Фестиваль карьеры РХТУ', 'Moscow Career Fest', 'День открытых дверей «Очаково»'];
    const VAC = ['lab', 'rozliv', 'tech', 'sklad', 'kladov', 'mash', 'technolog', 'free', 'open'];
    const ST = ['new', 'new', 'new', 'review', 'review', 'interview', 'offer', 'hired', 'reject'];
    const WHO = ['Студент вуза', 'Студент вуза', 'Студент колледжа', 'Выпускник', 'Специалист с опытом', 'Ищу новую профессию'];
    const EDU = ['Среднее профессиональное (колледж, техникум)', 'Высшее — бакалавриат', 'Высшее — специалитет', 'Высшее — магистратура'];
    const CM = ['Очень заинтересована в лаборатории, спрашивала про ночные смены', 'Есть опыт на складе, готов выйти с марта', 'Хочет совмещать с учёбой, нужен график 2/2',
      'Пришёл с другом, оба на розлив', 'Сильный кандидат, пригласить на экскурсию по заводу'];
    const year = new Date().getFullYear(); const out = [];
    for (let i = 1; i <= count; i++) {
      const fem = rnd() < .5; const [first_name, middle_name] = fem ? pick(F) : pick(M); const last_name = pick(L) + (fem ? 'а' : '');
      const [school, specialty] = pick(SCH); const staff = rnd() < .35; const stage = pick(ST); const who = pick(WHO);
      const student = who.startsWith('Студент'); const still = student || rnd() < .15;
      const t = new Date(Date.now() - (i < 4 ? rnd() * 5 * 36e5 : rnd() * 18 * 864e5)).toISOString();
      const start = new Date(Date.now() + (10 + rnd() * 150) * 864e5).toISOString().slice(0, 10);
      out.push({ created_at: t, updated_at: t, source: staff ? 'staff' : 'self', event: pick(EV), vacancy_id: pick(VAC),
        last_name, first_name, middle_name: rnd() < .85 ? middle_name : '', full_name: '', age: 18 + Math.floor(rnd() * 8),
        phone: `+7 9${10 + i} ${String(200 + i * 37 % 800)}-${String(10 + i * 13 % 90)}-${String(10 + i * 29 % 90)}`,
        email: rnd() < .6 ? `student${100 + i}@mail.ru` : '', telegram: rnd() < .7 ? `@student_${100 + i}` : '',
        who, edu_level: student ? '' : pick(EDU), still_studying: still ? 1 : 0, grad_year: still ? String(year + 1 + Math.floor(rnd() * 3)) : '',
        school, specialty, employment: pick(['Оплачиваемая практика', 'Стажировка', 'Постоянная работа', 'Учебная практика']), start_date: rnd() < .7 ? start : '',
        shifts: pick(['Только дневные', 'Можно с ночными', 'Без разницы']), resume_url: rnd() < .35 ? `https://hh.ru/resume/${(1e9 + i * 7919).toString(16)}` : '',
        experience: rnd() < .4 ? 'Подработка курьером, практика в лаборатории вуза' : '', about: '', consent_at: t, stage,
        rating: staff ? 1 + Math.floor(rnd() * 5) : 0, hot: staff && rnd() < .3 ? 1 : 0, comment: staff ? pick(CM) : '',
        next_step: stage === 'interview' ? 'Собеседование в четверг 11:00' : '', staff_name: staff ? pick(['Ольга, HR', 'Сергей, HR', 'Наталья']) : '',
        archived: rnd() < .1 ? 1 : 0, archived_at: null });
      const c = out[out.length - 1]; c.full_name = [c.last_name, c.first_name, c.middle_name].filter(Boolean).join(' ');
    }
    return out;
  }
  if (typeof module === 'object' && module.exports) module.exports = makeSample; else root.OCHAKOVO_SAMPLE = makeSample;
})(typeof self !== 'undefined' ? self : this);
