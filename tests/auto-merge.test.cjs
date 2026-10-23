const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isEligiblePullRequest, evaluateRun, runAutoMerge,
} = require('../.github/scripts/auto-merge.cjs');

const repositoryId = 1430848168;
const headSha = 'a'.repeat(40);
const headBranch = 'codex/automate-workflow';
const expected = Object.freeze({
  repositoryId, workflowId: 393946814, headSha, headBranch,
  runId: 100, runAttempt: 1,
});

function pullRequest() {
  return {
    number: 3, state: 'open', draft: false, merged: false,
    base: { ref: 'main', repo: { id: repositoryId } },
    head: { ref: headBranch, sha: headSha, repo: { id: repositoryId } },
  };
}

function workflowRun() {
  return {
    id: expected.runId, run_attempt: expected.runAttempt,
    run_number: 10,
    workflow_id: expected.workflowId, path: '.github/workflows/test.yml',
    event: 'pull_request', status: 'completed', conclusion: 'success',
    repository: { id: repositoryId }, head_repository: { id: repositoryId },
    head_sha: headSha, head_branch: headBranch,
  };
}

function jobs() {
  return [{ id: 1, name: 'test', status: 'completed', conclusion: 'success' }];
}

function assertRejectedRun(run, latest = workflowRun(), runJobs = jobs()) {
  const result = evaluateRun(run, expected, latest, runJobs);
  assert.equal(result.ok, false);
  assert.equal(typeof result.reason, 'string');
  assert.ok(result.reason.length > 0, 'a refused merge explains the blocking condition');
}

test('only an open nondraft codex PR from this repository to main is eligible', () => {
  assert.equal(isEligiblePullRequest(pullRequest(), expected), true);
});

test('malformed or incomplete PR snapshots cannot qualify', () => {
  for (const pr of [null, {}, { state: 'open' },
    { ...pullRequest(), head: null }, { ...pullRequest(), base: null }]) {
    assert.equal(isEligiblePullRequest(pr, expected), false);
  }
});

const rejectedPullRequests = [
  ['external fork even with the same owner/name text', pr => { pr.head.repo = { id: 999, full_name: 'rrrtstudio/PachiAruCG' }; }],
  ['wrong base repository', pr => { pr.base.repo.id = 999; }],
  ['draft', pr => { pr.draft = true; }],
  ['closed', pr => { pr.state = 'closed'; }],
  ['already merged', pr => { pr.merged = true; }],
  ['non-main base', pr => { pr.base.ref = 'release'; }],
  ['non-codex branch', pr => { pr.head.ref = 'feature/change'; }],
  ['codex without slash', pr => { pr.head.ref = 'codex'; }],
  ['branch prefix lookalike', pr => { pr.head.ref = 'codex-other/change'; }],
  ['embedded codex prefix', pr => { pr.head.ref = 'feature/codex/change'; }],
  ['a newer commit than the tested head', pr => { pr.head.sha = 'b'.repeat(40); }],
  ['a different branch at the same commit', pr => { pr.head.ref = 'codex/another-change'; }],
  ['deleted head repository', pr => { pr.head.repo = null; }],
];
for (const [name, modify] of rejectedPullRequests) {
  test(`PR eligibility rejects ${name}`, () => {
    const pr = pullRequest();
    modify(pr);
    assert.equal(isEligiblePullRequest(pr, expected), false);
  });
}

test('a current successful test workflow and its actual test job permit merging', () => {
  const run = workflowRun();
  const result = evaluateRun(run, expected, workflowRun(), jobs());
  assert.equal(result.ok, true);
});

const rejectedRuns = [
  ['push event', run => { run.event = 'push'; }],
  ['manual workflow event', run => { run.event = 'workflow_dispatch'; }],
  ['fork run repository', run => { run.repository.id = 999; }],
  ['fork head repository', run => { run.head_repository.id = 999; }],
  ['a workflow sharing the display name', run => { run.workflow_id = 123; }],
  ['a different workflow file', run => { run.path = '.github/workflows/pretend-tests.yml'; }],
  ['the wrong run id', run => { run.id = 101; }],
  ['the wrong attempt', run => { run.run_attempt = 2; }],
  ['a stale tested commit', run => { run.head_sha = 'b'.repeat(40); }],
  ['a different head branch', run => { run.head_branch = 'codex/another-change'; }],
  ['incomplete run', run => { run.status = 'in_progress'; }],
  ['failed workflow', run => { run.conclusion = 'failure'; }],
  ['cancelled workflow', run => { run.conclusion = 'cancelled'; }],
  ['timed out workflow', run => { run.conclusion = 'timed_out'; }],
  ['skipped workflow', run => { run.conclusion = 'skipped'; }],
  ['neutral workflow', run => { run.conclusion = 'neutral'; }],
  ['unknown workflow result', run => { run.conclusion = null; }],
];
for (const [name, modify] of rejectedRuns) {
  test(`test evidence rejects ${name}`, () => {
    const run = workflowRun();
    modify(run);
    assertRejectedRun(run);
  });
}

