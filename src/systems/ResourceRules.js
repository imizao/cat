export function energyOverflowLimit(entity) {
  return entity.maxEnergy + 2;
}

export function gainHealth(entity, amount) {
  const before = entity.hp;
  entity.hp += Math.max(0, amount);
  return entity.hp - before;
}

export function gainEnergy(entity, amount) {
  const before = entity.energy;
  entity.energy = Math.max(before, Math.min(energyOverflowLimit(entity), entity.energy + Math.max(0, amount)));
  return entity.energy - before;
}

export function restoreEnergy(entity, amount) {
  const before = entity.energy;
  entity.energy = Math.max(before, Math.min(entity.maxEnergy, entity.energy + Math.max(0, amount)));
  return entity.energy - before;
}
