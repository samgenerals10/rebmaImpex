// rebma-mobile/components/shared/EnrollmentSection.tsx
//
// Step 4: which attendance devices a person is enrolled on, and under
// which device User ID. A person's first accepted scan records it by
// itself (source "scan"); HR can also add one by hand, for example when a
// keypad device only takes digits, or remove one. The device webhook uses
// this list first, then falls back to the employee number.
//
// Web twin: rebma-web/src/components/hr/EnrollmentSection.tsx.
import { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Alert } from '../../lib/appAlert';
import { Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeProvider';
import Button from '../ui/Button';
import Input, { Field } from '../ui/Input';
import SearchablePicker from '../ui/SearchablePicker';
import { SheetSection } from '../ui/Sheet';
import {
  listEnrollments, addEnrollment, removeEnrollment, listAttendanceDevices,
  type EnrollmentRow, type PersonKind,
} from '../../lib/staffDirectory';

interface Props {
  personKind: PersonKind;
  personId: string;
  employeeNumber?: string;
  canEdit: boolean;
  enrolledBy: string;
  onChanged?: () => void;
}

export default function EnrollmentSection({ personKind, personId, employeeNumber, canEdit, enrolledBy, onChanged }: Props) {
  const t = useTheme();
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [devices, setDevices] = useState<{ id: string; name: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [userId, setUserId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await listEnrollments(personKind, personId)); } catch { setRows([]); }
  }, [personKind, personId]);
  useEffect(() => { load(); }, [load]);

  const startAdding = async () => {
    setAdding(true);
    setUserId(employeeNumber || '');
    const list = await listAttendanceDevices();
    setDevices(list);
    setDeviceId(list[0]?.id || '');
  };

  const save = async () => {
    if (!deviceId) { Alert.alert('Missing Info', 'Pick a device. Add one under Attendance first.'); return; }
    if (!userId.trim()) { Alert.alert('Missing Info', 'Enter the User ID this person has on the device.'); return; }
    setSaving(true);
    try {
      await addEnrollment({ deviceId, personKind, personId, employeeNumber, deviceUserId: userId, enrolledBy });
      setAdding(false);
      load();
      onChanged?.();
    } catch (e: any) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (row: EnrollmentRow) => {
    Alert.alert('Remove enrollment', `Stop linking User ID ${row.deviceUserId} on ${row.deviceName} to this person? Their scans there fall back to their employee number.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await removeEnrollment(row.id); load(); onChanged?.(); } catch (e: any) { Alert.alert('Failed', e.message); }
      } },
    ]);
  };

  return (
    <SheetSection label="Attendance Devices">
      <View style={{ gap: t.spacing.sm }}>
        {rows.length === 0 ? (
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.body12.size, color: t.colors.textMuted }}>
            Not enrolled on any device yet. Their first scan records it, or add it here.
          </Text>
        ) : rows.map((r) => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: t.font.semibold, fontSize: t.type.body12.size, color: t.colors.textPrimary }}>{r.deviceName}</Text>
              <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta11.size, color: t.colors.textMuted }}>
                User ID {r.deviceUserId}. {r.source === 'scan' ? 'Recorded by their first scan' : 'Added by HR'} on {new Date(r.enrolledAt).toLocaleDateString()}.
              </Text>
            </View>
            {canEdit && <Button label="Remove" size="sm" variant="ghost" icon={<Trash2 size={12} color={t.colors.textSecondary} />} onPress={() => remove(r)} />}
          </View>
        ))}

        {canEdit && !adding && <Button label="Add enrollment" size="sm" variant="ghost" onPress={startAdding} />}
        {canEdit && adding && (
          <View style={{ gap: t.spacing.sm }}>
            <Field label="Device">
              <SearchablePicker value={deviceId} onChange={setDeviceId} placeholder="Pick a device" options={devices.map((d) => ({ value: d.id, label: d.name }))} />
            </Field>
            <Field label="User ID on the device" hint="Usually their employee number. Keypad-only devices take digits, e.g. 12.">
              <Input value={userId} onChangeText={setUserId} placeholder="e.g. EMP-00012" autoCapitalize="characters" />
            </Field>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Button label="Cancel" size="sm" variant="ghost" onPress={() => setAdding(false)} />
              <Button label={saving ? 'Saving…' : 'Save'} size="sm" onPress={save} loading={saving} disabled={saving} />
            </View>
          </View>
        )}
      </View>
    </SheetSection>
  );
}
