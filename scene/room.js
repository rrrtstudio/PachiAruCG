import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const material = (color, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
function rounded(group, size, position, mat, radius = .025) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 3, radius), mat);
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh); return mesh;
}
function cylinder(group, radii, height, position, mat) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(...radii, height, 32), mat);
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh); return mesh;
}

function carpetTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#5c5551'; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#685c56'; ctx.fillRect(0, 0, 128, 128); ctx.fillRect(128, 128, 128, 128);
  for (let i = 0; i < 16000; i++) {
    const x = (i * 97 + Math.floor(i / 31) * 13) % 256;
    const y = (i * 53 + Math.floor(i / 17) * 31) % 256;
    ctx.fillStyle = i % 3 ? '#d7c8b012' : '#201e231b'; ctx.fillRect(x, y, 1, 2);
  }
  ctx.fillStyle = '#492d2c'; ctx.fillRect(0, 0, 7, 256); ctx.fillRect(0, 0, 256, 7);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(12, 12); texture.anisotropy = 4;
  return texture;
}

export function createChair() {
  const root = new THREE.Group(); root.name = 'UpholsteredChair';
  const burgundy = material(0x783b3b, .67), cushion = material(0x9d4845, .78);
  const shell = material(0x27272a, .6), steel = material(0x777a7c, .3, .78);
  rounded(root, [.44, .10, .43], [0, .35, .755], shell, .045);
  rounded(root, [.415, .065, .405], [0, .397, .746], cushion, .03);
  const back = new THREE.Group(); back.position.set(0, .72, .986); back.rotation.x = -.08; root.add(back);
  rounded(back, [.445, .44, .078], [0, 0, 0], shell, .04);
  rounded(back, [.381, .375, .034], [0, .008, -.049], burgundy, .035);
  // The welt and inset upholstery are actual curved geometry.
  rounded(back, [.425, .035, .084], [0, .192, -.003], cushion, .014);
  cylinder(root, [.046, .062], .32, [0, .227, .79], steel);
  cylinder(root, [.22, .235], .035, [0, .027, .79], shell);
  cylinder(root, [.13, .19], .035, [0, .057, .79], steel);
  return root;
}

export function createRoom(scene) {
  const group = new THREE.Group(); group.name = 'SuburbanParlor'; scene.add(group);
  const floor = material(0xffffff, .96); floor.map = carpetTexture();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), floor);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  const wall = material(0xa69e94, .94), dark = material(0x353238, .8), soffit = material(0x7e7770, .9);
  rounded(group, [10, 2.8, .12], [0, 1.4, -1.15], wall);
  // The far aisle wall gives the side shot depth instead of a blank fog field.
  rounded(group, [.12, 2.8, 6], [3.7, 1.4, 1.5], material(0xa69e94, .94));
  for (let z = -1; z < 4; z += .65) {
    rounded(group, [.018, 2.24, .018], [3.63, 1.12, z], material(0x8c8479), .004);
  }
  rounded(group, [.026, .075, 6], [3.62, .16, 1.5], material(0x716960), .004);
  rounded(group, [10, .22, .68], [0, 2.16, -.56], dark);
  rounded(group, [10, .08, .82], [0, 1.92, -.48], soffit);
  rounded(group, [10, .07, 8], [0, 2.65, 1], material(0x948b80, .95));
  // Muted wall panels and ceiling fixtures establish a Japanese everyday parlor.
  for (let x = -4; x <= 4; x += .82) {
    rounded(group, [.018, 1.9, .024], [x, 1, -1.075], material(0x6e665f));
    rounded(group, [.51, .025, .31], [x, 2.602, .38], dark, .009);
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(.45, .25), new THREE.MeshBasicMaterial({ color: 0xffedcd }));
    lens.rotation.x = Math.PI / 2; lens.position.set(x, 2.584, .38); group.add(lens);
  }
  for (let z = 1.8; z < 6; z += 1.25) {
    rounded(group, [8, .025, .32], [0, 2.61, z], material(0x625f5c), .008);
    rounded(group, [7.6, .008, .22], [0, 2.588, z], new THREE.MeshBasicMaterial({ color: 0xe4d3b4 }), .003);
  }
  // A restrained red carpet border marks the aisle, without bright scene decoration.
  rounded(group, [8, .003, .065], [0, .003, 1.52], material(0x71423c), .001);
  // Keep structural posts outside the three portrait sight lines.
  rounded(group, [.14, 2.6, .14], [-4.8, 1.3, .3], material(0x85766b));
  const chair = createChair(); scene.add(chair);
  return { root: group, chair };
}
