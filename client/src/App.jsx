import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Home from './pages/Home'
import BentoHome from './pages/BentoHome'
import ResumePage from './pages/ResumePage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import ChatPage from './pages/ChatPage'
import ATSCheckerPage from './pages/ATSCheckerPage'
import BlogPage from './pages/BlogPage'
import ArticlePage from './pages/ArticlePage'
import ScrollToTop from './components/ScrollToTop'
import CookieConsent from './components/CookieConsent'

function ProtectedRoute({ children }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/admin" replace />
  return children
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <CookieConsent />
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/bento" element={<BentoHome />} />
      <Route path="/resume" element={<ResumePage />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={
        <ProtectedRoute>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/ats-checker" element={<ATSCheckerPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<ArticlePage />} />
    </Routes>
    </>
  )
}
