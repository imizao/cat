import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../src/core/SeededRandom.js';
import { FloorGenerator, FloorType } from '../src/tower/FloorGenerator.js';
import { applyDamage } from '../src/battle/Balance.js';
import { SkillSystem } from '../src/battle/SkillSystem.js';
import { RewardSystem } from '../src/systems/RewardSystem.js';
import { difficultyForFloor } from '../src/systems/DifficultySystem.js';
import { EventBus } from '../src/core/EventBus.js';
import { BattleSystem, BattlePhase } from '../src/battle/BattleSystem.js';
import { AutoPlaySimulator, summarizeRuns } from '../src/simulation/AutoPlaySimulator.js';

describe('deterministic world', () => {
  it('repeats random sequences', () => { const a = new SeededRandom(123), b = new SeededRandom(123); expect(Array.from({ length: 10 }, () => a.random())).toEqual(Array.from({ length: 10 }, () => b.random())); });
  it('repeats floors, avoids duplicate rivals and makes each tenth a boss', () => {
    const gen = new FloorGenerator(321);
    expect(gen.generate(837)).toEqual(gen.generate(837));
    expect(new Set(gen.generate(837).enemyIds).size).toBe(3);
    expect(gen.generate(1000).type).toBe(FloorType.BOSS);
  });
});

describe('battle math', () => {
  it('absorbs damage with shield first', () => { const target = { hp: 10, shield: 3 }; expect(applyDamage(target, 5)).toEqual({ amount: 5, absorbed: 3, hpLoss: 2 }); expect(target).toEqual({ hp: 8, shield: 0 }); });
  it('enforces energy cost', () => { const skills = new SkillSystem({ resolve() {} }); expect(skills.canUse('tailTrick', { hp: 5, energy: 1, costModifiers: {} }, { firstSkill: false })).toBe(false); });
});

describe('progression', () => {
  it('selects three unique rewards', () => { const player = { skills: ['moonPounce'], relics: [], skillUpgrades: {} }; const result = new RewardSystem(1).generate(player, 6); expect(result).toHaveLength(3); expect(new Set(result.map((x) => x.id)).size).toBe(3); });
  it('scales difficulty smoothly upward', () => { expect(difficultyForFloor(2)).toBeGreaterThan(difficultyForFloor(1)); expect(difficultyForFloor(100)).toBeLessThan(10); });
});

describe('counterclockwise party battle', () => {
  it('automatically ends the player action, then resolves right, top, left', () => {
    const events = new EventBus();
    const relics = { onBattleStart() {}, beforeSkill() { return 0; } };
    const battle = new BattleSystem(events, relics, { modifiers: { firstSkillCostDelta: 0 } });
    const player = { hp: 20, maxHp: 20, energy: 3, maxEnergy: 3, shield: 0, buffs: [], relics: [], passiveId: '', skillUpgrades: {}, costModifiers: {} };
    const party = ['right', 'top', 'left'].map((id) => ({ id, name: id, hp: 8, maxHp: 8, shield: 0, buffs: [], attack: 1, ai: 'steady' }));
    battle.start(player, party, 1);
    expect(battle.selectTarget(1)).toBe(true);
    expect(battle.useSkill('cloudFur')).toBe(true);
    expect(player.shield).toBe(2);
    expect(party[1].shield).toBe(0);
    expect(battle.state.phase).toBe(BattlePhase.ENEMY_TURN);
    expect(battle.enemyTurn()).toBe(true);
    expect(battle.enemyTurn()).toBe(true);
    expect(battle.enemyTurn()).toBe(false);
    expect(battle.state.history.filter((entry) => entry.seat).map((entry) => entry.seat)).toEqual([1, 2, 3]);
    expect(battle.state.turn).toBe(2);
    expect(battle.state.phase).toBe(BattlePhase.PLAYER_TURN);
  });
});

describe('headless auto-play simulator', () => {
  it('is deterministic and returns aggregate statistics', () => {
    const options = { worldSeed: 7788, catId: 'sunstripe', maxFloor: 20 };
    const first = new AutoPlaySimulator(options).run();
    const second = new AutoPlaySimulator(options).run();
    expect(first).toEqual(second);
    expect(first.reachedFloor).toBeGreaterThanOrEqual(1);
    expect(summarizeRuns([first, second])).toMatchObject({ runs: 2, best: first.reachedFloor, worst: first.reachedFloor });
  });

  it('keeps the three cats within the balance regression band', () => {
    const catIds = ['sunstripe', 'inkwhisker', 'milkdot'];
    const averages = catIds.map((catId) => {
      const floors = Array.from({ length: 120 }, (_, index) => {
        const worldSeed = (20260922 + Math.imul(index + 1, 0x9e3779b1)) >>> 0;
        return new AutoPlaySimulator({ worldSeed, catId, maxFloor: 100 }).run().reachedFloor;
      });
      return floors.reduce((sum, floor) => sum + floor, 0) / floors.length;
    });
    expect(Math.max(...averages) / Math.min(...averages)).toBeLessThan(1.35);
  });
});
