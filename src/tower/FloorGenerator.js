import { SeededRandom, floorSeed } from '../core/SeededRandom.js';
import { enemies, bosses } from '../data/enemies.js';

export const FloorType = { BATTLE: 'BATTLE', ELITE: 'ELITE', REST: 'REST', SHOP: 'SHOP', EVENT: 'EVENT', TREASURE: 'TREASURE', BOSS: 'BOSS' };

export class FloorGenerator {
  constructor(worldSeed) { this.worldSeed = worldSeed; }
  generate(index) {
    const rng = new SeededRandom(floorSeed(this.worldSeed, index));
    let type;
    if (index > 0 && index % 10 === 0) type = FloorType.BOSS;
    else if (index === 1) type = FloorType.BATTLE;
    else {
      const roll = rng.random();
      const eventBoost = index % 5 === 0 ? 0.08 : 0;
      if (roll < 0.58 - eventBoost) type = FloorType.BATTLE;
      else if (roll < 0.68) type = FloorType.REST;
      else if (roll < 0.78) type = FloorType.TREASURE;
      else if (roll < 0.87) type = FloorType.ELITE;
      else if (roll < 0.94 + eventBoost) type = FloorType.EVENT;
      else type = FloorType.SHOP;
    }
    const enemyPool = type === FloorType.BOSS ? bosses : enemies;
    const candidates = [...enemies];
    const takeEnemy = () => candidates.splice(rng.int(0, candidates.length - 1), 1)[0].id;
    const enemyIds = type === FloorType.BOSS
      ? [takeEnemy(), rng.pick(bosses).id, takeEnemy()]
      : [takeEnemy(), takeEnemy(), takeEnemy()];
    return {
      index,
      type,
      enemyId: rng.pick(enemyPool).id,
      enemyIds,
      theme: rng.int(0, 2),
      roofScale: rng.range(0.86, 1.18),
      floorHeight: rng.range(1.8, 2.35),
      pillarCount: rng.int(4, 8),
      rotation: rng.range(-0.09, 0.09),
      decoration: rng.int(2, 6),
      windowColor: rng.pick(['amber', 'jade', 'violet']),
      eventVariant: rng.int(0, 3)
    };
  }
}
