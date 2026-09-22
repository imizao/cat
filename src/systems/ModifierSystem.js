export class ModifierSystem {
  constructor(rule) { this.rule = rule; }
  get(key, fallback = 0) { return this.rule.modifiers[key] ?? fallback; }
}
