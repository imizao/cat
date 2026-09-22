import * as THREE from 'three';

const catGeometry = {
  head: new THREE.SphereGeometry(.5, 12, 9),
  body: new THREE.SphereGeometry(.45, 10, 8),
  ear: new THREE.ConeGeometry(.22, .48, 3),
  eye: new THREE.SphereGeometry(.05, 8, 6),
  tail: new THREE.TorusGeometry(.45, .08, 6, 12, Math.PI * 1.3)
};

function makeCat(color, dark = false) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: .76, flatShading: true });
  const accent = new THREE.MeshStandardMaterial({ color: dark ? 0xefe2b4 : 0x392f32, roughness: .7 });
  const head = new THREE.Mesh(catGeometry.head, material); head.scale.y = .88; group.add(head);
  const body = new THREE.Mesh(catGeometry.body, material); body.position.y = -.65; body.scale.set(.78, 1, .72); group.add(body);
  [-.32, .32].forEach((x) => { const ear = new THREE.Mesh(catGeometry.ear, material); ear.position.set(x, .48, 0); ear.rotation.z = x < 0 ? -.18 : .18; group.add(ear); });
  [-.18, .18].forEach((x) => { const eye = new THREE.Mesh(catGeometry.eye, accent); eye.position.set(x, .08, .47); group.add(eye); });
  const tail = new THREE.Mesh(catGeometry.tail, material); tail.position.set(.48, -.68, -.05); tail.rotation.set(0, 1.2, -.4); group.add(tail);
  return group;
}

export class ActorRenderer {
  constructor(scene, events, animations) {
    this.scene = scene; this.events = events; this.animations = animations;
    this.player = null; this.enemies = [];
    events.on('player:damage', ({ hpLoss }) => this.hit(this.player, hpLoss));
    events.on('enemy:damage', ({ target }) => {
      const object = this.enemies[target?.encounterIndex];
      this.hit(object);
      if (target?.hp <= 0 && object) this.defeat(object);
    });
    events.on('player:heal', () => this.pulse(this.player));
  }
  showPlayer(color) {
    if (this.player) this.scene.remove(this.player);
    this.player = makeCat(color); this.player.position.set(0, .35, 3.15); this.player.scale.setScalar(.72); this.player.userData.baseScale = .72; this.scene.add(this.player);
  }
  showEnemies(enemies) {
    this.hideEnemies();
    const positions = [
      { x: 2.65, y: 1.42, z: .35, rotation: -.35, scale: .72 },
      { x: 0, y: 2.72, z: -.35, rotation: 0, scale: .76 },
      { x: -2.65, y: 1.42, z: .35, rotation: .35, scale: .72 }
    ];
    this.enemies = enemies.map((enemy, index) => {
      const object = makeCat(enemy.color, true); const place = positions[index];
      object.position.set(place.x, place.y, place.z); object.rotation.y = place.rotation;
      object.scale.setScalar(place.scale); object.userData.baseScale = place.scale;
      this.scene.add(object); return object;
    });
  }
  hideEnemies() { this.enemies.forEach((enemy) => this.scene.remove(enemy)); this.enemies = []; }
  setPlayerVisible(visible) { if (this.player) this.player.visible = visible; }
  hit(object) {
    if (!object) return; const x = object.position.x;
    this.animations.tween({ duration: 240, update: (t) => { object.position.x = x + Math.sin(t * Math.PI * 6) * .11 * (1 - t); }, complete: () => { object.position.x = x; } });
  }
  pulse(object) {
    if (!object) return;
    const base = object.userData.baseScale || .72;
    this.animations.tween({ duration: 300, update: (t) => object.scale.setScalar(base + Math.sin(t * Math.PI) * .08), complete: () => object.scale.setScalar(base) });
  }
  defeat(object) {
    const startY = object.position.y; const base = object.userData.baseScale;
    this.animations.tween({ duration: 420, update: (t) => {
      object.position.y = startY - t * .45;
      object.scale.setScalar(base * (1 - t * .72));
    }, complete: () => { object.visible = false; } });
  }
  update(elapsed) {
    if (this.player) this.player.position.y = .35 + Math.sin(elapsed * 2.2) * .035;
    const bases = [1.42, 2.72, 1.42];
    this.enemies.forEach((enemy, index) => { enemy.position.y = bases[index] + Math.sin(elapsed * 1.8 + index) * .045; });
  }
}
