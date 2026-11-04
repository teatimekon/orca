/** zyx/orca-pure: with hosted source control off, a handler answers `empty()` and never reaches gh/glab or the refresh queue. */
export function whenHostedEnabled<Args extends unknown[], Result, Empty>(
  enabled: boolean,
  empty: () => Empty,
  handler: (...args: Args) => Result
): (...args: Args) => Result | Empty {
  return (...args) => (enabled ? handler(...args) : empty())
}
