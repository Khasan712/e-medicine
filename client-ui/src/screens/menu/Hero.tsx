import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { useI18n } from '../../i18n/i18n'
import { cn } from '../../lib/cn'
import { useCatalog } from '../../state/catalog'

const IMAGE_POSITIONS = [
  'right-[10%] bottom-[12%] size-[64%]',
  'top-[16%] -left-[4%] size-[38%] [animation-delay:-2s]',
  '-top-[2%] right-0 size-[30%] [animation-delay:-4s]',
]

function Chip({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--brand-ink)_18%,transparent)] px-2.5 text-xs font-bold whitespace-nowrap backdrop-blur-sm sm:h-8 sm:px-3 sm:text-[13px]">
      <Icon name={icon} className="size-3.5" />
      <span className="truncate">{children}</span>
    </span>
  )
}

/** The brand banner: tagline, delivery facts and floating photos of popular dishes. */
export function Hero() {
  const { t, money } = useI18n()
  const { business, popular, products } = useCatalog()
  if (!business) return null
  const images = (popular.length >= 3 ? popular : products).filter((product) => product.image).slice(0, 3)
  const withArt = images.length > 0

  return (
    <section className="hero-gradient relative mt-2 overflow-hidden rounded-[28px] p-5 text-brand-ink shadow-[0_16px_40px_color-mix(in_srgb,var(--brand)_28%,transparent)] sm:min-h-[220px] sm:p-9">
      <h1
        className={cn(
          'relative z-[1] text-xl leading-[1.18] font-extrabold tracking-[-0.03em] text-balance sm:text-[34px]',
          withArt && 'max-w-[62%] sm:max-w-[56%]',
        )}
      >
        {business.tagline || t('heroTitle')}
      </h1>
      <p className={cn('relative z-[1] mt-1.5 text-[13px] font-medium opacity-90 sm:mt-2 sm:text-base', withArt && 'max-w-[58%] sm:max-w-[56%]')}>
        {t('heroText')}
      </p>
      <div className={cn('relative z-[1] mt-3.5 flex flex-wrap gap-1.5 sm:mt-[18px] sm:gap-2', withArt && 'max-w-[62%] sm:max-w-[60%]')}>
        {business.delivery_time && <Chip icon="clock">{t('deliveryTime', { time: business.delivery_time })}</Chip>}
        <Chip icon="cash">{t('cashOrCard')}</Chip>
        {business.min_order > 0 && (
          <Chip icon="bag">
            <span className="sm:hidden">{t('minOrderShort', { amount: money(business.min_order) })}</span>
            <span className="hidden sm:inline">{t('minOrderChip', { amount: money(business.min_order) })}</span>
          </Chip>
        )}
      </div>
      {withArt && (
        <div aria-hidden="true" className="absolute -right-2.5 -bottom-3.5 aspect-square w-[42%] max-w-[280px] sm:-right-3.5 sm:-bottom-5 sm:w-[46%]">
          {images.map((product, index) => (
            <img
              key={product.id}
              src={product.image!}
              alt=""
              draggable={false}
              className={cn(
                'absolute animate-float rounded-full border-4 border-white/92 object-cover shadow-[0_12px_30px_rgb(0_0_0/0.25)]',
                IMAGE_POSITIONS[index],
              )}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export function HeroSkeleton() {
  return <div className="skeleton mt-2 h-[168px] rounded-[28px] sm:h-[220px]" aria-hidden="true" />
}
