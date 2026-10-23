const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../.github/workflows', name), 'utf8');

test('the required test job keeps read-only permissions and rechecks draft/base changes', () => {
  const workflow = read('test.yml');
  assert.match(workflow, /^  test:\n/m);
  assert.match(workflow, /^permissions:\n  contents: read\n/m);
  assert.match(workflow, /types: \[opened, synchronize, reopened, ready_for_review, edited\]/);
  assert.match(workflow, /run: npm run check/);
  assert.match(workflow, /run: npm test/);
  assert.doesNotMatch(workflow, /: write|pull_request_target|secrets\./);
});

test('write access is confined to a trusted workflow_run controller without PR code execution', () => {
  const workflow = read('auto-merge.yml');
  const merge = workflow.slice(workflow.indexOf('  merge:'), workflow.indexOf('  pages:'));
  assert.match(workflow, /workflow_run:\n    workflows: \[Reel and camera checks\]\n    types: \[completed\]/);
  assert.match(workflow, /^permissions: \{\}$/m);
  assert.match(merge, /head_repository\.id == github\.event\.repository\.id/);
  assert.match(merge, /startsWith\(github\.event\.workflow_run\.head_branch, 'codex\/'\)/);
  assert.match(merge, /ref: \$\{\{ github\.workflow_sha \}\}/);
  assert.match(merge, /persist-credentials: false/);
  assert.match(merge, /require\('\.\/\.github\/scripts\/auto-merge\.cjs'\)/);
  assert.match(merge, /contents: write\n      pull-requests: write\n      actions: read/);
  assert.doesNotMatch(merge, /pull_request_target:|secrets\.|download-artifact@|cache@|run:|pages: write|id-token: write/);
});

test('Pages explicitly follows a successful merge and receives the server merge SHA', () => {
  const workflow = read('auto-merge.yml');
  const pages = workflow.slice(workflow.indexOf('  pages:'));
  assert.match(pages, /needs: merge/);
  assert.match(pages, /if: needs\.merge\.outputs\.merged == 'true'/);
  assert.match(pages, /uses: \.\/\.github\/workflows\/deploy-pages\.yml/);
  assert.match(pages, /sha: \$\{\{ needs\.merge\.outputs\.sha \}\}/);
  assert.doesNotMatch(pages, /contents: write|pull-requests: write|actions: write/);
});

test('every external action in the delivery workflows is pinned to a full commit SHA', () => {
  for (const name of ['test.yml', 'auto-merge.yml', 'deploy-pages.yml']) {
    for (const match of read(name).matchAll(/uses: ([^\s]+)/g)) {
      const action = match[1];
      if (action.startsWith('./')) continue;
      assert.match(action, /^[\w-]+\/[\w-]+@[a-f0-9]{40}$/, `${name}: ${action}`);
    }
  }
});
