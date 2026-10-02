import '@fontsource-variable/manrope'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { createQueryClient } from './api/queries'
import { App } from './App'
import { routes } from './routes'

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing in index.html')

createRoot(root).render(
  <StrictMode>
    <App router={createBrowserRouter(routes)} queryClient={createQueryClient()} />
  </StrictMode>,
)
