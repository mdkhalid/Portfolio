import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import MermaidDiagram from '../components/MermaidDiagram'
import { ArrowLeft, Sun, Moon, Calendar, Tag, Clock, AlertTriangle, CheckCircle2, XCircle, AlertCircle, Activity, Server, FileText, Share2, Link2, Check } from 'lucide-react'
import SEO from '../components/SEO'

const SEVERITY_STYLES = {
  SEV1: { dot: 'bg-red-500', text: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Critical' },
  SEV2: { dot: 'bg-orange-500', text: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'Major' },
  SEV3: { dot: 'bg-yellow-500', text: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Minor' },
}

const STATUS_STYLES = {
  resolved:    { dot: 'bg-emerald-500', text: 'text-emerald-500', label: 'Resolved' },
  mitigated:   { dot: 'bg-cyan-500',    text: 'text-cyan-500',    label: 'Mitigated' },
  monitoring:  { dot: 'bg-blue-500',    text: 'text-blue-500',    label: 'Monitoring' },
  ongoing:     { dot: 'bg-red-500',     text: 'text-red-500',     label: 'Ongoing' },
}

const DETECTION_LABELS = {
  pagerduty: 'PagerDuty',
  customer_report: 'Customer Report',
  internal_monitoring: 'Internal Monitoring',
  on_call: 'On-Call Engineer',
  social_media: 'Social Media',
  synthetic: 'Synthetic Monitor',
  other: 'Other',
}

const formatDuration = (mins) => {
  if (!mins || mins < 1) return '<1 min'
  if (mins < 60) return `${mins} min`
  if (mins < 1440) return `${Math.round(mins / 60)}h`
  return `${Math.round(mins / 1440)}d`
}

const formatDate = (date) => new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
const formatTime = (date) => new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })

