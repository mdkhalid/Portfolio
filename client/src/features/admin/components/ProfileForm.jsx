import { useState } from 'react'
import { Sparkles, Trash2, Upload } from 'lucide-react'

const sections = [
  { key: 'navbar', label: 'Navbar' },
  { key: 'hero', label: 'Hero' },
  { key: 'summary', label: 'Summary' },
  { key: 'skills', label: 'Skills' },
  { key: 'experience', label: 'Experience' },
  { key: 'education', label: 'Education' },
  { key: 'projects', label: 'Projects' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'blog', label: 'Blog' },
  { key: 'contact', label: 'Contact' },
]

export default function ProfileForm({ API, dark, profile, saving, setSaving, setData, showToast }) {
  const [form, setForm] = useState({
    name: profile.name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    location: profile.location || '',
    linkedIn: profile.linkedIn || '',
    github: profile.github || '',
    title: profile.title || '',
    summary: profile.summary || '',
    avatar: profile.avatar || '',
    experienceYears: profile.experienceYears || 18,
    visibleSections: profile.visibleSections || {},
    aiProvider: profile.aiProvider || 'openai',
    useBentoTheme: profile.useBentoTheme || false,
  })
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
      showToast('Profile saved successfully!')
    } catch (err) {
      showToast('Failed to save profile. Please try again.', 'error')
      console.error(err)
    }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {Object.entries(form)
          .filter(([key]) => key !== 'visibleSections' && key !== 'aiProvider' && key !== 'useBentoTheme')
          .map(([key, val]) => (
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
                  <button onClick={() => setForm({ ...form, avatar: '' })} className={'p-2 rounded-lg text-sm cursor-pointer ' + (dark ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-gray-100')}>
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
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-gray-400">Section Visibility</h3>
        <p className={'text-xs mb-4 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>Toggle sections to show/hide on the portfolio homepage</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {sections.map(s => {
            const visible = form.visibleSections?.[s.key] !== false
            return (
              <button key={s.key} onClick={() => setForm({ ...form, visibleSections: { ...form.visibleSections, [s.key]: !visible } })}
                className={'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ' + (
                  visible
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-lg shadow-blue-500/25'
                    : (dark ? 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300')
                )}>
                <div className={'w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ' + (
                  visible ? 'border-white bg-white' : (dark ? 'border-gray-500' : 'border-gray-300')
                )}>
                  {visible && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                </div>
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-gray-400">AI Provider</h3>
        <p className={'text-xs mb-4 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>
          Choose which AI API to use for chat and ATS resume scoring. Groq is free and uses Llama 3.3 70B.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setForm({ ...form, aiProvider: 'openai' })}
            className={'flex-1 flex items-center justify-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ' + (
              form.aiProvider === 'openai' || !form.aiProvider
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-lg shadow-blue-500/25'
                : (dark ? 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300')
            )}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5095-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0-.7427 5.9608 5.9847 5.9847 0 0 0 3.161 3.6515 5.5648 5.5648 0 0 0 .1305 2.5932 6.0462 6.0462 0 0 0 5.867 4.5642 5.565 5.565 0 0 0 2.8897-.8859 5.9847 5.9847 0 0 0 3.4733 1.6436 6.0462 6.0462 0 0 0 5.2578-4.469 5.9847 5.9847 0 0 0-.7208-4.8385 5.5648 5.5648 0 0 0-.1305-2.5932z"/>
            </svg>
            <div className="text-left">
              <div className="font-semibold">OpenAI</div>
              <div className={'text-xs ' + (form.aiProvider === 'openai' || !form.aiProvider ? 'text-white/70' : (dark ? 'text-gray-500' : 'text-gray-400'))}>GPT-4o Mini</div>
            </div>
          </button>
          <button onClick={() => setForm({ ...form, aiProvider: 'groq' })}
            className={'flex-1 flex items-center justify-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ' + (
              form.aiProvider === 'groq'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-lg shadow-blue-500/25'
                : (dark ? 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300')
            )}>
            <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="16" fill="#F97316"/>
              <path d="M12 8h13l-3 6h-7l-3 6H5l7-12z" fill="white"/>
              <path d="M17 14h7l-3 6h-7l3-6z" fill="white" opacity="0.6"/>
            </svg>
            <div className="text-left">
              <div className="font-semibold">Groq</div>
              <div className={'text-xs ' + (form.aiProvider === 'groq' ? 'text-white/70' : (dark ? 'text-gray-500' : 'text-gray-400'))}>Llama 3.3 70B (Free)</div>
            </div>
          </button>
        </div>
        {form.aiProvider === 'groq' && (
          <p className={'text-xs mt-2 ' + (dark ? 'text-amber-400' : 'text-amber-600')}>
            Make sure you have <code className="px-1 py-0.5 rounded text-xs font-mono" style={{background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}}>GROQ_API_KEY</code> set in your server .env file.
          </p>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold mb-4 uppercase tracking-wider text-gray-400">Home Page Layout Style</h3>
        <p className={'text-xs mb-4 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>
          Select which design layout is served as the home page (`/`) for visitors. Classic is linear, Bento is modular grid.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setForm({ ...form, useBentoTheme: false })}
            className={'flex-1 flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ' + (
              !form.useBentoTheme
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-lg shadow-blue-500/25'
                : (dark ? 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300')
            )}>
            <div className="text-left text-center w-full">
              <div className="font-semibold">Classic Layout</div>
              <div className={'text-xs ' + (!form.useBentoTheme ? 'text-white/70' : (dark ? 'text-gray-500' : 'text-gray-400'))}>Original Scroll Layout</div>
            </div>
          </button>
          <button onClick={() => setForm({ ...form, useBentoTheme: true })}
            className={'flex-1 flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ' + (
              form.useBentoTheme
                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-transparent shadow-lg shadow-blue-500/25'
                : (dark ? 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300')
            )}>
            <div className="text-left text-center w-full">
              <div className="font-semibold flex items-center justify-center gap-1.5">
                Bento Grid Layout <Sparkles size={14} className="text-yellow-400" />
              </div>
              <div className={'text-xs ' + (form.useBentoTheme ? 'text-white/70' : (dark ? 'text-gray-500' : 'text-gray-400'))}>Modern Bento Grid Layout</div>
            </div>
          </button>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="mt-6 px-6 py-2.5 rounded-lg text-white font-medium bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all disabled:opacity-50 cursor-pointer">
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </div>
  )
}
