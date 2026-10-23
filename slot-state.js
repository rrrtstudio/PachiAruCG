// Original, abstract symbols only. Reels are indexed [column][row].
export const NORMAL_SYMBOLS = Object.freeze([
  'blue', 'purple', 'yellow', 'green', 'rose', 'lavender', 'orange'
]);
export const SYMBOL_COLORS = Object.freeze({
  blue: 0x3d98db, purple: 0xa43dbe, yellow: 0xebbb44, green: 0x2fb686,
  rose: 0xdd656a, lavender: 0x7891cd, orange: 0xf38f47
});
export const SLOT_TYPES = Object.freeze({ NORMAL: 'normal', TROPICAL: 'tropical' });
export const SLOT_PHASES = Object.freeze({
  NORMAL: 'normal', ESTABLISHED: 'bonus-established', NOTIFIED: 'bonus-notified',
  ALIGNED: 'bonus-aligned', PLAY: 'bonus-play'
});

export function assertValidReels(reels, { allowSevens = false } = {}) {
  if (!Array.isArray(reels) || reels.length !== 3 ||
      reels.some(column => !Array.isArray(column) || column.length !== 3)) {
    throw new RangeError('Reels must contain three columns of three symbols');
  }
  if (reels[0][1] === 'cherry') throw new RangeError('No cherry on the left center');
  for (let column = 0; column < 3; column++) {
    for (let row = 0; row < 3; row++) {
      const symbol = reels[column][row];
      if (!NORMAL_SYMBOLS.includes(symbol) &&
          !(allowSevens && row === 1 && symbol === 'seven')) {
        throw new RangeError('Unknown or misplaced symbol');
      }
    }
  }
  for (let row = 0; row < 3; row++) {
    const symbol = reels[0][row];
    const matched = reels.every(column => column[row] === symbol);
    if (matched && !(allowSevens && row === 1 && symbol === 'seven')) {
      throw new RangeError('No identical horizontal line during normal play');
    }
  }
  return reels;
}

export function createNormalReels(seed = 0) {
  if (!Number.isSafeInteger(seed)) throw new RangeError('Reel seed must be an integer');
  const offset = ((seed % NORMAL_SYMBOLS.length) + NORMAL_SYMBOLS.length) % NORMAL_SYMBOLS.length;
  const reels = Array.from({ length: 3 }, (_, column) =>
    Array.from({ length: 3 }, (_, row) =>
      NORMAL_SYMBOLS[(column * 2 + row * 3 + offset) % NORMAL_SYMBOLS.length]));
  return assertValidReels(reels);
}

function freezeState(type, phase, reels) {
  return Object.freeze({ type, phase, reels: Object.freeze(reels.map(column => Object.freeze([...column]))) });
}

function assertState(state) {
  if (!Object.values(SLOT_TYPES).includes(state.type) ||
      !Object.values(SLOT_PHASES).includes(state.phase)) {
    throw new RangeError('Unknown machine type or phase');
  }
  const paid = [SLOT_PHASES.ALIGNED, SLOT_PHASES.PLAY].includes(state.phase);
  assertValidReels(state.reels, { allowSevens: paid });
  if (paid && !state.reels.every(column => column[1] === 'seven')) {
    throw new RangeError('Bonus entry requires three center sevens');
  }
}

export function createSlotState(type = SLOT_TYPES.NORMAL, seed = 0) {
  if (!Object.values(SLOT_TYPES).includes(type)) throw new RangeError('Unknown machine type');
  return freezeState(type, SLOT_PHASES.NORMAL, createNormalReels(seed));
}

const TRANSITIONS = Object.freeze({
  ESTABLISH_BONUS: [SLOT_PHASES.NORMAL, SLOT_PHASES.ESTABLISHED],
  NOTIFY_BONUS: [SLOT_PHASES.ESTABLISHED, SLOT_PHASES.NOTIFIED],
  ALIGN_SEVENS: [SLOT_PHASES.NOTIFIED, SLOT_PHASES.ALIGNED],
  START_BONUS: [SLOT_PHASES.ALIGNED, SLOT_PHASES.PLAY],
  END_BONUS: [SLOT_PHASES.PLAY, SLOT_PHASES.NORMAL]
});

export function transitionSlot(state, event) {
  assertState(state);
  const transition = Object.hasOwn(TRANSITIONS, event) ? TRANSITIONS[event] : null;
  if (!transition || transition[0] !== state.phase) {
    throw new RangeError(`Invalid slot transition: ${state.phase} -> ${event}`);
  }
  const phase = transition[1];
  let reels = state.reels;
  if (phase === SLOT_PHASES.ALIGNED) {
    reels = state.reels.map(column => [column[0], 'seven', column[2]]);
  } else if (phase === SLOT_PHASES.NORMAL) {
    // The top-left symbol survives the bonus and identifies the original idle pattern.
    reels = createNormalReels(NORMAL_SYMBOLS.indexOf(state.reels[0][0]));
  }
  const next = freezeState(state.type, phase, reels);
  assertState(next);
  return next;
}

export function getSlotPresentation(state) {
  assertState(state);
  const notified = [SLOT_PHASES.NOTIFIED, SLOT_PHASES.ALIGNED, SLOT_PHASES.PLAY].includes(state.phase);
  return Object.freeze({
    reels: state.reels,
    noticeLampOn: state.type === SLOT_TYPES.TROPICAL && notified,
    winningScreen: notified,
    bonusAwarded: state.phase !== SLOT_PHASES.NORMAL,
    bonusPaid: [SLOT_PHASES.ALIGNED, SLOT_PHASES.PLAY].includes(state.phase)
  });
}
