import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useApiAuth } from '../lib/api'
import { motion } from 'framer-motion'
import { io } from 'socket.io-client'
import { LogOut, Sun, Moon, X, CheckCircle2, AlertCircle, Bell, CheckCheck, PauseCircle, PlayCircle, UserCheck, XCircle, Banknote, KeyRound } from 'lucide-react'
import EditModal from '../features/admin/components/EditModal'
import ProfileForm from '../features/admin/components/ProfileForm'
import SocialTab from '../features/social/SocialTab'
import { tabs } from '../features/admin/tabs/tabs'
import SkillsTab from '../features/admin/tabs/SkillsTab'
import SimpleListTab from '../features/admin/tabs/SimpleListTab'
import ResumesTab from '../features/admin/tabs/ResumesTab'
import GeneratedResumesTab from '../features/admin/tabs/GeneratedResumesTab'
import ArticlesTab from '../features/admin/tabs/ArticlesTab'
import MessagesTab from '../features/admin/tabs/MessagesTab'
import LeadsTab from '../features/admin/tabs/LeadsTab'
import AnalyticsTab from '../features/admin/tabs/AnalyticsTab'
import JobsTab from '../features/admin/tabs/JobsTab'
import JobAppsTab from '../features/admin/tabs/JobAppsTab'
import TrackingTab from '../features/admin/tabs/TrackingTab'
import ManualApplyTab from '../features/admin/tabs/ManualApplyTab'
import LiveChatTab from '../features/admin/tabs/LiveChatTab'

