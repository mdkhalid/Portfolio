import { Zap, Square, CheckSquare, FileText, Target, RefreshCw, Search, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Eye, Download, ExternalLink, X, AlertCircle, Clock, Loader2 } from 'lucide-react'

export default function JobAppsTab({
  dark, jobApps = { items: [], total: 0, page: 1, pages: 1 }, selectedJobs = new Set(),
  pipeline, pipelineBudget, budgetSaving, filters, matchingJobs, applying,
  aiLoading, aiResult, generatingResumeIds = new Set(), applyProgress = [], lastBatchId, jobDetail,
  setPipelineBudget, onTogglePipeline, onSavePipelineSettings,
  onSelectAll, onBulkAction, onAutoApply, onMatchSelected, onGenerateBulk,
  onRefresh, loading, onFilterChange, onPageChange, onSelectJob, onOpenDetail, onCloseDetail,
  onGenerateResume, onCoverLetter, onOptimizeResume, onPreviewResume, onDownloadResume, onClearProgress,
}) {
  const { items, page, pages } = jobApps
  const hasSelection = selectedJobs.size > 0
  const selectedItems = items.filter(item => selectedJobs.has(item._id))
  const applyableCount = selectedItems.filter(i => i.status !== 'applied').length
  const passableCount = selectedItems.filter(i => i.status !== 'applied' && i.status !== 'passed').length
  const matchableCount = selectedItems.filter(i => i.status !== 'applied' && !i.matchScore).length

  const getScoreColor = (score) => {
    if (score === null || score === undefined) return 'text-gray-400'
    if (score >= 80) return 'text-emerald-500'
    if (score >= 60) return 'text-blue-500'
    if (score >= 40) return 'text-amber-500'
    return 'text-red-500'
  }

  const getScoreBg = (score) => {
    if (score === null || score === undefined) return 'bg-gray-200 dark:bg-gray-700'
    if (score >= 80) return 'bg-emerald-500'
    if (score >= 60) return 'bg-blue-500'
    if (score >= 40) return 'bg-amber-500'
    return 'bg-red-500'
  }

  const formatDate = (date) => {
    if (!date) return 'Unknown'
    const d = new Date(date)
    const diff = Date.now() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days < 1) return 'Today'
    if (days === 1) return '1 day ago'
    if (days < 7) return `${days} days ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="space-y-4">
      {/* Pipeline status & controls */}
      {pipeline && (
        <div className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={'w-2.5 h-2.5 rounded-full ' + (pipeline.paused ? 'bg-red-500' : 'bg-emerald-500')} />
              <div>
                <p className="font-semibold text-sm">Apply Pipeline {pipeline.paused ? 'Paused' : 'Running'}</p>
                <p className={'text-xs ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                  AI usage: {pipeline.aiDailyUsage}/{pipeline.aiDailyBudget} today · {pipeline.aiWeeklyUsage}/{pipeline.aiWeeklyBudget} this week
                  {pipeline.maxApplyPerBatch ? ' · Max ' + pipeline.maxApplyPerBatch + '/batch' : ''}
                  {pipeline.applyRateDelayMs ? ' · ' + (pipeline.applyRateDelayMs / 1000) + 's between submits' : ''}
                  {pipeline.siteConcurrency ? ' · Concurrency ' + pipeline.siteConcurrency : ''}
                </p>
              </div>
            </div>
            <button onClick={onTogglePipeline} className={'px-3 py-1.5 rounded-xl text-sm font-medium text-white cursor-pointer transition-all ' + (pipeline.paused
              ? 'bg-emerald-500 hover:bg-emerald-600'
              : 'bg-red-500 hover:bg-red-600')}>
              {pipeline.paused ? 'Resume' : 'Pause'}
            </button>
          </div>
          <div className="mt-4 pt-3 border-t grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { key: 'aiDailyBudget', label: 'Daily AI budget' },
              { key: 'aiWeeklyBudget', label: 'Weekly AI budget' },
              { key: 'maxApplyPerBatch', label: 'Max apps / batch' },
              { key: 'applyRateDelayMs', label: 'Delay (ms) / submit' },
              { key: 'siteConcurrency', label: 'Site concurrency' },
            ].map(f => (
              <div key={f.key}>
                <label className={'text-xs font-medium ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{f.label}</label>
                <input type="number" value={pipelineBudget[f.key]}
                  onChange={e => setPipelineBudget(p => ({ ...p, [f.key]: e.target.value }))}
                  className={'w-full mt-1 px-2 py-1.5 rounded-lg border outline-none text-sm ' + (dark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')} />
              </div>
            ))}
          </div>

          {/* Notification settings */}
          <div className={'mt-4 pt-3 border-t flex flex-wrap items-center gap-x-8 gap-y-3 ' + (dark ? 'border-gray-700' : 'border-gray-200')}>
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={() => setPipelineBudget(p => ({ ...p, notifyEmail: !p.notifyEmail }))}
                className={'w-10 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ' + (pipelineBudget.notifyEmail ? 'bg-emerald-500' : (dark ? 'bg-gray-700' : 'bg-gray-300'))}>
                <span className={'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ' + (pipelineBudget.notifyEmail ? 'left-[18px]' : 'left-0.5')} />
              </button>
              <div>
                <p className="text-sm font-medium">Email notifications</p>
                <p className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>Alerts sent to your inbox via SMTP</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div>
                <p className="text-sm font-medium">Email digest</p>
                <p className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>Instant, daily summary, or off</p>
              </div>
              <select value={pipelineBudget.notifyDigest}
                onChange={e => setPipelineBudget(p => ({ ...p, notifyDigest: e.target.value }))}
                className={'px-2 py-1.5 rounded-lg border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}>
                <option value="instant">Instant</option>
                <option value="daily">Daily summary</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end mt-3">
            <button onClick={onSavePipelineSettings} disabled={budgetSaving}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50 cursor-pointer">
              {budgetSaving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onSelectAll} disabled={!items.length}
          className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
          {hasSelection && selectedJobs.size === items.length ? <CheckSquare size={16} /> : <Square size={16} />}
          {hasSelection && selectedJobs.size === items.length ? 'Deselect All' : 'Select All'}
        </button>
        {hasSelection && (
          <>
            <button onClick={() => onBulkAction('apply')} disabled={matchingJobs || applying || !applyableCount}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <Zap size={16} /> Mark Applied ({applyableCount})
            </button>
            <button onClick={onAutoApply} disabled={matchingJobs || applying || !applyableCount}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {applying ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              {applying ? 'Queuing...' : `Auto Apply (${applyableCount})`}
            </button>
            <button onClick={() => onBulkAction('pass')} disabled={matchingJobs || applying || !passableCount}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              Pass ({passableCount})
            </button>
            <button onClick={onMatchSelected} disabled={matchingJobs || applying || !matchableCount}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {matchingJobs ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
              {matchingJobs ? 'Matching...' : `Match (${matchableCount})`}
            </button>
            <button onClick={onGenerateBulk} disabled={generatingResumeIds.size > 0}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:from-fuchsia-700 hover:to-pink-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {generatingResumeIds.size > 0 ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {generatingResumeIds.size > 0 ? `Generating (${generatingResumeIds.size})...` : `Generate Resumes (${selectedItems.length})`}
            </button>
          </>
        )}
        <div className="flex-1" />
        <button onClick={onRefresh} disabled={loading}
          className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Location switch: pipeline vs applied archive */}
      <div className={'inline-flex rounded-xl border p-1 ' + (dark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50')}>
        {[
          { key: '', label: 'Pipeline', icon: Zap },
          { key: 'applied', label: 'Applied', icon: CheckCircle2 },
          { key: 'passed', label: 'Passed', icon: XCircle },
        ].map(seg => {
          const active = (filters.status === seg.key) || (seg.key === '' && !['applied', 'passed', 'all', 'new', 'pending', 'not_applied', 'expired'].includes(filters.status))
          const Icon = seg.icon
          return (
            <button key={seg.label} onClick={() => onFilterChange('status', seg.key)}
              className={'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ' + (
                active
                  ? (seg.key === 'applied'
                    ? 'bg-emerald-500 text-white'
                    : seg.key === 'passed'
                      ? 'bg-gray-500 text-white'
                      : 'bg-blue-600 text-white')
                  : (dark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')
              )}>
              <Icon size={14} /> {seg.label}
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className={'absolute left-3 top-1/2 -translate-y-1/2 ' + (dark ? 'text-gray-500' : 'text-gray-400')} />
          <input type="text" value={filters.q} onChange={e => onFilterChange('q', e.target.value)}
            placeholder="Search title or company..."
            className={'w-full pl-9 pr-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400')} />
        </div>
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
          <option value="">Actionable (New/Pending/Not Applied)</option>
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="pending">Pending</option>
          <option value="applied">Applied</option>
          <option value="passed">Passed</option>
          <option value="not_applied">Not Applied</option>
          <option value="expired">Expired</option>
        </select>
        <select value={filters.age} onChange={e => onFilterChange('age', e.target.value)}
          className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700')}>
          <option value="">Any Time</option>
          <option value="24h">Last 24h</option>
          <option value="3d">Last 3 days</option>
          <option value="7d">Last week</option>
          <option value="14d">Last 2 weeks</option>
        </select>
        <select value={filters.minScore} onChange={e => onFilterChange('minScore', e.target.value)}
          className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700')}>
          <option value="">Any Score</option>
          <option value="80">≥ 80%</option>
          <option value="60">≥ 60%</option>
          <option value="40">≥ 40%</option>
        </select>
      </div>

      {/* Job tiles */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <p className={'text-sm ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No jobs found. Fetch jobs from the Job Sites tab first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map(job => (
            <div key={job._id}
              className={'p-4 rounded-xl border transition-all cursor-pointer ' + (
                job.status === 'applied'
                  ? 'bg-emerald-500/5 border-emerald-500/40 hover:border-emerald-500/70'
                  : selectedJobs.has(job._id)
                    ? (dark ? 'bg-blue-500/10 border-blue-500/40' : 'bg-blue-50 border-blue-300')
                    : (dark ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300')
              )}
              onClick={() => onOpenDetail(job)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); onSelectJob(job._id) }}
                      className={'p-1 rounded cursor-pointer ' + (dark ? 'text-gray-400 hover:text-blue-400' : 'text-gray-400 hover:text-blue-600')}>
                      {selectedJobs.has(job._id) ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
                    </button>
                    <p className="font-semibold truncate">{job.title}</p>
                  </div>
                  <p className={'text-sm mt-1 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{job.company} {job.location ? '· ' + job.location : ''}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (
                      job.site === 'naukri' ? (dark ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-700')
                        : job.site === 'indeed' ? (dark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700')
                        : job.site === 'workatastartup' ? (dark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-700')
                        : job.site === 'foundit' ? (dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-700')
                        : (dark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-700')
                    )}>{job.site}</span>
                    <span className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{formatDate(job.postedDate)}</span>
                    {job.status === 'applied' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                        Applied{job.appliedAt ? ' · ' + formatDate(job.appliedAt) : ''}
                      </span>
                    )}
                    {job.status === 'passed' && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 font-medium">Passed</span>}
                    {job.resumeId && <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-medium">Resume</span>}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={'w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ' + getScoreBg(job.matchScore) + ' text-white'}>
                    {job.matchScore !== null && job.matchScore !== undefined ? job.matchScore : '?'}
                  </div>
                  <span className={'text-xs ' + getScoreColor(job.matchScore)}>
                    {job.matchScore !== null && job.matchScore !== undefined ? '% match' : 'unmatched'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
            className={'p-2 rounded-xl cursor-pointer disabled:opacity-40 ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            <ChevronLeft size={18} />
          </button>
          <span className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>Page {page} of {pages}</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= pages}
            className={'p-2 rounded-xl cursor-pointer disabled:opacity-40 ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Live Apply Progress Panel */}
      {applyProgress.length > 0 && (
        <div className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Zap size={16} className="text-violet-500" /> Auto-Apply Pipeline
            </h3>
            <div className="flex items-center gap-2">
              {lastBatchId && (
                <button onClick={onClearProgress}
                  className={'text-xs px-2 py-1 rounded-lg cursor-pointer ' + (dark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  Clear
                </button>
              )}
              <span className={'text-xs ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                {applyProgress.filter(p => p.status === 'applied').length}/{applyProgress.length} applied
              </span>
            </div>
          </div>
          <div className="space-y-2">
            {applyProgress.map((app, i) => (
              <div key={app.applicationId || i} className={'rounded-xl p-3 ' + (dark ? 'bg-gray-900' : 'bg-gray-50')}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{app.jobTitle || app.lastAction || app.applicationId}</span>
                  <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + (
                    app.status === 'applied' ? 'bg-emerald-500/10 text-emerald-500'
                      : app.status === 'failed' ? 'bg-red-500/10 text-red-500'
                      : app.status === 'canceled' ? 'bg-gray-500/10 text-gray-500'
                      : app.status === 'not_applied' ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-blue-500/10 text-blue-500'
                  )}>{app.status}</span>
                </div>
                <div className="space-y-1">
                  {(app.steps || []).map((step, si) => (
                    <div key={si} className="flex items-center gap-2 text-xs">
                      {step.status === 'done' ? <CheckCircle2 size={14} className="text-emerald-500" />
                        : step.status === 'running' ? <Loader2 size={14} className="animate-spin text-blue-500" />
                        : step.status === 'failed' ? <AlertCircle size={14} className="text-red-500" />
                        : step.status === 'waiting_user' ? <AlertCircle size={14} className="text-amber-500" />
                        : <Clock size={14} className={dark ? 'text-gray-600' : 'text-gray-400'} />}
                      <span className={step.status === 'failed' ? 'text-red-400' : step.status === 'waiting_user' ? 'text-amber-500 font-medium' : (dark ? 'text-gray-300' : 'text-gray-600')}>{step.label || step.key}</span>
                      {step.status === 'waiting_user' && <span className="text-amber-500 ml-auto text-xs font-medium">Needs your attention</span>}
                      {step.error && step.status !== 'waiting_user' && <span className="text-red-400 ml-auto">{step.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job Detail Side Panel */}
      {jobDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50" onClick={onCloseDetail}>
          <div className={'w-full max-w-lg h-full overflow-y-auto p-6 border-l ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Job Details</h3>
              <button onClick={onCloseDetail} className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700' : 'hover:bg-gray-200')}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-lg">{jobDetail.title}</p>
                <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                  {jobDetail.company} {jobDetail.location ? '· ' + jobDetail.location : ''}
                </p>
                <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                  {jobDetail.salary && 'Salary: ' + jobDetail.salary + ' · '}
                  Posted: {formatDate(jobDetail.postedDate)} · {jobDetail.site}
                </p>
              </div>

              {/* Match Score */}
              <div className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                <div className="flex items-center gap-3">
                  <div className={'w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ' + getScoreBg(jobDetail.matchScore) + ' text-white'}>
                    {jobDetail.matchScore !== null && jobDetail.matchScore !== undefined ? jobDetail.matchScore : '?'}
                  </div>
                  <div>
                    <p className="font-semibold">Match Score</p>
                    <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                      {jobDetail.reasoning || (jobDetail.matchScore ? `${jobDetail.matchScore}% match with your profile` : 'Not matched yet')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Matched Keywords */}
              {jobDetail.matchedKeywords?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2 text-emerald-500">✓ Matched Keywords</p>
                  <div className="flex flex-wrap gap-1">
                    {jobDetail.matchedKeywords.map((kw, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Keywords */}
              {jobDetail.missingKeywords?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2 text-red-500">✗ Missing Keywords</p>
                  <div className="flex flex-wrap gap-1">
                    {jobDetail.missingKeywords.map((kw, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-500">{kw}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Job Description */}
              {jobDetail.description && (
                <div>
                  <p className="text-sm font-semibold mb-2">Job Description</p>
                  <div className={'text-sm whitespace-pre-wrap max-h-64 overflow-y-auto p-3 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700')}>
                    {jobDetail.description}
                  </div>
                </div>
              )}

              {/* AI Tools */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onGenerateResume(jobDetail)} disabled={aiLoading || generatingResumeIds.has(jobDetail._id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:from-fuchsia-700 hover:to-pink-600 transition-all disabled:opacity-50 cursor-pointer">
                    {generatingResumeIds.has(jobDetail._id) ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                    {generatingResumeIds.has(jobDetail._id) ? 'Generating...' : (jobDetail.resumeId ? 'Regenerate Resume' : 'Generate Resume')}
                  </button>
                  <button onClick={() => onCoverLetter(jobDetail)} disabled={aiLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 cursor-pointer">
                    {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                    Cover Letter
                  </button>
                  <button onClick={() => onOptimizeResume(jobDetail)} disabled={aiLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600 transition-all disabled:opacity-50 cursor-pointer">
                    {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
                    Optimize Resume
                  </button>
                </div>
                {jobDetail.resumeId && (
                  <div className="flex gap-2">
                    <button onClick={() => onPreviewResume(jobDetail.resumeId)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all cursor-pointer">
                      <Eye size={16} /> View Attached Resume
                    </button>
                    <button onClick={() => onDownloadResume(jobDetail.resumeId, jobDetail.resumeFilename)}
                      title="Download"
                      className={'flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100')}>
                      <Download size={16} />
                    </button>
                  </div>
                )}
                {aiResult && (
                  <div className={'p-3 rounded-xl border text-sm whitespace-pre-wrap max-h-64 overflow-y-auto ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700')}>
                    {aiResult}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {jobDetail.status !== 'applied' && (
                  <button onClick={() => { onBulkAction('apply', jobDetail); onCloseDetail() }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all cursor-pointer">
                    <Zap size={16} /> Mark Applied
                  </button>
                )}
                {jobDetail.status !== 'passed' && (
                  <button onClick={() => { onBulkAction('pass', jobDetail); onCloseDetail() }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-all cursor-pointer">
                    Pass
                  </button>
                )}
                {jobDetail.url && (
                  <a href={jobDetail.url} target="_blank" rel="noopener noreferrer"
                    className={'flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border cursor-pointer transition-all ' + (dark ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                    <ExternalLink size={16} /> Open & Apply
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
