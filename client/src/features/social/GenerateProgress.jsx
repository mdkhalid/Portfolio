import { motion } from 'framer-motion'
import { Loader2, CheckCircle2, AlertTriangle, Circle } from 'lucide-react'

const ALL_STEPS = [
  { key: 'building_prompts', label: 'Building prompts' },
  { key: 'writing_content', label: 'Writing post content' },
  { key: 'creating_image', label: 'Creating image' },
  { key: 'saving_draft', label: 'Saving draft' },
]

function visibleSteps(mode) {
  if (mode === 'text') return ALL_STEPS.filter((s) => s.key !== 'creating_image')
  if (mode === 'image') return ALL_STEPS.filter((s) => ['creating_image', 'saving_draft'].includes(s.key))
  return ALL_STEPS
}

export default function GenerateProgress({ dark, steps, mode = 'full', error, onRetry, onBack }) {
  const shown = visibleSteps(mode)
  const statusOf = (key) => steps.find((s) => s.key === key)?.status || 'pending'
  const doneCount = shown.filter((s) => statusOf(s.key) === 'done').length
  const failed = Boolean(error)
  const pct = Math.round((doneCount / shown.length) * 100)

  const muted = dark ? 'text-gray-400' : 'text-gray-500'
  const cardBg = dark ? 'bg-gray-800/60 border-gray-700' : 'bg-white border-gray-200'

  return (
    <div className={'rounded-2xl border p-5 space-y-5 ' + cardBg}>
      <div className="space-y-1">
        <h3 className="font-semibold">{failed ? 'Generation stopped' : 'Generating your post…'}</h3>
        <p className={'text-xs ' + muted}>You can leave this tab — the work continues in the background.</p>
      </div>

      <div className={'h-1.5 rounded-full overflow-hidden ' + (dark ? 'bg-gray-700' : 'bg-gray-200')}>
        <motion.div
          className={'h-full rounded-full ' + (failed ? 'bg-red-500' : 'bg-gradient-to-r from-blue-600 to-cyan-500')}
          animate={{ width: failed ? '100%' : `${Math.max(pct, 6)}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      <div className="space-y-3">
        {shown.map((s) => {
          const st = statusOf(s.key)
          return (
            <div key={s.key} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {st === 'active' && <Loader2 size={18} className="animate-spin text-blue-500" />}
                {st === 'done' && <CheckCircle2 size={18} className="text-emerald-500" />}
                {st === 'error' && <AlertTriangle size={18} className="text-red-500" />}
                {st === 'pending' && <Circle size={18} className={dark ? 'text-gray-600' : 'text-gray-300'} />}
              </div>
              <div className="min-w-0">
                <p className={'text-sm font-medium ' + (st === 'pending' ? muted : '')}>{s.label}</p>
                {s.error && <p className="text-xs text-red-500 mt-0.5 break-words">{s.error}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {failed && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 pt-1">
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-medium hover:opacity-90 cursor-pointer"
          >
            Try again
          </button>
          <button
            onClick={onBack}
            className={'px-4 py-2 rounded-xl text-sm font-medium cursor-pointer ' + (dark ? 'bg-gray-800 hover:bg-gray-700 text-gray-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700')}
          >
            Edit notes
          </button>
        </motion.div>
      )}
    </div>
  )
}
