import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { Glow } from '../components/AppLayout'
import { ArrowLeftIcon, ErrorCircleIcon, RefreshIcon, SearchIcon } from '../components/icons'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/styles'
import { EmptyState } from '../components/ui/States'

export function NotFoundPage() {
  return (
    <>
      <title>Sahifa topilmadi · DeliveryHub</title>
      <EmptyState
        headingLevel="h1"
        icon={<SearchIcon size={28} />}
        title="Sahifa topilmadi"
        description="Manzil noto'g'ri yoki sahifa o'chirilgan."
        action={
          <Link to="/" className={buttonClass({ variant: 'secondary' })}>
            <ArrowLeftIcon size={16} />
            Bizneslarga qaytish
          </Link>
        }
      />
    </>
  )
}

/** Shown instead of the app when rendering fails unexpectedly. */
export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  return (
    <div className="relative isolate grid min-h-dvh place-items-center px-4">
      <Glow />
      <div role="alert" className="w-full max-w-md rounded-3xl bg-white px-6 py-12 text-center shadow-card ring-1 ring-slate-200/80">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
          <ErrorCircleIcon size={28} />
        </span>
        <h1 className="mt-4 text-xl font-extrabold tracking-tight">
          {notFound ? 'Sahifa topilmadi' : 'Kutilmagan xatolik yuz berdi'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {notFound ? "Manzil noto'g'ri yoki sahifa o'chirilgan." : "Sahifani yangilab ko'ring. Muammo takrorlansa, bizga xabar bering."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/" className={buttonClass({ variant: 'secondary' })}>
            Bosh sahifa
          </Link>
          <Button onClick={() => window.location.reload()}>
            <RefreshIcon size={16} />
            Yangilash
          </Button>
        </div>
      </div>
    </div>
  )
}
