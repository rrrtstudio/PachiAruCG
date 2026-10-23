// Metre-scale wrist targets for the seated rig. Hip, knees and feet stay planted.
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const base = Object.freeze({ headYaw: .55, headPitch: 0, spinePitch: 0, chestRoll: 0,
  rightX: .16, rightY: .81, rightZ: .31, leftX: -.26, leftY: .81, leftZ: .34,
  smile: 0, open: 0, frown: 0, blink: 0, press: 0, button: 2 });

function blend(a, b, amount) {
  return Object.fromEntries(Object.keys(base).map(key => [key, a[key] + (b[key] - a[key]) * amount]));
}

function pose(mode, time) {
  const out = { ...base };
  if (['play', 'pretend'].includes(mode)) {
    const cycle = time / 1.8, index = Math.floor(cycle), phase = cycle % 1;
    // The right hand covers right/centre; the left hand covers the left stop.
    // Reaching across all three with the right arm would stretch the seated rig.
    const buttons = [.16, 0, 0];
    const previous = buttons[((index + 2) % 3 + 3) % 3];
    const current = buttons[index % 3];
    out.rightX = previous + (current - previous) * ease(phase / .30);
    out.press = phase > .42 && phase < .68 ? Math.sin((phase - .42) / .26 * Math.PI) ** 2 : 0;
    const leftPrevious = index % 3 === 0 ? 1 : 0, leftCurrent = index % 3 === 2 ? 1 : 0;
    const leftReach = leftPrevious + (leftCurrent - leftPrevious) * ease(phase / .30);
    out.rightZ = .31 + leftReach * .015 - (1 - leftReach) * out.press * .009;
    out.rightY = .81 + Math.sin(Math.PI * clamp(phase / .34)) * .008;
    out.leftX = -.26 + .10 * leftReach;
    out.leftZ = .34 - leftReach * (.018 + out.press * .009);
    out.button = index % 3 === 0 ? 2 : index % 3 === 1 ? 1 : 0;
    out.spinePitch = -.025;
    out.headYaw = mode === 'pretend' ? .32 : .36;
    if (mode === 'pretend') { out.frown = .18; out.smile = .06; out.headPitch = -.045; }
  } else if (mode === 'look') {
    out.headYaw = -.56; out.headPitch = .025;
    out.rightZ = .36; out.rightY = .795;
  } else if (mode === 'shock') {
    out.headYaw = -.40; out.headPitch = .05; out.open = .72;
    out.rightZ = .39; out.rightY = .86;
  } else if (mode === 'sad') {
    out.headYaw = .40; out.headPitch = -.23; out.spinePitch = -.075;
    out.chestRoll = -.025; out.frown = .88;
    out.rightZ = .42; out.rightY = .735; out.leftZ = .40; out.leftY = .76;
  } else if (mode === 'angry') {
    out.headYaw = .30; out.headPitch = -.06; out.spinePitch = -.04;
    out.frown = .55; out.open = .18; out.rightZ = .37;
  } else if (mode === 'smile') {
    out.headYaw = .35; out.headPitch = .05; out.smile = .90; out.open = .20;
    out.rightZ = .40; out.rightY = .94; out.leftZ = .40; out.leftY = .86;
  }
  return out;
}

const frames = [[0, 'play'], [2.35, 'play'], [2.75, 'shock'], [3.15, 'look'],
  [4.2, 'sad'], [5.25, 'pretend'], [6.65, 'play'], [7.3, 'play']];

export function sampleMotion(mode, time) {
  if (!Number.isFinite(time) || time < 0) throw new RangeError('Invalid motion time');
  let result;
  if (mode === 'demo') {
    const t = time % 7.3;
    for (let i = 0; i < frames.length - 1; i++) {
      const [start, from] = frames[i], [end, to] = frames[i + 1];
      if (t <= end) { result = blend(pose(from, t), pose(to, t), ease((t - start) / (end - start))); break; }
    }
  } else {
    if (!['idle', 'play', 'look', 'shock', 'sad', 'angry', 'smile', 'pretend'].includes(mode)) {
      throw new RangeError('Unknown motion');
    }
    result = pose(mode, time);
  }
  const blinkPhase = time % 4.1;
  result.spinePitch += Math.sin(time * 1.15) * .0025;
  result.blink = blinkPhase > 3.6 && blinkPhase < 3.78 ? Math.sin((blinkPhase - 3.6) / .18 * Math.PI) ** 2 : 0;
  return result;
}

export function dampMotion(previous, target, dt) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid animation delta');
  return blend(previous, target, 1 - Math.exp(-dt * 8));
}
