const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/deploy-pages.yml'), 'utf8');

// Execute the exact inline policy used by github-script, without network writes.
function inlineScript(stepId) {
  const lines = workflow.split('\n');
  const start = lines.findIndex(line => line.trim() === `id: ${stepId}`);
  assert.ok(start >= 0);
  const script = lines.findIndex((line, i) => i > start && line === '          script: |');
  assert.ok(script >= 0);
  const source = [];
  for (let i = script + 1; i < lines.length && lines[i].startsWith('            '); i++) {
    source.push(lines[i].slice(12));
  }
  return new (Object.getPrototypeOf(async function () {}).constructor)(
    'github', 'context', 'core', 'process', source.join('\n'));
}

async function runPolicy(id, { requested, current, built = requested }) {
  const outputs = {}, summaries = [], reads = [];
  await inlineScript(id)(
    { rest: { repos: { getBranch: async options => {
      reads.push(options); return { data: { commit: { sha: current } } };
    } } } },
    { repo: { owner: 'rrrtstudio', repo: 'PachiAruCG' } },
    { setOutput: (key, value) => { outputs[key] = value; },
      summary: { addRaw: value => { summaries.push(value); return { write: async () => {} }; } } },
    { env: { REQUESTED_SHA: requested, BUILT_SHA: built } },
  );
  return { outputs, summaries, reads };
}

const current = 'a'.repeat(40), old = 'b'.repeat(40);

test('Pages resolves an immutable SHA only when it is the current main tip', async () => {
  const result = await runPolicy('resolve', { requested: current, current });
  assert.equal(result.outputs.current, 'true');
  assert.equal(result.outputs.sha, current);
  assert.equal(result.reads[0].branch, 'main');
  assert.deepEqual(result.summaries, []);
});

test('a queued old Pages run cannot roll the website back', async () => {
  const result = await runPolicy('resolve', { requested: old, current });
  assert.equal(result.outputs.current, 'false');
  assert.ok(result.summaries[0].includes('skipped'));
});

test('Pages rejects branch expressions and malformed revisions', async () => {
  for (const requested of ['main', 'refs/pull/2/head', '$(secret)', '', current.slice(1)]) {
    await assert.rejects(runPolicy('resolve', { requested, current }), /full commit SHA/);
  }
});

test('Pages skips upload when main advances while tests are running', async () => {
  const stale = await runPolicy('fresh', { built: old, current });
  const fresh = await runPolicy('fresh', { built: current, current });
  assert.equal(stale.outputs.ready, 'false');
  assert.equal(fresh.outputs.ready, 'true');
});

test('Pages separates unprivileged tests and builds from deployment permissions', () => {
  const build = workflow.slice(workflow.indexOf('  build:'), workflow.indexOf('  deploy:'));
  const deploy = workflow.slice(workflow.indexOf('  deploy:'));
  assert.match(workflow, /^permissions: \{\}$/m);
  assert.match(build, /permissions:\n      contents: read/);
  assert.doesNotMatch(build, /pages: write|id-token: write|contents: write/);
  assert.match(deploy, /permissions:\n      pages: write\n      id-token: write/);
  assert.doesNotMatch(deploy, /npm |checkout@|contents: write/);
  assert.match(build, /persist-credentials: false/);
  assert.match(build, /github\.ref == 'refs\/heads\/main'/);
  assert.match(build, /cp -- index\.html style\.css app\.js camera-views\.js slot-state\.js slot-timeline\.js _site\//);
  assert.doesNotMatch(build, /cp .*\*|path: \./);
});

test('Pages supports explicit calls after token merges and is serialized', () => {
  assert.match(workflow, /workflow_call:\n    inputs:\n      sha:/);
  assert.match(workflow, /push:\n    branches: \[main\]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /concurrency:\n  group: pages\n  cancel-in-progress: false/);
  assert.match(workflow, /if: needs\.build\.outputs\.ready == 'true'/);
  assert.match(workflow, /name: github-pages/);
});
