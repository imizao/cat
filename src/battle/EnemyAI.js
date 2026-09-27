const attackGrowthProfiles = {
  steady: { interval: 2, cap: 1 },
  fickle: { interval: 1, cap: 2 },
  guarded: { interval: 2, cap: 1 },
  mender: { interval: 4, cap: 1 },
  boss: { interval: 3, cap: 2 }
};

export function attackGrowthForTurn(enemy, turn) {
  const profile = attackGrowthProfiles[enemy.ai] || attackGrowthProfiles.steady;
  const depthBonus = Math.floor((enemy.growthLevel || 0) / 20);
  return Math.min(profile.cap + depthBonus, Math.floor(Math.max(0, turn - 1) / profile.interval));
}

export function getEnemyIntent(enemy, turn) {
  const skillPower = enemy.skillPower || 1;
  if (enemy.ai === 'guarded' && turn % 2 === 0) return { type: 'shield', value: skillPower, label: `结壳 +${skillPower}盾` };
  if (enemy.ai === 'mender' && turn % 4 === 0) return { type: 'heal', value: skillPower, label: `纸愈 +${skillPower}血` };
  if (enemy.ai === 'fickle' && turn % 3 === 0) return { type: 'buff', buffId: 'exposed', value: skillPower, label: `窥破：露怯 ${skillPower}` };
  const growth = attackGrowthForTurn(enemy, turn);
  const heavyBonus = enemy.ai === 'boss' && turn % 3 === 0 ? skillPower + 1 : 0;
  const value = enemy.attack + growth + heavyBonus;
  const action = heavyBonus ? '重击' : '攻击';
  return { type: 'attack', value, growth, label: `${action} ${value}${growth ? ` · 蓄势+${growth}` : ''}` };
}
