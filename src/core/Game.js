import { EventBus } from './EventBus.js';
import { AnimationManager } from './AnimationManager.js';
import { AudioManager } from './AudioManager.js';
import { getCat } from '../data/cats.js';
import { weeklyModifier } from '../data/weekly.js';
import { FloorType } from '../tower/FloorGenerator.js';
import { TowerSystem } from '../tower/TowerSystem.js';
import { SceneManager } from '../render/SceneManager.js';
import { ActorRenderer } from '../render/ActorRenderer.js';
import { TowerInterior } from '../render/TowerInterior.js';
import { BattleSystem, BattlePhase } from '../battle/BattleSystem.js';
import { createEnemyParty } from '../systems/EncounterSystem.js';
import { RewardSystem } from '../systems/RewardSystem.js';
import { RelicSystem } from '../systems/RelicSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { UIManager } from '../ui/UIManager.js';
import { gainHealth } from '../systems/ResourceRules.js';

const AUTO_COMBO_KEY = 'moonpaw-auto-combo';

export class Game {
  constructor(root) {
    this.events = new EventBus(); this.animations = new AnimationManager(); this.saveSystem = new SaveSystem();
    this.debugEnabled = new URLSearchParams(location.search).get('debug') === '1';
    this.ui = new UIManager(root, this.events, this.debugEnabled);
    this.autoCombo = localStorage.getItem(AUTO_COMBO_KEY) === '1';
    this.ui.setAutoCombo(this.autoCombo);
    this.audio = new AudioManager(this.events);
    this.ui.setSound(this.audio.enabled);
    this.scene = new SceneManager(this.ui.refs.scene, this.animations, this.ui.pixi, this.events);
    this.interior = new TowerInterior(this.scene.scene, this.animations);
    this.actors = new ActorRenderer(this.scene.scene, this.events, this.animations);
    this.mode = 'MENU'; this.currentRewards = [];
    this.bindEvents();
    this.ui.showStart(this.saveSystem.hasSave());
    this.scene.start((delta, elapsed) => this.update(delta, elapsed));
  }
  bindEvents() {
    this.events.on('ui:action', ({ action, value }) => this.handleAction(action, value));
    this.events.on('audio:state', ({ enabled }) => this.ui.setSound(enabled));
    this.events.on('battle:update', (state) => { this.ui.updatePlayer(this.player, this.battle); this.ui.updateEnemies(state.enemies, state); });
    this.events.on('skill:cast', ({ skill }) => this.ui.showSkill(skill));
    this.events.on('combat:impact', ({ strong }) => this.ui.impact(strong));
    this.events.on('enemy:damage', ({ target, hpLoss, absorbed, visualDelay = 0 }) => this.afterVisual(visualDelay, () => this.ui.float(hpLoss ? `-${hpLoss}` : `挡 ${absorbed}`, 'damage', target?.encounterIndex)));
    this.events.on('enemy:heal', ({ target, amount }) => { if (amount) this.ui.float(`+${amount}`, 'heal', target?.encounterIndex); });
    this.events.on('enemy:shield', ({ target, amount }) => { if (amount) this.ui.float(`+${amount}盾`, 'shield-float', target?.encounterIndex); });
    this.events.on('player:damage', ({ hpLoss, absorbed, visualDelay = 0 }) => { this.afterVisual(visualDelay, () => this.ui.float(hpLoss ? `-${hpLoss}` : `挡 ${absorbed}`, 'damage')); this.ui.updatePlayer(this.player, this.battle); });
    this.events.on('player:energy', ({ amount, visualDelay = 0 }) => { this.afterVisual(visualDelay, () => this.ui.float(`+${amount}能量`, 'energy-float')); this.ui.updatePlayer(this.player, this.battle); });
    this.events.on('player:heal', ({ amount }) => { if (amount) this.ui.float(`+${amount}`, 'heal'); });
    this.events.on('player:shield', ({ amount }) => this.ui.float(`+${amount}盾`, 'shield-float'));
    this.events.on('mutation:trigger', ({ mutation, target }) => this.ui.float(`✧ ${mutation.name}`, 'mutation-float', target?.encounterIndex ?? null));
    this.events.on('battle:end', () => this.onVictory());
    this.events.on('battle:defeat', () => {
      this.mode = 'DEFEAT'; this.saveSystem.reset();
      this.animations.tween({ duration: 720, update: () => {}, complete: () => { this.leaveBattleScene(); this.ui.showDefeat(this.currentFloor); } });
    });
  }
  afterVisual(delay, callback) {
    if (!delay) { callback(); return; }
    this.animations.tween({ duration: delay, update: () => {}, complete: callback });
  }
  handleAction(action, value) {
    if (action === 'new') { this.saveSystem.reset(); this.ui.showCatSelect(); return; }
    if (action === 'reset') { this.saveSystem.reset(); this.ui.showStart(false); return; }
    if (action === 'continue') { const saved = this.saveSystem.load(); if (saved) this.startRun(saved); return; }
    if (action === 'selectCat') { this.startRun(this.createRun(value)); return; }
    if (action === 'climb' && this.mode === 'READY') this.enterFloor(this.currentFloor + 1);
    if (action === 'skill' && this.mode === 'BATTLE') {
      if (this.battle.state.comboRunning) return;
      const support = this.battle.skillSystem.isSupport(value);
      if (this.battle.useSkill(value)) {
        if (this.autoCombo && support && this.battle.state.phase === BattlePhase.PLAYER_TURN) this.runAutoCombo();
        else if (this.battle.state.phase === BattlePhase.ENEMY_TURN) this.runEnemySequence();
      }
    }
    if (action === 'autoCombo') this.setAutoCombo(!this.autoCombo);
    if (action === 'view' && this.mode === 'BATTLE') this.ui.setBattleView(this.scene.cycleBattleView().label);
    if (action === 'target' && this.mode === 'BATTLE') this.battle.selectTarget(Number(value));
    if (action === 'reward' && this.mode === 'REWARD') this.chooseReward(Number(value));
    if (action === 'leaveFloor' && this.mode === 'MOMENT') this.enterFloor(this.currentFloor + 1);
  }
  createRun(catId) {
    const cat = getCat(catId); const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    return { version: 1, worldSeed: seed, currentFloor: 0, currency: 0, essence: 0, catId, player: { hp: cat.maxHp, maxHp: cat.maxHp, energy: cat.maxEnergy, maxEnergy: cat.maxEnergy, baseMaxEnergy: cat.maxEnergy, heartGuard: 0, shield: 0, passiveId: cat.passive.id, skills: [...cat.skills], skillUpgrades: {}, costModifiers: {}, relics: [], mutations: [], buffs: [] } };
  }
  startRun(data) {
    this.worldSeed = data.worldSeed; this.currentFloor = data.currentFloor; this.currency = data.currency || 0; this.essence = data.essence || 0;
    this.cat = getCat(data.catId); this.player = { ...data.player, baseMaxEnergy: data.player.baseMaxEnergy || this.cat.maxEnergy, heartGuard: data.player.heartGuard || 0, mutations: data.player.mutations || [], buffs: [], shield: 0, energy: Number.isFinite(data.player.energy) ? data.player.energy : data.player.maxEnergy };
    this.relics = new RelicSystem(); this.rewards = new RewardSystem(this.worldSeed);
    this.battle = new BattleSystem(this.events, this.relics, weeklyModifier);
    if (this.tower) this.scene.scene.remove(this.tower.root);
    this.tower = new TowerSystem(this.scene.scene, this.events, this.animations, this.worldSeed); this.tower.bind(this.currentFloor);
    this.actors.showPlayer(this.cat.color); this.actors.setPlayerVisible(false); this.actors.hideEnemies();
    this.interior.hide(); this.scene.setView('tower');
    this.ui.hideOverlay(); this.ui.showPlayer(this.player, this.cat); this.ui.updateHud(this); this.ui.hideEnemies();
    if (this.currentFloor === 0) { this.mode = 'READY'; this.ui.showClimb(); }
    else this.resolveFloor(this.tower.getFloor(this.currentFloor), true);
  }
  enterFloor(index) {
    if (this.tower.moving || this.mode === 'BATTLE') return;
    this.mode = 'MOVING'; this.ui.hideOverlay(); this.ui.hideCenterAction(); this.ui.hideEnemies(); this.actors.hideEnemies();
    this.tower.moveTo(index, () => { this.currentFloor = index; const healed = this.relics.onFloorEnter(this.player, index); this.ui.updateHud(this); this.ui.updatePlayer(this.player); this.ui.showResourceGain('进入楼层 · 生命', healed, this.player.hp, this.player.maxHp); this.events.emit('floor:enter', { floor: index }); this.resolveFloor(this.tower.getFloor(index)); this.persist(); });
  }
  resolveFloor(floor) {
    this.ui.hideCenterAction();
    if ([FloorType.BATTLE, FloorType.ELITE, FloorType.BOSS].includes(floor.type)) return this.startBattle(floor);
    if (floor.type === FloorType.TREASURE) { this.mode = 'REWARD'; this.currentRewards = this.rewards.generate(this.player, floor.index); this.ui.showRewards(this.currentRewards, '檐下藏着微光'); return; }
    this.mode = 'MOMENT';
    if (floor.type === FloorType.REST) { const healed = gainHealth(this.player, Math.max(2, Math.ceil(this.player.maxHp * .25))); this.ui.updatePlayer(this.player); this.ui.showFloorMoment('月台小憩', `风替你梳顺毛发，回复 ${healed} 生命。`); }
    else if (floor.type === FloorType.SHOP) this.ui.showFloorMoment('猫市未开', '摊主正在数鱼干，送你 2 枚作赔。');
    else { this.essence += 1; this.ui.updateHud(this); this.ui.showFloorMoment('檐铃奇遇', '你接住一枚坠落的月屑。月屑 +1。'); }
    if (floor.type === FloorType.SHOP) { this.currency += 2; this.ui.updateHud(this); }
    this.persist();
  }
  startBattle(floor) {
    const enemyParty = createEnemyParty(floor);
    this.mode = 'BATTLE';
    this.tower.setVisible(false); this.interior.show(floor); this.scene.setView('battle');
    this.ui.setBattleView(this.scene.currentBattleView().label);
    this.actors.setPlayerVisible(true); this.actors.showEnemies(enemyParty);
    const state = this.battle.start(this.player, enemyParty, floor.index);
    this.ui.showEnemies(enemyParty, state, this.ui.floorName(floor.type)); this.ui.updatePlayer(this.player, this.battle); this.persist();
  }
  runEnemySequence() {
    if (this.battle.state.phase !== BattlePhase.ENEMY_TURN) return;
    this.animations.tween({ duration: 430, update: () => {}, complete: () => {
      const hasNext = this.battle.enemyTurn();
      if (hasNext && this.battle.state.phase === BattlePhase.ENEMY_TURN) this.runEnemySequence();
    }});
  }
  setAutoCombo(enabled) {
    this.autoCombo = enabled;
    localStorage.setItem(AUTO_COMBO_KEY, enabled ? '1' : '0');
    if (this.battle?.state) this.battle.state.comboRunning = false;
    this.ui.setAutoCombo(enabled);
    if (this.mode === 'BATTLE') this.ui.updatePlayer(this.player, this.battle);
  }
  runAutoCombo() {
    const state = this.battle.state;
    if (!this.autoCombo || this.mode !== 'BATTLE' || state.phase !== BattlePhase.PLAYER_TURN) return;
    state.comboRunning = true;
    this.ui.setAutoCombo(true, true);
    this.ui.updatePlayer(this.player, this.battle);
    this.afterVisual(520, () => {
      if (!this.autoCombo || this.mode !== 'BATTLE' || state !== this.battle.state || state.phase !== BattlePhase.PLAYER_TURN) {
        state.comboRunning = false;
        this.ui.setAutoCombo(this.autoCombo);
        return;
      }
      const skillId = this.battle.bestAttackSkill();
      if (!skillId || !this.battle.useSkill(skillId)) {
        state.comboRunning = false;
        this.ui.setAutoCombo(this.autoCombo);
        this.ui.updatePlayer(this.player, this.battle);
        return;
      }
      if (state.phase === BattlePhase.PLAYER_TURN) this.runAutoCombo();
      else {
        state.comboRunning = false;
        this.ui.setAutoCombo(this.autoCombo);
        if (state.phase === BattlePhase.ENEMY_TURN) this.runEnemySequence();
      }
    });
  }
  onVictory() {
    this.mode = 'VICTORY'; this.currency += this.battle.state.floor % 10 === 0 ? 5 : 1; this.ui.updateHud(this);
    this.animations.tween({ duration: 760, update: () => {}, complete: () => {
      this.leaveBattleScene(); this.mode = 'REWARD'; this.currentRewards = this.rewards.generate(this.player, this.currentFloor); this.ui.showRewards(this.currentRewards);
    } });
  }
  leaveBattleScene() {
    this.actors.hideEnemies(); this.actors.setPlayerVisible(false); this.ui.hideEnemies();
    this.interior.hide(); this.tower?.setVisible(true); this.scene.setView('tower');
  }
  chooseReward(index) {
    const reward = this.currentRewards[index]; if (!reward) return;
    this.mode = 'REWARD_RESULT';
    const before = { hp: this.player.hp, maxHp: this.player.maxHp, energy: this.player.energy, maxEnergy: this.player.maxEnergy, heartGuard: this.player.heartGuard || 0 };
    this.rewards.apply(reward, this.player); this.events.emit('reward:selected', reward);
    const after = { hp: this.player.hp, maxHp: this.player.maxHp, energy: this.player.energy, maxEnergy: this.player.maxEnergy, heartGuard: this.player.heartGuard || 0 };
    this.ui.hideOverlay(); this.ui.updatePlayer(this.player); this.ui.showRewardResult(reward, before, after); this.persist();
    this.animations.tween({ duration: 1150, update: () => {}, complete: () => this.enterFloor(this.currentFloor + 1) });
  }
  persist() {
    if (!this.player || this.mode === 'DEFEAT') return;
    this.saveSystem.save({ version: 1, worldSeed: this.worldSeed, currentFloor: this.currentFloor, currency: this.currency, essence: this.essence, catId: this.cat.id, player: { ...this.player, buffs: [], shield: 0 } });
  }
  update(delta, elapsed) {
    this.actors.update(elapsed);
    this.tower?.update(elapsed);
    if (this.debugEnabled && this.tower && Math.floor(elapsed * 4) !== this.debugTick) {
      this.debugTick = Math.floor(elapsed * 4); this.ui.updateDebug({ fps: this.scene.fps, floor: this.currentFloor, objects: this.scene.objectCount(), active: this.tower.activeCount });
    }
  }
  pause() { this.scene?.pause(); }
  resume() { this.scene?.resume(); }
  destroy() { this.scene?.destroy({ destroyPixi: false }); this.ui?.destroy(); this.audio?.stop?.(); }
}
