import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function roundedBoxGeometry(width, height, depth, radius = .02, segments = 3) {
  return new RoundedBoxGeometry(width, height, depth, segments,
    Math.min(radius, width / 2 - .0001, height / 2 - .0001, depth / 2 - .0001));
}

// Collect decorative geometry by material. A detailed cabinet still needs only
// one draw call per finish; the buttons/reels remain individually animatable.
export function staticGeometryBuilder(root) {
  const parts = new Map();
  const transform = new THREE.Object3D();
  return {
    add(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
      transform.position.set(...position);
      transform.rotation.set(...rotation);
      transform.scale.set(1, 1, 1);
      transform.updateMatrix();
      const transformed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      transformed.applyMatrix4(transform.matrix);
      if (!parts.has(material)) parts.set(material, []);
      parts.get(material).push(transformed);
      geometry.dispose();
    },
    box(width, height, depth, position, material, radius = .012, rotation) {
      this.add(roundedBoxGeometry(width, height, depth, radius), material, position, rotation);
    },
    finish() {
      for (const [material, geometries] of parts) {
        const geometry = mergeGeometries(geometries, false);
        geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        root.add(mesh);
        geometries.forEach(item => item.dispose());
      }
      parts.clear();
    }
  };
}

// A reel really bends away from the viewer at the upper and lower edges.
// Its mapping stays continuous across all three visible symbol cells.
export function curvedReelGeometry(width = .158, height = .39, bulge = .031, segments = 22) {
  const vertices = [], normals = [], uvs = [], indices = [];
  for (let row = 0; row <= segments; row++) {
    const v = row / segments;
    const angle = (v - .5) * 1.35;
    const y = Math.sin(angle) / Math.sin(.675) * height / 2;
    const z = (Math.cos(angle) - Math.cos(.675)) / (1 - Math.cos(.675)) * bulge;
    for (let col = 0; col < 2; col++) {
      vertices.push((col - .5) * width, y, z);
      normals.push(0, Math.sin(angle), Math.cos(angle));
      uvs.push(col, v);
    }
    if (row < segments) {
      const i = row * 2;
      indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}
