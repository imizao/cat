import { BuffSystem } from './BuffSystem.js';
import { EffectSystem } from './EffectSystem.js';
import { SkillSystem } from './SkillSystem.js';
import { getEnemyIntent } from './EnemyAI.js';
import { applyDamage } from './Balance.js';
import { recommendTarget } from './TargetAdvisor.js';
import { skills } from '../data/skills.js';
import { scaleSkillEffect } from '../systems/SkillGrowth.js';
import { restoreEnergy } from '../systems/ResourceRules.js';
import { mutationForSkill } from '../data/mutations.js';

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
      supportUsed: false, offensiveActionsUsed: 0, pursuitCharge: 0, pursuitReady: false,
      mutationUses: {},
      weeklyCostDelta: this.weekly.modifiers.firstSkillCostDelta,
      history: []
    };
    if (player.passiveId === 'stoutHeart') player.shield += 1;
    player.shield += player.heartGuard || 0;
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
    this.events.emit('target:selected', { index, target: state.enemy, state });
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
    state.supportUsed = false;
    state.offensiveActionsUsed = 0;
    state.pursuitCharge = Math.max(0, state.player.maxEnergy - (state.player.baseMaxEnergy || state.player.maxEnergy));
    state.pursuitReady = false;
    this.triggerTurnDamage(state.player, 'player:damage');
    if (state.player.hp <= 0) { this.finish(BattlePhase.DEFEAT); return; }
    if (!this.livingEnemies().length) { this.finish(BattlePhase.VICTORY); return; }
    if (state.enemy.hp <= 0) this.selectFirstLiving();
    state.intents = state.enemies.map((enemy) => enemy.hp > 0 ? getEnemyIntent(enemy, state.turn) : null);
    this.updateRecommendedTarget();
    state.activeActorIndex = 0;
    state.enemyTurnIndex = 0;
    state.phase = BattlePhase.PLAYER_TURN;
    this.events.emit('battle:update', state);
  }

  updateRecommendedTarget() {
    const state = this.state;
    const recommendation = recommendTarget(state, this.buffSystem, this.skillSystem);
    state.recommendedEnemyIndex = recommendation?.index ?? state.selectedEnemyIndex;
    state.recommendationReason = recommendation?.reason || '';
    if (recommendation) {
      state.selectedEnemyIndex = recommendation.index;
      state.enemy = state.enemies[recommendation.index];
    }
    state.intent = state.intents[state.selectedEnemyIndex];
  }

  triggerTurnDamage(entity, eventName) {
    this.buffSystem.trigger(entity, 'turnStart', { damage: (amount, piercing) => {
      const result = applyDamage(entity, amount, piercing);
      this.events.emit(eventName, { target: entity, ...result });
    }});
  }

  bestAttackSkill() {
    const state = this.state;
    if (!state || state.phase !== BattlePhase.PLAYER_TURN) return null;
    const target = state.enemies[state.selectedEnemyIndex];
    if (!target || target.hp <= 0) return null;
    return (state.player.skills || []).filter((skillId) => this.skillSystem.isAttack(skillId)
      && this.skillSystem.canUse(skillId, state.player, state)).reduce((best, skillId) => {
      const level = state.player.skillUpgrades?.[skillId] || 0;
      const damage = skills[skillId].effects.map((effect) => scaleSkillEffect(effect, level))
        .filter((effect) => effect.type === 'damage' && effect.target !== 'self')
        .reduce((total, effect) => total + effect.value, 0);
      const cost = this.skillSystem.cost(skillId, state.player, state);
      const score = (damage >= target.hp + target.shield ? 10000 : 0) + damage * 100 - cost;
      return !best || score > best.score ? { skillId, score } : best;
    }, null)?.skillId || null;
  }

  useSkill(skillId) {
    const state = this.state;
    if (!state || state.phase !== BattlePhase.PLAYER_TURN) return false;
    const skill = skills[skillId];
    if (!skill || !this.skillSystem.canUse(skillId, state.player, state)) return false;
    const support = this.skillSystem.isSupport(skillId);
    const target = state.enemies[state.selectedEnemyIndex];
    if (!target || target.hp <= 0) return false;
    const playerHpBefore = state.player.hp;
    const dealsDamage = skill.effects.some((effect) => effect.type === 'damage' && effect.target !== 'self');
    const relicBonus = this.relics.beforeSkill(state.player, state);
    const passiveBonus = state.player.passiveId === 'firstCut' && state.firstDamage && dealsDamage ? 1 : 0;
    this.events.emit('skill:cast', { skillId, skill, source: state.player, target, state });
    const used = this.skillSystem.use(skillId, { battle: state, player: state.player, source: state.player, target, visualDelay: 240, damageBonus: relicBonus + passiveBonus });
    if (!used) return false;
    const mutation = mutationForSkill(state.player, skillId);
    if (mutation?.id === 'lunarRelay' && target.hp <= 0 && !state.mutationUses.lunarRelay) {
      const amount = restoreEnergy(state.player, 1);
      if (amount) {
        state.mutationUses.lunarRelay = true;
        this.events.emit('player:energy', { target: state.player, amount, visualDelay: 240 });
        this.events.emit('mutation:trigger', { mutation, target });
      }
    } else if (mutation?.id === 'spreadingInk') {
      const recipients = state.enemies.filter((enemy) => enemy !== target && enemy.hp > 0);
      recipients.forEach((enemy) => this.buffSystem.add(enemy, 'scratch', 1, 3));
      if (recipients.length) this.events.emit('mutation:trigger', { mutation, target });
    } else if (mutation?.id === 'dreamShell') {
      const shield = Math.max(0, state.player.hp - playerHpBefore);
      if (shield) {
        state.player.shield += shield;
        this.events.emit('player:shield', { amount: shield });
        this.events.emit('mutation:trigger', { mutation, target: state.player });
      }
    }
    state.firstSkill = false;
    if (dealsDamage) state.firstDamage = false;
    state.history.push({ turn: state.turn, actor: 'player', skillId, target: state.selectedEnemyIndex });
    this.events.emit('skill:used', { skillId, target, state });
    if (!this.livingEnemies().length) return this.finish(BattlePhase.VICTORY);
    if (target.hp <= 0) this.selectFirstLiving();
    if (support) {
      state.supportUsed = true;
      const canAttack = state.player.skills?.some((id) => skills[id]?.effects.some((effect) => effect.type === 'damage' && effect.target !== 'self') && this.skillSystem.canUse(id, state.player, state));
      if (canAttack) { this.events.emit('battle:update', state); return true; }
    } else {
      state.offensiveActionsUsed++;
      state.pursuitReady = false;
      const canPursue = state.offensiveActionsUsed === 1 && state.pursuitCharge > 0
        && state.player.skills?.some((id) => this.skillSystem.isAttack(id) && this.skillSystem.canUse(id, state.player, state));
      if (canPursue) {
        state.pursuitCharge--;
        state.pursuitReady = true;
        this.updateRecommendedTarget();
        this.events.emit('battle:update', state);
        return true;
      }
    }
    this.endPlayerTurn();
    return true;
  }

  endPlayerTurn() {
    const state = this.state;
    if (!state || state.phase !== BattlePhase.PLAYER_TURN) return false;
    state.phase = BattlePhase.ENEMY_TURN;
    state.pursuitReady = false;
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
      this.events.emit('battle:enemy-acting', { enemy, index, intent, state });
      if (intent.type === 'attack') {
        let amount = this.buffSystem.modifyOutgoing(enemy, intent.value);
        amount = this.buffSystem.modifyIncoming(state.player, amount);
        const result = applyDamage(state.player, amount);
        const energyGained = result.amount > 0 ? restoreEnergy(state.player, 1) : 0;
        this.events.emit('player:damage', { target: state.player, source: enemy, visualDelay: 240, ...result });
        if (energyGained) this.events.emit('player:energy', { target: state.player, source: enemy, amount: energyGained, visualDelay: 240 });
      } else if (intent.type === 'shield') {
        enemy.shield += intent.value;
        this.events.emit('enemy:shield', { target: enemy, amount: intent.value });
      } else if (intent.type === 'heal') {
        const before = enemy.hp;
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + intent.value);
        const healed = enemy.hp - before;
        if (healed) this.events.emit('enemy:heal', { target: enemy, amount: healed });
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
