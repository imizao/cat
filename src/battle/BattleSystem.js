import { BuffSystem } from './BuffSystem.js';
import { EffectSystem } from './EffectSystem.js';
import { SkillSystem } from './SkillSystem.js';
import { getEnemyIntent } from './EnemyAI.js';
import { applyDamage } from './Balance.js';
import { skills } from '../data/skills.js';

export const BattlePhase = { PLAYER_TURN: 'PLAYER_TURN', ENEMY_TURN: 'ENEMY_TURN', VICTORY: 'VICTORY', DEFEAT: 'DEFEAT' };

export class BattleSystem {
  constructor(eventBus, relicSystem, weekly) {
    this.events = eventBus;
    this.relics = relicSystem;
    this.weekly = weekly;
    this.buffSystem = new BuffSystem();
    this.effectSystem = new EffectSystem(this.buffSystem, eventBus);
    this.skillSystem = new SkillSystem(this.effectSystem);
    this.state = null;
  }

  start(player, enemyParty, floor) {
    const enemies = Array.isArray(enemyParty) ? enemyParty : [enemyParty];
    player.shield = 0;
    player.buffs = [];
    enemies.forEach((enemy, index) => {
      enemy.shield = 0;
      enemy.buffs = [];
      enemy.encounterIndex = index;
    });
    this.state = {
      turn: 1, phase: BattlePhase.PLAYER_TURN, player, enemies, enemy: enemies[0],
      selectedEnemyIndex: 0, activeActorIndex: 0, enemyTurnIndex: 0, floor,
      turnOrder: [
        { type: 'player', seat: 1 },
        ...enemies.map((enemy, index) => ({ type: 'enemy', id: enemy.id, seat: index + 2 }))
      ],
      firstSkill: true, firstDamage: true,
      weeklyCostDelta: this.weekly.modifiers.firstSkillCostDelta,
      history: []
    };
    if (player.passiveId === 'stoutHeart') player.shield += 1;
    this.relics.onBattleStart(player);
    this.beginPlayerTurn();
    this.events.emit('battle:start', this.state);
    return this.state;
  }

  livingEnemies() { return this.state.enemies.filter((enemy) => enemy.hp > 0); }

  selectTarget(index) {
    const state = this.state;
    if (!state || state.phase !== BattlePhase.PLAYER_TURN || !state.enemies[index] || state.enemies[index].hp <= 0) return false;
    state.selectedEnemyIndex = index;
    state.enemy = state.enemies[index];
    state.intent = state.intents[index];
    this.events.emit('battle:update', state);
    return true;
  }

  selectFirstLiving() {
    const index = this.state.enemies.findIndex((enemy) => enemy.hp > 0);
    if (index >= 0) {
      this.state.selectedEnemyIndex = index;
      this.state.enemy = this.state.enemies[index];
      this.state.intent = this.state.intents?.[index] || null;
    }
  }

  beginPlayerTurn() {
    const state = this.state;
    state.player.energy = state.player.maxEnergy;
    this.triggerTurnDamage(state.player, 'player:damage');
    if (state.player.hp <= 0) { this.finish(BattlePhase.DEFEAT); return; }
    if (!this.livingEnemies().length) { this.finish(BattlePhase.VICTORY); return; }
    if (state.enemy.hp <= 0) this.selectFirstLiving();
    state.intents = state.enemies.map((enemy) => enemy.hp > 0 ? getEnemyIntent(enemy, state.turn) : null);
    state.intent = state.intents[state.selectedEnemyIndex];
    state.activeActorIndex = 0;
    state.enemyTurnIndex = 0;
    state.phase = BattlePhase.PLAYER_TURN;
    this.events.emit('battle:update', state);
  }

  triggerTurnDamage(entity, eventName) {
    this.buffSystem.trigger(entity, 'turnStart', { damage: (amount, piercing) => {
      const result = applyDamage(entity, amount, piercing);
      this.events.emit(eventName, { target: entity, ...result });
    }});
  }

