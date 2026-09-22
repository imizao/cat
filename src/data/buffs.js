export const buffs = {
  bristled: { id: 'bristled', name: '炸毛', trigger: 'beforeDamage', description: '造成伤害提高' },
  timid: { id: 'timid', name: '胆怯', trigger: 'beforeDamage', description: '造成伤害降低' },
  exposed: { id: 'exposed', name: '露怯', trigger: 'beforeDamage', description: '受到伤害提高' },
  nimble: { id: 'nimble', name: '灵巧', trigger: 'beforeDamage', description: '受到伤害降低' },
  scratch: { id: 'scratch', name: '抓伤', trigger: 'turnStart', description: '回合开始失血' }
};
