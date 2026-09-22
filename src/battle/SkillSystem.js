import { skills } from '../data/skills.js';

export class SkillSystem {
  constructor(effectSystem) { this.effects = effectSystem; }
  cost(skillId, player, battle) {
    const base = Math.max(0, skills[skillId].cost + (player.costModifiers?.[skillId] || 0));
    return battle?.firstSkill && battle?.weeklyCostDelta ? Math.max(0, base + battle.weeklyCostDelta) : base;
  }
  canUse(skillId, player, battle) { return player.energy >= this.cost(skillId, player, battle) && player.hp > 0; }
  use(skillId, context) {
    const skill = skills[skillId];
    const cost = this.cost(skillId, context.player, context.battle);
    if (!skill || !this.canUse(skillId, context.player, context.battle)) return false;
    context.player.energy -= cost;
    const damageBonus = context.player.skillUpgrades[skillId] || 0;
    skill.effects.forEach((effect) => this.effects.resolve(effect, { ...context, damageBonus }));
    return true;
  }
}
