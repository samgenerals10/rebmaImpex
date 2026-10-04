// rebma-mobile/screens/HelpDeskScreen.tsx
//
// "Help & News" on the phone. Ports rebma-web/src/components/global/HelpDeskPanel.tsx
// against the same `help_articles` and `company_news` tables: a searchable
// Help Center grouped by category (tap an article to expand it) and the
// Company News feed with pinned posts first. Management and the CEO can
// publish articles; posting news follows the CEO's announcements_ceo_only
// switch exactly as on web. Reached from the Profile tab.
//
// Web fills an empty database with built-in starter articles the first
// time it opens; the phone simply reads what's there, so it never shows
// text that isn't actually stored.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Alert } from '../lib/appAlert';
import { BookOpen, Newspaper, ChevronDown, ChevronUp, Pin, Plus } from 'lucide-react-native';
import { supabase } from '../lib/supabaseClient';
import { getCeoSetting } from '../lib/ceoSetting';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../theme/ThemeProvider';
import Screen from '../components/ui/Screen';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { Field } from '../components/ui/Input';
import Sheet from '../components/ui/Sheet';
import Tabs from '../components/ui/Tabs';
import Toggle from '../components/ui/Toggle';
import SearchSortBar from '../components/ui/SearchSortBar';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonList } from '../components/ui/Skeleton';

interface Article { id: string; title: string; body: string; category: string; department: string | null; created_at: string }
interface NewsItem { id: string; title: string; body: string; author: string; pinned: boolean; created_at: string }

