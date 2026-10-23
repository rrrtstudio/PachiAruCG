// Shot labels stay in the controls, outside the rendered portrait frame.
export const CAMERA_VIEWS = Object.freeze({
  player: Object.freeze({
    label: '打ち手視点',
    // Just ahead of the seated player's eyes, clear of the head and glasses.
    position: Object.freeze([0.43, 2.415, 0.67]),
    target: Object.freeze([0.43, 1.75, -0.54]),
    fov: 82,
  }),
  behind: Object.freeze({
    label: '背後視点',
    position: Object.freeze([2.9, 3.1, 6.3]),
    target: Object.freeze([0.43, 1.55, 0.05]),
    fov: 38,
  }),
  side: Object.freeze({
    label: '横からの視点',
    position: Object.freeze([-7.5, 3.1, 0.1]),
    target: Object.freeze([0.43, 1.55, 0.75]),
    fov: 38,
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
