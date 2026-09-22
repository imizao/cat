export const skills = {
  moonPounce: { id: 'moonPounce', name: '月扑', cost: 1, icon: '🐾', shortDescription: '造成3伤', effects: [{ type: 'damage', value: 3 }] },
  warmGroom: { id: 'warmGroom', name: '暖舔', cost: 1, icon: '✨', shortDescription: '回复2血', effects: [{ type: 'heal', value: 2, target: 'self' }] },
  cloudFur: { id: 'cloudFur', name: '云绒', cost: 1, icon: '☁️', shortDescription: '获得2盾', effects: [{ type: 'shield', value: 2, target: 'self' }] },
  tailTrick: { id: 'tailTrick', name: '尾戏', cost: 2, icon: '〰', shortDescription: '1伤，施加胆怯', effects: [{ type: 'damage', value: 1 }, { type: 'applyBuff', buffId: 'timid', stacks: 2, duration: 1 }] },
  inkClaw: { id: 'inkClaw', name: '墨爪', cost: 1, icon: '🌘', shortDescription: '造成3伤', effects: [{ type: 'damage', value: 3 }] },
  shadowStep: { id: 'shadowStep', name: '影步', cost: 1, icon: '◒', shortDescription: '获得1盾与灵巧', effects: [{ type: 'shield', value: 1, target: 'self' }, { type: 'applyBuff', buffId: 'nimble', stacks: 1, duration: 2, target: 'self' }] },
  scratchMark: { id: 'scratchMark', name: '留痕', cost: 1, icon: '〽', shortDescription: '1伤，施加抓伤', effects: [{ type: 'damage', value: 1 }, { type: 'applyBuff', buffId: 'scratch', stacks: 1, duration: 3 }] },
  nightFocus: { id: 'nightFocus', name: '夜凝', cost: 0, icon: '●', shortDescription: '获得1能量', effects: [{ type: 'gainEnergy', value: 1, target: 'self' }] },
  candyBonk: { id: 'candyBonk', name: '糖锤', cost: 1, icon: '🍬', shortDescription: '造成3伤', effects: [{ type: 'damage', value: 3 }] },
  nap: { id: 'nap', name: '小憩', cost: 2, icon: '💤', shortDescription: '回复3血', effects: [{ type: 'heal', value: 3, target: 'self' }] },
  brightBell: { id: 'brightBell', name: '响铃', cost: 1, icon: '🔔', shortDescription: '施加露怯', effects: [{ type: 'applyBuff', buffId: 'exposed', stacks: 1, duration: 2 }] },
  snackTime: { id: 'snackTime', name: '开饭', cost: 1, icon: '🐟', shortDescription: '2盾，获得1能量', effects: [{ type: 'shield', value: 2, target: 'self' }, { type: 'gainEnergy', value: 1, target: 'self' }] }
};
