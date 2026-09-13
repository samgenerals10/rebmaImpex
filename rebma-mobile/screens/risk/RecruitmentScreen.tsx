// rebma-mobile/screens/risk/RecruitmentScreen.tsx
// Ports: rebma-web/src/views/risk/RecruitmentView.tsx — Phase 8. Risk sees
// the full candidate record HR saves, not a summary. Reads staff_invites
// directly (RLS: staff_invites_select_risk grants this role read access,
// additive to the existing HR/admin policy). Photo and résumé are both
// tappable to view full-size/open, same as they already are on HR's own
// Staff screen — the user asked for both, in both places.
import { useEffect, useState } from 'react';
import { View, Text, Image, Linking, Pressable } from 'react-native';
import { UserPlus, FileText, Clock } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { getSignedUrl } from '../../lib/storage';
import { useTheme } from '../../theme/ThemeProvider';
import { usePresets } from '../../theme/presets';
import Screen from '../../components/ui/Screen';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet from '../../components/ui/Sheet';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';

interface Invite {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  role: string;
  photo: string | null;
  resume_url: string | null;
  address: string | null;
  staff_category: string | null;
  guarantor_name: string | null;
  guarantor_phone: string | null;
  guarantor_relationship: string | null;
  guarantor_id_number: string | null;
  guarantor_address: string | null;
  status: string;
  created_at: string;
  created_by: string | null;
}

export default function RiskRecruitmentScreen() {
  const t = useTheme();
  const p = usePresets();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invite | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('staff_invites').select('*').order('created_at', { ascending: false });
    setInvites(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const viewResume = async (path: string) => {
    const url = await getSignedUrl('staff-resumes', path);
    if (url) Linking.openURL(url);
  };

  const columns: DataColumn<Invite>[] = [
    { key: 'full_name', label: 'Name', primary: true },
    { key: 'role', label: 'Role', render: i => i.role || i.department },
    { key: 'status', label: 'Status', status: true, render: i => <Badge tone={i.status === 'used' ? 'success' : 'warning'} label={i.status === 'used' ? 'Registered' : 'Pending'} /> },
  ];

  return (
    <Screen scroll refreshing={loading} onRefresh={load}>
      <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.lg }}>
          <UserPlus size={20} color={t.colors.textPrimary} />
          <Text style={{ ...p.pageTitle }}>Recruitment</Text>
        </View>
      </View>

      {invites.length === 0 && !loading ? (
        <EmptyState title="No candidate records yet" description="Candidates HR adds will appear here with their full record." />
      ) : (
        <View style={{ paddingHorizontal: t.spacing.lg }}>
          <DataList columns={columns} data={invites} rowKey={i => i.id} onRowPress={setSelected} loading={loading} />
        </View>
      )}

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.full_name} subtitle={selected ? `${selected.role || selected.department} · ${selected.department}` : undefined}>
        {selected && (
          <View style={{ gap: t.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              {selected.photo ? (
                <Pressable onPress={() => setShowPhoto(true)}>
                  <Avatar name={selected.full_name} photo={selected.photo} size={64} />
                </Pressable>
              ) : (
                <Avatar name={selected.full_name} size={64} />
              )}
              <Badge tone={selected.status === 'used' ? 'success' : 'warning'} label={selected.status === 'used' ? 'Registered' : 'Pending'} />
            </View>

            <Card padded>
              {[
                ['Email', selected.email], ['Phone', selected.phone], ['Address', selected.address],
                ['Staff Category', selected.staff_category], ['Entered By', selected.created_by],
                ['Date', new Date(selected.created_at).toLocaleDateString()],
              ].filter(([, v]) => v).map(([k, v]) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ ...p.meta }}>{k}</Text>
                  <Text style={{ ...p.meta, color: t.colors.textPrimary, fontFamily: t.font.medium }}>{v}</Text>
                </View>
              ))}
            </Card>

            {selected.resume_url && (
              <Card padded>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                    <FileText size={16} color={t.colors.textPrimary} />
                    <Text style={{ fontFamily: t.font.semibold, color: t.colors.textPrimary }}>Résumé / CV</Text>
                  </View>
                  <Text onPress={() => viewResume(selected.resume_url!)} style={{ color: t.colors.accent, fontFamily: t.font.semibold, fontSize: t.type.body12.size }}>View</Text>
                </View>
              </Card>
            )}

            {(selected.guarantor_name || selected.guarantor_phone) && (
              <Card padded>
                <Text style={{ ...p.label9, marginBottom: t.spacing.xs }}>Guarantee Information</Text>
                {[['Name', selected.guarantor_name], ['Phone', selected.guarantor_phone], ['Relationship', selected.guarantor_relationship], ['ID Number', selected.guarantor_id_number], ['Address', selected.guarantor_address]]
                  .filter(([, v]) => v).map(([k, v]) => (
                    <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                      <Text style={{ ...p.meta }}>{k}</Text>
                      <Text style={{ ...p.meta, color: t.colors.textPrimary }}>{v}</Text>
                    </View>
                  ))}
              </Card>
            )}
          </View>
        )}
      </Sheet>

      <Sheet open={showPhoto && !!selected?.photo} onClose={() => setShowPhoto(false)} title="Photo" side="full">
        {selected?.photo && (
          <Image source={{ uri: selected.photo }} style={{ width: '100%', aspectRatio: 1, borderRadius: t.radius.md }} resizeMode="contain" />
        )}
      </Sheet>
    </Screen>
  );
}
