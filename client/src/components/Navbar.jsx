import { useTheme } from '../context/ThemeContext'
import { Sun, Moon, Menu, X, Download } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

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
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  const scrollTo = (href) => {
    setOpen(false)
    if (!isHome) { window.location.href = '/' + href; return }
    const el = document.querySelector(href)
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${dark ? 'bg-gray-900/90 backdrop-blur-xl border-b border-gray-800' : 'bg-white/80 backdrop-blur-xl border-b border-gray-200'}`}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
          MK
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {links.map(l => (
            <button key={l.href} onClick={() => scrollTo(l.href)}
              className={`text-sm font-medium transition-colors ${dark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
              {l.label}
            </button>
          ))}
          {resumes?.length > 0 && resumes.map(r => (
            <a key={r._id} href={r.fileUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-sm">
              <Download size={14} /> {r.label}
            </a>
          ))}
          <button onClick={toggle} className={`p-2 rounded-full transition-colors ${dark ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link to="/admin" className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all">
            Admin
          </Link>
        </div>

        <button onClick={() => setOpen(!open)} className={`md:hidden p-2 ${dark ? 'text-white' : 'text-gray-800'}`}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className={`md:hidden px-4 pb-4 ${dark ? 'bg-gray-900' : 'bg-white'}`}>
          {links.map(l => (
            <button key={l.href} onClick={() => scrollTo(l.href)}
              className={`block w-full text-left py-2 text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
              {l.label}
            </button>
          ))}
          {resumes?.length > 0 && resumes.map(r => (
            <a key={r._id} href={r.fileUrl} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-2 py-2 text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}
              onClick={() => setOpen(false)}>
              <Download size={16} /> {r.label}
            </a>
          ))}
          <button onClick={toggle} className={`flex items-center gap-2 py-2 text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
            {dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? 'Light' : 'Dark'} Mode
          </button>
          <Link to="/admin" className="block mt-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 text-center"
            onClick={() => setOpen(false)}>Admin</Link>
        </div>
      )}
    </nav>
  )
}
