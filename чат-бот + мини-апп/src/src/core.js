// ================= CORE =================
const W = 540, H = 960;
const C = { red:'#D50032', dred:'#AB2328', ink:'#26272B', steel:'#626262', grey:'#A2AAAD', green:'#84BD00',
  paper:'#FFFFFF', wall:'#EDEFF0', tile:'#DDE2E4', floor:'#B9C0C3', kvas:'#6B3410', skin:'#F2C9A0', wood:'#C08A55', sack:'#E9DFC8' };
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const ov = document.getElementById('ov');
const stageEl = document.getElementById('stage');
document.getElementById('logo').src = ICONS.logo;

// Canvas keeps a 9:16 logical field and is letterboxed into whatever space the stage has.
function fit(){
  const box = stageEl.getBoundingClientRect(); if (!box.width || !box.height) return;
  const s = Math.min(box.width / W, box.height / H);
  const cw = Math.floor(W * s), ch = Math.floor(H * s);
  if (cv.style.width !== cw + 'px'){ cv.style.width = cw + 'px'; cv.style.height = ch + 'px'; }
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const w = Math.round(cw * dpr), h = Math.round(ch * dpr);
  if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
}
window.addEventListener('resize', fit);

// ---------- icons tinted ----------
const iconImg = {}; const tintCache = {};
for (const k in ICONS){ const im = new Image(); im.src = ICONS[k]; iconImg[k] = im; }
function icon(k, color){
  const key = k + color; if (tintCache[key]) return tintCache[key];
  const im = iconImg[k]; if (!im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return (tintCache[key] = c);
}
function drawIcon(k, x, y, s, color = C.red){ const c = icon(k, color); if (c) ctx.drawImage(c, x - s/2, y - s/2, s, s * c.height / c.width); }

// ---------- input ----------
const input = { x: W/2, y: H/2, down: false };
function toLogical(e){ const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
cv.addEventListener('pointerdown', e => { audioInit(); try{ cv.setPointerCapture(e.pointerId); }catch(_){}
  const p = toLogical(e); input.x = p.x; input.y = p.y; input.down = true; if (speech && speech.t > .6) speech = null; scene && scene.down && scene.down(p.x, p.y); e.preventDefault(); });
cv.addEventListener('pointermove', e => { const p = toLogical(e); input.x = p.x; input.y = p.y; scene && scene.move && scene.move(p.x, p.y); });
cv.addEventListener('pointerup', e => { input.down = false; const p = toLogical(e); scene && scene.up && scene.up(p.x, p.y); });
cv.addEventListener('pointercancel', () => { input.down = false; });

// ---------- audio ----------
let AC = null, muted = false;
function audioInit(){ if (AC) { if (AC.state === 'suspended') AC.resume(); return; } try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { AC = null; } }
function beep(f = 440, d = .1, type = 'square', vol = .07, slide = 0){
  if (!AC || muted) return; const t = AC.currentTime; const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + .03);
}
function noise(d = .3, vol = .15, freq = 800){
  if (!AC || muted) return; const t = AC.currentTime; const n = Math.floor(AC.sampleRate * d); const b = AC.createBuffer(1, n, AC.sampleRate);
  const a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = (Math.random()*2 - 1) * (1 - i/n);
  const s = AC.createBufferSource(); s.buffer = b; const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; const g = AC.createGain(); g.gain.value = vol;
  s.connect(f).connect(g).connect(AC.destination); s.start(t);
}
const SFX = {
  ok(){ hap('success'); beep(660,.08,'square',.06); setTimeout(()=>beep(990,.12,'square',.06),70); },
  bad(){ hap('error'); beep(170,.3,'sawtooth',.08,-80); },
  pop(){ hap('light'); beep(420,.07,'triangle',.1,380); },
  boom(){ hap('heavy'); noise(.8,.5,200); beep(60,.5,'sine',.25,-30); },
  hiss(){ noise(.22,.08,3000); },
  thud(){ hap('medium'); beep(110,.12,'sine',.22,-50); },
  click(){ hap('select'); beep(1300,.03,'square',.035); },
  clink(){ beep(1800,.05,'triangle',.06); setTimeout(()=>beep(2400,.06,'triangle',.04),40); },
  fanfare(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.16,'square',.06),i*120)); },
  sad(){ [392,370,349,311].forEach((f,i)=>setTimeout(()=>beep(f,.28,'triangle',.08),i*260)); }
};
const muteBtn = document.getElementById('mute');
muteBtn.addEventListener('click', () => { muted = !muted; muteBtn.setAttribute('aria-pressed', String(muted)); muteBtn.textContent = muted ? 'Звук выкл' : 'Звук вкл'; });

