const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export class AnimationManager {
  constructor() { this.tweens = []; }
  tween({ duration = 500, update, complete, easing = easeOutCubic }) {
    this.tweens.push({ start: performance.now(), duration, update, complete, easing });
  }
  update(now) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const item = this.tweens[i];
      const t = Math.min(1, (now - item.start) / item.duration);
      item.update(item.easing(t));
      if (t >= 1) { this.tweens.splice(i, 1); item.complete?.(); }
    }
  }
  clear() { this.tweens.length = 0; }
}
