import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useApiAuth } from '../lib/api'
import { motion } from 'framer-motion'
import { io } from 'socket.io-client'
import { LogOut, Sun, Moon, Plus, Edit3, Trash2, X, User, Code2, Briefcase, GraduationCap, Award, FolderGit2, FileText, BarChart3, Mail, MailOpen, Eye, Download, Clock, CheckCircle2, AlertCircle, BookOpen, Phone, PhoneCall, MessagesSquare, Send, MessageCircle, Users, Globe, RefreshCw, Loader2, Filter, Search, ChevronLeft, ChevronRight, CheckSquare, Square, Target, Zap, Briefcase as BriefcaseIcon, ExternalLink, EyeOff, ListTodo, History, RotateCcw, Bell, CheckCheck, PauseCircle, PlayCircle, UserCheck, XCircle, Banknote, Star, Upload, LogIn, KeyRound } from 'lucide-react'
import EditModal from '../features/admin/components/EditModal'
import ProfileForm from '../features/admin/components/ProfileForm'

const tabs = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'skills', label: 'Skills', icon: Code2 },
  { key: 'experiences', label: 'Experience', icon: Briefcase },
  { key: 'education', label: 'Education', icon: GraduationCap },
  { key: 'certifications', label: 'Certifications', icon: Award },
  { key: 'projects', label: 'Projects', icon: FolderGit2 },
  { key: 'resumes', label: 'Resumes', icon: FileText },
  { key: 'articles', label: 'Blog', icon: BookOpen },
  { key: 'messages', label: 'Messages', icon: Mail },
  { key: 'leads', label: 'Leads', icon: Phone },
  { key: 'livechat', label: 'Live Chat', icon: MessagesSquare },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'jobs', label: 'Job Sites', icon: Globe },
  { key: 'job-apps', label: 'Job Applications', icon: BriefcaseIcon },
  { key: 'tracking', label: 'Tracking', icon: ListTodo },
  { key: 'manual-apply', label: 'Manual Apply', icon: UserCheck },
]

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
  const [bulkAction, setBulkAction] = useState(null) // 'apply' | 'pass'
  const [applying, setApplying] = useState(false)
  const [lastBatchId, setLastBatchId] = useState(null)
  const [applyProgress, setApplyProgress] = useState([])
  const applySocketRef = useRef(null)
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
    if (activeTab === 'resumes') {
      loadGeneratedResumes()
    }
  }, [activeTab, refreshActivities])

  // Refresh job apps when page or filters change
  useEffect(() => {
    if (activeTab === 'job-apps') {
      refreshJobApps()
    }
  }, [activeTab, jobApps.page, jobAppsFilters])

  // Refresh tracking when page or filters change
  useEffect(() => {
    if (activeTab === 'tracking') {
      refreshTracking()
    }
  }, [activeTab, tracking.page, trackingFilters])

  // Refresh manual-apply list when page or filters change
  useEffect(() => {
    if (activeTab === 'manual-apply') {
      refreshManualJobs()
    }
  }, [activeTab, manualJobs.page, manualFilters])

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
    try {
      const { data } = await API.post('/api/job-sites/' + name + '/test')
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
    } catch (err) { showToast('Remove failed', 'error') }
  }

  const toggleSite = async (name, enabled) => {
    const site = jobSites.find(s => s.name === name)
    const ok = await saveJobSite(name, { email: site?.credentials?.email || '', enabled })
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
    })

    // In-app notifications arrive over the same admin socket connection.
    socket.on('notify:inapp', (data) => {
      setNotifications(prev => [data, ...prev].slice(0, 50))
      if (!data.read) setNotificationCount(c => c + 1)
      if (data.type === 'apply_failed' || data.type === 'needs_input') {
        showToast(data.title + (data.body ? ' — ' + data.body : ''), 'warning')
      } else if (data.type === 'apply_success') {
        showToast(data.title, 'success')
        if (activeTab === 'job-apps') refreshJobApps()
      } else if (data.type === 'batch_complete') {
        showToast(data.title + (data.body ? ' — ' + data.body : ''), 'info')
      } else if (data.type === 'pipeline_paused' || data.type === 'ai_budget') {
        showToast(data.title, 'warning')
      } else if (data.type === 'pipeline_resumed') {
        showToast(data.title, 'success')
      }
    })

    return () => { socket.disconnect() }
  }, [token, showToast, activeTab, refreshJobApps])

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
          setJobDetailPanel({ ...job, matchScore: matched.score, matchedKeywords: matched.matched, missingKeywords: matched.missing, reasoning: matched.reasoning })
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
    } catch (err) {
      showToast('Matching failed', 'error')
    } finally { setMatchingJobs(false) }
  }

  const handleBulkAction = async (action) => {
    const selectedItems = jobApps.items.filter(item => selectedJobs.has(item._id))
    const ids = action === 'apply'
      ? selectedItems.filter(i => i.status !== 'applied').map(i => i._id)
      : selectedItems.filter(i => i.status !== 'passed').map(i => i._id)
    if (!ids.length) return
    try {
      const newStatus = action === 'apply' ? 'applied' : 'passed'
      await Promise.all(ids.map(id => API.put('/api/jobs/' + id, { status: newStatus })))
      setJobApps(prev => ({
        ...prev,
        items: prev.items.map(item => ids.includes(item._id) ? { ...item, status: newStatus, applied: action === 'apply' } : item)
      }))
      setSelectedJobs(new Set())
      if (action === 'apply') {
        showToast(`${ids.length} jobs marked as applied`, 'success')
      } else {
        showToast(`${ids.length} jobs marked as passed`, 'success')
      }
    } catch (err) {
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
      setApplyProgress([])
      setSelectedJobs(new Set())
      showToast(`${data.queued} jobs queued for automated apply`, 'success')
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to queue jobs', 'error')
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

  const formatDateTime = (date) => {
    if (!date) return ''
    const d = new Date(date)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

  const deleteGeneratedResume = async (id) => {
    try {
      await API.delete('/api/resume/generated/' + id)
      setGeneratedResumes(prev => prev.filter(r => r._id !== id))
      showToast('Generated resume deleted', 'success')
    } catch (err) {
      showToast('Failed to delete resume', 'error')
    }
  }

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

  useEffect(() => {
    const fetchAll = async () => {
      try {
          const [profile, skills, experiences, education, certifications, projects, resumes, articles] = await Promise.all([
          API.get('/api/profile'), API.get('/api/skills'),
          API.get('/api/experiences'), API.get('/api/education'),
          API.get('/api/certifications'), API.get('/api/projects'),
          API.get('/api/resumes'), API.get('/api/admin/articles'),
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

  const renderSkills = () => {
    const items = data.skills || []
    return (
      <div className="space-y-3">
        {items.map(cat => (
          <div key={cat._id} className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">{cat.category}</h4>
              <div className="flex gap-1">
                <button onClick={() => setEditing({ collection: 'skills', id: cat._id, data: cat })}
                  className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Edit3 size={14} /></button>
                <button onClick={() => deleteItem('skills', cat._id)}
                  className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {cat.items?.map(s => (
                <span key={s.name} className={'px-2.5 py-1 rounded-lg text-xs font-medium ' + (dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600')}>
                  {s.name} ({s.level}%)
                </span>
              ))}
            </div>
          </div>
        ))}
        <button onClick={() => setEditing({ collection: 'skills', id: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all cursor-pointer">
          <Plus size={16} /> Add Category
        </button>
      </div>
    )
  }

  const renderList = (collection, titleField) => {
    const items = data[collection] || []
    return (
      <div className="space-y-3">
        {items.map(item => (
          <div key={item._id} className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{item[titleField] || 'Untitled'}</p>
                <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                  {item.company || item.institution || item.issuer || item.role || ''}
                  {item.startDate ? ' | ' + item.startDate + ' - ' + (item.endDate || 'Present') : ''}
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditing({ collection, id: item._id, data: item })}
                  className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Edit3 size={16} /></button>
                <button onClick={() => deleteItem(collection, item._id)}
                  className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        <button onClick={() => setEditing({ collection, id: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all cursor-pointer">
          <Plus size={16} /> Add New
        </button>
      </div>
    )
  }

  const renderResumes = () => {
    const items = data.resumes || []
    const master = items.find(i => i.isMaster) || null
    const others = items.filter(i => !i.isMaster)
    return (
      <div className="space-y-6">
        {/* Generated (ATS) Resumes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-violet-500" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Generated Resumes (ATS)</h3>
            </div>
            <button onClick={loadGeneratedResumes} disabled={generatedResumesLoading}
              className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              <RefreshCw size={12} className={generatedResumesLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
          {generatedResumesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-violet-500" />
            </div>
          ) : generatedResumes.length === 0 ? (
            <p className={'text-sm text-center py-8 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>
              No generated resumes yet. Use "Generate Resume" on a job (or the bulk button in Job Applications) to create ATS-tailored resumes.
            </p>
          ) : (
            <div className="space-y-2">
              {generatedResumes.map(item => (
                <div key={item._id} className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{item.pdfFilename || 'Generated Resume'}</p>
                      <p className={'text-sm mt-0.5 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                        {item.createdAt ? 'Generated ' + new Date(item.createdAt).toLocaleDateString() : ''}
                        {item.keywordsMatched?.length ? ' · ' + item.keywordsMatched.length + ' keywords matched' : ''}
                      </p>
                      {item.content && (
                        <p className={'text-xs mt-2 whitespace-pre-wrap line-clamp-2 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{item.content}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => downloadGeneratedResume(item._id, item.pdfFilename)}
                        className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-emerald-400' : 'hover:bg-gray-200 text-emerald-600')}><Download size={16} /></button>
                      <button onClick={() => deleteGeneratedResume(item._id)}
                        className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Master Resume */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Star size={16} className="text-emerald-500" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Master Resume</h3>
          </div>
          <p className={'text-xs mb-3 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>
            The base resume used for every ATS-tailored resume and job application. Uploading here replaces it — formatting is preserved and JD keywords are added inside its Skills section.
          </p>
          {master ? (
            <div className={'p-4 rounded-xl border-2 border-emerald-500/60 ' + (dark ? 'bg-gray-800' : 'bg-emerald-50/40')}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold flex items-center gap-2">
                    {master.label}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-500 border border-emerald-500/40">Master</span>
                  </p>
                  <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                    {master.fileUrl?.split('/').pop()}
                    <span className="ml-2 text-xs opacity-70">· Always hidden from public site</span>
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0 items-center">
                  <label className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ' + (masterUploading ? 'opacity-50 pointer-events-none ' : '') + (dark ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200')}>
                    {masterUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    {masterUploading ? 'Uploading...' : 'Replace File'}
                    <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleMasterFile(f); e.target.value = '' }} />
                  </label>
                  <button onClick={() => setEditing({ collection: 'resumes', id: master._id, data: master })}
                    className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Edit3 size={16} /></button>
                  <button onClick={() => deleteItem('resumes', master._id)}
                    className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ) : (
            <label className={'flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ' + (dark ? 'border-gray-700 hover:border-emerald-500/60 hover:bg-gray-800/50' : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50/30')}>
              {masterUploading ? <Loader2 size={24} className="animate-spin text-emerald-500" /> : <Upload size={24} className="text-emerald-500" />}
              <span className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-600')}>
                {masterUploading ? 'Uploading...' : 'Upload Master Resume (PDF / DOCX)'}
              </span>
              <span className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>DOCX recommended — keywords are merged into its Skills section</span>
              <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleMasterFile(f); e.target.value = '' }} />
            </label>
          )}
        </div>

        {/* Other Resume Files */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Other Resume Files</h3>
          </div>
          <div className="space-y-3">
            {others.length === 0 && (
              <p className={'text-sm py-2 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No other resumes. Use the star on any resume to promote it to Master.</p>
            )}
            {others.map(item => (
              <div key={item._id} className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold flex items-center gap-2">
                      {item.label}
                      {item.showOnSite === false && (
                        <span className={'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ' + (dark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')}>Hidden</span>
                      )}
                    </p>
                    <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{item.fileUrl?.split('/').pop()}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => toggleResumeVisibility(item)} title={item.showOnSite === false ? 'Hidden from public site — click to show' : 'Visible on public site — click to hide'}
                      className={'p-2 rounded-lg cursor-pointer ' + (item.showOnSite === false ? (dark ? 'hover:bg-gray-700 text-gray-500' : 'hover:bg-gray-200 text-gray-400') : (dark ? 'hover:bg-gray-700 text-cyan-400' : 'hover:bg-gray-200 text-cyan-600'))}>
                      {item.showOnSite === false ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button onClick={() => setMasterResume(item._id)} title="Set as master resume"
                      className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-gray-500 hover:text-emerald-400' : 'hover:bg-gray-200 text-gray-400 hover:text-emerald-600')}>
                      <Star size={16} />
                    </button>
                    <button onClick={() => setEditing({ collection: 'resumes', id: item._id, data: item })}
                      className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Edit3 size={16} /></button>
                    <button onClick={() => deleteItem('resumes', item._id)}
                      className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setEditing({ collection: 'resumes', id: null })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all cursor-pointer">
              <Plus size={16} /> Add Resume
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderArticles = () => {
    const items = data.articles || []
    return (
      <div className="space-y-3">
        {items.map(item => (
          <div key={item._id} className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{item.title}</p>
                  {!item.published && (
                    <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (dark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-700')}>
                      Draft
                    </span>
                  )}
                </div>
                <p className={'text-sm mt-0.5 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                  {item.tags?.join(', ')} {item.createdAt ? '| ' + new Date(item.createdAt).toLocaleDateString() : ''}
                </p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditing({ collection: 'articles', id: item._id, data: item })}
                  className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Edit3 size={16} /></button>
                <button onClick={() => deleteItem('articles', item._id)}
                  className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        <button onClick={() => setEditing({ collection: 'articles', id: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 transition-all cursor-pointer">
          <Plus size={16} /> New Article
        </button>
      </div>
    )
  }

  const renderMessages = () => {
    if (!messages.length) return <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>No messages yet.</p>
    return (
      <div className="space-y-3">
        {messages.map(msg => (
          <div key={msg._id}
            className={'p-4 rounded-xl border cursor-pointer transition-all ' + (
              selectedMessage?._id === msg._id
                ? 'border-blue-500 ' + (dark ? 'bg-blue-500/10' : 'bg-blue-50')
                : msg.read
                  ? (dark ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-gray-50 border-gray-200 hover:border-gray-300')
                  : (dark ? 'bg-gray-800 border-blue-500/30 hover:border-blue-500/50' : 'bg-white border-blue-200 hover:border-blue-300')
            )}
            onClick={() => {
              setSelectedMessage(selectedMessage?._id === msg._id ? null : msg)
              if (!msg.read) {
                API.put('/api/messages/' + msg._id + '/read').then(() => {
                  setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, read: true } : m))
                })
              }
            }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {msg.read ? <MailOpen size={16} className="text-gray-400" /> : <Mail size={16} className="text-blue-500" />}
                  <p className={'font-semibold truncate ' + (!msg.read && (dark ? 'text-white' : 'text-gray-900'))}>{msg.name}</p>
                  {!msg.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                </div>
                <p className={'text-sm truncate mt-1 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                  {msg.subject || '(no subject)'} — {msg.message.slice(0, 60)}...
                </p>
                <p className={'text-xs mt-1 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>
                  {new Date(msg.createdAt).toLocaleString()}
                </p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteMessage(msg._id) }}
                className={'p-2 rounded-lg flex-shrink-0 cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}>
                <Trash2 size={16} />
              </button>
            </div>
            {selectedMessage?._id === msg._id && (
              <div className={'mt-4 pt-4 border-t ' + (dark ? 'border-gray-700' : 'border-gray-200')}>
                <p className={'text-sm mb-2 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                  <strong>From:</strong> {msg.name} ({msg.email})
                </p>
                {msg.subject && <p className={'text-sm mb-2 ' + (dark ? 'text-gray-400' : 'text-gray-500')}><strong>Subject:</strong> {msg.subject}</p>}
                <p className={'text-sm whitespace-pre-wrap ' + (dark ? 'text-gray-300' : 'text-gray-700')}>{msg.message}</p>
                <a href={'mailto:' + msg.email + '?subject=Re: ' + (msg.subject || 'Your message')}
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all">
                  <Mail size={14} /> Reply via Email
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  const renderLeads = () => {
    if (!leads.length) return <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>No leads yet. Leads appear when visitors share their contact info via the chat assistant.</p>
    return (
      <div className="space-y-3">
        {leads.map(lead => (
          <div key={lead._id}
            className={'p-4 rounded-xl border transition-all ' + (
              lead.status === 'new'
                ? (dark ? 'bg-gray-800 border-emerald-500/30' : 'bg-white border-emerald-200')
                : (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')
            )}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <PhoneCall size={16} className={lead.status === 'new' ? 'text-emerald-500' : 'text-gray-400'} />
                  <p className={'font-semibold truncate ' + (lead.status === 'new' && (dark ? 'text-white' : 'text-gray-900'))}>{lead.name || 'Unknown'}</p>
                  {lead.status === 'new' && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  {lead.phone && (
                    <a href={'tel:' + lead.phone} className={'text-sm font-medium flex items-center gap-1 ' + (dark ? 'text-blue-400' : 'text-blue-600')}>
                      <Phone size={12} /> {lead.phone}
                    </a>
                  )}
                  {lead.email && (
                    <a href={'mailto:' + lead.email} className={'text-sm ' + (dark ? 'text-blue-400' : 'text-blue-600')}>{lead.email}</a>
                  )}
                  <span className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{new Date(lead.createdAt).toLocaleString()}</span>
                </div>
                {lead.message && (
                  <p className={'text-sm mt-2 line-clamp-2 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{lead.message}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <select value={lead.status} onChange={(e) => updateLeadStatus(lead._id, e.target.value)}
                  className={'text-xs px-2 py-1 rounded-lg border cursor-pointer ' + (
                    dark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-700'
                  )}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="closed">Closed</option>
                </select>
                <button onClick={() => deleteLead(lead._id)}
                  className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
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

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

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

  const renderAnalytics = () => {
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
            <button onClick={refreshActivities} disabled={activitiesLoading}
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

  const renderJobs = () => {
    const connectedCount = jobSites.filter(s => s.status === 'connected').length
    const enabledCount = jobSites.filter(s => s.enabled).length

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
          <button onClick={refreshJobSites} disabled={jobSitesLoading}
            className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            <RefreshCw size={14} className={jobSitesLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => { setAddSiteModal(true); setAddSiteForm({ label: '', baseUrl: '' }) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:from-fuchsia-700 hover:to-pink-600 transition-all cursor-pointer">
            <Plus size={16} /> Add Site
          </button>
          <button onClick={fetchJobs} disabled={fetching || enabledCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50 cursor-pointer">
            {fetching ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {fetching ? 'Fetching...' : 'Fetch Jobs'}
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

        {/* Site cards */}
        {jobSitesLoading ? (
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
                    <button onClick={() => toggleSite(site.name, !site.enabled)}
                      className={'relative w-11 h-6 rounded-full transition-colors cursor-pointer ' + (site.enabled ? 'bg-blue-500' : (dark ? 'bg-gray-600' : 'bg-gray-300'))}>
                      <span className={'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ' + (site.enabled ? 'translate-x-5' : '')} />
                    </button>
                    {/* Edit */}
                    <button onClick={() => { setCredsModal({ name: site.name, label: site.label }); setCredsForm({ email: '', password: '' }); setCookiesForm('') }}
                      className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}>
                      <Edit3 size={16} />
                    </button>
                    {/* Test */}
                    {(() => {
                      const TestIcon = testingSite === site.name ? Loader2 : CheckCircle2
                      return (
                        <button onClick={() => testJobSite(site.name)} disabled={testingSite === site.name || (!site.credentials?.email && !site.hasCookies)}
                          className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-emerald-400' : 'hover:bg-gray-200 text-emerald-600') + ' disabled:opacity-40'}>
                          <TestIcon size={16} className={testingSite === site.name ? 'animate-spin' : ''} />
                        </button>
                      )
                    })()}
                    {/* Assisted browser login */}
                    {(() => {
                      const LoginIcon = browserLoginSites.includes(site.name) ? Loader2 : LogIn
                      return (
                        <button onClick={() => browserLogin(site.name)} disabled={browserLoginSites.includes(site.name)}
                          title="Open a browser window to log in — session is captured automatically"
                          className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-fuchsia-400' : 'hover:bg-gray-200 text-fuchsia-600') + ' disabled:opacity-40'}>
                          <LoginIcon size={16} className={browserLoginSites.includes(site.name) ? 'animate-spin' : ''} />
                        </button>
                      )
                    })()}
                    {/* Remove */}
                    <button onClick={() => removeJobSite(site.name)}
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
                <button onClick={async () => {
                  const ok = await saveJobSite(credsModal.name, { email: credsForm.email, password: credsForm.password, enabled: true })
                  if (ok && cookiesForm) {
                    try {
                      await API.put('/api/job-sites/' + credsModal.name + '/cookies', { cookies: cookiesForm })
                      showToast('Session cookie saved', 'success')
                      await refreshJobSites()
                    } catch (err) { showToast(err.response?.data?.error || 'Cookie save failed', 'error') }
                  }
                  if (ok) setCredsModal(null)
                }} disabled={credsSaving}
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
                <button onClick={changePassword} disabled={passwordSaving}
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
                <button onClick={addCustomSite} disabled={addingSite}
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

  const renderJobApps = () => {
    const { items, total, page, pages } = jobApps
    const hasSelection = selectedJobs.size > 0
    const selectedItems = items.filter(item => selectedJobs.has(item._id))
    const applyableCount = selectedItems.filter(i => i.status !== 'applied').length
    const passableCount = selectedItems.filter(i => i.status !== 'applied' && i.status !== 'passed').length
    const matchableCount = selectedItems.filter(i => i.status !== 'applied' && !i.matchScore).length

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
              <button onClick={async () => {
                try {
                  await API.post('/api/pipeline/' + (pipeline.paused ? 'resume' : 'pause'))
                  await refreshPipeline()
                  showToast(pipeline.paused ? 'Pipeline resumed' : 'Pipeline paused', 'success')
                } catch (err) { showToast(err.response?.data?.error || 'Failed to update pipeline', 'error') }
              }} className={'px-3 py-1.5 rounded-xl text-sm font-medium text-white cursor-pointer transition-all ' + (pipeline.paused
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
              <button onClick={async () => {
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
              }} disabled={budgetSaving}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50 cursor-pointer">
                {budgetSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Settings
              </button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleSelectAll} disabled={!items.length}
            className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {hasSelection && selectedJobs.size === items.length ? <CheckSquare size={16} /> : <Square size={16} />}
            {hasSelection && selectedJobs.size === items.length ? 'Deselect All' : 'Select All'}
          </button>
          {hasSelection && (
            <>
              <button onClick={() => handleBulkAction('apply')} disabled={matchingJobs || applying || !applyableCount}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                <Zap size={16} /> Mark Applied ({applyableCount})
              </button>
              <button onClick={startAutomatedApply} disabled={matchingJobs || applying || !applyableCount}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {applying ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {applying ? 'Queuing...' : `Auto Apply (${applyableCount})`}
              </button>
              <button onClick={() => handleBulkAction('pass')} disabled={matchingJobs || applying || !passableCount}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Pass ({passableCount})
              </button>
              <button onClick={matchSelectedJobs} disabled={matchingJobs || applying || !matchableCount}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {matchingJobs ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
                {matchingJobs ? 'Matching...' : `Match (${matchableCount})`}
              </button>
              <button onClick={generateResumesBulk} disabled={generatingResumeIds.size > 0}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:from-fuchsia-700 hover:to-pink-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {generatingResumeIds.size > 0 ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {generatingResumeIds.size > 0 ? `Generating (${generatingResumeIds.size})...` : `Generate Resumes (${selectedItems.length})`}
              </button>
            </>
          )}
          <div className="flex-1" />
          <button onClick={refreshJobApps} disabled={jobAppsLoading}
            className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            <RefreshCw size={14} className={jobAppsLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className={'absolute left-3 top-1/2 -translate-y-1/2 ' + (dark ? 'text-gray-500' : 'text-gray-400')} />
            <input type="text" value={jobAppsFilters.q} onChange={e => handleFilterChange('q', e.target.value)}
              placeholder="Search title or company..."
              className={'w-full pl-9 pr-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400')} />
          </div>
          <select value={jobAppsFilters.site} onChange={e => handleFilterChange('site', e.target.value)}
            className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700')}>
            <option value="">All Sites</option>
            <option value="naukri">Naukri</option>
            <option value="indeed">Indeed</option>
            <option value="workatastartup">Work at a Startup</option>
            <option value="wellfound">Wellfound</option>
            <option value="linkedin">LinkedIn</option>
          </select>
          <select value={jobAppsFilters.status} onChange={e => handleFilterChange('status', e.target.value)}
            className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700')}>
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="pending">Pending</option>
            <option value="applied">Applied</option>
            <option value="passed">Passed</option>
            <option value="not_applied">Not Applied</option>
            <option value="expired">Expired</option>
          </select>
          <select value={jobAppsFilters.age} onChange={e => handleFilterChange('age', e.target.value)}
            className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700')}>
            <option value="">Any Time</option>
            <option value="24h">Last 24h</option>
            <option value="3d">Last 3 days</option>
            <option value="7d">Last week</option>
            <option value="14d">Last 2 weeks</option>
          </select>
          <select value={jobAppsFilters.minScore} onChange={e => handleFilterChange('minScore', e.target.value)}
            className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700')}>
            <option value="">Any Score</option>
            <option value="80">≥ 80%</option>
            <option value="60">≥ 60%</option>
            <option value="40">≥ 40%</option>
          </select>
        </div>

        {/* Job tiles */}
        {jobAppsLoading ? (
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
                  selectedJobs.has(job._id)
                    ? (dark ? 'bg-blue-500/10 border-blue-500/40' : 'bg-blue-50 border-blue-300')
                    : (dark ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-white border-gray-200 hover:border-gray-300')
                )}
                onClick={() => openJobDetail(job)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button onClick={e => { e.stopPropagation(); handleSelectJob(job._id) }}
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
                          : (dark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-700')
                      )}>{job.site}</span>
                      <span className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{formatDate(job.postedDate)}</span>
                      {job.status === 'applied' && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">Applied</span>}
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
            <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}
              className={'p-2 rounded-xl cursor-pointer disabled:opacity-40 ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              <ChevronLeft size={18} />
            </button>
            <span className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>Page {page} of {pages}</span>
            <button onClick={() => handlePageChange(page + 1)} disabled={page >= pages}
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
                  <button onClick={() => { setApplyProgress([]); setLastBatchId(null) }}
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
        {jobDetailPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50" onClick={closeJobDetail}>
            <div className={'w-full max-w-lg h-full overflow-y-auto p-6 border-l ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Job Details</h3>
                <button onClick={closeJobDetail} className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700' : 'hover:bg-gray-200')}>
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-lg">{jobDetailPanel.title}</p>
                  <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                    {jobDetailPanel.company} {jobDetailPanel.location ? '· ' + jobDetailPanel.location : ''}
                  </p>
                  <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                    {jobDetailPanel.salary && 'Salary: ' + jobDetailPanel.salary + ' · '}
                    Posted: {formatDate(jobDetailPanel.postedDate)} · {jobDetailPanel.site}
                  </p>
                </div>

                {/* Match Score */}
                <div className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                  <div className="flex items-center gap-3">
                    <div className={'w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ' + getScoreBg(jobDetailPanel.matchScore) + ' text-white'}>
                      {jobDetailPanel.matchScore !== null && jobDetailPanel.matchScore !== undefined ? jobDetailPanel.matchScore : '?'}
                    </div>
                    <div>
                      <p className="font-semibold">Match Score</p>
                      <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                        {jobDetailPanel.reasoning || (jobDetailPanel.matchScore ? `${jobDetailPanel.matchScore}% match with your profile` : 'Not matched yet')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Matched Keywords */}
                {jobDetailPanel.matchedKeywords?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 text-emerald-500">✓ Matched Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {jobDetailPanel.matchedKeywords.map((kw, i) => (
                        <span key={i} className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Keywords */}
                {jobDetailPanel.missingKeywords?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 text-red-500">✗ Missing Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {jobDetailPanel.missingKeywords.map((kw, i) => (
                        <span key={i} className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-500">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Job Description */}
                {jobDetailPanel.description && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Job Description</p>
                    <div className={'text-sm whitespace-pre-wrap max-h-64 overflow-y-auto p-3 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700')}>
                      {jobDetailPanel.description}
                    </div>
                  </div>
                )}

                {/* AI Tools */}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => generateResumeForJob(jobDetailPanel)} disabled={aiLoading || generatingResumeIds.has(jobDetailPanel._id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:from-fuchsia-700 hover:to-pink-600 transition-all disabled:opacity-50 cursor-pointer">
                      {generatingResumeIds.has(jobDetailPanel._id) ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                      {generatingResumeIds.has(jobDetailPanel._id) ? 'Generating...' : (jobDetailPanel.resumeId ? 'Regenerate Resume' : 'Generate Resume')}
                    </button>
                    <button onClick={() => generateCoverLetter(jobDetailPanel)} disabled={aiLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 cursor-pointer">
                      {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                      Cover Letter
                    </button>
                    <button onClick={() => optimizeResume(jobDetailPanel)} disabled={aiLoading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600 transition-all disabled:opacity-50 cursor-pointer">
                      {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
                      Optimize Resume
                    </button>
                  </div>
                  {jobDetailPanel.resumeId && (
                    <button onClick={() => downloadGeneratedResume(jobDetailPanel.resumeId)}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all cursor-pointer">
                      <Download size={16} /> View Attached Resume
                    </button>
                  )}
                  {aiResult && (
                    <div className={'p-3 rounded-xl border text-sm whitespace-pre-wrap max-h-64 overflow-y-auto ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700')}>
                      {aiResult}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {jobDetailPanel.status !== 'applied' && (
                    <button onClick={() => { handleBulkAction('apply'); closeJobDetail() }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all cursor-pointer">
                      <Zap size={16} /> Mark Applied
                    </button>
                  )}
                  {jobDetailPanel.status !== 'passed' && (
                    <button onClick={() => { handleBulkAction('pass'); closeJobDetail() }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-all cursor-pointer">
                      Pass
                    </button>
                  )}
                  {jobDetailPanel.url && (
                    <a href={jobDetailPanel.url} target="_blank" rel="noopener noreferrer"
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

  const renderTracking = () => {
    const { items, total, page, pages } = tracking

    return (
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={trackingFilters.site} onChange={e => handleTrackingFilterChange('site', e.target.value)}
            className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700')}>
            <option value="">All Sites</option>
            <option value="naukri">Naukri</option>
            <option value="indeed">Indeed</option>
            <option value="workatastartup">Work at a Startup</option>
            <option value="wellfound">Wellfound</option>
            <option value="linkedin">LinkedIn</option>
          </select>
          <select value={trackingFilters.status} onChange={e => handleTrackingFilterChange('status', e.target.value)}
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
          <select value={trackingFilters.via} onChange={e => handleTrackingFilterChange('via', e.target.value)}
            className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700')}>
            <option value="">Any Source</option>
            <option value="system">System</option>
            <option value="imported">Imported</option>
            <option value="manual">Manual</option>
          </select>
          <div className="flex-1" />
          <button onClick={refreshTracking} disabled={trackingLoading}
            className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            <RefreshCw size={14} className={trackingLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Application cards */}
        {trackingLoading ? (
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
                  onClick={() => setTrackingDetail(app)}>
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
                        <button onClick={e => { e.stopPropagation(); retryApplication(app) }}
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
            <button onClick={() => handleTrackingPageChange(page - 1)} disabled={page <= 1}
              className={'p-2 rounded-xl cursor-pointer disabled:opacity-40 ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              <ChevronLeft size={18} />
            </button>
            <span className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>Page {page} of {pages} · {total} total</span>
            <button onClick={() => handleTrackingPageChange(page + 1)} disabled={page >= pages}
              className={'p-2 rounded-xl cursor-pointer disabled:opacity-40 ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* Detail side panel */}
        {trackingDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50" onClick={() => setTrackingDetail(null)}>
            <div className={'w-full max-w-lg h-full overflow-y-auto p-6 border-l ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Application Details</h3>
                <button onClick={() => setTrackingDetail(null)} className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700' : 'hover:bg-gray-200')}>
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-lg">{trackingDetail.jobId?.title || 'Untitled'}</p>
                  <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                    {trackingDetail.jobId?.company} {trackingDetail.jobId?.location ? '· ' + trackingDetail.jobId.location : ''}
                  </p>
                  <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                    {trackingDetail.site} · applied {trackingDetail.appliedAt ? formatDateTime(trackingDetail.appliedAt) : 'N/A'}
                    {trackingDetail.appliedVia ? ' · via ' + trackingDetail.appliedVia : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + trackingBadge(trackingDetail.status)}>{trackingDetail.status}</span>
                    {trackingDetail.status === 'not_applied' && trackingDetail.notAppliedReason && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">{notAppliedReasonLabel(trackingDetail.notAppliedReason)}</span>
                    )}
                  </div>
                </div>

                {trackingDetail.lastAction && (
                  <div className={'p-3 rounded-xl border text-sm ' + (dark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-700')}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Last Action</p>
                    {trackingDetail.lastAction}
                  </div>
                )}

                {/* Needs your attention — fill the unresolved fields */}
                {trackingDetail.status === 'pending' && (trackingDetail.waitingFields?.length || 0) > 0 && (
                  <div className={'p-4 rounded-xl border border-amber-500/40 ' + (dark ? 'bg-amber-500/10' : 'bg-amber-50')}>
                    <p className="text-sm font-semibold text-amber-500 mb-1 flex items-center gap-2">
                      <AlertCircle size={16} /> Needs your attention
                    </p>
                    <p className={'text-xs mb-3 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                      These fields couldn't be auto-filled. Provide values once — they're saved and reused on future applications automatically.
                    </p>
                    <div className="space-y-3">
                      {trackingDetail.waitingFields.map(f => (
                        <div key={f.key}>
                          <label className={'text-sm font-medium block mb-1 ' + (dark ? 'text-gray-300' : 'text-gray-700')}>{f.label || f.key}</label>
                          {f.type === 'select' && f.options?.length > 0 ? (
                            <select
                              defaultValue={f.value || ''}
                              onChange={e => setAnswerDraft(trackingDetail._id, f.key, e.target.value)}
                              className={'w-full px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900')}>
                              <option value="">Select...</option>
                              {f.options.map((o, oi) => <option key={oi} value={o}>{o}</option>)}
                            </select>
                          ) : f.type === 'textarea' ? (
                            <textarea
                              rows={3}
                              defaultValue={f.value || f.suggestion || ''}
                              onChange={e => setAnswerDraft(trackingDetail._id, f.key, e.target.value)}
                              placeholder={f.suggestion || `Enter ${f.label || f.key}`}
                              className={'w-full px-3 py-2 rounded-xl border outline-none text-sm resize-y ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400')} />
                          ) : (
                            <input
                              type="text"
                              defaultValue={f.value || f.suggestion || ''}
                              onChange={e => setAnswerDraft(trackingDetail._id, f.key, e.target.value)}
                              placeholder={f.suggestion || `Enter ${f.label || f.key}`}
                              className={'w-full px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400')} />
                          )}
                        </div>
                      ))}
                    </div>
                    <button onClick={() => submitApplicationAnswers(trackingDetail)}
                      className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-all cursor-pointer">
                      <Zap size={16} /> Save & Auto-Apply
                    </button>
                  </div>
                )}

                {trackingDetail.jobId?.url && (
                  <a href={trackingDetail.jobId.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all cursor-pointer">
                    <ExternalLink size={16} /> Open Job Posting
                  </a>
                )}

                <div>
                  <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <ListTodo size={16} className="text-violet-500" /> Pipeline Steps
                  </p>
                  {(trackingDetail.progress?.steps || []).length === 0 ? (
                    <p className={'text-sm ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No steps recorded yet.</p>
                  ) : (
                    <div className="space-y-0">
                      {trackingDetail.progress.steps.map((step, i, arr) => {
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
                  {(trackingDetail.timeline || []).length === 0 ? (
                    <p className={'text-sm ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No timeline events yet.</p>
                  ) : (
                    <div className="space-y-0">
                      {[...(trackingDetail.timeline || [])].reverse().map((ev, i, arr) => {
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
                  {isRetryable(trackingDetail) && (
                    <button onClick={() => retryApplication(trackingDetail)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 transition-all cursor-pointer">
                      <RotateCcw size={16} /> Retry Application
                    </button>
                  )}
                  {trackingDetail.jobId?.url && (
                    <a href={trackingDetail.jobId.url} target="_blank" rel="noopener noreferrer"
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

  const renderManualApply = () => {
    const { items, total, page, pages } = manualJobs
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
          <select value={manualFilters.status} onChange={e => handleManualFilterChange('status', e.target.value)}
            className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}>
            <option value="">All statuses</option>
            <option value="new">New</option>
            <option value="not_applied">Not applied</option>
            <option value="pending">Pending</option>
          </select>
          <select value={manualFilters.site} onChange={e => handleManualFilterChange('site', e.target.value)}
            className={'px-3 py-2 rounded-xl border outline-none text-sm cursor-pointer ' + (dark ? 'bg-gray-800 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900')}>
            <option value="">All sites</option>
            {jobSites.map(s => <option key={s.name} value={s.name}>{s.label}</option>)}
          </select>
          <div className="flex-1" />
          <button onClick={() => setManualJobs(prev => ({ ...prev, page: 1 }))} disabled={manualLoading}
            className={'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            <RefreshCw size={14} className={manualLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={openAddJobModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:from-fuchsia-700 hover:to-pink-600 transition-all cursor-pointer">
            <Plus size={16} /> Add Job Manually
          </button>
        </div>

        {manualLoading ? (
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
                    <button onClick={() => markManualApplied(job)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all cursor-pointer">
                      <CheckCircle2 size={14} /> Applied
                    </button>
                    <button onClick={() => markManualPass(job)}
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
            <button onClick={() => handleManualPageChange(page - 1)} disabled={page <= 1}
              className={'p-2 rounded-xl cursor-pointer disabled:opacity-40 ' + (dark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200')}>
              <ChevronLeft size={16} />
            </button>
            <span className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{page} / {pages}</span>
            <button onClick={() => handleManualPageChange(page + 1)} disabled={page >= pages}
              className={'p-2 rounded-xl cursor-pointer disabled:opacity-40 ' + (dark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200')}>
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Add job modal */}
        {addJobModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAddJobModal(null)}>
            <div className={'w-full max-w-md p-6 rounded-2xl border shadow-2xl ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Add Job Manually</h3>
                <button onClick={() => setAddJobModal(null)} className={'p-1.5 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700' : 'hover:bg-gray-200')}>
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
                <button onClick={() => setAddJobModal(null)}
                  className={'px-4 py-2 rounded-xl text-sm font-medium cursor-pointer ' + (dark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                  Cancel
                </button>
                <button onClick={addManualJob} disabled={addingJob}
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

  const renderLiveChat = () => {
    const selectChat = (session) => {
      setSelectedChat(session)

      if (chatMessagesRef.current[session._id]) {
        setChatMessages(chatMessagesRef.current[session._id])
      } else {
        setChatMessages([])
        const fetchHistory = async () => {
          try {
            const { data } = await API.get('/api/livechat/' + session._id + '/messages')
            chatMessagesRef.current[session._id] = data || []
            setChatMessages(data || [])
          } catch { /* ignore */ }
        }
        fetchHistory()
      }
    }

    const sendMessage = () => {
      const msg = chatInput.trim()
      if (!msg || !selectedChat) return
      const socket = chatSocketRef.current
      if (socket) {
        socket.emit('admin:message', { sessionId: selectedChat._id, content: msg })
      }
      setChatMessages((prev) => [...prev, { role: 'admin', content: msg, timestamp: new Date() }])
      setChatInput('')
    }

    const endChat = (sessionId) => {
      if (!confirm('End this chat?')) return
      const socket = chatSocketRef.current
      if (socket) socket.emit('admin:end-chat', { sessionId })
    }

    const glassCard = dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'

    return (
      <div className="flex flex-col lg:flex-row gap-6 h-[600px]">
        {/* Sidebar */}
        <div className="lg:w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
          {/* Queue */}
          {chatWaiting.length > 0 && (
            <div className={'p-3 rounded-xl border ' + glassCard}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5 mb-2">
                <Users size={14} /> Queue ({chatWaiting.length})
              </h4>
              <div className="space-y-1.5">
                {chatWaiting.map((s) => (
                  <div key={s._id} className={'flex items-center justify-between p-2 rounded-lg text-xs ' + (dark ? 'bg-gray-900' : 'bg-gray-50')}>
                    <span className="font-medium truncate">{s.visitorName}</span>
                    <span className="text-amber-500 font-bold">#{s.queuePosition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active */}
          <div className={'flex-1 p-3 rounded-xl border overflow-y-auto ' + glassCard}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5 mb-2">
              <MessageCircle size={14} /> Active ({chatActive.length}/3)
            </h4>
            {chatActive.length === 0 ? (
              <p className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No active chats</p>
            ) : (
              <div className="space-y-1.5">
                {chatActive.map((s) => (
                  <button key={s._id} onClick={() => selectChat(s)}
                    className={'w-full text-left p-2.5 rounded-xl text-xs transition-all cursor-pointer ' + (
                      selectedChat?._id === s._id
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                        : dark ? 'bg-gray-900 hover:bg-gray-700 text-gray-200' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    )}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold truncate">{s.visitorName}</span>
                      <span className="text-[10px] opacity-70">{s.messageCount || 0} msgs</span>
                    </div>
                    {s.lastMessage && (
                      <p className="truncate mt-0.5 opacity-70">{s.lastMessage.content}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={'flex-1 flex flex-col rounded-xl border overflow-hidden ' + glassCard}>
          {!selectedChat ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessagesSquare size={48} className="mx-auto mb-3 text-gray-400" />
                <p className={'text-sm ' + (dark ? 'text-gray-500' : 'text-gray-400')}>Select a chat to start responding</p>
              </div>
            </div>
          ) : (
            <>
              <div className={'flex items-center justify-between px-4 py-3 border-b ' + (dark ? 'border-gray-700' : 'border-gray-200')}>
                <div>
                  <h3 className="font-semibold text-sm">{selectedChat.visitorName}</h3>
                  <p className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{selectedChat.visitorId?.slice(0, 8)}...</p>
                </div>
                <button onClick={() => endChat(selectedChat._id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all cursor-pointer">
                  End Chat
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <p className={'text-center text-sm ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No messages yet</p>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex items-start gap-2 ${msg.role === 'visitor' ? '' : 'flex-row-reverse'}`}>
                    <div className={'px-3 py-2 rounded-xl text-sm max-w-[80%] ' + (
                      msg.role === 'visitor'
                        ? dark ? 'bg-gray-900 text-gray-200' : 'bg-gray-100 text-gray-800'
                        : msg.role === 'admin'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                          : dark ? 'bg-gray-900 text-gray-400 italic' : 'bg-gray-100 text-gray-500 italic'
                    )}>
                      {msg.role === 'visitor' && <p className="text-[10px] font-semibold text-emerald-500 mb-0.5">{selectedChat.visitorName}</p>}
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className={'p-3 border-t ' + (dark ? 'border-gray-700' : 'border-gray-200')}>
                <div className="flex items-end gap-2">
                  <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Type your response..."
                    rows={1}
                    className={'flex-1 resize-none outline-none text-sm leading-relaxed py-2 px-3 rounded-xl border max-h-20 ' + (
                      dark ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                    )} />
                  <button onClick={sendMessage} disabled={!chatInput.trim()}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 shadow-md cursor-pointer">
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

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
      case 'resumes': return renderResumes()
      case 'articles': return renderArticles()
      case 'messages': return renderMessages()
      case 'leads': return renderLeads()
      case 'livechat': return renderLiveChat()
      case 'analytics': return renderAnalytics()
      case 'jobs': return renderJobs()
      case 'job-apps': return renderJobApps()
      case 'tracking': return renderTracking()
      case 'manual-apply': return renderManualApply()
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
