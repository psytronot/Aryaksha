import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RENDER_API = 'https://api.render.com/v1';
const GITHUB_API = 'https://api.github.com';

export const RENDER_SERVICES = Object.freeze([
  { name: 'web', id: 'srv-dbhm5nks728c73d2f73g' },
  { name: 'orekit', id: 'srv-dbhm5p942hec73cr4ddg' }
]);

export function extractLiveDeploy(entries, serviceName) {
  if (!Array.isArray(entries)) {
    throw new Error(`${serviceName}: Render deploy response was not an array.`);
  }

  const liveDeploys = entries
    .map(entry => entry?.deploy ?? entry)
    .filter(deploy => deploy?.status === 'live');

  if (liveDeploys.length !== 1) {
    throw new Error(`${serviceName}: expected exactly one live deployment in the returned history, found ${liveDeploys.length}.`);
  }

  const deploy = liveDeploys[0];
  const commitSha = deploy.commit?.id;
  if (typeof deploy.id !== 'string' || !deploy.id ||
      typeof commitSha !== 'string' || !/^[0-9a-f]{40}$/i.test(commitSha)) {
    throw new Error(`${serviceName}: live deployment is missing a valid deployment ID or full Git commit SHA.`);
  }

  return { id: deploy.id, commitSha: commitSha.toLowerCase(), status: deploy.status };
}

export function assessDeploymentSource(serviceName, comparison) {
  if (!comparison || !Number.isInteger(comparison.ahead_by) ||
      !Number.isInteger(comparison.behind_by) || !Array.isArray(comparison.files)) {
    throw new Error(`${serviceName}: GitHub compare response is incomplete; provenance cannot be established.`);
  }

  const changedFiles = comparison.files
    .map(file => file?.filename)
    .filter(filename => typeof filename === 'string');

  if (comparison.behind_by > 0) {
    return {
      ok: false,
      relation: 'not-on-main',
      reason: `deployed commit is not an ancestor of canonical main (behind_by=${comparison.behind_by})`,
      changedFiles
    };
  }

  if (serviceName === 'web') {
    if (comparison.ahead_by > 0) {
      return {
        ok: false,
        relation: 'behind-main',
        reason: `live web deployment is ${comparison.ahead_by} commit(s) behind canonical main`,
        changedFiles
      };
    }
    return { ok: true, relation: 'exact-main', reason: 'live web commit exactly matches canonical main', changedFiles };
  }

  if (serviceName === 'orekit') {
    const serviceChanges = changedFiles.filter(filename =>
      filename === 'orekit-service' || filename.startsWith('orekit-service/')
    );
    if (serviceChanges.length > 0) {
      return {
        ok: false,
        relation: 'orekit-service-changed',
        reason: 'orekit-service source changed after the deployed commit',
        changedFiles: serviceChanges
      };
    }
    return {
      ok: true,
      relation: comparison.ahead_by === 0 ? 'exact-main' : 'orekit-source-equivalent',
      reason: comparison.ahead_by === 0
        ? 'live Orekit commit exactly matches canonical main'
        : `live Orekit commit is ${comparison.ahead_by} main commit(s) behind, with no orekit-service/ changes`,
      changedFiles
    };
  }

  throw new Error(`Unknown Render service policy: ${serviceName}`);
}

async function getJson(url, headers, label, fetchImpl) {
  const response = await fetchImpl(url, { headers });
  if (!response.ok) {
    throw new Error(`${label}: API returned HTTP ${response.status}; provenance is unverified.`);
  }
  return response.json();
}

function appendSummary(lines) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, `${lines.join('\n')}\n`);
}

export async function runProvenanceCheck(env = process.env, fetchImpl = fetch) {
  const renderKey = env.RENDER_API_KEY;
  const githubToken = env.GITHUB_TOKEN;
  const repository = env.GITHUB_REPOSITORY;
  const mainSha = env.GITHUB_SHA;

  if (!renderKey) throw new Error('RENDER_API_KEY is not configured in GitHub Actions secrets; exact Render provenance remains BLOCKED.');
  if (!githubToken || !repository || !/^[0-9a-f]{40}$/i.test(mainSha ?? '')) {
    throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY or full GITHUB_SHA is unavailable; exact Render provenance remains BLOCKED.');
  }

  const rows = [];
  const failures = [];

  for (const service of RENDER_SERVICES) {
    try {
      const deployUrl = new URL(`${RENDER_API}/services/${service.id}/deploys`);
      deployUrl.searchParams.set('limit', '20');
      const deployEntries = await getJson(
        deployUrl.toString(),
        { accept: 'application/json', authorization: `Bearer ${renderKey}` },
        `${service.name} Render deploy history`,
        fetchImpl
      );
      const live = extractLiveDeploy(deployEntries, service.name);

      const compareUrl = `${GITHUB_API}/repos/${repository}/compare/${live.commitSha}...${mainSha}`;
      const comparison = await getJson(
        compareUrl,
        {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': '2022-11-28'
        },
        `${service.name} GitHub commit comparison`,
        fetchImpl
      );
      const assessment = assessDeploymentSource(service.name, comparison);
      rows.push({
        service: service.name,
        deployId: live.id,
        deployedSha: live.commitSha,
        relation: assessment.relation,
        changedFiles: assessment.changedFiles.length,
        outcome: assessment.ok ? 'PASS' : 'HOLD',
        reason: assessment.reason
      });
      if (!assessment.ok) failures.push(`${service.name}: ${assessment.reason}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown provenance error';
      rows.push({ service: service.name, outcome: 'BLOCKED', reason });
      failures.push(`${service.name}: ${reason}`);
    }
  }

  const lines = [
    '## Render deployment provenance',
    `Canonical GitHub main: \`${mainSha}\``,
    '',
    '| Service | Live deploy | Deployed commit | Relation to main | Result |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${row.service} | ${row.deployId ?? 'unknown'} | ${row.deployedSha ? `\`${row.deployedSha}\`` : 'unknown'} | ${row.relation ?? 'unknown'} | ${row.outcome} |`),
    '',
    ...rows.map(row => `- **${row.service}:** ${row.reason ?? 'No additional detail.'}`),
    '',
    'This check is read-only. It does not trigger, restart, roll back or modify a Render service.'
  ];
  appendSummary(lines);
  for (const row of rows) console.log(JSON.stringify(row));

  if (failures.length > 0) {
    throw new Error(`Render deployment provenance gate is HOLD: ${failures.join(' | ')}`);
  }
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runProvenanceCheck().catch(error => {
    console.error(error instanceof Error ? error.message : 'Render provenance check failed.');
    process.exitCode = 1;
  });
}
