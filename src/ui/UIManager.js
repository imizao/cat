import { cats } from '../data/cats.js';
import { skills } from '../data/skills.js';
import { buffs } from '../data/buffs.js';
import { relics } from '../data/relics.js';
import { scaleSkillEffect, skillGrowthBonus } from '../systems/SkillGrowth.js';
import { mutationForSkill } from '../data/mutations.js';
import { PixiUILayer } from '../render/PixiUILayer.js';

const floorNames = { BATTLE: '寻常层', ELITE: '凶险层', REST: '月台', SHOP: '猫市', EVENT: '奇遇', TREASURE: '秘藏', BOSS: '镇层者' };

export class UIManager {
  constructor(root, events, debugEnabled) {
    this.events = events; this.debugEnabled = debugEnabled;
    root.innerHTML = `
      <main class="game-shell">
        <div class="scene" data-ref="scene"></div>
        <div class="vignette"></div>
        <header class="hud top-hud">
          <div><span class="eyebrow">月爪天塔</span><strong data-ref="floor">塔基</strong></div>
          <div class="resources"><span>🐟 <b data-ref="currency">0</b></span><span>✦ <b data-ref="essence">0</b></span><button class="sound-toggle" data-ref="sound" data-action="sound" aria-label="关闭声音" title="关闭声音">🔊</button></div>
        </header>
        <aside class="weekly"><span>本周法则</span><b data-ref="weekly">月潮</b></aside>
        <section class="battle-arena is-hidden" data-ref="battleArena">
          <div class="floor-objective"><span data-ref="battleKind">寻常层</span><b>击退守层猫客</b></div>
          <button class="battle-view-toggle" data-ref="battleView" data-action="view" aria-label="切换战斗视角，当前正面" title="切换战斗视角">视角 · 正面</button>
          <button class="auto-combo-toggle" data-ref="autoCombo" data-action="autoCombo" aria-pressed="false" aria-label="辅助技能后自动攻击和追击，当前关闭" title="辅助技能后自动完成攻击与追击"><span>□</span> 攻击+追击</button>
          <div class="enemy-seats" data-ref="enemySeats"></div>
        </section>
        <section class="player-dock is-hidden" data-ref="playerDock">
          <div class="player-stats">
            <span class="portrait" data-ref="portrait">🐈</span>
            <div class="identity"><b data-ref="catName"></b><small data-ref="passive"></small></div>
            <div class="stat"><span>生命</span><b data-ref="playerHp"></b></div>
            <div class="stat" data-ref="energyStat"><span data-ref="energyLabel">能量</span><b data-ref="energy"></b></div>
            <div class="stat shield"><span>护盾</span><b data-ref="shield"></b></div>
          </div>
          <div class="buff-line" data-ref="playerBuffs"></div>
          <div class="skills" data-ref="skills"></div>
        </section>
        <section class="center-action is-hidden" data-ref="centerAction"></section>
        <div class="combat-fx" data-ref="combatFx"><span data-ref="skillCallout"></span></div>
        <section class="overlay start-screen" data-ref="overlay"></section>
        <div class="toast-layer" data-ref="toasts"></div>
        <div class="debug is-hidden" data-ref="debug"></div>
      </main>`;
    this.root = root;
    this.refs = Object.fromEntries([...root.querySelectorAll('[data-ref]')].map((el) => [el.dataset.ref, el]));
    this.pixi = new PixiUILayer(this.refs.scene, root, events);
    this.refs.debug.classList.toggle('is-hidden', !debugEnabled);
    this.onClick = (event) => {
      const action = event.target.closest('[data-action]');
      if (action && !action.disabled) this.events.emit('ui:action', { action: action.dataset.action, value: action.dataset.value });
    };
    root.addEventListener('click', this.onClick);
    let touchY = 0;
    this.onTouchStart = (event) => { touchY = event.touches[0].clientY; };
    this.onTouchEnd = (event) => { if (touchY - event.changedTouches[0].clientY > 70) this.events.emit('ui:action', { action: 'climb' }); };
    root.addEventListener('touchstart', this.onTouchStart, { passive: true });
    root.addEventListener('touchend', this.onTouchEnd, { passive: true });
  }
  showStart(hasSave) {
    this.refs.overlay.className = 'overlay start-screen';
    this.refs.overlay.innerHTML = `<div class="brand-mark">ฅ</div><p class="kicker">向月而行 · 永无塔顶</p><h1>月爪<br><em>天塔</em></h1><p class="intro">猫客环阵，一爪定回合。</p><div class="start-actions">${hasSave ? '<button class="primary" data-action="continue">继续登塔</button>' : ''}<button class="ghost" data-action="new">新游戏</button>${hasSave ? '<button class="text-button" data-action="reset">重置存档</button>' : ''}</div>`;
    this.pixi.showOverlay({ visible: true, kind: 'start', hasSave });
  }
  showCatSelect() {
    this.refs.overlay.className = 'overlay select-screen';
    this.refs.overlay.innerHTML = `<div class="select-head"><span>选择旅伴</span><h2>哪一双爪，<br>叩响第一重门？</h2></div><div class="cat-list">${cats.map((cat) => `<button class="cat-choice" data-action="selectCat" data-value="${cat.id}" style="--cat:${cat.color}"><span class="cat-emoji">${cat.emoji}</span><span><b>${cat.name}</b><small>${cat.epithet}</small><i>${cat.maxHp}♥ · ${cat.maxEnergy}⚡ · ${cat.passive.name}</i></span><em>›</em></button>`).join('')}</div>`;
    this.pixi.showOverlay({ visible: true, kind: 'cats', cats: cats.map((cat) => ({ ...cat, passive: cat.passive.name })) });
  }
  hideOverlay() { this.refs.overlay.className = 'overlay is-hidden'; this.pixi.showOverlay({ visible: false }); }
  showPlayer(player, cat) {
    this.currentCat = cat;
    this.refs.playerDock.classList.remove('is-hidden'); this.refs.portrait.textContent = cat.emoji;
    this.refs.catName.textContent = cat.name; this.refs.passive.textContent = cat.passive.name;
    this.renderSkills(player); this.updatePlayer(player);
  }
  updateHud(game) {
    this.refs.floor.textContent = game.currentFloor ? `${game.currentFloor} 层` : '塔基';
    this.refs.currency.textContent = game.currency; this.refs.essence.textContent = game.essence;
    this.pixi.updateHud({ floor: this.refs.floor.textContent, currency: game.currency, essence: game.essence, weekly: this.refs.weekly.textContent });
  }
  setSound(enabled) {
    this.refs.sound.textContent = enabled ? '🔊' : '🔇';
    this.refs.sound.setAttribute('aria-label', enabled ? '关闭声音' : '开启声音');
    this.refs.sound.title = enabled ? '关闭声音' : '开启声音';
    this.refs.sound.classList.toggle('is-muted', !enabled);
  }
  updatePlayer(player, battle) {
    this.refs.playerHp.textContent = `${player.hp}/${player.maxHp}`; this.refs.energy.textContent = `${player.energy}/${player.maxEnergy}`; this.refs.shield.textContent = player.shield || '—';
    const pursuit = battle?.state?.phase === 'PLAYER_TURN' && battle.state.pursuitReady;
    const fallback = battle?.state?.phase === 'PLAYER_TURN' && player.energy === 0 && battle.state.offensiveActionsUsed === 0;
    this.refs.energyLabel.textContent = pursuit ? '能量 · 可追击' : fallback ? '能量 · 保底爪击' : '能量'; this.refs.energyStat.classList.toggle('is-pursuit', pursuit || fallback);
    this.refs.playerBuffs.innerHTML = this.buffHTML(player.buffs);
    if (battle) this.renderSkills(player, battle);
    this.pixi.updatePlayer(this.playerView(player, battle));
  }
  renderSkills(player, battle = null) {
    this.refs.skills.innerHTML = player.skills.map((id) => {
      const skill = skills[id]; const cost = battle ? battle.skillSystem.cost(id, player, battle.state) : skill.cost;
      const disabled = !battle || battle.state?.phase !== 'PLAYER_TURN' || battle.state?.comboRunning || !battle.skillSystem.canUse(id, player, battle.state);
      const support = skill.effects.every((effect) => effect.type !== 'damage');
      const level = player.skillUpgrades[id] || 0;
      const bonus = skillGrowthBonus(level);
      const mutation = mutationForSkill(player, id);
      return `<button class="skill" data-action="skill" data-value="${id}" ${disabled ? 'disabled' : ''}><span>${skill.icon}</span><b>${skill.name}${level ? `<sup>Lv.${level}${bonus !== level ? ` · +${bonus}` : ''}</sup>` : ''}</b>${mutation ? `<mark>${mutation.name}</mark>` : ''}<small>${this.skillDescription(skill, level)}${support ? ' · 辅助' : ''}</small><em>${cost}⚡</em></button>`;
    }).join('');
  }
  playerView(player, battle) {
    const pursuit = battle?.state?.phase === 'PLAYER_TURN' && battle.state.pursuitReady;
    const fallback = battle?.state?.phase === 'PLAYER_TURN' && player.energy === 0 && battle.state.offensiveActionsUsed === 0;
    return {
      visible: !this.refs.playerDock.classList.contains('is-hidden'), icon: this.currentCat?.emoji || '🐈',
      name: this.currentCat?.name || '', passive: this.currentCat?.passive?.name || '',
      hp: player.hp, maxHp: player.maxHp, energy: player.energy, maxEnergy: player.maxEnergy,
      energyLabel: pursuit ? '可追击' : fallback ? '保底爪击' : '能量', shield: player.shield,
      buffs: this.refs.playerBuffs.textContent.trim(),
      skills: player.skills.map((id) => {
        const skill = skills[id]; const level = player.skillUpgrades[id] || 0;
        const support = skill.effects.every((effect) => effect.type !== 'damage');
        return {
          icon: skill.icon, name: `${skill.name}${level ? ` Lv.${level}` : ''}`,
          description: `${this.skillDescription(skill, level)}${support ? ' · 辅助' : ''}`,
          cost: battle ? battle.skillSystem.cost(id, player, battle.state) : skill.cost,
          disabled: !battle || battle.state?.phase !== 'PLAYER_TURN' || battle.state?.comboRunning || !battle.skillSystem.canUse(id, player, battle.state),
          mutation: mutationForSkill(player, id)?.name || ''
        };
      })
    };
  }
  skillDescription(skill, level) {
    return skill.effects.map((effect) => {
      const scaled = scaleSkillEffect(effect, level);
      if (scaled.type === 'damage') return `${scaled.value}伤`;
      if (scaled.type === 'heal') return `回复${scaled.value}血`;
      if (scaled.type === 'shield') return `${scaled.value}盾`;
      if (scaled.type === 'gainEnergy') return `${scaled.value}能量`;
      if (scaled.type === 'loseEnergy') return `削减${scaled.value}能量`;
      if (scaled.type === 'applyBuff') return `${buffs[scaled.buffId]?.name || scaled.buffId}${scaled.stacks}层${scaled.duration ? `·${scaled.duration}回合` : ''}`;
      return '';
    }).filter(Boolean).join('，');
  }
  showEnemies(enemies, state, kind) {
    this.refs.battleArena.classList.remove('is-hidden');
    this.refs.battleKind.textContent = kind;
    this.updateEnemies(enemies, state);
  }
  setBattleView(label) {
    this.refs.battleView.textContent = `视角 · ${label}`;
    this.refs.battleView.setAttribute('aria-label', `切换战斗视角，当前${label}`);
  }
  setAutoCombo(enabled, running = false) {
    this.refs.autoCombo.classList.toggle('is-active', enabled);
    this.refs.autoCombo.classList.toggle('is-running', running);
    this.refs.autoCombo.setAttribute('aria-pressed', String(enabled));
    this.refs.autoCombo.setAttribute('aria-label', `辅助技能后自动攻击和追击，当前${enabled ? '开启' : '关闭'}`);
    this.refs.autoCombo.innerHTML = `<span>${enabled ? '✓' : '□'}</span> ${running ? '连击中' : '攻击+追击'}`;
  }
  updateEnemies(enemies, state) {
    this.refs.enemySeats.innerHTML = enemies.map((enemy, index) => {
      const selected = state.phase === 'PLAYER_TURN' && state.selectedEnemyIndex === index;
      const recommended = state.phase === 'PLAYER_TURN' && state.recommendedEnemyIndex === index;
      const active = state.phase === 'ENEMY_TURN' && state.activeActorIndex === index + 1;
      const intent = state.intents?.[index]?.label || '—';
      return `<button class="enemy-seat seat-${index + 1}${selected ? ' is-target' : ''}${recommended ? ' is-recommended' : ''}${active ? ' is-active' : ''}${enemy.hp <= 0 ? ' is-defeated' : ''}" data-action="target" data-value="${index}" ${enemy.hp <= 0 ? 'disabled' : ''} style="--enemy:${enemy.color}" ${recommended ? `title="${state.recommendationReason}" aria-label="推荐攻击 ${enemy.name}：${state.recommendationReason}"` : ''}>
        <span class="seat-no">${index + 2}</span><span class="enemy-avatar">${enemy.icon}</span>
        <span class="enemy-copy"><small>${enemy.title || '守层猫客'}${enemy.combatTier ? ` · 战阶${enemy.combatTier}` : ''}</small><b>${enemy.name}</b></span>
        <span class="enemy-intent">${intent}</span>
        <span class="mini-bar"><i style="width:${Math.max(0, enemy.hp / enemy.maxHp * 100)}%"></i></span>
        <span class="enemy-health">${enemy.hp}/${enemy.maxHp}${enemy.shield ? ` · ${enemy.shield}盾` : ''}</span>
      </button>`;
    }).join('');
    this.pixi.updateEnemies({
      visible: !this.refs.battleArena.classList.contains('is-hidden'),
      enemies: enemies.map((enemy, index) => ({
        icon: enemy.icon, color: enemy.color, name: enemy.name,
        title: `${enemy.title || '守层猫客'}${enemy.combatTier ? ` · 战阶${enemy.combatTier}` : ''}`,
        intent: state.intents?.[index]?.label || '—', ratio: Math.max(0, enemy.hp / enemy.maxHp),
        health: `${enemy.hp}/${enemy.maxHp}${enemy.shield ? ` · ${enemy.shield}盾` : ''}`,
        selected: state.phase === 'PLAYER_TURN' && state.selectedEnemyIndex === index,
        recommended: state.phase === 'PLAYER_TURN' && state.recommendedEnemyIndex === index,
        active: state.phase === 'ENEMY_TURN' && state.activeActorIndex === index + 1,
        defeated: enemy.hp <= 0
      }))
    });
  }
  hideEnemies() { this.refs.battleArena.classList.add('is-hidden'); this.pixi.updateEnemies({ visible: false, enemies: [] }); }
  showSkill(skill) {
    if (this.pixi.ready) { this.pixi.showSkill(skill); return; }
    const callout = this.refs.skillCallout;
    callout.innerHTML = `<i>${skill.icon}</i><b>${skill.name}</b>`;
    callout.classList.remove('is-casting');
    void callout.offsetWidth;
    callout.classList.add('is-casting');
  }
  impact(strong = false) {
    this.pixi.impact(strong);
    const shell = this.root.querySelector('.game-shell');
    shell.classList.remove('has-impact', 'has-heavy-impact');
    void shell.offsetWidth;
    shell.classList.add(strong ? 'has-heavy-impact' : 'has-impact');
  }
  buffHTML(list = []) { return list.map((item) => `<span>${buffs[item.id]?.name || item.id} ${item.stacks}</span>`).join(''); }
  showClimb() { this.refs.centerAction.classList.remove('is-hidden'); this.refs.centerAction.innerHTML = `<p>塔门已开</p><button data-action="climb">登上一层 <span>↑</span></button><small>也可以向上滑动</small>`; this.pixi.showCenter({ visible: true, kind: 'climb', title: '塔门已开', label: '登上一层  ↑', hint: '也可以向上滑动' }); }
  hideCenterAction() { this.refs.centerAction.classList.add('is-hidden'); this.pixi.showCenter({ visible: false }); }
  showFloorMoment(title, copy, action = 'leaveFloor', label = '继续向上') {
    this.refs.centerAction.classList.remove('is-hidden');
    this.refs.centerAction.innerHTML = `<div class="moment"><span>✦</span><h2>${title}</h2><p>${copy}</p><button data-action="${action}">${label}</button></div>`;
    this.pixi.showCenter({ visible: true, kind: 'moment', title, copy, label });
  }
  showRewards(rewards, title = '取一缕塔光') {
    this.refs.overlay.className = 'overlay reward-screen';
    this.refs.overlay.innerHTML = `<div class="reward-heading"><span>三选一</span><h2>${title}</h2><p>选择会留在这次旅途中</p></div><div class="reward-list">${rewards.map((reward, i) => `<button class="${reward.kind === 'mutation' ? 'is-mutation' : ''}" data-action="reward" data-value="${i}" style="--delay:${i * 70}ms"><span>${reward.icon}</span><b>${reward.name}${reward.kind === 'mutation' ? '<i>变式</i>' : ''}</b><small>${reward.description}</small></button>`).join('')}</div>`;
    this.pixi.showOverlay({ visible: true, kind: 'reward', title, rewards: rewards.map((reward) => ({ ...reward, mutation: reward.kind === 'mutation' })) });
  }
  showDefeat(floor) {
    this.refs.overlay.className = 'overlay defeat-screen';
    this.refs.overlay.innerHTML = `<span class="defeat-paw">爪</span><h2>月色暗了一瞬</h2><p>止步于第 ${floor} 层</p><button class="primary" data-action="new">重新出发</button>`;
    this.pixi.showOverlay({ visible: true, kind: 'defeat', floor });
  }
  showRewardResult(reward, before, after) {
    const changes = [];
    if (before.hp !== after.hp || before.maxHp !== after.maxHp) changes.push(`<span class="health">生命 <b>${before.hp}/${before.maxHp}</b><i>→</i><strong>${after.hp}/${after.maxHp}</strong></span>`);
    if (before.energy !== after.energy || before.maxEnergy !== after.maxEnergy) changes.push(`<span class="energy">能量 <b>${before.energy}/${before.maxEnergy}</b><i>→</i><strong>${after.energy}/${after.maxEnergy}</strong></span>`);
    if (before.heartGuard !== after.heartGuard) changes.push(`<span class="shield">开战护盾 <b>${before.heartGuard}</b><i>→</i><strong>${after.heartGuard}</strong></span>`);
    const node = document.createElement('div'); node.className = 'reward-result';
    node.innerHTML = `<em>${reward.icon}</em><small>已获得</small><h3>${reward.name}</h3><div>${changes.join('') || `<span class="effect">${reward.description}</span>`}</div>`;
    this.refs.toasts.appendChild(node);
    node.addEventListener('animationend', () => node.remove(), { once: true });
  }
  showResourceGain(label, amount, current, maximum) {
    if (!amount) return;
    const node = document.createElement('div'); node.className = 'resource-gain';
    node.innerHTML = `<span>♥</span><p><small>${label} +${amount}</small><b>${current}/${maximum}</b></p>`;
    this.refs.toasts.appendChild(node);
    node.addEventListener('animationend', () => node.remove(), { once: true });
  }
  float(text, kind = '', enemyIndex = null) {
    if (this.pixi.ready) { this.pixi.float(text, kind, enemyIndex); return; }
    const node = document.createElement('span'); node.className = `float-text ${kind}`; node.textContent = text;
    const positions = [{ x: 78, y: 38 }, { x: 50, y: 27 }, { x: 22, y: 38 }];
    const position = enemyIndex === null ? { x: 50, y: 64 } : positions[enemyIndex];
    node.style.setProperty('--x', `${position.x}%`); node.style.setProperty('--y', `${position.y}%`); this.refs.toasts.appendChild(node);
    node.addEventListener('animationend', () => node.remove(), { once: true });
  }
  updateDebug({ fps, floor, objects, active }) { this.refs.debug.textContent = `FPS ${fps}\nFloor ${floor}\nObjects ${objects}\nActive floors ${active}`; }
  floorName(type) { return floorNames[type] || type; }
  relicText(player) { return player.relics.map((id) => relics[id]?.name).filter(Boolean).join(' · '); }
  destroy() {
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('touchstart', this.onTouchStart);
    this.root.removeEventListener('touchend', this.onTouchEnd);
    this.pixi.destroy();
  }
}
