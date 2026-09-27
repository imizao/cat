import { SeededRandom, floorSeed } from '../core/SeededRandom.js';
import { skills } from '../data/skills.js';
import { relics } from '../data/relics.js';
import { mutations } from '../data/mutations.js';
import { gainEnergy, gainHealth } from './ResourceRules.js';

export class RewardSystem {
  constructor(worldSeed) { this.worldSeed = worldSeed; }
  generate(player, floor) {
    const rng = new SeededRandom(floorSeed(this.worldSeed, floor, 0x51ed270b));
    const scalableSkills = player.skills.filter((id) => skills[id].effects.some((effect) => Number.isFinite(effect.value) || Number.isFinite(effect.stacks)));
    const lowestSkillLevel = scalableSkills.length ? Math.min(...scalableSkills.map((id) => player.skillUpgrades[id] || 0)) : 0;
    const growthSkills = scalableSkills.filter((id) => (player.skillUpgrades[id] || 0) <= lowestSkillLevel + 2);
    const missingRelics = Object.values(relics).filter((relic) => !player.relics.includes(relic.id));
    const availableMutations = Object.values(mutations).filter((mutation) => player.skills.includes(mutation.skillId) && !player.mutations?.includes(mutation.id));
    const growthReward = (skillId) => ({ id: `upgrade:${skillId}`, icon: '爪', name: `磨亮·${skills[skillId].name}`, description: '该技能所有数值成长', apply: (p) => { p.skillUpgrades[skillId] = (p.skillUpgrades[skillId] || 0) + 1; } });
    const mutationReward = (mutation) => ({ id: `mutation:${mutation.id}`, icon: mutation.icon, kind: 'mutation', name: `${skills[mutation.skillId].name}·${mutation.name}`, description: `${mutation.description}；技能数值 +1`, apply: (p) => { p.mutations ||= []; if (!p.mutations.includes(mutation.id)) { p.mutations.push(mutation.id); p.skillUpgrades[mutation.skillId] = (p.skillUpgrades[mutation.skillId] || 0) + 1; } } });
    const pool = [{ id: 'maxHp', icon: '♥', name: '心窝变大', description: '最大生命 +1；开战护盾永久 +1', apply: (p) => { p.maxHp += 1; p.heartGuard = (p.heartGuard || 0) + 1; gainHealth(p, 1); } }];
    const hasUsefulHeal = player.hp < player.maxHp + Math.max(3, Math.ceil(player.maxHp * .25));
    if (hasUsefulHeal) pool.push({ id: 'heal', icon: '✦', name: '舔净伤口', description: '回复 3 生命', apply: (p) => { gainHealth(p, 3); } });
    if (player.maxEnergy < 6) pool.push({ id: 'energy', icon: '⚡', name: '灵光一闪', description: '最大能量 +1；高于初始值可追击', apply: (p) => { p.maxEnergy += 1; gainEnergy(p, 1); } });
    if (missingRelics.length) {
      const relic = rng.pick(missingRelics);
      pool.push({ id: `relic:${relic.id}`, icon: relic.icon, name: relic.name, description: relic.description, apply: (p) => p.relics.push(relic.id) });
    }
    const result = [];
    if (availableMutations.length && (floor % 5 === 0 || rng.chance(.24))) result.push(mutationReward(rng.pick(availableMutations)));
    if (growthSkills.length) {
      const damageSkills = growthSkills.filter((id) => skills[id].effects.some((effect) => effect.type === 'damage' && effect.target !== 'self'));
      const supportSkills = growthSkills.filter((id) => !damageSkills.includes(id));
      const growthPool = damageSkills.length && (!supportSkills.length || rng.chance(.6)) ? damageSkills : supportSkills;
      const skillId = rng.pick(growthPool.length ? growthPool : growthSkills);
      if (result.length < 3) result.push(growthReward(skillId));
    }
    while (result.length < 3 && pool.length) result.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    const unusedGrowth = growthSkills.filter((id) => !result.some((reward) => reward.id === `upgrade:${id}`));
    while (result.length < 3 && unusedGrowth.length) result.push(growthReward(unusedGrowth.splice(rng.int(0, unusedGrowth.length - 1), 1)[0]));
    for (let index = result.length - 1; index > 0; index--) {
      const swapIndex = rng.int(0, index);
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }
  apply(reward, player) { reward.apply(player); return reward.id; }
}
