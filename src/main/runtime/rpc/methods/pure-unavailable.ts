/** zyx/orca-pure: Linear and Jira are removed; their RPC methods keep their names and answer `runtime_unavailable`. */
export function pureUnavailable(): never {
  throw new Error('runtime_unavailable')
}

export async function pureUnavailableStream(): Promise<void> {
  pureUnavailable()
}
