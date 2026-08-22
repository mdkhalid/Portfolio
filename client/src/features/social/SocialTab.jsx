import { useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import { RefreshCw, Loader2, Plug, Unplug, CheckCircle2, AlertTriangle, AtSign, Globe } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getApiErrorMessage } from '../../lib/api'
import ComposeForm from './ComposeForm'
import GenerateProgress from './GenerateProgress'
import PostPreview from './PostPreview'

const STEPS = [
  { key: 'building_prompts', label: 'Building prompts' },
  { key: 'writing_content', label: 'Writing post content' },
  { key: 'creating_image', label: 'Creating image' },
  { key: 'saving_draft', label: 'Saving draft' },
]

const freshSteps = () => STEPS.map((s) => ({ ...s, status: 'pending', error: '' }))

function modeSteps(mode) {
  if (mode === 'text') return freshSteps().filter((s) => s.key !== 'creating_image')
  if (mode === 'image') return freshSteps().filter((s) => ['creating_image', 'saving_draft'].includes(s.key))
  return freshSteps()
}

const PLATFORM_META = {
  linkedin: {
    label: 'LinkedIn',
    icon: Globe,
    accent: 'from-sky-600 to-blue-700',
    setupHint: 'Create a free app at developer.linkedin.com with "Sign In with OpenID Connect" + "Share on LinkedIn", then set LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET.',
  },
  x: {
    label: 'X',
    icon: AtSign,
    accent: 'from-slate-700 to-black',
    setupHint: 'Create a free app at developer.x.com with OAuth 2.0 enabled (user context), then set X_CLIENT_ID / X_CLIENT_SECRET.',
  },
}

function StatusBadge({ status }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">
        <CheckCircle2 size={13} /> Connected
      </span>
    )
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
        <AlertTriangle size={13} /> Reconnect needed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
      <Unplug size={13} /> Not connected
    </span>
  )
}

