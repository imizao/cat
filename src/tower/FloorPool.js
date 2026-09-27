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
    this.plinth = new THREE.Mesh(shared.plinthGeometry, shared.plinthMaterials[0]);
    this.plinth.position.y = -0.22;
    this.group.add(this.plinth);
    this.room = new THREE.Mesh(shared.roomGeometry, shared.wallMaterials[0]);
    this.group.add(this.room);

    this.beams = Array.from({ length: 2 }, () => {
      const mesh = new THREE.Mesh(shared.beamGeometry, shared.pillarMaterial);
      this.group.add(mesh); return mesh;
    });
    this.deck = new THREE.Mesh(shared.beamGeometry, shared.deckMaterial);
    this.group.add(this.deck);
    this.rails = Array.from({ length: 6 }, () => {
      const mesh = new THREE.Mesh(shared.beamGeometry, shared.pillarMaterial);
      this.group.add(mesh); return mesh;
    });

    this.eave = new THREE.Mesh(shared.eaveGeometry, shared.eaveMaterials[0]);
    this.eave.rotation.y = Math.PI / 4;
    this.group.add(this.eave);
    this.roof = new THREE.Mesh(shared.roofGeometry, shared.roofMaterials[0]);
    this.roof.rotation.y = Math.PI / 4;
    this.group.add(this.roof);
    this.roofTips = Array.from({ length: 4 }, () => {
      const mesh = new THREE.Mesh(shared.roofTipGeometry, shared.roofTipMaterials[0]);
      this.group.add(mesh); return mesh;
    });

    this.doorFrame = new THREE.Mesh(shared.doorFrameGeometry, shared.pillarMaterial);
    this.group.add(this.doorFrame);
    this.door = new THREE.Mesh(shared.doorGeometry, shared.windowMaterials[0]);
    this.group.add(this.door);
    this.windowFrames = Array.from({ length: 2 }, () => {
      const mesh = new THREE.Mesh(shared.windowFrameGeometry, shared.pillarMaterial);
      this.group.add(mesh); return mesh;
    });
    this.windows = Array.from({ length: 2 }, () => {
      const mesh = new THREE.Mesh(shared.windowGeometry, shared.windowMaterials[0]);
      this.group.add(mesh); return mesh;
    });

    this.pillars = Array.from({ length: 8 }, () => {
      const mesh = new THREE.Mesh(shared.pillarGeometry, shared.pillarMaterial);
      this.group.add(mesh); return mesh;
    });
    this.lanterns = Array.from({ length: 6 }, (_, index) => {
      const group = new THREE.Group();
      const cord = new THREE.Mesh(shared.lanternCordGeometry, shared.pillarMaterial);
      cord.position.y = -0.18;
      const cap = new THREE.Mesh(shared.lanternCapGeometry, shared.pillarMaterial);
      cap.position.y = -0.38;
      const shade = new THREE.Mesh(shared.lanternGeometry, shared.lanternMaterials[0]);
      shade.position.y = -0.56;
      group.add(cord, cap, shade);
      group.userData.phase = index * 0.9;
      this.group.add(group);
      return { group, shade };
    });

    this.marker = new THREE.Mesh(shared.markerGeometry, shared.markerMaterials.BATTLE);
    this.marker.position.set(-2.05, 1.05, 1.4);
    this.group.add(this.marker);
    this.label = makeLabel();
    this.group.add(this.label.sprite);
  }

  configure(data, relativeIndex, spacing, shared) {
    this.data = data;
    this.group.visible = data.index >= 0;
    this.group.position.set(0, relativeIndex * spacing, 0);
    this.group.rotation.y = data.rotation;
    const theme = data.theme;
    this.base.material = shared.baseMaterials[theme];
    this.plinth.material = shared.plinthMaterials[theme];
    this.room.material = shared.wallMaterials[theme];
    this.room.scale.y = data.floorHeight;
    this.room.position.y = data.floorHeight / 2 + 0.08;

    this.beams[0].position.set(0, 0.18, 0); this.beams[0].scale.set(3.95, 0.16, 3.95);
    this.beams[1].position.set(0, data.floorHeight - 0.15, 0); this.beams[1].scale.set(3.95, 0.13, 3.95);
    this.deck.position.set(0, 0.18, 2.04); this.deck.scale.set(4.15, 0.16, 0.72);
    this.rails.forEach((rail, index) => {
      if (index < 5) {
        rail.position.set(-1.68 + index * 0.84, 0.62, 2.34);
        rail.scale.set(0.075, 0.78, 0.075);
      } else {
        rail.position.set(0, 0.84, 2.34); rail.scale.set(3.45, 0.075, 0.075);
      }
    });

    this.eave.material = shared.eaveMaterials[theme];
    this.eave.scale.set(data.roofScale, 1, data.roofScale);
    this.eave.position.y = data.floorHeight + 0.02;
    this.roof.material = shared.roofMaterials[theme];
    this.roof.scale.set(data.roofScale, 0.94 + data.floorHeight * 0.025, data.roofScale);
    this.roof.position.y = data.floorHeight + 0.3;
    const tipRadius = 3.05 * data.roofScale;
    this.roofTips.forEach((tip, index) => {
      const angle = index * Math.PI / 2;
      tip.position.set(Math.cos(angle) * tipRadius, data.floorHeight + 0.02, Math.sin(angle) * tipRadius);
      tip.material = shared.roofTipMaterials[theme];
    });

    const windowMaterial = shared.windowMaterials[data.windowColor === 'amber' ? 0 : data.windowColor === 'jade' ? 1 : 2];
    this.door.material = windowMaterial;
    this.doorFrame.position.set(0, 0.82, 1.838);
    this.door.position.set(0, 0.82, 1.846);
    this.windowFrames.forEach((frame, index) => frame.position.set(index ? 1.18 : -1.18, data.floorHeight * 0.57, 1.838));
    this.windows.forEach((window, index) => {
      window.position.set(index ? 1.18 : -1.18, data.floorHeight * 0.57, 1.846);
      window.material = windowMaterial;
    });

    this.marker.material = shared.markerMaterials[data.type] || shared.markerMaterials.BATTLE;
    this.marker.position.y = Math.min(1.3, data.floorHeight * 0.62);
    for (let i = 0; i < this.pillars.length; i++) {
      const pillar = this.pillars[i];
      pillar.visible = i < data.pillarCount;
      const angle = (i / data.pillarCount) * Math.PI * 2 + Math.PI / 8;
      pillar.position.set(Math.cos(angle) * 2.12, data.floorHeight * 0.5 + 0.08, Math.sin(angle) * 2.12);
      pillar.scale.y = data.floorHeight * 0.48;
    }
    for (let i = 0; i < this.lanterns.length; i++) {
      const lamp = this.lanterns[i];
      lamp.group.visible = i < data.decoration;
      const angle = (i / Math.max(2, data.decoration)) * Math.PI * 2 + Math.PI / 4;
      lamp.group.position.set(Math.cos(angle) * 2.35, data.floorHeight - 0.05, Math.sin(angle) * 2.35);
      lamp.shade.material = shared.lanternMaterials[theme];
    }

    this.label.sprite.position.set(0, data.floorHeight + 1.12, 0.2);
    const ctx = this.label.canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = 'rgba(5, 20, 23, .78)';
    ctx.beginPath(); ctx.roundRect(34, 24, 188, 76, 24); ctx.fill();
    ctx.strokeStyle = '#e7c780'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#fff4cf'; ctx.font = '700 43px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${data.index}F`, 128, 63);
    this.label.texture.needsUpdate = true;
  }

  update(elapsed) {
    if (!this.group.visible) return;
    this.lanterns.forEach(({ group, shade }) => {
      if (!group.visible) return;
      const wave = Math.sin(elapsed * 1.35 + group.userData.phase + this.data.index * 0.37);
      group.rotation.z = wave * 0.045;
      group.rotation.x = Math.cos(elapsed * 1.05 + group.userData.phase) * 0.018;
      const glow = 1 + Math.sin(elapsed * 2 + group.userData.phase) * 0.035;
      shade.scale.set(glow, glow, glow);
    });
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
    const plinthMaterials = themeColors.map((color) => standard(color, { roughness: 0.9 }));
    const wallMaterials = [0xc8aa72, 0xaf97ad, 0xb99b72].map((color) => standard(color));
    const roofMaterials = roofColors.map((color) => standard(color, { roughness: 0.55 }));
    const eaveMaterials = roofColors.map((color) => standard(color, { roughness: 0.82 }));
    const roofTipMaterials = roofColors.map((color) => standard(color, { roughness: 0.45 }));
    const markerColors = { BATTLE: 0xdc735d, ELITE: 0xd04fa0, REST: 0x69bca6, SHOP: 0xe1ad58, EVENT: 0x819cdc, TREASURE: 0xffcf61, BOSS: 0xe13e4e };
    return {
      baseGeometry: new THREE.CylinderGeometry(2.9, 3.18, 0.7, 8),
      plinthGeometry: new THREE.CylinderGeometry(2.62, 2.88, 0.28, 8),
      roomGeometry: new THREE.BoxGeometry(3.65, 1, 3.65),
      roofGeometry: new THREE.ConeGeometry(3.16, 0.96, 4),
      eaveGeometry: new THREE.ConeGeometry(3.34, 0.3, 4),
      roofTipGeometry: new THREE.OctahedronGeometry(0.12, 0),
      beamGeometry: new THREE.BoxGeometry(1, 1, 1),
      doorFrameGeometry: new THREE.PlaneGeometry(0.98, 1.34),
      doorGeometry: new THREE.PlaneGeometry(0.76, 1.12),
      windowFrameGeometry: new THREE.PlaneGeometry(0.74, 0.94),
      windowGeometry: new THREE.PlaneGeometry(0.54, 0.72),
      pillarGeometry: new THREE.CylinderGeometry(0.095, 0.13, 2, 6),
      lanternGeometry: new THREE.CylinderGeometry(0.13, 0.18, 0.34, 6),
      lanternCordGeometry: new THREE.CylinderGeometry(0.014, 0.014, 0.38, 5),
      lanternCapGeometry: new THREE.CylinderGeometry(0.12, 0.09, 0.08, 6),
      markerGeometry: new THREE.OctahedronGeometry(0.22),
      baseMaterials, plinthMaterials, wallMaterials, roofMaterials, eaveMaterials, roofTipMaterials,
      pillarMaterial: standard(0x6a352b),
      deckMaterial: standard(0x81503a, { roughness: 0.85 }),
      windowMaterials: [0xffbe55, 0x75e3bd, 0xb99af2].map((color) => standard(color, { emissive: color, emissiveIntensity: 0.65 })),
      lanternMaterials: [0xffb44a, 0xf092cd, 0x9be4cb].map((color) => standard(color, { emissive: color, emissiveIntensity: 1 })),
      markerMaterials: Object.fromEntries(Object.entries(markerColors).map(([key, value]) => [key, standard(value, { emissive: value, emissiveIntensity: 0.35 })]))
    };
  }

  update(elapsed) { this.items.forEach((item) => item.update(elapsed)); }
}
