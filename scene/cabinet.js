import * as THREE from 'three';
import { createSlotState, getSlotPresentation, SLOT_TYPES, SYMBOL_COLORS } from '../slot-state.js';
import { roundedBoxGeometry, staticGeometryBuilder, curvedReelGeometry } from './geometry.js';
import { STOP_BUTTONS, LEVER_GRIP_CENTRE } from './operation-layout.js';

const paint = (color, roughness = .4, metalness = .05) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const artworkCache = new Map();

function canvasTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, context: canvas.getContext('2d'), texture };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.roundRect(x, y, w, h, r); g.fill();
}

function roundedOutline(path, width, height, radius) {
  const x = width / 2, y = height / 2;
  path.moveTo(-x + radius, -y);
  path.lineTo(x - radius, -y); path.quadraticCurveTo(x, -y, x, -y + radius);
  path.lineTo(x, y - radius); path.quadraticCurveTo(x, y, x - radius, y);
  path.lineTo(-x + radius, y); path.quadraticCurveTo(-x, y, -x, y - radius);
  path.lineTo(-x, -y + radius); path.quadraticCurveTo(-x, -y, -x + radius, -y);
  path.closePath();
}

// The aperture is an actual hole. The display can sit behind its chamfered
// walls, and the walls cast their own shadows instead of painting a fake frame.
function bezelGeometry(width, height, innerWidth, innerHeight, depth,
  bevel = .004, outerRadius = .017, innerRadius = .008) {
  const outline = new THREE.Shape();
  roundedOutline(outline, width, height, outerRadius);
  const aperture = new THREE.Path();
  roundedOutline(aperture, innerWidth, innerHeight, innerRadius);
  outline.holes.push(aperture);
  return new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: true,
    bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3,
    curveSegments: 5, steps: 1 });
}

function stopButtonGeometry() {
  // The centre and the +z contact plane remain exactly as before. Only the
  // cap perimeter changes from a sharp cylinder edge to a moulded shoulder.
  const profile = [[0, -.007], [.028, -.007], [.031, -.0065], [.033, -.0045],
    [.033, .001], [.032, .0038], [.0305, .006], [.028, .007], [0, .007]];
  return new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(
    radius * STOP_BUTTONS.radius / .031, y * STOP_BUTTONS.depth / .014)), 32);
}

