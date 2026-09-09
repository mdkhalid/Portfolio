import { Globe, CheckCircle2, RefreshCw, Loader2, Plus, Download, LogIn, X, Edit3, Trash2, Eye, EyeOff, AlertCircle, Clock } from 'lucide-react'

export default function JobsTab({
  dark, now, jobSites = [], loading, fetching, fetchResult,
  loginAllInProgress, loginAllResult, credsModal, credsForm, cookiesForm,
  showCredsPassword, credsSaving, testingSite, browserLoginSites,
  passwordModal, passwordForm, passwordSaving, addSiteModal, addSiteForm, addingSite,
  setCredsModal, setCredsForm, setCookiesForm, setShowCredsPassword,
  setPasswordModal, setPasswordForm, setAddSiteModal, setAddSiteForm, setLoginAllResult,
  onRefresh, onFetchJobs, onLoginAll, onToggleSite, onTestSite, onBrowserLogin,
  onRemoveSite, onSaveCreds, onChangePassword, onAddCustomSite,
}) {
  const connectedCount = jobSites.filter(s => s.status === 'connected').length
  const enabledCount = jobSites.filter(s => s.enabled).length

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

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={'flex items-center gap-2 px-3 py-2 rounded-xl border ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
          <Globe size={16} className="text-blue-500" />
          <span className="text-sm font-medium">{enabledCount}/{jobSites.length} enabled</span>
        </div>
        <div className={'flex items-center gap-2 px-3 py-2 rounded-xl border ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span className="text-sm font-medium">{connectedCount} connected</span>
        </div>
        <div className="flex-1" />
        <button onClick={onRefresh} disabled={loading}
          className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
        <button onClick={() => { setAddSiteModal(true); setAddSiteForm({ label: '', baseUrl: '' }) }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:from-fuchsia-700 hover:to-pink-600 transition-all cursor-pointer">
          <Plus size={16} /> Add Site
        </button>
        <button onClick={onFetchJobs} disabled={fetching || enabledCount === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50 cursor-pointer">
          {fetching ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {fetching ? 'Fetching...' : 'Fetch Jobs'}
        </button>
        <button onClick={onLoginAll} disabled={loginAllInProgress || !jobSites.some(s => s.credentials?.email || s.hasCookies)}
          title="Try to connect every configured site at once using each site's own stored credentials / session cookie"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 transition-all disabled:opacity-50 cursor-pointer">
          {loginAllInProgress ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {loginAllInProgress ? 'Logging in…' : 'Login All'}
        </button>
      </div>

      {/* Fetch result */}
      {fetchResult && (
        <div className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-blue-50 border-blue-200')}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-blue-500" />
            <span className="text-sm font-semibold">Last Fetch Result</span>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-lg font-bold">{fetchResult.total}</div>
              <div className={'text-xs ' + (dark ? 'text-gray-400' : 'text-gray-500')}>Found</div>
            </div>
            <div>
              <div className="text-lg font-bold text-emerald-500">{fetchResult.created}</div>
              <div className={'text-xs ' + (dark ? 'text-gray-400' : 'text-gray-500')}>New</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-500">{fetchResult.updated}</div>
              <div className={'text-xs ' + (dark ? 'text-gray-400' : 'text-gray-500')}>Updated</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-500">{fetchResult.errors?.length || 0}</div>
              <div className={'text-xs ' + (dark ? 'text-gray-400' : 'text-gray-500')}>Errors</div>
            </div>
          </div>
          {fetchResult.errors?.length > 0 && (
            <div className={'mt-3 pt-3 border-t ' + (dark ? 'border-gray-700' : 'border-blue-200')}>
              {fetchResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400">{e.site}: {e.error}</p>
              ))}
            </div>
          )}
          {fetchResult.manualOnly?.length > 0 && (
            <div className={'mt-3 pt-3 border-t ' + (dark ? 'border-gray-700' : 'border-blue-200')}>
              <p className="text-xs text-fuchsia-500">
                Skipped (manual-only sites, add jobs from Manual Apply): {fetchResult.manualOnly.join(', ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Login All result */}
      {loginAllResult && (
        <div className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-emerald-50 border-emerald-200')}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <LogIn size={16} className="text-emerald-500" />
              <span className="text-sm font-semibold">Login All Result</span>
            </div>
            <button onClick={() => setLoginAllResult(null)} className={'p-1 rounded cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-200 text-gray-500')}>
              <X size={14} />
            </button>
          </div>
          <div className="space-y-1.5">
            {loginAllResult.map(r => (
              <div key={r.name} className="flex items-start gap-2 text-sm">
                {r.ok
                  ? <CheckCircle2 size={15} className="mt-0.5 text-emerald-500 flex-shrink-0" />
                  : r.skipped
                    ? <Clock size={15} className="mt-0.5 text-amber-500 flex-shrink-0" />
                    : <AlertCircle size={15} className="mt-0.5 text-red-500 flex-shrink-0" />}
                <div className="min-w-0">
                  <span className="font-medium">{r.label}</span>
                  {r.ok
                    ? <span className={'ml-1 text-xs ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{r.via === 'browser' ? 'connected · session captured via browser' : 'connected' + (r.via ? ' · via ' + r.via : '')}</span>
                    : <span className={'ml-1 text-xs ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{r.skipped ? 'skipped' : 'failed'}</span>}
                  {!r.ok && <p className={'text-xs mt-0.5 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{r.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Site cards */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {jobSites.map(site => (
            <div key={site.name} className={'p-4 rounded-xl border transition-all ' + (site.enabled
              ? (dark ? 'bg-gray-800 border-blue-500/40' : 'bg-white border-blue-300')
              : (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'))}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ' + (site.enabled
                    ? (dark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600')
                    : (dark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'))}>
                    <Globe size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{site.label}</p>
                      {site.custom && (
                        <span className={'text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ' + (dark ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-fuchsia-50 text-fuchsia-600')}>
                          Custom
                        </span>
                      )}
                      <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (
                        site.status === 'connected' ? (dark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
                          : site.status === 'error' ? (dark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-700')
                          : (dark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                      )}>
                        {site.status}
                      </span>
                    </div>
                    <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                      {site.baseUrl ? site.baseUrl + (site.custom ? ' — manual apply' : '') + ' · ' : ''}
                      {site.credentials?.email ? 'Configured: ' + site.credentials.email : 'No credentials'}
                      {site.hasCookies ? ' | Session cookie' + (site.cookieUpdatedAt ? ' ' + formatTimeAgo(site.cookieUpdatedAt) : '') : ''}
                      {site.lastFetched ? ' | Last: ' + formatTimeAgo(site.lastFetched) : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle */}
                  <button onClick={() => onToggleSite(site.name, !site.enabled)}
                    className={'relative w-11 h-6 rounded-full transition-colors cursor-pointer ' + (site.enabled ? 'bg-blue-500' : (dark ? 'bg-gray-600' : 'bg-gray-300'))}>
                    <span className={'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ' + (site.enabled ? 'translate-x-5' : '')} />
                  </button>
                  {/* Edit */}
                    <button onClick={() => { setCredsModal({ name: site.name, label: site.label, email: site.credentials?.email || '' }); setCredsForm({ email: '', password: '' }); setCookiesForm('') }}
                    className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}>
                    <Edit3 size={16} />
                  </button>
                  {/* Test */}
                  {(() => {
                    const TestIcon = testingSite === site.name ? Loader2 : CheckCircle2
                    return (
                      <button onClick={() => onTestSite(site.name)} disabled={testingSite === site.name || (!site.credentials?.email && !site.hasCookies)}
                        className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-emerald-400' : 'hover:bg-gray-200 text-emerald-600') + ' disabled:opacity-40'}>
                        <TestIcon size={16} className={testingSite === site.name ? 'animate-spin' : ''} />
                      </button>
                    )
                  })()}
                  {/* Assisted browser login */}
                  {(() => {
                    const LoginIcon = browserLoginSites.includes(site.name) ? Loader2 : LogIn
                    return (
                      <button onClick={() => onBrowserLogin(site.name)} disabled={browserLoginSites.includes(site.name)}
                        title="Open a browser window to log in — session is captured automatically"
                        className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-fuchsia-400' : 'hover:bg-gray-200 text-fuchsia-600') + ' disabled:opacity-40'}>
                        <LoginIcon size={16} className={browserLoginSites.includes(site.name) ? 'animate-spin' : ''} />
                      </button>
                    )
                  })()}
                  {/* Remove */}
                  <button onClick={() => onRemoveSite(site.name)}
                    className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Credentials Modal */}
      {credsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCredsModal(null)}>
          <div className={'w-full max-w-md p-6 rounded-2xl border shadow-2xl ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{credsModal.label} Credentials</h3>
              <button onClick={() => setCredsModal(null)} className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700' : 'hover:bg-gray-200')}>
                <X size={18} />
              </button>
            </div>
            <p className={'text-sm mb-4 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
              Credentials are encrypted before storage. Password is never shown back.
            </p>
            <div className="space-y-3">
              <div>
                <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Email</label>
                <input type="email" value={credsForm.email}
                  onChange={e => setCredsForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="your@email.com"
                  autoComplete="off"
                  name={'email-' + credsModal.name}
                  className={'w-full mt-1 px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')} />
                {credsModal.email ? (
                  <p className={'text-xs mt-1 ' + (dark ? 'text-emerald-400' : 'text-emerald-600')}>Currently stored: {credsModal.email} (leave blank to keep)</p>
                ) : (
                  <p className={'text-xs mt-1 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>Leave blank to keep existing</p>
                )}
              </div>
              <div>
                <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Password</label>
                <div className="relative mt-1">
                  <input type={showCredsPassword ? 'text' : 'password'} value={credsForm.password}
                    onChange={e => setCredsForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Leave blank to keep existing"
                    autoComplete="new-password"
                    name={'password-' + credsModal.name}
                    className={'w-full pr-10 px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')} />
                  <button type="button" onClick={() => setShowCredsPassword(v => !v)}
                    className={'absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer ' + (dark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700')}>
                    {showCredsPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className={'pt-2 border-t ' + (dark ? 'border-gray-700' : 'border-gray-200')}>
                <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>
                  Session Cookie Header <span className="text-xs font-normal opacity-70">(fallback when SSO/CAPTCHA blocks login)</span>
                </label>
                <textarea value={cookiesForm} rows={3}
                  onChange={e => setCookiesForm(e.target.value)}
                  placeholder="Paste the full Cookie header from DevTools → Network → Request Headers"
                  className={'w-full mt-1 px-3 py-2 rounded-xl border outline-none text-sm font-mono resize-y ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')} />
                <p className={'text-xs mt-1 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>
                  Cleared if left empty. Stored encrypted. Useful for Indeed/Naukri when password login is impossible.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setCredsModal(null)}
                className={'px-4 py-2 rounded-xl text-sm font-medium cursor-pointer ' + (dark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                Cancel
              </button>
              <button onClick={onSaveCreds} disabled={credsSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50 cursor-pointer">
                {credsSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                Save & Enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPasswordModal(false)}>
          <div className={'w-full max-w-md p-6 rounded-2xl border shadow-2xl ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Change Password</h3>
              <button onClick={() => setPasswordModal(false)} className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700' : 'hover:bg-gray-200')}>
                <X size={18} />
              </button>
            </div>
            <p className={'text-sm mb-4 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
              Changing your password signs you out of all sessions. You'll need to log in again.
            </p>
            <div className="space-y-3">
              <div>
                <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Current Password</label>
                <input type="password" value={passwordForm.currentPassword}
                  onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))}
                  className={'w-full mt-1 px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')} />
              </div>
              <div>
                <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>New Password</label>
                <input type="password" value={passwordForm.newPassword}
                  onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                  className={'w-full mt-1 px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')} />
              </div>
              <div>
                <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Confirm New Password</label>
                <input type="password" value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  className={'w-full mt-1 px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setPasswordModal(false)}
                className={'px-4 py-2 rounded-xl text-sm font-medium cursor-pointer ' + (dark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                Cancel
              </button>
              <button onClick={onChangePassword} disabled={passwordSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50 cursor-pointer">
                {passwordSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Site Modal */}
      {addSiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAddSiteModal(false)}>
          <div className={'w-full max-w-md p-6 rounded-2xl border shadow-2xl ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Add Custom Site</h3>
              <button onClick={() => setAddSiteModal(false)} className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700' : 'hover:bg-gray-200')}>
                <X size={18} />
              </button>
            </div>
            <p className={'text-sm mb-4 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
              Add a job site by URL (e.g. LinkedIn, Monster, Glassdoor). Custom sites have no auto-apply — after connecting, add jobs in the Manual Apply tab and apply in the browser.
            </p>
            <div className="space-y-3">
              <div>
                <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Site Name</label>
                <input type="text" value={addSiteForm.label}
                  onChange={e => setAddSiteForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="LinkedIn"
                  className={'w-full mt-1 px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')} />
              </div>
              <div>
                <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Site URL</label>
                <input type="url" value={addSiteForm.baseUrl}
                  onChange={e => setAddSiteForm(f => ({ ...f, baseUrl: e.target.value }))}
                  placeholder="https://www.linkedin.com"
                  className={'w-full mt-1 px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setAddSiteModal(false)}
                className={'px-4 py-2 rounded-xl text-sm font-medium cursor-pointer ' + (dark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                Cancel
              </button>
              <button onClick={onAddCustomSite} disabled={addingSite}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:from-fuchsia-700 hover:to-pink-600 transition-all disabled:opacity-50 cursor-pointer">
                {addingSite ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Add Site
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
