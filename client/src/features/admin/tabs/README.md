# Admin tabs (Phase 3.2)

`pages/AdminDashboard.jsx` (~3.4k lines) is being split per tab. Each tab
under this directory takes a props contract and never closes over dashboard
state.

Done:
- `tabs.js` — tab definitions (imported by the dashboard sidebar/mobile nav)
- `SkillsTab.jsx` — skills categories (props: items, dark, onEdit, onDelete, onAdd)
- `SimpleListTab.jsx` — experiences/education/certifications/projects
  (props: items, titleField, collection, dark, onEdit, onDelete, onAdd)
- `ResumesTab.jsx` — master + other resume files
  (props: items, dark, masterUploading, onMasterFile, onEdit, onDelete,
  onToggleVisibility, onSetMaster, onAdd)
- `GeneratedResumesTab.jsx` — ATS-tailored resumes
  (props: items, loading, dark, onRefresh, onPreview, onDownload, onDelete)
- `ArticlesTab.jsx` — blog articles (props: items, dark, onEdit, onDelete, onAdd)
- `MessagesTab.jsx` — contact messages
  (props: messages, selectedMessage, dark, onSelect, onDelete)
- `LeadsTab.jsx` — chat-assistant leads
  (props: leads, dark, onStatusChange, onDelete)
- `AnalyticsTab.jsx` — stats + activity feed (owns formatTimeAgo/activityIcon
  copies; props: analytics, activities, activitiesLoading, dark, now, onRefresh)
- `JobsTab.jsx` — job sites + credentials/password/add-site modals
  (props: site/loading/fetch/login/creds/password/add-site state slices +
  setters, now, and action callbacks; save/pause logic stays in dashboard)
- `JobAppsTab.jsx` — pipeline, toolbar, filters, tiles, progress, detail panel
  (owns getScoreColor/getScoreBg/formatDate copies; pipeline pause/save,
  bulk/apply/match/AI actions stay in dashboard, passed as props)
- `TrackingTab.jsx` — applications + detail panel (owns trackingBadge,
  notAppliedReasonLabel, isRetryable, formatDate, formatDateTime copies;
  props: tracking, filters, loading, detail, onFilterChange, onPageChange,
  onRefresh, onSelectDetail, onCloseDetail, onRetry, onAnswerDraft,
  onSubmitAnswers)
- `ManualApplyTab.jsx` — manual-apply queue + add-job modal
  (props: manualJobs, jobSites, filters, loading, addJobModal, addJobForm,
  addingJob, setAddJobForm, onFilterChange, onPageChange, onRefresh,
  onOpenAddModal, onCloseAddModal, onAddJob, onMarkApplied, onMarkPass)
- `LiveChatTab.jsx` — queue/active/chat panes (props: dark, active, waiting,
  selected, messages, input, endRef, onSelect, onInputChange, onSend, onEnd;
  socket/history logic stays in dashboard)

Remaining (still inside AdminDashboard.jsx):
- None — all render* bodies extracted. `renderTab` dispatches to imported
  components; profile uses `ProfileForm`, social uses `SocialTab`.
- Dashboard keeps all API/socket/business logic, refresh callbacks, and state,
  passed down as props. Thin handlers extracted from inline JSX:
  `handleSelectMessage`, `saveCredsModal`, `handleTogglePipeline`,
  `handleSavePipelineSettings`, `handleClearApplyProgress`,
  `handleAnswerDraft`, `handleSelectChat`, `handleSendChatMessage`,
  `handleEndChat`.
