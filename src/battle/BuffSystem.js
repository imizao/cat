import { buffs as definitions } from '../data/buffs.js';

export class BuffSystem {
  add(entity, buffId, stacks = 1, duration = 1) {
    if (!definitions[buffId]) return;
    const current = entity.buffs.find((buff) => buff.id === buffId);
    if (current) { current.stacks += stacks; current.duration = Math.max(current.duration, duration); }
    else entity.buffs.push({ id: buffId, stacks, duration });
  }
  get(entity, id) { return entity.buffs.find((buff) => buff.id === id); }
  modifyOutgoing(entity, amount) {
    return Math.max(0, amount + (this.get(entity, 'bristled')?.stacks || 0) - (this.get(entity, 'timid')?.stacks || 0));
  }
  modifyIncoming(entity, amount) {
    return Math.max(0, amount + (this.get(entity, 'exposed')?.stacks || 0) - (this.get(entity, 'nimble')?.stacks || 0));
  }
  trigger(entity, trigger, callbacks = {}) {
    for (const buff of [...entity.buffs]) {
      if (definitions[buff.id]?.trigger === trigger && buff.id === 'scratch') callbacks.damage?.(buff.stacks, true);
    }
  }
  tick(entity) {
    entity.buffs.forEach((buff) => buff.duration--);
    entity.buffs = entity.buffs.filter((buff) => buff.duration > 0);
  }
}
