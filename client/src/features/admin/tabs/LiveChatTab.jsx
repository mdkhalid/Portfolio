import { Users, MessageCircle, MessagesSquare, Send } from 'lucide-react'

export default function LiveChatTab({ dark, active = [], waiting = [], selected, messages = [], input, endRef, onSelect, onInputChange, onSend, onEnd }) {
  const glassCard = dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-sm'

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[600px]">
      {/* Sidebar */}
      <div className="lg:w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* Queue */}
        {waiting.length > 0 && (
          <div className={'p-3 rounded-xl border ' + glassCard}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5 mb-2">
              <Users size={14} /> Queue ({waiting.length})
            </h4>
            <div className="space-y-1.5">
              {waiting.map((s) => (
                <div key={s._id} className={'flex items-center justify-between p-2 rounded-lg text-xs ' + (dark ? 'bg-gray-900' : 'bg-gray-50')}>
                  <span className="font-medium truncate">{s.visitorName}</span>
                  <span className="text-amber-500 font-bold">#{s.queuePosition}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active */}
        <div className={'flex-1 p-3 rounded-xl border overflow-y-auto ' + glassCard}>
          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5 mb-2">
            <MessageCircle size={14} /> Active ({active.length}/3)
          </h4>
          {active.length === 0 ? (
            <p className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No active chats</p>
          ) : (
            <div className="space-y-1.5">
              {active.map((s) => (
                <button key={s._id} onClick={() => onSelect(s)}
                  className={'w-full text-left p-2.5 rounded-xl text-xs transition-all cursor-pointer ' + (
                    selected?._id === s._id
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                      : dark ? 'bg-gray-900 hover:bg-gray-700 text-gray-200' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  )}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold truncate">{s.visitorName}</span>
                    <span className="text-[10px] opacity-70">{s.messageCount || 0} msgs</span>
                  </div>
                  {s.lastMessage && (
                    <p className="truncate mt-0.5 opacity-70">{s.lastMessage.content}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={'flex-1 flex flex-col rounded-xl border overflow-hidden ' + glassCard}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessagesSquare size={48} className="mx-auto mb-3 text-gray-400" />
              <p className={'text-sm ' + (dark ? 'text-gray-500' : 'text-gray-400')}>Select a chat to start responding</p>
            </div>
          </div>
        ) : (
          <>
            <div className={'flex items-center justify-between px-4 py-3 border-b ' + (dark ? 'border-gray-700' : 'border-gray-200')}>
              <div>
                <h3 className="font-semibold text-sm">{selected.visitorName}</h3>
                <p className={'text-xs ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{selected.visitorId?.slice(0, 8)}...</p>
              </div>
              <button onClick={() => onEnd(selected._id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all cursor-pointer">
                End Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p className={'text-center text-sm ' + (dark ? 'text-gray-500' : 'text-gray-400')}>No messages yet</p>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex items-start gap-2 ${msg.role === 'visitor' ? '' : 'flex-row-reverse'}`}>
                  <div className={'px-3 py-2 rounded-xl text-sm max-w-[80%] ' + (
                    msg.role === 'visitor'
                      ? dark ? 'bg-gray-900 text-gray-200' : 'bg-gray-100 text-gray-800'
                      : msg.role === 'admin'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                        : dark ? 'bg-gray-900 text-gray-400 italic' : 'bg-gray-100 text-gray-500 italic'
                  )}>
                    {msg.role === 'visitor' && <p className="text-[10px] font-semibold text-emerald-500 mb-0.5">{selected.visitorName}</p>}
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className={'p-3 border-t ' + (dark ? 'border-gray-700' : 'border-gray-200')}>
              <div className="flex items-end gap-2">
                <textarea value={input} onChange={(e) => onInputChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
                  placeholder="Type your response..."
                  rows={1}
                  className={'flex-1 resize-none outline-none text-sm leading-relaxed py-2 px-3 rounded-xl border max-h-20 ' + (
                    dark ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                  )} />
                <button onClick={onSend} disabled={!input.trim()}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 shadow-md cursor-pointer">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
