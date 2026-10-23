'use strict';

// Only this file from the trusted main workflow commit runs with write access.
// No PR source, artifacts, caches, titles or bodies are executed.
const REPOSITORY = 'rrrtstudio/PachiAruCG';
const TEST_WORKFLOW = '.github/workflows/test.yml';
const REPORT_MARKER = '<!-- pachiarucg-auto-merge -->';

function isEligiblePullRequest(pr, { repositoryId, headSha, headBranch }) {
  return Boolean(pr && pr.state === 'open' && pr.draft === false && !pr.merged &&
    pr.base?.ref === 'main' && pr.base?.repo?.id === repositoryId &&
    pr.head?.repo?.id === repositoryId && pr.head?.sha === headSha &&
    pr.head?.ref === headBranch && headBranch?.startsWith('codex/'));
}

function evaluateRun(run, expected, latestRun, jobs) {
  const reject = reason => ({ ok: false, reason });
  if (!run || run.event !== 'pull_request' || run.path !== TEST_WORKFLOW ||
      run.workflow_id !== expected.workflowId ||
      run.repository?.id !== expected.repositoryId || run.head_repository?.id !== expected.repositoryId ||
      run.head_sha !== expected.headSha || run.head_branch !== expected.headBranch ||
      run.id !== expected.runId || run.run_attempt !== expected.runAttempt) {
    return reject('Test run identity does not match the current PR and workflow.');
  }
  if (!latestRun || latestRun.id !== run.id || latestRun.run_attempt !== run.run_attempt ||
      latestRun.status !== 'completed' || latestRun.conclusion !== 'success') {
    return reject('This is not the latest successful test run/attempt for this head.');
  }
  if (run.status !== 'completed' || run.conclusion !== 'success') {
    return reject('Required test workflow did not succeed.');
  }
  const tests = Array.isArray(jobs) ? jobs.filter(job => job.name === 'test') : [];
  if (tests.length !== 1 || tests[0].status !== 'completed' || tests[0].conclusion !== 'success') {
    return reject('The required test job must complete successfully; skipped/neutral is not success.');
  }
  return { ok: true, reason: 'Latest required test job succeeded.' };
}

function hasRequiredTest(branch) {
  const checks = branch?.protection?.required_status_checks;
  return Boolean(branch?.protected && branch.protection?.enabled &&
    checks?.contexts?.includes('test') &&
    checks?.checks?.some(check => check.context === 'test' && check.app_id === 15368));
}

async function report({ github, context, core }, pr, message) {
  const body = `${REPORT_MARKER}\n自動マージを停止しました。\n\n${message}\n\n` +
    `[実行結果](https://github.com/${REPOSITORY}/actions/runs/${context.runId})\n\n` +
    'ブランチ保護や必須チェックを変更・回避する処理は行っていません。';
  core.summary.addHeading(`PR #${pr.number}: 自動マージ停止`).addRaw(message).addEOL();
  try {
    const comments = await github.paginate(github.rest.issues.listComments, {
      ...context.repo, issue_number: pr.number, per_page: 100
    });
    const previous = comments.find(comment => comment.user?.login === 'github-actions[bot]' &&
      comment.body?.startsWith(REPORT_MARKER));
    if (previous) {
      await github.rest.issues.updateComment({ ...context.repo, comment_id: previous.id, body });
    } else {
      await github.rest.issues.createComment({ ...context.repo, issue_number: pr.number, body });
    }
  } catch (error) {
    core.warning(`PRへの報告に失敗しました。Actions summaryを確認してください (${error.status || 'API error'})。`);
  }
  core.setFailed(message);
}

async function runAutoMerge({ github, context, core }) {
  core.setOutput('merged', 'false');
  const env = { github, context, core };
  const repo = context.repo;
  const payload = context.payload;
  const eventRun = payload.workflow_run;
  const repositoryId = payload.repository?.id;
  if (`${repo.owner}/${repo.repo}` !== REPOSITORY || !repositoryId || !eventRun ||
      eventRun.event !== 'pull_request' || eventRun.head_repository?.id !== repositoryId ||
      !eventRun.head_branch?.startsWith('codex/')) return;

  const { data: workflow } = await github.rest.actions.getWorkflow({ ...repo, workflow_id: 'test.yml' });
  const { data: run } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: eventRun.id });
  const expected = { repositoryId, workflowId: workflow.id, headSha: eventRun.head_sha,
    headBranch: eventRun.head_branch, runId: eventRun.id, runAttempt: eventRun.run_attempt };
  // An old completion event cannot make decisions for a newer run or attempt.
  if (run.run_attempt !== expected.runAttempt || run.head_sha !== expected.headSha) return;

  const candidates = await github.paginate(github.rest.pulls.list, {
    ...repo, state: 'open', base: 'main', head: `${repo.owner}:${expected.headBranch}`, per_page: 100
  });
  for (const candidate of candidates) {
    const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: candidate.number });
    if (!isEligiblePullRequest(pr, expected)) continue;
    try {
      const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
        ...repo, workflow_id: workflow.id, event: 'pull_request', head_sha: expected.headSha, per_page: 100
      });
      const latest = runs.filter(item => item.head_branch === expected.headBranch)
        .sort((a, b) => b.run_number - a.run_number || b.id - a.id)[0];
      // A newer run (including one still running or failing) supersedes this event.
      if (!latest || latest.id !== run.id || latest.run_attempt !== run.run_attempt) continue;
      const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun, {
        ...repo, run_id: run.id, filter: 'latest', per_page: 100
      });
      const decision = evaluateRun(run, expected, latest, jobs);
      if (!decision.ok) {
        await report(env, pr, `${decision.reason} テストを修正して再実行してください。`);
        continue;
      }
      const { data: branch } = await github.rest.repos.getBranch({ ...repo, branch: 'main' });
      if (!hasRequiredTest(branch)) {
        await report(env, pr, 'mainの保護とGitHub Actionsの必須チェック test を確認できません。設定の確認が必要です。');
        continue;
      }
      // Fetch again just before merging; the server also compares the exact SHA.
      const { data: current } = await github.rest.pulls.get({ ...repo, pull_number: pr.number });
      if (!isEligiblePullRequest(current, expected)) continue;
      if (current.mergeable !== true || current.mergeable_state !== 'clean') {
        await report(env, current, '保護条件・レビュー待ち・競合・最新mainとの差分などにより、現在はマージできません。PRの状態を解決し、testを再実行してください。');
        continue;
      }
      // GITHUB_TOKEN is not an administrator token. This endpoint enforces all
      // remaining branch rules. No bypass flags, auto-approval or protection edits.
      const { data: result } = await github.rest.pulls.merge({ ...repo, pull_number: pr.number,
        sha: expected.headSha, merge_method: 'squash' });
      if (!result.merged || !result.sha) {
        await report(env, current, 'GitHubがマージを受け付けませんでした。PRの保護条件とマージ設定を確認してください。');
        continue;
      }
      core.setOutput('merged', 'true');
      core.setOutput('sha', result.sha);
      core.summary.addHeading(`PR #${pr.number}: マージ完了`)
        .addRaw('最新のtest成功を確認し、GitHubの保護条件に従ってマージしました。Pages公開へ進みます。').addEOL();
      break;
    } catch (error) {
      await report(env, pr, `GitHub APIが処理を拒否しました (${error.status || 'API error'})。権限・保護条件・マージ方式を確認してください。`);
    }
  }
  await core.summary.write();
}

module.exports = { isEligiblePullRequest, evaluateRun, hasRequiredTest, runAutoMerge };
