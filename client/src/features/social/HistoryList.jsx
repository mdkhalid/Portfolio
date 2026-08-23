import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, Globe, AtSign, ImageOff, Inbox } from 'lucide-react'
import { getApiErrorMessage } from '../../lib/api'

const PAGE_SIZE = 12
const STATUS_FILTERS = ['all', 'ready', 'failed', 'draft', 'generating']

function statusBadge(status) {
  if (status === 'ready') return 'bg-emerald-500/10 text-emerald-500'
  if (status === 'failed') return 'bg-red-500/10 text-red-500'
  if (status === 'generating') return 'bg-blue-500/10 text-blue-500'
  return 'bg-gray-500/10 text-gray-400'
}

export default function HistoryList({ API, dark, showToast, refreshKey, onOpen }) {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const cardBg = dark ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200'
  const muted = dark ? 'text-gray-400' : 'text-gray-500'

  const fetchPage = useCallback(async (p, filter) => {
    setLoading(true)
    try {
      const params = { page: p, limit: PAGE_SIZE }
      if (filter !== 'all') params.status = filter
      const { data } = await API.get('/api/social/posts', { params })
      setItems(data.items || [])
      setPage(data.page || p)
      setPages(data.pages || 1)
      setTotal(data.total || 0)
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err, 'Could not load history.') })
    } finally {
      setLoading(false)
    }
  }, [API, showToast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPage(page, statusFilter)
  }, [page, statusFilter, refreshKey, fetchPage])

  const changeFilter = (f) => {
    setStatusFilter(f)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => changeFilter(f)}
              className={'px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-colors cursor-pointer ' +
                (statusFilter === f
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white'
                  : (dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'))}
            >
              {f}
            </button>
          ))}
        </div>
        <p className={'text-xs ' + muted}>{total} post{total === 1 ? '' : 's'}</p>
      </div>

      {/* list */}
      {loading ? (
        <div className={'rounded-2xl border p-10 flex items-center justify-center ' + cardBg}>
          <Loader2 size={20} className="animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className={'rounded-2xl border p-10 text-center space-y-2 ' + cardBg}>
          <Inbox size={24} className="mx-auto opacity-40" />
          <p className={'text-sm ' + muted}>No posts yet. Create your first one on the Create tab.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <button
              key={item._id}
              onClick={() => onOpen(item._id)}
              className={'text-left rounded-2xl border overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg cursor-pointer group ' + cardBg}
            >
              <div className="h-28 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 relative">
                {item.imagePath ? (
                  <img src={item.imagePath} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <ImageOff size={18} className="absolute inset-0 m-auto opacity-30" />
                )}
                <span className={'absolute top-2 left-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ' + statusBadge(item.status)}>
                  {item.status}
                </span>
              </div>
              <div className="p-3 space-y-1.5">
                <p className="text-sm font-medium line-clamp-1">{item.title || item.content?.hook || item.topicNotes?.slice(0, 60) || 'Untitled post'}</p>
                <div className="flex items-center justify-between">
                  <div className={'flex items-center gap-2 text-xs ' + muted}>
                    {(item.linkedinCount || 0) > 0 && (
                      <span className="inline-flex items-center gap-1"><Globe size={11} /> {item.linkedinCount}</span>
                    )}
                    {(item.xCount || 0) > 0 && (
                      <span className="inline-flex items-center gap-1"><AtSign size={11} /> {item.xCount}</span>
                    )}
                    {!item.linkedinCount && !item.xCount && <span>Not published</span>}
                  </div>
                  <span className={'text-[10px] ' + muted}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ' +
              (dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className={'text-xs ' + muted}>Page {page} of {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className={'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ' +
              (dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
      {!loading && items.length > 0 && (
        <button
          onClick={() => fetchPage(page, statusFilter)}
          className={'w-full py-2 rounded-xl text-xs font-medium cursor-pointer inline-flex items-center justify-center gap-1.5 ' +
            (dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}
        >
          <RefreshCw size={12} /> Refresh list
        </button>
      )}
    </div>
  )
}
