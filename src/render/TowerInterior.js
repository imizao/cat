import * as THREE from 'three';

const palette = [
  { wall: 0x315d5b, trim: 0x9a6a45, floor: 0x273f43, glow: 0xffc66a },
  { wall: 0x574663, trim: 0x8e5f69, floor: 0x373247, glow: 0xf0a4d4 },
  { wall: 0x67533d, trim: 0x704839, floor: 0x403a35, glow: 0x9fe1c2 }
];

export class TowerInterior {
  constructor(scene, animations) {
    this.animations = animations;
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);
    this.themes = palette.map((theme) => ({
      wall: this.material(theme.wall),
      trim: this.material(theme.trim),
      floor: this.material(theme.floor),
      glow: this.material(theme.glow, { emissive: theme.glow, emissiveIntensity: .75 })
    }));
    this.build();
  }

  material(color, options = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: .72, flatShading: true, ...options });
  }

  mesh(geometry, material, position, scale) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    if (scale) object.scale.set(...scale);
    this.root.add(object);
    return object;
  }

  build() {
    const theme = this.themes[0];
    this.floor = this.mesh(new THREE.CylinderGeometry(4.8, 5.15, .42, 8), theme.floor, [0, -.15, 0]);
    this.backWall = this.mesh(new THREE.BoxGeometry(8.7, 4.4, .28), theme.wall, [0, 2.05, -2.75]);
    this.sideWalls = [
      this.mesh(new THREE.BoxGeometry(.3, 4.4, 5.6), theme.wall, [-4.25, 2.05, 0]),
      this.mesh(new THREE.BoxGeometry(.3, 4.4, 5.6), theme.wall, [4.25, 2.05, 0])
    ];
    this.beams = [
      this.mesh(new THREE.BoxGeometry(9.3, .28, .32), theme.trim, [0, 4.18, -2.5]),
      this.mesh(new THREE.BoxGeometry(.3, 4.7, .32), theme.trim, [-3.75, 2.05, -2.48]),
      this.mesh(new THREE.BoxGeometry(.3, 4.7, .32), theme.trim, [3.75, 2.05, -2.48]),
      this.mesh(new THREE.BoxGeometry(9.2, .24, .3), theme.trim, [0, .15, -2.48])
    ];
    this.window = this.mesh(new THREE.TorusGeometry(1.05, .12, 8, 24), theme.trim, [0, 2.45, -2.52]);
    this.moon = this.mesh(new THREE.CircleGeometry(.9, 24), theme.glow, [0, 2.45, -2.58]);
    this.lanterns = [-2.8, 2.8].map((x) => {
      const lamp = this.mesh(new THREE.CylinderGeometry(.18, .24, .48, 6), theme.glow, [x, 2.75, -2.35]);
      const cord = this.mesh(new THREE.CylinderGeometry(.025, .025, .72, 5), theme.trim, [x, 3.34, -2.35]);
      return { lamp, cord };
    });
    this.railings = [-1, 1].map((side) => this.mesh(new THREE.BoxGeometry(.18, 1.05, 3.2), theme.trim, [side * 4.05, .55, 1.05]));
  }

  applyTheme(index) {
    const theme = this.themes[index % this.themes.length];
    this.floor.material = theme.floor;
    this.backWall.material = theme.wall;
    this.sideWalls.forEach((wall) => { wall.material = theme.wall; });
    this.beams.forEach((beam) => { beam.material = theme.trim; });
    this.railings.forEach((rail) => { rail.material = theme.trim; });
    this.window.material = theme.trim;
    this.moon.material = theme.glow;
    this.lanterns.forEach(({ lamp, cord }) => { lamp.material = theme.glow; cord.material = theme.trim; });
  }

  show(floor) {
    this.applyTheme(floor.theme);
    this.root.visible = true;
    this.root.scale.setScalar(.76);
    this.root.position.y = -.35;
    this.animations.tween({ duration: 420, update: (t) => {
      const scale = .76 + t * .24;
      this.root.scale.setScalar(scale);
      this.root.position.y = -.35 + t * .35;
    }, complete: () => { this.root.scale.setScalar(1); this.root.position.y = 0; } });
  }

  hide() { this.root.visible = false; }
}
