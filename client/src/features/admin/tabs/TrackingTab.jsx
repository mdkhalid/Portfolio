import { RefreshCw, Loader2, ChevronLeft, ChevronRight, X, RotateCcw, AlertCircle, Zap, ExternalLink, ListTodo, History, CheckCircle2 } from 'lucide-react'

export default function TrackingTab({
  dark, tracking = { items: [], total: 0, page: 1, pages: 1 }, filters,
  loading, detail, onFilterChange, onPageChange, onRefresh,
  onSelectDetail, onCloseDetail, onRetry, onAnswerDraft, onSubmitAnswers,
}) {
  const { items, total, page, pages } = tracking

  const trackingBadge = (status) => {
    const map = {
      applied: 'bg-emerald-500/10 text-emerald-500',
      pending: 'bg-amber-500/10 text-amber-500',
      failed: 'bg-red-500/10 text-red-500',
      passed: 'bg-gray-500/10 text-gray-500',
      not_applied: 'bg-blue-500/10 text-blue-500',
      canceled: 'bg-gray-500/10 text-gray-500',
      queued: 'bg-violet-500/10 text-violet-500',
      running: 'bg-cyan-500/10 text-cyan-500',
    }
    return map[status] || (dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600')
  }

  const notAppliedReasonLabel = (reason) => {
    const map = {
      job_expired: 'Job expired',
      login_failed: 'Login failed',
      site_error: 'Site error',
      missing_info: 'Missing info',
      location_mismatch: 'Location mismatch',
      salary_mismatch: 'Salary mismatch',
      blocked_or_captcha: 'Blocked / CAPTCHA',
      manual_skip: 'Manually skipped',
      other: 'Other',
    }
    return map[reason] || reason || 'Not applied'
  }

  const isRetryable = (app) => ['failed', 'not_applied', 'canceled'].includes(app.status) && app.notAppliedReason !== 'job_expired'

  const formatDate = (date) => {
    if (!date) return 'Unknown'
    const d = new Date(date)
    // Display-only relative date; Date.now() drift between renders is harmless.
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days < 1) return 'Today'
    if (days === 1) return '1 day ago'
    if (days < 7) return `${days} days ago`
    return d.toLocaleDateString()
  }

  const formatDateTime = (date) => {
    if (!date) return ''
    const d = new Date(date)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={filters.site} onChange={e => onFilterChange('site', e.target.value)}
          className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700')}>
          <option value="">All Sites</option>
          <option value="naukri">Naukri</option>
          <option value="indeed">Indeed</option>
          <option value="workatastartup">Work at a Startup</option>
          <option value="wellfound">Wellfound</option>
          <option value="foundit">foundit (Monster)</option>
          <option value="linkedin">LinkedIn</option>
        </select>
        <select value={filters.status} onChange={e => onFilterChange('status', e.target.value)}
          className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700')}>
          <option value="">All Status</option>
          <option value="queued">Queued</option>
          <option value="running">Running</option>
          <option value="applied">Applied</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="not_applied">Not Applied</option>
          <option value="passed">Passed</option>
          <option value="canceled">Canceled</option>
        </select>
        <select value={filters.via} onChange={e => onFilterChange('via', e.target.value)}
          className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700')}>
          <option value="">Any Source</option>
          <option value="system">System (Auto-Apply)</option>
          <option value="imported">Imported</option>
          <option value="manual_mark">Manual · Marked</option>
          <option value="manual_browser">Manual · In Browser</option>
          <option value="manual">Manual (Legacy)</option>
        </select>
        <div className="flex-1" />
        <button onClick={onRefresh} disabled={loading}
          className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Application cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className={'text-sm ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No applications yet. Apply to jobs (Auto Apply or Mark Applied) to track them here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map(app => {
            const job = app.jobId || {}
            return (
              <div key={app._id}
                className={'p-4 rounded-xl border transition-all cursor-pointer hover:border-gray-400 ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
                onClick={() => onSelectDetail(app)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{job.title || 'Untitled'}</p>
                    <p className={'text-sm mt-0.5 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                      {job.company || 'Unknown'} {app.site ? '· ' + app.site : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + trackingBadge(app.status)}>{app.status}</span>
                      {app.needsManualApply && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-500 font-medium">Manual apply</span>
                      )}
                      {app.status === 'not_applied' && app.notAppliedReason && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">{notAppliedReasonLabel(app.notAppliedReason)}</span>
                      )}
                      {app.status === 'pending' && (app.waitingFields?.length || 0) > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-medium">Needs your attention</span>
                      )}
                      {app.appliedVia && <span className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>via {app.appliedVia}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {app.appliedAt && (
                      <span className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{formatDate(app.appliedAt)}</span>
                    )}
                    {isRetryable(app) && (
                      <button onClick={e => { e.stopPropagation(); onRetry(app) }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 transition-all cursor-pointer">
                        <RotateCcw size={12} /> Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
            className={'p-2 rounded-xl cursor-pointer disabled:opacity-40 ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            <ChevronLeft size={18} />
          </button>
          <span className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>Page {page} of {pages} · {total} total</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= pages}
            className={'p-2 rounded-xl cursor-pointer disabled:opacity-40 ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Detail side panel */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50" onClick={onCloseDetail}>
          <div className={'w-full max-w-lg h-full overflow-y-auto p-6 border-l ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Application Details</h3>
              <button onClick={onCloseDetail} className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700' : 'hover:bg-gray-200')}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-lg">{detail.jobId?.title || 'Untitled'}</p>
                <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                  {detail.jobId?.company} {detail.jobId?.location ? '· ' + detail.jobId.location : ''}
                </p>
                <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                  {detail.site} · applied {detail.appliedAt ? formatDateTime(detail.appliedAt) : 'N/A'}
                  {detail.appliedVia ? ' · via ' + detail.appliedVia : ''}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + trackingBadge(detail.status)}>{detail.status}</span>
                  {detail.status === 'not_applied' && detail.notAppliedReason && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">{notAppliedReasonLabel(detail.notAppliedReason)}</span>
                  )}
                </div>
              </div>

              {detail.lastAction && (
                <div className={'p-3 rounded-xl border text-sm ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700')}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Last Action</p>
                  {detail.lastAction}
                </div>
              )}

              {/* Needs your attention — fill the unresolved fields */}
              {detail.status === 'pending' && (detail.waitingFields?.length || 0) > 0 && (
                <div className={'p-4 rounded-xl border border-amber-500/40 ' + (dark ? 'bg-amber-500/10' : 'bg-amber-50')}>
                  <p className="text-sm font-semibold text-amber-500 mb-1 flex items-center gap-2">
                    <AlertCircle size={16} /> Needs your attention
                  </p>
                  <p className={'text-xs mb-3 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                    These fields couldn't be auto-filled. Provide values once — they're saved and reused on future applications automatically.
                  </p>
                  <div className="space-y-3">
                    {detail.waitingFields.map(f => (
                      <div key={f.key}>
                        <label className={'text-sm font-medium block mb-1 ' + (dark ? 'text-gray-300' : 'text-gray-700')}>{f.label || f.key}</label>
                        {f.type === 'select' && f.options?.length > 0 ? (
                          <select
                            defaultValue={f.value || ''}
                            onChange={e => onAnswerDraft(f.key, e.target.value)}
                            className={'w-full px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900')}>
                            <option value="">Select...</option>
                            {f.options.map((o, oi) => <option key={oi} value={o}>{o}</option>)}
                          </select>
                        ) : f.type === 'textarea' ? (
                          <textarea
                            rows={3}
                            defaultValue={f.value || f.suggestion || ''}
                            onChange={e => onAnswerDraft(f.key, e.target.value)}
                            placeholder={f.suggestion || `Enter ${f.label || f.key}`}
                            className={'w-full px-3 py-2 rounded-xl border outline-none text-sm resize-y ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400')} />
                        ) : (
                          <input
                            type="text"
                            defaultValue={f.value || f.suggestion || ''}
                            onChange={e => onAnswerDraft(f.key, e.target.value)}
                            placeholder={f.suggestion || `Enter ${f.label || f.key}`}
                            className={'w-full px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400')} />
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={() => onSubmitAnswers(detail)}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-all cursor-pointer">
                    <Zap size={16} /> Save & Auto-Apply
                  </button>
                </div>
              )}

              {detail.jobId?.url && (
                <a href={detail.jobId.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all cursor-pointer">
                  <ExternalLink size={16} /> Open Job Posting
                </a>
              )}

              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <ListTodo size={16} className="text-violet-500" /> Pipeline Steps
                </p>
                {(detail.progress?.steps || []).length === 0 ? (
                  <p className={'text-sm ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No steps recorded yet.</p>
                ) : (
                  <div className="space-y-0">
                    {detail.progress.steps.map((step, i, arr) => {
                      const isRunning = step.status === 'running';
                      const isDone = step.status === 'done';
                      const isFailed = step.status === 'failed';
                      const isWaiting = step.status === 'waiting';
                      const dotColor = isDone ? 'bg-emerald-500'
                        : isRunning ? 'bg-blue-500'
                        : isFailed ? 'bg-red-500'
                        : isWaiting ? 'bg-amber-500'
                        : (dark ? 'bg-gray-600' : 'bg-gray-300');
                      return (
                        <div key={step.key || i} className={'flex gap-3 rounded-lg px-2 -mx-2 ' + (isRunning ? (dark ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : 'bg-blue-50 ring-1 ring-blue-200') : '')}>
                          <div className="flex flex-col items-center">
                            <div className={'mt-1.5 rounded-full ' + (isRunning ? 'w-3.5 h-3.5 bg-blue-500 animate-pulse shadow-lg shadow-blue-500/50' : 'w-2.5 h-2.5 ' + dotColor)} />
                            {i < arr.length - 1 && (
                              <div className={'flex-1 relative ' + (isRunning ? 'w-1' : 'w-px')}>
                                <div className={'absolute inset-0 rounded-full ' + (isRunning
                                  ? 'bg-gradient-to-b from-blue-500 to-blue-500/20 animate-pulse'
                                  : (dark ? 'bg-gray-700' : 'bg-gray-200')
                                )} />
                              </div>
                            )}
                          </div>
                          <div className={'pb-4 ' + (isRunning ? 'pt-0.5' : '')}>
                            <div className="flex items-center gap-2">
                              <p className={'text-sm ' + (isRunning ? 'font-bold text-blue-500' : isDone ? 'font-medium' : isFailed ? 'font-medium text-red-500' : isWaiting ? 'font-medium text-amber-500' : 'font-medium')}>{step.label || step.key}</p>
                              {isRunning && (
                                <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-blue-500">
                                  <Loader2 size={10} className="animate-spin" /> Running
                                </span>
                              )}
                              {isDone && <CheckCircle2 size={14} className="text-emerald-500" />}
                              {isFailed && <AlertCircle size={14} className="text-red-500" />}
                              {isWaiting && <AlertCircle size={14} className="text-amber-500" />}
                            </div>
                            {step.startedAt && (
                              <p className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>
                                {formatDateTime(step.startedAt)}{step.finishedAt ? ' → ' + formatDateTime(step.finishedAt) : ''}
                              </p>
                            )}
                            {step.error && <p className="text-xs text-red-400 mt-0.5">{step.error}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <History size={16} className="text-blue-500" /> Timeline
                </p>
                {(detail.timeline || []).length === 0 ? (
                  <p className={'text-sm ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No timeline events yet.</p>
                ) : (
                  <div className="space-y-0">
                    {[...(detail.timeline || [])].reverse().map((ev, i, arr) => {
                      const evText = (ev.event || '').toLowerCase();
                      const dotColor = evText.endsWith('(running)') ? 'bg-blue-500'
                        : evText.endsWith('(failed)') ? 'bg-red-500'
                        : evText.endsWith('(waiting_user)') || evText.endsWith('(waiting)') ? 'bg-amber-500'
                        : evText.includes('queued') ? (dark ? 'bg-gray-600' : 'bg-gray-300')
                        : evText.includes('(skipped)') ? (dark ? 'bg-gray-600' : 'bg-gray-300')
                        : 'bg-emerald-500';
                      return (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={'w-2.5 h-2.5 rounded-full mt-1.5 ' + dotColor} />
                          {i < arr.length - 1 && <div className={'w-px flex-1 ' + (dark ? 'bg-gray-700' : 'bg-gray-200')} />}
                        </div>
                        <div className="pb-4">
                          <p className="text-sm font-medium">{ev.event}</p>
                          <p className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>
                            {ev.timestamp ? formatDateTime(ev.timestamp) : ''}
                          </p>
                          {ev.details && <p className={'text-xs mt-0.5 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{ev.details}</p>}
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {isRetryable(detail) && (
                  <button onClick={() => onRetry(detail)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition-all cursor-pointer">
                    <RotateCcw size={16} /> Retry Application
                  </button>
                )}
                {detail.jobId?.url && (
                  <a href={detail.jobId.url} target="_blank" rel="noopener noreferrer"
                    className={'flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border cursor-pointer transition-all ' + (dark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                    <ExternalLink size={16} /> Open
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