// Original cabinet artwork is painted for its own small in-world LCD. It is
// never used as a backdrop or replacement for the character's 3D animation.
function screenArtwork(winning, aligned = false) {
  const key = `${winning}:${aligned}`;
  if (artworkCache.has(key)) return artworkCache.get(key);
  const { context: g, texture } = canvasTexture(768, 512);
  if (winning) {
    const glow = g.createRadialGradient(384, 220, 15, 384, 220, 470);
    glow.addColorStop(0, '#fffbd7'); glow.addColorStop(.28, '#ffdf79');
    glow.addColorStop(.65, '#d9822d'); glow.addColorStop(1, '#532929');
    g.fillStyle = glow; g.fillRect(0, 0, 768, 512);
    for (let i = 0; i < 36; i++) {
      g.save(); g.translate(384, 230); g.rotate(i * Math.PI / 18);
      g.fillStyle = i % 2 ? '#fff6cd3d' : '#8e2f1e10';
      g.beginPath(); g.moveTo(-6, 0); g.lineTo(-24, 620); g.lineTo(24, 620); g.lineTo(6, 0); g.fill();
      g.restore();
    }
    const hues = ['#ffbda4', '#f7df84', '#d6ebb0', '#9fd9df', '#b0b2e6'];
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = hues[i]; g.globalAlpha = .6; g.lineWidth = 5;
      g.beginPath(); g.arc(384, 245, 150 + i * 12, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 75; i++) {
      const x = (i * 167 + 27) % 768, y = (i * 97 + 31) % 512;
      const r = 1.2 + i % 5;
      g.fillStyle = i % 3 ? '#fff6c5' : '#ffffff';
      g.beginPath(); g.moveTo(x - r, y); g.lineTo(x, y - r * 2);
      g.lineTo(x + r, y); g.lineTo(x, y + r * 2); g.fill();
    }
    if (aligned) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'italic 900 196px Georgia, serif';
      g.lineWidth = 12; g.strokeStyle = '#fff7cf';
      g.shadowBlur = 10; g.shadowColor = '#713620';
      g.strokeText('7 7 7', 384, 258); g.fillStyle = '#b62632'; g.fillText('7 7 7', 384, 258);
    } else {
      // Notification is visibly distinct from actually entering three sevens.
      g.strokeStyle = '#fff5c9'; g.lineWidth = 6; g.fillStyle = '#aa5a2b';
      g.beginPath(); g.moveTo(384, 133); g.lineTo(464, 253); g.lineTo(384, 373);
      g.lineTo(304, 253); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffeaa0'; g.beginPath(); g.arc(384, 253, 31, 0, Math.PI * 2); g.fill();
    }
  } else {
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#101c35'); sky.addColorStop(.5, '#4d7089');
    sky.addColorStop(.7, '#bca4a3'); sky.addColorStop(1, '#273d56');
    g.fillStyle = sky; g.fillRect(0, 0, 768, 512);
    const halo = g.createRadialGradient(542, 127, 15, 542, 127, 112);
    halo.addColorStop(0, '#fff5c34a'); halo.addColorStop(1, '#fff5c300');
    g.fillStyle = halo; g.fillRect(410, 0, 250, 260);
    g.fillStyle = '#e9d9b8'; g.beginPath(); g.arc(542, 127, 45, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#92a3b00d';
    for (let i = 0; i < 7; i++) {
      g.beginPath(); g.ellipse(75 + i * 115, 100 + i % 3 * 42, 95, 10, -.12, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 46; i++) {
      const x = (i * 131 + 23) % 768, y = (i * 47 + 15) % 213;
      g.fillStyle = i % 4 ? '#dee6df99' : '#fff3d8';
      g.fillRect(x, y, i % 7 === 0 ? 2.5 : 1.3, i % 7 === 0 ? 2.5 : 1.3);
    }
    const ridges = [
      { y: 301, color: '#65778d', a: 41, phase: .3 },
      { y: 340, color: '#394f67', a: 52, phase: 2.4 },
      { y: 373, color: '#253c51', a: 65, phase: 4.5 }
    ];
    for (const ridge of ridges) {
      g.beginPath(); g.moveTo(0, 512);
      for (let x = 0; x <= 784; x += 16) {
        const y = ridge.y - Math.sin(x * .008 + ridge.phase) * ridge.a - Math.sin(x * .027) * 14;
        g.lineTo(x, y);
      }
      g.lineTo(768, 512); g.closePath(); g.fillStyle = ridge.color; g.fill();
    }
    g.fillStyle = '#597789'; g.fillRect(0, 392, 768, 120);
    for (let i = 0; i < 46; i++) {
      const y = 399 + i * 2.6, w = 25 + i * 4.2;
      g.fillStyle = `rgba(222, 208, 179, ${.05 + (i % 4) * .012})`;
      g.fillRect(529 - w / 2 + Math.sin(i * 1.3) * 18, y, w, .8 + i * .015);
    }
    g.fillStyle = '#1c3040';
    g.beginPath(); g.moveTo(0, 476); g.lineTo(54, 458); g.lineTo(96, 471);
    g.lineTo(155, 446); g.lineTo(197, 479); g.lineTo(240, 491); g.lineTo(768, 503);
    g.lineTo(768, 512); g.lineTo(0, 512); g.fill();
    const vignette = g.createRadialGradient(384, 256, 150, 384, 256, 440);
    vignette.addColorStop(0, '#050d1a00'); vignette.addColorStop(1, '#050d1a8a');
    g.fillStyle = vignette; g.fillRect(0, 0, 768, 512);
  }
  artworkCache.set(key, texture);
  return texture;
}

function drawReel(g, symbols) {
  const height = 630, width = 210;
  g.clearRect(0, 0, width, height);
  const paper = g.createLinearGradient(0, 0, width, 0);
  paper.addColorStop(0, '#d7d5d1'); paper.addColorStop(.16, '#fffdf5');
  paper.addColorStop(.65, '#fffef8'); paper.addColorStop(1, '#cacbc6');
  g.fillStyle = paper; g.fillRect(0, 0, width, height);
  symbols.forEach((symbol, row) => {
    const y = row * 210;
    g.fillStyle = '#b7b7b333'; g.fillRect(0, y, width, 2);
    if (symbol === 'seven') {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'italic 900 166px Georgia, serif';
      g.lineWidth = 11; g.strokeStyle = '#fff5c3'; g.strokeText('7', 99, y + 111);
      g.lineWidth = 3; g.strokeStyle = '#7d1c28'; g.strokeText('7', 99, y + 111);
      g.fillStyle = '#b72c3f'; g.fillText('7', 99, y + 111);
    } else {
      const color = `#${SYMBOL_COLORS[symbol].toString(16).padStart(6, '0')}`;
      g.fillStyle = '#18252b27'; roundRect(g, 24, y + 44, 165, 129, 21);
      const ink = g.createLinearGradient(0, y + 35, 0, y + 168);
      ink.addColorStop(0, color); ink.addColorStop(1, color);
      g.fillStyle = ink; roundRect(g, 21, y + 36, 165, 129, 19);
      g.fillStyle = '#ffffff20'; roundRect(g, 29, y + 43, 149, 16, 7);
      g.strokeStyle = '#122c3d24'; g.lineWidth = 2;
      g.beginPath(); g.roundRect(21, y + 36, 165, 129, 19); g.stroke();
    }
  });
  const shade = g.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, '#19273226'); shade.addColorStop(.25, '#19273200');
  shade.addColorStop(.75, '#19273200'); shade.addColorStop(1, '#19273226');
  g.fillStyle = shade; g.fillRect(0, 0, width, height);
}

