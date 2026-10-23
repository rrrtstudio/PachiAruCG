const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const binary = fs.readFileSync(path.join(root, 'assets/character.glb'));

function readGlb(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
  assert.equal(buffer.readUInt32LE(4), 2);
  assert.equal(buffer.readUInt32LE(8), buffer.length, 'GLB header covers the complete file');
  const chunks = [];
  for (let offset = 12; offset < buffer.length;) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    assert.equal(length % 4, 0, 'GLB chunks are four-byte aligned');
    assert.ok(offset + 8 + length <= buffer.length, 'chunk does not extend beyond the file');
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  assert.equal(chunks[0].type, 0x4e4f534a, 'first chunk is glTF JSON');
  const json = JSON.parse(chunks[0].data.toString('utf8'));
  const bin = chunks.find(chunk => chunk.type === 0x004e4942)?.data;
  assert.ok(bin, 'geometry is embedded in the GLB');
  return { json, bin };
}

const { json: gltf, bin } = readGlb(binary);
const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const numericTypes = {
  5121: { bytes: 1, read: 'readUInt8', maximum: 255 },
  5123: { bytes: 2, read: 'readUInt16LE', maximum: 65535 },
  5125: { bytes: 4, read: 'readUInt32LE', maximum: 4294967295 },
  5126: { bytes: 4, read: 'readFloatLE' },
};

function readAccessor(index) {
  const accessor = gltf.accessors[index];
  assert.ok(accessor && accessor.bufferView !== undefined, 'expected a packed mesh accessor');
  const view = gltf.bufferViews[accessor.bufferView];
  const type = numericTypes[accessor.componentType];
  const width = components[accessor.type];
  assert.ok(view && type && width, 'supported and present accessor');
  assert.equal(view.buffer, 0, 'mesh data stays in the embedded buffer');
  const first = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const stride = view.byteStride || type.bytes * width;
  const end = first + (accessor.count - 1) * stride + width * type.bytes;
  assert.ok(end <= (view.byteOffset || 0) + view.byteLength && end <= bin.length);
  return Array.from({ length: accessor.count }, (_, vertex) =>
    Array.from({ length: width }, (_, component) => {
      const value = bin[type.read](first + vertex * stride + component * type.bytes);
      return accessor.normalized && type.maximum ? value / type.maximum : value;
    }));
}

test('the saved character is a complete self-contained mobile GLB', () => {
  assert.equal(gltf.asset.version, '2.0');
  assert.ok(binary.length < 4 * 1024 * 1024, 'character remains below the four-MiB mobile budget');
  assert.equal(gltf.buffers.length, 1);
  assert.ok(bin.length >= gltf.buffers[0].byteLength);
  assert.ok(gltf.buffers.every(buffer => buffer.uri === undefined));
  assert.ok((gltf.images || []).every(image => image.uri === undefined), 'no remote face images or texture dependencies');
  assert.ok(gltf.scenes[gltf.scene].nodes.length > 0);
});

test('one stable skeleton drives the whole seated character and toggleable glasses', () => {
  assert.equal(gltf.skins.length, 1);
  const skin = gltf.skins[0];
  assert.equal(skin.joints.length, 17);
  const joints = skin.joints.map(index => gltf.nodes[index].name);
  for (const name of ['Hips', 'Spine', 'Chest', 'Neck', 'Head',
    'UpperArm_L', 'UpperArm_R', 'Forearm_L', 'Forearm_R', 'Hand_L', 'Hand_R',
    'Thigh_L', 'Thigh_R', 'Shin_L', 'Shin_R', 'Foot_L', 'Foot_R']) {
    assert.ok(joints.includes(name), `missing animation joint ${name}`);
  }
  const nodes = gltf.nodes.filter(node => node.mesh !== undefined);
  assert.ok(nodes.length >= 10);
  assert.ok(nodes.every(node => node.skin === 0), 'clothing, face and accessories share the same skeleton');
  assert.ok(nodes.some(node => node.name === 'Glasses'));
  assert.ok(!nodes.some(node => /eyebrow|nose|hair/i.test(node.name)), 'only the agreed facial features are authored');
  const matrices = readAccessor(skin.inverseBindMatrices);
  assert.equal(matrices.length, skin.joints.length);
  assert.ok(matrices.every(matrix => matrix.length === 16 && matrix.every(Number.isFinite)));
});

