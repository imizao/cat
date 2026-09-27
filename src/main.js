import './styles/main.css';
import { Game } from './core/Game.js';
import { runSelfTests } from './debug/selfTest.js';
import { enableOfflineMode } from './core/OfflineManager.js';

const game = new Game(document.querySelector('#app'));
window.moonpaw = { game, selfTest: runSelfTests };
window.addEventListener('pagehide', () => game.destroy(), { once: true });
if (new URLSearchParams(location.search).get('debug') === '1') runSelfTests();
enableOfflineMode()
  .then((offline) => { window.moonpaw.offline = offline; })
  .catch((error) => console.warn('Offline mode unavailable:', error));
