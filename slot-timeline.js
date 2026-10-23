import { createSlotState, transitionSlot, SLOT_TYPES } from './slot-state.js';

// All cabinets on this island belong to one fictional tropical-notice series.
// Times describe this original animation, not the operation of any real machine.
export const BONUS_CUES = Object.freeze({
  established: 0, notified: 0.30, aligned: 1.00, play: 1.60, end: 4.60
});
const EVENTS = Object.freeze([
  [BONUS_CUES.established, 'ESTABLISH_BONUS'],
  [BONUS_CUES.notified, 'NOTIFY_BONUS'],
  [BONUS_CUES.aligned, 'ALIGN_SEVENS'],
  [BONUS_CUES.play, 'START_BONUS'],
  [BONUS_CUES.end, 'END_BONUS']
]);

export function getMachineStates(mode, sceneTime) {
  if (!Number.isFinite(sceneTime) || sceneTime < 0) throw new RangeError('Invalid scene time');
  const states = [0, 1, 2].map(seed => createSlotState(SLOT_TYPES.TROPICAL, seed));
  const neighborWins = ['look', 'shock', 'sad', 'angry', 'pretend'].includes(mode);
  const target = mode === 'smile' ? 1 : (mode === 'demo' || neighborWins) ? 2 : -1;
  const bonusTime = sceneTime - (mode === 'demo' ? 2.05 : 0);
  if (target >= 0) {
    for (const [time, event] of EVENTS) {
      if (bonusTime >= time) states[target] = transitionSlot(states[target], event);
    }
  }
  return states;
}
