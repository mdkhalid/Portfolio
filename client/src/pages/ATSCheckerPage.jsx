import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../context/ThemeContext'
import { ArrowLeft, Sun, Moon, Upload, FileText, Briefcase, Loader2, Target, CheckCircle2, XCircle, Lightbulb, TrendingUp, Sparkles, ScrollText, AlertCircle, BarChart3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import SEO from '../components/SEO'

function CircularScore({ score, size = 180 }) {
  const radius = (size - 20) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const strokeWidth = 12

  const getColor = (s) => {
    if (s >= 80) return '#10b981'
    if (s >= 60) return '#3b82f6'
    if (s >= 40) return '#f59e0b'
    return '#ef4444'
  }

  const color = getColor(score)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-gray-200 dark:text-gray-700" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="drop-shadow-lg"
          style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.8, type: 'spring' }}
          className="text-4xl font-bold"
          style={{ color }}
        >
          {score}
        </motion.span>
        <span className={`text-xs font-medium mt-0.5 ${score >= 60 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
          {score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Needs Work' : 'Low'}
        </span>
      </div>
    </div>
  )
}

function ScoreBar({ label, score, index }) {
  const getColor = (s) => {
    if (s >= 80) return 'from-emerald-500 to-emerald-400'
    if (s >= 60) return 'from-blue-500 to-cyan-400'
    if (s >= 40) return 'from-amber-500 to-amber-400'
    return 'from-red-500 to-red-400'
  }

  const getBg = (s) => {
    if (s >= 80) return 'bg-emerald-500/20'
    if (s >= 60) return 'bg-blue-500/20'
    if (s >= 40) return 'bg-amber-500/20'
    return 'bg-red-500/20'
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.1, duration: 0.4 }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="font-bold" style={{ color: score >= 80 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444' }}>{score}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, delay: 0.5 + index * 0.1, ease: 'easeOut' }}
          className={`h-full rounded-full bg-gradient-to-r ${getColor(score)} shadow-sm`}
          style={{ boxShadow: `0 0 12px ${score >= 60 ? '#3b82f640' : score >= 40 ? '#f59e0b40' : '#ef444440'}` }}
        />
      </div>
    </motion.div>
  )
}

function KeywordTag({ word, match }) {
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

const SAMPLE_JD = `We are looking for a Senior Full Stack Developer with expertise in React, Node.js, and cloud technologies. The ideal candidate has strong experience with MongoDB, REST APIs, microservices architecture, and CI/CD pipelines. Knowledge of Docker, Kubernetes, and AWS is preferred. The role requires leading development teams, conducting code reviews, and delivering scalable solutions.`;

export default function ATSCheckerPage() {
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [jobDescription, setJobDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = (f) => {
    if (!f) return
    if (f.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB')
      return
    }
    setError(null)
    setFile(f)
    setResult(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleSubmit = async () => {
    if (!file) { setError('Please upload a resume PDF'); return }
    if (!jobDescription.trim()) { setError('Please enter a job description'); return }

    setLoading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('resume', file)
    formData.append('jobDescription', jobDescription.trim())

    try {
      const { data } = await axios.post('/api/ats-score', formData)
      setResult(data)
    } catch (err) {
      const serverMsg = err.response?.data?.error
      setError(serverMsg || 'The AI service is temporarily unavailable. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const breakdownKeys = [
    { key: 'keywordMatch', icon: Target, label: 'Keyword Match' },
    { key: 'skillsAlignment', icon: TrendingUp, label: 'Skills Alignment' },
    { key: 'experienceRelevance', icon: Briefcase, label: 'Experience Relevance' },
    { key: 'educationFit', icon: ScrollText, label: 'Education Fit' },
    { key: 'formatting', icon: FileText, label: 'Formatting & Parsability' },
  ]

  return (
    <>
      <SEO
        title="ATS Resume Score Checker — Mohammad Khalid"
        description="Upload your resume and paste a job description to get an AI-powered ATS compatibility score with detailed breakdown"
      />
      <div className={`min-h-screen ${dark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        {/* Header */}
        <header className={`sticky top-0 z-30 border-b backdrop-blur-xl ${
          dark ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-200'
        }`}>
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                dark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <Target size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h1 className={`font-bold text-base ${dark ? 'text-white' : 'text-gray-900'}`}>ATS Resume Score Checker</h1>
              <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>AI-powered resume analysis against any job description</p>
            </div>
            <button
              onClick={toggle}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                dark ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Intro */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Sparkles size={14} /> AI-Powered Analysis
            </div>
            <h2 className={`text-2xl md:text-3xl font-bold mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>
              How ATS-Friendly Is Your Resume?
            </h2>
            <p className={`text-sm max-w-xl mx-auto ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              Upload your resume in PDF format, paste the job description, and get an instant AI-powered ATS compatibility score with detailed recommendations.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column - Inputs */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              {/* File Upload */}
              <div className={`p-6 rounded-2xl border-2 border-dashed transition-all ${
                dragOver
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : file
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : dark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-300 bg-white'
              } ${dark ? 'hover:border-gray-600' : 'hover:border-gray-400'}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files[0])}
                />
                <div className="text-center cursor-pointer">
                  {file ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <FileText size={24} className="text-white" />
                      </div>
                      <div>
                        <p className={`font-medium text-sm ${dark ? 'text-white' : 'text-gray-900'}`}>{file.name}</p>
                        <p className={`text-xs mt-0.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {(file.size / 1024).toFixed(0)} KB — Click to change
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                        dark ? 'bg-gray-700' : 'bg-gray-100'
                      }`}>
                        <Upload size={24} className={dark ? 'text-gray-400' : 'text-gray-500'} />
                      </div>
                      <div>
                        <p className={`font-medium text-sm ${dark ? 'text-white' : 'text-gray-900'}`}>
                          Drop your resume PDF here
                        </p>
                        <p className={`text-xs mt-0.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                          or click to browse · Max 10MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Job Description */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Job Description
                  </label>
                  <button
                    onClick={() => setJobDescription(SAMPLE_JD)}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Use sample JD
                  </button>
                </div>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here..."
                  rows={10}
                  className={`w-full px-4 py-3.5 rounded-xl border outline-none text-sm leading-relaxed transition-all focus:ring-2 focus:ring-emerald-500/30 resize-none ${
                    dark
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-emerald-500'
                      : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-emerald-400'
                  }`}
                />
                <p className={`text-xs mt-1.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                  {jobDescription.length} characters
                </p>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || !file || !jobDescription.trim()}
                className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl text-white font-medium bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> Analyzing...</>
                ) : (
                  <><Target size={18} /> Check ATS Score</>
                )}
              </button>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 px-4 py-2.5 rounded-xl"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.p>
              )}
            </motion.div>

            {/* Right Column - Results */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <AnimatePresence mode="wait">
                {!result && !loading && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`h-full flex flex-col items-center justify-center text-center p-10 rounded-2xl border-2 border-dashed ${
                      dark ? 'border-gray-700' : 'border-gray-200'
                    }`}
                  >
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-5 ${
                      dark ? 'bg-gray-800' : 'bg-gray-100'
                    }`}>
                      <Target size={36} className={dark ? 'text-gray-600' : 'text-gray-300'} />
                    </div>
                    <h3 className={`text-lg font-semibold mb-2 ${dark ? 'text-gray-300' : 'text-gray-500'}`}>
                      Your ATS Score Will Appear Here
                    </h3>
                    <p className={`text-sm max-w-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Upload your resume and paste a job description to get a detailed AI-powered ATS compatibility analysis.
                    </p>
                  </motion.div>
                )}

                {loading && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`h-full flex flex-col items-center justify-center p-10 rounded-2xl ${
                      dark ? 'bg-gray-800/50' : 'bg-white'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <FileText size={28} className="text-emerald-500" />
                      </div>
                    </div>
                    <p className={`text-sm font-medium mt-6 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                      Analyzing your resume...
                    </p>
                    <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Comparing against the job description
                    </p>
                  </motion.div>
                )}

                {result && !loading && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {/* Overall Score Card */}
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5, type: 'spring' }}
                      className={`p-8 rounded-2xl text-center border ${
                        dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                      } shadow-xl`}
                    >
                      <div className="flex flex-col items-center">
                        <CircularScore score={result.overallScore} />
                        <p className={`text-sm mt-4 max-w-md ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {result.summary}
                        </p>
                      </div>
                    </motion.div>

                    {/* Breakdown Bars */}
                    <div className={`p-6 rounded-2xl border ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-5 flex items-center gap-2">
                        <BarChart3 size={16} className="text-gray-400" /> Score Breakdown
                      </h3>
                      <div className="space-y-4">
                        {breakdownKeys.map(({ key, icon: Icon, label }, i) => {
                          const item = result.breakdown?.[key]
                          if (!item) return null
                          return (
                            <div key={key}>
                              <ScoreBar label={label} score={item.score} index={i} />
                              {item.description && (
                                <p className={`text-xs mt-1 ml-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                                  {item.description}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Keywords */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      {result.matchingKeywords?.length > 0 && (
                        <div className={`p-5 rounded-2xl border ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
                            <CheckCircle2 size={16} /> Matching Keywords
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {result.matchingKeywords.map((kw, i) => (
                              <motion.div
                                key={kw}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.8 + i * 0.03 }}
                              >
                                <KeywordTag word={kw} match />
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.missingKeywords?.length > 0 && (
                        <div className={`p-5 rounded-2xl border ${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                            <XCircle size={16} /> Missing Keywords
                          </h4>
                          <div className="flex flex-wrap gap-1.5">
                            {result.missingKeywords.map((kw, i) => (
                              <motion.div
                                key={kw}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.8 + i * 0.03 }}
                              >
                                <KeywordTag word={kw} match={false} />
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Strengths & Improvements */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      {result.strengths?.length > 0 && (
                        <div className={`p-5 rounded-2xl border ${dark ? 'bg-gray-800 border-emerald-500/10' : 'bg-white border-emerald-200'}`}>
                          <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">
                            <Lightbulb size={16} /> Strengths
                          </h4>
                          <ul className="space-y-2">
                            {result.strengths.map((s, i) => (
                              <motion.li
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 1 + i * 0.1 }}
                                className={`flex items-start gap-2 text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}
                              >
                                <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                {s}
                              </motion.li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {result.improvements?.length > 0 && (
                        <div className={`p-5 rounded-2xl border ${dark ? 'bg-gray-800 border-amber-500/10' : 'bg-white border-amber-200'}`}>
                          <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">
                            <AlertCircle size={16} /> Improvement Tips
                          </h4>
                          <ul className="space-y-2">
                            {result.improvements.map((s, i) => (
                              <motion.li
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 1 + i * 0.1 }}
                                className={`flex items-start gap-2 text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}
                              >
                                <AlertCircle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                {s}
                              </motion.li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Retry button */}
                    <button
                      onClick={() => { setResult(null); setFile(null); setJobDescription('') }}
                      className="w-full py-3 rounded-xl text-sm font-medium border-2 border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer"
                    >
                      Analyze Another Resume
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  )
}


