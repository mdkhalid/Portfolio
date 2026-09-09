import { Mail, MailOpen, Trash2 } from 'lucide-react'

export default function MessagesTab({ messages = [], selectedMessage, dark, onSelect, onDelete }) {
  if (!messages.length) return <p className={'text-sm ' + (dark ? 'text-gray-400' : 'text-gray-500')}>No messages yet.</p>
  return (
    <div className="space-y-3">
      {messages.map(msg => (
        <div key={msg._id}
          className={'p-4 rounded-xl border cursor-pointer transition-all ' + (
            selectedMessage?._id === msg._id
              ? 'border-blue-500 ' + (dark ? 'bg-blue-500/10' : 'bg-blue-50')
              : msg.read
                ? (dark ? 'bg-gray-800 border-gray-700 hover:border-gray-600' : 'bg-gray-50 border-gray-200 hover:border-gray-300')
                : (dark ? 'bg-gray-800 border-blue-500/30 hover:border-blue-500/50' : 'bg-white border-blue-200 hover:border-blue-300')
          )}
          onClick={() => onSelect(msg)}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {msg.read ? <MailOpen size={16} className="text-gray-400" /> : <Mail size={16} className="text-blue-500" />}
                <p className={'font-semibold truncate ' + (!msg.read && (dark ? 'text-white' : 'text-gray-900'))}>{msg.name}</p>
                {!msg.read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
              </div>
              <p className={'text-sm truncate mt-1 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                {msg.subject || '(no subject)'} — {msg.message.slice(0, 60)}...
              </p>
              <p className={'text-xs mt-1 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>
                {new Date(msg.createdAt).toLocaleString()}
              </p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onDelete(msg._id) }}
              className={'p-2 rounded-lg flex-shrink-0 cursor-pointer ' + (dark ? 'hover:bg-gray-700 text-red-400' : 'hover:bg-gray-200 text-red-600')}>
              <Trash2 size={16} />
            </button>
          </div>
          {selectedMessage?._id === msg._id && (
            <div className={'mt-4 pt-4 border-t ' + (dark ? 'border-gray-700' : 'border-gray-200')}>
              <p className={'text-sm mb-2 ' + (dark ? 'text-gray-400' : 'text-gray-500')}>
                <strong>From:</strong> {msg.name} ({msg.email})
              </p>
              {msg.subject && <p className={'text-sm mb-2 ' + (dark ? 'text-gray-400' : 'text-gray-500')}><strong>Subject:</strong> {msg.subject}</p>}
              <p className={'text-sm whitespace-pre-wrap ' + (dark ? 'text-gray-300' : 'text-gray-700')}>{msg.message}</p>
              <a href={'mailto:' + msg.email + '?subject=Re: ' + (msg.subject || 'Your message')}
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all">
                <Mail size={14} /> Reply via Email
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
