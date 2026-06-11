import { CheckCircle2, XCircle } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export default function KeywordTag({ word, match }) {
  const { dark } = useTheme()
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
      match
        ? dark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : dark ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-700 border border-red-200'
    }`}>
      {match ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {word}
    </span>
  )
}
