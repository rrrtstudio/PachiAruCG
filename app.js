import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCabinet } from './scene/cabinet.js';
import { loadCharacter } from './scene/character.js';
import { createRoom } from './scene/room.js';
import { getMachineStates } from './slot-timeline.js';
import { applyCameraView, DEFAULT_CAMERA_VIEW, CAMERA_VIEWS } from './camera-views.js';

const stage = document.getElementById('stage');
const loading = document.getElementById('loading');
const status = document.getElementById('status');
const pauseButton = document.getElementById('pause');
const glassesInput = document.getElementById('glasses');
const speedSlider = document.getElementById('speed');
const cameraButtons = [...document.querySelectorAll('[data-camera]')];
const actionButtons = [...document.querySelectorAll('[data-action]')];
const params = new URLSearchParams(location.search);
let cameraView = Object.hasOwn(CAMERA_VIEWS, params.get('camera')) ? params.get('camera') : DEFAULT_CAMERA_VIEW;
let paused = true, mode = 'idle', time = 0, speed = 1, dirty = true;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.insertBefore(renderer.domElement, loading);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x696057);
scene.fog = new THREE.Fog(0x696057, 5, 13);
const camera = new THREE.PerspectiveCamera(42, 9 / 16, .025, 30);
const environment = new RoomEnvironment();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(environment, .04).texture;
scene.environmentIntensity = .55;
environment.dispose(); pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xffeed9, 0x5b5051, 1.3));
const key = new THREE.DirectionalLight(0xffe3c2, 3.2);
key.position.set(-2.5, 4.5, 2.7); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -2.5; key.shadow.camera.right = 2.5;
key.shadow.camera.top = 3; key.shadow.camera.bottom = -1.5;
key.shadow.bias = -.0005; key.shadow.normalBias = .012; key.shadow.radius = 3;
key.target.position.set(0, .8, .3); scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0xe6edfa, .9); fill.position.set(2.5, 2.2, -1); scene.add(fill);
const room = createRoom(scene);
const cabinets = [-.82, 0, .82].map((x, seed) => {
  const cabinet = createCabinet({ seed, detail: seed === 1 });
  cabinet.root.position.x = x; scene.add(cabinet.root); return cabinet;
});
const labels = { idle: '造形・構図の確認', play: 'ボタン操作', look: '首を向ける', shock: '驚く',
  sad: '落胆', angry: '怒る', smile: '喜ぶ', pretend: '平静を装う', demo: '一連の動作' };
const phaseLabels = { normal: '通常', 'bonus-established': 'ボーナス成立（未告知）',
  'bonus-notified': 'ボーナス告知（7未入賞）', 'bonus-aligned': '7図柄入賞', 'bonus-play': 'ボーナス消化' };

let person;
function setCamera(view) {
  cameraView = view; applyCameraView(camera, view);
  dirty = true;
  if (person) person.setView(view, glassesInput.checked);
  room.chair.visible = view !== 'player';
  for (const button of cameraButtons) button.setAttribute('aria-pressed', String(button.dataset.camera === view));
  document.getElementById('camera-status').textContent = CAMERA_VIEWS[view].label;
}
function refreshStatus() {
  status.textContent = (paused ? '停止中：' : '再生中：') + labels[mode];
  pauseButton.textContent = paused ? '動作を再開' : '一時停止';
  for (const button of actionButtons) button.setAttribute('aria-pressed', String(button.dataset.action === mode));
}
function setMode(next) { mode = next; time = 0; paused = false; dirty = true; refreshStatus(); }
function updateMachines() {
  const states = getMachineStates(mode, time);
  states.forEach((state, index) => cabinets[index].setState(state));
  document.getElementById('machine-status').textContent =
    '本人の台：' + phaseLabels[states[1].phase] + ' ／ 隣の台：' + phaseLabels[states[2].phase];
}
function resize() {
  const width = stage.clientWidth, height = stage.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
  dirty = true;
}
new ResizeObserver(resize).observe(stage);
window.addEventListener('orientationchange', resize);
setCamera(cameraView); resize(); refreshStatus();

try {
  person = await loadCharacter(); scene.add(person.root);
  person.studyPose(); setCamera(cameraView);
  // Hold the sculpted seated pose for the first image review, before animation.
  updateMachines(); renderer.render(scene, camera);
  loading.style.display = 'none';
  window.__PACHI_REVIEW__ = {
    ready: true, phase: 'static', model: person.stats,
    get diagnostics() { return { camera: cameraView, triangles: renderer.info.render.triangles,
      drawCalls: renderer.info.render.calls, model: person.stats, paused, mode, time,
      cabinets: cabinets.map(cabinet => cabinet.root.userData) }; }
  };
} catch (error) {
  loading.textContent = '3Dモデルを読み込めませんでした。接続を確認して再読み込みしてください。';
  status.textContent = 'モデル読込失敗'; throw error;
}

for (const button of cameraButtons) button.addEventListener('click', () => setCamera(button.dataset.camera));
for (const button of actionButtons) button.addEventListener('click', () => setMode(button.dataset.action));
document.getElementById('demo').addEventListener('click', () => setMode('demo'));
pauseButton.addEventListener('click', () => { paused = !paused; refreshStatus(); });
glassesInput.addEventListener('change', () => {
  person.setView(cameraView, glassesInput.checked);
  dirty = true;
});
speedSlider.addEventListener('input', () => {
  speed = Number(speedSlider.value); document.getElementById('speed-value').textContent = speed.toFixed(1) + '×';
});
const clock = new THREE.Clock();
function render() {
  requestAnimationFrame(render);
  const dt = Math.min(clock.getDelta(), .05);
  if (!paused) { time += dt * speed; if (mode === 'demo' && time > 7.3) time = 0; }
  // A paused model needs a new frame only after a camera, accessory or size
  // change. Do not continuously redraw the same shadowed GLB on a phone.
  if (!paused || dirty) {
    updateMachines(); renderer.render(scene, camera); dirty = false;
  }
}
render();
