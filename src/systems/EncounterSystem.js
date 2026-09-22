import { enemies, bosses } from '../data/enemies.js';
import { FloorType } from '../tower/FloorGenerator.js';
import { scaleEnemy } from './DifficultySystem.js';

export function createEnemyParty(floor) {
  const templates = [...enemies, ...bosses];
  return floor.enemyIds.map((id, index) => {
    const template = templates.find((item) => item.id === id) || enemies[0];
    const bossSeat = floor.type === FloorType.BOSS && index === 1;
    const elite = floor.type === FloorType.ELITE;
    return scaleEnemy(template, floor.index, bossSeat || elite, {
      hp: bossSeat ? .5 : elite ? .52 : .38,
      attack: bossSeat ? .45 : elite ? .45 : .34
    });
  });
}
