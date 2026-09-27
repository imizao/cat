import { skills } from '../data/skills.js';
import { energyOverflowLimit } from '../systems/ResourceRules.js';
import { scaleSkillEffect } from '../systems/SkillGrowth.js';

export class SkillSystem {
  constructor(effectSystem) { this.effects = effectSystem; }
  isSupport(skillId) {
    const skill = skills[skillId];
    return Boolean(skill && skill.effects.length && skill.effects.every((effect) => effect.type !== 'damage'));
  }
  isAttack(skillId) {
    return Boolean(skills[skillId]?.effects.some((effect) => effect.type === 'damage' && effect.target !== 'self'));
  }
  hasSupportEffect(skillId, player) {
    const level = player.skillUpgrades?.[skillId] || 0;
    return skills[skillId].effects.map((effect) => scaleSkillEffect(effect, level)).some((effect) => {
      if (effect.type === 'heal') return true;
      if (effect.type === 'shield') return player.shield < effect.value;
      if (effect.type === 'gainEnergy') return player.energy < energyOverflowLimit(player);
      return true;
    });
  }
  cost(skillId, player, battle) {
    const base = Math.max(0, skills[skillId].cost + (player.costModifiers?.[skillId] || 0));
    const basicAttack = player.skills?.find((id) => this.isAttack(id));
    if (battle && player.energy === 0 && battle.offensiveActionsUsed === 0 && skillId === basicAttack) return 0;
    return battle?.firstSkill && battle?.weeklyCostDelta ? Math.max(0, base + battle.weeklyCostDelta) : base;
  }
  canUse(skillId, player, battle) {
    const support = this.isSupport(skillId);
    return player.energy >= this.cost(skillId, player, battle) && player.hp > 0
      && !(battle?.supportUsed && support)
      && !(battle?.offensiveActionsUsed > 0 && !this.isAttack(skillId))
      && (!support || this.hasSupportEffect(skillId, player));
  }
  use(skillId, context) {
    const skill = skills[skillId];
    const cost = this.cost(skillId, context.player, context.battle);
    if (!skill || !this.canUse(skillId, context.player, context.battle)) return false;
    context.player.energy -= cost;
    const level = context.player.skillUpgrades[skillId] || 0;
    skill.effects.forEach((effect) => this.effects.resolve(scaleSkillEffect(effect, level), context));
    return true;
  }
}
