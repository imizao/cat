import './simulator.css';

const SESSION_KEY = 'moonpaw-simulator-auth';
const EXPECTED_FINGERPRINT = 'dbcb43bc';
const root = document.querySelector('#simulator-app');

function fingerprint(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

async function loadConsole() {
  const { SimulatorApp } = await import('./SimulatorApp.js');
  new SimulatorApp(root, () => {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
  });
}

function showLogin() {
  root.innerHTML = `
    <main class="login-shell">
      <section class="login-panel">
        <div class="admin-mark">内</div>
        <span class="overline">MOONPAW INTERNAL</span>
        <h1>自动爬塔<br>模拟控制台</h1>
        <p>该入口不与正式游戏页面互通。</p>
        <form data-login>
          <label>账号<input name="username" autocomplete="username" required /></label>
          <label>密码<input name="password" type="password" autocomplete="current-password" required /></label>
          <button type="submit">验证身份</button>
          <small data-error aria-live="polite"></small>
        </form>
      </section>
      <aside class="login-aside"><b>∞</b><span>批量运行真实战斗规则<br>观察构筑与难度曲线</span></aside>
    </main>`;
  const form = root.querySelector('[data-login]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const value = `${String(values.get('username')).trim()}:${String(values.get('password'))}`;
    if (fingerprint(value) !== EXPECTED_FINGERPRINT) {
      root.querySelector('[data-error]').textContent = '账号或密码不正确';
      form.querySelector('input[name="password"]').value = '';
      return;
    }
    sessionStorage.setItem(SESSION_KEY, 'verified');
    await loadConsole();
  });
}

if (sessionStorage.getItem(SESSION_KEY) === 'verified') loadConsole();
else showLogin();
