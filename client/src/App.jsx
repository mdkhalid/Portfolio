import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Home from './pages/Home'
import ScrollToTop from './components/ScrollToTop'
import CookieConsent from './components/CookieConsent'

const BentoHome = lazy(() => import('./pages/BentoHome'))
const ResumePage = lazy(() => import('./pages/ResumePage'))
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const ATSCheckerPage = lazy(() => import('./pages/ATSCheckerPage'))
const BlogPage = lazy(() => import('./pages/BlogPage'))
const ArticlePage = lazy(() => import('./pages/ArticlePage'))
const PostmortemsPage = lazy(() => import('./pages/PostmortemsPage'))
const PostmortemDetailPage = lazy(() => import('./pages/PostmortemDetailPage'))

function ProtectedRoute({ children }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/admin" replace />
  return children
}

function SuspenseWrapper({ children }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      {children}
    </Suspense>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <CookieConsent />
      <SuspenseWrapper>
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
        <Route path="/postmortems" element={<PostmortemsPage />} />
        <Route path="/postmortems/:slug" element={<PostmortemDetailPage />} />
      </Routes>
      </SuspenseWrapper>
    </>
  )
}
