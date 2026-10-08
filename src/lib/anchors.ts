/**
 * Scrolling for the header's anchored links.
 *
 * It lives in its own module rather than in App.tsx because the header needs it
 * and App renders the header: putting it there would make the two import each
 * other.
 *
 * Why the browser is not left to handle it. Clicking `<a href="/en#lab">` is a
 * real navigation, so the tree unmounts and remounts, which is what broke the
 * original attempt at doing this in a router effect (see ScrollManager in
 * App.tsx for the full history). And on a fast connection the document is still
 * short when the click lands — the chart is a lazy chunk — so the browser aims at
 * a section that is not yet there and does nothing. This waits for the target to
 * become reachable instead.
 */

/** How long to keep waiting for a target the page has not grown enough for. */
const RETRY_MS = 4000

export function scrollToAnchor(event: React.MouseEvent<HTMLElement>) {
  const anchor = (event.target as HTMLElement).closest('a[href]')
  if (!anchor) return

  const href = anchor.getAttribute('href') ?? ''
  const hashIndex = href.indexOf('#')
  if (hashIndex === -1) return

  const target = document.getElementById(href.slice(hashIndex + 1))
  if (!target) return

  event.preventDefault()

  const deadline = performance.now() + RETRY_MS
  let frame = 0

  const jump = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    const offset = target.getBoundingClientRect().top + window.scrollY

    // Not reachable yet. `scroll-margin-top` shifts the target slightly above the
    // viewport top, so the comparison is made against the true offset.
    if (offset > maxScroll + 1) {
      if (performance.now() > deadline) return
      frame = requestAnimationFrame(jump)
      return
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  jump()

  // The URL still has to reflect where we are, or a reload loses the place.
  window.history.replaceState(null, '', href)
}