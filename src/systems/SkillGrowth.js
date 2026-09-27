const scalableValues = new Set(['damage', 'heal', 'shield', 'gainEnergy', 'loseEnergy']);

export function skillGrowthBonus(level = 0) {
  const safeLevel = Math.max(0, Math.floor(level));
  return safeLevel <= 6 ? safeLevel : 6 + Math.floor(Math.sqrt(safeLevel - 6));
}

export function scaleSkillEffect(effect, level = 0) {
  const bonus = skillGrowthBonus(level);
  if (!bonus) return effect;
  if (scalableValues.has(effect.type) && Number.isFinite(effect.value)) return { ...effect, value: effect.value + bonus };
  if (effect.type === 'applyBuff' && Number.isFinite(effect.stacks)) return {
    ...effect,
    stacks: effect.stacks + bonus,
    duration: Number.isFinite(effect.duration) ? effect.duration + Math.floor(bonus / 3) : effect.duration
  };
  return effect;
}
