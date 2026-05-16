import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import axios from 'axios'
import { motion } from 'framer-motion'
import { LogOut, Sun, Moon, Plus, Edit3, Trash2, X, User, Code2, Briefcase, GraduationCap, Award, FolderGit2, FileText, Upload, BarChart3 } from 'lucide-react'

const API = axios.create()
API.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

const tabs = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'skills', label: 'Skills', icon: Code2 },
  { key: 'experiences', label: 'Experience', icon: Briefcase },
  { key: 'education', label: 'Education', icon: GraduationCap },
  { key: 'certifications', label: 'Certifications', icon: Award },
  { key: 'projects', label: 'Projects', icon: FolderGit2 },
  { key: 'resumes', label: 'Resumes', icon: FileText },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
]

export default function AdminDashboard() {
  const { logout } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('profile')
  const [data, setData] = useState({})
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    if (activeTab === 'analytics' && !analytics) {
      API.get('/api/analytics/stats').then(r => setAnalytics(r.data)).catch(() => {})
    }
  }, [activeTab])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [profile, skills, experiences, education, certifications, projects, resumes] = await Promise.all([
          API.get('/api/profile'), API.get('/api/skills'),
          API.get('/api/experiences'), API.get('/api/education'),
          API.get('/api/certifications'), API.get('/api/projects'),
          API.get('/api/resumes'),
        ])
        setData({ profile: profile.data || {}, skills: skills.data, experiences: experiences.data, education: education.data, certifications: certifications.data, projects: projects.data, resumes: resumes.data })
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

  const ProfileForm = () => {
    const p = data.profile || {}
    const [form, setForm] = useState({ name: p.name || '', email: p.email || '', phone: p.phone || '', location: p.location || '', linkedIn: p.linkedIn || '', github: p.github || '', title: p.title || '', summary: p.summary || '', avatar: p.avatar || '', experienceYears: p.experienceYears || 18 })
    const [uploading, setUploading] = useState(false)

    const handleAvatarUpload = async (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('avatar', file)
        const { data } = await API.post('/api/upload/avatar', fd)
        setForm(f => ({ ...f, avatar: data.url }))
      } catch (err) { console.error(err) }
      finally { setUploading(false) }
    }

    const handleSave = async () => {
      setSaving(true)
      try {
        const { data: updated } = await API.put('/api/profile', form)
        setData(prev => ({ ...prev, profile: updated }))
      } catch (err) { console.error(err) }
      finally { setSaving(false) }
    }

    return (
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          {Object.entries(form).map(([key, val]) => (
            <div key={key} className={key === 'summary' || key === 'avatar' ? 'md:col-span-2' : ''}>
              <label className={'block text-sm font-medium mb-1 ' + (dark ? 'text-gray-300' : 'text-gray-700')}>
                {key === 'avatar' ? 'Avatar Image' : key.replace(/([A-Z])/g, ' ').replace(/^./, s => s.toUpperCase())}
              </label>
              {key === 'summary' ? (
                <textarea value={val} onChange={e => setForm({ ...form, [key]: e.target.value })} rows={4}
                  className={'w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 ' + (dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900')} />
              ) : key === 'avatar' ? (
                <div className="flex items-center gap-4">
                  {form.avatar && (
                    <img src={form.avatar} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-blue-500/50" />
                  )}
                  <label className={'flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-all ' + (dark ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100')}>
                    <Upload size={16} />
                    {uploading ? 'Uploading...' : 'Choose Image'}
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploading} />
                  </label>
                  {form.avatar && (
                    <button onClick={() => setForm({ ...form, avatar: '' })} className={'p-2 rounded-lg text-sm ' + (dark ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-gray-100')}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ) : (
                <input value={val} onChange={e => setForm({ ...form, [key]: e.target.value })}
                  className={'w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 ' + (dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900')} />
              )}
            </div>
          ))}
        </div>
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 rounded-lg text-white font-medium bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    )
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
                  className={'p-1.5 rounded-lg ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Edit3 size={14} /></button>
                <button onClick={() => deleteItem('skills', cat._id)}
                  className={'p-1.5 rounded-lg ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={14} /></button>
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all">
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
                  className={'p-2 rounded-lg ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Edit3 size={16} /></button>
                <button onClick={() => deleteItem(collection, item._id)}
                  className={'p-2 rounded-lg ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        <button onClick={() => setEditing({ collection, id: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all">
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
                  className={'p-2 rounded-lg ' + (dark ? 'hover:bg-gray-700 text-blue-400' : 'hover:bg-gray-200 text-blue-600')}><Edit3 size={16} /></button>
                <button onClick={() => deleteItem('resumes', item._id)}
                  className={'p-2 rounded-lg ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        <button onClick={() => setEditing({ collection: 'resumes', id: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all">
          <Plus size={16} /> Add Resume
        </button>
      </div>
    )
  }

  const renderAnalytics = () => {
    if (!analytics) return <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>Loading...</p>
    const { total, unique, records } = analytics
    const last7 = records?.slice(0, 7).reverse() || []
    const maxViews = Math.max(...last7.map(r => r.pageViews), 1)
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className={'p-6 rounded-xl border text-center ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">{total}</div>
            <p className={'text-sm mt-1 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>Total Page Views</p>
          </div>
          <div className={'p-6 rounded-xl border text-center ' + (dark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
            <div className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">{unique}</div>
            <p className={'text-sm mt-1 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>Unique Visitors</p>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider text-gray-400">Last 7 Days</h3>
          <div className="flex items-end gap-2 h-32">
            {last7.map(r => (
              <div key={r.date} className="flex-1 flex flex-col items-center gap-1">
                <div className={'w-full rounded-lg transition-all hover:opacity-80'} style={{ height: Math.max(4, (r.pageViews / maxViews) * 100) + '%', background: 'linear-gradient(to top, #3b82f6, #06b6d4)' }} />
                <span className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{r.date.slice(5)}</span>
                <span className={'text-xs font-medium ' + (dark ? 'text-gray-300' : 'text-gray-600')}>{r.pageViews}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const EditModal = () => {
    if (!editing) return null
    const { collection, id, data: editData } = editing
    const [form, setForm] = useState(editData || {})
    const fields = collection === 'skills'
      ? [{ key: 'category', label: 'Category Name', type: 'text' }]
      : collection === 'experiences'
        ? [{ key: 'company', label: 'Company', type: 'text' }, { key: 'role', label: 'Role', type: 'text' }, { key: 'location', label: 'Location', type: 'text' }, { key: 'startDate', label: 'Start Date', type: 'text' }, { key: 'endDate', label: 'End Date', type: 'text' }, { key: 'bullets', label: 'Bullets (one per line)', type: 'textarea' }]
        : collection === 'education'
          ? [{ key: 'degree', label: 'Degree', type: 'text' }, { key: 'field', label: 'Field', type: 'text' }, { key: 'institution', label: 'Institution', type: 'text' }, { key: 'location', label: 'Location', type: 'text' }, { key: 'startDate', label: 'Start Date', type: 'text' }, { key: 'endDate', label: 'End Date', type: 'text' }]
            : collection === 'certifications'
              ? [{ key: 'name', label: 'Name', type: 'text' }, { key: 'issuer', label: 'Issuer', type: 'text' }, { key: 'date', label: 'Date', type: 'text' }, { key: 'link', label: 'Link', type: 'text' }]
            : collection === 'projects'
              ? [{ key: 'name', label: 'Project Name', type: 'text' }, { key: 'role', label: 'Role', type: 'text' }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'startDate', label: 'Start Date', type: 'text' }, { key: 'endDate', label: 'End Date', type: 'text' }, { key: 'techStack', label: 'Tech Stack (comma separated)', type: 'text' }, { key: 'bullets', label: 'Bullets (one per line)', type: 'textarea' }]
              : collection === 'resumes'
                ? [{ key: 'label', label: 'Label', type: 'text' }]
                : []

    const handleSave = () => {
      if (collection === 'resumes') {
        const fd = new FormData()
        fd.append('label', form.label || '')
        if (form._newFile) fd.append('file', form._newFile)
        setSaving(true)
        ;(async () => {
          try {
            const { data: result } = id
              ? await API.put('/api/resume-files/' + id, fd)
              : await API.post('/api/resume-files', fd)
            const endpoint = '/api/resume-files'
            setData(prev => ({
              ...prev,
              resumes: id
                ? prev.resumes.map(i => i._id === id ? result : i)
                : [...(prev.resumes || []), result],
            }))
            setEditing(null)
          } catch (err) { console.error(err) }
          finally { setSaving(false) }
        })()
        return
      }
      let payload = { ...form }
      if (payload.bullets && typeof payload.bullets === 'string') payload.bullets = payload.bullets.split('\n').filter(Boolean)
      if (payload.techStack && typeof payload.techStack === 'string') payload.techStack = payload.techStack.split(',').map(s => s.trim()).filter(Boolean)
      saveItem(collection, payload, id)
    }

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)}>
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
          className={'w-full max-w-lg p-6 rounded-2xl max-h-[80vh] overflow-y-auto ' + (dark ? 'bg-gray-900 border border-gray-700' : 'bg-white')}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">{id ? 'Edit' : 'Add'} {collection}</h3>
            <button onClick={() => setEditing(null)} className={'p-1.5 rounded-lg ' + (dark ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}><X size={18} /></button>
          </div>
          <div className="space-y-3">
            {fields.map(f => (
              <div key={f.key}>
                <label className={'block text-sm font-medium mb-1 ' + (dark ? 'text-gray-300' : 'text-gray-700')}>{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea value={Array.isArray(form[f.key]) ? form[f.key].join('\n') : (form[f.key] || '')}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })} rows={3}
                    className={'w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 ' + (dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900')} />
                ) : (
                  <input value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    className={'w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 ' + (dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900')} />
                )}
              </div>
            ))}
            {collection === 'skills' && (
              <div>
                <label className={'block text-sm font-medium mb-2 ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Skill Items</label>
                {(form.items || []).map((item, i) => (
                  <div key={i} className="flex gap-2 items-center mb-2">
                    <input value={item.name} onChange={e => {
                      const items = [...(form.items || [])]
                      items[i] = { ...items[i], name: e.target.value }
                      setForm({ ...form, items })
                    }} placeholder="Skill name"
                      className={'w-full px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 ' + (dark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400')} />
                    <input type="number" min="0" max="100" value={item.level} onChange={e => {
                      const items = [...(form.items || [])]
                      items[i] = { ...items[i], level: Number(e.target.value) }
                      setForm({ ...form, items })
                    }}
                      className={'w-20 px-3 py-2 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500/50 ' + (dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900')} />
                    <button onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}
                      className={'p-2 rounded-lg ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}><X size={14} /></button>
                  </div>
                ))}
                <button onClick={() => setForm({ ...form, items: [...(form.items || []), { name: '', level: 50 }] })}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all">
                  <Plus size={14} /> Add Skill
                </button>
              </div>
            )}
            {collection === 'resumes' && (
              <div>
                <label className={'block text-sm font-medium mb-2 ' + (dark ? 'text-gray-300' : 'text-gray-700')}>Resume File</label>
                {form.fileUrl && (
                  <div className={'flex items-center gap-2 mb-2 p-2 rounded-lg text-sm ' + (dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>
                    <FileText size={14} />
                    {form.fileUrl.split('/').pop()}
                  </div>
                )}
                <label className={'flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-all ' + (dark ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100')}>
                  <Upload size={16} />
                  {form._newFile ? form._newFile.name : 'Choose File'}
                  <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) setForm({ ...form, _newFile: file })
                  }} className="hidden" />
                </label>
                <p className={'text-xs mt-1 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>Allowed: PDF, DOC, DOCX, TXT (max 10MB)</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setEditing(null)} className={'px-4 py-2 rounded-lg text-sm font-medium ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'profile': return <ProfileForm />
      case 'skills': return renderSkills()
      case 'experiences': return renderList('experiences', 'company')
      case 'education': return renderList('education', 'degree')
      case 'certifications': return renderList('certifications', 'name')
      case 'projects': return renderList('projects', 'name')
      case 'resumes': return renderResumes()
      case 'analytics': return renderAnalytics()
      default: return null
    }
  }

  return (
    <div className={'min-h-screen ' + (dark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900')}>
      <header className={'sticky top-0 z-40 border-b ' + (dark ? 'bg-gray-900/90 backdrop-blur-xl border-gray-800' : 'bg-white/80 backdrop-blur-xl border-gray-200')}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">Portfolio Admin</h1>
          <div className="flex items-center gap-3">
            <button onClick={toggle} className={'p-2 rounded-full ' + (dark ? 'bg-gray-800 text-yellow-400' : 'bg-gray-100 text-gray-600')}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={handleLogout} className={'flex items-center gap-2 px-3 py-2 rounded-lg text-sm ' + (dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
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
                className={'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ' + (activeTab === tab.key
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
                  className={'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ' + (activeTab === tab.key
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

      <EditModal />
    </div>
  )
}
