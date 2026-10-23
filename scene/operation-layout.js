// World-space operating landmarks, in metres. They refer to the same cabinet
// and the same sculpted hands in every shot; the camera never changes a pose.
const frozen = values => Object.freeze(values);

export const STOP_BUTTONS = Object.freeze({
  x: frozen([-.16, 0, .16]),
  centreY: .780,
  radius: .031,
  depth: .014,
  frontZ: .199,
  travel: .004,
  // Touch the upper half of the disc, leaving room for a softly bent elbow.
  contactRise: .014,
  hover: .005,
  approach: .009,
});

export const LEVER_GRIP_CENTRE = frozen([-.278, .788, .227]);
export const HAND_CONTACT_OFFSETS = Object.freeze({
  R: Object.freeze({ button: frozen([-.024, -.029, -.108]) }),
  L: Object.freeze({ button: frozen([.024, -.029, -.108]), lever: frozen([-.015, -.053, -.100]) }),
});

export function buttonContact(index, press = 0) {
  if (!Number.isInteger(index) || index < 0 || index > 2) throw new RangeError('Invalid stop button');
  if (!Number.isFinite(press) || press < 0 || press > 1) throw new RangeError('Invalid stop travel');
  return [STOP_BUTTONS.x[index], STOP_BUTTONS.centreY + STOP_BUTTONS.contactRise,
    STOP_BUTTONS.frontZ - STOP_BUTTONS.travel * press];
}

export function wristAtContact(side, kind, contact) {
  const offset = HAND_CONTACT_OFFSETS[side]?.[kind];
  if (!Array.isArray(offset) || !Array.isArray(contact) || contact.length !== 3 || !contact.every(Number.isFinite)) {
    throw new RangeError('Invalid hand contact');
  }
  return contact.map((value, axis) => value - offset[axis]);
}

export const STUDY_WRISTS = Object.freeze({
  right: frozen(wristAtContact('R', 'button', buttonContact(2))),
  left: frozen(wristAtContact('L', 'lever', LEVER_GRIP_CENTRE)),
});
