import { useState } from 'react'
import { ThumbsUp, MessageCircle, Repeat2, Send, Globe, Pencil, RefreshCw, ImagePlus, Loader2, Save, X, Copy, ChevronDown } from 'lucide-react'
import { getApiErrorMessage } from '../../lib/api'

const CLAMP_AT = 420

export default function PostPreview({
  API, dark, showToast, post,
  linkedinProfile,
  regenBusy, // { text: bool, image: bool }
  onRegenerateText, onRegenerateImage, onUpdated, onNewPost,
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState(null)
  const [showPrompts, setShowPrompts] = useState(false)

  const cardBg = dark ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200'
  const muted = dark ? 'text-gray-400' : 'text-gray-500'
  const inputCls = 'w-full rounded-xl border p-3 text-sm outline-none transition-colors focus:border-blue-500 ' +
    (dark ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-gray-50 border-gray-300')

  if (!post) return null
  const fullText = post.content?.fullText || ''
  const hashtags = post.content?.hashtags || []
  const name = linkedinProfile?.userName || 'Your profile'
  const avatar = linkedinProfile?.avatarUrl

  const startEdit = () => {
    setDraft({
      fullText,
      xMessageTemplate: post.xMessageTemplate || '',
      hashtagsText: hashtags.join(', '),
    })
    setEditing(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const payload = {
        content: {
          fullText: draft.fullText,
          hashtags: draft.hashtagsText.split(',').map((h) => h.trim().replace(/^#/, '')).filter(Boolean),
        },
        xMessageTemplate: draft.xMessageTemplate,
      }
      const { data } = await API.put(`/api/social/posts/${post._id}`, payload)
      onUpdated(data.post)
      setEditing(false)
      showToast({ type: 'success', message: 'Changes saved.' })
    } catch (err) {
      showToast({ type: 'error', message: getApiErrorMessage(err, 'Could not save changes.') })
    } finally {
      setSaving(false)
    }
  }

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); showToast({ type: 'success', message: 'Copied.' }) }
    catch { showToast({ type: 'warning', message: 'Clipboard unavailable.' }) }
  }

  const isClamped = !expanded && fullText.length > CLAMP_AT

  return (
    <div className="space-y-4">
      {/* LinkedIn lookalike card */}
      <div className={'rounded-2xl border overflow-hidden ' + cardBg}>
        <div className="p-5 pb-3">
          {/* header */}
          <div className="flex items-start gap-3 mb-4">
            {avatar ? (
              <img src={avatar} alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-full object-cover border" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-600 to-blue-700 text-white flex items-center justify-center font-bold text-lg shrink-0">
                {(name[0] || 'Y').toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight truncate">{name}</p>
              <p className={'text-xs truncate ' + muted}>Software Architect · Just now · <Globe size={11} className="inline -mt-0.5" /></p>
            </div>
          </div>

          {/* body */}
          {editing ? (
            <div className="space-y-3">
              <textarea value={draft.fullText} onChange={(e) => setDraft((d) => ({ ...d, fullText: e.target.value }))} rows={10} maxLength={3000} className={inputCls + ' resize-y'} placeholder="Post text…" />
              <input value={draft.hashtagsText} onChange={(e) => setDraft((d) => ({ ...d, hashtagsText: e.target.value }))} className={inputCls} placeholder="hashtags, comma separated" />
              <input value={draft.xMessageTemplate} onChange={(e) => setDraft((d) => ({ ...d, xMessageTemplate: e.target.value }))} maxLength={280} className={inputCls} placeholder="X teaser (max 280 chars)" />
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                </button>
                <button onClick={() => setEditing(false)} className={'inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer ' + (dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}>
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[15px] whitespace-pre-line break-words leading-relaxed">
                {isClamped ? fullText.slice(0, CLAMP_AT).trimEnd() + '… ' : fullText}
                {!isClamped && ' '}
                {isClamped && (
                  <button onClick={() => setExpanded(true)} className="text-blue-500 hover:underline cursor-pointer font-medium">see more</button>
                )}
              </p>
              {expanded && fullText.length > CLAMP_AT && (
                <button onClick={() => setExpanded(false)} className="text-blue-500 hover:underline cursor-pointer text-sm mt-1">see less</button>
              )}
              {hashtags.length > 0 && (
                <p className="text-blue-500 mt-3 text-[15px]">{hashtags.map((h) => '#' + h.replace(/^#/, '')).join(' ')}</p>
              )}
            </>
          )}
        </div>

        {/* image */}
        {post.imagePath && !editing && (
          <button onClick={() => window.open(post.imagePath, '_blank')} className="block w-full cursor-zoom-in border-t" title="Open image">
            <img src={post.imagePath} alt="Generated post visual" className="w-full max-h-[520px] object-cover" />
          </button>
        )}

        {/* mock engagement bar */}
        {!editing && (
          <div className={'px-5 py-2.5 border-t text-xs flex items-center justify-between ' + (dark ? 'border-gray-700 ' + muted : 'border-gray-200 ' + muted)}>
            <span>· 0 comments</span>
            <div className="flex items-center gap-4 opacity-60" title="Preview only — real engagement appears on LinkedIn">
              <ThumbsUp size={15} /><MessageCircle size={15} /><Repeat2 size={15} /><Send size={15} />
            </div>
          </div>
        )}
      </div>

      {/* X teaser preview */}
      {!editing && post.xMessageTemplate && (
        <div className={'rounded-2xl border p-4 flex items-start gap-3 ' + cardBg}>
          <div className={'p-2 rounded-lg shrink-0 ' + (dark ? 'bg-gray-900' : 'bg-black')}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold mb-0.5">X teaser</p>
            <p className="text-sm break-words">{post.xMessageTemplate}</p>
            <p className={'text-xs mt-1 ' + muted}>+ LinkedIn post link appended automatically when posted.</p>
          </div>
        </div>
      )}

      {/* actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onRegenerateImage}
          disabled={regenBusy?.image}
          title="Generate a new image from the image prompt"
          className={'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 ' +
          (dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}
        >
          {regenBusy?.image ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Regenerate image
        </button>
        <button
          onClick={onRegenerateText}
          disabled={regenBusy?.text}
          title="Rewrite the post content"
          className={'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 ' +
          (dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}
        >
          {regenBusy?.text ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Regenerate content
        </button>
        {!editing && (
          <button onClick={startEdit} className={'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ' + (dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}>
            <Pencil size={15} /> Edit
          </button>
        )}
        <div className="flex-1" />
        <button
          disabled
          title="Publishing arrives with the next update"
          className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#0a66c2] text-white text-sm font-semibold opacity-50 cursor-not-allowed"
        >
          Post to LinkedIn <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20">soon</span>
        </button>
      </div>

      {/* prompts inspector */}
      <div className={'rounded-2xl border overflow-hidden ' + cardBg}>
        <button onClick={() => setShowPrompts((v) => !v)} className={'w-full flex items-center justify-between px-4 py-3 text-sm cursor-pointer '}>
          <span className="font-medium">Prompts the AI used</span>
          <ChevronDown size={16} className={'transition-transform ' + (showPrompts ? 'rotate-180' : '')} />
        </button>
        {showPrompts && (
          <div className={'px-4 pb-4 space-y-3 ' + muted}>
            {[['Content prompt', post.contentPrompt], ['Image prompt', post.imagePrompt]].map(([label, val]) => (
              val ? (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{label}</span>
                    <button onClick={() => copy(val)} className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline cursor-pointer"><Copy size={12} /> Copy</button>
                  </div>
                  <pre className={'text-xs whitespace-pre-wrap max-h-40 overflow-y-auto rounded-lg p-2.5 border ' + (dark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50')}>{val}</pre>
                </div>
              ) : null
            ))}
          </div>
        )}
      </div>

      <button onClick={onNewPost} className={'w-full py-2.5 rounded-xl text-sm font-medium cursor-pointer ' + (dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}>
        + New post
      </button>
    </div>
  )
}
