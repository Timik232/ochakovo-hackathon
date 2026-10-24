// ================= LEVEL: РОЗЛИВ =================
class BottlingScene extends Scene {
  init(){
    this.items = []; this.spawnT = .6; this.dur = 42; this.caught = 0; this.missed = 0; this.wrong = 0; this.good = 0; this.belt = 0;
    this.jam = null; this.jamDone = false;
    say('Линия розлива — сердце завода. Брак — в сторону, нормальные — в упаковку. Не тормози, она не ждёт.', 4);
  }
  speed(){ return 150 + Math.min(this.t, this.dur) * 4.2; }
  // Path: top belt x 80→470 at y 470, elevator down at x 490 to y 740, bottom belt x 470→100 at y 740.
  pos(sd){ if (sd < 390) return { x: 80 + sd, y: 470 }; if (sd < 660) return { x: 490, y: 470 + (sd - 390) }; return { x: 490 - (sd - 660), y: 740 }; }
  spawn(){
    const kind = Math.random() < .5 ? 'pet' : 'can'; const r = Math.random(); let def = null, odd = null;
    if (r < .38){ def = kind === 'pet' ? pick(['cap', 'low', 'label']) : pick(['dent', 'label']); }
    else if (r < .46){ def = 'odd'; odd = pick(['sock', 'cucumber', 'thermos', 'cat']); }
    this.items.push({ sd: 0, x: 80, y: 470, kind, def, odd, st: 'line', vx: 0, vy: 0, rot: 0 });
  }
  down(x, y){
    if (this.jam){ if (hit(this.jamBtn, x, y)){ this.jam.n--; SFX.click(); shakeT = .1; if (this.jam.n <= 0){ this.jam = null; SFX.ok(); addFloat(270, 300, 'Линия пошла!', C.green); say('О, наладчик растёт! Запомни: сначала — стоп, потом — руками.', 2.8); } } return; }
    for (let i = this.items.length - 1; i >= 0; i--){
      const it = this.items[i]; if (it.st !== 'line') continue;
      if (x > it.x - 40 && x < it.x + 40 && y > it.y - 130 && y < it.y + 14){
        it.st = 'fly'; it.vx = rnd(-120, 120); it.vy = -520; SFX.pop();
        if (it.def){ this.caught++; G.bonus += 50; hud(); addFloat(it.x, it.y - 120, it.def === 'odd' ? 'Это что вообще?!' : 'Брак убран', C.green, 22); }
        else { this.wrong++; hurt(2, it.x, it.y - 120); if (Math.random() < .5) say('Это была нормальная бутылка! Её кто-то в магазине ждал.', 2.2, 'angry'); }
        return;
      }
    }
  }
  update(dt){
    if (this.t > 21 && !this.jamDone){ this.jamDone = true; this.jam = { n: 6 }; SFX.bad(); say('ЗАТОР! Этикетировщик зажевал этикетку. Жми «ПЕРЕЗАПУСК», быстро!', 3.5, 'angry'); }
    const sp = this.jam ? 0 : this.speed();
    this.belt += sp * dt;
    if (!this.jam && this.t < this.dur){ this.spawnT -= dt; if (this.spawnT <= 0){ this.spawn(); this.spawnT = Math.max(.42, 1.05 - this.t * .014) * rnd(.8, 1.25); } }
    for (const it of this.items){
      if (it.st === 'line'){ it.sd += sp * dt; const p = this.pos(it.sd); it.x = p.x; it.y = p.y; if (it.sd > 1030){ it.st = 'gone'; if (it.def){ this.missed++; hurt(4, 120, 640); SFX.bad(); if (it.def === 'odd') say(pick(['Ты что, носок в упаковку пропустил?! Покупатель будет в шоке.', 'Огурец ушёл в отгрузку. Теперь это лимитированная серия…', 'Кот уехал в Краснодар. Ну хоть посмотрит филиал.']), 3, 'angry'); } else this.good++; } }
      else if (it.st === 'fly'){ it.vy += 1400 * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += dt * 8; if (it.y > 1100) it.st = 'gone'; }
    }
    this.items = this.items.filter(i => i.st !== 'gone');
    if (this.t > this.dur + 2.2 && !this.items.some(i => i.st === 'line')){
      const tot = this.caught + this.missed; const g = clamp((tot ? this.caught / tot : 1) - this.wrong * .06, 0, 1);
      this.finish({ grade: g, line: `Брака поймано: ${this.caught}, пропущено: ${this.missed}, зря выкинуто нормальных: ${this.wrong}.` });
    }
  }
  drawItem(it){
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot); ctx.scale(1.2, 1.2);
    if (it.def === 'odd'){
      if (it.odd === 'sock'){ ctx.beginPath(); wpoly([[-10,-70],[10,-70],[10,-18],[26,-10],[26,0],[-10,0]]); paint('#fff', C.ink, 3); wline(-10,-60,10,-60,C.red,4); wline(-10,-52,10,-52,C.red,4); }
      if (it.odd === 'cucumber'){ ctx.beginPath(); ctx.ellipse(0, -40, 13, 40, .15, 0, 7); paint('#4E9A2A', C.ink, 3); for (let i = 0; i < 5; i++){ ctx.fillStyle = '#B7E07A'; ctx.fillRect(-4 + (i%2)*6, -66 + i*12, 3, 3); } }
      if (it.odd === 'thermos'){ wrect(-15, -86, 30, 86, '#3B6EA5', C.ink, 3); wrect(-17, -98, 34, 14, C.ink, C.ink, 2); txt('МИХ', 0, -44, { size: 11, weight: 900, color: '#fff' }); }
      if (it.odd === 'cat'){ wcirc(0, -26, 24, '#F4A259', C.ink, 3); wcirc(0, -60, 17, '#F4A259', C.ink, 3); ctx.beginPath(); wpoly([[-14,-70],[-10,-86],[-3,-74]]); paint('#F4A259', C.ink, 2.5); ctx.beginPath(); wpoly([[14,-70],[10,-86],[3,-74]]); paint('#F4A259', C.ink, 2.5); ctx.fillStyle = C.ink; ctx.fillRect(-7,-63,3,3); ctx.fillRect(4,-63,3,3); }
      ctx.restore(); return;
    }
    if (it.kind === 'pet'){
      ctx.beginPath(); wpoly([[-17,0],[17,0],[17,-58],[8,-74],[6,-88],[-6,-88],[-8,-74],[-17,-58]], 1.2); paint('rgba(255,255,255,.6)', C.ink, 3);
      const lvl = it.def === 'low' ? -36 : -70; ctx.save(); ctx.clip(); ctx.fillStyle = C.kvas; ctx.fillRect(-20, lvl, 40, 80); ctx.restore();
      ctx.save(); if (it.def === 'label') ctx.rotate(.45); wrect(-17, -50, 34, 22, C.red, C.ink, 2); txt('КВАС', 0, -38, { size: 10, weight: 900, color: '#fff' }); ctx.restore();
      if (it.def !== 'cap') wrect(-8, -97, 16, 10, C.red, C.ink, 2);
    } else {
      if (it.def === 'dent'){ ctx.beginPath(); wpoly([[-15,0],[15,0],[9,-22],[16,-40],[13,-62],[-15,-62],[-8,-40],[-16,-22]], 1.5); paint(C.red, C.ink, 3); }
      else { wrect(-15, -62, 30, 62, it.def === 'label' ? '#C9D0D3' : C.red, C.ink, 3); if (it.def !== 'label'){ wrect(-9, -42, 18, 18, '#fff', null); wrect(-5, -38, 10, 10, C.red, null); } }
      ctx.beginPath(); ctx.ellipse(0, -62, 15, 4, 0, 0, 7); paint('#E3E6E8', C.ink, 2);
    }
    ctx.restore();
  }
  draw(){
    drawWallBg('#F2F3F4');
    // windows/labels
    txt('ЦЕХ', 270, 210, { size: 70, weight: 900, color: '#E3E6E8' }); txt('РОЗЛИВА', 270, 280, { size: 70, weight: 900, color: '#E3E6E8' });
    const belt = (x, y, w, dir) => { wrect(x, y, w, 24, '#5E6468', C.ink, 3); ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, 24); ctx.clip(); ctx.strokeStyle = '#8B9296'; ctx.lineWidth = 3; const o = (this.belt % 40) * dir; for (let k = -40; k < w + 40; k += 40){ ctx.beginPath(); ctx.moveTo(x + k + o, y); ctx.lineTo(x + k + o - 10 * dir, y + 24); ctx.stroke(); } ctx.restore(); for (let k = x + 20; k < x + w; k += 70) wline(k, y + 24, k - 8, y + 70, C.steel, 5); };
    belt(60, 470, 450, 1);
    wrect(478, 470, 24, 294, '#5E6468', C.ink, 3); ctx.save(); ctx.beginPath(); ctx.rect(478, 470, 24, 294); ctx.clip(); ctx.strokeStyle = '#8B9296'; ctx.lineWidth = 3; for (let k = -40; k < 340; k += 40){ const yy = 470 + k + this.belt % 40; ctx.beginPath(); ctx.moveTo(478, yy); ctx.lineTo(502, yy + 8); ctx.stroke(); } ctx.restore();
    belt(70, 740, 440, -1);
    ctx.fillStyle = C.floor; ctx.fillRect(0, 830, W, 130); wline(0, 830, W, 830, C.ink, 3);
    for (const it of this.items) if (it.st === 'line') this.drawItem(it);
    // machines
    wrect(0, 300, 80, 194, '#D3D9DC', C.ink, 3); wrect(10, 314, 60, 50, '#9FD3E8', C.ink, 3); ctx.save(); ctx.translate(40, 430); ctx.rotate(-Math.PI/2); txt('РОЗЛИВ', 0, 0, { size: 17, weight: 900, color: C.red }); ctx.restore();
    wrect(0, 600, 96, 230, '#D3D9DC', C.ink, 3); drawIcon('crate', 48, 650, 64, C.red); txt('УПАКОВКА', 48, 700, { size: 11, weight: 900, color: C.red });
    txt(`${this.good}`, 48, 736, { size: 24, weight: 900 }); txt('в магазин', 48, 758, { size: 10, weight: 700, color: C.steel });
    for (const it of this.items) if (it.st === 'fly') this.drawItem(it);
    drawWorker(300, 945, .95, this.jam ? 'panic' : 'ok', { arm: -30 });
    // HUD
    const left = Math.max(0, Math.ceil(this.dur - this.t));
    wrect(14, 14, 512, 64, '#fff', C.ink, 3);
    txt('ДО КОНЦА', 30, 32, { size: 11, align: 'left', color: C.steel }); txt(left + ' с', 30, 57, { size: 24, weight: 900, align: 'left' });
    txt('ПОЙМАНО', 150, 32, { size: 11, align: 'left', color: C.steel }); txt(String(this.caught), 150, 57, { size: 24, weight: 900, align: 'left', color: C.green });
    txt('ПРОПУЩЕНО', 268, 32, { size: 11, align: 'left', color: C.steel }); txt(String(this.missed), 268, 57, { size: 24, weight: 900, align: 'left', color: C.red });
    txt('СКОРОСТЬ', 398, 32, { size: 11, align: 'left', color: C.steel }); txt((Math.round(this.speed() * 150 / 1000)) + ' тыс/ч', 398, 57, { size: 18, weight: 900, align: 'left' });
    if (this.t < 6){ txt('Тапай по браку: без крышки, недолив,', W/2, 116, { size: 23, kind: 'h', stroke: '#fff' }); txt('кривая этикетка, мятая банка…', W/2, 144, { size: 23, kind: 'h', stroke: '#fff' }); txt('и по всему странному', W/2, 172, { size: 23, kind: 'h', stroke: '#fff' }); }
    if (this.jam){ ctx.fillStyle = 'rgba(213,0,50,.15)'; ctx.fillRect(0, 0, W, H); txt('ЗАТОР!', 270, 250, { size: 64, weight: 900, color: C.red, stroke: '#fff', sw: 8 }); this.jamBtn = button(130, 300, 280, 84, `ПЕРЕЗАПУСК ×${this.jam.n}`, { size: 24 }); }
  }
}

