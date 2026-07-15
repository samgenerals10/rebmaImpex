// rebma-web/src/components/collaborative/ChatDrawer.tsx

import { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Send, ChevronLeft, Search, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabaseClient';
import type { ChatMessage, CurrentUser } from '../../types/erp';

interface Contact {
  id: string;
  fullName: string;
  department: string;
}

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages: ChatMessage[];
  onSendMessage: (content: string, receiver?: string | null) => void;
  currentUser?: CurrentUser | null;
  boardroomMinutes: string;
  setBoardroomMinutes: (minutes: string) => void;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const EVERYONE = '__everyone__';

export default function ChatDrawer({
  isOpen,
  onClose,
  chatMessages,
  onSendMessage,
  currentUser,
}: ChatDrawerProps) {
  const [chatInput, setChatInput] = useState<string>('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [activeContact, setActiveContact] = useState<string | null>(null); // full name, or EVERYONE

  useEffect(() => {
    if (!isOpen) return;
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('status', 'ACTIVE')
      .order('full_name', { ascending: true })
      .then(({ data }) => {
        if (!data) return;
        setContacts(
          data
            .map((p: any) => ({ id: p.id, fullName: p.full_name || 'Unknown', department: p.role || '' }))
            .filter(c => c.fullName !== currentUser?.fullName)
        );
      });
  }, [isOpen, currentUser?.fullName]);

  const filteredContacts = useMemo(
    () => contacts.filter(c => c.fullName.toLowerCase().includes(search.toLowerCase())),
    [contacts, search]
  );

  const lastMessageFor = (name: string | null) => {
    const relevant = chatMessages.filter(m =>
      name === null
        ? !m.receiver
        : (m.sender === name && (m.receiver === currentUser?.fullName || !m.receiver)) ||
          (m.sender === currentUser?.fullName && m.receiver === name)
    );
    return relevant[relevant.length - 1];
  };

  const activeThread = useMemo(() => {
    if (activeContact === null) return [];
    if (activeContact === EVERYONE) return chatMessages.filter(m => !m.receiver);
    return chatMessages.filter(m =>
      (m.sender === activeContact && (m.receiver === currentUser?.fullName || !m.receiver)) ||
      (m.sender === currentUser?.fullName && m.receiver === activeContact)
    );
  }, [activeContact, chatMessages, currentUser?.fullName]);

  const handleSend = () => {
    if (!chatInput.trim() || activeContact === null) return;
    onSendMessage(chatInput, activeContact === EVERYONE ? null : activeContact);
    setChatInput('');
  };

  const activeContactMeta = activeContact && activeContact !== EVERYONE
    ? contacts.find(c => c.fullName === activeContact)
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', duration: 0.3 }}
          className="fixed right-0 top-0 h-full w-full sm:w-96 bg-[var(--bg-card)] border-l border-[var(--border)] shadow-2xl flex flex-col z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
            {activeContact !== null ? (
              <button onClick={() => setActiveContact(null)} className="flex items-center gap-2 cursor-pointer">
                <ChevronLeft className="w-4 h-4 text-[var(--text-secondary)]" />
                <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {activeContact === EVERYONE ? <Users size={13} /> : initials(activeContact)}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-[var(--text-primary)] leading-tight">
                    {activeContact === EVERYONE ? 'Everyone' : activeContact}
                  </p>
                  {activeContactMeta && <p className="text-[9px] text-[var(--text-muted)] leading-tight">{activeContactMeta.department}</p>}
                </div>
              </button>
            ) : (
              <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[var(--accent)]" />
                <span>Chats</span>
              </h3>
            )}
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-bold cursor-pointer">
              Close
            </button>
          </div>

          {activeContact === null ? (
            <>
              {/* Search */}
              <div className="px-4 pt-3 pb-2 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search people…"
                    className="w-full pl-8 pr-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>

              {/* Contact list */}
              <div className="flex-1 overflow-y-auto px-2 pb-2">
                <button
                  onClick={() => setActiveContact(EVERYONE)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl hover:bg-[var(--accent-light)] cursor-pointer text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0">
                    <Users size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[var(--text-primary)]">Everyone</p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">
                      {lastMessageFor(null)?.content || 'Company-wide broadcast'}
                    </p>
                  </div>
                </button>

                {filteredContacts.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] text-center py-6">No people found.</p>
                )}
                {filteredContacts.map(c => {
                  const last = lastMessageFor(c.fullName);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveContact(c.fullName)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl hover:bg-[var(--accent-light)] cursor-pointer text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(c.fullName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">{c.fullName}</p>
                        <p className="text-[10px] text-[var(--text-muted)] truncate">{last?.content || c.department}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Thread */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {activeThread.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] text-center py-6">No messages yet — say hello.</p>
                )}
                {activeThread.map(msg => {
                  const mine = msg.sender === currentUser?.fullName;
                  return (
                    <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl ${mine ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-input)] text-[var(--text-primary)]'}`}>
                        {!mine && activeContact === EVERYONE && (
                          <p className="text-[9px] font-bold opacity-70 mb-0.5">{msg.sender}</p>
                        )}
                        <p className="text-xs leading-relaxed">{msg.content}</p>
                        <p className={`text-[9px] mt-0.5 ${mine ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{msg.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div className="flex items-center gap-2 p-3 border-t border-[var(--border)] shrink-0">
                <input
                  type="text"
                  placeholder="Type message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="flex-1 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
                <button
                  onClick={handleSend}
                  className="p-2 bg-[var(--accent)] text-white rounded-xl cursor-pointer hover:opacity-90 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
