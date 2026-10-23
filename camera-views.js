// Calibrated for the seated, metre-scale study: cabinet front z=0, player z=.72.
// Shot labels stay in the controls, outside the rendered 9:16 frame.
export const CAMERA_VIEWS = Object.freeze({
  player: Object.freeze({
    label: 'A：打ち手操作視点',
    // A lifted operating insert, rather than a wide-angle camera inside the head.
    // The static operating insert excludes the player and chair so the complete
    // reel window and control deck remain readable without detached shoulders.
    position: Object.freeze([-0.32, 1.98, 2.55]),
    target: Object.freeze([0, 1.00, 0]),
    fov: 44,
  }),
  behind: Object.freeze({
    label: 'B：背後からの肩越し',
    // Lateral parallax keeps the protagonist's head clear of the three reels.
    position: Object.freeze([-2.35, 1.78, 3.10]),
    target: Object.freeze([0.05, 0.98, 0.31]),
    fov: 38,
  }),
  side: Object.freeze({
    label: 'C：斜め前からの3/4',
    // Ahead of the player, on the cabinet's open side. The study pose includes
    // a gentle head turn toward this side, shared by all three camera views.
    position: Object.freeze([-2.60, 1.55, 0.70]),
    target: Object.freeze([0, 0.94, 0.42]),
    fov: 49,
  }),
});

export const DEFAULT_CAMERA_VIEW = 'side';

export function applyCameraView(camera, viewId) {
  if (!Object.hasOwn(CAMERA_VIEWS, viewId)) {
    throw new RangeError(`Unknown camera view: ${viewId}`);
  }
  const view = CAMERA_VIEWS[viewId];
  camera.position.set(...view.position);
  camera.lookAt(...view.target);
  camera.fov = view.fov;
  // Preserve the aspect supplied by the portrait stage's resize observer.
  camera.updateProjectionMatrix();
  return view;
}
