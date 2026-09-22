import { SeededRandom } from '../core/SeededRandom.js';
import { FloorGenerator } from '../tower/FloorGenerator.js';
import { applyDamage } from '../battle/Balance.js';
import { difficultyForFloor } from '../systems/DifficultySystem.js';
import { RewardSystem } from '../systems/RewardSystem.js';
import { SkillSystem } from '../battle/SkillSystem.js';

export function runSelfTests() {
  const results = [];
  const test = (name, fn) => { try { fn(); results.push(`✓ ${name}`); } catch (error) { results.push(`✗ ${name}: ${error.message}`); } };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  test('SeededRandom deterministic', () => { const a = new SeededRandom(42), b = new SeededRandom(42); assert(Array.from({ length: 8 }, () => a.random()).every((v) => v === b.random()), 'sequences differ'); });
  test('FloorGenerator deterministic', () => { const a = new FloorGenerator(99).generate(1000), b = new FloorGenerator(99).generate(1000); assert(JSON.stringify(a) === JSON.stringify(b), 'floors differ'); });
  test('damage calculation', () => { const target = { hp: 8, shield: 0 }; const out = applyDamage(target, 3); assert(out.hpLoss === 3 && target.hp === 5, 'wrong damage'); });
  test('shield calculation', () => { const target = { hp: 8, shield: 2 }; const out = applyDamage(target, 3); assert(out.absorbed === 2 && target.hp === 7 && target.shield === 0, 'wrong shield'); });
  test('energy cost', () => { const system = new SkillSystem({ resolve() {} }); const player = { hp: 5, energy: 1, costModifiers: {} }; const battle = { firstSkill: false }; assert(system.canUse('moonPounce', player, battle) && !system.canUse('tailTrick', player, battle), 'cost gate failed'); });
  test('reward selection', () => { const player = { skills: ['moonPounce'], relics: [], maxHp: 8, hp: 5, maxEnergy: 3, energy: 3, skillUpgrades: {} }; const rewards = new RewardSystem(7).generate(player, 3); assert(rewards.length === 3 && new Set(rewards.map((r) => r.id)).size === 3, 'not 3 unique rewards'); });
  test('difficulty scaling', () => { assert(difficultyForFloor(100) > difficultyForFloor(10) && difficultyForFloor(10) > difficultyForFloor(1), 'not increasing'); });
  console.group('月爪天塔 self-test'); results.forEach((result) => console.log(result)); console.groupEnd();
  return results;
}
