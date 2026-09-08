# Admin tabs (Phase 3.2)

`pages/AdminDashboard.jsx` (~3.4k lines) is being split per tab. Each tab
under this directory takes a props contract and never closes over dashboard
state.

Done:
- `tabs.js` — tab definitions (imported by the dashboard sidebar/mobile nav)
- `SkillsTab.jsx` — skills categories (props: items, dark, onEdit, onDelete, onAdd)
- `SimpleListTab.jsx` — experiences/education/certifications/projects
  (props: items, titleField, collection, dark, onEdit, onDelete, onAdd)

Remaining (still inside AdminDashboard.jsx, extract next):
- `renderResumes`, `renderGeneratedResumes`, `renderArticles`, `renderMessages`,
  `renderLeads`, `renderAnalytics`, `renderJobs` (~380 lines),
  `renderJobApps` (~490 lines), `renderTracking` (~320 lines),
  `renderManualApply` (~170 lines), `renderLiveChat`
- Each needs its state + setters + socket refs passed as props; do one tab
  per commit with a manual smoke of that tab.
