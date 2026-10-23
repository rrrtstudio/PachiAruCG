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
  function studyPose() {
    for (const [bone, quaternion] of rest) bone.quaternion.copy(quaternion);
    root.updateMatrixWorld(true);
    const parent = bones.Head.parent.getWorldQuaternion(new THREE.Quaternion());
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(parent.invert());
    bones.Head.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, .40));
    root.updateMatrixWorld(true);
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
  return { root, bones, meshes, rest, studyPose, setHeadVisible, setView,
    stats: Object.freeze({ source: 'Blender / skinned GLB', bones: Object.keys(bones).length,
      skinnedMeshes, triangles, animationClips: gltf.animations.length }) };
}
