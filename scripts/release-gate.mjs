// Only a successful push CI for the exact revision can authorize deployment.
export function requireSuccessfulCI(runs, sha, repository) {
  const latest = runs.filter(run => run.head_sha === sha
    && run.head_repository?.full_name === repository && run.event === 'push')
    .sort((a, b) => b.run_number - a.run_number)[0];
  if (!latest || latest.status !== 'completed' || latest.conclusion !== 'success') {
    throw new Error('Deployment requires a completed, successful CI run for this exact SHA.');
  }
  return latest.id;
}
