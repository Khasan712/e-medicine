import { Outlet, ScrollRestoration } from 'react-router'

/** The top of every page: restores the scroll position on Back/Forward. */
export function Root() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  )
}