test('every skinned vertex has finite normalized weights and valid joint references', () => {
  let checkedVertices = 0;
  let blendedVertices = 0;
  const processed = new Set();
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      const { POSITION, JOINTS_0, WEIGHTS_0 } = primitive.attributes;
      assert.ok(POSITION !== undefined && JOINTS_0 !== undefined && WEIGHTS_0 !== undefined);
      const key = `${JOINTS_0}:${WEIGHTS_0}`;
      if (processed.has(key)) continue;
      processed.add(key);
      const joints = readAccessor(JOINTS_0), weights = readAccessor(WEIGHTS_0);
      assert.equal(joints.length, gltf.accessors[POSITION].count);
      assert.equal(weights.length, joints.length);
      weights.forEach((values, vertex) => {
        assert.ok(values.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
        assert.ok(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) < 0.0001,
          `unnormalized skin vertex ${vertex}`);
        assert.ok(joints[vertex].every(joint => Number.isInteger(joint) && joint >= 0 && joint < gltf.skins[0].joints.length));
        if (values.filter(value => value > .001).length > 1) blendedVertices++;
      });
      checkedVertices += weights.length;
    }
  }
  assert.ok(checkedVertices > 5000, 'authored deformation uses a real mesh');
  assert.ok(blendedVertices > 500, 'joints have smooth multi-bone skinning rather than rigid part replacement');
});

test('both eyes and the same mouth mesh contain real expression morph targets', () => {
  for (const [name, morphs] of [['Eye_L', ['Blink']], ['Eye_R', ['Blink']], ['Mouth', ['Smile', 'Open', 'Frown']]]) {
    const node = gltf.nodes.find(item => item.name === name);
    assert.ok(node && node.mesh !== undefined, `missing face mesh ${name}`);
    const mesh = gltf.meshes[node.mesh];
    assert.deepEqual(mesh.extras.targetNames, morphs);
    for (const primitive of mesh.primitives) {
      assert.equal(primitive.targets.length, morphs.length);
      primitive.targets.forEach(target => {
        assert.ok(target.POSITION !== undefined, `${name} morph must deform geometry`);
        assert.equal(gltf.accessors[target.POSITION].count, gltf.accessors[primitive.attributes.POSITION].count);
      });
    }
  }
});

test('seated shoes stay above the floor and the sculpt retains metre-scale proportions', () => {
  const positionAccessors = gltf.meshes.flatMap(mesh => mesh.primitives.map(primitive => gltf.accessors[primitive.attributes.POSITION]));
  const minimum = axis => Math.min(...positionAccessors.map(accessor => accessor.min[axis]));
  const maximum = axis => Math.max(...positionAccessors.map(accessor => accessor.max[axis]));
  assert.ok(minimum(1) >= -.002, 'rest geometry must not penetrate the floor');
  assert.ok(maximum(1) > 1.45 && maximum(1) < 1.65, 'head height suits the seated metre-scale scene');
  assert.ok(maximum(0) - minimum(0) < .8, 'body is consistently scaled');
  assert.ok(minimum(2) > -.05 && maximum(2) < 1.1, 'rest pose does not enter the cabinet shell');
});

test('locally shipped Three.js matches its recorded upstream version and checksums', () => {
  const vendor = path.join(root, 'vendor/three');
  const manifest = JSON.parse(fs.readFileSync(path.join(vendor, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, '0.165.0');
  for (const [file, expected] of Object.entries(manifest.sha256)) {
    assert.match(expected, /^[a-f0-9]{64}$/);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(vendor, file))).digest('hex'), expected,
      `vendored file changed: ${file}`);
  }
  assert.match(fs.readFileSync(path.join(vendor, 'LICENSE'), 'utf8'), /MIT License/);
});
