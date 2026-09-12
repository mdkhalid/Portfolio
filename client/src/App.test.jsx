import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'

// Never open a real socket in router tests.
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn(), connected: false })),
}))
vi.mock('./components/ChatWidget', () => ({ default: () => null }))
vi.mock('./components/CookieConsent', () => ({ default: () => null }))
vi.mock('./components/ScrollToTop', () => ({ default: () => null }))
vi.mock('./pages/Home', () => ({ default: () => <div>Home page</div> }))
vi.mock('./pages/BentoHome', () => ({ default: () => <div>Bento page</div> }))
vi.mock('./pages/ResumePage', () => ({ default: () => <div>Resume page</div> }))
vi.mock('./pages/AdminLogin', () => ({ default: () => <div>Admin login page</div> }))
vi.mock('./pages/AdminDashboard', () => ({ default: () => <div>Admin dashboard page</div> }))
vi.mock('./pages/ChatPage', () => ({ default: () => <div>Chat page</div> }))
vi.mock('./pages/ATSCheckerPage', () => ({ default: () => <div>ATS page</div> }))
vi.mock('./pages/BlogPage', () => ({ default: () => <div>Blog page</div> }))
vi.mock('./pages/ArticlePage', () => ({ default: () => <div>Article page</div> }))
vi.mock('./pages/PostmortemsPage', () => ({ default: () => <div>Postmortems page</div> }))
vi.mock('./pages/PostmortemDetailPage', () => ({ default: () => <div>Postmortem detail page</div> }))
vi.mock('./pages/LiveChatPage', () => ({ default: () => <div>Live chat page</div> }))

import App from './App'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('App router', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders Home at /', async () => {
    renderAt('/')
    expect(await screen.findByText('Home page')).toBeInTheDocument()
  })

  it('renders the chat page at /chat', async () => {
    renderAt('/chat')
    expect(await screen.findByText('Chat page')).toBeInTheDocument()
  })

  it('renders the ATS checker at /ats-checker', async () => {
    renderAt('/ats-checker')
    expect(await screen.findByText('ATS page')).toBeInTheDocument()
  })

  it('redirects unauthenticated /admin/dashboard to /admin login', async () => {
    renderAt('/admin/dashboard')
    expect(await screen.findByText('Admin login page')).toBeInTheDocument()
  })
})
