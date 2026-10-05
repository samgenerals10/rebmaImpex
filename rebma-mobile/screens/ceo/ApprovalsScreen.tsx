// rebma-mobile/screens/ceo/ApprovalsScreen.tsx
// Ports: rebma-web/src/views/ceo/ApprovalsView.tsx — D73. A single live
// lane: registrations. Approve/Reject reuse callPrivilegedApi
// ('/api/approve-user'). The query is deliberately unfiltered by
// department; every pending registration is the CEO's to decide.
//
// The detail sheet shows everything the CEO needs before approving:
//   * everything HR entered (photo, contact, address, staff category,
//     résumé, guarantor), read from the person's profile, which
//     register-standard-user.ts copies from the invite;
//   * the device they registered from, their GPS location if they
//     allowed it, and the approximate network location and IP address,
//     read from staff_registration_details (CEO only under RLS).
//
// A registration has 12 hours to be approved. Past that it shows as
// Expired, can't be approved, and HR resends a fresh link.
//
// People who registered after the password change chose their own
// password, so approving them creates no temporary password; the server
// emails them that they can sign in. Older registrations without a
// registered_at still get the temporary password shown here.
import { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, Modal, Pressable, Linking } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { CheckCircle, XCircle, History, FileText, MapPin, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { callPrivilegedApi, ApiNotConfiguredError } from '../../lib/apiBase';
import { getSignedUrl } from '../../lib/storage';
import { isRegistrationExpired, approvalTimeLeft } from '../../lib/registration';
import { useTheme } from '../../theme/ThemeProvider';
import Screen from '../../components/ui/Screen';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import Card from '../../components/ui/Card';
import Input, { Field } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import DataList, { type DataColumn } from '../../components/ui/DataList';
import Sheet, { SheetSection } from '../../components/ui/Sheet';
import RequestTimelineSheet from '../../components/shared/RequestTimelineSheet';
import PasswordConfirmSheet from '../../components/shared/PasswordConfirmSheet';
import DeletionRequestsPanel from '../../components/shared/DeletionRequestsPanel';
import DepartmentChangesPanel from '../../components/shared/DepartmentChangesPanel';
import { useAuthStore } from '../../store/authStore';

interface Approval {
  id: string;
  fullName: string;
  department: string;
  role: string;
  dateSubmitted: string;
  registeredAt: string | null;
  expired: boolean;
  raw: any;
}

interface RegDetails {
  device: Record<string, any> | null;
  location: Record<string, any> | null;
  network_location: Record<string, any> | null;
  ip_address: string | null;
  registered_at: string | null;
}

const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';

export default function ApprovalsScreen() {
  const t = useTheme();
  const me = useAuthStore((st) => st.profile);
  const [panelRefresh, setPanelRefresh] = useState(0);
  const [rows, setRows] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [details, setDetails] = useState<RegDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [credPopup, setCredPopup] = useState<{ fullName: string; password: string } | null>(null);
  const [decisionModal, setDecisionModal] = useState<{ item: Approval; action: 'approve' | 'reject' } | null>(null);
  const [remark, setRemark] = useState('');
  const [timelineId, setTimelineId] = useState<string | null>(null);
  // Approving a co-CEO is a high-risk action: the CEO types his password.
  const [ceoApproval, setCeoApproval] = useState<{ item: Approval; note?: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'PENDING_APPROVAL')
      .order('created_at', { ascending: false })
      .limit(100);
    setRows((data || []).map((p: any) => ({
      id: p.id,
      fullName: p.full_name || 'New Employee',
      department: (p.role || 'STAFF').toUpperCase(),
      role: p.metadata?.inviteRole || p.role || '',
      dateSubmitted: fmtDateTime(p.registered_at || p.created_at),
      registeredAt: p.registered_at || null,
      expired: isRegistrationExpired(p.status, p.registered_at),
      raw: p,
    })));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openRow = async (item: Approval) => {
    setSelected(item);
    setDetails(null);
    setDetailsLoading(true);
    const { data } = await supabase
      .from('staff_registration_details')
      .select('device, location, network_location, ip_address, registered_at')
      .eq('user_id', item.id)
      .maybeSingle();
    setDetails((data as RegDetails) || null);
    setDetailsLoading(false);
  };

  const confirmDecision = () => {
    if (!decisionModal) return;
    const { item, action } = decisionModal;
    setDecisionModal(null);
    if (action === 'approve' && item.department === 'CEO') {
      // Let the remark sheet close first; iOS can't show two sheets at once.
      const note = remark.trim() || undefined;
      setTimeout(() => setCeoApproval({ item, note }), 350);
      return;
    }
    if (action === 'approve') approve(item, remark.trim() || undefined);
    else reject(item, remark.trim() || undefined);
  };

  const approve = async (item: Approval, note?: string, password?: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Only older registrations (no registered_at) need a temporary
      // password; the server makes it and returns it once.
      const res: any = await callPrivilegedApi('/api/approve-user', { userId: item.id, approve: true, issueTemporaryPassword: !item.registeredAt, remark: note, password });
      setRows((prev) => prev.filter((r) => r.id !== item.id));
      setSelected(null);
      if (res?.temporaryPassword) setCredPopup({ fullName: item.fullName, password: res.temporaryPassword });
      else Alert.alert('Approved', res?.message || `${item.fullName} can now sign in.`);
    } catch (e: any) {
      if (e instanceof ApiNotConfiguredError) Alert.alert('Not Configured', e.message);
      else Alert.alert('Approval Failed', e.message || 'Could not approve this registration.');
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const reject = async (item: Approval, note?: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await callPrivilegedApi('/api/approve-user', { userId: item.id, approve: false, remark: note });
      await supabase.from('supplier_order_notifications').insert({
        message: `Registration REJECTED by CEO: ${item.fullName} (${item.department})${note ? `. Reason: ${note}` : ''}`,
        notified_department: 'HR',
        read: false,
      });
      setRows((prev) => prev.filter((r) => r.id !== item.id));
      setSelected(null);
    } catch (e: any) {
      if (e instanceof ApiNotConfiguredError) Alert.alert('Not Configured', e.message);
      else Alert.alert('Rejection Failed', e.message || 'Could not reject this registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const viewResume = async (path: string) => {
    const url = await getSignedUrl('staff-resumes', path);
    if (!url) { Alert.alert('Unavailable', 'Could not open the résumé. It may have been removed.'); return; }
    Linking.openURL(url);
  };

  const timeBadge = (r: Approval) => {
    if (r.expired) return <Badge tone="danger" label="EXPIRED" size="xs" />;
    const left = approvalTimeLeft(r.registeredAt);
    return <Badge tone="warning" label={left ? left.toUpperCase() : 'PENDING'} size="xs" />;
  };

  const columns: DataColumn<Approval>[] = [
    { key: 'fullName', label: 'Name', primary: true },
    { key: 'expired', label: 'Status', status: true, render: timeBadge },
    { key: 'department', label: 'Department', render: (r) => r.role && r.role.toUpperCase() !== r.department ? `${r.department}, ${r.role}` : r.department },
    { key: 'dateSubmitted', label: 'Registered' },
  ];

  const textStyle = { fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textSecondary };
  const Row = ({ label, value }: { label: string; value?: any }) =>
    value === undefined || value === null || value === '' ? null : (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.md, paddingVertical: 4 }}>
        <Text style={{ fontFamily: t.font.medium, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>{label}</Text>
        <Text selectable style={{ ...textStyle, flex: 1, textAlign: 'right' }}>{String(value)}</Text>
      </View>
    );

  const p = selected?.raw || {};
  const dev = details?.device || {};
  const gps = details?.location || {};
  const net = details?.network_location || {};
  const hasGps = typeof gps.latitude === 'number' && typeof gps.longitude === 'number';

  return (
    <Screen refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); setPanelRefresh((n) => n + 1); }}>
      <View style={{ gap: t.spacing.md }}>
        {/* Department moves wait for the CEO; Delete Account requests from
            HR and Management staff are the CEO's to confirm. */}
        <DepartmentChangesPanel refreshKey={panelRefresh} />
        <DeletionRequestsPanel callerIsCeo={!!me?.isAdmin} callerId={me?.id} refreshKey={panelRefresh} />
        <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
          {rows.length} pending approval{rows.length !== 1 ? 's' : ''}. Each one must be approved within 12 hours of registering.
        </Text>
        <DataList
          columns={columns}
          data={rows}
          rowKey={(r) => r.id}
          loading={loading}
          onRowPress={openRow}
          emptyIcon={<CheckCircle size={28} color={t.colors.status.success.text} />}
          emptyTitle="All clear!"
          emptyDescription="No pending approvals right now."
        />
      </View>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.fullName} subtitle={selected ? `${selected.department}${selected.role && selected.role.toUpperCase() !== selected.department ? `, ${selected.role}` : ''}` : ''} side="bottom" maxHeight={760}
        footer={selected ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
            <Button label="Timeline" size="sm" variant="ghost" icon={<History size={13} color={t.colors.textSecondary} />} onPress={() => setTimelineId(selected.id)} />
            <Button label="Approve" size="sm" icon={<CheckCircle size={13} color="#fff" />} onPress={() => { setRemark(''); setDecisionModal({ item: selected, action: 'approve' }); }} disabled={submitting || selected.expired} />
            <Button label="Reject" size="sm" variant="danger" icon={<XCircle size={13} color="#fff" />} onPress={() => { setRemark(''); setDecisionModal({ item: selected, action: 'reject' }); }} disabled={submitting} />
          </View>
        ) : undefined}>
        {selected && (
          <View style={{ gap: t.spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <Pressable onPress={() => p.photo && setPhotoOpen(true)} disabled={!p.photo} accessibilityLabel="View photo">
                <Avatar name={selected.fullName} photo={p.photo} size={72} />
              </Pressable>
              <View style={{ flex: 1, gap: 4 }}>
                {timeBadge(selected)}
                <Text style={textStyle}>Registered {selected.dateSubmitted}</Text>
                {selected.expired && (
                  <Text style={{ ...textStyle, color: t.colors.status.danger.text }}>Not approved within 12 hours. HR can resend the link from the staff list.</Text>
                )}
              </View>
            </View>

            <SheetSection label="Entered by HR">
              <Row label="Email" value={p.email} />
              <Row label="Phone" value={p.phone} />
              <Row label="Department" value={selected.department} />
              <Row label="Role" value={selected.role} />
              <Row label="Employee number" value={p.employee_number} />
              <Row label="Staff category" value={p.staff_category} />
              <Row label="Address" value={p.address} />
              <Row label="Ghana Card" value={p.ghana_card_id} />
              {p.resume_url ? (
                <View style={{ alignItems: 'flex-start', marginTop: 4 }}>
                  <Button label="Open résumé" size="sm" variant="ghost" icon={<FileText size={13} color={t.colors.textSecondary} />} onPress={() => viewResume(p.resume_url)} />
                </View>
              ) : null}
            </SheetSection>

            {(p.guarantor_name || p.guarantor_phone) ? (
              <SheetSection label="Guarantor">
                <Row label="Name" value={p.guarantor_name} />
                <Row label="Phone" value={p.guarantor_phone} />
                <Row label="Relationship" value={p.guarantor_relationship} />
                <Row label="ID number" value={p.guarantor_id_number} />
                <Row label="Address" value={p.guarantor_address} />
              </SheetSection>
            ) : null}

            <SheetSection label="Device used to register">
              {detailsLoading ? <Text style={textStyle}>Loading…</Text> : !details ? (
                <Text style={textStyle}>Not recorded. This person registered before device details were collected.</Text>
              ) : (
                <>
                  <Row label="Type" value={dev.kind} />
                  <Row label="Using" value={dev.platform} />
                  <Row label="Model" value={[dev.manufacturer, dev.model].filter(Boolean).join(' ') || undefined} />
                  <Row label="System" value={[dev.os, dev.osVersion].filter(Boolean).join(' ') || undefined} />
                  <Row label="Browser" value={dev.browser} />
                  <Row label="App version" value={dev.appVersion} />
                  <Row label="Screen" value={dev.screen} />
                </>
              )}
            </SheetSection>

            {details && (
              <SheetSection label="Location when registering">
                {hasGps ? (
                  <Card tone="inset">
                    <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.meta11.size, color: t.colors.textMuted, marginBottom: 4 }}>GPS</Text>
                    {gps.address ? <Text selectable style={textStyle}>{gps.address}</Text> : null}
                    <Text selectable style={textStyle}>{gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}{gps.accuracy ? ` (within about ${gps.accuracy} m)` : ''}</Text>
                    <View style={{ alignItems: 'flex-start', marginTop: t.spacing.sm }}>
                      <Button label="Open in Maps" size="sm" variant="ghost" icon={<MapPin size={13} color={t.colors.textSecondary} />} onPress={() => Linking.openURL(`https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`)} />
                    </View>
                  </Card>
                ) : (
                  <Text style={textStyle}>No GPS location. {gps.refusedReason || 'They did not share it.'}</Text>
                )}
                <Row label="Approximate area" value={[net.city, net.region, net.country].filter(Boolean).join(', ') || 'Not available'} />
                <Row label="Network address (IP)" value={details.ip_address || 'Not available'} />
              </SheetSection>
            )}
          </View>
        )}
      </Sheet>

      <Modal visible={photoOpen} transparent animationType="fade" onRequestClose={() => setPhotoOpen(false)}>
        <Pressable onPress={() => setPhotoOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          {p.photo ? <Image source={{ uri: p.photo }} style={{ width: '100%', height: '80%' }} resizeMode="contain" /> : null}
          <View style={{ position: 'absolute', top: 48, right: 20 }}><X size={26} color="#fff" /></View>
        </Pressable>
      </Modal>

      <Sheet
        open={!!decisionModal}
        onClose={() => setDecisionModal(null)}
        title={decisionModal?.action === 'approve' ? 'Approve Registration' : 'Reject Registration'}
        side="bottom"
        maxHeight={360}
        footer={
          <Button
            label={decisionModal?.action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
            variant={decisionModal?.action === 'approve' ? 'primary' : 'danger'}
            onPress={confirmDecision}
            disabled={decisionModal?.action === 'reject' && !remark.trim()}
            loading={submitting}
            fullWidth
          />
        }
      >
        <Field label={`Remark ${decisionModal?.action === 'reject' ? '(required)' : '(optional)'}`}>
          <Input
            value={remark}
            onChangeText={setRemark}
            multiline
            numberOfLines={4}
            placeholder={decisionModal?.action === 'reject' ? 'Why is this registration being rejected?' : 'Optional note...'}
            style={{ minHeight: 96, textAlignVertical: 'top' }}
          />
        </Field>
      </Sheet>

      <Sheet open={!!credPopup} onClose={() => setCredPopup(null)} title="Account Approved" side="bottom" maxHeight={320} footer={<Button label="Done" onPress={() => setCredPopup(null)} fullWidth />}>
        {credPopup && (
          <View style={{ gap: t.spacing.sm }}>
            <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>
              Share this temporary password with {credPopup.fullName}. They'll be asked to change it on first login.
            </Text>
            <Text selectable style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.status.success.text }}>{credPopup.password}</Text>
          </View>
        )}
      </Sheet>

      <PasswordConfirmSheet
        open={!!ceoApproval}
        onClose={() => setCeoApproval(null)}
        title="Confirm Co-CEO Approval"
        description={ceoApproval ? `Approve ${ceoApproval.item.fullName} as a co-CEO? They get the same powers as you. Type your password to confirm it is you.` : ''}
        confirmLabel="Approve co-CEO"
        onConfirm={async (password) => {
          if (!ceoApproval) return;
          // Checked first so a wrong password keeps this sheet open.
          const res: any = await callPrivilegedApi('/api/approve-user', { userId: ceoApproval.item.id, approve: true, remark: ceoApproval.note, password });
          setRows((prev) => prev.filter((r) => r.id !== ceoApproval.item.id));
          setSelected(null);
          setCeoApproval(null);
          Alert.alert('Approved', res?.message || `${ceoApproval.item.fullName} is now a co-CEO.`);
        }}
      />

      <RequestTimelineSheet open={!!timelineId} onClose={() => setTimelineId(null)} referenceId={timelineId || ''} />
    </Screen>
  );
}
