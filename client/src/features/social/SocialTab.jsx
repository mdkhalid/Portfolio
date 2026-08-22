import { useState, useEffect, useCallback, useRef } from 'react'
import { Plug, Unplug, RefreshCw, Loader2, CheckCircle2, AlertTriangle, AtSign, Globe, Sparkles } from 'lucide-react'
import { getApiErrorMessage } from '../../lib/api'

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
    <span className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ' + ('bg-gray-500/10 text-gray-400')}>
      <Unplug size={13} /> Not connected
    </span>
  )
}

export default function SocialTab({ API, dark, showToast }) {
  const [connections, setConnections] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(null) // platform name
  const [disconnecting, setDisconnecting] = useState(null)
  const popupRefs = useRef({})

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

  // Popup pages postMessage on success; also poll for manual close.
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

  const cardBg = dark ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200'
  const muted = dark ? 'text-gray-400' : 'text-gray-500'

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Social Publisher</h2>
          <p className={'text-sm mt-0.5 ' + muted}>Connect your accounts once, then create &amp; publish posts.</p>
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

      {/* Composer placeholder — arrives with the AI generation phase */}
      <div className={'rounded-2xl border border-dashed p-8 text-center ' + (dark ? 'border-gray-700' : 'border-gray-300')}>
        <Sparkles size={24} className={'mx-auto mb-3 ' + muted} />
        <p className="font-medium">Content composer</p>
        <p className={'text-sm mt-1 ' + muted}>Write a few lines about new tech — AI builds the post, image and preview next.</p>
      </div>
    </div>
  )
}
