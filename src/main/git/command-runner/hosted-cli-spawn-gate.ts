import { HOSTED_SOURCE_CONTROL_ENABLED } from '../../../shared/pure-hosted-source-control'

/** zyx/orca-pure safety net: with hosted source control off, no gh or glab process may ever start. */
export function assertHostedCliSpawnAllowed(): void {
  if (!HOSTED_SOURCE_CONTROL_ENABLED) {
    throw new Error('Hosted source control (gh/glab) is disabled in this build')
  }
}
