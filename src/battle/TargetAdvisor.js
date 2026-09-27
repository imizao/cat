import { skills } from '../data/skills.js';
import { scaleSkillEffect } from '../systems/SkillGrowth.js';

function projectedDamage(state, enemy, buffSystem, skillSystem) {
  const player = state.player;
  const temporaryBonus = (player.passiveId === 'firstCut' && state.firstDamage ? 1 : 0)
    + ((player.relics || []).includes('catBell') && state.firstSkill ? 1 : 0);

  return (player.skills || []).reduce((best, skillId) => {
    if (!skillSystem.canUse(skillId, player, state)) return best;
    const skill = skills[skillId];
    if (!skill) return best;
    const level = player.skillUpgrades?.[skillId] || 0;
    const damage = skill.effects.map((effect) => scaleSkillEffect(effect, level)).reduce((total, effect) => {
      if (effect.type !== 'damage' || effect.target === 'self') return total;
      const outgoing = buffSystem.modifyOutgoing(player, effect.value + temporaryBonus);
      return total + Math.floor(buffSystem.modifyIncoming(enemy, outgoing));
    }, 0);
    return Math.max(best, damage);
  }, 0);
}

function incomingThreat(state, enemy, intent, buffSystem) {
  if (intent?.type !== 'attack') return 0;
  const outgoing = buffSystem.modifyOutgoing(enemy, intent.value);
  return Math.floor(buffSystem.modifyIncoming(state.player, outgoing));
}

export function recommendTarget(state, buffSystem, skillSystem) {
  let best = null;

  state.enemies.forEach((enemy, index) => {
    if (enemy.hp <= 0) return;
    const intent = state.intents[index];
    const damage = projectedDamage(state, enemy, buffSystem, skillSystem);
    const effectiveHp = enemy.hp + enemy.shield;
    const threat = incomingThreat(state, enemy, intent, buffSystem);
    const scratch = enemy.buffs?.find((buff) => buff.id === 'scratch')?.stacks || 0;
    const diesToScratch = scratch >= enemy.hp;
    const canDefeatNow = damage > 0 && damage >= effectiveHp;
    const attacksNeeded = damage > 0 ? Math.ceil(effectiveHp / damage) : 99;

    let score = canDefeatNow ? 100000 : 0;
    score += threat * (canDefeatNow ? 1000 : 120);
    score += enemy.attack * 20;
    score -= attacksNeeded * 240 + effectiveHp * 4 + index;
    if (intent?.type === 'shield') score += 420 + intent.value * 120;
    if (intent?.type === 'heal' && enemy.hp < enemy.maxHp) score += 360 + intent.value * 100;
    if (intent?.type === 'buff') score += 180;
    if (diesToScratch) score -= 200000;

    let reason = '集中攻击，最快形成减员';
    if (canDefeatNow && threat) reason = `本回合可击倒，避免 ${threat} 点伤害`;
    else if (canDefeatNow) reason = '本回合可直接击倒';
    else if (intent?.type === 'shield') reason = '优先压制即将获得护盾的目标';
    else if (intent?.type === 'heal') reason = `优先打断即将回复的 ${intent.value} 点生命`;
    else if (threat >= 3) reason = `优先削弱高威胁目标（攻击 ${threat}）`;

    if (!best || score > best.score) best = { index, score, reason, projectedDamage: damage, canDefeatNow };
  });

  return best;
}
