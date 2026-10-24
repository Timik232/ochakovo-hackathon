// ================= TELEGRAM MINI APP LAYER =================
// Everything here degrades gracefully: outside Telegram the game runs as a plain mobile web page.
const CONFIG = {
  apiBase: '',                                   // same origin as server.js; set a full URL if the API lives elsewhere
  shareUrl: 'https://t.me/Ochakovo_hackathon_bot/play',  // direct link to the Mini App (BotFather → /newapp), used for "Позвать друга"
  hrEmail: 'rabota@ochakovo.ru'
};
const TG = (window.Telegram && window.Telegram.WebApp) || null;
const inTG = !!(TG && TG.initData);
const tgv = v => { try { return inTG && TG.isVersionAtLeast(v); } catch (e) { return false; } };

function hap(kind){
  if (!tgv('6.1') || !TG.HapticFeedback) return;
  try {
    if (kind === 'success' || kind === 'error' || kind === 'warning') TG.HapticFeedback.notificationOccurred(kind);
    else if (kind === 'select') TG.HapticFeedback.selectionChanged();
    else TG.HapticFeedback.impactOccurred(kind || 'light');
  } catch (e) {}
}

function tgInit(){
  document.documentElement.classList.toggle('in-tg', inTG);
  if (!inTG) return;
  try { TG.ready(); TG.expand(); } catch (e) {}
  const safe = fn => { try { fn(); } catch (e) {} };
  if (tgv('6.9')){ safe(() => TG.setHeaderColor('#D50032')); safe(() => TG.setBackgroundColor('#EDEFF0')); }
  if (tgv('7.10')) safe(() => TG.setBottomBarColor('#FFFFFF'));
  if (tgv('7.7')) safe(() => TG.disableVerticalSwipes());   // otherwise drags in the climb level close the app
  if (tgv('8.0')) safe(() => TG.lockOrientation());
}

function tgUserName(){
  try { const u = TG.initDataUnsafe.user; return [u.first_name, u.last_name].filter(Boolean).join(' ').slice(0, 24); } catch (e) { return ''; }
}

// ---- native bottom button, mirrored from the primary button of the current card ----
let mainHandler = null;
function mainOff(){
  if (!inTG || !TG.MainButton) return;
  try { if (mainHandler) TG.MainButton.offClick(mainHandler); TG.MainButton.hide(); } catch (e) {}
  mainHandler = null;
}
function mainFor(btn){
  mainOff();
  if (!inTG || !TG.MainButton || !btn) return;
  btn.classList.add('tg-mirrored');
  mainHandler = () => { mainOff(); btn.click(); };
  try {
    const p = { text: btn.textContent.trim(), color: '#D50032', text_color: '#FFFFFF', is_active: true, is_visible: true };
    if (tgv('7.10')) p.has_shine_effect = true;
    TG.MainButton.setParams(p); TG.MainButton.onClick(mainHandler);
  } catch (e) {}
}
function mainAction(text, fn){
  mainOff();
  if (!inTG || !TG.MainButton) return false;
  mainHandler = fn;
  try { TG.MainButton.setParams({ text, color: '#D50032', text_color: '#FFFFFF', is_active: true, is_visible: true }); TG.MainButton.onClick(mainHandler); } catch (e) { return false; }
  return true;
}
function closingGuard(on){ if (!inTG) return; try { on ? TG.enableClosingConfirmation() : TG.disableClosingConfirmation(); } catch (e) {} }

// ---- links: keep the user inside Telegram ----
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href^="http"]');
  if (!a || !inTG) return;
  e.preventDefault();
  const url = a.href;
  try { if (/^https:\/\/t\.me\//.test(url)) TG.openTelegramLink(url); else TG.openLink(url); } catch (err) { window.open(url, '_blank'); }
});

function shareResult(text){
  const url = 'https://t.me/share/url?url=' + encodeURIComponent(CONFIG.shareUrl) + '&text=' + encodeURIComponent(text);
  if (inTG){ try { TG.openTelegramLink(url); return; } catch (e) {} }
  window.open(url, '_blank', 'noopener');
}

function askPhone(){
  return new Promise(res => {
    if (!tgv('6.9')) return res(null);
    try {
      TG.requestContact((ok, r) => {
        const ph = ok && r && r.responseUnsafe && r.responseUnsafe.contact && r.responseUnsafe.contact.phone_number;
        res(ph ? (String(ph).startsWith('+') ? ph : '+' + ph) : null);
      });
    } catch (e) { res(null); }
  });
}

async function api(path, body){
  const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Init-Data': inTG ? TG.initData : '' }, body: JSON.stringify(body) }
                   : { headers: { 'X-Init-Data': inTG ? TG.initData : '' } };
  const r = await fetch(CONFIG.apiBase + path, opt);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || ('HTTP ' + r.status)), { status: r.status, body: j });
  return j;
}
tgInit();
