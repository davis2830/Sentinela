import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireSuccessfulCI } from './release-gate.mjs';

const passing = { id: 1, head_sha: 'reviewed-sha', head_repository: { full_name: 'owner/sentinel' },
  event: 'push', run_number: 10, status: 'completed', conclusion: 'success' };
test('deploy only after successful push CI for the exact repository and SHA', () => {
  assert.equal(requireSuccessfulCI([passing], 'reviewed-sha', 'owner/sentinel'), 1);
  for (const override of [{ head_sha: 'other-sha' }, { event: 'pull_request' },
    { head_repository: { full_name: 'fork/sentinel' } }, { status: 'in_progress' },
    { conclusion: 'failure' }, { conclusion: 'cancelled' }, { conclusion: null }]) {
    assert.throws(() => requireSuccessfulCI([{ ...passing, ...override }], 'reviewed-sha', 'owner/sentinel'));
  }
  assert.throws(() => requireSuccessfulCI([], 'reviewed-sha', 'owner/sentinel'));
});
test('older success cannot override the latest failed or pending run', () => {
  for (const status of [{ status: 'completed', conclusion: 'failure' },
    { status: 'in_progress', conclusion: null }]) {
    assert.throws(() => requireSuccessfulCI([passing, { ...passing, run_number: 11, ...status }],
      'reviewed-sha', 'owner/sentinel'));
  }
  const runs = [{ ...passing, run_number: 9, conclusion: 'failure' }, passing];
  assert.equal(requireSuccessfulCI(runs, 'reviewed-sha', 'owner/sentinel'), 1);
  assert.equal(runs[0].run_number, 9);
});