export default function HelpDeskScreen() {
  const t = useTheme();
  const profile = useAuthStore((s) => s.profile);
  const isManagement = !!profile && (profile.isAdmin || profile.department === 'MANAGEMENT' || profile.department === 'CEO');

  const [tab, setTab] = useState<'help' | 'news'>('help');
  const [articles, setArticles] = useState<Article[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [canPostNews, setCanPostNews] = useState(false);

  const [articleForm, setArticleForm] = useState<{ title: string; category: string; body: string } | null>(null);
  const [newsForm, setNewsForm] = useState<{ title: string; body: string; pinned: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: arts }, { data: newsRows }] = await Promise.all([
      supabase.from('help_articles').select('*').order('created_at', { ascending: false }),
      supabase.from('company_news').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    setArticles((arts as Article[]) || []);
    setNews((newsRows as NewsItem[]) || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // When announcements_ceo_only is on, only the CEO may post news.
  useEffect(() => {
    getCeoSetting('announcements_ceo_only', false).then((ceoOnly) => setCanPostNews(ceoOnly ? !!profile?.isAdmin : isManagement));
  }, [profile?.isAdmin, isManagement]);

  const q = search.toLowerCase();
  const visibleArticles = articles.filter((a) =>
    (!a.department || a.department === profile?.department) &&
    (a.title.toLowerCase().includes(q) || (a.body || '').toLowerCase().includes(q)));
  const categories = Array.from(new Set(visibleArticles.map((a) => a.category || 'General')));
  const visibleNews = news.filter((n) => n.title.toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q));

  const publishArticle = async () => {
    if (!profile || !articleForm?.title.trim() || saving) return;
    setSaving(true);
    const { error } = await supabase.from('help_articles').insert({
      title: articleForm.title.trim(), body: articleForm.body, category: articleForm.category.trim() || 'General',
      department: null, created_by: profile.id,
    });
    setSaving(false);
    if (error) { Alert.alert('Could not publish', error.message); return; }
    setArticleForm(null);
    load();
  };

  const postNews = async () => {
    if (!profile || !newsForm?.title.trim() || saving) return;
    if (!canPostNews) { Alert.alert('Not allowed', 'Only the CEO can post company news right now.'); return; }
    setSaving(true);
    const { error } = await supabase.from('company_news').insert({
      title: newsForm.title.trim(), body: newsForm.body, author: profile.fullName, pinned: newsForm.pinned,
    });
    setSaving(false);
    if (error) { Alert.alert('Could not post', error.message); return; }
    setNewsForm(null);
    load();
  };

  const footer = tab === 'help' && isManagement
    ? <View style={{ padding: t.spacing.lg }}><Button label="New Article" icon={<Plus size={14} color="#fff" />} onPress={() => setArticleForm({ title: '', category: 'General', body: '' })} fullWidth /></View>
    : tab === 'news' && canPostNews
      ? <View style={{ padding: t.spacing.lg }}><Button label="Post News" icon={<Plus size={14} color="#fff" />} onPress={() => setNewsForm({ title: '', body: '', pinned: false })} fullWidth /></View>
      : undefined;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} footer={footer}>
      <View style={{ gap: t.spacing.md, marginBottom: t.spacing.md }}>
        <Tabs variant="segmented" value={tab} onChange={(v) => setTab(v as 'help' | 'news')} options={[{ value: 'help', label: 'Help Center' }, { value: 'news', label: 'Company News' }]} />
        <SearchSortBar value={search} onChangeText={setSearch} placeholder={tab === 'help' ? 'Search articles…' : 'Search news…'} />
      </View>

      {loading ? (
        <SkeletonList rows={5} />
      ) : tab === 'help' ? (
        visibleArticles.length === 0 ? (
          <EmptyState icon={<BookOpen size={22} color={t.colors.textMuted} />} title="No articles found" description={search ? 'Try a different search.' : 'Help articles will show up here.'} />
        ) : (
          <View style={{ gap: t.spacing.lg }}>
            {categories.map((cat) => (
              <View key={cat} style={{ gap: t.spacing.sm }}>
                <Text style={{ fontFamily: t.font.bold, fontSize: t.type.meta11.size, color: t.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{cat}</Text>
                {visibleArticles.filter((a) => (a.category || 'General') === cat).map((a) => {
                  const open = expanded === a.id;
                  return (
                    <Pressable key={a.id} onPress={() => setExpanded(open ? null : a.id)}>
                      <Card>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                          <Text style={{ flex: 1, fontFamily: t.font.semibold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{a.title}</Text>
                          {open ? <ChevronUp size={16} color={t.colors.textMuted} /> : <ChevronDown size={16} color={t.colors.textMuted} />}
                        </View>
                        {open && <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary, lineHeight: 19, marginTop: t.spacing.sm }}>{a.body}</Text>}
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )
      ) : visibleNews.length === 0 ? (
        <EmptyState icon={<Newspaper size={22} color={t.colors.textMuted} />} title="No news yet" description="Company news will show up here." />
      ) : (
        <View style={{ gap: t.spacing.sm }}>
          {visibleNews.map((n) => (
            <Card key={n.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {n.pinned && <Pin size={12} color={t.colors.accent} fill={t.colors.accent} />}
                <Text style={{ flex: 1, fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary }}>{n.title}</Text>
              </View>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary, lineHeight: 19 }}>{n.body}</Text>
              <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: t.spacing.sm }}>
                {n.author} · {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </Card>
          ))}
        </View>
      )}

      <Sheet
        open={!!articleForm}
        onClose={() => setArticleForm(null)}
        title="New Help Article"
        side="bottom"
        maxHeight={680}
        footer={<Button label={saving ? 'Publishing…' : 'Publish'} onPress={publishArticle} loading={saving} disabled={saving || !articleForm?.title.trim()} fullWidth />}
      >
        <Field label="Title"><Input value={articleForm?.title || ''} onChangeText={(v) => setArticleForm((f) => (f ? { ...f, title: v } : f))} placeholder="Article title" /></Field>
        <Field label="Category"><Input value={articleForm?.category || ''} onChangeText={(v) => setArticleForm((f) => (f ? { ...f, category: v } : f))} placeholder="e.g. Finance, HR, Navigation" /></Field>
        <Field label="Article">
          <Input value={articleForm?.body || ''} onChangeText={(v) => setArticleForm((f) => (f ? { ...f, body: v } : f))} multiline numberOfLines={6} placeholder="Explain the steps…" style={{ minHeight: 130, textAlignVertical: 'top' }} />
        </Field>
      </Sheet>

      <Sheet
        open={!!newsForm}
        onClose={() => setNewsForm(null)}
        title="Post Company News"
        side="bottom"
        maxHeight={640}
        footer={<Button label={saving ? 'Posting…' : 'Post'} onPress={postNews} loading={saving} disabled={saving || !newsForm?.title.trim()} fullWidth />}
      >
        <Field label="Headline"><Input value={newsForm?.title || ''} onChangeText={(v) => setNewsForm((f) => (f ? { ...f, title: v } : f))} placeholder="Headline" /></Field>
        <Field label="News">
          <Input value={newsForm?.body || ''} onChangeText={(v) => setNewsForm((f) => (f ? { ...f, body: v } : f))} multiline numberOfLines={5} placeholder="What's the news?" style={{ minHeight: 110, textAlignVertical: 'top' }} />
        </Field>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.spacing.sm }}>
          <Text style={{ fontFamily: t.font.medium, fontSize: t.type.body12.size, color: t.colors.textSecondary }}>Pin to top</Text>
          <Toggle value={!!newsForm?.pinned} onChange={(v) => setNewsForm((f) => (f ? { ...f, pinned: v } : f))} />
        </View>
      </Sheet>
    </Screen>
  );
}
