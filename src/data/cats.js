export const cats = [
  { id: 'sunstripe', name: '曜斑', epithet: '守塔的暖橘', emoji: '🐈', color: '#e99a45', maxHp: 11, maxEnergy: 3, passive: { id: 'stoutHeart', name: '厚爪', description: '战斗开始获得1盾' }, skills: ['moonPounce', 'warmGroom', 'cloudFur', 'tailTrick'] },
  { id: 'inkwhisker', name: '砚尾', epithet: '月影中的墨客', emoji: '🐈‍⬛', color: '#64718f', maxHp: 11, maxEnergy: 4, passive: { id: 'firstCut', name: '先爪', description: '首次伤害 +1' }, skills: ['inkClaw', 'shadowStep', 'scratchMark', 'nightFocus'] },
  { id: 'milkdot', name: '雪团', epithet: '甜梦的旅猫', emoji: '🐱', color: '#efe2c0', maxHp: 11, maxEnergy: 3, passive: { id: 'softLanding', name: '软着陆', description: '每3层回复2血' }, skills: ['candyBonk', 'nap', 'brightBell', 'snackTime'] }
];
export const getCat = (id) => cats.find((cat) => cat.id === id);
