// src/components/global/HelpDeskPanel.tsx
import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Newspaper, Plus, Search, ChevronDown, ChevronUp, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { CurrentUser } from '../../types/erp';

interface HelpArticle {
  id: string;
  title: string;
  body: string;
  category: string;
  department: string | null;
  created_by: string;
  created_at: string;
}

interface NewsItem {
  id: string;
  title: string;
  body: string;
  author: string;
  pinned: boolean;
  created_at: string;
}

interface HelpDeskPanelProps {
  currentUser: CurrentUser | null;
  addNotification: (msg: string) => void;
}

const SEED_ARTICLES: Omit<HelpArticle, 'id' | 'created_at'>[] = [
  { title: 'How to switch departments', body: 'Use the department selector in the sidebar to switch between departments. Only departments you have access to will appear.', category: 'Navigation', department: null, created_by: 'system' },
  { title: 'Using the Boardroom', body: 'The Boardroom feature lets all departments share updates and reports. Click the Boardroom button at the top of the sidebar to access it.', category: 'Features', department: null, created_by: 'system' },
  { title: 'Managing your profile', body: 'Click your avatar or name in the sidebar to access profile settings. You can update your name, department, and avatar there.', category: 'Account', department: null, created_by: 'system' },
  { title: 'Real-time notifications', body: 'REBMA IMPEX uses real-time notifications for important updates. The bell icon shows unread notifications count. Click it to view all notifications.', category: 'Features', department: null, created_by: 'system' },
  { title: 'Sharing Notes with your team', body: 'In the Notes panel, toggle "Share with my department" when creating or editing a note. Your department colleagues will see it under the Shared filter.', category: 'Collaboration', department: null, created_by: 'system' },
];

const SEED_NEWS: Omit<NewsItem, 'id' | 'created_at'>[] = [
  { title: 'Welcome to REBMA IMPEX', body: 'We are excited to launch our new internal platform. This system connects all departments and enables seamless collaboration across the company.', author: 'Management', pinned: true },
  { title: 'Q2 Targets Review', body: 'All department heads are requested to submit Q2 performance data by end of month. Reports should be submitted via the Boardroom section.', author: 'Finance', pinned: false },
];

const FALLBACK_ARTICLES: HelpArticle[] = [
  { id: 'fallback-1', title: 'How to create a new sales order', category: 'Marketing',   body: 'Go to Marketing. Click Orders. Click + New Order. Search for customer. Select products. Choose payment mode. Submit to Finance.',    department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'fallback-2', title: 'How to approve a payment',        category: 'Finance',    body: 'Go to Finance. Click Orders Queue. Review pending orders. Check payment details. Click Approve or Reject with reason.',              department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'fallback-3', title: 'How to receive goods at port',    category: 'Operations', body: 'Go to Operations. Click Cargo Intake. Click + Log Intake. Fill supplier, product, quantity. Upload photo. Submit for review.',       department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'fallback-4', title: 'How to approve staff registration',category: 'HR',        body: 'Go to HR. Click Registrations. Review staff details. Click Approve to generate password and token. Click Deny to reject.',          department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'fallback-5', title: 'How to set product prices',       category: 'Management', body: 'Go to Management. Click Price Setting. Enter new selling price per product. Click Save. Finance and Marketing are notified.',       department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'fallback-6', title: 'How to track a delivery',         category: 'Dispatch',   body: 'Go to Dispatch. Click Deliveries. Find delivery by order ID. Click Track for GPS location. Click Mark Delivered when done.',        department: null, created_by: 'system', created_at: new Date().toISOString() },
  { id: 'fallback-7', title: 'How to use Messages and Boardroom',category: 'General',   body: 'Click the Messages icon in the header or Messages & Boardroom in the sidebar. Use Global Chat for company-wide messages.',          department: null, created_by: 'system', created_at: new Date().toISOString() },
];

