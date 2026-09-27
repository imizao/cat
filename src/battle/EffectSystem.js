import { applyDamage } from './Balance.js';
import { gainEnergy, gainHealth } from '../systems/ResourceRules.js';

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
        this.events.emit(target === context.player ? 'player:damage' : 'enemy:damage', { target, source, effect, visualDelay: context.visualDelay || 0, ...result });
        return result;
      }
      case 'heal': {
        const amount = gainHealth(target, effect.value);
        this.events.emit(target === context.player ? 'player:heal' : 'enemy:heal', { amount });
        break;
      }
      case 'shield': {
        const before = target.shield;
        target.shield = Math.max(target.shield, effect.value);
        const amount = target.shield - before;
        if (amount) this.events.emit(target === context.player ? 'player:shield' : 'enemy:shield', { amount });
        break;
      }
      case 'gainEnergy': {
        const overflowBefore = Math.max(0, target.energy - target.maxEnergy);
        const amount = gainEnergy(target, effect.value);
        const overflowAfter = Math.max(0, target.energy - target.maxEnergy);
        const overflowGained = overflowAfter - overflowBefore;
        if (target === context.player && context.battle && overflowGained > 0) context.battle.pursuitCharge += overflowGained;
        break;
      }
      case 'loseEnergy': target.energy = Math.max(0, target.energy - effect.value); break;
      case 'applyBuff': this.buffs.add(target, effect.buffId, effect.stacks, effect.duration); break;
      case 'drawSkillModifier': context.player.skillUpgrades[effect.skillId] = (context.player.skillUpgrades[effect.skillId] || 0) + effect.value; break;
      default: console.warn(`Unknown effect: ${effect.type}`);
    }
  }
}
