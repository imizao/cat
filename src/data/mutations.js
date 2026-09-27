export const mutations = {
  lunarRelay: {
    id: 'lunarRelay', skillId: 'moonPounce', name: '逐月', icon: '☾',
    description: '每场首次用月扑击倒敌人时，恢复 1 点能量'
  },
  spreadingInk: {
    id: 'spreadingInk', skillId: 'scratchMark', name: '洇墨', icon: '〽',
    description: '留痕命中时，其他存活敌人也获得 1 层抓伤'
  },
  dreamShell: {
    id: 'dreamShell', skillId: 'nap', name: '梦壳', icon: '◌',
    description: '小憩后，获得等同本次回复量的护盾'
  }
};

export function mutationForSkill(player, skillId) {
  return Object.values(mutations).find((mutation) => mutation.skillId === skillId && player.mutations?.includes(mutation.id));
}
