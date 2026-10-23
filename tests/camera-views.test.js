import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_VIEWS, DEFAULT_CAMERA_VIEW, applyCameraView } from '../camera-views.js';

test('three distinct portrait camera views match the seated player and cabinet layout', () => {
  assert.deepEqual(Object.keys(CAMERA_VIEWS), ['player', 'behind', 'side']);
  assert.equal(DEFAULT_CAMERA_VIEW, 'side');
  const { player, behind, side } = CAMERA_VIEWS;
  assert.equal(player.position[0], 0.43);
  assert.ok(player.position[2] < 1.34 - 0.585, 'eyes face the cabinet, clear of the head');
  assert.ok(player.target[2] < player.position[2]);
  assert.ok(behind.position[2] > 1.34, 'back shot is behind the player');
  assert.ok(side.position[0] < 0.43 - 3, 'side shot is offset from the island');
  assert.equal(new Set(Object.values(CAMERA_VIEWS).map(view => view.position.join(','))).size, 3);
});

test('switching views updates framing without changing the portrait aspect or camera object', () => {
  const camera = {
    aspect: 9 / 16,
    position: { set(...values) { this.values = values; } },
    lookAt(...values) { this.target = values; },
    updates: 0,
    updateProjectionMatrix() { this.updates++; },
  };
  for (const viewId of ['player', 'behind', 'side', 'player']) {
    const view = applyCameraView(camera, viewId);
    assert.deepEqual(camera.position.values, view.position);
    assert.deepEqual(camera.target, view.target);
    assert.equal(camera.fov, view.fov);
    assert.equal(camera.aspect, 9 / 16);
  }
  assert.equal(camera.updates, 4);
  assert.throws(() => applyCameraView(camera, 'unknown'), RangeError);
  assert.throws(() => applyCameraView(camera, '__proto__'), RangeError);
  assert.equal(camera.updates, 4, 'invalid input leaves the active camera unchanged');
});