  useSkill(skillId) {
    const state = this.state;
    if (!state || state.phase !== BattlePhase.PLAYER_TURN) return false;
    const target = state.enemies[state.selectedEnemyIndex];
    if (!target || target.hp <= 0) return false;
    const dealsDamage = skills[skillId].effects.some((effect) => effect.type === 'damage' && effect.target !== 'self');
    const relicBonus = this.relics.beforeSkill(state.player, state);
    const passiveBonus = state.player.passiveId === 'firstCut' && state.firstDamage && dealsDamage ? 1 : 0;
    const originalUpgrade = state.player.skillUpgrades[skillId] || 0;
    state.player.skillUpgrades[skillId] = originalUpgrade + relicBonus + passiveBonus;
    const used = this.skillSystem.use(skillId, { battle: state, player: state.player, source: state.player, target });
    state.player.skillUpgrades[skillId] = originalUpgrade;
    if (!used) return false;
    state.firstSkill = false;
    if (dealsDamage) state.firstDamage = false;
    state.history.push({ turn: state.turn, actor: 'player', skillId, target: state.selectedEnemyIndex });
    this.events.emit('skill:used', { skillId, target, state });
    if (!this.livingEnemies().length) return this.finish(BattlePhase.VICTORY);
    if (target.hp <= 0) this.selectFirstLiving();
    this.endPlayerTurn();
    return true;
  }

  endPlayerTurn() {
    const state = this.state;
    if (!state || state.phase !== BattlePhase.PLAYER_TURN) return false;
    state.phase = BattlePhase.ENEMY_TURN;
    state.enemyTurnIndex = 0;
    const firstLiving = state.enemies.findIndex((enemy) => enemy.hp > 0);
    state.activeActorIndex = firstLiving + 1;
    this.events.emit('battle:update', state);
    return true;
  }

  enemyTurn() {
    const state = this.state;
    if (!state || state.phase !== BattlePhase.ENEMY_TURN) return false;
    let index = state.enemyTurnIndex;
    while (index < state.enemies.length && state.enemies[index].hp <= 0) index++;
    if (index >= state.enemies.length) { this.endEnemyRound(); return false; }

    const enemy = state.enemies[index];
    state.activeActorIndex = index + 1;
    this.triggerTurnDamage(enemy, 'enemy:damage');
    if (enemy.hp > 0) {
      const intent = state.intents[index];
      if (intent.type === 'attack') {
        let amount = this.buffSystem.modifyOutgoing(enemy, intent.value);
        amount = this.buffSystem.modifyIncoming(state.player, amount);
        const result = applyDamage(state.player, amount);
        this.events.emit('player:damage', { target: state.player, source: enemy, ...result });
      } else if (intent.type === 'shield') {
        enemy.shield += intent.value;
        this.events.emit('enemy:shield', { target: enemy, amount: intent.value });
      } else if (intent.type === 'buff') this.buffSystem.add(state.player, intent.buffId, intent.value, 2);
      state.history.push({ turn: state.turn, actor: enemy.id, seat: index + 1, intent });
      this.events.emit('battle:enemy-acted', { enemy, index, intent, state });
    }
    if (state.player.hp <= 0) { this.finish(BattlePhase.DEFEAT); return false; }

    state.enemyTurnIndex = index + 1;
    const hasNext = state.enemies.slice(state.enemyTurnIndex).some((candidate) => candidate.hp > 0);
    if (!hasNext) { this.endEnemyRound(); return false; }
    const nextIndex = state.enemies.findIndex((candidate, candidateIndex) => candidateIndex >= state.enemyTurnIndex && candidate.hp > 0);
    state.activeActorIndex = nextIndex + 1;
    this.events.emit('battle:update', state);
    return true;
  }

  endEnemyRound() {
    const state = this.state;
    this.buffSystem.tick(state.player);
    state.enemies.forEach((enemy) => this.buffSystem.tick(enemy));
    state.turn++;
    this.beginPlayerTurn();
  }

  finish(phase) {
    this.state.phase = phase;
    this.events.emit(phase === BattlePhase.VICTORY ? 'battle:end' : 'battle:defeat', this.state);
    this.events.emit('battle:update', this.state);
    return true;
  }
}
