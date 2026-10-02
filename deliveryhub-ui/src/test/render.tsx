import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { createMemoryRouter } from 'react-router'
import { createQueryClient } from '../api/queries'
import { App } from '../App'
import { routes } from '../routes'

type UserOptions = Parameters<typeof userEvent.setup>[0]

/** The whole app (routes, providers, StrictMode) at `path`, against the MSW backend. */
export function renderApp(path = '/', { state, user: userOptions }: { state?: unknown; user?: UserOptions } = {}) {
  const queryClient = createQueryClient({ retry: false })
  const url = new URL(path, 'http://localhost')
  const router = createMemoryRouter(routes, {
    initialEntries: [{ pathname: url.pathname, search: url.search, state }],
  })
  const user = userEvent.setup(userOptions)
  const view = render(
    <StrictMode>
      <App router={router} queryClient={queryClient} />
    </StrictMode>,
  )
  return { user, router, queryClient, ...view }
}
