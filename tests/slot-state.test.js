import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SLOT_TYPES, SLOT_PHASES, NORMAL_SYMBOLS,
  createNormalReels, createSlotState, transitionSlot,
  getSlotPresentation, assertValidReels,
} from '../slot-state.js';

const bonusEvents = ['ESTABLISH_BONUS', 'NOTIFY_BONUS', 'ALIGN_SEVENS', 'START_BONUS'];
const phases = [SLOT_PHASES.NORMAL, SLOT_PHASES.ESTABLISHED,
  SLOT_PHASES.NOTIFIED, SLOT_PHASES.ALIGNED, SLOT_PHASES.PLAY];

function assertNormalReels(reels) {
  assert.equal(reels.length, 3, 'three reels');
  for (const reel of reels) {
    assert.equal(reel.length, 3, 'three visible symbols per reel');
    for (const symbol of reel) assert.ok(NORMAL_SYMBOLS.includes(symbol));
  }
  for (let row = 0; row < 3; row++) {
    assert.ok(!reels.every(reel => reel[row] === reels[0][row]),
      `normal row ${row} must not show a three-symbol match`);
  }
  assert.notEqual(reels[0][1], 'cherry', 'no cherry on left middle');
}

test('normal reel layouts always contain a nonmatching 3 × 3 of colored symbols', () => {
  assert.equal(new Set(NORMAL_SYMBOLS).size, 7);
  assert.ok(!NORMAL_SYMBOLS.includes('seven'));
  assert.ok(!NORMAL_SYMBOLS.includes('cherry'));
  for (let seed = 0; seed < 10_000; seed++) {
    const reels = createNormalReels(seed);
    assertNormalReels(reels);
    assert.doesNotThrow(() => assertValidReels(reels));
  }
});

test('normal layout generation is deterministic and returns independent arrays', () => {
  const original = createNormalReels(12);
  assert.deepEqual(createNormalReels(12), original);
  const another = createNormalReels(12);
  assert.notEqual(another, original);
  another.forEach((reel, index) => assert.notEqual(reel, original[index]));
});

test('reel validation rejects invalid dimensions, unknown symbols and left-middle cherries', () => {
  const copy = () => createNormalReels().map(reel => [...reel]);
  for (const invalid of [null, [], [[], [], []], createNormalReels().slice(0, 2)]) {
    assert.throws(() => assertValidReels(invalid));
  }
  const extraRow = copy(); extraRow[2].push(NORMAL_SYMBOLS[0]);
  const unknown = copy(); unknown[1][0] = 'licensed-logo';
  const cherry = copy(); cherry[0][1] = 'cherry';
  for (const invalid of [extraRow, unknown, cherry]) {
    assert.throws(() => assertValidReels(invalid));
    assert.throws(() => assertValidReels(invalid, { allowSevens: true }));
  }
});

test('reel validation checks every horizontal row, including top and bottom', () => {
  for (let row = 0; row < 3; row++) {
    const invalid = createNormalReels().map(reel => [...reel]);
    invalid.forEach(reel => { reel[row] = NORMAL_SYMBOLS[0]; });
    assert.throws(() => assertValidReels(invalid));
  }
});

test('sevens require an explicitly allowed bonus presentation', () => {
  const reels = createNormalReels().map(reel => [...reel]);
  reels.forEach(reel => { reel[1] = 'seven'; });
  assert.throws(() => assertValidReels(reels));
  assert.doesNotThrow(() => assertValidReels(reels, { allowSevens: true }));
  for (const row of [0, 2]) {
    const misplaced = createNormalReels().map(reel => [...reel]);
    misplaced[1][row] = 'seven';
    assert.throws(() => assertValidReels(misplaced, { allowSevens: true }));
  }
});

