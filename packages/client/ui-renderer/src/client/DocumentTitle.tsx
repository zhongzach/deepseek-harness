import { useEffect } from 'react'

const DEFAULT_CLIENT_TITLE = 'DSH Local Build'

/** Props for the browser title projection. */
export interface DocumentTitleProps {
  /** Durable title of the selected session, or undefined for the product title. */
  title?: string
}

/**
 * Project the selected durable session title into the browser title and
 * restore the build-selected product title when unmounted.
 * @param props - Selected session title projection.
 * @returns No rendered content.
 */
export function DocumentTitle({ title }: DocumentTitleProps): null {
  const injectedTitle = (globalThis as {
    __DSH_BOOT_PRESENTATION__?: { documentTitle?: unknown }
  }).__DSH_BOOT_PRESENTATION__?.documentTitle
  const productTitle = typeof injectedTitle === 'string' && injectedTitle !== ''
    ? injectedTitle
    : process.env.DSH_CLIENT_TITLE ?? DEFAULT_CLIENT_TITLE
  useEffect(() => {
    document.title = title === undefined ? productTitle : `${title} — ${productTitle}`
    return () => { document.title = productTitle }
  }, [productTitle, title])
  return null
}
