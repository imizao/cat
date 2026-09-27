import { EventBus } from '../core/EventBus.js';
import { getCat } from '../data/cats.js';
import { skills } from '../data/skills.js';
import { weeklyModifier } from '../data/weekly.js';
import { BattlePhase, BattleSystem } from '../battle/BattleSystem.js';
import { FloorGenerator, FloorType } from '../tower/FloorGenerator.js';
import { createEnemyParty } from '../systems/EncounterSystem.js';
import { RelicSystem } from '../systems/RelicSystem.js';
import { RewardSystem } from '../systems/RewardSystem.js';
import { gainHealth } from '../systems/ResourceRules.js';
import { scaleSkillEffect } from '../systems/SkillGrowth.js';

const battleTypes = new Set([FloorType.BATTLE, FloorType.ELITE, FloorType.BOSS]);

function makePlayer(cat) {
  return {
    hp: cat.maxHp, maxHp: cat.maxHp,
    energy: cat.maxEnergy, maxEnergy: cat.maxEnergy, baseMaxEnergy: cat.maxEnergy, heartGuard: 0,
    shield: 0, passiveId: cat.passive.id,
    skills: [...cat.skills], skillUpgrades: {}, costModifiers: {}, relics: [], mutations: [], buffs: []
  };
}

export class AutoPlaySimulator {
  constructor({ worldSeed = 20260922, catId = 'sunstripe', maxFloor = 1000, trace = false } = {}) {
    this.worldSeed = Number(worldSeed) >>> 0;
    this.cat = getCat(catId);
    if (!this.cat) throw new Error(`Unknown cat: ${catId}`);
    this.maxFloor = Math.max(1, Number(maxFloor) || 1000);
    this.traceEnabled = trace;
    this.events = new EventBus();
    this.relics = new RelicSystem();
    this.rewards = new RewardSystem(this.worldSeed);
    this.floors = new FloorGenerator(this.worldSeed);
    this.battle = new BattleSystem(this.events, this.relics, weeklyModifier);
    this.player = makePlayer(this.cat);
    this.trace = [];
    this.stats = {
      battles: 0, bosses: 0, elites: 0, rests: 0, treasures: 0,
      skillsUsed: 0, damageSkills: 0, rewards: [], floorTypes: {}
    };
  }

  log(floor, message) {
    if (!this.traceEnabled) return;
    if (this.trace.length < 600) this.trace.push({ floor, message });
    else if (this.trace.length === 600) this.trace.push({ floor, message: '轨迹过长，后续记录已省略' });
  }

  run() {
    let clearedFloor = 0;
    let defeatedAt = null;
    let stoppedReason = 'floor-cap';
    for (let floorIndex = 1; floorIndex <= this.maxFloor; floorIndex++) {
      const floor = this.floors.generate(floorIndex);
      this.stats.floorTypes[floor.type] = (this.stats.floorTypes[floor.type] || 0) + 1;
      this.relics.onFloorEnter(this.player, floorIndex);
      this.log(floorIndex, `进入 ${floor.type}，生命 ${this.player.hp}/${this.player.maxHp}`);

      if (battleTypes.has(floor.type)) {
        const won = this.playBattle(floor);
        if (!won) {
          defeatedAt = floorIndex;
          stoppedReason = 'defeat';
          break;
        }
        this.applyBestReward(floorIndex, '战斗奖励');
      } else if (floor.type === FloorType.REST) {
        this.stats.rests++;
        const healed = gainHealth(this.player, Math.max(2, Math.ceil(this.player.maxHp * .25)));
        this.log(floorIndex, `休息回复 ${healed}`);
      } else if (floor.type === FloorType.TREASURE) {
        this.stats.treasures++;
        this.applyBestReward(floorIndex, '宝藏奖励');
      }
      clearedFloor = floorIndex;
    }

    return {
      worldSeed: this.worldSeed,
      catId: this.cat.id,
      catName: this.cat.name,
      reachedFloor: defeatedAt || clearedFloor,
      clearedFloor,
      defeatedAt,
      stoppedReason,
      finalHp: this.player.hp,
      maxHp: this.player.maxHp,
      maxEnergy: this.player.maxEnergy,
      relics: [...this.player.relics],
      skillUpgrades: { ...this.player.skillUpgrades },
      stats: { ...this.stats, rewards: [...this.stats.rewards] },
      trace: [...this.trace]
    };
  }

  playBattle(floor) {
    const party = createEnemyParty(floor);
    this.stats.battles++;
    if (floor.type === FloorType.BOSS) this.stats.bosses++;
    if (floor.type === FloorType.ELITE) this.stats.elites++;
    this.battle.start(this.player, party, floor.index);
    let safety = 0;

    while (![BattlePhase.VICTORY, BattlePhase.DEFEAT].includes(this.battle.state.phase) && safety++ < 600) {
      if (this.battle.state.phase === BattlePhase.PLAYER_TURN) {
        const targetIndex = this.chooseTarget();
        this.battle.selectTarget(targetIndex);
        const skillId = this.chooseSkill();
        const target = this.battle.state.enemies[targetIndex];
        if (skillId) this.log(floor.index, `回合 ${this.battle.state.turn}：${skills[skillId].name} → ${target.name}`);
        if (!skillId || !this.battle.useSkill(skillId)) {
          this.battle.endPlayerTurn();
        } else {
          this.stats.skillsUsed++;
          if (skills[skillId].effects.some((effect) => effect.type === 'damage' && effect.target !== 'self')) this.stats.damageSkills++;
        }
      }
      while (this.battle.state.phase === BattlePhase.ENEMY_TURN) this.battle.enemyTurn();
      if (this.battle.state.phase === BattlePhase.PLAYER_TURN) this.log(floor.index, `敌方行动结束，生命 ${this.player.hp}/${this.player.maxHp}`);
    }

    const won = this.battle.state.phase === BattlePhase.VICTORY;
    this.log(floor.index, won ? `战斗胜利，剩余生命 ${this.player.hp}` : `战斗失败，对手：${party.filter((enemy) => enemy.hp > 0).map((enemy) => enemy.name).join('、')}`);
    return won;
  }

