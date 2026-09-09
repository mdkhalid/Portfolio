import { Phone, PhoneCall, Trash2 } from 'lucide-react'

export default function LeadsTab({ leads = [], dark, onStatusChange, onDelete }) {
  if (!leads.length) return <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>No leads yet. Leads appear when visitors share their contact info via the chat assistant.</p>
  return (
    <div className="space-y-3">
      {leads.map(lead => (
        <div key={lead._id}
          className={'p-4 rounded-xl border transition-all ' + (
            lead.status === 'new'
              ? (dark ? 'bg-gray-800 border-emerald-500/30' : 'bg-white border-emerald-200')
              : (dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')
          )}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <PhoneCall size={16} className={lead.status === 'new' ? 'text-emerald-500' : 'text-gray-400'} />
                <p className={'font-semibold truncate ' + (lead.status === 'new' && (dark ? 'text-white' : 'text-gray-900'))}>{lead.name || 'Unknown'}</p>
                {lead.status === 'new' && <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                {lead.phone && (
                  <a href={'tel:' + lead.phone} className={'text-sm font-medium flex items-center gap-1 ' + (dark ? 'text-blue-400' : 'text-blue-600')}>
                    <Phone size={12} /> {lead.phone}
                  </a>
                )}
                {lead.email && (
                  <a href={'mailto:' + lead.email} className={'text-sm ' + (dark ? 'text-blue-400' : 'text-blue-600')}>{lead.email}</a>
                )}
                <span className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{new Date(lead.createdAt).toLocaleString()}</span>
              </div>
              {lead.message && (
                <p className={'text-sm mt-2 line-clamp-2 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{lead.message}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <select value={lead.status} onChange={(e) => onStatusChange(lead._id, e.target.value)}
                className={'text-xs px-2 py-1 rounded-lg border cursor-pointer ' + (
                  dark ? 'bg-gray-700 border-gray-600 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-700'
                )}>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="closed">Closed</option>
              </select>
              <button onClick={() => onDelete(lead._id)}
                className={'p-2 rounded-lg cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}>
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
