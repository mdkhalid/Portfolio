import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'

const MAX_NOTES = 5000

export default function ComposeForm({ dark, submitting, onGenerate }) {
  const [notes, setNotes] = useState('')
  const tooShort = notes.trim().length < 10
  const tooLong = notes.length > MAX_NOTES
  const disabled = submitting || tooShort || tooLong

  const cardBg = dark ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200'
  const muted = dark ? 'text-gray-400' : 'text-gray-500'

  return (
    <div className={'rounded-2xl border p-5 space-y-4 ' + cardBg}>
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-blue-500" />
        <h3 className="font-semibold">New post</h3>
      </div>
      <p className={'text-sm ' + muted}>
        Explain the new tech or concept in a few lines — the AI turns it into a full LinkedIn post with an image.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={6}
        placeholder={'e.g. Built a small tool using WebAssembly this weekend. Browsers can now run near-native code — here is what surprised me about startup time and bundle size…'}
        className={'w-full resize-y rounded-xl border p-3 text-sm outline-none transition-colors focus:border-blue-500 ' +
          (dark ? 'bg-gray-900 border-gray-700 text-gray-100 placeholder-gray-600' : 'bg-gray-50 border-gray-300 placeholder-gray-400')}
      />
      <div className="flex items-center justify-between gap-3">
        <span className={'text-xs ' + muted}>
          {notes.length}/{MAX_NOTES} chars{tooShort && notes.length > 0 ? ' · at least 10 needed' : ''}
        </span>
        <button
          onClick={() => onGenerate(notes)}
          disabled={disabled}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {submitting ? 'Starting…' : 'Generate post'}
        </button>
      </div>
    </div>
  )
}
