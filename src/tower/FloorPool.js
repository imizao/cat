import * as THREE from 'three';

const themeColors = [0x315d5b, 0x5f4967, 0x69543c];
const roofColors = [0x173b42, 0x382d50, 0x493229];

function makeLabel() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.5, 1.25, 1);
  return { canvas, texture, sprite };
}

class TowerFloor {
  constructor(shared) {
    this.group = new THREE.Group();
    this.group.userData.kind = 'tower-floor';
    this.base = new THREE.Mesh(shared.baseGeometry, shared.baseMaterials[0]);
    this.base.scale.set(1, 0.25, 1);
    this.group.add(this.base);
    this.room = new THREE.Mesh(shared.roomGeometry, shared.wallMaterials[0]);
    this.room.position.y = 0.8;
    this.group.add(this.room);
    this.roof = new THREE.Mesh(shared.roofGeometry, shared.roofMaterials[0]);
    this.roof.position.y = 1.75;
    this.roof.rotation.y = Math.PI / 4;
    this.group.add(this.roof);
    this.door = new THREE.Mesh(shared.doorGeometry, shared.windowMaterials[0]);
    this.door.position.set(0, 0.64, 1.86);
    this.group.add(this.door);
    this.pillars = Array.from({ length: 8 }, () => {
      const mesh = new THREE.Mesh(shared.pillarGeometry, shared.pillarMaterial);
      this.group.add(mesh); return mesh;
    });
    this.lanterns = Array.from({ length: 6 }, () => {
      const mesh = new THREE.Mesh(shared.lanternGeometry, shared.lanternMaterials[0]);
      this.group.add(mesh); return mesh;
    });
    this.marker = new THREE.Mesh(shared.markerGeometry, shared.markerMaterials.BATTLE);
    this.marker.position.set(-2.05, 1.05, 1.4);
    this.group.add(this.marker);
    this.label = makeLabel();
    this.label.sprite.position.set(0, 2.65, 0.2);
    this.group.add(this.label.sprite);
  }
  configure(data, relativeIndex, spacing, shared) {
    this.data = data;
    this.group.visible = data.index >= 0;
    this.group.position.set(0, relativeIndex * spacing, 0);
    this.group.rotation.y = data.rotation;
    const theme = data.theme;
    this.base.material = shared.baseMaterials[theme];
    this.room.material = shared.wallMaterials[theme];
    this.roof.material = shared.roofMaterials[theme];
    this.roof.scale.set(data.roofScale, 0.72 + data.floorHeight * 0.08, data.roofScale);
    this.room.scale.y = data.floorHeight / 2;
    this.roof.position.y = data.floorHeight;
    this.door.material = shared.windowMaterials[data.windowColor === 'amber' ? 0 : data.windowColor === 'jade' ? 1 : 2];
    this.marker.material = shared.markerMaterials[data.type] || shared.markerMaterials.BATTLE;
    for (let i = 0; i < this.pillars.length; i++) {
      const pillar = this.pillars[i];
      pillar.visible = i < data.pillarCount;
      const angle = (i / data.pillarCount) * Math.PI * 2 + Math.PI / 8;
      pillar.position.set(Math.cos(angle) * 2.12, data.floorHeight * 0.45, Math.sin(angle) * 2.12);
      pillar.scale.y = data.floorHeight * 0.48;
    }
    for (let i = 0; i < this.lanterns.length; i++) {
      const lamp = this.lanterns[i];
      lamp.visible = i < data.decoration;
      const side = i % 2 ? 1 : -1;
      lamp.position.set(side * (1.25 + (i % 3) * 0.34), 1.25 + Math.floor(i / 2) * 0.22, 1.9);
      lamp.material = shared.lanternMaterials[theme];
    }
    const ctx = this.label.canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = 'rgba(5, 20, 23, .78)';
    ctx.beginPath(); ctx.roundRect(34, 24, 188, 76, 24); ctx.fill();
    ctx.strokeStyle = '#e7c780'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fff4cf'; ctx.font = '700 43px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${data.index}F`, 128, 63);
    this.label.texture.needsUpdate = true;
  }
}

export class FloorPool {
  constructor(size = 11) {
    this.shared = this.createShared();
    this.items = Array.from({ length: size }, () => new TowerFloor(this.shared));
  }
  createShared() {
    const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.72, flatShading: true, ...extra });
    const baseMaterials = themeColors.map((color) => standard(color));
    const wallMaterials = [0xd5b77c, 0xbfa7bd, 0xc6a981].map((color) => standard(color));
    const roofMaterials = roofColors.map((color) => standard(color, { roughness: 0.55 }));
    const markerColors = { BATTLE: 0xdc735d, ELITE: 0xd04fa0, REST: 0x69bca6, SHOP: 0xe1ad58, EVENT: 0x819cdc, TREASURE: 0xffcf61, BOSS: 0xe13e4e };
    return {
      baseGeometry: new THREE.CylinderGeometry(2.9, 3.18, 0.7, 8),
      roomGeometry: new THREE.BoxGeometry(3.65, 1, 3.65),
      roofGeometry: new THREE.ConeGeometry(3.35, 1.3, 4),
      doorGeometry: new THREE.PlaneGeometry(0.82, 1.18),
      pillarGeometry: new THREE.CylinderGeometry(0.095, 0.13, 2, 6),
      lanternGeometry: new THREE.CylinderGeometry(0.13, 0.18, 0.34, 6),
      markerGeometry: new THREE.OctahedronGeometry(0.22),
      baseMaterials, wallMaterials, roofMaterials,
      pillarMaterial: standard(0x6a352b),
      windowMaterials: [0xffbe55, 0x75e3bd, 0xb99af2].map((color) => standard(color, { emissive: color, emissiveIntensity: 0.65 })),
      lanternMaterials: [0xffb44a, 0xf092cd, 0x9be4cb].map((color) => standard(color, { emissive: color, emissiveIntensity: 1 })),
      markerMaterials: Object.fromEntries(Object.entries(markerColors).map(([key, value]) => [key, standard(value, { emissive: value, emissiveIntensity: 0.35 })]))
    };
  }
}
