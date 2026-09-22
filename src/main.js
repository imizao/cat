import './styles/main.css';
import { Game } from './core/Game.js';
import { runSelfTests } from './debug/selfTest.js';

const game = new Game(document.querySelector('#app'));
window.moonpaw = { game, selfTest: runSelfTests };
if (new URLSearchParams(location.search).get('debug') === '1') runSelfTests();
