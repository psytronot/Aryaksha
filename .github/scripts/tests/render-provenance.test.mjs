import test from 'node:test';
import assert from 'node:assert/strict';
import { assessDeploymentSource, extractLiveDeploy } from '../.github/scripts/verify-render-provenance.mjs';

const sha = letter => letter.repeat(40);
const deploy = (id, status, commitSha) => ({
  deploy: { id, status, commit: { id: commitSha } },
  cursor: 'opaque-cursor'
});

test('selects the live deployment rather than a newer failed attempt', () => {
  const live = extractLiveDeploy([
    deploy('dep-failed', 'build_failed', sha('b')),
    deploy('dep-live', 'live', sha('a'))
  ], 'web');
  assert.deepEqual(live, { id: 'dep-live', commitSha: sha('a'), status: 'live' });
});

test('requires exactly one live deployment with a full commit SHA', () => {
  assert.throws(() => extractLiveDeploy([], 'web'), /found 0/);
  assert.throws(() => extractLiveDeploy([
    deploy('dep-a', 'live', sha('a')),
    deploy('dep-b', 'live', sha('b'))
  ], 'web'), /found 2/);
  assert.throws(() => extractLiveDeploy([deploy('dep-short', 'live', 'abc1234')], 'web'), /full Git commit SHA/);
});

test('web provenance requires the live commit to equal canonical main', () => {
  const stale = assessDeploymentSource('web', {
    ahead_by: 3,
    behind_by: 0,
    files: [{ filename: 'src/App.tsx' }, { filename: 'src/index.css' }]
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.relation, 'behind-main');

  const exact = assessDeploymentSource('web', { ahead_by: 0, behind_by: 0, files: [] });
  assert.equal(exact.ok, true);
  assert.equal(exact.relation, 'exact-main');
});

test('Orekit may use an older commit only when its service subtree is unchanged', () => {
  const unchanged = assessDeploymentSource('orekit', {
    ahead_by: 14,
    behind_by: 0,
    files: [{ filename: '.github/workflows/ci.yml' }, { filename: 'src/App.tsx' }]
  });
  assert.equal(unchanged.ok, true);
  assert.equal(unchanged.relation, 'orekit-source-equivalent');

  const changed = assessDeploymentSource('orekit', {
    ahead_by: 2,
    behind_by: 0,
    files: [{ filename: 'orekit-service/src/main/java/Orbit.java' }]
  });
  assert.equal(changed.ok, false);
  assert.equal(changed.relation, 'orekit-service-changed');
});

test('rejects deployed commits that are not ancestors of canonical main', () => {
  const result = assessDeploymentSource('orekit', {
    ahead_by: 4,
    behind_by: 1,
    files: [{ filename: 'orekit-service/Dockerfile' }]
  });
  assert.equal(result.ok, false);
  assert.equal(result.relation, 'not-on-main');
});
