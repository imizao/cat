import * as THREE from 'three';

const renderDpr = () => Math.min(2, Math.max(1, Math.floor(devicePixelRatio || 1)));

export class SceneManager {
  constructor(container, animations, pixi = null, events = null) {
    this.animations = animations; this.pixi = pixi; this.events = events;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07191d);
    this.scene.fog = new THREE.FogExp2(0x07191d, 0.034);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    this.camera.position.set(8.8, 5.2, 12.8);
    this.cameraTarget = { x: 0, y: .8, z: 0 };
    this.battleViews = [
      { id: 'front', label: '正面', x: 0, y: 5.45, z: 14.8, tx: 0, ty: 1.45, tz: 0, fov: 42 },
      { id: 'tactical', label: '俯瞰', x: 0, y: 9.1, z: 14.9, tx: 0, ty: .85, tz: -.15, fov: 44 },
      { id: 'cinematic', label: '斜侧', x: 5.2, y: 5.8, z: 14.5, tx: -.15, ty: 1.35, tz: -.05, fov: 42 }
    ];
    this.battleViewIndex = 0;
    this.cameraTransition = 0;
    this.camera.lookAt(0, 0.8, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.domElement.className = 'three-canvas';
    this.renderer.setPixelRatio(renderDpr());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.onScenePointer = (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      this.events?.emit('scene:pointer', { event, pointer: this.pointer, raycaster: this.raycaster, camera: this.camera });
    };
    this.renderer.domElement.addEventListener('pointerdown', this.onScenePointer);
    this.scene.add(new THREE.HemisphereLight(0x9edbd4, 0x1f1822, 2.4));
    const key = new THREE.DirectionalLight(0xffd79c, 3.1); key.position.set(5, 8, 7); this.scene.add(key);
    this.makeSky();
    this.clock = new THREE.Clock(); this.elapsed = 0; this.frames = 0; this.fps = 0; this.lastFps = performance.now();
    // Both signals feed the same resize path: ResizeObserver covers layout,
    // while window resize also catches orientation and devicePixelRatio changes.
    this.onResize = () => this.resize(container);
    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(container); this.resize(container);
    window.addEventListener('resize', this.onResize);
    this.onVisibility = () => { if (document.hidden) this.pause(); else this.resume(); };
    document.addEventListener('visibilitychange', this.onVisibility);
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
    // Integer DPR keeps Three and Pixi drawing buffers byte-for-byte aligned;
    // fractional DPR values make the two renderers round half-pixels differently.
    const dpr = renderDpr();
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false);
    this.pixi?.resize(w, h, dpr);
  }
  setView(mode) {
    const destination = mode === 'battle'
      ? this.currentBattleView()
      : { x: 8.8, y: 5.2, z: 12.8, tx: 0, ty: .8, tz: 0, fov: 38 };
    const start = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z, tx: this.cameraTarget.x, ty: this.cameraTarget.y, tz: this.cameraTarget.z, fov: this.camera.fov };
    const transition = ++this.cameraTransition;
    this.animations.tween({ duration: 480, update: (t) => {
      if (transition !== this.cameraTransition) return;
      const eased = 1 - Math.pow(1 - t, 3);
      this.camera.position.set(
        start.x + (destination.x - start.x) * eased,
        start.y + (destination.y - start.y) * eased,
        start.z + (destination.z - start.z) * eased
      );
      this.cameraTarget.x = start.tx + (destination.tx - start.tx) * eased;
      this.cameraTarget.y = start.ty + (destination.ty - start.ty) * eased;
      this.cameraTarget.z = start.tz + (destination.tz - start.tz) * eased;
      this.camera.fov = start.fov + (destination.fov - start.fov) * eased;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z);
    }});
  }
  currentBattleView() { return this.battleViews[this.battleViewIndex]; }
  cycleBattleView() {
    this.battleViewIndex = (this.battleViewIndex + 1) % this.battleViews.length;
    this.setView('battle');
    return this.currentBattleView();
  }
  start(onFrame) {
    this.onFrame = onFrame;
    this.loop = (now) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(this.loop);
      const delta = Math.min(this.clock.getDelta(), .05); this.elapsed += delta;
      this.animations.update(now); this.onFrame?.(delta, this.elapsed); this.pixi?.update(delta, this.elapsed);
      this.renderer.render(this.scene, this.camera);
      this.pixi?.render();
      this.frames++;
      if (now - this.lastFps >= 1000) { this.fps = Math.round(this.frames * 1000 / (now - this.lastFps)); this.frames = 0; this.lastFps = now; }
    };
    this.resume();
  }
  pause() {
    if (!this.running) return;
    this.running = false; cancelAnimationFrame(this.raf); this.clock.stop();
    this.animations.pause(); this.pixi?.pause();
  }
  resume() {
    if (this.running || document.hidden) return;
    this.running = true; this.clock.start(); this.animations.resume(); this.pixi?.resume();
    this.raf = requestAnimationFrame(this.loop);
  }
  disposeSceneResources() {
    const geometries = new Set(); const materials = new Set(); const textures = new Set();
    this.scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const source = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
      source.forEach((material) => materials.add(material));
    });
    materials.forEach((material) => {
      Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value); });
      material.dispose();
    });
    geometries.forEach((geometry) => geometry.dispose());
    textures.forEach((texture) => texture.dispose());
  }
  destroy({ destroyPixi = true } = {}) {
    this.pause(); this.resizeObserver.disconnect(); window.removeEventListener('resize', this.onResize); document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.domElement.removeEventListener('pointerdown', this.onScenePointer);
    this.disposeSceneResources(); this.renderer.renderLists.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
    if (destroyPixi) this.pixi?.destroy();
  }
  objectCount() { let count = 0; this.scene.traverse(() => count++); return count + (this.pixi?.objectCount() || 0); }
}