const ActionStatusBadge = ({ status, dark }) => {
  const styles = {
    todo:        { dot: 'bg-gray-400',   text: 'text-gray-500',   label: 'Todo' },
    in_progress: { dot: 'bg-blue-500',   text: 'text-blue-500',   label: 'In Progress' },
    done:        { dot: 'bg-emerald-500', text: 'text-emerald-500', label: 'Done' },
    wont_fix:    { dot: 'bg-gray-400',   text: 'text-gray-500',   label: "Won't Fix" },
  }
  const s = styles[status] || styles.todo
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold ${dark ? 'bg-gray-800' : 'bg-gray-100'} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

const PriorityBadge = ({ priority, dark }) => {
  const colors = {
    P0: 'text-red-500',
    P1: 'text-orange-500',
    P2: 'text-yellow-500',
    P3: 'text-gray-500',
  }
  return <span className={`text-[10px] font-mono font-bold ${colors[priority] || colors.P1}`}>{priority}</span>
}

export default function PostmortemDetailPage() {
  const { slug } = useParams()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [pm, setPm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data } = await axios.get('/api/postmortems/' + slug)
        setPm(data)
      } catch (err) {
        if (err.response?.status === 404) setError('Postmortem not found')
        else setError('Failed to load postmortem. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    if (slug) fetch()
  }, [slug])

  const url = typeof window !== 'undefined' ? window.location.href : ''
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !pm) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${dark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <p className="text-lg font-medium mb-2">{error || 'Postmortem not found'}</p>
        <button onClick={() => navigate('/postmortems')} className="text-sm text-red-500 hover:underline cursor-pointer">Back to Failure Log</button>
      </div>
    )
  }

  const sev = SEVERITY_STYLES[pm.severity] || SEVERITY_STYLES.SEV3
  const st = STATUS_STYLES[pm.status] || STATUS_STYLES.resolved
  const actionStats = pm.actionItems?.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1
    return acc
  }, {}) || {}
  const actionTotal = pm.actionItems?.length || 0

  return (
    <>
      <SEO title={`${pm.title} — Failure Log`} description={pm.excerpt || pm.title} />
      <div className={`min-h-screen ${dark ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${dark ? 'bg-gray-950/90 border-gray-800' : 'bg-white/90 border-gray-200'}`}>
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
            <button onClick={() => navigate('/postmortems')} className={`p-2 rounded-lg transition-colors cursor-pointer ${dark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{pm.title}</p>
            </div>
            <button onClick={copyLink}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${copied
                ? 'bg-emerald-500 text-white'
                : dark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`} title={copied ? 'Copied!' : 'Copy link'}>
              {copied ? <Check size={16} /> : <Link2 size={16} />}
            </button>
            <button onClick={toggle} className={`p-2 rounded-full transition-colors cursor-pointer ${dark ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Severity banner */}
            <div className={`rounded-2xl border ${sev.border} ${sev.bg} p-5 mb-8 flex flex-wrap items-center gap-3`}>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold ${dark ? 'bg-gray-950' : 'bg-white'} ${sev.text}`}>
                <span className={`w-2 h-2 rounded-full ${sev.dot}`} />
                {pm.severity}
              </span>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${dark ? 'bg-gray-950' : 'bg-white'} ${st.text}`}>
                <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                {st.label}
              </span>
              <div className="flex-1" />
              <div className={`flex flex-wrap items-center gap-4 text-xs ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                <span className="flex items-center gap-1.5"><Calendar size={13} /> {formatDate(pm.incidentDate)}</span>
                <span className="flex items-center gap-1.5"><Clock size={13} /> {formatDuration(pm.durationMinutes)}</span>
                <span className="flex items-center gap-1.5"><Activity size={13} /> {DETECTION_LABELS[pm.detectionSource] || pm.detectionSource}</span>
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4 leading-tight">{pm.title}</h1>
            {pm.excerpt && (
              <p className={`text-lg leading-relaxed mb-8 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{pm.excerpt}</p>
            )}

            {pm.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {pm.tags.map(tag => (
                  <span key={tag} className={`flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-medium ${dark ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                    <Tag size={10} /> {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Quick stats grid */}
            <div className="grid sm:grid-cols-3 gap-3 mb-8">
              <div className={`rounded-xl border p-4 ${dark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className={`text-xs font-medium mb-1 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>Duration</div>
                <div className="text-xl font-bold">{formatDuration(pm.durationMinutes)}</div>
                {pm.resolvedDate && (
                  <div className={`text-[10px] mt-1 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
                    Resolved {formatTime(pm.resolvedDate)}
                  </div>
                )}
              </div>
              <div className={`rounded-xl border p-4 ${dark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className={`text-xs font-medium mb-1 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>Systems affected</div>
                <div className="text-xl font-bold">{pm.systemsAffected?.length || 0}</div>
              </div>
              <div className={`rounded-xl border p-4 ${dark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className={`text-xs font-medium mb-1 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>Action items</div>
                <div className="text-xl font-bold flex items-baseline gap-1.5">
                  {actionStats.done || 0}<span className={`text-sm font-normal ${dark ? 'text-gray-500' : 'text-gray-400'}`}>/ {actionTotal}</span>
                </div>
              </div>
            </div>

            {/* Customer impact */}
            {pm.customerImpact && (
              <SectionCard icon={<AlertCircle size={18} />} title="Customer impact" dark={dark}>
                <p className={`text-sm leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{pm.customerImpact}</p>
              </SectionCard>
            )}

            {/* Root cause */}
            {pm.rootCause && (
              <SectionCard icon={<FileText size={18} />} title="Root cause" dark={dark}>
                <p className={`text-sm leading-relaxed whitespace-pre-line ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{pm.rootCause}</p>
              </SectionCard>
            )}

            {/* Contributing factors */}
            {pm.contributingFactors?.length > 0 && (
              <SectionCard icon={<XCircle size={18} />} title="Contributing factors" dark={dark}>
                <ul className="space-y-2">
                  {pm.contributingFactors.map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed">
                      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-2 ${dark ? 'bg-orange-400' : 'bg-orange-500'}`} />
                      <span className={dark ? 'text-gray-300' : 'text-gray-700'}>{c}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Timeline */}
            {pm.timeline?.length > 0 && (
              <SectionCard icon={<Activity size={18} />} title="Timeline" dark={dark}>
                <ol className="relative pl-6">
                  <span className={`absolute left-2 top-2 bottom-2 w-px ${dark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                  {pm.timeline.map((e, i) => (
                    <li key={i} className="relative pb-4 last:pb-0">
                      <span className={`absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full border-2 ${dark ? 'bg-gray-950 border-red-500' : 'bg-white border-red-500'}`} />
                      {e.time && <div className={`text-xs font-mono font-semibold ${dark ? 'text-red-400' : 'text-red-600'} mb-0.5`}>{e.time}</div>}
                      <div className={`text-sm leading-relaxed ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{e.label}</div>
                    </li>
                  ))}
                </ol>
              </SectionCard>
            )}

            {/* What went well / didn't */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {pm.whatWentWell?.length > 0 && (
                <SectionCard icon={<CheckCircle2 size={18} />} title="What went well" dark={dark} accent="emerald">
                  <ul className="space-y-2">
                    {pm.whatWentWell.map((w, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-relaxed">
                        <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                        <span className={dark ? 'text-gray-300' : 'text-gray-700'}>{w}</span>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              )}
              {pm.whatDidntGoWell?.length > 0 && (
                <SectionCard icon={<XCircle size={18} />} title="What didn't go well" dark={dark} accent="red">
                  <ul className="space-y-2">
                    {pm.whatDidntGoWell.map((w, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-relaxed">
                        <XCircle size={14} className="flex-shrink-0 mt-0.5 text-red-500" />
                        <span className={dark ? 'text-gray-300' : 'text-gray-700'}>{w}</span>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              )}
            </div>

            {/* Action items */}
            {pm.actionItems?.length > 0 && (
              <SectionCard icon={<CheckCircle2 size={18} />} title={`Action items (${actionStats.done || 0}/${actionTotal} done)`} dark={dark}>
                <ul className="space-y-2">
                  {pm.actionItems.map((a, i) => (
                    <li key={i} className={`flex flex-wrap items-start gap-2 p-3 rounded-lg ${dark ? 'bg-gray-900/40' : 'bg-gray-50'}`}>
                      <PriorityBadge priority={a.priority} dark={dark} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm leading-relaxed ${dark ? 'text-gray-200' : 'text-gray-800'}`}>{a.action}</div>
                        {a.owner && (
                          <div className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-500'}`}>Owner: {a.owner}</div>
                        )}
                      </div>
                      <ActionStatusBadge status={a.status} dark={dark} />
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Full markdown content */}
            {pm.content && (
              <div className={`prose prose-sm max-w-none mt-8 ${dark ? 'prose-invert' : ''}
                prose-headings:font-bold prose-headings:tracking-tight
                prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
                prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                prose-p:leading-relaxed prose-p:my-4
                prose-a:text-red-500 prose-a:no-underline hover:prose-a:underline
                prose-strong:font-bold
                prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm
                ${dark ? 'prose-code:bg-gray-800 prose-code:text-red-300' : 'prose-code:bg-gray-100 prose-code:text-red-700'}
                prose-pre:rounded-xl prose-pre:border prose-pre:p-4
                ${dark ? 'prose-pre:bg-gray-800 prose-pre:border-gray-700' : 'prose-pre:bg-gray-50 prose-pre:border-gray-200'}
                prose-img:rounded-xl prose-img:my-6 prose-img:mx-auto
                prose-blockquote:border-l-red-500 prose-blockquote:not-italic
                prose-li:my-1
                prose-table:my-6
              `}>
                <ReactMarkdown components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    if (match && match[1] === 'mermaid') {
                      return <MermaidDiagram chart={String(children).replace(/\n$/, '')} />
                    }
                    if (match) {
                      return (
                        <pre className={`rounded-xl border p-4 text-sm overflow-x-auto ${dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                          <code className={className} {...props}>{children}</code>
                        </pre>
                      )
                    }
                    return <code className={className} {...props}>{children}</code>
                  }
                }}>
                  {pm.content}
                </ReactMarkdown>
              </div>
            )}

            {/* Bottom share */}
            <div className={`mt-12 pt-8 border-t ${dark ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <button onClick={() => navigate('/postmortems')} className={`flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer ${dark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                  <ArrowLeft size={16} /> Back to Failure Log
                </button>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Share:</span>
                  <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0A66C2] text-white hover:bg-[#0A66C2]/90 transition-all cursor-pointer">
                    LinkedIn
                  </a>
                  <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(pm.title)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${dark ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    X
                  </a>
                  <button onClick={copyLink}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${copied
                      ? 'bg-emerald-500 text-white'
                      : dark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    </>
  )
}

function SectionCard({ icon, title, children, dark, accent }) {
  const accentColor = accent === 'emerald' ? 'text-emerald-500'
                    : accent === 'red' ? 'text-red-500'
                    : 'text-red-500'
  return (
    <div className={`rounded-2xl border p-5 mb-6 ${dark ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
      <h3 className={`flex items-center gap-2 text-sm font-bold mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>
        <span className={accentColor}>{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  )
}
