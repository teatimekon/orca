/** The pi-web session a page URL names (`?session=`), or null for any other URL. */
export function piWebUrlSessionId(url: string): string | null {
  try {
    return new URL(url).searchParams.get('session')
  } catch {
    return null
  }
}

/**
 * The conversation a page of the pi-web server at `origin` shows, or null for its
 * new-conversation composer (`?cwd=` wins over `?session=` in pi-web) and any other page.
 * `orcaEmbed=1` is not required: pi-web drops it from the URL once it switches conversations.
 */
export function piWebPageSessionId(url: string, origin: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.origin !== origin || parsed.searchParams.has('cwd')) {
    return null
  }
  return parsed.searchParams.get('session') || null
}
