import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleMotion, dampMotion } from '../scene/motion.js';

const modes = ['idle', 'play', 'look', 'shock', 'sad', 'angry', 'smile', 'pretend', 'demo'];
const expressive = ['smile', 'open', 'frown', 'blink', 'press'];

test('every motion produces finite restrained joint, wrist and expression targets', () => {
  const keys = Object.keys(sampleMotion('idle', 0));
  for (const mode of modes) {
    for (let frame = 0; frame <= 600; frame++) {
      const pose = sampleMotion(mode, frame / 60);
      assert.deepEqual(Object.keys(pose), keys);
      assert.ok(Object.values(pose).every(Number.isFinite), `${mode}: nonfinite target`);
      for (const key of expressive) assert.ok(pose[key] >= 0 && pose[key] <= 1, `${mode}: ${key}`);
      assert.ok(Math.abs(pose.headYaw) < 1.1 && Math.abs(pose.headPitch) < .4);
      assert.ok(Math.abs(pose.spinePitch) < .15 && Math.abs(pose.chestRoll) < .1);
      for (const side of ['left', 'right']) {
        assert.ok(pose[`${side}Y`] > .65 && pose[`${side}Y`] < 1.1, `${mode}: restrained ${side} wrist height`);
        assert.ok(pose[`${side}Z`] > .24 && pose[`${side}Z`] < .55, `${mode}: wrist remains outside cabinet shell`);
        assert.ok(Math.abs(pose[`${side}X`]) < .4, `${mode}: restrained wrist reach`);
      }
    }
  }
});

test('study pose holds a neutral expression and planted operating wrist targets', () => {
  const pose = sampleMotion('idle', 0);
  for (const key of expressive) assert.equal(pose[key], 0);
  assert.equal(pose.headYaw, .55);
  assert.deepEqual([pose.rightX, pose.rightY, pose.rightZ], [.16, .81, .31]);
  assert.deepEqual([pose.leftX, pose.leftY, pose.leftZ], [-.26, .81, .34]);
});

test('button play visits all three stops with a shallow press rather than arm replacement', () => {
  const presses = new Map();
  for (let frame = 0; frame < 600; frame++) {
    const pose = sampleMotion('play', frame / 100);
    if (pose.press > .9) presses.set(pose.button, pose.button === 0 ? pose.leftX : pose.rightX);
    assert.ok(pose.rightX >= 0, 'the right arm does not stretch across the body to the left stop');
  }
  assert.deepEqual([...presses.keys()].sort(), [0, 1, 2]);
  assert.ok(presses.get(0) < presses.get(1) && presses.get(1) < presses.get(2));
  for (let cycle = 0; cycle < 3; cycle++) {
    const pressed = sampleMotion('play', (cycle + .55) * 1.8);
    const released = sampleMotion('play', (cycle + .8) * 1.8);
    const side = pressed.button === 0 ? 'leftZ' : 'rightZ';
    const depth = released[side] - pressed[side];
    assert.ok(depth > .005, 'the active wrist really presses toward its stop button');
    assert.ok(depth < .015, 'each press remains mechanically small');
  }
});

test('look, disappointment and smile read as different head/body/face performances', () => {
  const neutral = sampleMotion('idle', 1);
  const look = sampleMotion('look', 1);
  const sad = sampleMotion('sad', 1);
  const happy = sampleMotion('smile', 1);
  assert.ok(look.headYaw < neutral.headYaw - .4, 'glance points toward the adjacent cabinet');
  assert.ok(sad.headPitch < neutral.headPitch - .1, 'disappointment lowers the head');
  assert.ok(sad.spinePitch < neutral.spinePitch, 'torso follows the disappointed head');
  assert.ok(sad.frown > .5 && sad.smile < .2);
  assert.ok(happy.smile > .5 && happy.frown < .2);
});

