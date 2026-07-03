/**
 * 3D crest runtime. One model, many placements.
 * Loads /assets/crest.glb (meshopt-compressed), studio lighting,
 * fragment-assembly driven by setProgress(0..1), pointer tilt, idle drift.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// deterministic pseudo-random per fragment index — same scatter every visit
function seeded(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export async function createCrest(canvas, { interactive = true } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.set(0, 0, 4.1);

  // studio lighting — soft key, cool fill, warm rim
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const key = new THREE.DirectionalLight(0xfff4e0, 2.4);
  key.position.set(-2.5, 3, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.9);
  fill.position.set(3, -1, 2.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe0cf90, 1.4);
  rim.position.set(0, 2.5, -3);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0x273370, 0.5));

  // load model
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync('/assets/crest.glb');
  const crest = gltf.scene.getObjectByName('RHC_Crest') || gltf.scene;
  const pivot = new THREE.Group();
  pivot.add(crest);
  scene.add(pivot);

  // fragment assembly targets
  const frags = [];
  crest.traverse((o) => { if (o.isMesh) frags.push(o); });
  frags.forEach((mesh, i) => {
    const r1 = seeded(i), r2 = seeded(i + 50), r3 = seeded(i + 100);
    mesh.userData.home = mesh.position.clone();
    mesh.userData.homeRot = mesh.rotation.clone();
    const dir = new THREE.Vector3(r1 - 0.5, r2 - 0.5, r3 * 0.5 + 0.25).normalize();
    mesh.userData.scatterPos = mesh.position.clone().addScaledVector(dir, 1.6 + r1 * 2.2);
    mesh.userData.scatterRot = new THREE.Euler(
      (r2 - 0.5) * 2.4,
      (r3 - 0.5) * 2.8,
      (r1 - 0.5) * 1.8,
    );
  });

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  let progress = 1;

  function applyProgress() {
    const n = frags.length;
    frags.forEach((mesh, i) => {
      // staggered window per fragment
      const start = (i / n) * 0.45;
      const t = easeOutCubic(Math.min(1, Math.max(0, (progress - start) / 0.55)));
      const { home, homeRot, scatterPos, scatterRot } = mesh.userData;
      mesh.position.lerpVectors(scatterPos, home, t);
      mesh.rotation.set(
        THREE.MathUtils.lerp(scatterRot.x, homeRot.x, t),
        THREE.MathUtils.lerp(scatterRot.y, homeRot.y, t),
        THREE.MathUtils.lerp(scatterRot.z, homeRot.z, t),
      );
    });
    pivot.rotation.y = (1 - easeOutCubic(progress)) * -0.9;
  }

  // pointer tilt + idle drift
  const target = { x: 0, y: 0 };
  if (interactive) {
    window.addEventListener('pointermove', (e) => {
      target.y = (e.clientX / window.innerWidth - 0.5) * 0.34;
      target.x = (e.clientY / window.innerHeight - 0.5) * 0.22;
    }, { passive: true });
  }

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  let running = true;
  let rafId;
  const clock = new THREE.Clock();
  function loop() {
    rafId = requestAnimationFrame(loop);
    if (!running) return;
    const t = clock.getElapsedTime();
    resize();
    // idle drift layered over assembly rotation
    const idle = Math.sin(t * 0.35) * 0.06;
    crest.rotation.y += ((target.y + idle) - crest.rotation.y) * 0.05;
    crest.rotation.x += (target.x - crest.rotation.x) * 0.05;
    renderer.render(scene, camera);
  }

  applyProgress();
  loop();

  return {
    setProgress(v) {
      progress = THREE.MathUtils.clamp(v, 0, 1);
      applyProgress();
    },
    setRunning(v) { running = v; },
    dispose() {
      cancelAnimationFrame(rafId);
      renderer.dispose();
      pmrem.dispose();
    },
  };
}
