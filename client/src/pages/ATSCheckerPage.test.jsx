import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../context/ThemeContext'

vi.mock('../lib/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}))
vi.mock('../components/SEO', () => ({ default: () => null }))

import ATSCheckerPage from './ATSCheckerPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <ATSCheckerPage />
      </ThemeProvider>
    </MemoryRouter>
  )
}

describe('ATSCheckerPage form', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the checker heading with submit disabled', () => {
    renderPage()
    expect(screen.getByText('ATS Resume Score Checker')).toBeInTheDocument()
    expect(screen.getByText('Check ATS Score').closest('button')).toBeDisabled()
  })

  it('sample JD button fills the job description', () => {
    const { container } = renderPage()
    fireEvent.click(screen.getByText('Use sample JD'))
    const textarea = container.querySelector('textarea')
    expect(textarea.value.length).toBeGreaterThan(50)
  })

  it('rejects non-PDF uploads with an error', () => {
    const { container } = renderPage()
    const input = container.querySelector('input[type="file"]')
    const bad = new File(['hello'], 'resume.txt', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [bad] } })
    expect(screen.getByText('Please upload a PDF file')).toBeInTheDocument()
  })

  it('enables submit once a PDF and a job description are present', () => {
    const { container } = renderPage()
    const input = container.querySelector('input[type="file"]')
    const pdf = new File(['%PDF-1.4'], 'resume.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [pdf] } })
    fireEvent.click(screen.getByText('Use sample JD'))
    expect(screen.getByText('Check ATS Score').closest('button')).not.toBeDisabled()
  })
})
