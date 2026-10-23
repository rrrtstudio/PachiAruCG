import * as THREE from 'three';
import { roundedBoxGeometry, staticGeometryBuilder } from './geometry.js';

const material = (color, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function carpetTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#57504c'; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#62564f'; ctx.fillRect(0, 0, 128, 128); ctx.fillRect(128, 128, 128, 128);
  for (let i = 0; i < 16000; i++) {
    const x = (i * 97 + Math.floor(i / 31) * 13) % 256;
    const y = (i * 53 + Math.floor(i / 17) * 31) % 256;
    ctx.fillStyle = i % 3 ? '#d7c8b012' : '#201e231b'; ctx.fillRect(x, y, 1, 2);
  }
  ctx.fillStyle = '#49342f'; ctx.fillRect(0, 0, 3, 256); ctx.fillRect(0, 0, 256, 3);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(12, 12); texture.anisotropy = 4;
  return texture;
}

export function createChair() {
  const root = new THREE.Group(); root.name = 'UpholsteredChair';
  const b = staticGeometryBuilder(root);
  const burgundy = material(0x783b3b, .67), cushion = material(0x9d4845, .78);
  const shell = material(0x27272a, .6), steel = material(0x777a7c, .3, .78);
  const rubber = material(0x191a1c, .83);
  b.box(.44, .10, .43, [0, .35, .755], shell, .045);
  // Keep the existing seat surface at y=.4295, directly beneath the trousers.
  b.box(.415, .065, .405, [0, .397, .746], cushion, .03);
  b.box(.422, .009, .408, [0, .395, .746], burgundy, .004);
  b.box(.28, .045, .30, [0, .292, .77], steel, .018);
  b.box(.24, .03, .22, [0, .265, .77], shell, .012);
  const backRotation = new THREE.Euler(-.08, 0, 0);
  const backPosition = new THREE.Vector3(0, .72, .986);
  function back(size, position, mat, radius) {
    const world = new THREE.Vector3(...position).applyEuler(backRotation).add(backPosition);
    b.box(...size, world.toArray(), mat, radius, [-.08, 0, 0]);
  }
  back([.445, .44, .078], [0, 0, 0], shell, .04);
  back([.381, .375, .034], [0, .008, -.049], burgundy, .035);
  back([.425, .035, .084], [0, .192, -.003], cushion, .014);
  // Load-bearing brackets join the seat and back instead of a floating panel.
  for (const x of [-.145, .145]) {
    b.box(.028, .245, .044, [x, .475, 1.004], steel, .01, [-.11, 0, 0]);
    b.box(.045, .026, .13, [x, .365, .953], shell, .009);
  }
  b.add(new THREE.CylinderGeometry(.046, .062, .32, 28), steel, [0, .227, .79]);
  b.add(new THREE.CylinderGeometry(.22, .235, .035, 40), rubber, [0, .027, .79]);
  b.add(new THREE.CylinderGeometry(.13, .19, .035, 40), steel, [0, .057, .79]);
  b.add(new THREE.CylinderGeometry(.056, .056, .022, 24), shell, [0, .085, .79]);
  b.add(new THREE.CylinderGeometry(.026, .026, .038, 20), shell, [-.228, .31, .77], [0, 0, Math.PI / 2]);
  b.finish();
  return root;
}