test('an older success cannot override a newer run or rerun on the same head', () => {
  for (const status of ['queued', 'in_progress', 'completed']) {
    const newerRun = { ...workflowRun(), id: 101, status,
      conclusion: status === 'completed' ? 'failure' : null };
    assertRejectedRun(workflowRun(), newerRun);
    const newerAttempt = { ...workflowRun(), run_attempt: 2, status,
      conclusion: status === 'completed' ? 'failure' : null };
    assertRejectedRun(workflowRun(), newerAttempt);
  }
});

test('the newest API snapshot must itself confirm completion and success', () => {
  for (const [status, conclusion] of [
    ['queued', null], ['in_progress', null], ['completed', 'failure'],
    ['completed', 'skipped'], ['completed', 'cancelled'], ['completed', null],
  ]) {
    assertRejectedRun(workflowRun(), { ...workflowRun(), status, conclusion });
  }
});

test('the workflow result cannot substitute for the required test job', () => {
  for (const runJobs of [
    [], [{ name: 'lint', status: 'completed', conclusion: 'success' }],
    [{ name: 'test', status: 'completed', conclusion: 'failure' }],
    [{ name: 'test', status: 'completed', conclusion: 'skipped' }],
    [{ name: 'test', status: 'completed', conclusion: 'neutral' }],
    [{ name: 'test', status: 'completed', conclusion: 'cancelled' }],
    [{ name: 'test', status: 'queued', conclusion: null }],
    [{ name: 'test', status: 'in_progress', conclusion: null }],
    [...jobs(), ...jobs()],
  ]) assertRejectedRun(workflowRun(), workflowRun(), runJobs);
});

test('additional jobs cannot hide a failed or skipped required test', () => {
  for (const conclusion of ['failure', 'skipped']) {
    assertRejectedRun(workflowRun(), workflowRun(), [
      { name: 'lint', status: 'completed', conclusion: 'success' },
      { name: 'test', status: 'completed', conclusion },
    ]);
  }
});

test('eligibility and evidence checks leave API snapshots unchanged', () => {
  const pr = pullRequest(), run = workflowRun(), latest = workflowRun(), runJobs = jobs();
  const before = structuredClone({ pr, run, latest, runJobs });
  isEligiblePullRequest(pr, expected);
  evaluateRun(run, expected, latest, runJobs);
  assert.deepEqual({ pr, run, latest, runJobs }, before);
});

function harness() {
  const pr = { ...pullRequest(), mergeable: true, mergeable_state: 'clean' };
  const state = {
    event: workflowRun(), run: workflowRun(), latest: workflowRun(),
    pr, current: structuredClone(pr), runJobs: jobs(), candidates: [{ number: pr.number }],
    branch: { protected: true, protection: { enabled: true,
      required_status_checks: { contexts: ['test'], checks: [{ context: 'test', app_id: 15368 }] } } },
    comments: [], outputs: {}, failures: [], warnings: [], calls: [], merges: [],
    creates: [], updates: [], summary: [],
    mergeResult: { merged: true, sha: 'c'.repeat(40) },
  };
  const summary = {};
  for (const name of ['addHeading', 'addRaw', 'addEOL']) summary[name] = value => {
    state.summary.push([name, value]);
    return summary;
  };
  summary.write = async () => { state.summaryWritten = true; };
  const core = {
    summary,
    setOutput(name, value) { state.outputs[name] = value; },
    setFailed(message) { state.failures.push(message); },
    warning(message) { state.warnings.push(message); },
  };
  let reads = 0;
  const rest = {
    actions: {
      getWorkflow: async args => {
        state.calls.push(['getWorkflow', args]);
        return { data: { id: expected.workflowId } };
      },
      getWorkflowRun: async args => {
        state.calls.push(['getWorkflowRun', args]);
        return { data: state.run };
      },
      listWorkflowRuns() {}, listJobsForWorkflowRun() {},
    },
    pulls: {
      list() {},
      get: async args => {
        state.calls.push(['getPullRequest', args]);
        return { data: reads++ === 0 ? state.pr : state.current };
      },
      merge: async args => {
        state.merges.push(args);
        if (state.mergeError) throw state.mergeError;
        return { data: state.mergeResult };
      },
    },
    repos: {
      getBranch: async args => {
        state.calls.push(['getBranch', args]);
        if (state.branchError) throw state.branchError;
        return { data: state.branch };
      },
    },
    issues: {
      listComments() {},
      createComment: async args => {
        state.creates.push(args);
        if (state.commentError) throw state.commentError;
        return { data: { id: 42 } };
      },
      updateComment: async args => {
        state.updates.push(args);
        return { data: {} };
      },
    },
  };
  const github = {
    rest,
    async paginate(method, args) {
      if (method === rest.pulls.list) {
        state.calls.push(['listPullRequests', args]);
        return state.candidates;
      }
      if (method === rest.actions.listWorkflowRuns) {
        state.calls.push(['listWorkflowRuns', args]);
        return [state.latest];
      }
      if (method === rest.actions.listJobsForWorkflowRun) {
        state.calls.push(['listJobs', args]);
        return state.runJobs;
      }
      if (method === rest.issues.listComments) return state.comments;
      throw new Error('Unexpected API method; privileged capabilities must stay explicit');
    },
  };
  const context = {
    repo: { owner: 'rrrtstudio', repo: 'PachiAruCG' }, runId: 900,
    payload: { repository: { id: repositoryId }, workflow_run: state.event },
  };
  return { state, github, context, core,
    execute: () => runAutoMerge({ github, context, core }) };
}

