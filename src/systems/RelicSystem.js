export class RelicSystem {
  onFloorEnter(player, floorIndex = 1) {
    let heal = player.relics.includes('driedFishBag') ? 1 : 0;
    if (player.passiveId === 'softLanding' && floorIndex % 3 === 0) heal += 1;
    player.hp = Math.min(player.maxHp, player.hp + heal);
    return heal;
  }
  onBattleStart(player) { if (player.relics.includes('oldBox')) player.shield += 2; }
  beforeSkill(player, battle) { return player.relics.includes('catBell') && battle.firstSkill ? 1 : 0; }
}
