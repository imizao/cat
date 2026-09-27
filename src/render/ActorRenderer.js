import * as THREE from 'three';

const catGeometry = {
  head: new THREE.SphereGeometry(.5, 12, 9),
  body: new THREE.SphereGeometry(.45, 10, 8),
  ear: new THREE.ConeGeometry(.22, .48, 3),
  eye: new THREE.SphereGeometry(.05, 8, 6),
  tail: new THREE.TorusGeometry(.45, .08, 6, 12, Math.PI * 1.3)
};

const skillLooks = {
  moonPounce: { color: 0xffd978, kind: 'claw', strong: true },
  inkClaw: { color: 0xa88cff, kind: 'claw', strong: true },
  tailTrick: { color: 0x73ddd1, kind: 'arc' },
  scratchMark: { color: 0xff806d, kind: 'claw' },
  candyBonk: { color: 0xff8fbd, kind: 'orb', strong: true },
  brightBell: { color: 0xffe28a, kind: 'ring' },
  warmGroom: { color: 0x78efb1, kind: 'aura' },
  nap: { color: 0x9dc6ff, kind: 'aura' },
  cloudFur: { color: 0x8fe7ed, kind: 'aura' },
  shadowStep: { color: 0x9c83e8, kind: 'aura' },
  nightFocus: { color: 0xd7c1ff, kind: 'aura' },
  snackTime: { color: 0xffd36c, kind: 'aura' }
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
    this.targetRing = this.makeTargetRing();
    events.on('battle:update', (state) => this.selectTarget(state));
    events.on('target:selected', ({ index }) => this.confirmTarget(index));
    events.on('skill:cast', ({ skillId, skill, target }) => this.castSkill(skillId, skill, target));
    events.on('battle:enemy-acting', ({ enemy, intent }) => this.enemyAction(enemy, intent));
    events.on('player:damage', ({ hpLoss, visualDelay }) => this.after(visualDelay, () => this.hit(this.player, hpLoss, true)));
    events.on('enemy:damage', ({ target, hpLoss, visualDelay }) => {
      const object = this.enemies[target?.encounterIndex];
      this.after(visualDelay, () => {
        this.hit(object, hpLoss);
        if (target?.hp <= 0 && object) this.defeat(object);
      });
    });
    events.on('player:heal', () => this.pulse(this.player, 0x78efb1));
    events.on('player:shield', () => this.pulse(this.player, 0x8fe7ed));
  }
  after(delay = 0, callback) {
    if (!delay) { callback(); return; }
    this.animations.tween({ duration: delay, update: () => {}, complete: callback });
  }
  makeTargetRing() {
    const ring = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0xffdc7a, transparent: true, opacity: .82, depthWrite: false });
    const outer = new THREE.Mesh(new THREE.TorusGeometry(.58, .025, 6, 40), material);
    outer.rotation.x = Math.PI / 2; ring.add(outer);
    for (let i = 0; i < 3; i++) {
      const marker = new THREE.Mesh(new THREE.ConeGeometry(.07, .2, 3), material);
      const angle = i * Math.PI * 2 / 3;
      marker.position.set(Math.cos(angle) * .7, 0, Math.sin(angle) * .7);
      marker.rotation.set(Math.PI / 2, 0, -angle - Math.PI / 2);
      ring.add(marker);
    }
    ring.visible = false; this.scene.add(ring); return ring;
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
  hideEnemies() { this.enemies.forEach((enemy) => this.scene.remove(enemy)); this.enemies = []; this.targetRing.visible = false; this.targetRing.userData.target = null; }
  setPlayerVisible(visible) { if (this.player) this.player.visible = visible; }
  selectTarget(state) {
    const object = state?.phase === 'PLAYER_TURN' ? this.enemies[state.selectedEnemyIndex] : null;
    this.targetRing.userData.target = object || null;
    this.targetRing.visible = Boolean(object?.visible && state?.enemies[state.selectedEnemyIndex]?.hp > 0);
  }
  confirmTarget(index) {
    const object = this.enemies[index];
    if (!object) return;
    const base = object.userData.baseScale || .72;
    this.animations.tween({ duration: 260, update: (t) => {
      const kick = Math.sin(t * Math.PI) * .1;
      object.scale.setScalar(base + kick);
      this.targetRing.scale.setScalar(1 + Math.sin(t * Math.PI * 2) * .12);
    }, complete: () => { object.scale.setScalar(base); this.targetRing.scale.setScalar(1); } });
  }
  hit(object, amount = 0, playerHit = false) {
    if (!object) return; const x = object.position.x;
    this.flash(object, playerHit ? 0xff6f5d : 0xfff1b2);
    this.burst(object.position, playerHit ? 0xff6f5d : 0xffd36d, Math.min(11, 5 + (amount || 0)));
    this.events.emit('combat:impact', { strong: amount >= 3 });
    this.animations.tween({ duration: 280, update: (t) => {
      object.position.x = x + Math.sin(t * Math.PI * 7) * .15 * (1 - t);
    }, complete: () => { object.position.x = x; } });
  }
  pulse(object, color = 0x78efb1) {
    if (!object) return;
    const base = object.userData.baseScale || .72;
    this.aura(object, color);
    this.animations.tween({ duration: 300, update: (t) => object.scale.setScalar(base + Math.sin(t * Math.PI) * .08), complete: () => object.scale.setScalar(base) });
  }
  flash(object, color) {
    const materials = [];
    object.traverse((child) => {
      if (child.material?.emissive) {
        materials.push({ material: child.material, color: child.material.emissive.getHex(), intensity: child.material.emissiveIntensity });
        child.material.emissive.setHex(color);
      }
    });
    this.animations.tween({ duration: 220, update: (t) => materials.forEach(({ material }) => { material.emissiveIntensity = Math.sin(t * Math.PI) * 1.8; }), complete: () => materials.forEach(({ material, color: oldColor, intensity }) => { material.emissive.setHex(oldColor); material.emissiveIntensity = intensity; }) });
  }
  castSkill(skillId, skill, target) {
    const look = skillLooks[skillId] || { color: 0xffd978, kind: 'orb' };
    const targetsEnemy = skill.effects.some((effect) => effect.target !== 'self');
    const targetObject = this.enemies[target?.encounterIndex];
    this.anticipate(this.player, look.color);
    if (targetsEnemy && targetObject) this.projectile(this.player, targetObject, look);
    else this.aura(this.player, look.color, look.kind === 'ring' ? 3 : 2);
  }
  anticipate(object, color) {
    if (!object) return;
    const base = object.userData.baseScale || .72;
    this.flash(object, color);
    this.animations.tween({ duration: 240, update: (t) => {
      object.scale.setScalar(base * (1 - Math.sin(t * Math.PI) * .1));
      object.rotation.z = -Math.sin(t * Math.PI) * .09;
    }, complete: () => { object.scale.setScalar(base); object.rotation.z = 0; } });
  }
  projectile(source, target, look) {
    const geometry = look.kind === 'ring'
      ? new THREE.TorusGeometry(.18, .045, 6, 20)
      : look.kind === 'claw'
        ? new THREE.ConeGeometry(.1, .62, 3)
        : new THREE.OctahedronGeometry(.18, 0);
    const material = new THREE.MeshBasicMaterial({ color: look.color, transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending });
    const bolt = new THREE.Mesh(geometry, material);
    const start = source.position.clone().add(new THREE.Vector3(0, .15, 0));
    const end = target.position.clone().add(new THREE.Vector3(0, .1, .18));
    bolt.position.copy(start); bolt.lookAt(end); this.scene.add(bolt);
    this.animations.tween({ duration: look.strong ? 225 : 255, update: (t) => {
      bolt.position.lerpVectors(start, end, t);
      bolt.position.y += Math.sin(t * Math.PI) * .48;
      bolt.rotation.z += .34;
      bolt.scale.setScalar(.65 + Math.sin(t * Math.PI) * .7);
      material.opacity = Math.min(1, (1 - t) * 2.4);
    }, complete: () => { this.scene.remove(bolt); geometry.dispose(); material.dispose(); } });
  }
  aura(object, color, rings = 2) {
    if (!object) return;
    for (let i = 0; i < rings; i++) {
      const geometry = new THREE.TorusGeometry(.38 + i * .11, .025, 5, 30);
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .72, depthWrite: false, blending: THREE.AdditiveBlending });
      const ring = new THREE.Mesh(geometry, material); ring.rotation.x = Math.PI / 2;
      ring.position.copy(object.position); ring.position.y -= .65 - i * .16; this.scene.add(ring);
      this.animations.tween({ duration: 520 + i * 70, update: (t) => {
        ring.position.y += .006;
        ring.scale.setScalar(.7 + t * .9); material.opacity = (1 - t) * .72;
      }, complete: () => { this.scene.remove(ring); geometry.dispose(); material.dispose(); } });
    }
  }
  burst(position, color, count = 7) {
    for (let i = 0; i < count; i++) {
      const geometry = new THREE.TetrahedronGeometry(.045 + (i % 3) * .018);
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const particle = new THREE.Mesh(geometry, material);
      const start = position.clone().add(new THREE.Vector3(0, .1, .45));
      const angle = (i / count) * Math.PI * 2;
      const travel = new THREE.Vector3(Math.cos(angle) * (.38 + (i % 2) * .18), Math.sin(angle) * .38, Math.sin(angle * 1.7) * .18);
      particle.position.copy(start); this.scene.add(particle);
      this.animations.tween({ duration: 360 + i * 18, update: (t) => {
        particle.position.copy(start).addScaledVector(travel, t);
        particle.scale.setScalar(1 - t * .65); material.opacity = 1 - t;
      }, complete: () => { this.scene.remove(particle); geometry.dispose(); material.dispose(); } });
    }
  }
  enemyAction(enemy, intent) {
    const object = this.enemies[enemy?.encounterIndex];
    if (!object) return;
    if (intent.type === 'attack') {
      this.anticipate(object, 0xff765f);
      this.projectile(object, this.player, { color: 0xff6f58, kind: 'claw', strong: intent.value >= 3 });
    } else this.aura(object, intent.type === 'shield' ? 0x72d8e5 : 0xd58cff);
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
    const target = this.targetRing.userData.target;
    if (target?.visible) {
      this.targetRing.position.set(target.position.x, target.position.y - .88, target.position.z);
      this.targetRing.rotation.y = elapsed * .85;
      this.targetRing.position.y += Math.sin(elapsed * 3.4) * .025;
    }
  }
}
