const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export class AnimationManager {
  constructor() { this.tweens = []; this.pausedAt = 0; }
  tween({ duration = 500, update, complete, easing = easeOutCubic }) {
    this.tweens.push({ start: performance.now(), duration, update, complete, easing });
  }
  update(now) {
    if (this.pausedAt) return;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const item = this.tweens[i];
      const t = Math.min(1, (now - item.start) / item.duration);
      item.update(item.easing(t));
      if (t >= 1) { this.tweens.splice(i, 1); item.complete?.(); }
    }
  }
  pause(now = performance.now()) { if (!this.pausedAt) this.pausedAt = now; }
  resume(now = performance.now()) {
    if (!this.pausedAt) return;
    const offset = now - this.pausedAt;
    this.tweens.forEach((item) => { item.start += offset; });
    this.pausedAt = 0;
  }
  clear() { this.tweens.length = 0; }
}