// ---------- wobbly ("всратый") drawing ----------
let boil = 0, now = 0;
function jit(a, b){ const s = Math.sin(a*12.9898 + b*78.233 + boil*37.719) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; }
function wpoly(pts, j = 1.6, close = true){
  pts.forEach((p, i) => { const x = p[0] + jit(p[0], p[1]) * j, y = p[1] + jit(p[1], p[0]) * j; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  if (close) ctx.closePath();
}
function paint(fill, stroke = C.ink, lw = 3){ if (fill){ ctx.fillStyle = fill; ctx.fill(); } if (stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); } }
function wrect(x, y, w, h, fill, stroke = C.ink, lw = 3, j = 1.6){ ctx.beginPath(); wpoly([[x,y],[x+w/2,y],[x+w,y],[x+w,y+h/2],[x+w,y+h],[x+w/2,y+h],[x,y+h],[x,y+h/2]], j); paint(fill, stroke, lw); }
function wcirc(x, y, r, fill, stroke = C.ink, lw = 3, j = 1.4){ const pts = []; const n = Math.max(10, Math.min(24, r|0)); for (let i = 0; i < n; i++){ const a = i / n * Math.PI * 2; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } ctx.beginPath(); wpoly(pts, j); paint(fill, stroke, lw); }
function wline(x1, y1, x2, y2, color = C.ink, lw = 3){ ctx.beginPath(); wpoly([[x1,y1],[(x1+x2)/2,(y1+y2)/2],[x2,y2]], 1.4, false); paint(null, color, lw); }
function font(size, kind = 'b', weight = 800){ return kind === 'h' ? `${size}px Neucha, "Comic Sans MS", cursive` : `${weight} ${size}px Montserrat, Arial, sans-serif`; }
function txt(s, x, y, { size = 20, kind = 'b', weight = 800, color = C.ink, align = 'center', base = 'middle', stroke = null, sw = 5 } = {}){
  ctx.font = font(size, kind, weight); ctx.textAlign = align; ctx.textBaseline = base;
  if (stroke){ ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function wrapText(s, maxW, size, kind = 'h'){
  ctx.font = font(size, kind); const words = s.split(' '); const lines = []; let cur = '';
  for (const w of words){ const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur){ lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

// ---------- characters ----------
const G = { name:'', patience:100, bonus:0, res:{}, outfit:{ cap:true, vest:true, boots:true, pass:true }, quiz:0, helped:false };

function drawWorker(x, y, s = 1, mood = 'ok', opts = {}){
  // y = feet line
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const o = G.outfit;
  // legs
  wline(-10, -40, -14, -2, C.ink, 5); wline(10, -40, 14, -2, C.ink, 5);
  if (o.slippers){ wrect(-26, -6, 18, 7, '#3A7BD5', C.ink, 2); wrect(8, -6, 18, 7, '#3A7BD5', C.ink, 2); }
  else { wrect(-26, -8, 20, 9, C.ink, C.ink, 2); wrect(6, -8, 20, 9, C.ink, C.ink, 2); }
  // body
  if (o.hawaii){ wrect(-22, -86, 44, 50, '#F7A400', C.ink, 3); wcirc(-10,-72,5,'#2BB673',null); wcirc(8,-56,6,'#E8336D',null); wcirc(10,-78,4,'#2BB673',null); }
  else if (o.vest){ wrect(-22, -86, 44, 50, C.red, C.ink, 3); wline(-22,-60,22,-60,'#fff',3); }
  else wrect(-22, -86, 44, 50, '#8C9AA3', C.ink, 3);
  // arms
  const wave = opts.wave ? Math.sin(now*10) * 10 : 0;
  wline(-20, -80, -34, -52 - wave, C.ink, 5); wline(20, -80, 34, -52 + (opts.arm||0), C.ink, 5);
  // head
  wcirc(0, -104, 18, C.skin, C.ink, 3);
  // face
  ctx.fillStyle = C.ink;
  if (mood === 'panic'){ wcirc(-7,-106,3.5,'#fff',C.ink,2,.3); wcirc(7,-106,3.5,'#fff',C.ink,2,.3); wcirc(0,-95,4,C.ink,null); ctx.fillStyle='#5BC0EB'; ctx.beginPath(); ctx.arc(16,-110,3,0,7); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(-6,-106,2.2,0,7); ctx.arc(6,-106,2.2,0,7); ctx.fill();
    ctx.beginPath(); if (mood === 'sad') ctx.arc(0,-92,6,Math.PI*1.15,Math.PI*1.85); else ctx.arc(0,-99,6,.2,Math.PI-.2); paint(null, C.ink, 2.5); }
  // cap
  if (o.cap){ ctx.beginPath(); wpoly([[-19,-110],[-16,-124],[0,-128],[16,-124],[19,-110]]); paint(C.red, C.ink, 3); wline(14,-111,30,-108,C.ink,4); ctx.fillStyle='#fff'; ctx.fillRect(-4,-123,8,8); ctx.fillStyle=C.red; ctx.fillRect(-2,-121,4,4); }
  if (o.headphones){ wcirc(-19,-104,6,C.ink,null); wcirc(19,-104,6,C.ink,null); ctx.beginPath(); ctx.arc(0,-106,20,Math.PI,0); paint(null,C.ink,3); }
  if (o.bowtie){ ctx.beginPath(); wpoly([[-9,-90],[0,-86],[9,-90],[9,-82],[0,-86],[-9,-82]]); paint('#7B2CBF', C.ink, 2); }
  ctx.restore();
}
function drawMikh(x, y, s = 1, mood = 'ok'){
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  wline(-12,-40,-14,-2,C.ink,6); wline(12,-40,14,-2,C.ink,6);
  wrect(-30,-8,22,9,C.ink,C.ink,2); wrect(8,-8,22,9,C.ink,C.ink,2);
  ctx.beginPath(); wpoly([[-26,-92],[26,-92],[34,-60],[28,-36],[-28,-36],[-34,-60]]); paint(C.red, C.ink, 3);
  txt('Я ДЕЛАЮ', 0, -70, { size: 8, color: '#fff' }); txt('НАТУРАЛЬНЫЕ', 0, -61, { size: 6.5, color: '#fff' });
  wline(-26,-86,-40,-50,C.ink,6); wline(26,-86,40,-56 + (mood==='angry'? Math.sin(now*14)*8:0),C.ink,6);
  wcirc(0,-112,21,C.skin,C.ink,3);
  ctx.beginPath(); wpoly([[-14,-100],[-6,-104],[0,-101],[6,-104],[14,-100],[8,-96],[0,-98],[-8,-96]]); paint('#8B9094', C.ink, 2);
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(-7,-114,2.4,0,7); ctx.arc(7,-114,2.4,0,7); ctx.fill();
  if (mood === 'angry'){ wline(-12,-122,-3,-118,C.ink,3); wline(12,-122,3,-118,C.ink,3); } else { wline(-12,-120,-3,-121,C.ink,2.5); wline(12,-120,3,-121,C.ink,2.5); }
  ctx.beginPath(); wpoly([[-21,-118],[-17,-134],[0,-138],[17,-134],[21,-118]]); paint(C.red, C.ink, 3); wline(16,-119,34,-116,C.ink,4);
  ctx.restore();
}
const MIKH_SVG = (mood = 'ok') => `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" fill="#EDEFF0" stroke="#26272B" stroke-width="2.5"/><ellipse cx="32" cy="38" rx="17" ry="18" fill="#F2C9A0" stroke="#26272B" stroke-width="2.5"/><path d="M14 28 Q32 6 50 28 Z" fill="#D50032" stroke="#26272B" stroke-width="2.5" stroke-linejoin="round"/><path d="M44 27 L60 30" stroke="#26272B" stroke-width="3.5" stroke-linecap="round"/><rect x="29" y="15" width="6" height="6" fill="#fff"/>${mood==='angry'?'<path d="M20 31 L28 34 M44 31 L36 34" stroke="#26272B" stroke-width="2.5" stroke-linecap="round"/>':'<path d="M20 32 L28 31 M44 32 L36 31" stroke="#26272B" stroke-width="2" stroke-linecap="round"/>'}<circle cx="25" cy="37" r="2.3" fill="#26272B"/><circle cx="39" cy="37" r="2.3" fill="#26272B"/><path d="M19 47 Q25 41 32 45 Q39 41 45 47 Q38 51 32 48 Q26 51 19 47Z" fill="#8B9094" stroke="#26272B" stroke-width="2"/></svg>`;

// ---------- floaters, particles, speech ----------
const floaters = [], parts = []; let shakeT = 0;
function addFloat(x, y, s, color = C.ink, size = 26){ floaters.push({ x, y, s, color, t: 0, size }); }
function burst(x, y, n, colors, sp = 300, g = 900, r = [3, 7]){ for (let i = 0; i < n; i++){ const a = rnd(0, Math.PI*2), v = rnd(sp*.3, sp); parts.push({ x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v - sp*.3, g, t: 0, life: rnd(.5, 1.2), c: pick(colors), r: rnd(r[0], r[1]) }); } }
let speech = null;
function say(text, dur = 2.8, mood = 'ok'){ speech = { text, t: 0, dur, mood }; }
function updateFx(dt){
  for (let i = floaters.length - 1; i >= 0; i--){ const f = floaters[i]; f.t += dt; f.y -= 40*dt; if (f.t > 1.2) floaters.splice(i, 1); }
  for (let i = parts.length - 1; i >= 0; i--){ const p = parts[i]; p.t += dt; p.vy += p.g*dt; p.x += p.vx*dt; p.y += p.vy*dt; if (p.t > p.life) parts.splice(i, 1); }
  if (speech){ speech.t += dt; if (speech.t > speech.dur) speech = null; }
  shakeT = Math.max(0, shakeT - dt);
}
function drawFx(){
  for (const p of parts){ ctx.globalAlpha = clamp(1 - p.t/p.life, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.r/2, p.y - p.r/2, p.r, p.r); }
  ctx.globalAlpha = 1;
  for (const f of floaters){ ctx.globalAlpha = clamp(1.4 - f.t, 0, 1); txt(f.s, f.x, f.y, { size: f.size, kind: 'b', weight: 900, color: f.color, stroke: '#fff', sw: 6 }); }
  ctx.globalAlpha = 1;
}
function drawSpeech(){
  if (!speech) return;
  const pop = Math.min(1, speech.t * 6);
  ctx.save(); ctx.translate(0, (1 - pop) * 40);
  wrect(10, 806, 96, 144, '#fff', C.ink, 3);
  drawMikh(58, 958, .9, speech.mood);
  const lines = wrapText(speech.text, 380, 23);
  const bh = lines.length * 27 + 22, bx = 118, by = 930 - bh;
  ctx.beginPath(); wpoly([[bx, by], [bx + 410, by], [bx + 410, by + bh], [bx + 24, by + bh], [bx - 10, by + bh + 14], [bx + 8, by + bh - 4], [bx, by + bh - 4]], 1.2); paint('#fff', C.ink, 3);
  lines.forEach((l, i) => txt(l, bx + 14, by + 24 + i*27, { size: 23, kind: 'h', align: 'left', color: C.ink }));
  txt('тапни, чтобы закрыть', bx + 400, by + bh - 9, { size: 10, weight: 700, align: 'right', color: C.grey });
  txt('МИХАЛЫЧ, НАСТАВНИК', bx + 14, by - 10, { size: 11, weight: 900, align: 'left', color: C.red });
  ctx.restore();
}

// ---------- scene loop ----------
let scene = null, last = performance.now();
function setScene(s){ scene = s; s.init && s.init(); }
class Scene { constructor(){ this.t = 0; this.done = false; } finish(r){ if (this.done) return; this.done = true; const res = this.resolve; setTimeout(() => res && res(r), 10); } }
function play(s){ return new Promise(r => { s.resolve = r; setScene(s); }); }
function frame(ts){
  fit();
  let dt = Math.min(1/30, (ts - last) / 1000); last = ts; now += dt; boil = Math.floor(now * 7);
  if (scene){ scene.t += dt; scene.update && scene.update(dt); }
  updateFx(dt);
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  ctx.save();
  if (shakeT > 0) ctx.translate(rnd(-8, 8) * shakeT * 2, rnd(-8, 8) * shakeT * 2);
  ctx.clearRect(-20, -20, W + 40, H + 40);
  scene && scene.draw && scene.draw();
  drawFx(); drawSpeech();
  ctx.restore();
  requestAnimationFrame(frame);
}

// ---------- HUD ----------
const hPat = document.getElementById('hPat'), hBonus = document.getElementById('hBonus'), hClock = document.getElementById('hClock');
function hud(){ hPat.style.width = clamp(G.patience, 0, 100) + '%'; hBonus.textContent = G.bonus.toLocaleString('ru-RU') + ' ₽'; }
function hurt(n, x, y){ G.patience = clamp(G.patience - n, -1, 100); hud(); if (x != null) addFloat(x, y, '−' + n + ' терпения', C.red, 20); if (G.patience <= 0 && scene && !scene.done && scene.resolve) { SFX.sad(); hap('error'); scene.finish({ fired: true }); } }
function setClock(s){ hClock.textContent = s; }

// ---------- shared backdrop ----------
function drawWallBg(top = '#F3F4F5'){
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#E1E5E7'; ctx.lineWidth = 2;
  for (let y = 20; y < H; y += 40){ ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}
function drawPanel(x, y, w, h, title){ wrect(x, y, w, h, '#fff', C.ink, 3); if (title){ wrect(x, y, w, 28, C.red, C.ink, 3); txt(title, x + w/2, y + 15, { size: 14, weight: 900, color: '#fff' }); } }
function button(x, y, w, h, label, { fill = C.red, color = '#fff', size = 20, on = true } = {}){
  ctx.globalAlpha = on ? 1 : .4;
  wrect(x + 5, y + 5, w, h, C.ink, null); wrect(x, y, w, h, fill, C.ink, 3); txt(label, x + w/2, y + h/2 + 1, { size, weight: 900, color });
  ctx.globalAlpha = 1;
  return { x, y, w, h };
}
const hit = (b, x, y) => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

class IdleScene extends Scene {
  constructor(mood = 'ok'){ super(); this.mood = mood; }
  draw(){
    drawWallBg();
    // window + tanks behind
    wrect(40, 60, 460, 250, '#D8E6EE', C.ink, 3); for (let i = 1; i < 4; i++) wline(40 + i*115, 60, 40 + i*115, 310, C.ink, 2); wline(40, 185, 500, 185, C.ink, 2);
    for (let i = 0; i < 3; i++){ const x = 30 + i*170; wrect(x, 380, 140, 330, '#C9D0D3', C.ink, 3); ctx.beginPath(); ctx.ellipse(x + 70, 380, 70, 22, 0, Math.PI, 0); paint('#C9D0D3', C.ink, 3); wrect(x + 40, 450, 60, 60, C.red, C.ink, 2); wrect(x + 54, 464, 32, 32, '#fff', null); }
    ctx.fillStyle = C.floor; ctx.fillRect(0, 700, W, 260); wline(0, 700, W, 700, C.ink, 3);
    for (let x = -60; x < W; x += 90) wline(x + 60, 700, x, 960, '#A9B0B3', 2);
    drawWorker(170, 900, 2, this.mood, { wave: this.mood === 'ok' });
    drawMikh(380, 905, 2, this.mood === 'sad' ? 'angry' : 'ok');
  }
}
