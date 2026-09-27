export function getEnemyIntent(enemy, turn) {
  const skillPower = enemy.skillPower || 1;
  if (enemy.ai === 'guarded' && turn % 2 === 0) return { type: 'shield', value: skillPower, label: `结壳 +${skillPower}盾` };
  if (enemy.ai === 'mender' && turn % 4 === 0) return { type: 'heal', value: skillPower, label: `纸愈 +${skillPower}血` };
  if (enemy.ai === 'fickle' && turn % 3 === 0) return { type: 'buff', buffId: 'exposed', value: skillPower, label: `窥破：露怯 ${skillPower}` };
  if (enemy.ai === 'boss' && turn % 3 === 0) return { type: 'attack', value: enemy.attack + skillPower + 1, label: `重击 ${enemy.attack + skillPower + 1}` };
  const value = enemy.attack + (enemy.ai === 'fickle' && turn % 2 === 0 ? 1 : 0);
  return { type: 'attack', value, label: `攻击 ${value}` };
}