export default function AdminDashboard() {
  const API = useApiAuth()
  const { logout, token } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('profile')
  const [data, setData] = useState({})
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [activities, setActivities] = useState([])
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [messages, setMessages] = useState([])
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [leads, setLeads] = useState([])
  const [toast, setToast] = useState(null)

  // Job Sites state
  const [jobSites, setJobSites] = useState([])
  const [jobSitesLoading, setJobSitesLoading] = useState(false)
  const [credsModal, setCredsModal] = useState(null) // { name, label }
  const [credsForm, setCredsForm] = useState({ email: '', password: '' })
  const [cookiesForm, setCookiesForm] = useState('')
  const [showCredsPassword, setShowCredsPassword] = useState(false)
  const [credsSaving, setCredsSaving] = useState(false)
  const [testingSite, setTestingSite] = useState(null)
  const [browserLoginSites, setBrowserLoginSites] = useState([])
  const [passwordModal, setPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState(null)
  const [loginAllInProgress, setLoginAllInProgress] = useState(false)
  const [loginAllResult, setLoginAllResult] = useState(null)
  const [addSiteModal, setAddSiteModal] = useState(false)
  const [addSiteForm, setAddSiteForm] = useState({ label: '', baseUrl: '' })
  const [addingSite, setAddingSite] = useState(false)

  // Job Applications state
  const [jobApps, setJobApps] = useState({ items: [], total: 0, page: 1, pages: 1 })
  const [jobAppsLoading, setJobAppsLoading] = useState(false)
  const [pipeline, setPipeline] = useState(null)
  const [pipelineBudget, setPipelineBudget] = useState({ aiDailyBudget: '', aiWeeklyBudget: '', maxApplyPerBatch: '', applyRateDelayMs: '', siteConcurrency: '', notifyEmail: false, notifyDigest: 'instant' })
  const [budgetSaving, setBudgetSaving] = useState(false)
  const [jobAppsFilters, setJobAppsFilters] = useState({
    site: '', status: '', age: '', minScore: '', q: ''
  })
  const [selectedJobs, setSelectedJobs] = useState(new Set())
  const [jobDetailPanel, setJobDetailPanel] = useState(null) // { job, matchDetails }
  const [matchingJobs, setMatchingJobs] = useState(false)
  const [applying, setApplying] = useState(false)
  // Persisted so a page refresh can restore the pipeline panel via
  // GET /api/jobs/apply/batch/:id (progress used to vanish on reload).
  const [lastBatchId, setLastBatchId] = useState(() => {
    try { return localStorage.getItem('lastApplyBatchId') } catch { return null }
  })
  const [applyProgress, setApplyProgress] = useState([])
  const applySocketRef = useRef(null)
  // Always-current refresh callbacks so the socket handler never closes over a
  // stale snapshot (keeps the socket connection stable across filter changes).
  const liveRefreshRef = useRef({ jobApps: null, tracking: null, manual: null })
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [generatedResumes, setGeneratedResumes] = useState([])
  const [generatedResumesLoading, setGeneratedResumesLoading] = useState(false)
  const [generatingResumeIds, setGeneratingResumeIds] = useState(new Set())

  // Tracking state
  const [tracking, setTracking] = useState({ items: [], total: 0, page: 1, pages: 1 })
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [trackingFilters, setTrackingFilters] = useState({ site: '', status: '', via: '' })
  const [trackingDetail, setTrackingDetail] = useState(null)

  // Manual Apply state
  const [manualJobs, setManualJobs] = useState({ items: [], total: 0, page: 1, pages: 1 })
  const [manualLoading, setManualLoading] = useState(false)
  const [manualFilters, setManualFilters] = useState({ site: '', status: '' })
  const [addJobModal, setAddJobModal] = useState(null)
  const [addJobForm, setAddJobForm] = useState({ title: '', company: '', url: '', site: '', location: '' })
  const [addingJob, setAddingJob] = useState(false)

  // Notifications state
  const [notifications, setNotifications] = useState([])
  const [notificationCount, setNotificationCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  const NOTIFICATION_TYPES = {
    batch_complete: { icon: CheckCheck, color: 'text-emerald-500' },
    apply_success: { icon: CheckCircle2, color: 'text-emerald-500' },
    apply_failed: { icon: XCircle, color: 'text-red-500' },
    needs_input: { icon: UserCheck, color: 'text-amber-500' },
    pipeline_paused: { icon: PauseCircle, color: 'text-red-500' },
    pipeline_resumed: { icon: PlayCircle, color: 'text-emerald-500' },
    ai_budget: { icon: Banknote, color: 'text-violet-500' },
    system: { icon: AlertCircle, color: 'text-blue-500' },
  }

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await API.get('/api/notifications?limit=12')
      setNotifications(data.items || [])
      setNotificationCount(data.unreadCount || 0)
    } catch (err) { console.error(err) }
  }, [API])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifications()
  }, [loadNotifications])

  // Close the notification dropdown on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const openNotification = async (n) => {
    if (!n.read) {
      setNotificationCount(c => Math.max(0, c - 1))
      setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, read: true } : x))
      API.put('/api/notifications/' + n._id + '/read').catch(() => {})
    }
    setNotifOpen(false)
    // Switching tabs triggers that tab's own data refresh (tracking/job-apps).
    setActiveTab(n.type === 'needs_input' || n.type === 'batch_complete' ? 'tracking' : 'job-apps')
  }

  const markAllNotificationsRead = async () => {
    try {
      await API.put('/api/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setNotificationCount(0)
    } catch (err) { console.error(err) }
  }

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Live Chat state
  const [chatActive, setChatActive] = useState([])
  const [chatWaiting, setChatWaiting] = useState([])
  const [selectedChat, setSelectedChat] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const chatSocketRef = useRef(null)
  const chatEndRef = useRef(null)
  const selectedChatRef = useRef(null)
  const chatMessagesRef = useRef({})

  useEffect(() => {
    selectedChatRef.current = selectedChat
  }, [selectedChat])

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (activeTab !== 'livechat' || !token) return
    const socket = io(window.location.origin, { auth: { token, role: 'admin' } })
    chatSocketRef.current = socket

    socket.on('auth_error', () => {
      showToast('Session expired. Please log in again.', 'error')
      logout()
      navigate('/admin')
    })

    socket.on('chat:state', (data) => {
      setChatActive(data.active || [])
      setChatWaiting(data.waiting || [])
    })

    socket.on('chat:new', (session) => {
      setChatActive((prev) => [...prev, session])
    })

    socket.on('chat:message', (data) => {
      const sid = data.sessionId
      chatMessagesRef.current[sid] = [...(chatMessagesRef.current[sid] || []), data.message]
      const cur = selectedChatRef.current
      if (cur && cur._id === sid) {
        setChatMessages(chatMessagesRef.current[sid])
      }
    })

    socket.on('chat:closed', (data) => {
      setChatActive((prev) => prev.filter((c) => c._id !== data.sessionId))
      delete chatMessagesRef.current[data.sessionId]
      const cur = selectedChatRef.current
      if (cur && cur._id === data.sessionId) {
        setSelectedChat(null)
        setChatMessages([])
      }
    })

    return () => { socket.disconnect() }
  }, [activeTab, token, logout, navigate, showToast])

  const refreshActivities = useCallback(async () => {
    setActivitiesLoading(true)
    try {
      const { data } = await API.get('/api/activity')
      setActivities(data)
    } catch (err) { console.error(err) }
    finally { setActivitiesLoading(false) }
  }, [])

  const refreshJobSites = useCallback(async () => {
    setJobSitesLoading(true)
    try {
      const { data } = await API.get('/api/job-sites')
      setJobSites(data)
    } catch (err) { console.error(err) }
    finally { setJobSitesLoading(false) }
  }, [])

  const saveJobSite = async (name, creds) => {
    setCredsSaving(true)
    try {
      const { data } = await API.put('/api/job-sites/' + name, creds)
      setJobSites(prev => {
        const idx = prev.findIndex(s => s.name === name)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = data
          return next
        }
        return [...prev, data]
      })
      showToast('Saved ' + data.label, 'success')
      return true
    } catch (err) {
      showToast(err.response?.data?.error || 'Save failed', 'error')
      return false
    } finally { setCredsSaving(false) }
  }

  const testJobSite = async (name) => {
    setTestingSite(name)
    showToast('Connecting… if a CAPTCHA/SSO window opens, complete the login there — it gets captured automatically.', 'info')
    try {
      const { data } = await API.post('/api/job-sites/' + name + '/test', {}, { timeout: 11 * 60 * 1000 })
      showToast(data.message || 'Connected', 'success')
      await refreshJobSites()
    } catch (err) {
      showToast(err.response?.data?.error || 'Connection failed', 'error')
      await refreshJobSites()
    } finally { setTestingSite(null) }
  }

  const browserLogin = async (name) => {
    setBrowserLoginSites(prev => prev.includes(name) ? prev : [...prev, name])
    showToast('Opening browser — log in there, this may take up to 10 minutes (longer if the site shows a rate-limit page)…', 'info')
    try {
      const { data } = await API.post('/api/job-sites/' + name + '/browser-login', {}, { timeout: 11 * 60 * 1000 })
      showToast(data.message || 'Logged in — site enabled', 'success')
      await refreshJobSites()
    } catch (err) {
      showToast(err.response?.data?.error || 'Browser login failed', 'error')
    } finally {
      setBrowserLoginSites(prev => prev.filter(s => s !== name))
    }
  }

  const removeJobSite = async (name) => {
    if (!confirm('Remove this site?')) return
    try {
      await API.delete('/api/job-sites/' + name)
      setJobSites(prev => prev.filter(s => s.name !== name))
      showToast('Removed', 'success')
    } catch { showToast('Remove failed', 'error') }
  }

  const toggleSite = async (name, enabled) => {
    // Send ONLY the enabled flag — the stored email/password are masked on the
    // client, so including them would overwrite the real values with "jo***@…".
    const ok = await saveJobSite(name, { enabled })
    if (!ok) await refreshJobSites()
  }

  const addCustomSite = async () => {
    if (!addSiteForm.label || !addSiteForm.baseUrl) {
      showToast('Site name and URL are required', 'error')
      return
    }
    setAddingSite(true)
    try {
      const { data } = await API.post('/api/job-sites', addSiteForm)
      setJobSites(prev => [...prev, data])
      setAddSiteModal(false)
      showToast('Site added: ' + data.label, 'success')
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add site', 'error')
    } finally { setAddingSite(false) }
  }

  const fetchJobs = async () => {
    setFetching(true)
    setFetchResult(null)
    try {
      const { data } = await API.post('/api/jobs/fetch')
      setFetchResult(data)
      const total = data.created + data.updated
      if (data.errors?.length) {
        showToast(`Fetched with ${data.errors.length} error(s). ${total} jobs added/updated.`, 'error')
      } else {
        showToast(`Fetched ${data.total} jobs. ${data.created} new, ${data.updated} refreshed.`, 'success')
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Fetch failed', 'error')
    } finally { setFetching(false) }
  }

  // Jobs persist in MongoDB across restarts, but if the actionable list is
  // empty while automated sites are enabled (fresh DB, first run, or a fetch
  // that failed before) fetch once automatically so no manual click is needed.
  const autoFetchedRef = useRef(false)
  useEffect(() => {
    if (activeTab !== 'job-apps') return
    if (autoFetchedRef.current) return
    if (fetching || jobAppsLoading) return
    if (jobApps.items.length > 0) return
    if (!jobSites.some(s => s.enabled && !s.custom)) return
    autoFetchedRef.current = true
    const t = setTimeout(() => { fetchJobs() }, 0)
    return () => clearTimeout(t)
  }, [activeTab, fetching, jobAppsLoading, jobApps.items.length, jobSites])

  // Log in to every configured site AT ONCE using each site's own stored
  // credentials / session cookie. All logins run concurrently on the server;
  // if a site needs a CAPTCHA/SSO/OTP, a browser window opens automatically and
  // the session is captured after the manual login.
  const loginAll = async () => {
    setLoginAllInProgress(true)
    setLoginAllResult(null)
    showToast('Logging in to all sites simultaneously… if a site needs a CAPTCHA/SSO/OTP a browser window will open — complete the login there and it gets captured automatically.', 'info')
    try {
      const { data } = await API.post('/api/job-sites/login-all', {}, { timeout: 12 * 60 * 1000 })
      setLoginAllResult(data.results || [])
      const ok = (data.results || []).filter(r => r.ok).length
      const bad = (data.results || []).filter(r => !r.ok && !r.skipped).length
      const skipped = (data.results || []).filter(r => r.skipped).length
      await refreshJobSites()
      if (bad) {
        showToast(`${ok} connected, ${bad} failed${skipped ? ', ' + skipped + ' skipped' : ''} — see details below`, 'error')
      } else if (skipped) {
        showToast(`${ok} connected, ${skipped} skipped — see details below`, 'info')
      } else {
        showToast(`All ${ok} sites connected`, 'success')
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Login all failed', 'error')
    } finally { setLoginAllInProgress(false) }
  }

  // Job Applications functions
  const refreshPipeline = useCallback(async () => {
    try {
      const { data } = await API.get('/api/pipeline/status')
      setPipeline(data)
      setPipelineBudget({
        aiDailyBudget: data.aiDailyBudget ?? '',
        aiWeeklyBudget: data.aiWeeklyBudget ?? '',
        maxApplyPerBatch: data.maxApplyPerBatch ?? '',
        applyRateDelayMs: data.applyRateDelayMs ?? '',
        siteConcurrency: data.siteConcurrency ?? '',
        notifyEmail: data.notifyEmail ?? false,
        notifyDigest: data.notifyDigest ?? 'instant',
      })
    } catch (err) { console.error(err) }
  }, [])

  const refreshJobApps = useCallback(async () => {    setJobAppsLoading(true)
    try {
      const params = new URLSearchParams()
      if (jobAppsFilters.site) params.set('site', jobAppsFilters.site)
      if (jobAppsFilters.status) params.set('status', jobAppsFilters.status)
      if (jobAppsFilters.age) params.set('age', jobAppsFilters.age)
      if (jobAppsFilters.minScore) params.set('minScore', jobAppsFilters.minScore)
      if (jobAppsFilters.q) params.set('q', jobAppsFilters.q)
      params.set('page', jobApps.page)
      params.set('limit', 20)
      const { data } = await API.get('/api/jobs?' + params.toString())
      setJobApps(data)
    } catch (err) {
      console.error(err)
      showToast('Failed to load jobs', 'error')
    } finally { setJobAppsLoading(false) }
  }, [jobAppsFilters, jobApps.page, showToast])

  // Live apply progress via socket. Declared after refreshJobApps so the
  // callback reference is initialized before this effect's dependency array is
  // evaluated (referencing it earlier caused a TDZ white-screen on /admin).
  useEffect(() => {
    if (!token) return
    const socket = io(window.location.origin, { auth: { token, role: 'admin' } })
    applySocketRef.current = socket

    socket.on('apply:progress', (data) => {
      setApplyProgress(prev => {
        const idx = prev.findIndex(p => p.applicationId === data.applicationId)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = data
          return next
        }
        return [...prev, data]
      })
      // Live-update the matching card so the list reflects apply progress
      // without needing a manual refresh.
      if (activeTab === 'job-apps' && data.jobId) {
        setJobApps(prev => {
          const idx = prev.items.findIndex(item => item._id === data.jobId)
          if (idx < 0) return prev
          if (data.status === 'applied' && jobAppsFilters.status === '') {
            const items = [...prev.items]
            items.splice(idx, 1)
            return { ...prev, items, total: Math.max(0, prev.total - 1) }
          }
          const items = [...prev.items]
          items[idx] = { ...items[idx], status: data.status, applied: data.status === 'applied', appliedAt: data.status === 'applied' ? new Date().toISOString() : items[idx].appliedAt }
          return { ...prev, items }
        })
      }
      // Live-update the Tracking tab too: match by applicationId (NOT jobId —
      // the tracking list shows Application records). Applied entries stay in
      // the list (they are tracking records) with their updated status. This
      // makes failed/pending/skipped runs visible immediately instead of only
      // after the next jobs:changed refresh.
      if (data.applicationId) {
        const patch = (item) => ({
          ...item,
          status: data.status,
          lastAction: data.lastAction || item.lastAction,
          ...(data.status === 'applied' && !item.appliedAt ? { appliedAt: new Date().toISOString() } : {}),
          ...(data.steps && data.steps.length
            ? { progress: { ...(item.progress || {}), currentStep: data.currentStep, steps: data.steps } }
            : {}),
        })
        setTracking(prev => {
          const idx = prev.items.findIndex(item => String(item._id) === data.applicationId)
          if (idx < 0) return prev
          const items = [...prev.items]
          items[idx] = patch(items[idx])
          return { ...prev, items }
        })
        // Keep an open tracking detail panel in sync with the live run.
        setTrackingDetail(prev => (prev && String(prev._id) === data.applicationId ? patch(prev) : prev))
      }
    })

    // In-app notifications arrive over the same admin socket connection.
    socket.on('notify:inapp', (data) => {
      setNotifications(prev => [data, ...prev].slice(0, 50))
      if (!data.read) setNotificationCount(c => c + 1)
      // Silent refresh of whichever list is open — failure/input/pause events
      // change application state, so toast-only left the view stale.
      const refreshActiveList = () => {
        if (activeTab === 'job-apps') liveRefreshRef.current.jobApps?.()
        else if (activeTab === 'tracking') liveRefreshRef.current.tracking?.()
        else if (activeTab === 'manual') liveRefreshRef.current.manual?.()
      }
      if (data.type === 'apply_failed' || data.type === 'needs_input') {
        showToast(data.title + (data.body ? ' — ' + data.body : ''), 'warning')
        refreshActiveList()
      } else if (data.type === 'apply_success') {
        showToast(data.title, 'success')
        if (activeTab === 'job-apps') refreshJobApps()
      } else if (data.type === 'batch_complete') {
        showToast(data.title + (data.body ? ' — ' + data.body : ''), 'info')
        if (activeTab === 'job-apps') refreshJobApps()
      } else if (data.type === 'pipeline_paused' || data.type === 'ai_budget') {
        showToast(data.title, 'warning')
        refreshActiveList()
      } else if (data.type === 'pipeline_resumed') {
        showToast(data.title, 'success')
      }
    })

    // Server pushes a jobs:changed signal whenever job data mutates (match,
    // fetch, status changes, apply/resume) — refresh the active list live so
    // nothing requires a manual page reload. Throttled to avoid overlapping
    // fetches during bursts of updates.
    let lastJobsChangedAt = 0
    socket.on('jobs:changed', () => {
      const now = Date.now()
      if (now - lastJobsChangedAt < 2000) return
      lastJobsChangedAt = now
      if (activeTab === 'job-apps') liveRefreshRef.current.jobApps?.()
      else if (activeTab === 'tracking') liveRefreshRef.current.tracking?.()
      else if (activeTab === 'manual') liveRefreshRef.current.manual?.()
    })

    return () => { socket.disconnect() }
  }, [token, showToast, activeTab, refreshJobApps])

  // Restore the Auto-Apply Pipeline panel after a page refresh: the live
  // socket events are gone by then, so rebuild the rows from the batch REST
  // endpoint. Runs once on mount; a missing/empty batch just clears the
  // stored id.
  useEffect(() => {
    if (!token || !lastBatchId) return
    let cancelled = false
    const toProgress = (a) => ({
      applicationId: String(a._id),
      jobId: a.jobId && a.jobId._id ? String(a.jobId._id) : (a.jobId ? String(a.jobId) : ''),
      batchId: a.batchId || lastBatchId,
      status: a.status,
      jobTitle: (a.jobId && a.jobId.title) || '',
      currentStep: a.progress?.currentStep || '',
      lastAction: a.lastAction || '',
      steps: (a.progress?.steps || []).map(s => ({ key: s.key, label: s.label, status: s.status, error: s.error || '' })),
    })
    API.get(`/api/jobs/apply/batch/${lastBatchId}`)
      .then(({ data }) => {
        if (cancelled) return
        if (data.applications?.length) {
          setApplyProgress(data.applications.map(toProgress))
        } else {
          setLastBatchId(null)
          try { localStorage.removeItem('lastApplyBatchId') } catch { /* unavailable */ }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLastBatchId(null)
          try { localStorage.removeItem('lastApplyBatchId') } catch { /* unavailable */ }
        }
      })
    return () => { cancelled = true }
  }, [token, lastBatchId])

  const handleFilterChange = (key, value) => {
    setJobAppsFilters(prev => ({ ...prev, [key]: value }))
    setJobApps(prev => ({ ...prev, page: 1 }))
  }

  const handlePageChange = (page) => {
    setJobApps(prev => ({ ...prev, page }))
  }

  const handleSelectJob = (jobId) => {
    setSelectedJobs(prev => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedJobs.size === jobApps.items.length) {
      setSelectedJobs(new Set())
    } else {
      setSelectedJobs(new Set(jobApps.items.map(j => j._id)))
    }
  }

  const openJobDetail = async (job) => {
    setAiResult('')
    // Fetch match details if not already present
    if (job.matchScore === null || job.matchScore === undefined) {
      setMatchingJobs(true)
      try {
        const { data } = await API.post('/api/jobs/match', { jobIds: [job._id] })
        if (data.jobs?.[0]) {
          const matched = data.jobs[0]
          const updated = { ...job, matchScore: matched.score, matchedKeywords: matched.matched, missingKeywords: matched.missing, reasoning: matched.reasoning }
          setJobDetailPanel(updated)
          // Reflect the score on the card in the list too so it updates live.
          setJobApps(prev => ({
            ...prev,
            items: prev.items.map(item => item._id === job._id
              ? { ...item, matchScore: matched.score, matchedKeywords: matched.matched, missingKeywords: matched.missing }
              : item)
          }))
        } else {
          setJobDetailPanel(job)
        }
      } catch (err) {
        console.error(err)
        setJobDetailPanel(job)
      } finally { setMatchingJobs(false) }
    } else {
      setJobDetailPanel(job)
    }
  }

  const closeJobDetail = () => setJobDetailPanel(null)

  const matchSelectedJobs = async () => {
    const selectedItems = jobApps.items.filter(item => selectedJobs.has(item._id))
    const ids = selectedItems.filter(i => i.status !== 'applied' && !i.matchScore).map(i => i._id)
    if (!ids.length) return
    setMatchingJobs(true)
    try {
      const { data } = await API.post('/api/jobs/match', { jobIds: ids })
      if (data.jobs) {
        // Update local state with match results
        setJobApps(prev => ({
          ...prev,
          items: prev.items.map(item => {
            const match = data.jobs.find(m => m.jobId === item._id)
            if (match) return { ...item, matchScore: match.score, matchedKeywords: match.matched, missingKeywords: match.missing }
            return item
          })
        }))
      }
      showToast(`Matched ${ids.length} jobs`, 'success')
      // Reload from the server so the persisted matchScore/keywords are the
      // source of truth (the local map above is an optimistic preview).
      await refreshJobApps()
    } catch {
      showToast('Matching failed', 'error')
    } finally { setMatchingJobs(false) }
  }

  const handleBulkAction = async (action, target) => {
    const newStatus = action === 'apply' ? 'applied' : 'passed'
    let ids = []
    if (target) {
      // Single job coming from the detail panel — it is not necessarily
      // selected via a checkbox, so resolve the ids from the target directly.
      const alreadyDone = action === 'apply' ? target.status === 'applied' : target.status === 'passed'
      if (!alreadyDone) ids = [target._id]
    } else {
      const selectedItems = jobApps.items.filter(item => selectedJobs.has(item._id))
      ids = action === 'apply'
        ? selectedItems.filter(i => i.status !== 'applied').map(i => i._id)
        : selectedItems.filter(i => i.status !== 'passed').map(i => i._id)
    }
    if (!ids.length) return
    try {
      await Promise.all(ids.map(id => API.put('/api/jobs/' + id, { status: newStatus })))
      setJobApps(prev => {
        const items = prev.items
          .map(item => ids.includes(item._id)
            ? { ...item, status: newStatus, applied: action === 'apply', appliedAt: action === 'apply' ? new Date().toISOString() : item.appliedAt }
            : item)
          // Applied/passed jobs move off the actionable queue.
          .filter(item => !(ids.includes(item._id) && jobAppsFilters.status === ''))
        return { ...prev, items }
      })
      setSelectedJobs(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      })
      showToast(`${ids.length} job${ids.length > 1 ? 's' : ''} marked as ${newStatus}`, 'success')
    } catch {
      showToast('Action failed', 'error')
    }
  }

  const startAutomatedApply = async () => {
    const selectedItems = jobApps.items.filter(item => selectedJobs.has(item._id))
    const ids = selectedItems.filter(i => i.status !== 'applied').map(i => i._id)
    if (!ids.length) return
    try {
      setApplying(true)
      const { data } = await API.post('/api/jobs/apply', { jobIds: ids })
      setLastBatchId(data.batchId)
      try { localStorage.setItem('lastApplyBatchId', data.batchId) } catch { /* unavailable */ }
      setApplyProgress([])
      setSelectedJobs(new Set())
      showToast(`${data.queued} jobs queued for automated apply`, 'success')
    } catch (e) {
      showToast(e.response?.data?.error || 'Failed to queue jobs', 'error')
    } finally { setApplying(false) }
  }

  const generateCoverLetter = async (job) => {
    setAiLoading(true)
    setAiResult('')
    try {
      const { data } = await API.post('/api/resume/cover-letter', { jobId: job._id })
      setAiResult(data.coverLetter)
    } catch (err) {
      showToast(err.response?.data?.error || 'Cover letter generation failed', 'error')
    } finally { setAiLoading(false) }
  }

  const optimizeResume = async (job) => {
    setAiLoading(true)
    setAiResult('')
    try {
      const { data } = await API.post('/api/resume/optimize', { jobId: job._id })
      if (data.suggestions?.length) {
        setAiResult(data.suggestions.map(s => `• ${s.keyword} — ${s.reason}`).join('\n'))
      } else {
        setAiResult(data.note || 'No suggestions available')
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Resume optimization failed', 'error')
    } finally { setAiLoading(false) }
  }

  const generateResumeForJob = async (job) => {
    if (generatingResumeIds.has(job._id)) return
    setGeneratingResumeIds(prev => new Set(prev).add(job._id))
    try {
      const { data } = await API.post('/api/resume/generate', { jobId: job._id })
      const res = data.results?.[0]
      if (res?.error) throw new Error(res.error)
      if (res?.resumeId) {
        setJobDetailPanel(prev => prev ? { ...prev, resumeId: res.resumeId } : prev)
        setJobApps(prev => ({
          ...prev,
          items: prev.items.map(i => i._id === job._id ? { ...i, resumeId: res.resumeId } : i)
        }))
        showToast(`Resume generated with ${res.keywordsAdded || 0} added keywords`, 'success')
      } else {
        showToast('No resume returned', 'error')
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Resume generation failed', 'error')
    } finally {
      setGeneratingResumeIds(prev => {
        const next = new Set(prev)
        next.delete(job._id)
        return next
      })
    }
  }

  const generateResumesBulk = async () => {
    const selectedItems = jobApps.items.filter(item => selectedJobs.has(item._id))
    const ids = selectedItems.map(i => i._id)
    if (!ids.length) return
    setGeneratingResumeIds(prev => new Set([...prev, ...ids]))
    try {
      const { data } = await API.post('/api/resume/generate', { jobIds: ids })
      const ok = data.results?.filter(r => !r.error) || []
      const bad = data.results?.filter(r => r.error) || []
      setJobApps(prev => ({
        ...prev,
        items: prev.items.map(item => {
          const res = data.results?.find(r => r.jobId === item._id)
          return res?.resumeId ? { ...item, resumeId: res.resumeId } : item
        })
      }))
      setSelectedJobs(new Set())
      showToast(`${ok.length} resumes generated${bad.length ? `, ${bad.length} failed` : ''}`, bad.length ? 'error' : 'success')
    } catch (err) {
      showToast(err.response?.data?.error || 'Bulk resume generation failed', 'error')
    } finally {
      setGeneratingResumeIds(new Set())
    }
  }

  // Tracking functions
  const refreshTracking = useCallback(async () => {
    setTrackingLoading(true)
    try {
      const params = new URLSearchParams()
      if (trackingFilters.site) params.set('site', trackingFilters.site)
      if (trackingFilters.status) params.set('status', trackingFilters.status)
      if (trackingFilters.via) params.set('via', trackingFilters.via)
      params.set('page', tracking.page)
      params.set('limit', 20)
      const { data } = await API.get('/api/applications?' + params.toString())
      setTracking(data)
    } catch (err) {
      console.error(err)
      showToast('Failed to load applications', 'error')
    } finally { setTrackingLoading(false) }
  }, [trackingFilters, tracking.page, showToast])

  const handleTrackingFilterChange = (key, value) => {
    setTrackingFilters(prev => ({ ...prev, [key]: value }))
    setTracking(prev => ({ ...prev, page: 1 }))
  }

  const handleTrackingPageChange = (page) => {
    setTracking(prev => ({ ...prev, page }))
  }

  // Manual Apply functions
  const refreshManualJobs = useCallback(async () => {
    setManualLoading(true)
    try {
      const params = new URLSearchParams()
      if (manualFilters.site) params.set('site', manualFilters.site)
      if (manualFilters.status) params.set('status', manualFilters.status)
      params.set('page', manualJobs.page)
      params.set('limit', 20)
      const { data } = await API.get('/api/jobs/manual?' + params.toString())
      setManualJobs(data)
    } catch (err) {
      console.error(err)
      showToast('Failed to load manual apply list', 'error')
    } finally { setManualLoading(false) }
  }, [manualFilters, manualJobs.page, showToast])

  // Keep the live-refresher pointed at the freshest list loaders after every
  // render (must be in an effect — the new react-hooks rule forbids writing
  // refs during render).
  useEffect(() => {
    liveRefreshRef.current = { jobApps: refreshJobApps, tracking: refreshTracking, manual: refreshManualJobs }
  })

  const handleManualFilterChange = (key, value) => {
    setManualFilters(prev => ({ ...prev, [key]: value }))
    setManualJobs(prev => ({ ...prev, page: 1 }))
  }

  const handleManualPageChange = (page) => {
    setManualJobs(prev => ({ ...prev, page }))
  }

  const openAddJobModal = () => {
    const defaultSite = (jobSites.find(s => s.custom) || jobSites[0])?.name || ''
    setAddJobForm({ title: '', company: '', url: '', site: defaultSite, location: '' })
    setAddJobModal(true)
  }

  const addManualJob = async () => {
    if (!addJobForm.title || !addJobForm.company || !addJobForm.url || !addJobForm.site) {
      showToast('Title, company, URL and site are required', 'error')
      return
    }
    setAddingJob(true)
    try {
      const { data } = await API.post('/api/jobs/manual', addJobForm)
      showToast(data.duplicate ? 'Job already tracked — re-added to Manual Apply' : 'Job added to Manual Apply', 'success')
      setAddJobModal(false)
      setManualJobs(prev => ({ ...prev, page: 1 }))
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to add job', 'error')
    } finally { setAddingJob(false) }
  }

  const markManualApplied = async (job) => {
    try {
      await API.post(`/api/jobs/${job._id}/mark-applied`)
      showToast('Marked as applied', 'success')
      setManualJobs(prev => ({ ...prev, page: 1 }))
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to mark applied', 'error')
    }
  }

  const markManualPass = async (job) => {
    try {
      await API.put(`/api/jobs/${job._id}/mark-pass`)
      showToast('Marked as passed', 'success')
      setManualJobs(prev => ({ ...prev, page: 1 }))
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to mark passed', 'error')
    }
  }

  const retryApplication = async (app) => {
    try {
      await API.post(`/api/applications/${app._id}/retry`)
      showToast('Application requeued for retry', 'success')
      if (trackingDetail?._id === app._id) {
        setTrackingDetail({ ...trackingDetail, status: 'queued', notAppliedReason: null })
      }
      refreshTracking()
    } catch (err) {
      showToast(err.response?.data?.error || 'Retry failed', 'error')
    }
  }

  const submitApplicationAnswers = async (app) => {
    const answers = {}
    for (const f of (app.waitingFields || [])) {
      const v = String(app.answerDraft?.[f.key] ?? '').trim()
      if (v) answers[f.key] = v
    }
    if (!Object.keys(answers).length) {
      showToast('Fill at least one field', 'error')
      return
    }
    try {
      const { data } = await API.post(`/api/applications/${app._id}/answers`, { fields: answers })
      showToast(data.message || 'Answers saved — application resumed automatically', 'success')
      setTrackingDetail(data.application)
      refreshTracking()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save answers', 'error')
    }
  }

  const setAnswerDraft = (appId, key, value) => {
    setTrackingDetail(prev => {
      if (!prev) return prev
      return { ...prev, answerDraft: { ...(prev.answerDraft || {}), [key]: value } }
    })
  }

  const loadGeneratedResumes = async () => {
    setGeneratedResumesLoading(true)
    try {
      const { data } = await API.get('/api/resume/generated')
      setGeneratedResumes(data)
    } catch (err) {
      console.error(err)
    } finally { setGeneratedResumesLoading(false) }
  }

  const downloadGeneratedResume = async (id, filename) => {
    try {
      const res = await API.get(`/api/resume/generated/${id}/pdf`, { responseType: 'blob' })
      // Prefer the server-provided filename (Content-Disposition) so the
      // extension always matches the actual content (.docx vs .pdf).
      let name = filename
      if (!name) {
        const cd = res.headers?.['content-disposition'] || ''
        name = (cd.match(/filename="?([^";]+)"?/) || [])[1] || 'resume.pdf'
      }
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to download resume', 'error')
    }
  }

  // Open the resume PDF in a new browser tab for preview instead of forcing a
  // download. The blob keeps the axios auth header out of the URL.
  const previewGeneratedResume = async (id) => {
    try {
      const res = await API.get(`/api/resume/generated/${id}/pdf?inline=1`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000)
    } catch {
      showToast('Failed to open resume preview', 'error')
    }
  }

  const deleteGeneratedResume = async (id) => {
    try {
      await API.delete('/api/resume/generated/' + id)
      setGeneratedResumes(prev => prev.filter(r => r._id !== id))
      showToast('Generated resume deleted', 'success')
    } catch {
      showToast('Failed to delete resume', 'error')
    }
  }

  // Load the data each tab needs when it becomes active. Declared after all
  // the refresh callbacks it references (React compiler rules forbid calling
  // ahead of a declaration inside the same component body).
  useEffect(() => {
    if (activeTab === 'analytics') {
      if (!analytics) API.get('/api/analytics/stats').then(r => setAnalytics(r.data)).catch(() => {})
      // eslint-disable-next-line react-hooks/set-state-in-effect
      refreshActivities()
    }
    if (activeTab === 'messages') {
      API.get('/api/messages').then(r => setMessages(r.data)).catch(() => {})
    }
    if (activeTab === 'leads') {
      API.get('/api/leads').then(r => setLeads(r.data.items)).catch(() => {})
    }
    if (activeTab === 'jobs') {
      refreshJobSites()
    }
    if (activeTab === 'job-apps') {
      refreshJobApps()
      refreshPipeline()
    }
    if (activeTab === 'tracking') {
      refreshTracking()
    }
    if (activeTab === 'manual-apply') {
      refreshManualJobs()
    }
    if (activeTab === 'resumes' || activeTab === 'generated') {
      loadGeneratedResumes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Refresh job apps when page or filters change
  useEffect(() => {
    if (activeTab === 'job-apps') {
      // eslint-disable-next-line
      refreshJobApps()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, jobApps.page, jobAppsFilters])

  // Refresh tracking when page or filters change
  useEffect(() => {
    if (activeTab === 'tracking') {
      // eslint-disable-next-line
      refreshTracking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tracking.page, trackingFilters])

  // Refresh manual-apply list when page or filters change
  useEffect(() => {
    if (activeTab === 'manual-apply') {
      // eslint-disable-next-line
      refreshManualJobs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, manualJobs.page, manualFilters])

  // Display-only relative date; Date.now() drift between renders is harmless.
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

  useEffect(() => {
    const fetchAll = async () => {
      try {
          const [profile, skills, experiences, education, certifications, projects, resumes, articles] = await Promise.all([
          API.get('/api/profile'), API.get('/api/skills'),
          API.get('/api/experiences'), API.get('/api/education'),
          API.get('/api/certifications'), API.get('/api/projects'),
          API.get('/api/resume-files'), API.get('/api/admin/articles'),
        ])
        setData({ profile: profile.data || {}, skills: skills.data, experiences: experiences.data, education: education.data, certifications: certifications.data, projects: projects.data, resumes: resumes.data, articles: articles.data })
      } catch (err) { console.error(err) }
    }
    fetchAll()
  }, [])

  const handleLogout = () => { logout(); navigate('/admin') }

  const changePassword = async () => {
    if (passwordForm.newPassword.length < 8) {
      showToast('New password must be at least 8 characters', 'error')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('New passwords do not match', 'error')
      return
    }
    setPasswordSaving(true)
    try {
      const { data } = await API.post('/api/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      showToast(data.message || 'Password changed', 'success')
      setPasswordModal(false)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      logout()
      navigate('/admin')
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to change password', 'error')
    } finally {
      setPasswordSaving(false)
    }
  }

  const saveItem = async (collection, item, id) => {
    setSaving(true)
    try {
      if (id) {
        const { data: updated } = await API.put('/api/' + collection + '/' + id, item)
        setData(prev => ({ ...prev, [collection]: prev[collection].map(i => i._id === id ? updated : i) }))
      } else {
        const { data: created } = await API.post('/api/' + collection, item)
        setData(prev => ({ ...prev, [collection]: [...(prev[collection] || []), created] }))
      }
      setEditing(null)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const deleteItem = async (collection, id) => {
    if (!confirm('Delete this item?')) return
    try {
      // Resume CRUD lives on /api/resume-files (list-only alias is /api/resumes)
      const path = collection === 'resumes' ? 'resume-files' : collection
      await API.delete('/api/' + path + '/' + id)
      setData(prev => ({ ...prev, [collection]: prev[collection].filter(i => i._id !== id) }))
      showToast('Deleted', 'success')
    } catch (err) {
      console.error(err)
      showToast(err.response?.data?.error || 'Delete failed', 'error')
    }
  }

  const setMasterResume = async (id) => {
    try {
      const { data: all } = await API.put('/api/resume-files/' + id + '/master')
      setData(prev => ({ ...prev, resumes: all }))
      showToast('Master resume updated', 'success')
    } catch (err) {
      console.error(err)
      showToast(err.response?.data?.error || 'Failed to set master resume', 'error')
    }
  }

  // Upload into the dedicated Master section: replaces the current master's
  // file, or creates the master record when none exists yet.
  const [masterUploading, setMasterUploading] = useState(false)
  const handleMasterFile = async (file) => {
    if (!file) return
    setMasterUploading(true)
    try {
      const master = (data.resumes || []).find(r => r.isMaster)
      const fd = new FormData()
      fd.append('label', master?.label || 'Master Resume')
      fd.append('file', file)
      if (master) {
        const { data: updated } = await API.put('/api/resume-files/' + master._id, fd)
        setData(prev => ({ ...prev, resumes: prev.resumes.map(r => r._id === master._id ? updated : r) }))
      } else {
        fd.append('isMaster', 'true')
        const { data: created } = await API.post('/api/resume-files', fd)
        setData(prev => ({ ...prev, resumes: [...(prev.resumes || []), created] }))
      }
      showToast('Master resume updated', 'success')
    } catch (err) {
      console.error(err)
      showToast(err.response?.data?.error || 'Master resume upload failed', 'error')
    } finally { setMasterUploading(false) }
  }

  const toggleResumeVisibility = async (item) => {
    try {
      const fd = new FormData()
      fd.append('label', item.label || '')
      fd.append('showOnSite', item.showOnSite === false ? 'true' : 'false')
      const { data: updated } = await API.put('/api/resume-files/' + item._id, fd)
      setData(prev => ({ ...prev, resumes: prev.resumes.map(r => r._id === updated._id ? updated : r) }))
      showToast(updated.showOnSite === false ? 'Hidden from site' : 'Visible on site', 'success')
    } catch (err) {
      console.error(err)
      showToast(err.response?.data?.error || 'Failed to update visibility', 'error')
    }
  }

  const renderSkills = () => (
    <SkillsTab
      items={data.skills || []}
      dark={dark}
      onEdit={(v) => setEditing(v)}
      onDelete={deleteItem}
      onAdd={() => setEditing({ collection: 'skills', id: null })}
    />
  )

  const renderList = (collection, titleField) => (
    <SimpleListTab
      items={data[collection] || []}
      titleField={titleField}
      collection={collection}
      dark={dark}
      onEdit={(v) => setEditing(v)}
      onDelete={deleteItem}
      onAdd={() => setEditing({ collection, id: null })}
    />
  )

  const handleSelectMessage = (msg) => {
    setSelectedMessage(selectedMessage?._id === msg._id ? null : msg)
    if (!msg.read) {
      API.put('/api/messages/' + msg._id + '/read').then(() => {
        setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, read: true } : m))
      })
    }
  }

  const updateLeadStatus = async (id, status) => {
    try {
      const { data } = await API.put('/api/leads/' + id + '/status', { status })
      setLeads(prev => prev.map(l => l._id === id ? data : l))
    } catch (err) { console.error(err) }
  }

  const deleteLead = async (id) => {
    if (!confirm('Delete this lead?')) return
    try {
      await API.delete('/api/leads/' + id)
      setLeads(prev => prev.filter(l => l._id !== id))
    } catch (err) { console.error(err) }
  }

  const deleteMessage = async (id) => {
    if (!confirm('Delete this message?')) return
    try {
      await API.delete('/api/messages/' + id)
      setMessages(prev => prev.filter(m => m._id !== id))
      if (selectedMessage?._id === id) setSelectedMessage(null)
    } catch (err) { console.error(err) }
  }

  // Save the Job Sites credentials modal. Only sends fields the user actually
  // entered — a blank field means "keep existing", so stored creds are never
  // overwritten with masked values.
  const saveCredsModal = async () => {
    const payload = { enabled: true };
    if (String(credsForm.email || '').trim()) payload.email = String(credsForm.email).trim();
    if (String(credsForm.password || '')) payload.password = credsForm.password;
    const ok = await saveJobSite(credsModal.name, payload)
    if (ok && cookiesForm) {
      try {
        await API.put('/api/job-sites/' + credsModal.name + '/cookies', { cookies: cookiesForm })
        showToast('Session cookie saved', 'success')
        await refreshJobSites()
      } catch (err) { showToast(err.response?.data?.error || 'Cookie save failed', 'error') }
    }
    if (ok) setCredsModal(null)
  }

  const handleTogglePipeline = async () => {
    try {
      await API.post('/api/pipeline/' + (pipeline.paused ? 'resume' : 'pause'))
      await refreshPipeline()
      showToast(pipeline.paused ? 'Pipeline resumed' : 'Pipeline paused', 'success')
    } catch (err) { showToast(err.response?.data?.error || 'Failed to update pipeline', 'error') }
  }

  const handleSavePipelineSettings = async () => {
    setBudgetSaving(true)
    try {
      const patch = {}
      for (const [k, v] of Object.entries(pipelineBudget)) {
        if (k === 'notifyEmail' || k === 'notifyDigest') continue
        const n = Number(v)
        if (v !== '' && !isNaN(n)) patch[k] = n
      }
      patch.notifyEmail = pipelineBudget.notifyEmail
      patch.notifyDigest = pipelineBudget.notifyDigest
      await API.put('/api/pipeline/budget', patch)
      await refreshPipeline()
      showToast('Pipeline settings saved', 'success')
    } catch (err) { showToast(err.response?.data?.error || 'Save failed', 'error') }
    finally { setBudgetSaving(false) }
  }

  const handleClearApplyProgress = () => {
    setApplyProgress([])
    setLastBatchId(null)
    try { localStorage.removeItem('lastApplyBatchId') } catch { /* unavailable */ }
  }

  const handleAnswerDraft = (key, value) => setAnswerDraft(trackingDetail?._id, key, value)

  // Live Chat actions (socket + history cache live in the dashboard; the tab
  // only renders and forwards events).
  const handleSelectChat = (session) => {
    setSelectedChat(session)
    if (chatMessagesRef.current[session._id]) {
      setChatMessages(chatMessagesRef.current[session._id])
    } else {
      setChatMessages([])
      API.get('/api/livechat/' + session._id + '/messages').then(({ data }) => {
        chatMessagesRef.current[session._id] = data || []
        setChatMessages(data || [])
      }).catch(() => { /* ignore */ })
    }
  }

  const handleSendChatMessage = () => {
    const msg = chatInput.trim()
    if (!msg || !selectedChat) return
    const socket = chatSocketRef.current
    if (socket) {
      socket.emit('admin:message', { sessionId: selectedChat._id, content: msg })
    }
    setChatMessages((prev) => [...prev, { role: 'admin', content: msg, timestamp: new Date() }])
    setChatInput('')
  }

  const handleEndChat = (sessionId) => {
    if (!confirm('End this chat?')) return
    const socket = chatSocketRef.current
    if (socket) socket.emit('admin:end-chat', { sessionId })
  }

  // `now` ticks for the relative timestamps rendered by the Jobs and
  // Analytics tabs (each tab owns its own formatTimeAgo copy).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const renderTab = () => {
    switch (activeTab) {
      case 'profile': return (
        <ProfileForm
          API={API}
          dark={dark}
          profile={data.profile || {}}
          saving={saving}
          setData={setData}
          setSaving={setSaving}
          showToast={showToast}
        />
      )
      case 'skills': return renderSkills()
      case 'experiences': return renderList('experiences', 'company')
      case 'education': return renderList('education', 'degree')
      case 'certifications': return renderList('certifications', 'name')
      case 'projects': return renderList('projects', 'name')
      case 'resumes': return (
        <ResumesTab
          items={data.resumes || []}
          dark={dark}
          masterUploading={masterUploading}
          onMasterFile={handleMasterFile}
          onEdit={(v) => setEditing(v)}
          onDelete={deleteItem}
          onToggleVisibility={toggleResumeVisibility}
          onSetMaster={setMasterResume}
          onAdd={() => setEditing({ collection: 'resumes', id: null })}
        />
      )
      case 'generated': return (
        <GeneratedResumesTab
          items={generatedResumes}
          loading={generatedResumesLoading}
          dark={dark}
          onRefresh={loadGeneratedResumes}
          onPreview={previewGeneratedResume}
          onDownload={downloadGeneratedResume}
          onDelete={deleteGeneratedResume}
        />
      )
      case 'articles': return (
        <ArticlesTab
          items={data.articles || []}
          dark={dark}
          onEdit={(v) => setEditing(v)}
          onDelete={deleteItem}
          onAdd={() => setEditing({ collection: 'articles', id: null })}
        />
      )
      case 'messages': return (
        <MessagesTab
          messages={messages}
          selectedMessage={selectedMessage}
          dark={dark}
          onSelect={handleSelectMessage}
          onDelete={deleteMessage}
        />
      )
      case 'leads': return (
        <LeadsTab
          leads={leads}
          dark={dark}
          onStatusChange={updateLeadStatus}
          onDelete={deleteLead}
        />
      )
      case 'livechat': return (
        <LiveChatTab
          dark={dark}
          active={chatActive}
          waiting={chatWaiting}
          selected={selectedChat}
          messages={chatMessages}
          input={chatInput}
          endRef={chatEndRef}
          onSelect={handleSelectChat}
          onInputChange={setChatInput}
          onSend={handleSendChatMessage}
          onEnd={handleEndChat}
        />
      )
      case 'analytics': return (
        <AnalyticsTab
          analytics={analytics}
          activities={activities}
          activitiesLoading={activitiesLoading}
          dark={dark}
          now={now}
          onRefresh={refreshActivities}
        />
      )
      case 'jobs': return (
        <JobsTab
          dark={dark}
          now={now}
          jobSites={jobSites}
          loading={jobSitesLoading}
          fetching={fetching}
          fetchResult={fetchResult}
          loginAllInProgress={loginAllInProgress}
          loginAllResult={loginAllResult}
          credsModal={credsModal}
          credsForm={credsForm}
          cookiesForm={cookiesForm}
          showCredsPassword={showCredsPassword}
          credsSaving={credsSaving}
          testingSite={testingSite}
          browserLoginSites={browserLoginSites}
          passwordModal={passwordModal}
          passwordForm={passwordForm}
          passwordSaving={passwordSaving}
          addSiteModal={addSiteModal}
          addSiteForm={addSiteForm}
          addingSite={addingSite}
          setCredsModal={setCredsModal}
          setCredsForm={setCredsForm}
          setCookiesForm={setCookiesForm}
          setShowCredsPassword={setShowCredsPassword}
          setPasswordModal={setPasswordModal}
          setPasswordForm={setPasswordForm}
          setAddSiteModal={setAddSiteModal}
          setAddSiteForm={setAddSiteForm}
          setLoginAllResult={setLoginAllResult}
          onRefresh={refreshJobSites}
          onFetchJobs={fetchJobs}
          onLoginAll={loginAll}
          onToggleSite={toggleSite}
          onTestSite={testJobSite}
          onBrowserLogin={browserLogin}
          onRemoveSite={removeJobSite}
          onSaveCreds={saveCredsModal}
          onChangePassword={changePassword}
          onAddCustomSite={addCustomSite}
        />
      )
      case 'job-apps': return (
        <JobAppsTab
          dark={dark}
          jobApps={jobApps}
          selectedJobs={selectedJobs}
          pipeline={pipeline}
          pipelineBudget={pipelineBudget}
          budgetSaving={budgetSaving}
          filters={jobAppsFilters}
          matchingJobs={matchingJobs}
          applying={applying}
          aiLoading={aiLoading}
          aiResult={aiResult}
          generatingResumeIds={generatingResumeIds}
          applyProgress={applyProgress}
          lastBatchId={lastBatchId}
          jobDetail={jobDetailPanel}
          setPipelineBudget={setPipelineBudget}
          onTogglePipeline={handleTogglePipeline}
          onSavePipelineSettings={handleSavePipelineSettings}
          onSelectAll={handleSelectAll}
          onBulkAction={handleBulkAction}
          onAutoApply={startAutomatedApply}
          onMatchSelected={matchSelectedJobs}
          onGenerateBulk={generateResumesBulk}
          onRefresh={refreshJobApps}
          loading={jobAppsLoading}
          onFilterChange={handleFilterChange}
          onPageChange={handlePageChange}
          onSelectJob={handleSelectJob}
          onOpenDetail={openJobDetail}
          onCloseDetail={closeJobDetail}
          onGenerateResume={generateResumeForJob}
          onCoverLetter={generateCoverLetter}
          onOptimizeResume={optimizeResume}
          onPreviewResume={previewGeneratedResume}
          onDownloadResume={downloadGeneratedResume}
          onClearProgress={handleClearApplyProgress}
        />
      )
      case 'tracking': return (
        <TrackingTab
          dark={dark}
          tracking={tracking}
          filters={trackingFilters}
          loading={trackingLoading}
          detail={trackingDetail}
          onFilterChange={handleTrackingFilterChange}
          onPageChange={handleTrackingPageChange}
          onRefresh={refreshTracking}
          onSelectDetail={setTrackingDetail}
          onCloseDetail={() => setTrackingDetail(null)}
          onRetry={retryApplication}
          onAnswerDraft={handleAnswerDraft}
          onSubmitAnswers={submitApplicationAnswers}
        />
      )
      case 'manual-apply': return (
        <ManualApplyTab
          dark={dark}
          manualJobs={manualJobs}
          jobSites={jobSites}
          filters={manualFilters}
          loading={manualLoading}
          addJobModal={addJobModal}
          addJobForm={addJobForm}
          addingJob={addingJob}
          setAddJobForm={setAddJobForm}
          onFilterChange={handleManualFilterChange}
          onPageChange={handleManualPageChange}
          onRefresh={() => setManualJobs(prev => ({ ...prev, page: 1 }))}
          onOpenAddModal={openAddJobModal}
          onCloseAddModal={() => setAddJobModal(null)}
          onAddJob={addManualJob}
          onMarkApplied={markManualApplied}
          onMarkPass={markManualPass}
        />
      )
      case 'social': return <SocialTab API={API} dark={dark} showToast={showToast} />
      default: return null
    }
  }

  return (
    <div className={'min-h-screen ' + (dark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900')}>
      {/* Toast notification */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={'fixed top-4 right-4 z-50 flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-xl text-sm font-medium ' + (
            toast.type === 'error' ? 'bg-red-500 text-white'
              : toast.type === 'warning' ? 'bg-amber-500 text-white'
              : toast.type === 'info' ? 'bg-blue-500 text-white'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
          )}
        >
          {toast.type === 'error' ? <AlertCircle size={18} />
            : toast.type === 'warning' ? <AlertCircle size={18} />
            : toast.type === 'info' ? <Bell size={18} />
            : <CheckCircle2 size={18} />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 p-0.5 rounded hover:bg-white/20 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </motion.div>
      )}
      <header className={'sticky top-0 z-40 border-b ' + (dark ? 'bg-gray-900/90 backdrop-blur-xl border-gray-800' : 'bg-white/80 backdrop-blur-xl border-gray-200')}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">Portfolio Admin</h1>
          <div className="flex items-center gap-3">
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen(o => !o)}
                className={'relative p-2 rounded-full cursor-pointer transition-colors ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                <Bell size={18} />
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className={'absolute right-0 top-12 w-80 max-h-96 overflow-y-auto rounded-2xl border shadow-xl z-50 ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
                  <div className={'flex items-center justify-between px-4 py-3 border-b ' + (dark ? 'border-gray-700' : 'border-gray-200')}>
                    <p className="text-sm font-semibold">Notifications</p>
                    {notificationCount > 0 && (
                      <button onClick={markAllNotificationsRead}
                        className="text-xs text-blue-500 hover:text-blue-400 cursor-pointer font-medium">Mark all read</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className={'px-4 py-6 text-sm text-center ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No notifications yet</p>
                  ) : notifications.map(n => {
                    const meta = NOTIFICATION_TYPES[n.type] || NOTIFICATION_TYPES.system
                    const Icon = meta.icon
                    return (
                      <button key={n._id} onClick={() => openNotification(n)}
                        className={'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer border-b ' + (dark ? 'border-gray-800 hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50')}>
                        <Icon size={16} className={'mt-0.5 flex-shrink-0 ' + meta.color} />
                        <div className="flex-1 min-w-0">
                          <p className={'text-sm font-medium ' + (dark ? 'text-gray-200' : 'text-gray-800')}>{n.title}</p>
                          {n.body && <p className={'text-xs mt-0.5 leading-snug ' + (dark ? 'text-gray-500' : 'text-gray-500')}>{n.body}</p>}
                          <p className={'text-[10px] mt-1 ' + (dark ? 'text-gray-600' : 'text-gray-400')}>{formatDate(n.createdAt)}</p>
                        </div>
                        {!n.read && <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <button onClick={toggle} className={'p-2 rounded-full cursor-pointer ' + (dark ? 'bg-gray-800 text-yellow-400' : 'bg-gray-100 text-gray-600')}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setPasswordModal(true)} className={'flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              <KeyRound size={16} /> Change Password
            </button>
            <button onClick={handleLogout} className={'flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
        <aside className="hidden md:flex flex-col gap-1 w-48 flex-shrink-0">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ' + (activeTab === tab.key
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                  : (dark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'))}>
                <Icon size={18} />
                {tab.label}
              </button>
            )
          })}
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex md:hidden gap-2 mb-4 overflow-x-auto pb-2">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all cursor-pointer ' + (activeTab === tab.key
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white'
                    : (dark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'))}>
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={'p-6 rounded-2xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
            <h2 className="text-xl font-bold mb-6 capitalize">{activeTab}</h2>
            {renderTab()}
          </motion.div>
        </div>
      </div>

      <EditModal
        API={API}
        dark={dark}
        editing={editing}
        saveItem={saveItem}
        saving={saving}
        setData={setData}
        setEditing={setEditing}
        setSaving={setSaving}
      />
    </div>
  )
}
