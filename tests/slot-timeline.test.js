import test from 'node:test';
import assert from 'node:assert/strict';
import { getMachineStates } from '../slot-timeline.js';
import { getSlotPresentation, SLOT_PHASES, SLOT_TYPES } from '../slot-state.js';

test('demo timeline shows notice before sevens, then finishes back in normal play', () => {
  const moments = [
    [0, SLOT_PHASES.NORMAL], [2.04, SLOT_PHASES.NORMAL],
    [2.06, SLOT_PHASES.ESTABLISHED], [2.36, SLOT_PHASES.NOTIFIED],
    [3.06, SLOT_PHASES.ALIGNED], [3.66, SLOT_PHASES.PLAY],
    [6.66, SLOT_PHASES.NORMAL], [7.3, SLOT_PHASES.NORMAL]
  ];
  for (const [time, phase] of moments) {
    const states = getMachineStates('demo', time);
    assert.equal(states.length, 3);
    assert.equal(states[2].phase, phase);
    assert.ok(states.every(state => state.type === SLOT_TYPES.TROPICAL));
    assert.equal(states[0].phase, SLOT_PHASES.NORMAL);
    assert.equal(states[1].phase, SLOT_PHASES.NORMAL);
    const view = getSlotPresentation(states[2]);
    const aligned = [SLOT_PHASES.ALIGNED, SLOT_PHASES.PLAY].includes(phase);
    assert.equal(view.reels.every(column => column[1] === 'seven'), aligned);
  }
});

test('all nonwinning actions keep every lamp dark and every horizontal row unmatched', () => {
  for (const mode of ['idle', 'play']) {
    for (let time = 0; time < 10; time += .05) {
      for (const state of getMachineStates(mode, time)) {
        const view = getSlotPresentation(state);
        assert.equal(state.phase, SLOT_PHASES.NORMAL);
        assert.equal(view.noticeLampOn, false);
        assert.equal(view.winningScreen, false);
        assert.notEqual(view.reels[0][1], 'cherry');
        for (let row = 0; row < 3; row++) {
          assert.ok(!view.reels.every(column => column[row] === view.reels[0][row]));
        }
      }
    }
  }
});

test('individual actions use the same award/notice/alignment sequence and only one winning cabinet', () => {
  for (const mode of ['smile', 'look', 'shock', 'sad', 'angry', 'pretend']) {
    const winner = mode === 'smile' ? 1 : 2;
    for (const [time, phase] of [[0, SLOT_PHASES.ESTABLISHED], [.31, SLOT_PHASES.NOTIFIED],
      [1.01, SLOT_PHASES.ALIGNED], [1.61, SLOT_PHASES.PLAY], [4.61, SLOT_PHASES.NORMAL]]) {
      const states = getMachineStates(mode, time);
      states.forEach((state, index) => assert.equal(state.phase, index === winner ? phase : SLOT_PHASES.NORMAL));
    }
  }
});

test('seeking backward, changing actions and replaying restore deterministic normal reels and lamps', () => {
  const before = getMachineStates('demo', 0);
  getMachineStates('demo', 4);
  assert.deepEqual(getMachineStates('demo', 0), before);
  assert.deepEqual(getMachineStates('idle', 0), before);
  assert.deepEqual(getMachineStates('demo', 7.3), before);
  assert.deepEqual(getMachineStates('smile', 8), before);
});

test('timeline rejects invalid time inputs', () => {
  for (const time of [NaN, Infinity, -1, '2', null]) {
    assert.throws(() => getMachineStates('demo', time), RangeError);
  }
});
