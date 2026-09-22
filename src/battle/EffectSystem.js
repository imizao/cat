import { applyDamage } from './Balance.js';

export class EffectSystem {
  constructor(buffSystem, eventBus) { this.buffs = buffSystem; this.events = eventBus; }
  resolve(effect, context) {
    const source = context.source;
    const target = effect.target === 'self' ? source : context.target;
    const upgraded = effect.type === 'damage' && target !== source ? (context.damageBonus || 0) : 0;
    switch (effect.type) {
      case 'damage': {
        let value = effect.value + upgraded;
        value = this.buffs.modifyOutgoing(source, value);
        value = this.buffs.modifyIncoming(target, value);
        const result = applyDamage(target, value, effect.piercing);
        this.events.emit(target === context.player ? 'player:damage' : 'enemy:damage', { target, ...result });
        return result;
      }
      case 'heal': {
        const before = target.hp;
        target.hp = Math.min(target.maxHp, target.hp + effect.value);
        this.events.emit(target === context.player ? 'player:heal' : 'enemy:heal', { amount: target.hp - before });
        break;
      }
      case 'shield':
        target.shield += effect.value;
        this.events.emit(target === context.player ? 'player:shield' : 'enemy:shield', { amount: effect.value });
        break;
      case 'gainEnergy': target.energy = Math.min(target.maxEnergy, target.energy + effect.value); break;
      case 'loseEnergy': target.energy = Math.max(0, target.energy - effect.value); break;
      case 'applyBuff': this.buffs.add(target, effect.buffId, effect.stacks, effect.duration); break;
      case 'drawSkillModifier': context.player.skillUpgrades[effect.skillId] = (context.player.skillUpgrades[effect.skillId] || 0) + effect.value; break;
      default: console.warn(`Unknown effect: ${effect.type}`);
    }
  }
}