const FALLBACK_NEWS: NewsItem[] = [
  { id: 'news-fallback-1', title: 'Welcome to REBMA IMPEX Management System', body: 'We are pleased to announce the launch of our new operational management system covering all departments.', author: 'REBMA Management', pinned: true,  created_at: new Date().toISOString() },
  { id: 'news-fallback-2', title: 'New Payment Methods Now Available',         body: 'Finance can now process Cheque and Mobile Money payments in addition to Cash. Credit orders require Manager approval.',             author: 'Finance Department', pinned: false, created_at: new Date().toISOString() },
  { id: 'news-fallback-3', title: 'GPS Tracking Now Live',                     body: 'All delivery vehicles are now equipped with GPS tracking. Dispatch can monitor all active deliveries in real time.',                author: 'Dispatch Department', pinned: false, created_at: new Date().toISOString() },
];

const blankArticle = { title: '', body: '', category: 'General' };
const blankNews    = { title: '', body: '', pinned: false };

export default function HelpDeskPanel({ currentUser, addNotification }: HelpDeskPanelProps) {
  const [tab, setTab]               = useState<'help' | 'news'>('help');
  const [articles, setArticles]     = useState<HelpArticle[]>([]);
  const [news, setNews]             = useState<NewsItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [artModal, setArtModal]     = useState({ open: false, ...blankArticle });
  const [newsModal, setNewsModal]   = useState({ open: false, ...blankNews });
  const [saving, setSaving]         = useState(false);

  const isManagement = currentUser?.isCeo || currentUser?.department === 'MANAGEMENT' || currentUser?.department === 'CEO';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: arts, error: aErr } = await supabase.from('help_articles').select('*').order('created_at', { ascending: false });
      if (aErr || !arts || arts.length === 0) {
        // Fallback: show hardcoded articles, try to seed in background
        setArticles(FALLBACK_ARTICLES);
        if (!aErr) {
          supabase.from('help_articles').insert(SEED_ARTICLES).then(() => {});
        }
      } else {
        setArticles(arts);
      }

      const { data: newsData, error: nErr } = await supabase.from('company_news').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false });
      if (nErr || !newsData || newsData.length === 0) {
        setNews(FALLBACK_NEWS);
        if (!nErr) {
          supabase.from('company_news').insert(SEED_NEWS).then(() => {});
        }
      } else {
        setNews(newsData);
      }
    } catch {
      // Tables may not exist — always show fallback so panel is never empty
      setArticles(FALLBACK_ARTICLES);
      setNews(FALLBACK_NEWS);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibleArticles = articles.filter(a => {
    const matchDept = !a.department || a.department === currentUser?.department;
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) || a.body.toLowerCase().includes(search.toLowerCase());
    return matchDept && matchSearch;
  });

  const categories = Array.from(new Set(visibleArticles.map(a => a.category)));

  const saveArticle = async () => {
    if (!currentUser || !artModal.title.trim()) return;
    setSaving(true);
    try {
      await supabase.from('help_articles').insert({ title: artModal.title, body: artModal.body, category: artModal.category, department: null, created_by: currentUser.id });
      addNotification('Article published.');
      setArtModal({ open: false, ...blankArticle });
      load();
    } catch { addNotification('Could not publish article.'); }
    setSaving(false);
  };

  const saveNews = async () => {
    if (!currentUser || !newsModal.title.trim()) return;
    setSaving(true);
    try {
      await supabase.from('company_news').insert({ title: newsModal.title, body: newsModal.body, author: currentUser.fullName, pinned: newsModal.pinned });
      addNotification('News posted.');
      setNewsModal({ open: false, ...blankNews });
      load();
    } catch { addNotification('Could not post news.'); }
    setSaving(false);
  };

  return (
    <div className="helpdesk-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Help &amp; News</h2>
          <div className="flex bg-[var(--bg-input)] border border-[var(--border)] rounded-lg overflow-hidden text-[10px] font-semibold">
            {([['help','Help Center'],['news','Company News']] as const).map(([v,l]) => (
              <button key={v} onClick={() => setTab(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-colors ${tab === v ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}>
                {v === 'help' ? <BookOpen className="w-3 h-3" /> : <Newspaper className="w-3 h-3" />}
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'help' && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles…"
                className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none w-40 focus:ring-1 focus:ring-[var(--accent)]" />
            </div>
          )}
          {isManagement && tab === 'help' && (
            <button onClick={() => setArtModal({ open: true, ...blankArticle })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Article
            </button>
          )}
          {isManagement && tab === 'news' && (
            <button onClick={() => setNewsModal({ open: true, ...blankNews })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Post
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_,i) => <div key={i} className="h-14 rounded-xl bg-[var(--bg-input)] animate-pulse" />)}</div>
      ) : tab === 'help' ? (
        /* Help Articles — accordion by category */
        categories.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <BookOpen className="w-8 h-8 text-[var(--text-muted)] mb-2" />
            <p className="text-xs text-[var(--text-muted)]">No articles found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map(cat => (
              <div key={cat} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-[var(--accent-light)]">
                  <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wide">{cat}</span>
                </div>
                {visibleArticles.filter(a => a.category === cat).map(a => (
                  <div key={a.id} className="border-t border-[var(--border)] first:border-t-0">
                    <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-[var(--accent-light)] transition-colors">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{a.title}</span>
                      {expanded === a.id ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
                    </button>
                    {expanded === a.id && (
                      <div className="px-4 pb-4">
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{a.body}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      ) : (
        /* Company News */
        news.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Newspaper className="w-8 h-8 text-[var(--text-muted)] mb-2" />
            <p className="text-xs text-[var(--text-muted)]">No news yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {news.map(n => (
              <div key={n.id} className={`bg-[var(--bg-card)] border rounded-xl p-4 ${n.pinned ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}>
                {n.pinned && <span className="text-[9px] font-bold px-2 py-0.5 bg-[var(--accent)] text-white rounded-full mb-2 inline-block">PINNED</span>}
                <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">{n.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2">{n.body}</p>
                <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  <span>Posted by <span className="font-medium text-[var(--text-secondary)]">{n.author}</span></span>
                  <span>·</span>
                  <span>{new Date(n.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Article Modal */}
      {artModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">New Help Article</h3>
              <button onClick={() => setArtModal({ open: false, ...blankArticle })} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <input value={artModal.title} onChange={e => setArtModal(m => ({ ...m, title: e.target.value }))} placeholder="Article title…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <input value={artModal.category} onChange={e => setArtModal(m => ({ ...m, category: e.target.value }))} placeholder="Category…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <textarea value={artModal.body} onChange={e => setArtModal(m => ({ ...m, body: e.target.value }))} placeholder="Article body…" rows={5}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setArtModal({ open: false, ...blankArticle })} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
              <button onClick={saveArticle} disabled={saving || !artModal.title.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                <Check className="w-3.5 h-3.5" /> {saving ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* News Modal */}
      {newsModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Post Company News</h3>
              <button onClick={() => setNewsModal({ open: false, ...blankNews })} className="p-1 rounded-lg hover:bg-[var(--bg-input)] cursor-pointer"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
            </div>
            <input value={newsModal.title} onChange={e => setNewsModal(m => ({ ...m, title: e.target.value }))} placeholder="Headline…"
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] mb-3" />
            <textarea value={newsModal.body} onChange={e => setNewsModal(m => ({ ...m, body: e.target.value }))} placeholder="News body…" rows={5}
              className="w-full px-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none mb-3" />
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <div onClick={() => setNewsModal(m => ({ ...m, pinned: !m.pinned }))}
                className={`w-9 h-5 rounded-full transition-colors relative ${newsModal.pinned ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${newsModal.pinned ? 'left-4' : 'left-0.5'}`} />
              </div>
              <span className="text-xs text-[var(--text-secondary)]">Pin to top</span>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setNewsModal({ open: false, ...blankNews })} className="px-4 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-input)] rounded-lg cursor-pointer">Cancel</button>
              <button onClick={saveNews} disabled={saving || !newsModal.title.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer">
                <Check className="w-3.5 h-3.5" /> {saving ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