export function createRoom(scene) {
  const group = new THREE.Group(); group.name = 'SuburbanParlor'; scene.add(group);
  const b = staticGeometryBuilder(group);
  // Architectural bevels are tiny on a phone; one segment avoids spending the
  // character's triangle budget on ceiling grids and distant service panels.
  const box = (width, height, depth, position, mat, radius = .012, rotation) =>
    b.add(roundedBoxGeometry(width, height, depth, radius, 1), mat, position, rotation);
  const floor = material(0xffffff, .96); floor.map = carpetTexture();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), floor);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  const wall = material(0xa69e94, .94), panel = material(0x80756b, .86);
  const dark = material(0x353238, .8), soffit = material(0x7e7770, .9);
  const trim = material(0x5c5b59, .45, .35), black = material(0x22272a, .68);
  const steel = material(0x8e9292, .34, .7), wood = material(0x51443d, .8);
  const ceiling = material(0xc1b9aa, .95);
  // Neutral architectural finishes stay quiet around the active cabinets.
  box(10, 2.8, .12, [0, 1.4, -1.15], wall);
  box(.12, 2.8, 8, [3.7, 1.4, 2], wall);
  box(.03, .76, 7.8, [3.625, .49, 2], panel, .006);
  box(.035, .035, 7.8, [3.616, .89, 2], trim, .006);
  box(.035, .10, 7.8, [3.616, .10, 2], dark, .006);
  for (let z = -1.1; z < 5.8; z += .82) {
    box(.018, 1.76, .012, [3.623, 1.75, z], panel, .003);
  }
  box(10, .22, .68, [0, 2.16, -.56], dark);
  box(10, .08, .82, [0, 1.92, -.48], soffit);
  box(10, .07, 8, [0, 2.65, 1], ceiling);
  for (let x = -4; x <= 4; x += .82) {
    box(.018, 1.9, .024, [x, 1, -1.075], panel, .004);
  }

  // Off-white fluorescent lenses add no coloured lights or shadow maps.
  const lens = new THREE.MeshBasicMaterial({ color: 0xd7d1bd, toneMapped: true });
  for (let x = -3.3; x < 4; x += 1.64) {
    for (const z of [.45, 2.2, 3.95]) {
      box(.60, .035, .36, [x, 2.604, z], trim, .008);
      box(.53, .009, .29, [x, 2.581, z], lens, .003);
      box(.005, .012, .30, [x, 2.573, z], panel, .002);
    }
  }
  for (let z = -.8; z < 5.5; z += .88) {
    box(9, .015, .012, [0, 2.606, z], panel, .002);
  }
  for (let x = -4; x < 4; x += 1.64) {
    box(.012, .015, 7, [x, 2.606, 2], panel, .002);
  }

  // Maintenance side of a distant island: real depth without extra glowing
  // display art or invented gameplay. The clear aisle remains behind the sitter.
  const islandX = 2.70;
  box(.57, .16, 4.08, [islandX, .10, 1.30], dark, .018);
  box(.54, 1.46, 4.0, [islandX, .89, 1.30], wood, .022);
  box(.64, .055, 4.10, [islandX, 1.645, 1.30], black, .014);
  box(.64, .06, 4.10, [islandX, .23, 1.30], trim, .01);
  for (let z = -.30; z <= 2.9; z += .80) {
    box(.012, 1.25, .738, [islandX - .278, .91, z], panel, .007);
    box(.018, .22, .64, [islandX - .292, 1.33, z], dark, .006);
    box(.018, .018, .13, [islandX - .30, .98, z + .20], steel, .005);
    for (let slat = 0; slat < 5; slat++) {
      box(.020, .008, .49, [islandX - .301, .53 + slat * .026, z], black, .002);
    }
  }
  box(.12, 2.55, .14, [3.12, 1.275, 3.52], panel, .01);
  // Two modest suspended strips are visible beyond the island in C.
  for (const z of [.15, 2.6]) {
    box(1.10, .045, .22, [2.70, 2.40, z], dark, .01);
    box(1.02, .009, .16, [2.70, 2.373, z], lens, .003);
    for (const x of [2.30, 3.10]) box(.008, .23, .008, [x, 2.53, z], trim, .002);
  }

  // External utility columns occupy the existing .82m machine pitch. Their
  // small screens are unlit; shelves contain no coin boxes or tobacco props.
  const utilityFace = material(0x303c40, .44, .12);
  const divider = new THREE.MeshStandardMaterial({ color: 0xbfc7c5, roughness: .4,
    metalness: .04, transparent: true, opacity: .13, depthWrite: false });
  for (const x of [-.41, .41, 1.23]) {
    box(.057, 1.12, .16, [x, .70, -.015], trim, .009);
    box(.044, .27, .018, [x, 1.10, .076], black, .005);
    box(.032, .13, .007, [x, 1.12, .089], utilityFace, .003);
    box(.034, .007, .01, [x, .985, .089], steel, .002);
    box(.074, .022, .19, [x, .665, .139], black, .008);
    b.add(new THREE.TorusGeometry(.029, .004, 8, 24), steel, [x, .683, .173], [Math.PI / 2, 0, 0]);
    box(.010, .23, .255, [x, 1.025, .214], divider, .003);
    box(.014, .010, .26, [x, .913, .214], steel, .004);
    box(.014, .23, .012, [x, 1.025, .084], steel, .004);
  }

  box(8, .003, .045, [0, .003, 1.52], material(0x71423c), .001);
  box(.14, 2.6, .14, [-4.8, 1.3, .3], panel);
  b.finish();
  group.traverse(object => {
    if (object.isMesh && object.material === divider) {
      object.castShadow = false; object.receiveShadow = false;
    }
    if (object.isMesh && object.material === lens) object.castShadow = false;
  });
  const chair = createChair(); scene.add(chair);
  return { root: group, chair };
}
