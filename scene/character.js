import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HAND_CONTACT_OFFSETS, LEVER_GRIP_CENTRE, buttonContact } from './operation-layout.js';
import { sampleMotion } from './motion.js';

export async function loadCharacter() {
  const gltf = await new GLTFLoader().loadAsync(new URL('../assets/character.glb', import.meta.url).href);
  const root = gltf.scene; root.name = 'SculptedAdult';
  const bones = {}, rest = new Map(), meshes = [];
  let triangles = 0, skinnedMeshes = 0;
  root.traverse(object => {
    if (object.isBone) { bones[object.name] = object; rest.set(object, object.quaternion.clone()); }
    if (object.isMesh) {
      meshes.push(object); object.castShadow = true; object.receiveShadow = true;
      triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
      if (object.isSkinnedMesh) skinnedMeshes++;
      object.frustumCulled = false;
      if (object.name === 'Glasses') object.visible = false;
    }
  });
  root.updateMatrixWorld(true);
  const neutralHands = {}, contactLocals = {}, armReach = {};
  for (const side of ['R', 'L']) {
    const hand = bones[`Hand_${side}`];
    neutralHands[side] = hand.getWorldQuaternion(new THREE.Quaternion());
    contactLocals[side] = {};
    armReach[side] = {};
    const skin = meshes.find(mesh => mesh.name === `SkinArm_${side}`);
    for (const [kind, expected] of Object.entries(HAND_CONTACT_OFFSETS[side])) {
      const key = kind === 'button' ? 'buttonContactOffset' : 'leverGripOffset';
      const offset = skin?.userData[key];
      if (!Array.isArray(offset) || offset.length !== 3 ||
          offset.some((value, index) => !Number.isFinite(value) || Math.abs(value - expected[index]) > .000001)) {
        throw new Error(`The character is missing its calibrated ${side} ${kind} landmark`);
      }
      const point = hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...offset));
      contactLocals[side][kind] = hand.worldToLocal(point);
    }
  }
  const headMeshes = meshes.filter(mesh => /^(HeadSurface|Eye_|Mouth|Glasses|NeckSurface)/.test(mesh.name));
  const parentRotation = new THREE.Quaternion(), deltaRotation = new THREE.Quaternion();
  const axisX = new THREE.Vector3(1, 0, 0), axisY = new THREE.Vector3(0, 1, 0), axisZ = new THREE.Vector3(0, 0, 1);
  const axis = new THREE.Vector3();
  function resetRig() {
    for (const [bone, quaternion] of rest) bone.quaternion.copy(quaternion);
    for (const mesh of meshes) if (mesh.morphTargetInfluences) mesh.morphTargetInfluences.fill(0);
    root.updateMatrixWorld(true);
  }
  function rotateWorld(bone, worldAxis, angle) {
    bone.parent.getWorldQuaternion(parentRotation);
    axis.copy(worldAxis).applyQuaternion(parentRotation.invert());
    deltaRotation.setFromAxisAngle(axis, angle);
    bone.quaternion.premultiply(deltaRotation);
    bone.updateWorldMatrix(false, true);
  }
  const shoulder = new THREE.Vector3(), elbow = new THREE.Vector3(), wrist = new THREE.Vector3();
  const direction = new THREE.Vector3(), pole = new THREE.Vector3(), solvedElbow = new THREE.Vector3();
  const currentDirection = new THREE.Vector3(), desiredDirection = new THREE.Vector3();
  const worldDelta = new THREE.Quaternion(), parentWorld = new THREE.Quaternion();
  function turnTowards(bone, from, to) {
    worldDelta.setFromUnitVectors(from.normalize(), to.normalize());
    bone.parent.getWorldQuaternion(parentWorld);
    // Convert a world-space rotation into the bone's parent coordinate system.
    deltaRotation.copy(parentWorld).invert().multiply(worldDelta).multiply(parentWorld);
    bone.quaternion.premultiply(deltaRotation);
    bone.updateWorldMatrix(false, true);
  }
  function solveArm(side, target) {
    const upper = bones[`UpperArm_${side}`], forearm = bones[`Forearm_${side}`], hand = bones[`Hand_${side}`];
    upper.getWorldPosition(shoulder); forearm.getWorldPosition(elbow); hand.getWorldPosition(wrist);
    const upperLength = shoulder.distanceTo(elbow), lowerLength = elbow.distanceTo(wrist);
    direction.subVectors(target, shoulder);
    const requestedDistance = direction.length();
    const distance = THREE.MathUtils.clamp(requestedDistance, Math.abs(upperLength - lowerLength) + .0001,
      upperLength + lowerLength - .0001);
    Object.assign(armReach[side], { requestedDistance, solvedDistance: distance,
      maxReach: upperLength + lowerLength, clamped: Math.abs(distance - requestedDistance) > .000001 });
    direction.normalize();
    const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
    const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
    pole.subVectors(elbow, shoulder).addScaledVector(direction, -pole.dot(direction));
    if (pole.lengthSq() < .000001) pole.set(side === 'L' ? -1 : 1, -.3, 0);
    pole.normalize();
    solvedElbow.copy(shoulder).addScaledVector(direction, along).addScaledVector(pole, height);
    currentDirection.subVectors(elbow, shoulder); desiredDirection.subVectors(solvedElbow, shoulder);
    turnTowards(upper, currentDirection, desiredDirection);
    forearm.getWorldPosition(elbow); hand.getWorldPosition(wrist);
    currentDirection.subVectors(wrist, elbow); desiredDirection.copy(direction).multiplyScalar(distance).add(shoulder).sub(elbow);
    turnTowards(forearm, currentDirection, desiredDirection);
    hand.parent.getWorldQuaternion(parentWorld);
    // Keep the calibrated palm orientation in world space while the torso leans.
    // Otherwise a small spine turn also rotates the finger pad away from its
    // control, even when the wrist reaches the requested position exactly.
    hand.quaternion.copy(parentWorld.invert()).multiply(neutralHands[side]);
    hand.updateWorldMatrix(false, true);
  }
  function morph(name, value) {
    for (const mesh of meshes) {
      const index = mesh.morphTargetDictionary?.[name];
      if (index !== undefined) mesh.morphTargetInfluences[index] = THREE.MathUtils.clamp(value, 0, 1);
    }
  }
  const rightTarget = new THREE.Vector3(), leftTarget = new THREE.Vector3();
  function applyPose(pose) {
    resetRig();
    rotateWorld(bones.Spine, axisX, pose.spinePitch);
    rotateWorld(bones.Chest, axisZ, pose.chestRoll);
    rotateWorld(bones.Head, axisY, pose.headYaw);
    rotateWorld(bones.Head, axisX, pose.headPitch);
    rightTarget.set(pose.rightX, pose.rightY, pose.rightZ);
    leftTarget.set(pose.leftX, pose.leftY, pose.leftZ);
    solveArm('R', rightTarget); solveArm('L', leftTarget);
    morph('Smile', pose.smile); morph('Open', pose.open); morph('Frown', pose.frown); morph('Blink', pose.blink);
    root.updateMatrixWorld(true);
  }
  function studyPose() {
    applyPose(sampleMotion('idle', 0));
  }
  function getContactDiagnostics() {
    root.updateMatrixWorld(true);
    const point = (side, kind) => bones[`Hand_${side}`].localToWorld(contactLocals[side][kind].clone());
    const rightButtonPad = point('R', 'button'), leftButtonPad = point('L', 'button');
    const leftLeverGrip = point('L', 'lever');
    const arms = {};
    for (const side of ['R', 'L']) {
      const upper = bones[`UpperArm_${side}`].getWorldPosition(new THREE.Vector3());
      const elbowPoint = bones[`Forearm_${side}`].getWorldPosition(new THREE.Vector3());
      const wristPoint = bones[`Hand_${side}`].getWorldPosition(new THREE.Vector3());
      const target = side === 'R' ? rightTarget : leftTarget;
      const upperDirection = elbowPoint.clone().sub(upper);
      const lowerDirection = wristPoint.clone().sub(elbowPoint);
      arms[side] = { ...armReach[side], requestedWrist: target.toArray(), wrist: wristPoint.toArray(),
        elbow: elbowPoint.toArray(), wristError: wristPoint.distanceTo(target),
        elbowBendDegrees: THREE.MathUtils.radToDeg(upperDirection.angleTo(lowerDirection)) };
    }
    return { space: 'metres/world', rightButtonPad: rightButtonPad.toArray(),
      leftButtonPad: leftButtonPad.toArray(), leftLeverGrip: leftLeverGrip.toArray(),
      // These are surface distances, not a claim that every expressive pose
      // should touch a control. They are zero in the static operating study.
      studySurfaceGaps: { rightStop: rightButtonPad.distanceTo(new THREE.Vector3(...buttonContact(2))),
        leftLever: leftLeverGrip.distanceTo(new THREE.Vector3(...LEVER_GRIP_CENTRE)) }, arms };
  }
  function setHeadVisible(visible, glasses = false) {
    for (const mesh of headMeshes) mesh.visible = visible && (mesh.name !== 'Glasses' || glasses);
  }
  function setView(viewId, glasses = false) {
    // The operation insert is an unobstructed cabinet shot. Do not present a
    // headless torso or disconnected sleeve ends as a first-person body.
    for (const mesh of meshes) {
      mesh.visible = viewId === 'player' ? false :
        mesh.name !== 'Glasses' || glasses;
    }
    setHeadVisible(viewId !== 'player', glasses);
  }
  return { root, bones, meshes, rest, studyPose, applyPose, getContactDiagnostics, setHeadVisible, setView,
    stats: Object.freeze({ source: 'Blender / skinned GLB', bones: Object.keys(bones).length,
      skinnedMeshes, triangles, animationClips: gltf.animations.length }) };
}