for (const type of [SLOT_TYPES.NORMAL, SLOT_TYPES.TROPICAL]) {
  test(`${type}: bonus award, notice, alignment and play are separate states`, () => {
    let state = createSlotState(type, 3);
    assert.equal(state.type, type);
    for (let step = 0; step < phases.length; step++) {
      assert.equal(state.phase, phases[step]);
      const view = getSlotPresentation(state);
      assert.deepEqual(view.reels, state.reels);
      assert.equal(view.bonusAwarded, step > 0);
      assert.equal(view.bonusPaid, step >= 3);
      assert.equal(view.winningScreen, step >= 2);
      assert.equal(view.noticeLampOn, type === SLOT_TYPES.TROPICAL && step >= 2);
      assert.notEqual(state.reels[0][1], 'cherry');
      if (step < 3) {
        assertNormalReels(view.reels);
      } else {
        assert.ok(view.reels.every(reel => reel[1] === 'seven'));
        for (const row of [0, 2]) {
          assert.ok(view.reels.every(reel => NORMAL_SYMBOLS.includes(reel[row])));
        }
      }
      if (step < bonusEvents.length) state = transitionSlot(state, bonusEvents[step]);
    }
    state = transitionSlot(state, 'END_BONUS');
    assert.equal(state.phase, SLOT_PHASES.NORMAL);
    assertNormalReels(state.reels);
    assert.equal(getSlotPresentation(state).bonusAwarded, false);
    assert.equal(getSlotPresentation(state).bonusPaid, false);
    assert.equal(getSlotPresentation(state).winningScreen, false);
    assert.equal(getSlotPresentation(state).noticeLampOn, false);
  });

  test(`${type}: transitions and presentation do not mutate prior states`, () => {
    let state = createSlotState(type);
    for (const event of [...bonusEvents, 'END_BONUS']) {
      const snapshot = structuredClone(state);
      getSlotPresentation(state);
      const next = transitionSlot(state, event);
      assert.deepEqual(state, snapshot);
      assert.notEqual(next, state);
      state = next;
    }
  });

  test(`${type}: cannot skip award/notice/alignment or restart a running bonus`, () => {
    const allowed = [...bonusEvents, 'END_BONUS'];
    let state = createSlotState(type);
    for (let step = 0; step < phases.length; step++) {
      for (const event of allowed) {
        if (event !== allowed[step]) {
          const before = structuredClone(state);
          assert.throws(() => transitionSlot(state, event));
          assert.deepEqual(state, before);
        }
      }
      if (step < bonusEvents.length) state = transitionSlot(state, bonusEvents[step]);
    }
  });

  test(`${type}: no AT additions or continuations at any phase`, () => {
    let state = createSlotState(type);
    for (let step = 0; step < phases.length; step++) {
      for (const event of ['ADD_GAMES', 'AT_CONTINUE', 'ENTER_AT', 'CONTINUE', 'toString', '__proto__', '', null]) {
        assert.throws(() => transitionSlot(state, event));
      }
      if (step < bonusEvents.length) state = transitionSlot(state, bonusEvents[step]);
    }
  });
}

test('tropical notice lamp remains off through repeated nonwinning normal presentations', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const state = createSlotState(SLOT_TYPES.TROPICAL, seed);
    assert.equal(getSlotPresentation(state).noticeLampOn, false);
    assertNormalReels(state.reels);
  }
});

test('unsupported machine variants require a deliberate implementation', () => {
  for (const type of ['smart-at', 'bt', 'real-machine', null]) {
    assert.throws(() => createSlotState(type));
  }
});

test('presentation and transitions reject forged machine types, phases and unearned sevens', () => {
  const normal = createSlotState(SLOT_TYPES.NORMAL);
  const sevens = normal.reels.map(reel => [reel[0], 'seven', reel[2]]);
  const invalidStates = [
    { ...normal, type: 'smart-at' },
    { ...normal, phase: 'at-continue' },
    { ...normal, phase: SLOT_PHASES.ALIGNED },
    { ...normal, phase: SLOT_PHASES.PLAY },
    ...[SLOT_PHASES.NORMAL, SLOT_PHASES.ESTABLISHED, SLOT_PHASES.NOTIFIED]
      .map(phase => ({ ...normal, phase, reels: sevens })),
  ];
  for (const state of invalidStates) {
    assert.throws(() => getSlotPresentation(state));
    assert.throws(() => transitionSlot(state, 'ESTABLISH_BONUS'));
  }
});

test('normal layouts handle signed integer seeds and reject invalid seeds', () => {
  for (const seed of [-1000, -7, -1, 0, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]) {
    assertNormalReels(createNormalReels(seed));
  }
  for (const seed of [NaN, Infinity, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => createNormalReels(seed));
  }
});
