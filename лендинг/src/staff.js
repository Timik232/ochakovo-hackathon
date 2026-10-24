// Шапка и вход для страниц сотрудников.
'use strict';

function staffHeader(current) {
  const links = [[LINK.staff, 'Анкета от сотрудника'], [LINK.candidates, 'Кандидаты'], [LINK.form, 'Форма для кандидата']];
  return `<div class="staffbar"><header class="top">
    <a href="${LINK.candidates}" aria-label="К списку кандидатов"><img class="logo" src="img/logo.png" alt="Очаково"></a>
    <nav>${links.map(([h, t]) => `<a href="${h}"${h === LINK[current] ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
    <a href="#" id="logout">Выйти</a></nav></header></div>`;
}

const LOGIN_CSS = `.gate{min-height:70vh;display:grid;place-items:center;padding:24px}
.gate form{width:min(420px,100%);padding:28px;display:flex;flex-direction:column;gap:18px}
.gate h1{font-size:30px}`;

async function requireStaff(current) {
  document.body.insertAdjacentHTML('afterbegin', staffHeader(current));
  $('#logout').addEventListener('click', async e => { e.preventDefault(); await api('POST', '/api/logout').catch(() => {}); location.reload(); });
  const { staff } = await api('GET', '/api/me').catch(() => ({ staff: false }));
  if (staff) return true;
  $('#logout').hidden = true;
  const main = $('main'); main.hidden = true;
  const style = document.createElement('style'); style.textContent = LOGIN_CSS; document.head.append(style);
  main.insertAdjacentHTML('beforebegin', `<section class="gate"><form class="card" id="login">
    <p class="kicker">Только для сотрудников</p><h1 class="comic">Вход <span class="r">для HR</span></h1>
    <label class="field"><span>Пароль</span><input type="password" name="password" autocomplete="current-password" required autofocus><em class="err"></em></label>
    <button class="btn">Войти</button></form></section>`);
  return new Promise(resolve => {
    $('#login').addEventListener('submit', async e => {
      e.preventDefault();
      try { await api('POST', '/api/login', { password: e.target.password.value }); $('.gate').remove(); main.hidden = false; $('#logout').hidden = false; resolve(true); }
      catch (err) { showErrors(e.target, { password: err.message }); }
    });
  });
}
