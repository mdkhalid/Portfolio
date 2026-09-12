import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

const apiMocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  default: { post: apiMocks.post, get: apiMocks.get },
  setAuthToken: vi.fn(),
  setTokenUpdateHandler: vi.fn(),
  fetchCsrfToken: vi.fn(async () => {}),
}))

function Probe() {
  const { token, user, login, logout, isAdmin } = useAuth()
  return (
    <div>
      <span data-testid="status">{isAdmin ? 'admin' : 'guest'}</span>
      <span data-testid="user">{user?.username || 'none'}</span>
      <span data-testid="token">{token || 'no-token'}</span>
      <button onClick={() => login('admin', 'secret')}>sign in</button>
      <button onClick={() => logout()}>sign out</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    apiMocks.post.mockReset()
  })

  it('starts logged out when storage is empty', () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    expect(screen.getByTestId('status')).toHaveTextContent('guest')
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('login persists the token and marks the admin session', async () => {
    apiMocks.post.mockResolvedValue({ data: { token: 'tok123', username: 'admin' } })
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    fireEvent.click(screen.getByText('sign in'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('admin'))
    expect(screen.getByTestId('user')).toHaveTextContent('admin')
    expect(JSON.parse(localStorage.getItem('auth')).token).toBe('tok123')
  })

  it('logout clears the session', async () => {
    apiMocks.post.mockImplementation((url) => {
      if (url === '/api/auth/login') return Promise.resolve({ data: { token: 'tok123', username: 'admin' } })
      return Promise.resolve({ data: {} })
    })
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )
    fireEvent.click(screen.getByText('sign in'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('admin'))
    fireEvent.click(screen.getByText('sign out'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('guest'))
    expect(localStorage.getItem('auth')).toBeNull()
  })
})
