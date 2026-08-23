import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Loader2, Globe, AtSign, CheckCircle2, XCircle, Copy, RefreshCw, Send } from 'lucide-react'
import { getApiErrorMessage } from '../../lib/api'

const CLAMP_AT = 420

export default function PostDetail({
  API, dark, showToast, postId,
  publish,
  onPublishLinkedIn, onPublishX, onBack,
}) {
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const cardBg = dark ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200'
  const muted = dark ? 'text-gray-400' : 'text-gray-500'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await API.get(`/api/social/posts/${postId}`)
      setPost(data.post)
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err, 'Could not load the post.') })
    } finally {
      setLoading(false)
    }
  }, [API, postId, showToast])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [postId, load])

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); showToast({ type: 'success', message: 'Copied.' }) }
    catch { showToast({ type: 'warning', message: 'Clipboard unavailable.' }) }
  }

  if (loading && !post) {
    return (
      <div className={'rounded-2xl border p-10 flex items-center justify-center ' + cardBg}>
        <Loader2 size={20} className="animate-spin text-gray-400" />
      </div>
    )
  }
  if (!post) {
    return (
      <div className="space-y-3">
        <p className={'text-sm ' + muted}>This post could not be loaded.</p>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline cursor-pointer">
          <ArrowLeft size={14} /> Back to history
        </button>
      </div>
    )
  }

  const fullText = post.content?.fullText || ''
  const hashtags = post.content?.hashtags || []
  const isClamped = !expanded && fullText.length > CLAMP_AT
  const li = publish?.linkedin || { status: 'idle', url: '', error: '', label: '' }
  const x = publish?.x || { status: 'idle', url: '', error: '', label: '' }
  const liBusy = li.status === 'publishing'
  const xBusy = x.status === 'publishing'
  const linkedinUrl = (post.publishes || [])
    .filter((p) => p.platform === 'linkedin' && p.ok && p.url)
    .map((p) => p.url)
    .pop() || ''

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className={'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ' + (dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}>
          <ArrowLeft size={14} /> History
        </button>
        <button
          onClick={load}
          disabled={loading}
          className={'p-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 ' + (dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600')}
          title="Reload"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* content card */}
      <div className={'rounded-2xl border overflow-hidden ' + cardBg}>
        {post.imagePath && (
          <img src={post.imagePath} alt="" className="w-full max-h-[420px] object-cover" loading="lazy" />
        )}
        <div className="p-5 space-y-4">
          {fullText && (
            <p className="text-[15px] whitespace-pre-line break-words leading-relaxed">
              {isClamped ? fullText.slice(0, CLAMP_AT).trimEnd() + '... ' : fullText}
              {isClamped && (
                <button onClick={() => setExpanded(true)} className="text-blue-500 hover:underline cursor-pointer font-medium">see more</button>
              )}
            </p>
          )}
          {expanded && fullText.length > CLAMP_AT && (
            <button onClick={() => setExpanded(false)} className="text-blue-500 hover:underline cursor-pointer text-sm">see less</button>
          )}
          {hashtags.length > 0 && (
            <p className="text-blue-500 text-[15px]">{hashtags.map((h) => '#' + h.replace(/^#/, '')).join(' ')}</p>
          )}

          {post.xMessageTemplate && (
            <div className={'rounded-xl border p-3 flex items-start gap-2.5 ' + (dark ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50')}>
              <div className={'p-1.5 rounded-lg shrink-0 ' + (dark ? 'bg-gray-900' : 'bg-black')}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </div>
              <p className="text-sm break-words">{post.xMessageTemplate}</p>
            </div>
          )}

          {/* counters */}
          <div className={'flex items-center gap-4 text-xs pt-1 ' + muted}>
            <span className="inline-flex items-center gap-1"><Globe size={12} /> {post.linkedinCount || 0} LinkedIn post{(post.linkedinCount || 0) === 1 ? '' : 's'}</span>
            <span className="inline-flex items-center gap-1"><AtSign size={12} /> {post.xCount || 0} X post{(post.xCount || 0) === 1 ? '' : 's'}</span>
            <span>Created {new Date(post.createdAt).toLocaleString()}</span>
          </div>

          {/* publish actions (repost supported) */}
          {post.status === 'ready' && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => onPublishLinkedIn(post._id)}
                disabled={liBusy}
                title={linkedinUrl ? 'Publish again to LinkedIn' : 'Publish this post to LinkedIn'}
                className={'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all cursor-pointer disabled:opacity-60 ' + (dark ? 'bg-[#0a66c2] hover:bg-[#004182]' : 'bg-[#0a66c2] hover:opacity-90')}
              >
                {liBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {liBusy ? (li.label || 'Publishing…') : linkedinUrl ? 'Repost to LinkedIn' : 'Post to LinkedIn'}
              </button>
              <button
                onClick={() => onPublishX(post._id)}
                disabled={xBusy || !linkedinUrl}
                title={linkedinUrl ? 'Post a teaser to X linking to your LinkedIn post' : 'Publish to LinkedIn first'}
                className={'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 ' + (dark ? 'bg-black hover:bg-gray-900' : 'bg-black hover:opacity-90')}
              >
                {xBusy ? <Loader2 size={15} className="animate-spin" /> : <AtSign size={15} />}
                {xBusy ? (x.label || 'Posting…') : 'Post to X'}
              </button>
            </div>
          )}
          {(li.url || x.url) && (
            <div className="flex flex-wrap items-center gap-3">
              {li.url && (
                <a href={li.url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-[#0a66c2] hover:underline cursor-pointer">
                  <Globe size={11} /> Open latest LinkedIn post
                </a>
              )}
              {x.url && (
                <a href={x.url} target="_blank" rel="noreferrer" className="text-xs inline-flex items-center gap-1 text-sky-500 hover:underline cursor-pointer">
                  <AtSign size={11} /> Open latest X post
                </a>
              )}
            </div>
          )}
          {(li.error || x.error) && (
            <p className={'text-xs ' + (dark ? 'text-red-400' : 'text-red-500')}>{li.error || x.error}</p>
          )}
        </div>
      </div>

      {/* prompts inspector */}
      {(post.contentPrompt || post.imagePrompt) && (
        <details className={'rounded-2xl border px-4 py-3 group ' + cardBg}>
          <summary className="text-sm font-medium cursor-pointer select-none">Prompts the AI used</summary>
          <div className={'mt-3 space-y-3 text-xs ' + muted}>
            {[['Content prompt', post.contentPrompt], ['Image prompt', post.imagePrompt]].map(([label, val]) =>
              val ? (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{label}</span>
                    <button onClick={() => copy(val)} className="inline-flex items-center gap-1 text-blue-500 hover:underline cursor-pointer"><Copy size={11} /> Copy</button>
                  </div>
                  <pre className={'whitespace-pre-wrap max-h-40 overflow-y-auto rounded-lg p-2.5 border ' + (dark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50')}>{val}</pre>
                </div>
              ) : null
            )}
          </div>
        </details>
      )}

      {/* publish log */}
      <div className={'rounded-2xl border overflow-hidden ' + cardBg}>
        <div className={'px-4 py-3 text-sm font-medium border-b ' + (dark ? 'border-gray-700' : 'border-gray-200')}>
          Publish log
        </div>
        {(post.publishes || []).length === 0 ? (
          <p className={'px-4 py-6 text-sm text-center ' + muted}>Never published yet.</p>
        ) : (
          <ul className={'divide-y ' + (dark ? 'divide-gray-700' : 'divide-gray-200')}>
            {[...post.publishes].reverse().map((entry, i) => (
              <li key={i} className="px-4 py-3 flex items-start gap-3">
                {entry.ok
                  ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  : <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium capitalize inline-flex items-center gap-1.5">
                      {entry.platform === 'linkedin' ? <Globe size={13} /> : <AtSign size={13} />}
                      {entry.platform === 'x' ? 'X' : entry.platform}
                    </span>
                    <span className={'text-[10px] px-1.5 py-0.5 rounded-full font-medium ' +
                      (entry.ok ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500')}>
                      {entry.ok ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  {entry.ok && entry.url && (
                    <a href={entry.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline break-all cursor-pointer">{entry.url}</a>
                  )}
                  {!entry.ok && entry.error && (
                    <p className={'text-xs break-words ' + (dark ? 'text-red-400' : 'text-red-500')}>{entry.error}</p>
                  )}
                  <p className={'text-[10px] ' + muted}>{new Date(entry.postedAt).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
