import * as THREE from 'three';
import { FloorGenerator } from './FloorGenerator.js';
import { FloorPool } from './FloorPool.js';

export class TowerSystem {
  constructor(scene, eventBus, animations, worldSeed) {
    this.events = eventBus; this.animations = animations;
    this.generator = new FloorGenerator(worldSeed);
    this.pool = new FloorPool(11);
    this.root = new THREE.Group();
    this.root.rotation.y = -0.12;
    scene.add(this.root);
    this.pool.items.forEach((item) => this.root.add(item.group));
    this.spacing = 4.8; this.currentFloor = 0; this.moving = false;
    this.bind(0);
  }
  bind(center) {
    this.currentFloor = center;
    this.pool.items.forEach((item, slot) => {
      const offset = slot - 5;
      const index = center + offset;
      item.configure(this.generator.generate(Math.max(0, index)), offset, this.spacing, this.pool.shared);
      item.group.visible = index >= 0;
    });
  }
  moveTo(floor, done) {
    if (this.moving) return;
    const delta = floor - this.currentFloor;
    if (delta === 0) { done?.(); return; }
    this.moving = true;
    const start = this.root.position.y;
    this.events.emit('tower:move', { from: this.currentFloor, to: floor });
    this.animations.tween({ duration: 760, update: (t) => { this.root.position.y = start - this.spacing * delta * t; this.root.rotation.y = -0.12 + Math.sin(t * Math.PI) * 0.035; }, complete: () => {
      this.root.position.y = 0; this.root.rotation.y = -0.12; this.bind(floor); this.moving = false; done?.();
    }});
  }
  getFloor(index) { return this.generator.generate(index); }
  setVisible(visible) { this.root.visible = visible; }
  update(elapsed) { if (this.root.visible) this.pool.update(elapsed); }
  get activeCount() { return this.pool.items.filter((item) => item.group.visible).length; }
}