function dataTexture() {
  const { context: g, texture } = canvasTexture(768, 128);
  g.fillStyle = '#101b1b'; g.fillRect(0, 0, 768, 128);
  g.fillStyle = '#a6bcaf'; g.font = '12px monospace';
  g.fillText('TOTAL', 32, 28); g.fillText('CURRENT', 286, 28); g.fillText('BONUS', 572, 28);
  g.font = '54px monospace'; g.fillStyle = '#9bbca6';
  g.fillText('000', 30, 94); g.fillText('128', 283, 94); g.fillText('00', 570, 94);
  g.fillStyle = '#33463c'; g.fillRect(241, 20, 2, 86); g.fillRect(526, 20, 2, 86);
  return texture;
}

function lowerPanelArtwork() {
  const key = 'lower-panel';
  if (artworkCache.has(key)) return artworkCache.get(key);
  const { context: g, texture } = canvasTexture(640, 352);
  const shade = g.createLinearGradient(0, 0, 640, 352);
  shade.addColorStop(0, '#14242d'); shade.addColorStop(.5, '#20333a'); shade.addColorStop(1, '#101b24');
  g.fillStyle = shade; g.fillRect(0, 0, 640, 352);
  g.strokeStyle = '#617b7a55'; g.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    for (let x = -20; x <= 660; x += 12) {
      const y = 175 + i * 8 + Math.sin(x * .008 + i * .19) * (35 + i * 2);
      if (x === -20) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.strokeStyle = '#bcaa7555'; g.lineWidth = 1.2;
  g.strokeRect(16, 16, 608, 320);
  g.beginPath(); g.arc(320, 138, 56, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(320, 91); g.lineTo(344, 138); g.lineTo(320, 185);
  g.lineTo(296, 138); g.closePath(); g.stroke();
  artworkCache.set(key, texture);
  return texture;
}

export function createCabinet({ seed = 0, detail = true } = {}) {
  const root = new THREE.Group(); root.name = 'OriginalSmartSlot';
  const build = staticGeometryBuilder(root);
  const red = new THREE.MeshPhysicalMaterial({ color: 0x69242d, roughness: .29,
    metalness: .16, clearcoat: .42, clearcoatRoughness: .22 });
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x171e25, roughness: .29,
    metalness: .32, clearcoat: .34, clearcoatRoughness: .18 });
  const dark = paint(0x10171b, .66, .13);
  const brushed = paint(0x75848c, .36, .85);
  const chrome = paint(0xc6d0d2, .21, .94);
  const rubber = paint(0x131919, .9, 0);
  const accent = new THREE.MeshStandardMaterial({ color: 0x37626b, emissive: 0x17333b,
    emissiveIntensity: .23, roughness: .32, metalness: .2 });

  // Deep formed shell and inset service door, rather than one flat facade.
  build.box(.746, 1.78, .53, [0, .91, -.266], red, .044);
  build.box(.690, 1.706, .047, [0, .913, -.007], lacquer, .025);
  build.box(.712, .134, .54, [0, .067, -.25], rubber, .015);
  build.box(.643, .582, .056, [0, .385, .020], lacquer, .026);
  build.box(.582, .41, .012, [0, .393, .052], dark, .012);
  const lowerArt = new THREE.Mesh(new THREE.PlaneGeometry(.506, .299),
    new THREE.MeshBasicMaterial({ map: lowerPanelArtwork(), toneMapped: false }));
  lowerArt.position.set(0, .393, .059); root.add(lowerArt);
  build.box(.575, .010, .014, [0, .621, .057], chrome, .004);
  build.box(.575, .010, .014, [0, .158, .057], brushed, .004);
  // Recessed lower service panel and a small key barrel, no coin hopper/boxes.
  build.box(.033, .055, .014, [.254, .54, .059], brushed, .007);
  build.add(new THREE.CylinderGeometry(.007, .007, .003, 12), dark, [.254, .54, .068], [Math.PI / 2, 0, 0]);
  build.box(.63, .045, .075, [0, .121, -.012], dark, .012);
  // Shaped cheeks wrap the two display areas. Their changing width and
  // projecting lip give the front a manufactured shell silhouette.
  for (const side of [-1, 1]) {
    const points = [[.372, .764], [.372, 1.716], [.346, 1.752], [.305, 1.695],
      [.319, 1.291], [.309, 1.235], [.321, .891], [.294, .822], [.336, .748]];
    const shape = new THREE.Shape();
    shape.moveTo(side * points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => shape.lineTo(side * x, y));
    shape.closePath();
    build.add(new THREE.ExtrudeGeometry(shape, { depth: .044, bevelEnabled: true,
      bevelSize: .006, bevelThickness: .006, bevelSegments: 3, steps: 1 }), red, [0, 0, .031]);
    // Flush dark side inlay and rear ventilation, visible in a three-quarter shot.
    build.box(.006, 1.421, .330, [side * .373, .925, -.285], lacquer, .002);
    if (detail) {
      for (let row = 0; row < 16; row++) {
        build.box(.007, .005, .102, [side * .377, .39 + row * .018, -.329], dark, .002);
      }
    }
  }

  // The LCD is recessed 4 cm behind the front lip. A separate outer metal rim,
  // deep black aperture, display surface and glass all have physical depth.
  build.box(.629, .489, .044, [0, 1.470, .010], dark, .017);
  build.add(bezelGeometry(.652, .510, .628, .486, .014, .002, .022, .014),
    chrome, [0, 1.470, .068]);
  build.add(bezelGeometry(.632, .490, .576, .428, .029, .005, .018, .007),
    lacquer, [0, 1.470, .048]);
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenArtwork(false), toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.574, .426), screenMaterial);
  screen.position.set(0, 1.47, .042); root.add(screen);
  const screenGlint = new THREE.Mesh(new THREE.PlaneGeometry(.574, .426),
    new THREE.MeshPhysicalMaterial({ color: 0xc7d8df, transparent: true, opacity: .055,
      roughness: .13, metalness: .03, clearcoat: .8, clearcoatRoughness: .10, depthWrite: false }));
  screenGlint.position.set(0, 1.47, .072); root.add(screenGlint);
  build.box(.668, .031, .082, [0, 1.751, -.011], red, .009);
  build.box(.670, .012, .024, [0, 1.724, .032], chrome, .004);

  // A deep open reel well has a real upper hood and dividers. Printed surfaces
  // roll back at the ends, receive cabinet shadows and sit behind the glass.
  build.box(.625, .432, .032, [0, 1.060, .027], dark, .014);
  build.add(bezelGeometry(.653, .454, .625, .426, .013, .002, .018, .011),
    chrome, [0, 1.060, .103]);
  build.add(bezelGeometry(.627, .432, .554, .405, .046, .003, .014, .006),
    lacquer, [0, 1.060, .055]);
  const reels = [], reelCanvases = [];
  for (let column = 0; column < 3; column++) {
    const map = canvasTexture(210, 630);
    const material = new THREE.MeshStandardMaterial({ map: map.texture, color: 0xaaaaaa,
      roughness: .48, metalness: .015, envMapIntensity: .28,
      emissive: 0xffffff, emissiveMap: map.texture, emissiveIntensity: .045 });
    // The paper sits just behind the cover, not centimetres behind the
    // dividers. Its crown projects beyond those thin separators so that a
    // grazing three-quarter view still reveals all three printed cells.
    const reel = new THREE.Mesh(curvedReelGeometry(.168, .389, .022, detail ? 28 : 12), material);
    reel.position.set((column - 1) * .181, 1.060, .088);
    reel.name = `Reel_${column}`; root.add(reel); reels.push(reel); reelCanvases.push(map);
  }
  for (const x of [-.271, -.0905, .0905, .271]) {
    build.box(.009, .401, .012, [x, 1.060, .094], chrome, .003);
    build.box(.003, .395, .012, [x + .003, 1.060, .090], dark, .001);
  }
  build.box(.554, .015, .060, [0, 1.266, .077], dark, .003);
  build.box(.554, .009, .026, [0, .853, .104], chrome, .003);
  const reelGlass = new THREE.Mesh(new THREE.PlaneGeometry(.554, .405),
    new THREE.MeshPhysicalMaterial({ color: 0xd9edf4, transparent: true, opacity: .043,
      roughness: .10, metalness: .02, clearcoat: .72, clearcoatRoughness: .10, depthWrite: false }));
  reelGlass.position.set(0, 1.06, .124); root.add(reelGlass);

  // A substantial, padded control deck projects naturally towards the hands.
  build.box(.711, .139, .268, [0, .785, .026], red, .027);
  build.box(.683, .107, .277, [0, .785, .032], chrome, .023);
  build.box(.664, .086, .281, [0, .782, .035], lacquer, .019);
  build.box(.605, .012, .188, [0, .838, .012], dark, .005);
  build.box(.611, .006, .019, [0, .730, .175], brushed, .002);
  build.box(.625, .004, .013, [0, .847, .114], chrome, .0015);
  const buttons = [];
  const buttonMaterial = new THREE.MeshPhysicalMaterial({ color: 0xa43a40, emissive: 0x5b1117,
    emissiveIntensity: .08, roughness: .27, metalness: .05, clearcoat: .6, clearcoatRoughness: .18 });
  const buttonCentreZ = STOP_BUTTONS.frontZ - STOP_BUTTONS.depth / 2;
  for (const x of STOP_BUTTONS.x) {
    build.add(new THREE.CylinderGeometry(STOP_BUTTONS.radius + .007, STOP_BUTTONS.radius + .010, .012, 28),
      brushed, [x, STOP_BUTTONS.centreY, buttonCentreZ - .011], [Math.PI / 2, 0, 0]);
    build.add(new THREE.TorusGeometry(STOP_BUTTONS.radius + .003, .0016, 6, 28),
      rubber, [x, STOP_BUTTONS.centreY, buttonCentreZ - .003]);
    const button = new THREE.Mesh(stopButtonGeometry(), buttonMaterial);
    button.rotation.x = Math.PI / 2; button.position.set(x, STOP_BUTTONS.centreY, buttonCentreZ);
    button.name = `StopButton_${buttons.length}`;
    button.userData.contactPointLocal = [0, STOP_BUTTONS.depth / 2, 0];
    button.userData.contactNormalLocal = [0, 1, 0];
    root.add(button); buttons.push(button);
  }
  // Lever shaft and soft rounded grip remain one articulated group.
  const leverGripOffset = .051;
  const lever = new THREE.Group(); lever.name = 'StartLever';
  lever.position.set(LEVER_GRIP_CENTRE[0], LEVER_GRIP_CENTRE[1], LEVER_GRIP_CENTRE[2] - leverGripOffset);
  const leverShaft = new THREE.Mesh(new THREE.CylinderGeometry(.009, .010, .053, 14), chrome);
  leverShaft.rotation.x = Math.PI / 2; leverShaft.position.z = .022; lever.add(leverShaft);
  const grip = new THREE.Mesh(new THREE.SphereGeometry(.027, 20, 14), lacquer);
  grip.scale.set(1, .92, .86); grip.position.z = leverGripOffset; lever.add(grip); root.add(lever);
  build.add(new THREE.CylinderGeometry(.029, .029, .006, 20), brushed,
    [LEVER_GRIP_CENTRE[0], LEVER_GRIP_CENTRE[1], lever.position.z - .001], [Math.PI / 2, 0, 0]);

  // The separate island/card equipment is supplied by the room component.
  // This cabinet itself has no coin slot, hopper, tray or dollar boxes.
  // Ribbed lower speaker panels and small chrome screws create scale.
  for (const side of [-1, 1]) {
    build.box(.039, .399, .028, [side * .315, .406, .034], rubber, .009);
    for (let row = 0; row < (detail ? 20 : 8); row++) {
      const step = detail ? .016 : .04;
      build.box(.024, .0035, .009, [side * .315, .25 + row * step, .053], brushed, .001);
    }
    build.box(.015, 1.569, .035, [side * .350, .952, -.005], chrome, .006);
    build.box(.007, 1.533, .012, [side * .340, .963, .017], accent, .003);
    if (detail) {
      for (const y of [.182, .688, 1.313, 1.705]) {
        build.add(new THREE.CylinderGeometry(.0035, .0035, .003, 8), chrome,
          [side * .318, y, .064], [Math.PI / 2, 0, 0]);
      }
    }
  }

  // Distinct data-display unit, separate from the bonus notice light.
  build.box(.624, .115, .140, [0, 1.849, -.062], dark, .017);
  build.box(.574, .078, .012, [0, 1.852, .015], brushed, .005);
  const data = new THREE.Mesh(new THREE.PlaneGeometry(.555, .064),
    new THREE.MeshBasicMaterial({ map: dataTexture(), toneMapped: false }));
  data.position.set(0, 1.852, .023); root.add(data);
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0x151b1c, emissive: 0x000000,
    emissiveIntensity: 0, roughness: .25, metalness: .1 });
  const noticeLamp = new THREE.Mesh(roundedBoxGeometry(.091, .017, .009, .004), lampMaterial);
  noticeLamp.position.set(0, 1.763, .043); root.add(noticeLamp);

  build.finish();
  let signature = '';
  function setState(state) {
    const view = getSlotPresentation(state);
    const next = `${state.type}|${state.phase}|${view.reels.flat().join(',')}`;
    if (signature === next) return;
    signature = next;
    view.reels.forEach((symbols, index) => {
      drawReel(reelCanvases[index].context, symbols);
      reelCanvases[index].texture.needsUpdate = true;
    });
    screenMaterial.map = screenArtwork(view.winningScreen, view.bonusPaid);
    screenMaterial.needsUpdate = true;
    lampMaterial.color.setHex(view.noticeLampOn ? 0xf5d88c : 0x151b1c);
    lampMaterial.emissive.setHex(view.noticeLampOn ? 0xe2a955 : 0x000000);
    lampMaterial.emissiveIntensity = view.noticeLampOn ? .7 : 0;
    root.userData.phase = state.phase;
    root.userData.reels = view.reels;
    root.userData.noticeLampOn = view.noticeLampOn;
  }
  setState(createSlotState(SLOT_TYPES.TROPICAL, seed));
  root.traverse(object => {
    if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
  });
  // Screen and transmissive glass should not cast opaque rectangles into the shot.
  screen.castShadow = false; screenGlint.castShadow = false; lowerArt.castShadow = false;
  reelGlass.castShadow = false; data.castShadow = false;
  // These open, thin printed sheets do not need to shadow themselves or any
  // object behind the cabinet. Keep receiving the real bezel/hood shadows.
  reels.forEach(reel => { reel.castShadow = false; reel.receiveShadow = true; });
  return {
    root, setState, buttons, lever, reels, screen, noticeLamp,
    anchors: Object.freeze({
      controls: new THREE.Vector3(0, STOP_BUTTONS.centreY, buttonCentreZ),
      reels: new THREE.Vector3(0, 1.06, .105),
      screen: new THREE.Vector3(0, 1.47, .072),
      top: new THREE.Vector3(0, 1.907, -.062),
      base: new THREE.Vector3(0, 0, -.10)
    })
  };
}
