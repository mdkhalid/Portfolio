import { useTheme } from '../context/ThemeContext'
import { Sun, Moon, Menu, X, Download } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const links = [
  { label: 'Home', href: '#hero' },
  { label: 'Skills', href: '#skills' },
  { label: 'Experience', href: '#experience' },
  { label: 'Projects', href: '#projects' },
  { label: 'Contact', href: '#contact' },
]

export default function Navbar({ resumes }) {
  const { dark, toggle } = useTheme()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const scrollTo = (href) => {
    setOpen(false)
    if (!isHome) { window.location.href = '/' + href; return }
    const el = document.querySelector(href)
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? dark ? 'bg-gray-900/95 backdrop-blur-xl border-b border-gray-800 shadow-lg shadow-black/20' : 'bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-lg shadow-gray-200/50'
          : dark ? 'bg-gray-900/80 backdrop-blur-xl border-b border-gray-800' : 'bg-white/80 backdrop-blur-xl border-b border-gray-200'
      }`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
            MK
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {links.map(l => (
              <button key={l.href} onClick={() => scrollTo(l.href)}
                className={`text-sm font-medium transition-colors ${dark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
                {l.label}
              </button>
            ))}
            {resumes?.length > 0 && resumes.map(r => (
              <a key={r._id} href={`/api/download-resume/${r.fileUrl.split('/').pop()}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm">
                <Download size={14} /> {r.label}
              </a>
            ))}
            <button onClick={toggle} className={`p-2 rounded-full transition-colors ${dark ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="flex md:hidden items-center gap-2">
            <button onClick={toggle} className={`p-2 rounded-full transition-colors ${dark ? 'bg-gray-800 text-yellow-400' : 'bg-gray-100 text-gray-600'}`}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setOpen(!open)}
              className={`p-2 rounded-lg transition-colors ${dark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'}`}>
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed top-0 right-0 bottom-0 z-50 w-72 flex flex-col md:hidden ${
                dark ? 'bg-gray-900 border-l border-gray-800' : 'bg-white border-l border-gray-200'
              } shadow-2xl`}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                <span className="text-lg font-bold bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
                  Menu
                </span>
                <button onClick={() => setOpen(false)}
                  className={`p-2 rounded-lg transition-colors ${dark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}>
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
                {links.map((l, i) => (
                  <motion.button
                    key={l.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => scrollTo(l.href)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      dark ? 'text-gray-300 hover:bg-gray-800 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}>
                    {l.label}
                  </motion.button>
                ))}

                {resumes?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    {resumes.map((r, i) => (
                      <motion.a
                        key={r._id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (links.length + i) * 0.05 }}
                        href={`/api/download-resume/${r.fileUrl.split('/').pop()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all">
                        <Download size={16} /> {r.label}
                      </motion.a>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