  chooseTarget() {
    if (Number.isInteger(this.battle.state.recommendedEnemyIndex)) return this.battle.state.recommendedEnemyIndex;
    let choice = 0;
    let lowestHp = Infinity;
    this.battle.state.enemies.forEach((enemy, index) => {
      const effectiveHp = enemy.hp + enemy.shield;
      if (enemy.hp > 0 && effectiveHp < lowestHp) { lowestHp = effectiveHp; choice = index; }
    });
    return choice;
  }

  chooseSkill() {
    const state = this.battle.state;
    const incoming = state.intents.reduce((sum, intent) => sum + (intent?.type === 'attack' ? intent.value : 0), 0);
    const hpRatio = this.player.hp / this.player.maxHp;
    const lastPlayerAction = [...state.history].reverse().find((entry) => entry.actor === 'player');
    const usable = this.player.skills.filter((id) => this.battle.skillSystem.canUse(id, this.player, state));
    let best = null;
    let bestScore = -Infinity;

    usable.forEach((id) => {
      const definition = skills[id];
      let score = 0;
      definition.effects.map((effect) => scaleSkillEffect(effect, this.player.skillUpgrades[id] || 0)).forEach((effect) => {
        if (effect.type === 'damage' && effect.target !== 'self') score += 55 + (effect.value + (this.player.skillUpgrades[id] || 0)) * 12;
        if (effect.type === 'damage' && effect.target === 'self') score -= effect.value * 18;
        if (effect.type === 'heal') score += hpRatio < .45 ? 88 + effect.value * 4 : Math.min(this.player.maxHp - this.player.hp, effect.value) * 6;
        if (effect.type === 'shield') score += incoming > this.player.shield ? 45 + effect.value * 8 : effect.value * 4;
        if (effect.type === 'applyBuff') score += effect.target === 'self' ? 12 : 8;
        if (effect.type === 'gainEnergy') score += 2;
      });
      if (id === 'moonPounce' && this.player.mutations.includes('lunarRelay')) {
        const target = state.enemies[state.selectedEnemyIndex];
        if (target && target.hp + target.shield <= 3 + (this.player.skillUpgrades[id] || 0)) score += 18;
      }
      if (id === 'scratchMark' && this.player.mutations.includes('spreadingInk')) score += Math.max(0, this.battle.livingEnemies().length - 1) * 18;
      if (id === 'nap' && this.player.mutations.includes('dreamShell')) score += 72 + incoming * 6;
      score -= this.battle.skillSystem.cost(id, this.player, state) * 2;
      if (lastPlayerAction?.skillId === id && !definition.effects.some((effect) => effect.type === 'damage' && effect.target !== 'self')) score -= 85;
      if (score > bestScore) { bestScore = score; best = id; }
    });
    return best;
  }

  applyBestReward(floor, source) {
    const choices = this.rewards.generate(this.player, floor);
    const reward = choices.reduce((best, candidate) => this.rewardScore(candidate) > this.rewardScore(best) ? candidate : best);
    this.rewards.apply(reward, this.player);
    this.stats.rewards.push(reward.id);
    this.log(floor, `${source}：${reward.name}`);
  }

  rewardScore(reward) {
    if (!reward) return -Infinity;
    if (reward.id === 'heal') return (this.player.maxHp - this.player.hp) * 24;
    if (reward.id === 'maxHp') return 84 + (1 - this.player.hp / this.player.maxHp) * 25;
    if (reward.id === 'energy') return this.player.maxEnergy < 6 ? 112 : 22;
    if (reward.id.startsWith('mutation:')) return 104;
    if (reward.id.startsWith('upgrade:')) return 96;
    if (reward.id === 'relic:catBell') return 118;
    if (reward.id === 'relic:oldBox') return 108;
    if (reward.id === 'relic:driedFishBag') return 102;
    return 40;
  }
}

export function summarizeRuns(results) {
  if (!results.length) return { runs: 0, average: 0, median: 0, best: 0, worst: 0, capRate: 0, clear10Rate: 0, reach20Rate: 0, reach50Rate: 0, reach100Rate: 0 };
  const floors = results.map((result) => result.reachedFloor).sort((a, b) => a - b);
  const middle = Math.floor(floors.length / 2);
  const median = floors.length % 2 ? floors[middle] : (floors[middle - 1] + floors[middle]) / 2;
  return {
    runs: results.length,
    average: floors.reduce((sum, floor) => sum + floor, 0) / floors.length,
    median,
    best: floors[floors.length - 1],
    worst: floors[0],
    capRate: results.filter((result) => result.stoppedReason === 'floor-cap').length / results.length,
    clear10Rate: results.filter((result) => result.clearedFloor >= 10).length / results.length,
    reach20Rate: results.filter((result) => result.reachedFloor >= 20).length / results.length,
    reach50Rate: results.filter((result) => result.reachedFloor >= 50).length / results.length,
    reach100Rate: results.filter((result) => result.reachedFloor >= 100).length / results.length
  };
}
