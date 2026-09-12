import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EditModal from './EditModal'

function renderNewArticle() {
  const props = {
    API: {},
    dark: false,
    editing: { collection: 'articles', id: null, data: null },
    saveItem: vi.fn(),
    saving: false,
    setData: vi.fn(),
    setEditing: vi.fn(),
    setSaving: vi.fn(),
  }
  const utils = render(<EditModal {...props} />)
  return { ...utils, props }
}

describe('EditModal published toggle (Phase 1 regression)', () => {
  it('new articles start as Draft', () => {
    renderNewArticle()
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('toggle flips Draft -> Published -> Draft', () => {
    const { container } = renderNewArticle()
    const toggle = container.querySelector('button.relative')
    expect(toggle).toBeTruthy()
    // The field label reads "Published"; the status pill starts at Draft.
    expect(screen.queryByText('Draft')).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.queryByText('Draft')).toBeNull()
    expect(screen.getAllByText('Published').length).toBeGreaterThanOrEqual(2)
    fireEvent.click(toggle)
    expect(screen.queryByText('Draft')).toBeInTheDocument()
  })

  it('editing an existing published article shows Published', () => {
    render(
      <EditModal
        API={{}}
        dark={false}
        editing={{ collection: 'articles', id: 'abc', data: { title: 'Hello', published: true } }}
        saveItem={vi.fn()}
        saving={false}
        setData={vi.fn()}
        setEditing={vi.fn()}
        setSaving={vi.fn()}
      />
    )
    expect(screen.queryByText('Draft')).toBeNull()
    expect(screen.getAllByText('Published').length).toBeGreaterThanOrEqual(2)
  })
})
