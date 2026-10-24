// ================= LEVEL: СКЛАД (stacking) =================
class StackScene extends Scene {
  init(){
    this.BH = 40; this.goal = 12; this.placed = 0; this.misses = 0; this.perfects = 0;
    this.stack = [{ x: 160, w: 220, y: 820 - 40, c: 0 }];
    this.cam = 0; this.debris = []; this.widthSum = 0; this.wrap = -1;
    this.spawn(220);
    say('Паллет — это святое. Ставь ровно, а то развалится и будешь собирать до ночной смены.', 4);
  }
  topY(){ return this.stack[this.stack.length - 1].y; }
  spawn(w){ this.cur = { x: Math.random() < .5 ? 24 : 516 - w, w, y: this.topY() - 190, vy: 0, dir: Math.random() < .5 ? 1 : -1, falling: false, c: this.placed + 1 }; if (this.cur.x < 60) this.cur.dir = 1; else this.cur.dir = -1; }
  down(){
    if (!this.cur || this.wrap >= 0 || this.cur.falling) return;
    this.cur.falling = true; SFX.click();
  }
  land(){
    const b = this.cur, top = this.stack[this.stack.length - 1];
    const ov = Math.min(b.x + b.w, top.x + top.w) - Math.max(b.x, top.x);
    const sy = b.y - this.cam;
    if (ov <= 6){
      this.debris.push({ x: b.x, y: b.y, w: b.w, h: this.BH, vx: (b.x < top.x ? -120 : 120), vy: -80, rot: 0, vr: (b.x < top.x ? -3 : 3), c: b.c });
      this.misses++; SFX.bad(); hurt(7, b.x + b.w/2, sy - 20);
      say(pick(['Мимо! Это ж квас, а не баскетбол.', 'Упаковка на полу — минус премия.', 'Кладовщик плачет, бухгалтерия считает.']), 2.6, 'angry');
      if (this.misses >= 3) return this.end();
      this.spawn(b.w); return;
    }
    let nx = b.x, nw = b.w;
    if (Math.abs(b.x - top.x) < 8){ nx = top.x; nw = Math.min(b.w, top.w); this.perfects++; SFX.ok(); addFloat(nx + nw/2, sy - 30, 'Идеально!', C.green, 28); G.bonus += 100; hud(); }
    else {
      SFX.thud();
      if (b.x < top.x){ this.debris.push({ x: b.x, y: b.y, w: top.x - b.x, h: this.BH, vx: -100, vy: -60, rot: 0, vr: -4, c: b.c }); nx = top.x; nw = ov; }
      else { this.debris.push({ x: top.x + top.w, y: b.y, w: b.x + b.w - (top.x + top.w), h: this.BH, vx: 100, vy: -60, rot: 0, vr: 4, c: b.c }); nw = ov; }
      if (nw < 60) say('Коробка всё уже… скоро будешь грузить по одной банке.', 2.4);
    }
    this.stack.push({ x: nx, w: nw, y: top.y - this.BH, c: b.c });
    this.placed++; this.widthSum += nw / 220;
    if (this.placed >= this.goal) return this.end();
    this.spawn(nw);
  }
  end(){ this.wrap = 0; this.cur = null; say(this.placed >= this.goal ? 'Обматываем стрейч-плёнкой — и на отгрузку. Ты рождён для склада!' : 'Паллет развалился. Ладно, водитель фуры подождёт…', 3, this.placed >= this.goal ? 'ok' : 'angry'); }
  update(dt){
    const targetCam = Math.min(0, this.topY() - 560); this.cam += (targetCam - this.cam) * Math.min(1, dt * 4);
    if (this.cur){
      const b = this.cur;
      if (!b.falling){ const sp = 190 + this.placed * 22; b.x += b.dir * sp * dt; if (b.x < 14){ b.x = 14; b.dir = 1; } if (b.x + b.w > 526){ b.x = 526 - b.w; b.dir = -1; } }
      else { b.vy += 2200 * dt; b.y += b.vy * dt; if (b.y >= this.topY() - this.BH){ b.y = this.topY() - this.BH; this.land(); } }
    }
    for (const d of this.debris){ d.vy += 1600 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; }
    this.debris = this.debris.filter(d => d.y - this.cam < 1300);
    if (this.wrap >= 0){ this.wrap += dt; if (this.wrap > 2.6){ const avgW = this.placed ? this.widthSum / this.placed : 0; const g = clamp((this.placed / this.goal) * (.45 + .55 * avgW) + this.perfects * .015, 0, 1); this.finish({ grade: g, line: `Собрано ${this.placed} из ${this.goal} упаковок, идеальных — ${this.perfects}.` }); this.wrap = -99; } }
  }
  drawBox(x, y, w, h, c){
    const red = c % 2 === 0; wrect(x, y, w, h, red ? C.red : '#fff', C.ink, 3);
    if (w > 70) txt(red ? 'КВАС' : 'ОЧАКОВО', x + w/2, y + h/2 + 1, { size: w > 130 ? 18 : 13, weight: 900, color: red ? '#fff' : C.red });
    const n = Math.floor(w / 26); for (let i = 0; i < n; i++){ ctx.beginPath(); ctx.ellipse(x + 13 + i * (w - 26) / Math.max(1, n - 1), y, 10, 4, 0, 0, Math.PI * 2); paint(red ? '#ddd' : C.grey, C.ink, 1.5); }
  }
  draw(){
    drawWallBg('#F1F2F3');
    const cam = this.cam;
    // racks
    ctx.save(); ctx.translate(0, -cam * .3);
    for (let i = 0; i < 9; i++){ const y = 150 + i * 110 - 300; wline(0, y, 120, y, C.steel, 6); wline(420, y, 540, y, C.steel, 6); for (let k = 0; k < 2; k++){ wrect(8 + k*56, y - 40, 48, 38, k % 2 ? '#fff' : C.red, C.ink, 2); wrect(428 + k*56, y - 40, 48, 38, k % 2 ? C.red : '#fff', C.ink, 2); } }
    wline(4, -500, 4, 900, C.steel, 6); wline(118, -500, 118, 900, C.steel, 6); wline(422, -500, 422, 900, C.steel, 6); wline(536, -500, 536, 900, C.steel, 6);
    ctx.restore();
    ctx.save(); ctx.translate(0, -cam);
    // floor + pallet
    ctx.fillStyle = C.floor; ctx.fillRect(-20, 845, W + 40, 500); wline(0, 845, W, 845, C.ink, 3);
    wrect(150, 820, 240, 10, C.wood, C.ink, 2.5); wrect(150, 835, 240, 10, C.wood, C.ink, 2.5); wrect(158, 828, 24, 9, C.wood, C.ink, 2); wrect(258, 828, 24, 9, C.wood, C.ink, 2); wrect(358, 828, 24, 9, C.wood, C.ink, 2);
    for (let i = 1; i < this.stack.length; i++){ const s = this.stack[i]; this.drawBox(s.x, s.y, s.w, this.BH, s.c); }
    if (this.wrap >= 0){ const k = Math.min(1, this.wrap / 1.5); ctx.globalAlpha = .45; ctx.strokeStyle = '#9FD3E8'; ctx.lineWidth = 3; const top = this.topY(); const n = Math.floor(k * 18);
      for (let i = 0; i < n; i++){ const y = 820 - i * (820 - top) / 18; ctx.beginPath(); ctx.moveTo(140, y); ctx.lineTo(400, y - 22); ctx.stroke(); } ctx.globalAlpha = 1; }
    if (this.cur){ const b = this.cur; wline(b.x + b.w/2, cam - 10, b.x + b.w/2, b.y - 16, C.ink, 3); ctx.beginPath(); ctx.arc(b.x + b.w/2, b.y - 10, 8, Math.PI, 0); paint(null, C.ink, 4); wline(b.x + 10, b.y, b.x + b.w/2, b.y - 12, C.ink, 2); wline(b.x + b.w - 10, b.y, b.x + b.w/2, b.y - 12, C.ink, 2); this.drawBox(b.x, b.y, b.w, this.BH, b.c); }
    for (const d of this.debris){ ctx.save(); ctx.translate(d.x + d.w/2, d.y + d.h/2); ctx.rotate(d.rot); this.drawBox(-d.w/2, -d.h/2, d.w, d.h, d.c); ctx.restore(); }
    drawWorker(470, 845, 1.1, this.misses ? 'panic' : 'ok', { arm: -20 });
    ctx.restore();
    // ui
    wrect(14, 14, 512, 66, '#fff', C.ink, 3);
    txt('ПАЛЛЕТ', 32, 34, { size: 12, align: 'left', color: C.steel }); txt(`${this.placed} / ${this.goal}`, 32, 59, { size: 28, weight: 900, align: 'left' });
    txt('ПРОМАХИ', 300, 34, { size: 12, align: 'left', color: C.steel }); txt('✕'.repeat(this.misses) + '·'.repeat(3 - this.misses), 300, 59, { size: 26, weight: 900, align: 'left', color: C.red });
    if (this.t < 5) txt('Тап — опустить упаковку', W/2, 120, { size: 28, kind: 'h', stroke: '#fff' });
  }
}