export default function SocialTab({ API, dark, showToast }) {
  const { token } = useAuth()
  const [connections, setConnections] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(null)
  const [disconnecting, setDisconnecting] = useState(null)
  const popupRefs = useRef({})

  // Wizard state
  const [view, setView] = useState('compose') // compose | generating | preview
  const [activePostId, setActivePostId] = useState(null)
  const activePostIdRef = useRef(null)
  const lastNotesRef = useRef('')
  const [steps, setSteps] = useState(freshSteps())
  const [genError, setGenError] = useState('')
  const [genMode, setGenMode] = useState('full')
  const [post, setPost] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [regenBusy, setRegenBusy] = useState({ text: false, image: false })

  /* ── connections ── */
  const refresh = useCallback(async () => {
    try {
      const { data } = await API.get('/api/social/connections')
      setConnections(data)
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err, 'Could not load connection status.') })
    } finally {
      setLoading(false)
    }
  }, [API, showToast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
  }, [refresh])

  useEffect(() => {
    const onMsg = (e) => {
      if (e?.data?.source === 'social_oauth') refresh()
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [refresh])

  useEffect(() => {
    if (!connecting) return
    const timer = setInterval(() => {
      const popup = popupRefs.current[connecting]
      if (popup && popup.closed) {
        clearInterval(timer)
        setConnecting(null)
        refresh()
      }
    }, 700)
    return () => clearInterval(timer)
  }, [connecting, refresh])

  const connect = (platform) => {
    const w = window.open(`/api/social/${platform}/connect`, `social_oauth_${platform}`, 'width=620,height=740,menubar=no,toolbar=no')
    if (!w) {
      showToast({ type: 'warning', message: 'Popup blocked. Allow popups for this site and retry.' })
      return
    }
    w.focus()
    popupRefs.current[platform] = w
    setConnecting(platform)
  }

  const disconnect = async (platform) => {
    setDisconnecting(platform)
    try {
      await API.post(`/api/social/connections/${platform}/disconnect`)
      showToast({ type: 'success', message: PLATFORM_META[platform].label + ' disconnected.' })
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err, 'Could not disconnect.') })
    } finally {
      setDisconnecting(null)
      refresh()
    }
  }

  /* ── generation wizard ── */

  const loadPost = useCallback(async (id) => {
    try {
      const { data } = await API.get(`/api/social/posts/${id}`)
      if (data.post.status === 'ready') {
        setPost(data.post)
        setView('preview')
      } else if (data.post.status === 'failed') {
        setGenError(data.post.lastError || 'Generation failed.')
      }
      return data.post.status
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err, 'Could not load the post.') })
      return 'error'
    }
  }, [API, showToast])

  const applyProgress = useCallback((evt) => {
    setSteps((prev) => prev.map((s) => (s.key === evt.step ? { ...s, status: evt.status || s.status, error: evt.error || '' } : s)))
  }, [])

  // Live progress via socket (same auth pattern as the dashboard live chat).
  useEffect(() => {
    if (!token) return undefined
    const socket = io(window.location.origin, { auth: { token, role: 'admin' } })
    socket.on('social:progress', (evt) => {
      if (String(evt?.postId) !== String(activePostIdRef.current)) return
      applyProgress(evt)
      if (evt.step === 'saving_draft' && evt.status === 'done') loadPost(evt.postId)
      if (evt.status === 'error') setGenError(evt.error || 'Generation failed.')
    })
    return () => socket.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Polling fallback — guarantees completion even without a socket.
  useEffect(() => {
    if (view !== 'generating' || !activePostId) return undefined
    const t = setInterval(async () => {
      try {
        const { data } = await API.get(`/api/social/posts/${activePostId}`)
        if (data.post.status === 'ready') loadPost(activePostId)
        else if (data.post.status === 'failed') {
          setSteps((prev) => prev.map((s) => (s.status === 'active' ? { ...s, status: 'error', error: data.post.lastError || '' } : s)))
          setGenError(data.post.lastError || 'Generation failed.')
        }
      } catch { /* transient */ }
    }, 2500)
    return () => clearInterval(t)
  }, [view, activePostId, API, loadPost])

  // Resume an in-flight generation after refresh/remount.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await API.get('/api/social/posts', { params: { status: 'generating', limit: 1 } })
        if (!cancelled && data.items?.length) {
          const p = data.items[0]
          setActivePostId(p._id)
          activePostIdRef.current = p._id
          setGenMode('full')
          setSteps(modeSteps('full'))
          setView('generating')
        }
      } catch { /* non-critical */ }
    })()
    return () => { cancelled = true }
  }, [API])

  const startGeneration = async (notes, only = null) => {
    setSubmitting(true)
    setGenError('')
    setSteps(modeSteps(only || 'full'))
    try {
      let id = activePostIdRef.current
      if (only && id) {
        await API.post(`/api/social/posts/${id}/regenerate/${only}`)
      } else {
        const { data } = await API.post('/api/social/posts', { topicNotes: notes })
        id = data.post._id
        setActivePostId(id)
        activePostIdRef.current = id
        setGenMode('full')
      }
      setGenMode(only || 'full')
      setView('generating')
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err, 'Could not start generation.') })
      setView('compose')
    } finally {
      setSubmitting(false)
    }
  }

  const onGenerate = (notes) => {
    lastNotesRef.current = notes
    startGeneration(notes)
  }

  const retry = () => startGeneration(lastNotesRef.current)

  const regenerate = async (kind) => {
    setRegenBusy((b) => ({ ...b, [kind]: true }))
    try {
      await API.post(`/api/social/posts/${post._id}/regenerate/${kind}`)
      setGenMode(kind === 'text' ? 'text' : 'image')
      setSteps(modeSteps(kind === 'text' ? 'text' : 'image'))
      activePostIdRef.current = post._id
      setGenError('')
      setView('generating')
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err, `Could not regenerate ${kind}.`) })
    } finally {
      setRegenBusy((b) => ({ ...b, [kind]: false }))
    }
  }

  const backToCompose = () => {
    activePostIdRef.current = null
    setActivePostId(null)
    setView('compose')
  }

  const newPost = () => {
    activePostIdRef.current = null
    setActivePostId(null)
    setPost(null)
    setGenError('')
    setSteps(freshSteps())
    setView('compose')
  }

  const cardBg = dark ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200'
  const muted = dark ? 'text-gray-400' : 'text-gray-500'

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Social Publisher</h2>
          <p className={'text-sm mt-0.5 ' + muted}>Connect accounts, create AI posts, preview and publish.</p>
        </div>
        <button
          onClick={() => { setLoading(true); refresh() }}
          className={'p-2 rounded-xl transition-colors cursor-pointer ' + (dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}
          title="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Connection cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {(loading && !connections ? ['linkedin', 'x'] : Object.keys(PLATFORM_META)).map((platform) => {
          const meta = PLATFORM_META[platform]
          const Icon = meta.icon
          const conn = connections?.[platform]
          const configured = connections?.configured?.[platform]
          return (
            <div key={platform} className={'rounded-2xl border p-5 space-y-4 ' + cardBg}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={'p-2.5 rounded-xl bg-gradient-to-br text-white ' + meta.accent}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <p className="font-semibold">{meta.label}</p>
                    {!loading && conn?.connected && conn.userName && (
                      <p className={'text-xs ' + muted}>{conn.userName}</p>
                    )}
                  </div>
                </div>
                {loading && !connections
                  ? <Loader2 size={16} className="animate-spin text-gray-400" />
                  : conn && <StatusBadge status={conn.status} />}
              </div>

              {!loading && !configured && (
                <p className={'text-xs leading-relaxed ' + muted}>{meta.setupHint}</p>
              )}

              <div className="flex gap-2">
                {(!conn || !conn.connected || conn.status === 'expired')
                  ? (
                    <button
                      onClick={() => connect(platform)}
                      disabled={!configured}
                      className={'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ' +
                        (configured ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:opacity-90' : (dark ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400'))}
                    >
                      {connecting === platform ? <Loader2 size={15} className="animate-spin" /> : <Plug size={15} />}
                      {connecting === platform ? 'Waiting for sign-in…' : conn?.status === 'expired' ? 'Reconnect' : 'Connect'}
                    </button>
                  )
                  : (
                    <button
                      onClick={() => disconnect(platform)}
                      className={'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ' + (dark ? 'bg-gray-800 hover:bg-red-900/40 hover:text-red-400 text-gray-300' : 'bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600')}
                    >
                      {disconnecting === platform ? <Loader2 size={15} className="animate-spin" /> : <Unplug size={15} />}
                      Disconnect
                    </button>
                  )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Flow */}
      {view === 'compose' && (
        <ComposeForm dark={dark} submitting={submitting} onGenerate={onGenerate} />
      )}
      {view === 'generating' && (
        <GenerateProgress
          dark={dark}
          steps={steps}
          mode={genMode}
          error={genError}
          onRetry={retry}
          onBack={backToCompose}
        />
      )}
      {view === 'preview' && post && (
        <PostPreview
          API={API}
          dark={dark}
          showToast={showToast}
          post={post}
          linkedinProfile={connections?.linkedin}
          regenBusy={regenBusy}
          onRegenerateText={() => regenerate('text')}
          onRegenerateImage={() => regenerate('image')}
          onUpdated={(updated) => setPost(updated)}
          onNewPost={newPost}
        />
      )}
    </div>
  )
}
