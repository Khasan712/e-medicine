import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { ProductImage } from '../../components/ProductImage'
import { useI18n } from '../../i18n/i18n'
import { useCatalog } from '../../state/catalog'

function Chip({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <span className="inline-flex h-7 max-w-full min-w-0 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--hero-ink)_12%,transparent)] px-2.5 text-xs font-bold whitespace-nowrap sm:h-8 sm:gap-1.5 sm:px-3 sm:text-[13px]">
      <Icon name={icon} className="size-3.5 sm:size-4" />
      <span className="truncate">{children}</span>
    </span>
  )
}

/** The banner of the shop: tagline, delivery facts and three popular dishes. */
export function Hero() {
  const { t, money, name } = useI18n()
  const { business, popular, products } = useCatalog()
  if (!business) return null
  const images = (popular.length >= 3 ? popular : products).filter((product) => product.image).slice(0, 3)

  return (
    <section className="flex items-center justify-between gap-6 rounded-[24px] bg-[var(--hero-bg)] p-5 text-[var(--hero-ink)] sm:py-7 sm:pr-7 sm:pl-8">
      <div className="min-w-0 max-w-[460px]">
        <h1 className="text-[22px] leading-[1.15] font-extrabold tracking-[-0.03em] text-balance sm:text-[28px]">
          {business.tagline || t('heroTitle')}
        </h1>
        <p className="mt-2 text-sm font-medium text-[color-mix(in_srgb,var(--hero-ink)_74%,transparent)] sm:text-[15px]">
          {t('heroText')}
        </p>
        <div className="mt-3.5 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
          {business.delivery_time && <Chip icon="clock">{t('deliveryTime', { time: business.delivery_time })}</Chip>}
          <Chip icon="cash">{t('cashOrCard')}</Chip>
          {business.min_order > 0 && (
            <Chip icon="bag">
              <span className="sm:hidden">{t('minOrderShort', { amount: money(business.min_order) })}</span>
              <span className="hidden sm:inline">{t('minOrderChip', { amount: money(business.min_order) })}</span>
            </Chip>
          )}
        </div>
      </div>
      {images.length > 0 && (
        <div aria-hidden="true" className="hidden shrink-0 gap-2.5 sm:flex">
          {images.map((product) => (
            <ProductImage
              key={product.id}
              src={product.image}
              name={name(product)}
              eager
              className="h-[120px] w-[100px] rounded-[18px] lg:h-[132px] lg:w-[112px]"
            />
          ))}
        </div>
      )}
    </section>
  )
}

export function HeroSkeleton() {
  return <div className="skeleton h-[160px] rounded-[24px] sm:h-[188px]" aria-hidden="true" />
}
