// src/views/ceo/HelpAssistantView.tsx
//
// Direct instruction: a chatbot that lives ONLY in the CEO's department
// (no one and nowhere else, both web and mobile — wired only into
// Sidebar.tsx's CEO tab list and App.tsx's `activeDepartment === 'CEO'`
// routing block, never added to any other department's tab list or
// routing branch), trained on the whole app, so a real report like
// "mobile login is blocked" can be typed here and get pointed straight
// at the right Control Center setting or department page.
//
// Direct correction on "trained": a smart search/helper tool, not a
// real AI service — no API key, no backend call, no per-message cost.
// utils/helpKnowledgeBase.ts does deterministic keyword matching over
// real app data (every Control Center setting, every department's real
// pages, and a few hand-written cross-department workflow notes), so
// every answer is grounded in something real in this app — it can't
// invent an answer that doesn't exist. Same design as the mobile
// version (rebma-mobile/screens/ceo/HelpAssistantScreen.tsx).
import { useRef, useState, useEffect } from 'react';
import { Bot, Send, ArrowRight } from 'lucide-react';
import { getHelpReply, type HelpEntry } from '../../utils/helpKnowledgeBase';

interface HelpAssistantViewProps {
  setActiveDepartment: (department: string) => void;
  setActiveSubTab: (tab: string) => void;
}

interface ChatMessage {
  id: string;
  from: 'user' | 'bot';
  text?: string;
  results?: HelpEntry[];
}

export default function HelpAssistantView({ setActiveDepartment, setActiveSubTab }: HelpAssistantViewProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      from: 'bot',
      text: "Ask me anything about the app — a Control Center setting, a department's pages, or why something got blocked (e.g. \"why can't someone log into mobile\").",
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const q = query.trim();
    if (!q) return;
    const reply = getHelpReply(q);
    // Direct instruction: confidence-based, never a guessed answer
    // dressed up as certain. 'confident' shows the one clear match with
    // no hedging lead-in (its own answer text already reads as
    // definitive); 'weak' softens with "closest thing I found"; 'multiple'
    // offers a short pick-list instead of guessing one; 'unsure'/'greeting'
    // are message-only, no cards.
    const leadText =
      reply.kind === 'weak' ? "The closest thing I found was:" :
      reply.kind === 'multiple' ? "A few things might be what you mean:" :
      undefined;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, from: 'user', text: q },
      { id: `b-${Date.now()}`, from: 'bot', text: reply.message ?? leadText, results: reply.results },
    ]);
    setQuery('');
  };

  const goTo = (entry: HelpEntry) => {
    if (!entry.navigateTo) return;
    setActiveDepartment(entry.navigateTo.department);
    setActiveSubTab(entry.navigateTo.subTab);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-full bg-[var(--accent-soft)] flex items-center justify-center">
          <Bot className="w-4.5 h-4.5 text-[var(--accent)]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Help Assistant</h2>
          <p className="text-xs text-[var(--text-muted)]">CEO-only. Searches real Control Center settings and department pages.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((m) =>
          m.from === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] bg-[var(--accent)] text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-sm font-medium">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start gap-2 max-w-[88%]">
              <div className="w-7 h-7 rounded-full bg-[var(--accent-soft)] flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-[var(--accent)]" />
              </div>
              <div className="flex-1 space-y-2">
                {m.text ? (
                  <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl rounded-tl-md px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]">
                    {m.text}
                  </div>
                ) : null}
                {m.results?.map((r) => (
                  <div key={r.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-4 py-3">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{r.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1">{r.answer}</p>
                    {r.steps && r.steps.length > 0 ? (
                      <ol className="mt-2 space-y-1 list-none">
                        {r.steps.map((step, i) => (
                          <li key={i} className="flex gap-2 text-xs text-[var(--text-secondary)] leading-relaxed">
                            <span className="shrink-0 font-bold text-[var(--accent)]">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                    {r.navigateTo ? (
                      <button
                        onClick={() => goTo(r)}
                        className="mt-2 flex items-center gap-1 text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                      >
                        Go there <ArrowRight className="w-3 h-3" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-[var(--border)]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Ask about a setting, page, or issue…"
          className="flex-1 px-4 py-2.5 rounded-full bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <button
          onClick={send}
          className="w-10 h-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center hover:opacity-90 cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
