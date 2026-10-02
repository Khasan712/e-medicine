import { setupServer } from 'msw/node'
import { handlers } from './backend'

/** The mock Platform API for every test (tests may add one-off handlers with `server.use`). */
export const server = setupServer(...handlers)
