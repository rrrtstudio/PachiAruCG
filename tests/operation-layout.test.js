import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3 } from '../vendor/three/three.module.js';
import { HAND_CONTACT_OFFSETS, STUDY_WRISTS, STOP_BUTTONS, buttonContact } from '../scene/operation-layout.js';
import { sampleMotion } from '../scene/motion.js';

const binary = readFileSync(new URL('../assets/character.glb', import.meta.url));
const jsonLength = binary.readUInt32LE(12);
const gltf = JSON.parse(binary.subarray(20, 20 + jsonLength).toString('utf8'));
const bin = binary.subarray(20 + jsonLength + 8);
const parents = new Map();
gltf.nodes.forEach((node, index) => (node.children || []).forEach(child => parents.set(child, index)));
function worldMatrix(index) {
  const node = gltf.nodes[index];
  const matrix = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
    new Vector3(...(node.translation || [0, 0, 0])),
    new Quaternion(...(node.rotation || [0, 0, 0, 1])), new Vector3(...(node.scale || [1, 1, 1])));
  return parents.has(index) ? worldMatrix(parents.get(index)).multiply(matrix) : matrix;
}
const nodeIndex = name => {
  const index = gltf.nodes.findIndex(node => node.name === name);
  assert.ok(index >= 0, `Missing authored ${name}`);
  return index;
};
const jointPosition = name => new Vector3().setFromMatrixPosition(worldMatrix(nodeIndex(name)));

test('all three full presses meet the moving button face with the active finger pad', () => {
  for (let cycle = 0; cycle < 3; cycle++) {
    const pose = sampleMotion('play', (cycle + .55) * 1.8);
    assert.ok(pose.press > .999999);
    const side = pose.button === 0 ? 'L' : 'R';
    const prefix = side === 'L' ? 'left' : 'right';
    const finger = ['X', 'Y', 'Z'].map((axis, index) => pose[prefix + axis] + HAND_CONTACT_OFFSETS[side].button[index]);
    const expected = [[-.16, 0, .16][pose.button], .794, .195];
    finger.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-9,
      `${side} pad misses stop ${pose.button}, axis ${index}`));
  }
});

test('finger contact stays inside the real button disc throughout its four-millimetre travel', () => {
  for (const index of [0, 1, 2]) {
    const release = buttonContact(index), pressed = buttonContact(index, 1);
    assert.ok(Math.abs(release[1] - .780) < .031, 'touch lies on the disc rather than its surrounding deck');
    assert.ok(Math.abs(release[2] - pressed[2] - .004) < 1e-10);
    assert.ok(Math.abs(STOP_BUTTONS.hover - STOP_BUTTONS.approach + .004) < 1e-10);
  }
  for (const index of [-1, 3, .5, NaN]) assert.throws(() => buttonContact(index));
  for (const press of [-.1, 1.1, NaN, Infinity]) assert.throws(() => buttonContact(0, press));
});

test('both static operating wrists remain reachable with elbow bend in the authored skeleton', () => {
  for (const [side, wrist] of [['R', STUDY_WRISTS.right], ['L', STUDY_WRISTS.left]]) {
    const shoulder = jointPosition(`UpperArm_${side}`), elbow = jointPosition(`Forearm_${side}`);
    const restWrist = jointPosition(`Hand_${side}`);
    const upperLength = shoulder.distanceTo(elbow), lowerLength = elbow.distanceTo(restWrist);
    const reach = shoulder.distanceTo(new Vector3(...wrist));
    assert.ok(reach < upperLength + lowerLength - .004, `${side} study arm would lock its elbow or clamp`);
    assert.ok(reach > Math.abs(upperLength - lowerLength) + .004, `${side} study arm would fold beyond its reach`);
  }
});

test('the GLB records the same contact landmarks and places each finger pad on the actual hand mesh', () => {
  for (const side of ['L', 'R']) {
    const meshIndex = nodeIndex(`SkinArm_${side}`), node = gltf.nodes[meshIndex];
    assert.deepEqual(node.extras.buttonContactOffset, [...HAND_CONTACT_OFFSETS[side].button]);
    if (side === 'L') assert.deepEqual(node.extras.leverGripOffset, [...HAND_CONTACT_OFFSETS.L.lever]);
    const pad = jointPosition(`Hand_${side}`).add(new Vector3(...node.extras.buttonContactOffset));
    const meshWorld = worldMatrix(meshIndex);
    let nearest = Infinity;
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const accessor = gltf.accessors[primitive.attributes.POSITION], view = gltf.bufferViews[accessor.bufferView];
      assert.equal(accessor.componentType, 5126);
      assert.equal(accessor.type, 'VEC3');
      const stride = view.byteStride || 12, start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
      for (let vertex = 0; vertex < accessor.count; vertex++) {
        const offset = start + vertex * stride;
        const point = new Vector3(bin.readFloatLE(offset), bin.readFloatLE(offset + 4), bin.readFloatLE(offset + 8))
          .applyMatrix4(meshWorld);
        nearest = Math.min(nearest, point.distanceTo(pad));
      }
    }
    assert.ok(nearest < .0035, `${side} contact marker is ${nearest}m away from the hand geometry`);
  }
});