test('demo holds ordinary play until notification, then reacts and recovers', () => {
  const beforeNotice = sampleMotion('demo', 2.3);
  const ordinary = sampleMotion('play', 2.3);
  assert.equal(beforeNotice.open, 0);
  assert.equal(beforeNotice.frown, 0);
  assert.equal(beforeNotice.headYaw, ordinary.headYaw);
  assert.ok(sampleMotion('demo', 2.75).open > .5, 'reaction follows the notice cue');
  assert.ok(sampleMotion('demo', 4.2).frown > .5, 'disappointment follows the glance');
  assert.ok(sampleMotion('demo', 6.9).frown < .1, 'the character returns to ordinary play');
});

test('planned head, hand and face curves remain continuous across play cycles and demo cues', () => {
  const epsilon = .000001;
  for (const mode of ['play', 'pretend', 'demo']) {
    const boundaries = mode === 'demo' ? [2.35, 2.75, 3.15, 4.2, 5.25, 6.65] : [1.8, 3.6, 5.4];
    for (const time of boundaries) {
      const before = sampleMotion(mode, time - epsilon);
      const after = sampleMotion(mode, time + epsilon);
      for (const key of Object.keys(before).filter(key => key !== 'button')) {
        assert.ok(Math.abs(after[key] - before[key]) < .001, `${mode} jumps at ${time}: ${key}`);
      }
    }
  }
});

test('blinking uses the same two eye morph targets and smoothly closes and reopens', () => {
  const samples = Array.from({ length: 1001 }, (_, frame) => sampleMotion('idle', frame / 100).blink);
  assert.equal(Math.min(...samples), 0);
  assert.ok(Math.max(...samples) > .9);
  assert.ok(samples.every(value => value >= 0 && value <= 1));
  assert.ok(samples.some((value, index) => index > 0 && value > samples[index - 1]));
  assert.ok(samples.some((value, index) => index > 0 && value < samples[index - 1]));
});

test('damping freezes every channel at dt zero and does not mutate either pose', () => {
  const previous = sampleMotion('idle', 0), target = sampleMotion('sad', 1);
  const snapshots = [structuredClone(previous), structuredClone(target)];
  assert.deepEqual(dampMotion(previous, target, 0), previous);
  dampMotion(previous, target, 1 / 60);
  assert.deepEqual([previous, target], snapshots);
});

test('a frame approaches a new pose without snapping or overshooting', () => {
  const previous = sampleMotion('idle', 0), target = sampleMotion('sad', 1);
  const frame = dampMotion(previous, target, 1 / 60);
  for (const key of Object.keys(previous)) {
    assert.ok(Number.isFinite(frame[key]));
    assert.ok(frame[key] >= Math.min(previous[key], target[key]) - 1e-12);
    assert.ok(frame[key] <= Math.max(previous[key], target[key]) + 1e-12);
    if (previous[key] !== target[key]) {
      assert.notEqual(frame[key], previous[key]);
      assert.notEqual(frame[key], target[key]);
    }
  }
});

test('pose response is independent of 30fps versus 60fps sampling', () => {
  const previous = sampleMotion('idle', 0), target = sampleMotion('look', 1);
  const advance = fps => {
    let pose = structuredClone(previous);
    for (let frame = 0; frame < fps; frame++) pose = dampMotion(pose, target, 1 / fps);
    return pose;
  };
  const slow = advance(30), fast = advance(60);
  for (const key of Object.keys(slow)) assert.ok(Math.abs(slow[key] - fast[key]) < 1e-10, `frame-rate dependent ${key}`);
});

test('invalid motion modes, times and frame deltas are rejected', () => {
  for (const mode of ['at-continue', '', null, '__proto__']) assert.throws(() => sampleMotion(mode, 0));
  for (const time of [-1, NaN, Infinity, '1', null]) assert.throws(() => sampleMotion('play', time));
  for (const delta of [-.1, NaN, Infinity, '1', null]) {
    assert.throws(() => dampMotion(sampleMotion('idle', 0), sampleMotion('look', 0), delta));
  }
});
