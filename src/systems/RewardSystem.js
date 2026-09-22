import { SeededRandom, floorSeed } from '../core/SeededRandom.js';
import { skills } from '../data/skills.js';
import { relics } from '../data/relics.js';

export class RewardSystem {
  constructor(worldSeed) { this.worldSeed = worldSeed; }
  generate(player, floor) {
    const rng = new SeededRandom(floorSeed(this.worldSeed, floor, 0x51ed270b));
    const damageSkills = player.skills.filter((id) => skills[id].effects.some((effect) => effect.type === 'damage'));
    const skillId = rng.pick(damageSkills);
    const missingRelics = Object.values(relics).filter((relic) => !player.relics.includes(relic.id));
    const pool = [
      { id: 'maxHp', icon: '♥', name: '心窝变大', description: '最大生命 +1', apply: (p) => { p.maxHp += 1; p.hp += 1; } },
      { id: 'heal', icon: '✦', name: '舔净伤口', description: '回复 3 生命', apply: (p) => { p.hp = Math.min(p.maxHp, p.hp + 3); } },
      { id: `upgrade:${skillId}`, icon: '爪', name: `磨亮·${skills[skillId].name}`, description: '该技能伤害 +1', apply: (p) => { p.skillUpgrades[skillId] = (p.skillUpgrades[skillId] || 0) + 1; } },
      { id: 'energy', icon: '⚡', name: '灵光一闪', description: '最大能量 +1', apply: (p) => { p.maxEnergy += 1; p.energy = p.maxEnergy; } }
    ];
    if (missingRelics.length) {
      const relic = rng.pick(missingRelics);
      pool.push({ id: `relic:${relic.id}`, icon: relic.icon, name: relic.name, description: relic.description, apply: (p) => p.relics.push(relic.id) });
    }
    const result = [];
    while (result.length < 3 && pool.length) result.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
    return result;
  }
  apply(reward, player) { reward.apply(player); return reward.id; }
}
