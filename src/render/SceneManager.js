import * as THREE from 'three';

export class SceneManager {
  constructor(container, animations) {
    this.animations = animations;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07191d);
    this.scene.fog = new THREE.FogExp2(0x07191d, 0.034);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    this.camera.position.set(8.8, 5.2, 12.8);
    this.cameraTarget = { x: 0, y: .8, z: 0 };
    this.camera.lookAt(0, 0.8, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0x9edbd4, 0x1f1822, 2.4));
    const key = new THREE.DirectionalLight(0xffd79c, 3.1); key.position.set(5, 8, 7); this.scene.add(key);
    this.makeSky();
    this.clock = new THREE.Clock(); this.elapsed = 0; this.frames = 0; this.fps = 0; this.lastFps = performance.now();
    this.resizeObserver = new ResizeObserver(() => this.resize(container));
    this.resizeObserver.observe(container); this.resize(container);
  }
  makeSky() {
    const geometry = new THREE.BufferGeometry();
    const points = [];
    for (let i = 0; i < 90; i++) points.push((Math.random() - .5) * 35, Math.random() * 45 - 12, (Math.random() - .5) * 18 - 8);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    const stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xe5d7a6, size: .055, transparent: true, opacity: .65 }));
    this.scene.add(stars);
  }
  resize(container) {
    const w = container.clientWidth, h = container.clientHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h, false);
  }
  setView(mode) {
    const destination = mode === 'battle'
      ? { x: 0, y: 5.35, z: 13.5, tx: 0, ty: 1.55, tz: 0 }
      : { x: 8.8, y: 5.2, z: 12.8, tx: 0, ty: .8, tz: 0 };
    const start = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, tx: this.cameraTarget.x, ty: this.cameraTarget.y, tz: this.cameraTarget.z };
    this.animations.tween({ duration: 480, update: (t) => {
      this.camera.position.set(
        start.x + (destination.x - start.x) * t,
        start.y + (destination.y - start.y) * t,
        start.z + (destination.z - start.z) * t
      );
      this.cameraTarget.x = start.tx + (destination.tx - start.tx) * t;
      this.cameraTarget.y = start.ty + (destination.ty - start.ty) * t;
      this.cameraTarget.z = start.tz + (destination.tz - start.tz) * t;
      this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z);
    }});
  }
  start(onFrame) {
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      const delta = Math.min(this.clock.getDelta(), .05); this.elapsed += delta;
      this.animations.update(now); onFrame?.(delta, this.elapsed);
      this.renderer.render(this.scene, this.camera);
      this.frames++;
      if (now - this.lastFps >= 1000) { this.fps = Math.round(this.frames * 1000 / (now - this.lastFps)); this.frames = 0; this.lastFps = now; }
    };
    this.raf = requestAnimationFrame(loop);
  }
  objectCount() { let count = 0; this.scene.traverse(() => count++); return count; }
}