// ================= LEVEL: ВАРКА (foddian climb) =================
class ClimbScene extends Scene {
  init(){
    this.B = { x: 100, y: 2230 }; this.V = { x: 0, y: 0 }; this.O = { x: 70, y: -60 }; this.aim = { x: 70, y: -60 }; this.drag = null; this.anchor = null;
    this.R = 26; this.L = 150; this.Lmin = 45; this.cam = 1340; this.best = 2230; this.helped = false; this.won = false; this.falls = 0;
    this.rects = [
      [-100, 2260, 740, 300, 'floor'], [-60, -600, 60, 3200, 'wall'], [540, -600, 60, 3200, 'wall'],
      [290, 2190, 140, 70, 'sack'], [400, 2110, 140, 150, 'sack'], [230, 2010, 160, 22, 'ledge'],
      [30, 1920, 100, 340, 'barrel'], [390, 1640, 150, 22, 'ledge'], [420, 1560, 120, 80, 'sack'],
      [190, 1460, 190, 22, 'ledge'], [10, 930, 150, 22, 'ledge'], [210, 560, 330, 340, 'tank'], [325, 470, 100, 24, 'hatch']
    ];
    this.caps = [
      [150, 1800, 420, 1740, 14, 'pipe'],
      [30, 1380, 115, 1380, 8, 'rung'], [30, 1290, 115, 1290, 8, 'rung'], [30, 1200, 115, 1200, 8, 'rung'], [30, 1110, 115, 1110, 8, 'rung'], [30, 1020, 115, 1020, 8, 'rung'],
      [120, 850, 195, 850, 8, 'rung'], [120, 760, 195, 760, 8, 'rung'], [120, 670, 195, 670, 8, 'rung'], [120, 585, 195, 585, 8, 'rung'],
      [210, 560, 280, 500, 10, 'dome'], [280, 500, 470, 500, 10, 'dome'], [470, 500, 540, 560, 10, 'dome']
    ];
    this.win = [290, 370, 170, 100];
    say('Солод — в варочный котёл, люк наверху. Лестницу увезли на ремонт, так что вот тебе мешалка. Тяни пальцем.', 5);
  }
  collide(p, r){
    let best = null;
    for (const [x, y, w, h] of this.rects){
      const cx = clamp(p.x, x, x + w), cy = clamp(p.y, y, y + h);
      let pen, nx, ny;
      if (cx === p.x && cy === p.y){
        const dl = p.x - x, dr = x + w - p.x, dt = p.y - y, db = y + h - p.y; const m = Math.min(dl, dr, dt, db);
        if (m === dt){ nx = 0; ny = -1; } else if (m === db){ nx = 0; ny = 1; } else if (m === dl){ nx = -1; ny = 0; } else { nx = 1; ny = 0; }
        pen = r + m;
      } else { const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy); if (d >= r) continue; pen = r - d; nx = dx / (d || 1); ny = dy / (d || 1); }
      if (!best || pen > best.pen) best = { pen, nx, ny };
    }
    for (const [ax, ay, bx, by, cr] of this.caps){
      const vx = bx - ax, vy = by - ay; const t = clamp(((p.x - ax) * vx + (p.y - ay) * vy) / (vx*vx + vy*vy), 0, 1);
      const qx = ax + vx * t, qy = ay + vy * t; const dx = p.x - qx, dy = p.y - qy, d = Math.hypot(dx, dy);
      if (d >= r + cr) continue; const pen = r + cr - d; if (!best || pen > best.pen) best = { pen, nx: dx / (d || 1), ny: d ? dy / d : -1 };
    }
    return best;
  }
  pushOut(p, r){ let q = { x: p.x, y: p.y }, n = null; for (let i = 0; i < 5; i++){ const c = this.collide(q, r); if (!c) break; q.x += c.nx * (c.pen + .01); q.y += c.ny * (c.pen + .01); n = { x: c.nx, y: c.ny }; } return { p: q, n, hit: !!n }; }
  // Relative drag: the finger can be anywhere on screen, the paddle repeats its movement.
  down(x, y){
    if (this.helpBtn && hit(this.helpBtn, x, y)){ this.helped = true; hurt(10, 400, 120); this.B = { x: 375, y: 430 }; this.V = { x: 0, y: 0 }; this.anchor = null; say('Эх, молодёжь. В восьмидесятом к Олимпиаде без всяких подсказок лазили!', 3, 'angry'); return; }
    this.drag = { x, y, ax: this.aim.x, ay: this.aim.y };
  }
  move(x, y){ if (!this.drag) return; const k = 1.35; this.aim = { x: this.drag.ax + (x - this.drag.x) * k, y: this.drag.ay + (y - this.drag.y) * k }; const l = Math.hypot(this.aim.x, this.aim.y); if (l > this.L){ this.aim.x *= this.L / l; this.aim.y *= this.L / l; } }
  up(){ this.drag = null; }
  update(dt){
    if (this.won) { if (this.t - this.wonAt > 2.2){ this.finish(this.result); this.won = false; this.wonAt = 1e9; } return; }
    const h = dt / 4;
    for (let s = 0; s < 4; s++){
      let rx = this.aim.x, ry = this.aim.y; let len = Math.hypot(rx, ry) || 1;
      const L = clamp(len, this.Lmin, this.L); rx = rx / len * L; ry = ry / len * L;
      let dx = rx - this.O.x, dy = ry - this.O.y; const dl = Math.hypot(dx, dy), maxd = 14;
      if (dl > maxd){ dx = dx / dl * maxd; dy = dy / dl * maxd; }
      this.O.x += dx; this.O.y += dy;
      const B = this.B, O = this.O;
      if (this.anchor){
        const a = this.anchor; const T = { x: B.x + O.x, y: B.y + O.y };
        const d = (T.x - a.x) * a.nx + (T.y - a.y) * a.ny;
        if (d > 3){ this.anchor = null; }
        else {
          const nb = { x: a.x - O.x, y: a.y - O.y }; const r = this.pushOut(nb, this.R);
          let vx = (r.p.x - B.x) / h, vy = (r.p.y - B.y) / h; const vl = Math.hypot(vx, vy); if (vl > 1000){ vx *= 1000 / vl; vy *= 1000 / vl; }
          this.V = { x: vx, y: vy }; this.B = r.p; continue;
        }
      }
      this.V.y += 1500 * h; this.V.x *= .9995;
      B.x += this.V.x * h; B.y += this.V.y * h;
      const rb = this.pushOut(B, this.R);
      if (rb.hit){ this.B = rb.p; const vn = this.V.x * rb.n.x + this.V.y * rb.n.y; if (vn < 0){ this.V.x -= vn * rb.n.x; this.V.y -= vn * rb.n.y; if (vn < -500) SFX.thud(); } this.V.x *= .96; }
      const T2 = { x: this.B.x + O.x, y: this.B.y + O.y }; const rt = this.pushOut(T2, 9);
      if (rt.hit){
        this.B.x += rt.p.x - T2.x; this.B.y += rt.p.y - T2.y; this.B = this.pushOut(this.B, this.R).p;
        this.anchor = { x: rt.p.x, y: rt.p.y, nx: rt.n.x, ny: rt.n.y }; this.V.x *= .2; this.V.y *= .2;
      }
    }
    // camera
    const tc = clamp(this.B.y - 560, 200, 1340); this.cam += (tc - this.cam) * Math.min(1, dt * 5);
    // falls
    if (this.B.y < this.best) this.best = this.B.y;
    if (this.B.y - this.best > 320 && !this.anchor && Math.abs(this.V.y) < 30){
      this.falls++; this.best = this.B.y; SFX.sad();
      say(pick(['Сахар — 50 кило мешок. А ты сколько весишь, что так летаешь?', 'Держись за мешалку! Она дороже тебя стоит.', 'Ничего. В Getting Over It тоже не с первого раза.', 'Технику безопасности на вводном инструктаже слушал? Вот и я нет. Шучу! Слушай всегда.', 'Падать — это нормально. Нормально, я сказал!']), 3.2, this.falls > 2 ? 'angry' : 'ok');
    }
    // win
    const [wx, wy, ww, wh] = this.win;
    if (this.B.x > wx && this.B.x < wx + ww && this.B.y > wy && this.B.y < wy + wh){
      this.won = true; this.wonAt = this.t; SFX.fanfare(); burst(this.B.x, this.B.y - this.cam, 40, [C.red, '#fff', C.green, '#E9C46A'], 420);
      const t = this.t; let g = this.helped ? .3 : t < 60 ? 1 : t < 120 ? .85 : t < 200 ? .7 : .55;
      this.result = { grade: g, line: this.helped ? 'Залез с помощью наставника. Засчитано, но премию Михалыч заберёт себе.' : `Залез за ${Math.round(t)} с, падений: ${this.falls}. Солод в котле, сусло варится.` };
      say(this.helped ? 'Ну… засыпали солод. Считай, я сам.' : 'Солод в котле! Варка пошла. Вот это я понимаю — технологический цех!', 3);
    }
  }
  drawRect(x, y, w, h, kind){
    if (kind === 'floor'){ ctx.fillStyle = '#B9C0C3'; ctx.fillRect(x, y, w, h); wline(0, y, W, y, C.ink, 3); return; }
    if (kind === 'wall') return;
    if (kind === 'sack'){ const rows = Math.max(1, Math.round(h / 72)); const rh = h / rows; for (let i = 0; i < rows; i++){ const yy = y + i * rh; ctx.beginPath(); wpoly([[x + 4, yy + 6], [x + w/2, yy], [x + w - 4, yy + 6], [x + w, yy + rh], [x, yy + rh]], 2.2); paint(C.sack, C.ink, 3); txt('САХАР', x + w/2, yy + rh*.48, { size: 15, weight: 900, color: C.dred }); txt('50 кг', x + w/2, yy + rh*.75, { size: 11, weight: 700, color: C.steel }); } return; }
    if (kind === 'barrel'){ wrect(x, y, w, h, '#9C6B3C', C.ink, 3); for (let i = 1; i < 4; i++) wline(x, y + h*i/4, x + w, y + h*i/4, C.ink, 3); ctx.save(); ctx.translate(x + w/2, y + h/2); ctx.rotate(-Math.PI/2); txt('СОЛОД', 0, 0, { size: 20, weight: 900, color: '#fff', stroke: C.ink, sw: 4 }); ctx.restore(); return; }
    if (kind === 'ledge'){ wrect(x, y, w, h, '#C3CACD', C.ink, 3); for (let i = 10; i < w; i += 16) wline(x + i, y, x + i - 8, y + h, C.steel, 1.5); return; }
    if (kind === 'tank'){ wrect(x, y, w, h, '#D3D9DC', C.ink, 3); wrect(x + w/2 - 60, y + 60, 120, 120, C.red, C.ink, 3); wrect(x + w/2 - 38, y + 82, 76, 76, '#fff', null); wrect(x + w/2 - 22, y + 98, 44, 44, C.red, null); txt('ОЧАКОВО', x + w/2, y + 225, { size: 30, weight: 900, color: C.red }); txt('ВАРОЧНЫЙ КОТЁЛ №2', x + w/2, y + 258, { size: 15, weight: 800, color: C.steel }); return; }
    if (kind === 'hatch'){ wrect(x, y, w, h, C.steel, C.ink, 3); return; }
  }
  draw(){
    const cam = this.cam;
    ctx.fillStyle = '#EEF0F1'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(0, -cam * .45);
    for (let i = 0; i < 3; i++){ const x = 20 + i * 180; wrect(x, 100, 120, 1500, '#E2E6E8', '#C6CCCF', 3); }
    for (let y = 0; y < 1800; y += 140) wline(0, y, W, y + 30, '#D6DBDE', 4);
    ctx.restore();
    ctx.save(); ctx.translate(0, -cam);
    for (const r of this.rects) this.drawRect(...r);
    for (const [ax, ay, bx, by, cr, k] of this.caps){
      if (k === 'dome') continue;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.strokeStyle = C.ink; ctx.lineWidth = cr * 2 + 6; ctx.lineCap = 'round'; ctx.stroke();
      ctx.strokeStyle = k === 'pipe' ? '#E8C547' : C.grey; ctx.lineWidth = cr * 2; ctx.stroke();
      if (k === 'pipe') txt('СИРОП', (ax + bx)/2, (ay + by)/2 + 2, { size: 13, weight: 900, color: C.ink });
    }
    // dome
    ctx.beginPath(); ctx.moveTo(200, 565); ctx.lineTo(280, 498); ctx.lineTo(470, 498); ctx.lineTo(545, 565); ctx.closePath(); paint('#D3D9DC', C.ink, 3);
    wline(30, 1000, 30, 1400, C.steel, 5); wline(115, 1000, 115, 1400, C.steel, 5); wline(120, 570, 120, 870, C.steel, 5);
    txt('ЛЮК', 375, 445, { size: 24, weight: 900, color: C.red, stroke: '#fff' }); txt('↓', 375, 420, { size: 28, weight: 900, color: C.red });
    // player
    const B = this.B, T = this.anchor ? { x: this.anchor.x, y: this.anchor.y } : { x: B.x + this.O.x, y: B.y + this.O.y };
    ctx.beginPath(); ctx.moveTo(B.x, B.y - 6); ctx.lineTo(T.x, T.y); ctx.strokeStyle = C.ink; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = C.wood; ctx.lineWidth = 5; ctx.stroke();
    const ang = Math.atan2(T.y - B.y, T.x - B.x); ctx.save(); ctx.translate(T.x, T.y); ctx.rotate(ang); wrect(-6, -14, 22, 28, C.wood, C.ink, 3); ctx.restore();
    // body = keg + worker
    ctx.save(); ctx.translate(B.x, B.y);
    drawWorker(0, -2, .62, Math.abs(this.V.y) > 500 ? 'panic' : 'ok');
    wrect(-26, -20, 52, 46, '#C9D0D3', C.ink, 3); wline(-26, -6, 26, -6, C.ink, 2.5); wline(-26, 12, 26, 12, C.ink, 2.5); wrect(-9, -3, 18, 12, C.red, C.ink, 1.5);
    ctx.restore();
    ctx.restore();
    // UI
    const left = Math.max(0, Math.round((B.y - 470) / 100 * 10) / 10);
    wrect(14, 14, 200, 64, '#fff', C.ink, 3); txt('ДО ЛЮКА', 28, 32, { size: 12, align: 'left', color: C.steel }); txt(left.toFixed(1) + ' м', 28, 58, { size: 26, weight: 900, align: 'left' });
    txt(Math.floor(this.t) + ' с', 196, 58, { size: 16, align: 'right', color: C.steel });
    if (this.t > 40 && !this.won){ this.helpBtn = button(290, 18, 236, 50, 'Позвать Михалыча', { size: 17, fill: '#fff', color: C.ink }); txt('−10 терпения', 408, 84, { size: 12, color: C.steel }); } else this.helpBtn = null;
    if (this.t < 7){ txt('Тяни пальцем в любом месте экрана —', W/2, 120, { size: 24, kind: 'h', stroke: '#fff' }); txt('мешалка повторит движение и зацепится', W/2, 150, { size: 24, kind: 'h', stroke: '#fff' }); }
  }
}
