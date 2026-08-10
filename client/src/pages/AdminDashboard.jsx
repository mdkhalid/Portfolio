import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useApiAuth } from '../lib/api'
import { motion } from 'framer-motion'
import { io } from 'socket.io-client'
import { LogOut, Sun, Moon, Plus, Edit3, Trash2, X, User, Code2, Briefcase, GraduationCap, Award, FolderGit2, FileText, BarChart3, Mail, MailOpen, Eye, Download, Clock, CheckCircle2, AlertCircle, BookOpen, Phone, PhoneCall, MessagesSquare, Send, MessageCircle, Users, Globe, RefreshCw, Loader2, Filter, Search, ChevronLeft, ChevronRight, CheckSquare, Square, Target, Zap, Briefcase as BriefcaseIcon, ExternalLink, EyeOff } from 'lucide-react'
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
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState(null)

  // Job Applications state
  const [jobApps, setJobApps] = useState({ items: [], total: 0, page: 1, pages: 1 })
  const [jobAppsLoading, setJobAppsLoading] = useState(false)
  const [pipeline, setPipeline] = useState(null)
  const [pipelineBudget, setPipelineBudget] = useState({ aiDailyBudget: '', aiWeeklyBudget: '', maxApplyPerBatch: '', applyRateDelayMs: '', siteConcurrency: '' })
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

  // Live apply progress via socket
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

    return () => { socket.disconnect() }
  }, [token])

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

  const loadGeneratedResumes = async () => {
    setGeneratedResumesLoading(true)
    try {
      const { data } = await API.get('/api/resume/generated')
      setGeneratedResumes(data)
    } catch (err) {
      console.error(err)
    } finally { setGeneratedResumesLoading(false) }
  }

  const downloadGeneratedResume = (id, filename) => {
    window.open(`/api/resume/generated/${id}/pdf`, '_blank')
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
      await API.delete('/api/' + collection + '/' + id)
      setData(prev => ({ ...prev, [collection]: prev[collection].filter(i => i._id !== id) }))
    } catch (err) { console.error(err) }
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
              No generated resumes yet. Run Auto Apply on a job to generate ATS-tailored resumes.
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

        {/* Base Resume Files */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Base Resume Files</h3>
          </div>
          <div className="space-y-3">
            {items.map(item => (
              <div key={item._id} className={'p-4 rounded-xl border ' + (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{item.label}</p>
                    <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{item.fileUrl?.split('/').pop()}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
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
                        <span className={'text-xs px-2 py-0.5 rounded-full font-medium ' + (
                          site.status === 'connected' ? (dark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700')
                            : site.status === 'error' ? (dark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-700')
                            : (dark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                        )}>
                          {site.status}
                        </span>
                      </div>
                      <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
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
                    className={'w-full mt-1 px-3 py-2 rounded-xl border outline-none text-sm ' + (dark ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400')} />
                </div>
                <div>
                  <label className={'text-sm font-medium ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Password</label>
                  <div className="relative mt-1">
                    <input type={showCredsPassword ? 'text' : 'password'} value={credsForm.password}
                      onChange={e => setCredsForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Leave blank to keep existing"
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
            <div className="flex justify-end mt-3">
              <button onClick={async () => {
                setBudgetSaving(true)
                try {
                  const patch = {}
                  for (const [k, v] of Object.entries(pipelineBudget)) {
                    const n = Number(v)
                    if (v !== '' && !isNaN(n)) patch[k] = n
                  }
                  if (!Object.keys(patch).length) return
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
                          : (dark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-700')
                      )}>{job.site}</span>
                      <span className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{formatDate(job.postedDate)}</span>
                      {job.status === 'applied' && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">Applied</span>}
                      {job.status === 'passed' && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-500 font-medium">Passed</span>}
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
                          : <Clock size={14} className={dark ? 'text-gray-600' : 'text-gray-400'} />}
                        <span className={step.status === 'failed' ? 'text-red-400' : (dark ? 'text-gray-300' : 'text-gray-600')}>{step.label || step.key}</span>
                        {step.error && <span className="text-red-400 ml-auto">{step.error}</span>}
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
                  <div className="flex gap-2">
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
            toast.type === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
          )}
        >
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
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
            <button onClick={toggle} className={'p-2 rounded-full cursor-pointer ' + (dark ? 'bg-gray-800 text-yellow-400' : 'bg-gray-100 text-gray-600')}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
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
