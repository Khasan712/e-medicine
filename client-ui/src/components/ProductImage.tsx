import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { initial } from '../lib/format'

interface ProductImageProps {
  src: string | null | undefined
  /** Product name — its first letter is the placeholder. */
  name: string
  /** Alternative text; empty (decorative) by default because the name is usually shown next to it. */
  alt?: string
  className?: string
  /** Size of the letter in the placeholder. */
  letterClassName?: string
  eager?: boolean
}

/** Product photo with a soft fade-in; a branded letter placeholder when there is no image (or it fails). */
export function ProductImage({ src, name, alt = '', className, letterClassName, eager }: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const showImage = Boolean(src) && failedSrc !== src

  // Images from the browser cache are complete before React could see a load event.
  useLayoutEffect(() => {
    const img = imgRef.current
    if (src && img?.complete && img.naturalWidth > 0) setLoadedSrc(src)
  }, [src])

  return (
    <div className={cn('relative overflow-hidden bg-surface-2', className)}>
      {showImage ? (
        <img
          ref={imgRef}
          src={src!}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          data-loaded={loadedSrc === src || undefined}
          onLoad={() => setLoadedSrc(src!)}
          onError={() => setFailedSrc(src!)}
          className="img-fade size-full object-cover"
        />
      ) : (
        <div
          role={alt ? 'img' : undefined}
          aria-label={alt || undefined}
          aria-hidden={alt ? undefined : true}
          className={cn(
            'grid size-full place-items-center bg-[linear-gradient(135deg,var(--brand-soft),var(--surface-2))] font-extrabold text-brand-text',
            letterClassName ?? 'text-3xl',
          )}
        >
          <span aria-hidden="true">{initial(name)}</span>
        </div>
      )}
    </div>
  )
}