// ================= LEVEL: ЛАБОРАТОРИЯ =================
class LabScene extends Scene {
  init(){
    this.n = 10; this.i = 0; this.right = 0; this.tLeft = 8; this.sipped = 0; this.feedback = null;
    this.samples = []; for (let k = 0; k < this.n; k++) this.samples.push(this.make(k === 6));
    say('Лаборатория. Сверяй пробу с эталоном: цвет, пена, газация, запах. Годен — в розлив, брак — назад технологам.', 4.5);
  }
  make(tea){
    if (tea) return { tea: true, color: 'hsl(35,80%,52%)', foam: 0, gas: false, smell: 'лимон и бергамот', bad: true, why: 'Это чай Михалыча, а не проба' };
    const s = { color: 'hsl(24,72%,27%)', foam: rnd(1.3, 2.7), gas: true, smell: pick(['хлебный', 'ржаной, хлебный', 'хлебный, с кислинкой']), bad: false };
    if (Math.random() < .55){
      const d = pick(['color', 'foam', 'gas', 'smell']); s.bad = true;
      if (d === 'color'){ const light = Math.random() < .5; s.color = light ? 'hsl(36,75%,52%)' : 'hsl(15,55%,11%)'; s.why = light ? 'Слишком светлый — не дотянули' : 'Слишком тёмный — перебор с колером'; }
      if (d === 'foam'){ s.foam = Math.random() < .5 ? 0 : rnd(4.5, 6); s.why = s.foam ? 'Пены как в стиральной машине' : 'Пены нет вообще'; }
      if (d === 'gas'){ s.gas = false; s.why = 'Выдохся: пузырьков нет'; }
      if (d === 'smell'){ s.smell = pick(['носками', 'бензином', 'духами «Шипр»', 'вчерашним борщом', 'мокрой собакой']); s.why = 'Запах явно не по рецептуре'; }
    }
    return s;
  }
  answer(isBad){
    const s = this.samples[this.i]; const ok = isBad === s.bad;
    if (ok){ this.right++; SFX.ok(); G.bonus += 60; hud(); this.feedback = { ok: true, text: s.bad ? 'Верно, брак: ' + s.why.toLowerCase() : 'Верно, годен к розливу' }; if (s.tea) say('Эй! Это мой чай! …Но вообще правильно, на линию его нельзя.', 3); }
    else { SFX.bad(); hurt(5, 270, 420); this.feedback = { ok: false, text: s.bad ? 'Пропустил брак: ' + s.why.toLowerCase() : 'Проба была нормальная!' }; }
    this.fbT = 1.2;
  }
  down(x, y){
    if (this.fbT > 0) return;
    if (hit(this.bGood, x, y)) return this.answer(false);
    if (hit(this.bBad, x, y)) return this.answer(true);
    if (x > 205 && x < 335 && y > 330 && y < 570){ this.sipped++; SFX.clink(); hurt(2, 270, 320); say(pick(['Это проба, а не обед! Сначала — по регламенту.', 'Не отпивай из колбы! У нас для дегустации своя комната.', 'Ещё раз отхлебнёшь — запишу в дегустационную комиссию. Без премии.']), 2.6, 'angry'); }
  }
  update(dt){
    if (this.fbT > 0){ this.fbT -= dt; if (this.fbT <= 0){ this.feedback = null; this.i++; this.tLeft = 8; if (this.i >= this.n) this.finish({ grade: this.right / this.n, line: `Верных заключений: ${this.right} из ${this.n}.` + (this.sipped ? ` Отхлебнул из пробы: ${this.sipped} раз(а).` : '') }); } return; }
    if (this.i >= this.n) return;
    this.tLeft -= dt; if (this.tLeft <= 0){ SFX.bad(); hurt(5, 270, 420); this.feedback = { ok: false, text: 'Время вышло, проба скисла' }; this.fbT = 1.2; }
  }
  glass(x, y, s, sc = 1){
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.beginPath(); wpoly([[-60, -230], [60, -230], [48, 0], [-48, 0]], 1); ctx.save(); ctx.clip();
    ctx.fillStyle = s.color; ctx.fillRect(-70, -180, 140, 190);
    const fh = s.foam * 14; ctx.fillStyle = '#F7EED9'; ctx.fillRect(-70, -180 - fh, 140, fh);
    if (s.gas){ ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 12; k++){ const bx = Math.sin(k * 77.3) * 36, by = -((now * 60 + k * 37) % 170); ctx.beginPath(); ctx.arc(bx, by, 2.5, 0, 7); ctx.fill(); } }
    if (s.tea){ ctx.fillStyle = '#F2E266'; ctx.beginPath(); ctx.arc(20, -175, 18, 0, Math.PI); ctx.fill(); }
    ctx.restore(); ctx.beginPath(); wpoly([[-60, -230], [60, -230], [48, 0], [-48, 0]], 1); paint(null, C.ink, 4);
    ctx.restore();
  }
  draw(){
    drawWallBg('#F6F7F8');
    ctx.fillStyle = '#E4E8EA'; ctx.fillRect(0, 780, W, 180); wline(0, 780, W, 780, C.ink, 3);
    drawPanel(14, 120, 160, 270, 'ЭТАЛОН');
    this.glass(94, 372, { color: 'hsl(24,72%,27%)', foam: 2, gas: true }, .6);
    drawPanel(366, 120, 160, 270, 'НОРМА');
    [['Цвет', 'как эталон'], ['Пена', '1–3 см'], ['Газация', 'пузырьки'], ['Запах', 'хлебный']].forEach(([k, v], j) => { txt(k.toUpperCase(), 380, 168 + j*52, { size: 11, align: 'left', color: C.steel }); txt(v, 380, 190 + j*52, { size: 19, kind: 'h', align: 'left' }); });
    txt('игровой регламент', 446, 376, { size: 10, weight: 600, color: C.steel });
    if (this.i < this.n){
      const s = this.samples[this.i];
      this.glass(270, 570, s, .95);
      for (let k = 0; k <= 6; k++){ const yy = 570 - 171 - k * 13.3; wline(330, yy, 340, yy, C.steel, 2); if (k % 2 === 0) txt(k + '', 352, yy, { size: 11, color: C.steel }); }
      txt('см', 352, 570 - 171 - 6*13.3 - 15, { size: 11, color: C.steel });
      txt(`ПРОБА №${this.i + 1} из ${this.n}`, 270, 30, { size: 18, weight: 900, color: C.red });
      wrect(120, 52, 300, 12, '#fff', C.ink, 2); ctx.fillStyle = this.tLeft < 3 ? C.red : C.green; ctx.fillRect(122, 54, 296 * clamp(this.tLeft / 8, 0, 1), 8);
      wrect(24, 596, 492, 54, '#fff', C.ink, 2.5); txt('Нюхаешь… пахнет: ' + s.smell, 270, 623, { size: 22, kind: 'h' });
      this.bGood = button(24, 672, 236, 86, 'ГОДЕН', { fill: C.green, color: C.ink, size: 30 });
      this.bBad = button(280, 672, 236, 86, 'БРАК', { size: 30 });
    }
    if (this.feedback){ const ls = wrapText(this.feedback.text, 440, 24); wrect(30, 410, 480, 36 + ls.length * 28, this.feedback.ok ? C.green : '#fff', C.ink, 4); ls.forEach((l, j) => txt(l, 270, 440 + j * 28, { size: 24, kind: 'h', color: this.feedback.ok ? C.ink : C.red })); }
    drawWorker(70, 930, .85, this.feedback && !this.feedback.ok ? 'sad' : 'ok');
    txt(`Верно: ${this.right}`, 470, 900, { size: 22, weight: 900 });
  }
}

