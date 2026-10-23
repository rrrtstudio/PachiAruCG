import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
  const handWorld = new THREE.Quaternion();
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
    hand.getWorldQuaternion(handWorld);
    const upperLength = shoulder.distanceTo(elbow), lowerLength = elbow.distanceTo(wrist);
    direction.subVectors(target, shoulder);
    const distance = THREE.MathUtils.clamp(direction.length(), Math.abs(upperLength - lowerLength) + .0001,
      upperLength + lowerLength - .0001);
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
    hand.quaternion.copy(parentWorld.invert()).multiply(handWorld);
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
    applyPose({ spinePitch: 0, chestRoll: 0, headYaw: .55, headPitch: 0,
      rightX: .16, rightY: .81, rightZ: .31, leftX: -.26, leftY: .81, leftZ: .34,
      smile: 0, open: 0, frown: 0, blink: 0 });
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
  return { root, bones, meshes, rest, studyPose, applyPose, setHeadVisible, setView,
    stats: Object.freeze({ source: 'Blender / skinned GLB', bones: Object.keys(bones).length,
      skinnedMeshes, triangles, animationClips: gltf.animations.length }) };
}
