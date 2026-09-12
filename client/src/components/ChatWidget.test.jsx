import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const socketMocks = vi.hoisted(() => ({
  io: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
}))

vi.mock('socket.io-client', () => ({
  io: (...args) => {
    socketMocks.io(...args)
    return { on: socketMocks.on, emit: socketMocks.emit, connected: false }
  },
}))

import ChatWidget from './ChatWidget'

describe('ChatWidget', () => {
  beforeEach(() => {
    localStorage.clear()
    socketMocks.io.mockClear()
    socketMocks.on.mockClear()
    socketMocks.emit.mockClear()
  })

  it('opens the join form and persists a visitorId', () => {
    render(<ChatWidget />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByPlaceholderText('Your name')).toBeInTheDocument()
    const visitorId = localStorage.getItem('visitorId')
    expect(visitorId).toBeTruthy()
  })

  it('reuses the stored visitorId on connect', () => {
    localStorage.setItem('visitorId', 'visitor-123')
    render(<ChatWidget />)
    fireEvent.click(screen.getByRole('button'))
    expect(socketMocks.io).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ query: expect.objectContaining({ visitorId: 'visitor-123' }) })
    )
  })

  it('join emits visitor:join only with a name', () => {
    render(<ChatWidget />)
    fireEvent.click(screen.getByRole('button'))
    // While disconnected the join button is disabled and says Connecting.
    const joinButton = screen.getByRole('button', { name: /connecting/i })
    expect(joinButton).toBeDisabled()
    fireEvent.click(joinButton)
    expect(socketMocks.emit).not.toHaveBeenCalledWith('visitor:join', expect.anything())
    // Simulate the socket connecting.
    const connectHandler = socketMocks.on.mock.calls.find(([event]) => event === 'connect')[1]
    connectHandler()
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByText('Start Chat'))
    expect(socketMocks.emit).toHaveBeenCalledWith('visitor:join', { name: 'Ada' })
  })
})
