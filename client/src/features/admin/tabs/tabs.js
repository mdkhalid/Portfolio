import { User, Code2, Briefcase, GraduationCap, Award, FolderGit2, FileText, FileStack, BookOpen, Mail, Phone, MessagesSquare, BarChart3, Globe, Briefcase as BriefcaseIcon, ListTodo, UserCheck, Share2 } from 'lucide-react'

// Per-tab route components live alongside this file (Phase 3.2).
// Heavy tabs (Jobs, JobApps, Tracking, ManualApply, Resumes, Articles,
// Messages, Leads, Analytics, LiveChat) still render inside
// pages/AdminDashboard.jsx and will be extracted incrementally — each
// extracted tab takes a props contract, never closes over dashboard state.
export const tabs = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'skills', label: 'Skills', icon: Code2 },
  { key: 'experiences', label: 'Experience', icon: Briefcase },
  { key: 'education', label: 'Education', icon: GraduationCap },
  { key: 'certifications', label: 'Certifications', icon: Award },
  { key: 'projects', label: 'Projects', icon: FolderGit2 },
  { key: 'resumes', label: 'Resumes', icon: FileText },
  { key: 'generated', label: 'Generated Resumes', icon: FileStack },
  { key: 'articles', label: 'Blog', icon: BookOpen },
  { key: 'messages', label: 'Messages', icon: Mail },
  { key: 'leads', label: 'Leads', icon: Phone },
  { key: 'livechat', label: 'Live Chat', icon: MessagesSquare },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'jobs', label: 'Job Sites', icon: Globe },
  { key: 'job-apps', label: 'Job Applications', icon: BriefcaseIcon },
  { key: 'tracking', label: 'Tracking', icon: ListTodo },
  { key: 'manual-apply', label: 'Manual Apply', icon: UserCheck },
  { key: 'social', label: 'Social', icon: Share2 },
]
