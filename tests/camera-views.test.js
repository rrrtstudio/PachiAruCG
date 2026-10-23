import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_VIEWS, DEFAULT_CAMERA_VIEW, applyCameraView } from '../camera-views.js';

// Small independent pinhole projection; no WebGL or Three.js dependency.
const sub = (a, b) => a.map((value, i) => value - b[i]);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const unit = a => a.map(value => value / Math.hypot(...a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function project(view, point) {
  const forward = unit(sub(view.target, view.position));
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const relative = sub(point, view.position);
  const depth = dot(relative, forward);
  const halfAngle = Math.tan(view.fov * Math.PI / 360);
  assert.ok(depth > 0, 'scene anchor must lie ahead of the camera');
  return [dot(relative, right) / (depth * halfAngle * 9 / 16), dot(relative, up) / (depth * halfAngle)];
}

test('three distinct cameras use moderate lenses around the seated study', () => {
  assert.deepEqual(Object.keys(CAMERA_VIEWS), ['player', 'behind', 'side']);
  assert.equal(DEFAULT_CAMERA_VIEW, 'side');
  const { player, behind, side } = CAMERA_VIEWS;
  assert.ok(player.position[1] > 1.55, 'operating view looks over the shoulders');
  assert.ok(player.target[2] < player.position[2]);
  assert.ok(behind.position[2] > 0.99, 'back shot is behind the chair');
  assert.ok(Math.abs(behind.position[0]) > 1, 'back shot has enough shoulder parallax');
  assert.ok(side.position[2] > 0 && side.position[2] < 0.72, 'front-side view lies between cabinet face and player');
  assert.ok(side.position[0] < -1, 'front-side shot is offset from the island');
  for (const view of Object.values(CAMERA_VIEWS)) assert.ok(view.fov >= 32 && view.fov <= 50);
  assert.equal(new Set(Object.values(CAMERA_VIEWS).map(view => view.position.join(','))).size, 3);
});

test('cabinet top, base, nine-symbol window and all controls fit the portrait frame', () => {
  const anchors = [];
  for (const x of [-.38, .38]) {
    // The wide cabinet shoulders end below the separate, narrower data unit.
    for (const y of [.01, 1.77]) anchors.push([x, y, .02]);
  }
  for (const x of [-.312, .312]) anchors.push([x, 1.907, -.062]);
  for (const x of [-.27, .27]) {
    for (const y of [.87, 1.27]) anchors.push([x, y, .03]);
  }
  for (const x of [-.28, -.16, 0, .16, .28]) anchors.push([x, .78, .15]);
  for (const [id, view] of Object.entries(CAMERA_VIEWS)) {
    for (const point of anchors) {
      const projection = project(view, point);
      assert.ok(projection.every(value => Math.abs(value) < .95), `${id}: ${point} is cropped`);
    }
  }
});

test('the shoulder shot keeps the head silhouette clear of the reel window', () => {
  const view = CAMERA_VIEWS.behind;
  const reelRight = Math.max(...[-.27, .27].flatMap(x => [.87, 1.27].map(y => project(view, [x, y, .03])[0])));
  const headX = [];
  for (let longitude = 0; longitude < 64; longitude++) {
    for (let latitude = 0; latitude <= 32; latitude++) {
      const u = longitude * Math.PI / 32, v = latitude * Math.PI / 32 - Math.PI / 2;
      headX.push(project(view, [.23 * Math.cos(v) * Math.cos(u), 1.30 + .25 * Math.sin(v), .72 + .23 * Math.cos(v) * Math.sin(u)])[0]);
    }
  }
  assert.ok(Math.min(...headX) > reelRight, 'head must not cover the three reels');
});

test('the front-side view looks at least ten degrees into the cabinet face', () => {
  const view = CAMERA_VIEWS.side;
  const fromFace = [view.position[0], view.position[2] - .03];
  const faceVisibility = fromFace[1] / Math.hypot(...fromFace);
  assert.ok(faceVisibility >= Math.sin(10 * Math.PI / 180), 'avoid a grazing view where the cabinet collapses to a line');
});

test('both character views retain the feet, seat and full chair back inside the frame', () => {
  const anchors = [
    [-.15, .02, .12], [.15, .02, .12],
    [-.23, .35, .54], [.23, .35, .96],
    [0, 1.55, .72],
  ];
  // Actual upholstered back shell: .445 × .44 × .078, tilted -.08 rad.
  // Its highest and deepest corners are different points, not a fictitious
  // metre-high rectangular back that would unnecessarily force a wider shot.
  for (const x of [-.2225, .2225]) {
    for (const y of [-.22, .22]) {
      for (const z of [-.039, .039]) {
        anchors.push([x, .72 + y * Math.cos(-.08) - z * Math.sin(-.08),
          .986 + y * Math.sin(-.08) + z * Math.cos(-.08)]);
      }
    }
  }
  for (const id of ['behind', 'side']) {
    for (const anchor of anchors) {
      assert.ok(project(CAMERA_VIEWS[id], anchor).every(value => Math.abs(value) < .97), `${id}: cropped body/chair at ${anchor}`);
    }
  }
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
