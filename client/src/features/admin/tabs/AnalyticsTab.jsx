import { Clock, Mail, Download, Eye, PhoneCall } from 'lucide-react'

export default function AnalyticsTab({ analytics, activities = [], activitiesLoading, dark, now, onRefresh }) {
  const formatTimeAgo = (date) => {
    const diff = now - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return mins + 'm ago'
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return hrs + 'h ago'
    const days = Math.floor(hrs / 24)
    if (days < 7) return days + 'd ago'
    return new Date(date).toLocaleDateString()
  }

  const activityIcon = (type) => {
    switch (type) {
      case 'message': return <Mail size={16} className="text-blue-500" />
      case 'resume_download': return <Download size={16} className="text-emerald-500" />
      case 'page_view': return <Eye size={16} className="text-purple-500" />
      case 'lead': return <PhoneCall size={16} className="text-emerald-500" />
      default: return <Clock size={16} className="text-gray-400" />
    }
  }

  return (
    <div className="space-y-8">
      {/* Stats section */}
      {analytics && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className={'p-6 rounded-xl border text-center ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">{analytics.total}</div>
              <p className={'text-sm mt-1 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>Total Page Views</p>
            </div>
            <div className={'p-6 rounded-xl border text-center ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
              <div className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">{analytics.unique}</div>
              <p className={'text-sm mt-1 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>Unique Visitors</p>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-gray-400">Last 7 Days</h3>
            {(() => {
              const records = analytics.records || []
              const last7 = records.slice(0, 7).reverse() || []
              const maxViews = Math.max(...last7.map(r => r.pageViews), 1)
              return (
                <div className="flex items-end gap-2 h-32">
                  {last7.map(r => (
                    <div key={r.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className={'w-full rounded-lg transition-all hover:opacity-80'} style={{ height: Math.max(4, (r.pageViews / maxViews) * 100) + '%', background: 'linear-gradient(to top, #3b82f6, #06b6d4)' }} />
                      <span className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{r.date.slice(5)}</span>
                      <span className={'text-xs font-medium ' + (dark ? 'text-gray-300' : 'text-gray-600')}>{r.pageViews}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </>
      )}

      {/* Activity Feed */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-gray-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Recent Activity</h3>
          </div>
          <button onClick={onRefresh} disabled={activitiesLoading}
            className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ' + (
              dark ? 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            )}>
            <svg className={'w-3.5 h-3.5 ' + (activitiesLoading ? 'animate-spin' : '')} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>
        {activities.length === 0 ? (
          <p className={'text-sm ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No activity yet. Activities appear when visitors send messages or download resumes.</p>
        ) : (
          <div className="space-y-1">
            {activities.map((a, i) => (
              <div key={a._id || i}
                className={'flex items-start gap-3 px-4 py-3 rounded-xl transition-all ' + (dark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50')}>
                <div className={'p-2 rounded-lg flex-shrink-0 ' + (dark ? 'bg-gray-800' : 'bg-gray-100')}>
                  {activityIcon(a.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={'text-sm font-medium truncate ' + (dark ? 'text-gray-200' : 'text-gray-700')}>{a.description}</p>
                  <p className={'text-xs mt-0.5 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{formatTimeAgo(a.createdAt)}</p>
                </div>
                {(a.type === 'message' && a.metadata?.name) && (
                  <span className={'text-xs px-2 py-0.5 rounded-full flex-shrink-0 ' + (dark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600')}>
                    {a.metadata.name}
                  </span>
                )}
                {(a.type === 'lead' && a.metadata?.phone) && (
                  <span className={'text-xs px-2 py-0.5 rounded-full flex-shrink-0 ' + (dark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600')}>
                    {a.metadata.phone}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