test('controller merges the exact tested SHA with ordinary merge API permissions', async () => {
  const fixture = harness();
  await fixture.execute();
  const { state } = fixture;
  assert.deepEqual(state.merges, [{ owner: 'rrrtstudio', repo: 'PachiAruCG',
    pull_number: 3, sha: headSha, merge_method: 'squash' }]);
  assert.deepEqual(state.outputs, { merged: 'true', sha: 'c'.repeat(40) });
  assert.equal(state.calls.filter(([name]) => name === 'getPullRequest').length, 2);
  assert.deepEqual(state.failures, []);
  assert.deepEqual(state.creates, []);
  assert.equal(state.summaryWritten, true);
});

test('controller reports failed and skipped required tests without merging', async () => {
  for (const condition of ['workflow-failed', 'job-failed', 'job-skipped']) {
    const fixture = harness();
    const { state } = fixture;
    if (condition === 'workflow-failed') {
      state.run.conclusion = state.latest.conclusion = 'failure';
    } else state.runJobs[0].conclusion = condition === 'job-failed' ? 'failure' : 'skipped';
    await fixture.execute();
    assert.deepEqual(state.merges, [], condition);
    assert.equal(state.outputs.merged, 'false');
    assert.equal(state.creates.length, 1, condition);
    assert.equal(state.creates[0].issue_number, 3);
    assert.match(state.creates[0].body, /pachiarucg-auto-merge/);
    assert.equal(state.failures.length, 1, condition);
  }
});

test('controller makes no mutations for draft, fork or non-codex PRs', async () => {
  for (const condition of ['draft', 'fork', 'branch']) {
    const fixture = harness();
    const { state } = fixture;
    if (condition === 'draft') state.pr.draft = true;
    if (condition === 'fork') state.pr.head.repo.id = 999;
    if (condition === 'branch') state.pr.head.ref = 'feature/change';
    await fixture.execute();
    assert.deepEqual(state.merges, [], condition);
    assert.deepEqual(state.creates, [], condition);
    assert.deepEqual(state.updates, [], condition);
  }
});

test('controller ignores foreign repositories, fork workflow events and unprefixed branches early', async () => {
  for (const condition of ['repository', 'fork-event', 'branch-event']) {
    const fixture = harness();
    if (condition === 'repository') fixture.context.repo.owner = 'another-owner';
    if (condition === 'fork-event') fixture.state.event.head_repository.id = 999;
    if (condition === 'branch-event') fixture.state.event.head_branch = 'feature/change';
    await fixture.execute();
    assert.deepEqual(fixture.state.calls, [], condition);
    assert.deepEqual(fixture.state.merges, [], condition);
    assert.deepEqual(fixture.state.creates, [], condition);
  }
});

test('controller ignores old success events after a new head, run or attempt', async () => {
  for (const condition of ['new-head', 'new-run', 'new-attempt']) {
    const fixture = harness();
    const { state } = fixture;
    if (condition === 'new-head') state.pr.head.sha = 'b'.repeat(40);
    if (condition === 'new-run') {
      state.latest.id++;
      state.latest.run_number++;
      state.latest.conclusion = 'failure';
    }
    if (condition === 'new-attempt') state.run.run_attempt++;
    await fixture.execute();
    assert.deepEqual(state.merges, [], condition);
    assert.deepEqual(state.creates, [], condition);
    assert.deepEqual(state.updates, [], condition);
  }
});

