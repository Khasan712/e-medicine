import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { openExternal } from '../lib/telegram'

interface ExternalLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> {
  href: string
  children: ReactNode
}

/** A link that leaves the shop: a new tab on the website, Telegram's own browser inside the Mini App. */
export function ExternalLink({ href, children, onClick, ...rest }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented && openExternal(href)) event.preventDefault()
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
