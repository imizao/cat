import { skills } from '../data/skills.js';
import { energyOverflowLimit, healthOverflowLimit } from '../systems/ResourceRules.js';

export class SkillSystem {
  constructor(effectSystem) { this.effects = effectSystem; }
  isSupport(skillId) {
    const skill = skills[skillId];
    return Boolean(skill && skill.effects.length && skill.effects.every((effect) => effect.target === 'self' && effect.type !== 'damage'));
  }
  hasSupportEffect(skillId, player) {
    return skills[skillId].effects.some((effect) => {
      if (effect.type === 'heal') return player.hp < healthOverflowLimit(player);
      if (effect.type === 'shield') return player.shield < effect.value;
      if (effect.type === 'gainEnergy') return player.energy < energyOverflowLimit(player);
      return true;
    });
  }
  cost(skillId, player, battle) {
    const base = Math.max(0, skills[skillId].cost + (player.costModifiers?.[skillId] || 0));
    return battle?.firstSkill && battle?.weeklyCostDelta ? Math.max(0, base + battle.weeklyCostDelta) : base;
  }
  canUse(skillId, player, battle) {
    const support = this.isSupport(skillId);
    return player.energy >= this.cost(skillId, player, battle) && player.hp > 0
      && !(battle?.supportUsed && support)
      && (!support || this.hasSupportEffect(skillId, player));
  }
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
