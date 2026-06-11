import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useApiAuth } from '../lib/api'
import { motion } from 'framer-motion'
import { LogOut, Sun, Moon, Plus, Edit3, Trash2, X, User, Code2, Briefcase, GraduationCap, Award, FolderGit2, FileText, BarChart3, Mail, MailOpen, Eye, Download, Clock, CheckCircle2, AlertCircle, BookOpen, Phone, PhoneCall } from 'lucide-react'
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
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
]

export default function AdminDashboard() {
  const API = useApiAuth()
  const { logout } = useAuth()
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

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (activeTab === 'analytics') {
      if (!analytics) API.get('/api/analytics/stats').then(r => setAnalytics(r.data)).catch(() => {})
      refreshActivities()
    }
    if (activeTab === 'messages') {
      API.get('/api/messages').then(r => setMessages(r.data)).catch(() => {})
    }
    if (activeTab === 'leads') {
      API.get('/api/leads').then(r => setLeads(r.data.items)).catch(() => {})
    }
  }, [activeTab])

  const refreshActivities = async () => {
    setActivitiesLoading(true)
    try {
      const { data } = await API.get('/api/activity')
      setActivities(data)
    } catch (err) { console.error(err) }
    finally { setActivitiesLoading(false) }
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

  const formatTimeAgo = (date) => {
    const diff = Date.now() - new Date(date).getTime()
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
      case 'analytics': return renderAnalytics()
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