test('controller refuses missing protection, missing test and a test from another check provider', async () => {
  for (const condition of ['unprotected', 'no-required-test', 'wrong-provider']) {
    const fixture = harness();
    const { state } = fixture;
    if (condition === 'unprotected') state.branch.protected = false;
    if (condition === 'no-required-test') state.branch.protection.required_status_checks.contexts = [];
    if (condition === 'wrong-provider') state.branch.protection.required_status_checks.checks[0].app_id = 999;
    const protectionBefore = structuredClone(state.branch);
    await fixture.execute();
    assert.deepEqual(state.merges, [], condition);
    assert.equal(state.creates.length, 1, condition);
    assert.equal(state.failures.length, 1, condition);
    assert.deepEqual(state.branch, protectionBefore, 'protection is never rewritten');
  }
});

test('controller does not merge blocked, behind, conflicting or unknown mergeability', async () => {
  for (const mergeState of ['blocked', 'behind', 'dirty', 'unknown']) {
    const fixture = harness();
    fixture.state.current.mergeable_state = mergeState;
    if (mergeState === 'unknown') fixture.state.current.mergeable = null;
    await fixture.execute();
    assert.deepEqual(fixture.state.merges, [], mergeState);
    assert.equal(fixture.state.creates.length, 1, mergeState);
    assert.equal(fixture.state.failures.length, 1, mergeState);
  }
});

test('a head change or draft conversion immediately before merging aborts the merge', async () => {
  for (const condition of ['new-head', 'draft', 'new-base']) {
    const fixture = harness();
    if (condition === 'new-head') fixture.state.current.head.sha = 'b'.repeat(40);
    if (condition === 'draft') fixture.state.current.draft = true;
    if (condition === 'new-base') fixture.state.current.base.ref = 'release';
    await fixture.execute();
    assert.deepEqual(fixture.state.merges, [], condition);
    assert.deepEqual(fixture.state.creates, [], condition);
    assert.equal(fixture.state.outputs.merged, 'false');
  }
});

test('API permission rejection reports failure without retrying with bypass or admin privileges', async () => {
  for (const operation of ['branch', 'merge']) {
    const fixture = harness();
    const rejection = Object.assign(new Error('Forbidden'), { status: 403 });
    fixture.state[`${operation}Error`] = rejection;
    await fixture.execute();
    assert.equal(fixture.state.merges.length, operation === 'merge' ? 1 : 0);
    assert.equal(fixture.state.outputs.merged, 'false');
    assert.equal(fixture.state.creates.length, 1);
    assert.match(fixture.state.creates[0].body, /403/);
    assert.equal(fixture.state.failures.length, 1);
    for (const call of fixture.state.merges) {
      assert.deepEqual(Object.keys(call).sort(), ['merge_method', 'owner', 'pull_number', 'repo', 'sha']);
    }
  }
});

test('a server-refused merge never exposes a successful merge output or deploy SHA', async () => {
  const fixture = harness();
  fixture.state.mergeResult = { merged: false, message: 'Protected branch update failed' };
  await fixture.execute();
  assert.equal(fixture.state.outputs.merged, 'false');
  assert.equal(fixture.state.outputs.sha, undefined);
  assert.equal(fixture.state.creates.length, 1);
  assert.equal(fixture.state.failures.length, 1);
});

test('failure reporting updates the existing bot report without editing human comments', async () => {
  const fixture = harness();
  fixture.state.runJobs[0].conclusion = 'failure';
  fixture.state.comments = [
    { id: 10, user: { login: 'rrrtstudio' }, body: '<!-- pachiarucg-auto-merge --> manual note' },
    { id: 11, user: { login: 'github-actions[bot]' }, body: '<!-- pachiarucg-auto-merge --> previous report' },
  ];
  await fixture.execute();
  assert.deepEqual(fixture.state.creates, []);
  assert.equal(fixture.state.updates.length, 1);
  assert.equal(fixture.state.updates[0].comment_id, 11);
  assert.equal(fixture.state.failures.length, 1);
});

test('a comment permission failure preserves the Actions summary and failed outcome', async () => {
  const fixture = harness();
  fixture.state.runJobs[0].conclusion = 'failure';
  fixture.state.commentError = Object.assign(new Error('Forbidden'), { status: 403 });
  await fixture.execute();
  assert.deepEqual(fixture.state.merges, []);
  assert.equal(fixture.state.warnings.length, 1);
  assert.equal(fixture.state.failures.length, 1);
  assert.equal(fixture.state.summaryWritten, true);
});
