/** The pi-web session a page URL names (`?session=`), or null for any other URL. */
export function piWebUrlSessionId(url: string): string | null {
  try {
    return new URL(url).searchParams.get('session')
  } catch {
    return null
  }
}
