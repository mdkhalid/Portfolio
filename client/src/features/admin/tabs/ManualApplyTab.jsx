import { RefreshCw, Loader2, Plus, ChevronLeft, ChevronRight, X, ExternalLink, CheckCircle2 } from 'lucide-react'

export default function ManualApplyTab({
  dark, manualJobs = { items: [], total: 0, page: 1, pages: 1 }, jobSites = [],
  filters, loading, addJobModal, addJobForm, addingJob, setAddJobForm,
  onFilterChange, onPageChange, onRefresh, onOpenAddModal, onCloseAddModal,
  onAddJob, onMarkApplied, onMarkPass,
}) {
  const { items, page, pages } = manualJobs
  const siteOptions = jobSites.filter(s => s.custom)
  return (
    <div className="space-y-4">
      <div className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-blue-50 border-blue-200')}>
        <p className="text-sm">
          These jobs need you to apply in the browser (the site has no auto-apply support or redirected to an external employer page).
          Open the job, complete the application, then mark it applied.
        </p>
      </div>

      {/* Filters + add job */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={filters.status} onChange={e => onFilterChange('status', e.target.value)}
          className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="not_applied">Not applied</option>
          <option value="pending">Pending</option>
        </select>
        <select value={filters.site} onChange={e => onFilterChange('site', e.target.value)}
          className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}>
          <option value="">All sites</option>
          {jobSites.map(s => <option key={s.name} value={s.name}>{s.label}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={onRefresh} disabled={loading}
          className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        <button onClick={onOpenAddModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:from-fuchsia-700 hover:to-pink-600 transition-all cursor-pointer">
          <Plus size={16} /> Add Job Manually
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : items.length === 0 ? (
        <div className={'p-8 text-center rounded-xl border ' + (dark ? 'bg-gray-900 border-gray-700 text-gray-400' : 'bg-gray-50 border-gray-200 text-gray-500')}>
          <p className="text-sm">Nothing needs manual application right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(job => (
            <div key={job._id} className={'p-4 rounded-xl border transition-all ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{job.title}</p>
                    <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (job.status === 'applied' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500')}>
                      {job.status}
                    </span>
                  </div>
                  <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                    {job.company}{job.location ? ' · ' + job.location : ''} · {job.site}
                  </p>
                  {job.manualApplyReason && (
                    <p className={'text-xs mt-1 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{job.manualApplyReason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {job.url && (
                    <a href={job.url} target="_blank" rel="noopener noreferrer"
                      className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border cursor-pointer transition-all ' + (dark ? 'border-gray-700 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
                      <ExternalLink size={14} /> Open & Apply
                    </a>
                  )}
                  <button onClick={() => onMarkApplied(job)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all cursor-pointer">
                    <CheckCircle2 size={14} /> Applied
                  </button>
                  <button onClick={() => onMarkPass(job)}
                    className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium cursor-pointer transition-all ' + (dark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                    <X size={14} /> Pass
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
            className={'p-2 rounded-xl cursor-pointer disabled:opacity-40 ' + (dark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200')}>
            <ChevronLeft size={16} />
          </button>
          <span className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{page} / {pages}</span>
          <button onClick={() => onPageChange(page + 1)} disabled={page >= pages}
            className={'p-2 rounded-xl cursor-pointer disabled:opacity-40 ' + (dark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200')}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Add job modal */}
      {addJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCloseAddModal}>
          <div className={'w-full max-w-md p-6 rounded-2xl border shadow-2xl ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Add Job Manually</h3>
              <button onClick={onCloseAddModal} className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700' : 'hover:bg-gray-200')}>
                <X size={18} />
              </button>
            </div>
            <p className={'text-sm mb-4 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
              Paste a job link from a custom site. It will appear here so you can apply in the browser and mark it done.
            </p>
            <div className="space-y-3">
              <div>
                <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Site</label>
                <select value={addJobForm.site} onChange={e => setAddJobForm(f => ({ ...f, site: e.target.value }))}
                  className={'w-full mt-1 px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}>
                  <option value="">Select site</option>
                  {siteOptions.map(s => <option key={s.name} value={s.name}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Job Title</label>
                <input type="text" value={addJobForm.title}
                  onChange={e => setAddJobForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Senior React Developer"
                  className={'w-full mt-1 px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')} />
              </div>
              <div>
                <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Company</label>
                <input type="text" value={addJobForm.company}
                  onChange={e => setAddJobForm(f => ({ ...f, company: e.target.value }))}
                  placeholder="Acme Corp"
                  className={'w-full mt-1 px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')} />
              </div>
              <div>
                <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Job URL</label>
                <input type="url" value={addJobForm.url}
                  onChange={e => setAddJobForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://example.com/jobs/123"
                  className={'w-full mt-1 px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')} />
              </div>
              <div>
                <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Location <span className="text-xs opacity-70">(optional)</span></label>
                <input type="text" value={addJobForm.location}
                  onChange={e => setAddJobForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Remote"
                  className={'w-full mt-1 px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={onCloseAddModal}
                className={'px-4 py-2 rounded-xl text-sm font-medium cursor-pointer ' + (dark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                Cancel
              </button>
              <button onClick={onAddJob} disabled={addingJob}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:from-fuchsia-700 hover:to-pink-600 transition-all disabled:opacity-50 cursor-pointer">
                {addingJob ? <Loader2 size={14} className="animate-spin" /> : null}
                Add Job
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