// ================= LEVEL: МАШИНИСТ (gauges) =================
class GaugeScene extends Scene {
  init(){
    this.dur = 36; this.green = 0; this.booms = 0;
    this.g = [['ПАР', 'бар'], ['CO₂', 'бар'], ['ХОЛОД', 'аммиак'], ['ВОДА', '°C']].map(([n, u], i) => ({ n, u, v: .5, d: rnd(.02, .08), next: rnd(.5, 2), danger: 0, low: 0, x: i % 2 ? 400 : 140, y: i < 2 ? 290 : 610 }));
    say('Пульт машиниста. Стрелки — в зелёной зоне. В красной долго не держи, а то… ну, ты понял.', 4);
  }
  down(x, y){
    for (const g of this.g){
      if (hit(g.bm, x, y)){ g.v = clamp(g.v - .13, 0, 1.05); SFX.hiss(); burst(g.x - 50, g.y + 130, 6, ['#fff', '#DDE'], 120, -200, [6, 12]); }
      if (hit(g.bp, x, y)){ g.v = clamp(g.v + .13, 0, 1.05); SFX.click(); }
    }
  }
  update(dt){
    if (this.t > this.dur){ if (!this.done){ const frac = this.green / (4 * this.dur); this.finish({ grade: clamp((frac - .25) / .6, 0, 1), line: `Стрелки в зелёной зоне ${Math.round(frac * 100)}% времени. Аварий: ${this.booms}.` }); } return; }
    const k = 1 + this.t / 22;
    for (const g of this.g){
      g.next -= dt; if (g.next <= 0){ g.next = rnd(.7, 2); g.d = (Math.random() < .68 ? rnd(.03, .12) : -rnd(.03, .09)) * k; }
      g.v = clamp(g.v + g.d * dt + Math.sin(now * 9 + g.x) * .002, 0, 1.05);
      if (g.v > .35 && g.v < .68) this.green += dt;
      if (g.v > .86){ g.danger += dt; if (g.danger > 1.3){ this.booms++; g.danger = 0; g.v = .5; shakeT = .5; SFX.boom(); burst(g.x, g.y, 50, ['#555', '#888', C.red, '#F4A259'], 500, 300, [6, 16]); addFloat(g.x, g.y - 50, 'БАБАХ!', C.red, 40); hurt(9, g.x, g.y - 90); say(pick(['Стрелку надо было сбросить! Хорошо, что это игра.', 'Вот поэтому машинист смотрит на приборы, а не в телефон.', 'Техника безопасности — не пустые слова. В жизни — только по инструкции!']), 3, 'angry'); } }
      else g.danger = Math.max(0, g.danger - dt);
      if (g.v < .12){ g.low += dt; if (g.low > 2.2){ g.low = 0; g.v = .4; SFX.bad(); hurt(4, g.x, g.y - 90); say('Давление упало — линия розлива встала. Операторы уже звонят.', 2.6, 'angry'); } } else g.low = 0;
    }
  }
  gauge(g){
    const cx = g.x, cy = g.y, r = 96;
    wcirc(cx, cy, r + 8, '#fff', C.ink, 4);
    const a0 = Math.PI * .8, a1 = Math.PI * 2.2; const A = v => a0 + (a1 - a0) * v;
    const arc = (v0, v1, col) => { ctx.beginPath(); ctx.arc(cx, cy, r - 12, A(v0), A(v1)); ctx.strokeStyle = col; ctx.lineWidth = 14; ctx.lineCap = 'butt'; ctx.stroke(); };
    arc(0, .12, '#F2B8C6'); arc(.35, .68, C.green); arc(.86, 1, C.red);
    for (let i = 0; i <= 10; i++){ const a = A(i / 10); wline(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4), cx + Math.cos(a) * (r - 20), cy + Math.sin(a) * (r - 20), C.ink, 2); }
    const a = A(clamp(g.v, 0, 1)) + (g.v > .86 ? Math.sin(now * 50) * .05 : 0);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18)); ctx.strokeStyle = C.red; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();
    wcirc(cx, cy, 9, C.ink, null);
    txt(g.n, cx, cy + 42, { size: 18, weight: 900 }); txt(g.u, cx, cy + 62, { size: 12, weight: 700, color: C.steel });
    if (g.danger > .2){ ctx.globalAlpha = .5 + .5 * Math.sin(now * 20); txt('!!!', cx + 80, cy - 90, { size: 30, weight: 900, color: C.red }); ctx.globalAlpha = 1; }
    g.bm = button(cx - 104, cy + 112, 96, 66, '−', { size: 38, fill: '#fff', color: C.ink });
    g.bp = button(cx + 8, cy + 112, 96, 66, '+', { size: 38 });
    txt('сброс', cx - 56, cy + 196, { size: 11, color: C.steel }); txt('поддать', cx + 56, cy + 196, { size: 11, color: C.steel });
  }
  draw(){
    ctx.fillStyle = '#C9D0D3'; ctx.fillRect(0, 0, W, H);
    wrect(8, 168, 524, 660, '#B4BCC0', C.ink, 4);
    for (const g of this.g) this.gauge(g);
    ctx.fillStyle = C.floor; ctx.fillRect(0, 850, W, 110); wline(0, 850, W, 850, C.ink, 3);
    wrect(14, 14, 512, 64, '#fff', C.ink, 3);
    txt('ДО КОНЦА', 30, 32, { size: 11, align: 'left', color: C.steel }); txt(Math.max(0, Math.ceil(this.dur - this.t)) + ' с', 30, 57, { size: 24, weight: 900, align: 'left' });
    txt('АВАРИИ', 160, 32, { size: 11, align: 'left', color: C.steel }); txt(String(this.booms), 160, 57, { size: 24, weight: 900, align: 'left', color: C.red });
    txt('ПУЛЬТ', 380, 34, { size: 13, weight: 900, color: C.ink }); txt('МАШИНИСТА', 380, 56, { size: 13, weight: 900, color: C.ink });
    if (this.t < 6) txt('Держи все четыре стрелки в зелёном', W/2, 122, { size: 24, kind: 'h' });
    drawWorker(470, 950, .85, this.g.some(g => g.danger > .3) ? 'panic' : 'ok');
  }
}

