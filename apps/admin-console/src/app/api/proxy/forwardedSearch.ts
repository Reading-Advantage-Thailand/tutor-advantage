/**
 * The query string the proxy forwards to a service. A "+" (a form-encoded
 * space, as URLSearchParams and HTML forms write it) becomes %20: the
 * services' OpenAPI validator rejects "+" as a reserved character
 * ("q must be url encoded"), so a search for "Local Tutor" answered 400.
 * The meaning is unchanged (both decode to a space); a literal plus already
 * arrives as %2B and is left alone.
 */
export function forwardedSearch(search: string): string {
  return search.replace(/\+/g, "%20");
}
