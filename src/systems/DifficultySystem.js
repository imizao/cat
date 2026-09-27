export function difficultyForFloor(floor) {
  return 1 + floor * 0.035 + Math.pow(floor, 0.65) * 0.1;
}

export function scaleEnemy(template, floor, boss = false, multipliers = {}) {
  const difficulty = difficultyForFloor(floor);
  const growthLevel = Math.floor(Math.max(0, floor - 1) / 5);
  const combatTier = Math.max(0, Math.floor(Math.max(0, floor - 1) / 10) - 1);
  const skillPower = 1 + Math.floor(Math.sqrt(growthLevel));
  const bossMultiplier = boss ? 1.25 : 1;
  const hpMultiplier = multipliers.hp ?? 1;
  const attackMultiplier = multipliers.attack ?? 1;
  const maxHp = Math.max(2, Math.round(template.baseHp * (0.78 + difficulty * 0.22) * bossMultiplier * hpMultiplier) + combatTier * (boss ? 3 : 2));
  return {
    ...template,
    maxHp,
    hp: maxHp,
    attack: Math.max(1, Math.round((template.attack + Math.pow(floor, 0.55) * 0.22 + (boss ? 1 : 0)) * attackMultiplier) + combatTier),
    combatTier,
    growthLevel,
    skillPower,
    shield: 0,
    buffs: []
  };
}