// ================= LEVEL: НОВЫЙ ВКУС =================
const ING = [
  { k: 'malt', n: 'Солод', grain: 1, adj: 'Солодовый' }, { k: 'rye', n: 'Рожь', grain: 1, adj: 'Ржаной' }, { k: 'wheat', n: 'Пшеница', grain: 1, adj: 'Пшеничный' },
  { k: 'apple', n: 'Яблоко', fruit: 1, adj: 'Яблочный' }, { k: 'pear', n: 'Груша', fruit: 1, adj: 'Грушевый' }, { k: 'grape', n: 'Виноград', fruit: 1, adj: 'Виноградный' },
  { k: 'citrus', n: 'Цитрус', fruit: 1, adj: 'Цитрусовый' }, { k: 'hops', n: 'Хмель', hop: 1, adj: 'Хмельной' }, { k: 'sock', n: 'Носок Михалыча', sock: 1, adj: 'Носочный' }
];
class FlavorScene extends Scene {
  init(){ this.sel = []; this.phase = 'pick'; this.pt = 0; this.tiles = []; say('Отдел новых вкусов! Выбери три ингредиента — сварим на пилотной установке и отдадим дегустационной комиссии.', 4.5); }
  down(x, y){
    if (this.phase === 'pick'){
      this.tiles.forEach((b, i) => { if (hit(b, x, y)){ const j = this.sel.indexOf(i); if (j >= 0) this.sel.splice(j, 1); else if (this.sel.length < 3){ this.sel.push(i); SFX.pop(); } } });
      if (this.sel.length === 3 && hit(this.bBrew, x, y)){ this.phase = 'brew'; this.pt = 0; this.compute(); SFX.click(); }
    } else if (this.phase === 'verdict' && hit(this.bDone, x, y)) this.finish({ grade: this.score / 10, line: `Рецепт «${this.name}» — средний балл комиссии ${this.score.toFixed(1)} из 10.` });
  }
  compute(){
    const it = this.sel.map(i => ING[i]); const grains = it.filter(i => i.grain), fruits = it.filter(i => i.fruit), hop = it.some(i => i.hop), sock = it.some(i => i.sock);
    let s = 3 + (grains.length ? 3.5 : 0) + Math.min(2, fruits.length) * 1.6 + (hop && grains.length && !fruits.length ? 2 : hop ? .5 : 0) - (grains.length === 3 ? 1.5 : 0);
    const tag = pick(['Рассвет на Рябиновой', 'Ночная смена', 'Мечта технолога', 'У проходной', '2/2', 'Олимпийский-80', 'Пилотная партия']);
    const type = hop && grains.length && !fruits.length ? 'Пиво' : grains.length ? 'Квас' : 'Напиток';
    const main = (fruits[0] || grains[0] || it[0]).adj;
    this.name = `${type} «${main}. ${tag}»`;
    if (sock){ s = 2; this.name = 'Квас «Носок Михалыча», лимитка'; }
    this.score = clamp(s, 1, 10);
    this.judges = [0, 1, 2].map(() => clamp(Math.round(this.score + rnd(-1.2, 1.2)), 1, 10));
    this.comment = sock ? 'Комиссия вышла подышать. Михалыч ищет второй носок.' : grains.length === 0 ? 'Вкусно, но где квасная основа? Без зерна это компот.' : fruits.length >= 2 ? 'Яркий фруктовый профиль на хлебной основе. Отправляем на доработку рецептуры!' : hop && !fruits.length ? 'Классика пивоварения. Хмель уважаем.' : 'Добротно и по-нашему. Можно пробовать на пилотной партии.';
  }
  update(dt){ if (this.phase === 'brew'){ this.pt += dt; if (this.pt > 4.6){ this.phase = 'verdict'; this.score >= 6 ? SFX.fanfare() : SFX.sad(); } } }
  draw(){
    drawWallBg('#F6F7F8');
    if (this.phase === 'pick'){
      txt('СОБЕРИ РЕЦЕПТ', W/2, 40, { size: 26, weight: 900, color: C.red }); txt('три ингредиента', W/2, 70, { size: 22, kind: 'h', color: C.steel });
      this.tiles = ING.map((g, i) => {
        const x = 24 + (i % 3) * 170, y = 96 + Math.floor(i / 3) * 136; const on = this.sel.includes(i);
        wrect(x, y, 150, 124, on ? C.red : '#fff', C.ink, 3);
        if (g.sock){ ctx.save(); ctx.translate(x + 75, y + 62); ctx.beginPath(); wpoly([[-10,-30],[10,-30],[10,4],[26,12],[26,24],[-10,24]]); paint(on ? '#fff' : '#eee', C.ink, 3); wline(-10,-20,10,-20,on ? C.ink : C.red,4); ctx.restore(); }
        else drawIcon(g.k, x + 75, y + 54, 66, on ? '#fff' : C.red);
        txt(g.n, x + 75, y + 108, { size: g.sock ? 12 : 15, weight: 800, color: on ? '#fff' : C.ink });
        return { x, y, w: 150, h: 124 };
      });
      drawPanel(24, 520, 492, 290, 'ПИЛОТНЫЙ КОТЁЛ');
      drawIcon('kettle', 110, 640, 130, C.red);
      this.sel.forEach((i, j) => { const g = ING[i]; wrect(200 + j * 104, 590, 90, 90, '#fff', C.ink, 2.5); if (g.sock) txt('носок', 245 + j*104, 635, { size: 15, kind: 'h' }); else drawIcon(g.k, 245 + j * 104, 633, 60, C.red); });
      for (let j = this.sel.length; j < 3; j++){ wrect(200 + j * 104, 590, 90, 90, null, C.grey, 2); txt('?', 245 + j * 104, 635, { size: 32, weight: 900, color: C.grey }); }
      this.bBrew = button(150, 714, 240, 66, 'СВАРИТЬ', { on: this.sel.length === 3, size: 24 });
    } else if (this.phase === 'brew'){
      const steps = [['Лаборатория', 'funnel'], ['Пилотная пивоварня', 'tank'], ['Розлив', 'pet'], ['Дегустация', 'bottle']];
      txt('КАК РОЖДАЕТСЯ', W/2, 70, { size: 30, weight: 900, color: C.red }); txt('НОВЫЙ ВКУС', W/2, 106, { size: 30, weight: 900, color: C.red });
      steps.forEach(([n, ic], j) => { const x = j % 2 ? 400 : 140, y = j < 2 ? 160 : 450, act = this.pt > j * 1.1; wrect(x - 110, y, 220, 240, act ? '#fff' : '#ECEEEF', C.ink, 3); txt(String(j + 1), x - 90, y + 26, { size: 20, weight: 900, color: act ? C.red : C.grey }); drawIcon(ic, x, y + 105, 110, act ? C.red : C.grey); const ls = wrapText(n, 190, 17, 'b'); ls.forEach((l, k) => txt(l, x, y + 196 + k * 22, { size: 17, weight: 800, color: act ? C.ink : C.grey })); });
      wrect(40, 730, 460, 22, '#fff', C.ink, 3); ctx.fillStyle = C.red; ctx.fillRect(43, 733, 454 * clamp(this.pt / 4.4, 0, 1), 16);
    } else {
      txt('ВЕРДИКТ', W/2, 46, { size: 20, weight: 900, color: C.steel }); txt('ДЕГУСТАЦИОННОЙ КОМИССИИ', W/2, 72, { size: 20, weight: 900, color: C.steel });
      const lines = wrapText(this.name, 480, 36, 'b');
      lines.forEach((l, j) => txt(l, W/2, 130 + j * 42, { size: 36, weight: 900, color: C.red, kind: 'b' }));
      this.judges.forEach((s, j) => { const x = 100 + j * 170; drawMikh(x, 520, .95, s < 5 ? 'angry' : 'ok'); wrect(x - 42, 532, 84, 62, '#fff', C.ink, 3); txt(String(s), x, 565, { size: 34, weight: 900, color: s >= 6 ? C.ink : C.red }); });
      const cl = wrapText(this.comment, 470, 24); cl.forEach((l, j) => txt(l, W/2, 650 + j * 30, { size: 24, kind: 'h' }));
      this.bDone = button(130, 760, 280, 70, 'СДАТЬ РЕЦЕПТ', { size: 22 });
    }
  }
}
