import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';

const colors = {
  ink: 0x07191d, panel: 0x10292b, panelDeep: 0x08191b, gold: 0xe8c76f,
  cream: 0xfff4cf, quiet: 0x9fb3ae, red: 0xff806d, green: 0x75e6aa,
  cyan: 0x8bd2da, energy: 0xffdb75
};

const floatColors = { damage: colors.red, heal: colors.green, 'shield-float': colors.cyan, 'energy-float': colors.energy, 'mutation-float': colors.gold };

export class PixiUILayer {
  constructor(container, root, events) {
    this.container = container;
    this.root = root;
    this.events = events;
    this.app = new Application();
    this.ready = false;
    this.destroyed = false;
    this.width = Math.max(1, container.clientWidth);
    this.height = Math.max(1, container.clientHeight);
    this.resolution = Math.min(2, Math.max(1, Math.floor(window.devicePixelRatio || 1)));
    this.hudState = null;
    this.playerState = null;
    this.enemyState = null;
    this.overlayState = null;
    this.centerState = null;
    this.floatPool = [];
    this.activeFloats = [];
    this.onClickCapture = (event) => this.routeUIEvent(event);
    root.addEventListener('click', this.onClickCapture, true);
    this.init();
  }

  async init() {
    await this.app.init({
      width: this.width, height: this.height, resolution: this.resolution,
      autoDensity: true, autoStart: false, backgroundAlpha: 0,
      antialias: true, preference: 'webgl', powerPreference: 'high-performance'
    });
    if (this.destroyed) { this.app.destroy(true); return; }
    this.app.stop();
    this.app.canvas.className = 'pixi-ui-canvas';
    this.app.canvas.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.app.canvas);
    this.hudLayer = new Container();
    this.battleLayer = new Container();
    this.modalLayer = new Container();
    this.fxLayer = new Container();
    this.app.stage.addChild(this.hudLayer, this.battleLayer, this.modalLayer, this.fxLayer);
    this.ready = true;
    this.root.querySelector('.game-shell')?.classList.add('pixi-ready');
    this.resize(this.width, this.height, this.resolution);
    this.rebuild();
  }

  routeUIEvent(event) {
    if (!this.ready) return;
    const action = event.target.closest?.('[data-action]');
    if (!action || action.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.events.emit('ui:action', { action: action.dataset.action, value: action.dataset.value, source: 'pixi' });
  }

  resize(width, height, resolution = this.resolution) {
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    this.resolution = Math.min(2, Math.max(1, Math.floor(resolution || 1)));
    if (!this.ready) return;
    this.app.renderer.resolution = this.resolution;
    this.app.renderer.resize(this.width, this.height);
    this.rebuild();
  }

  text(value, options = {}) {
    const style = new TextStyle({
      fontFamily: options.fontFamily || "system-ui, 'PingFang SC', sans-serif",
      fontSize: options.size || 12, fontWeight: options.weight || '500',
      fill: options.fill || colors.cream, letterSpacing: options.spacing || 0,
      align: options.align || 'left', dropShadow: options.shadow === false ? null : { color: 0x000000, alpha: 0.62, blur: 4, distance: 2 }
    });
    const node = new Text({ text: String(value), style });
    node.anchor.set(options.anchorX ?? 0, options.anchorY ?? 0);
    node.position.set(options.x || 0, options.y || 0);
    return node;
  }

  localRect(element) {
    if (!element) return null;
    const rootRect = this.root.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return { x: rect.left - rootRect.left, y: rect.top - rootRect.top, width: rect.width, height: rect.height };
  }

  clear(container) {
    const removed = container.removeChildren();
    removed.forEach((child) => child.destroy({ children: true }));
  }

  rebuild() {
    if (!this.ready) return;
    this.clear(this.hudLayer); this.clear(this.battleLayer); this.clear(this.modalLayer);
    this.drawHud(); this.drawPlayer(); this.drawEnemies(); this.drawCenter(); this.drawOverlay();
  }

  drawHud() {
    if (!this.hudState) return;
    const { floor, currency, essence, weekly } = this.hudState;
    this.hudLayer.addChild(this.text('月爪天塔', { x: 20, y: 16, size: 10, weight: '700', fill: colors.gold, spacing: 2.2 }));
    this.hudLayer.addChild(this.text(floor, { x: 20, y: 34, size: 30, weight: '700', fontFamily: "'STKaiti','KaiTi',serif" }));
    const resource = new Graphics().roundRect(this.width - 151, 20, 112, 31, 13).fill({ color: colors.panelDeep, alpha: 0.58 }).stroke({ color: colors.gold, alpha: 0.28, width: 1 });
    this.hudLayer.addChild(resource);
    this.hudLayer.addChild(this.text(`🐟 ${currency}`, { x: this.width - 139, y: 29, size: 12, weight: '700' }));
    this.hudLayer.addChild(this.text(`✦ ${essence}`, { x: this.width - 82, y: 29, size: 12, weight: '700', fill: colors.cream }));
    this.hudLayer.addChild(this.text('本周法则', { x: this.width - 20, y: 74, size: 9, fill: colors.quiet, spacing: 1.1, anchorX: 1 }));
    this.hudLayer.addChild(this.text(weekly || '月潮', { x: this.width - 20, y: 89, size: 13, fill: colors.gold, spacing: 1.5, anchorX: 1 }));
  }

  drawPlayer() {
    const state = this.playerState;
    if (!state?.visible) return;
    const dock = this.localRect(this.root.querySelector('[data-ref="playerDock"]'));
    if (!dock || dock.height < 10) return;
    const wash = new Graphics().rect(0, dock.y - 34, this.width, dock.height + 34).fill({ color: 0x031012, alpha: 0.82 });
    this.battleLayer.addChild(wash);
    const portrait = new Graphics().circle(43, dock.y + 31, 22).fill(0xd8b773).stroke({ color: 0x514333, width: 2 });
    this.battleLayer.addChild(portrait, this.text(state.icon, { x: 43, y: dock.y + 30, size: 27, anchorX: 0.5, anchorY: 0.5, shadow: false }));
    this.battleLayer.addChild(this.text(state.name, { x: 76, y: dock.y + 12, size: 22, weight: '700', fontFamily: "'STKaiti','KaiTi',serif" }));
    this.battleLayer.addChild(this.text(state.passive, { x: 77, y: dock.y + 38, size: 9, fill: colors.quiet }));
    const stats = [
      ['生命', `${state.hp}/${state.maxHp}`, colors.red],
      [state.energyLabel || '能量', `${state.energy}/${state.maxEnergy}`, colors.energy],
      ['护盾', state.shield || '—', colors.cyan]
    ];
    stats.forEach(([label, value, color], index) => {
      const x = this.width - 130 + index * 47;
      this.battleLayer.addChild(this.text(label, { x, y: dock.y + 10, size: 7, fill: colors.quiet, anchorX: 1 }));
      this.battleLayer.addChild(this.text(value, { x, y: dock.y + 26, size: 12, weight: '700', fill: color, anchorX: 1 }));
    });
    if (state.buffs) this.battleLayer.addChild(this.text(state.buffs, { x: 76, y: dock.y + 52, size: 8, fill: colors.gold }));
    state.skills?.forEach((skill, index) => this.drawSkill(skill, index));
  }

  drawSkill(skill, index) {
    const elements = this.root.querySelectorAll('[data-action="skill"]');
    const rect = this.localRect(elements[index]);
    if (!rect) return;
    const alpha = skill.disabled ? 0.42 : 0.96;
    const card = new Graphics().roundRect(rect.x, rect.y, rect.width, rect.height, 10).fill({ color: colors.panel, alpha }).stroke({ color: skill.disabled ? 0x61716e : colors.gold, alpha: 0.38, width: 1 });
    this.battleLayer.addChild(card);
    this.battleLayer.addChild(this.text(skill.icon, { x: rect.x + rect.width / 2, y: rect.y + 10, size: 18, anchorX: 0.5, shadow: false }));
    this.battleLayer.addChild(this.text(skill.name, { x: rect.x + rect.width / 2, y: rect.y + 34, size: 12, weight: '700', anchorX: 0.5 }));
    this.battleLayer.addChild(this.text(skill.description, { x: rect.x + rect.width / 2, y: rect.y + 53, size: 8, fill: colors.quiet, anchorX: 0.5 }));
    if (skill.mutation) this.battleLayer.addChild(this.text(skill.mutation, { x: rect.x + 6, y: rect.y + 5, size: 7, fill: colors.gold }));
    const badge = new Graphics().roundRect(rect.x + rect.width - 27, rect.y - 5, 28, 16, 8).fill(skill.disabled ? 0x6c716c : 0xd8ad46);
    this.battleLayer.addChild(badge, this.text(`${skill.cost}⚡`, { x: rect.x + rect.width - 13, y: rect.y + 3, size: 9, weight: '800', fill: 0x18282a, anchorX: 0.5, anchorY: 0.5, shadow: false }));
  }

  drawEnemies() {
    const state = this.enemyState;
    if (!state?.visible) return;
    const elements = this.root.querySelectorAll('[data-action="target"]');
    state.enemies.forEach((enemy, index) => {
      const rect = this.localRect(elements[index]);
      if (!rect) return;
      const alpha = enemy.defeated ? 0.28 : 0.9;
      const border = enemy.selected || enemy.recommended ? colors.gold : Number.parseInt(enemy.color.slice(1), 16);
      const card = new Graphics().roundRect(rect.x, rect.y, rect.width, rect.height, 10).fill({ color: colors.panelDeep, alpha }).stroke({ color: border, alpha: 0.8, width: enemy.selected ? 2 : 1 });
      this.battleLayer.addChild(card);
      this.battleLayer.addChild(this.text(enemy.icon, { x: rect.x + 19, y: rect.y + 28, size: 22, anchorX: 0.5, shadow: false }));
      this.battleLayer.addChild(this.text(enemy.title, { x: rect.x + 35, y: rect.y + 7, size: 7, fill: colors.quiet }));
      this.battleLayer.addChild(this.text(enemy.name, { x: rect.x + 35, y: rect.y + 20, size: 13, weight: '700' }));
      this.battleLayer.addChild(this.text(enemy.intent, { x: rect.x + 35, y: rect.y + 40, size: 8, fill: colors.gold }));
      const barY = rect.y + rect.height - 15;
      this.battleLayer.addChild(new Graphics().rect(rect.x + 7, barY, rect.width - 14, 4).fill(0x230d11));
      this.battleLayer.addChild(new Graphics().rect(rect.x + 7, barY, (rect.width - 14) * enemy.ratio, 4).fill(0xdc6b5d));
      this.battleLayer.addChild(this.text(enemy.health, { x: rect.x + rect.width - 7, y: rect.y + rect.height - 10, size: 8, fill: colors.quiet, anchorX: 1 }));
      if (enemy.recommended) this.battleLayer.addChild(this.text('★ 推荐攻击', { x: rect.x + rect.width - 5, y: rect.y + rect.height + 6, size: 8, weight: '800', fill: colors.gold, anchorX: 1 }));
    });
  }

  buttonFrame(rect, label, primary = false) {
    if (!rect) return;
    const frame = new Graphics().roundRect(rect.x, rect.y, rect.width, rect.height, 10)
      .fill({ color: primary ? 0xd4ad55 : colors.panel, alpha: primary ? 0.97 : 0.9 })
      .stroke({ color: colors.gold, alpha: primary ? 0.95 : 0.52, width: 1 });
    this.modalLayer.addChild(frame, this.text(label, {
      x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, size: 13,
      weight: '800', fill: primary ? colors.ink : colors.cream, anchorX: 0.5, anchorY: 0.5
    }));
  }

  drawCenter() {
    const state = this.centerState;
    if (!state?.visible) return;
    const host = this.localRect(this.root.querySelector('[data-ref="centerAction"]'));
    const button = this.localRect(this.root.querySelector('[data-ref="centerAction"] [data-action]'));
    if (!host) return;
    if (state.kind === 'moment') {
      this.modalLayer.addChild(new Graphics().roundRect(host.x + 20, host.y - 8, host.width - 40, host.height + 16, 14)
        .fill({ color: colors.panelDeep, alpha: 0.88 }).stroke({ color: colors.gold, alpha: 0.48, width: 1 }));
      this.modalLayer.addChild(this.text('✦', { x: this.width / 2, y: host.y + 11, size: 14, fill: colors.gold, anchorX: 0.5 }));
      this.modalLayer.addChild(this.text(state.title, { x: this.width / 2, y: host.y + 31, size: 26, weight: '700', anchorX: 0.5, fontFamily: "'STKaiti','KaiTi',serif" }));
      this.modalLayer.addChild(this.text(state.copy, { x: this.width / 2, y: host.y + 65, size: 11, fill: colors.quiet, anchorX: 0.5 }));
    } else {
      this.modalLayer.addChild(this.text(state.title, { x: this.width / 2, y: host.y, size: 10, fill: colors.gold, spacing: 2.2, anchorX: 0.5 }));
      if (button) this.modalLayer.addChild(this.text(state.hint, { x: this.width / 2, y: button.y + button.height + 8, size: 8, fill: colors.quiet, anchorX: 0.5 }));
    }
    this.buttonFrame(button, state.label, true);
  }

  drawOverlay() {
    const state = this.overlayState;
    if (!state?.visible) return;
    this.modalLayer.addChild(new Graphics().rect(0, 0, this.width, this.height).fill({ color: colors.ink, alpha: state.kind === 'reward' ? 0.91 : 0.95 }));
    if (state.kind === 'start') {
      const actions = [...this.root.querySelectorAll('[data-ref="overlay"] [data-action]')];
      const first = this.localRect(actions[0]);
      const baseY = first ? Math.max(150, first.y - 275) : this.height * 0.38;
      this.modalLayer.addChild(new Graphics().circle(53, baseY, 28).stroke({ color: colors.gold, alpha: 0.8, width: 1 }));
      this.modalLayer.addChild(this.text('ฅ', { x: 53, y: baseY, size: 30, fill: colors.gold, anchorX: 0.5, anchorY: 0.5 }));
      this.modalLayer.addChild(this.text('向月而行 · 永无塔顶', { x: 24, y: baseY + 49, size: 10, fill: colors.gold, spacing: 2.2 }));
      this.modalLayer.addChild(this.text('月爪', { x: 21, y: baseY + 69, size: 67, weight: '700', fontFamily: "'STKaiti','KaiTi',serif" }));
      this.modalLayer.addChild(this.text('天塔', { x: 93, y: baseY + 124, size: 67, weight: '700', fill: colors.gold, fontFamily: "'STKaiti','KaiTi',serif" }));
      this.modalLayer.addChild(this.text('猫客环阵，一爪定回合。', { x: 24, y: baseY + 201, size: 12, fill: colors.quiet, spacing: 1 }));
      actions.forEach((node) => this.buttonFrame(this.localRect(node), node.textContent.trim(), node.dataset.action === 'continue' || node.dataset.action === 'new' && !state.hasSave));
      return;
    }
    if (state.kind === 'cats') {
      this.modalLayer.addChild(this.text('选择旅伴', { x: 25, y: 61, size: 10, fill: colors.gold, spacing: 3 }));
      this.modalLayer.addChild(this.text('哪一双爪，\n叩响第一重门？', { x: 24, y: 82, size: 34, weight: '700', fontFamily: "'STKaiti','KaiTi',serif" }));
      const nodes = this.root.querySelectorAll('[data-action="selectCat"]');
      state.cats.forEach((cat, index) => {
        const rect = this.localRect(nodes[index]); if (!rect) return;
        this.modalLayer.addChild(new Graphics().roundRect(rect.x, rect.y, rect.width, rect.height, 13).fill({ color: colors.panel, alpha: 0.72 }).stroke({ color: Number.parseInt(cat.color.slice(1), 16), alpha: 0.55, width: 1 }));
        this.modalLayer.addChild(this.text(cat.emoji, { x: rect.x + 39, y: rect.y + rect.height / 2, size: 37, anchorX: 0.5, anchorY: 0.5, shadow: false }));
        this.modalLayer.addChild(this.text(cat.name, { x: rect.x + 82, y: rect.y + 16, size: 23, weight: '700', fontFamily: "'STKaiti','KaiTi',serif" }));
        this.modalLayer.addChild(this.text(cat.epithet, { x: rect.x + 82, y: rect.y + 47, size: 10, fill: colors.quiet }));
        this.modalLayer.addChild(this.text(`${cat.maxHp}♥ · ${cat.maxEnergy}⚡ · ${cat.passive}`, { x: rect.x + 82, y: rect.y + 67, size: 9, fill: colors.gold }));
      });
      return;
    }
    if (state.kind === 'reward') {
      const nodes = this.root.querySelectorAll('[data-action="reward"]');
      const first = this.localRect(nodes[0]);
      const headingY = first ? first.y - 112 : this.height * 0.42;
      this.modalLayer.addChild(this.text('三选一', { x: 24, y: headingY, size: 10, fill: colors.gold, spacing: 3 }));
      this.modalLayer.addChild(this.text(state.title, { x: 23, y: headingY + 19, size: 37, weight: '700', fontFamily: "'STKaiti','KaiTi',serif" }));
      this.modalLayer.addChild(this.text('选择会留在这次旅途中', { x: 24, y: headingY + 68, size: 10, fill: colors.quiet }));
      state.rewards.forEach((reward, index) => {
        const rect = this.localRect(nodes[index]); if (!rect) return;
        this.modalLayer.addChild(new Graphics().roundRect(rect.x, rect.y, rect.width, rect.height, 9).fill({ color: reward.mutation ? 0x38412e : colors.panel, alpha: 0.94 }).stroke({ color: colors.gold, alpha: reward.mutation ? 0.75 : 0.38, width: 1 }));
        this.modalLayer.addChild(this.text(reward.icon, { x: rect.x + 27, y: rect.y + rect.height / 2, size: 25, anchorX: 0.5, anchorY: 0.5, shadow: false }));
        this.modalLayer.addChild(this.text(reward.name, { x: rect.x + 57, y: rect.y + 15, size: 14, weight: '700' }));
        this.modalLayer.addChild(this.text(reward.description, { x: rect.x + 57, y: rect.y + 39, size: 10, fill: colors.quiet }));
      });
      return;
    }
    if (state.kind === 'defeat') {
      this.modalLayer.addChild(this.text('爪', { x: this.width / 2, y: this.height * 0.36, size: 52, fill: colors.red, anchorX: 0.5 }));
      this.modalLayer.addChild(this.text('月色暗了一瞬', { x: this.width / 2, y: this.height * 0.46, size: 34, weight: '700', anchorX: 0.5, fontFamily: "'STKaiti','KaiTi',serif" }));
      this.modalLayer.addChild(this.text(`止步于第 ${state.floor} 层`, { x: this.width / 2, y: this.height * 0.53, size: 12, fill: colors.quiet, anchorX: 0.5 }));
      this.buttonFrame(this.localRect(this.root.querySelector('[data-ref="overlay"] [data-action]')), '重新出发', true);
    }
  }

  updateHud(state) { this.hudState = state; this.rebuild(); }
  updatePlayer(state) { this.playerState = state; this.rebuild(); }
  updateEnemies(state) { this.enemyState = state; this.rebuild(); }
  showOverlay(state) { this.overlayState = state; this.rebuild(); }
  showCenter(state) { this.centerState = state; this.rebuild(); }

  showSkill(skill) {
    if (!this.ready) return;
    const group = new Container();
    const line = new Graphics().roundRect(-82, -18, 164, 36, 8).fill({ color: colors.panelDeep, alpha: 0.84 }).stroke({ color: colors.gold, alpha: 0.75, width: 1 });
    group.addChild(line, this.text(`${skill.icon}  ${skill.name}`, { size: 17, weight: '700', fill: colors.gold, anchorX: 0.5, anchorY: 0.5 }));
    group.position.set(this.width / 2, this.height * 0.53); group.alpha = 0; group.scale.set(0.88);
    this.fxLayer.addChild(group);
    this.animate(group, 720, (t) => { group.alpha = Math.sin(Math.PI * t); group.y = this.height * 0.53 - t * 22; group.scale.set(0.88 + Math.sin(Math.PI * t) * 0.12); });
  }

  float(value, kind = 'damage', enemyIndex = null) {
    if (!this.ready) return;
    const node = this.floatPool.pop() || this.text('', { size: 21, weight: '900', anchorX: 0.5, anchorY: 0.5 });
    node.text = value; node.style.fill = floatColors[kind] || colors.red; node.alpha = 0; node.scale.set(0.82);
    const positions = [{ x: 0.77, y: 0.43 }, { x: 0.5, y: 0.27 }, { x: 0.23, y: 0.43 }];
    const point = enemyIndex === null ? { x: 0.5, y: 0.7 } : positions[enemyIndex] || positions[0];
    node.position.set(this.width * point.x, this.height * point.y);
    this.fxLayer.addChild(node);
    this.animate(node, 760, (t) => { node.alpha = Math.sin(Math.PI * t); node.y = this.height * point.y - t * 62; node.scale.set(0.82 + t * 0.3); }, () => this.floatPool.push(node), false);
  }

  impact(strong = false) {
    if (!this.ready) return;
    const flash = new Graphics().rect(0, 0, this.width, this.height).fill({ color: 0xffedb1, alpha: 0.2 });
    this.fxLayer.addChild(flash);
    this.animate(flash, strong ? 300 : 220, (t) => { flash.alpha = (1 - t) * (strong ? 0.55 : 0.32); });
  }

  animate(target, duration, update, complete, destroy = true) {
    this.activeFloats.push({ target, duration, elapsed: 0, update, complete, destroy });
  }

  update(delta) {
    if (!this.ready) return;
    for (let index = this.activeFloats.length - 1; index >= 0; index--) {
      const item = this.activeFloats[index]; item.elapsed += delta * 1000;
      const t = Math.min(1, item.elapsed / item.duration); item.update(t);
      if (t >= 1) {
        this.activeFloats.splice(index, 1); item.target.removeFromParent();
        if (item.destroy) item.target.destroy?.({ children: true });
        item.complete?.();
      }
    }
  }

  render() { if (this.ready) this.app.render(); }
  pause() { if (this.ready) this.app.stop(); }
  resume() { if (this.ready) this.app.stop(); }
  objectCount() { return this.ready ? this.app.stage.children.reduce((total, layer) => total + layer.children.length, 0) : 0; }

  destroy() {
    this.destroyed = true;
    this.root.removeEventListener('click', this.onClickCapture, true);
    this.root.querySelector('.game-shell')?.classList.remove('pixi-ready');
    if (this.ready) this.app.destroy(true, { children: true, texture: true });
  }
}
