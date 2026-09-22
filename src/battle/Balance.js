export function applyDamage(target, amount, piercing = false) {
  const incoming = Math.max(0, Math.floor(amount));
  const absorbed = piercing ? 0 : Math.min(target.shield, incoming);
  target.shield -= absorbed;
  const hpLoss = incoming - absorbed;
  target.hp = Math.max(0, target.hp - hpLoss);
  return { amount: incoming, absorbed, hpLoss };
}
