export function getEnemyIntent(enemy, turn) {
  if (enemy.ai === 'guarded' && turn % 2 === 0) return { type: 'shield', value: 3, label: `结壳 +3盾` };
  if (enemy.ai === 'fickle' && turn % 3 === 0) return { type: 'buff', buffId: 'exposed', value: 1, label: '窥破：露怯' };
  if (enemy.ai === 'boss' && turn % 3 === 0) return { type: 'attack', value: enemy.attack + 2, label: `重击 ${enemy.attack + 2}` };
  const value = enemy.attack + (enemy.ai === 'fickle' && turn % 2 === 0 ? 1 : 0);
  return { type: 'attack', value, label: `攻击 ${value}` };
}
