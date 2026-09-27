export const MAX_SKILL_UPGRADE = 6;

export function healthOverflowLimit(entity) {
  return entity.maxHp + Math.max(2, Math.ceil(entity.maxHp * .5));
}

export function energyOverflowLimit(entity) {
  return entity.maxEnergy + 2;
}

export function gainHealth(entity, amount) {
  const before = entity.hp;
  entity.hp = Math.max(before, Math.min(healthOverflowLimit(entity), entity.hp + Math.max(0, amount)));
  return entity.hp - before;
}

export function gainEnergy(entity, amount) {
  const before = entity.energy;
  entity.energy = Math.max(before, Math.min(energyOverflowLimit(entity), entity.energy + Math.max(0, amount)));
  return entity.energy - before;
}
