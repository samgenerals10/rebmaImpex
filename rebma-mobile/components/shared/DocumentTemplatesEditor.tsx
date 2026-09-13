// rebma-mobile/components/shared/DocumentTemplatesEditor.tsx
// Ports: rebma-web/src/views/management/DocumentTemplatesView.tsx (271
// lines) + apiClient.ts's `documentTemplates` object — Scope Correction
// D95. CEO-only control over the header/footer printed on every receipt,
// dispatch ticket, and proforma invoice. 3 tabs (RECEIPT/TICKET/INVOICE),
// each with its own logo/name/subtitle/address+GPS/phone/email/website/
// footer note, saved once per doc type via `document_templates.upsert()`.
// Logo upload is a REAL Storage-bucket flow (document-logos bucket via
// lib/storage.ts's uploadToBucket() + pickOrCaptureImageAsset()), not the
// base64-in-column pattern used elsewhere in this app — matching web's own
// uploadFile() call exactly. Address+pin reuses LocationPicker (Phase
// 7.3); only the TICKET tab's pin is what the Dispatch GPS map actually
// reads as the depot location — same on-screen note web carries, not
// enforced structurally on either platform. Live preview kept as a
// mobile-stacked card instead of web's two-column layout.
import { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { Receipt, Ticket, FileText, Image as ImageIcon, MapPin } from 'lucide-react-native';
import { supabase } from '../../lib/supabaseClient';
import { pickOrCaptureImageAsset } from '../../lib/media';
import { uploadToBucket } from '../../lib/storage';
import { useTheme } from '../../theme/ThemeProvider';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input, { Field } from '../ui/Input';
import LocationPicker, { type LocationValue } from './LocationPicker';
import { SkeletonList } from '../ui/Skeleton';

type DocType = 'RECEIPT' | 'TICKET' | 'INVOICE';

interface DocumentTemplate {
  docType: DocType;
  logoUrl: string;
  companyName: string;
  subtitle: string;
  companyAddress: string;
  companyLat: number | null;
  companyLng: number | null;
  companyPhone: string;
  companyEmail: string;
  website: string;
  footerNote: string;
}

const FALLBACKS: Record<DocType, DocumentTemplate> = {
  RECEIPT: { docType: 'RECEIPT', logoUrl: '', companyName: 'REBMA IMPEX', subtitle: 'Official Payment Receipt', companyAddress: 'Accra Business District, Accra, Ghana', companyLat: null, companyLng: null, companyPhone: '', companyEmail: '', website: 'rebmaimpex.com', footerNote: 'This receipt is issued by REBMA IMPEX Ghana Limited Finance. It confirms payment has been received and recorded against the order referenced above.' },
  TICKET: { docType: 'TICKET', logoUrl: '', companyName: 'REBMA IMPEX', subtitle: 'Operations Dispatch Ticket', companyAddress: 'Accra Business District, Accra, Ghana', companyLat: null, companyLng: null, companyPhone: '', companyEmail: '', website: 'rebmaimpex.com', footerNote: 'This ticket is issued by REBMA IMPEX Ghana Limited Operations. It authorises the loading and dispatch of the above goods to the stated destination.' },
  INVOICE: { docType: 'INVOICE', logoUrl: '', companyName: 'REBMA IMPEX', subtitle: 'Proforma Invoice — Quote Only', companyAddress: 'Accra Business District, Accra, Ghana', companyLat: null, companyLng: null, companyPhone: '', companyEmail: '', website: 'rebmaimpex.com', footerNote: 'This is a proforma invoice — a quotation only, not a demand for payment or a tax invoice.' },
};

const TABS: { key: DocType; label: string; icon: any }[] = [
  { key: 'RECEIPT', label: 'Receipt', icon: Receipt },
  { key: 'TICKET', label: 'Dispatch Ticket', icon: Ticket },
  { key: 'INVOICE', label: 'Proforma Invoice', icon: FileText },
];

function mapRow(row: any, docType: DocType): DocumentTemplate {
  const fb = FALLBACKS[docType];
  if (!row) return fb;
  return {
    docType,
    logoUrl: row.logo_url || fb.logoUrl,
    companyName: row.company_name || fb.companyName,
    subtitle: row.subtitle ?? fb.subtitle,
    companyAddress: row.company_address ?? fb.companyAddress,
    companyLat: row.company_lat != null ? Number(row.company_lat) : null,
    companyLng: row.company_lng != null ? Number(row.company_lng) : null,
    companyPhone: row.company_phone ?? fb.companyPhone,
    companyEmail: row.company_email ?? fb.companyEmail,
    website: row.website || fb.website,
    footerNote: row.footer_note ?? fb.footerNote,
  };
}

export default function DocumentTemplatesEditor({ updatedBy }: { updatedBy: string }) {
  const t = useTheme();
  const [activeTab, setActiveTab] = useState<DocType>('RECEIPT');
  const [templates, setTemplates] = useState<Record<DocType, DocumentTemplate> | null>(null);
  const [drafts, setDrafts] = useState<Record<DocType, DocumentTemplate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('document_templates').select('*');
      const byType = new Map((data || []).map((r: any) => [r.doc_type, r]));
      const all: Record<DocType, DocumentTemplate> = {
        RECEIPT: mapRow(byType.get('RECEIPT'), 'RECEIPT'),
        TICKET: mapRow(byType.get('TICKET'), 'TICKET'),
        INVOICE: mapRow(byType.get('INVOICE'), 'INVOICE'),
      };
      setTemplates(all);
      setDrafts(all);
    } catch {
      setTemplates({ ...FALLBACKS });
      setDrafts({ ...FALLBACKS });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const draft = drafts?.[activeTab];
  const saved = templates?.[activeTab];
  const dirty = draft && saved && JSON.stringify(draft) !== JSON.stringify(saved);

  const setField = (key: keyof DocumentTemplate, value: string | number | null) => {
    setDrafts((prev) => (prev ? { ...prev, [activeTab]: { ...prev[activeTab], [key]: value } } : prev));
  };

  const location: LocationValue | null = draft?.companyAddress
    ? { address: draft.companyAddress, lat: draft.companyLat ?? 0, lng: draft.companyLng ?? 0 }
    : null;

  const handleLocationChange = (v: LocationValue | null) => {
    setDrafts((prev) => prev ? { ...prev, [activeTab]: { ...prev[activeTab], companyAddress: v?.address || '', companyLat: v?.lat ?? null, companyLng: v?.lng ?? null } } : prev);
  };

  const handleLogoUpload = async () => {
    const asset = await pickOrCaptureImageAsset();
    if (!asset) return;
    setUploadingLogo(true);
    try {
      const url = await uploadToBucket(asset.uri, 'document-logos', activeTab, asset.mimeType);
      if (url) setField('logoUrl', url);
    } catch {
      // Storage bucket may not exist yet — fail silently to match this
      // rollout's standing "Supabase manual migrations" gate; the field
      // stays editable, only the upload itself didn't complete.
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('document_templates').upsert({
        doc_type: draft.docType,
        logo_url: draft.logoUrl,
        company_name: draft.companyName,
        subtitle: draft.subtitle,
        company_address: draft.companyAddress,
        company_lat: draft.companyLat,
        company_lng: draft.companyLng,
        company_phone: draft.companyPhone,
        company_email: draft.companyEmail,
        website: draft.website,
        footer_note: draft.footerNote,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      });
      if (error) throw error;
      setTemplates((prev) => (prev ? { ...prev, [activeTab]: draft } : prev));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft) {
    return <SkeletonList rows={4} />;
  }

  return (
    <View style={{ gap: t.spacing.lg }}>
      <View style={{ flexDirection: 'row', gap: t.spacing.xs, flexWrap: 'wrap' }}>
        {TABS.map((tab) => (
          <Button key={tab.key} label={tab.label} size="sm" variant={activeTab === tab.key ? 'primary' : 'ghost'} onPress={() => setActiveTab(tab.key)} />
        ))}
      </View>

      <Card>
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Header</Text>

        <Field label="Logo">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            {draft.logoUrl ? (
              <Image source={{ uri: draft.logoUrl }} style={{ width: 48, height: 48, borderRadius: t.radius.sm, backgroundColor: '#fff' }} resizeMode="contain" />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: t.radius.sm, backgroundColor: t.colors.bgInput, alignItems: 'center', justifyContent: 'center' }}>
                <ImageIcon size={16} color={t.colors.textMuted} />
              </View>
            )}
            <Button label={uploadingLogo ? 'Uploading…' : draft.logoUrl ? 'Replace' : 'Upload Image'} size="sm" variant="ghost" onPress={handleLogoUpload} loading={uploadingLogo} disabled={uploadingLogo} />
          </View>
        </Field>

        <Field label="Company Name">
          <Input value={draft.companyName} onChangeText={(v) => setField('companyName', v)} placeholder="REBMA IMPEX" />
        </Field>
        <Field label="Document Subtitle">
          <Input value={draft.subtitle} onChangeText={(v) => setField('subtitle', v)} placeholder="e.g. Official Payment Receipt" />
        </Field>
        <Field label="Company Address">
          <LocationPicker value={location} onChange={handleLocationChange} placeholder="Accra Business District, Accra, Ghana" />
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginTop: t.spacing.xs }}>
            {activeTab === 'TICKET'
              ? 'This is also the pin the Dispatch GPS map uses as the depot location.'
              : 'Only for what’s printed on this document. The Dispatch GPS map uses the pin on the Dispatch Ticket tab.'}
          </Text>
        </Field>
        <Field label="Company Phone">
          <Input value={draft.companyPhone} onChangeText={(v) => setField('companyPhone', v)} placeholder="+233 (0) 302 000 000" keyboardType="phone-pad" />
        </Field>
        <Field label="Company Email">
          <Input value={draft.companyEmail} onChangeText={(v) => setField('companyEmail', v)} placeholder="info@rebmaimpex.com" keyboardType="email-address" autoCapitalize="none" />
        </Field>
        <Field label="Website">
          <Input value={draft.website} onChangeText={(v) => setField('website', v)} placeholder="rebmaimpex.com" autoCapitalize="none" />
        </Field>

        <View style={{ borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: t.spacing.md, marginTop: t.spacing.sm }}>
          <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: 4 }}>Footer Note</Text>
          <Text style={{ fontFamily: t.font.regular, fontSize: t.type.meta10.size, color: t.colors.textMuted, marginBottom: t.spacing.sm }}>
            The document number, QR code, and who issued it are always added automatically below this note.
          </Text>
          <Input value={draft.footerNote} onChangeText={(v) => setField('footerNote', v)} placeholder="e.g. This receipt is issued by REBMA IMPEX Ghana Limited Finance..." multiline numberOfLines={4} style={{ minHeight: 88, textAlignVertical: 'top' }} />
        </View>

        <View style={{ marginTop: t.spacing.lg }}>
          <Button label={saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'} onPress={handleSave} disabled={!dirty || saving} loading={saving} fullWidth />
        </View>
      </Card>

      <Card>
        <Text style={{ fontFamily: t.font.bold, fontSize: t.type.body14.size, color: t.colors.textPrimary, marginBottom: t.spacing.md }}>Preview</Text>
        <View style={{ borderRadius: t.radius.md, overflow: 'hidden', borderWidth: 1, borderColor: t.colors.border }}>
          <View style={{ height: 6, backgroundColor: '#1a5c32' }} />
          <View style={{ backgroundColor: '#fff', padding: t.spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, marginBottom: t.spacing.sm }}>
              {draft.logoUrl ? (
                <Image source={{ uri: draft.logoUrl }} style={{ width: 36, height: 36 }} resizeMode="contain" />
              ) : (
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
                  <ImageIcon size={14} color="#94a3b8" />
                </View>
              )}
              <View>
                <Text style={{ fontFamily: t.font.extrabold, fontSize: 13, color: '#1a5c32' }}>{draft.companyName || 'REBMA IMPEX'}</Text>
                <Text style={{ fontFamily: t.font.bold, fontSize: 9, color: '#29a9dc', textTransform: 'uppercase' }}>{draft.subtitle || '—'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: t.spacing.sm }}>
              <MapPin size={10} color="#64748b" />
              <Text style={{ fontFamily: t.font.regular, fontSize: 9, color: '#64748b', flex: 1 }} numberOfLines={2}>
                {draft.companyAddress}{draft.companyPhone ? ` · Tel: ${draft.companyPhone}` : ''}{draft.companyEmail ? ` · ${draft.companyEmail}` : ''}
              </Text>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', borderStyle: 'dashed', paddingTop: t.spacing.sm }}>
              <Text style={{ fontFamily: t.font.regular, fontSize: 9, color: '#94a3b8' }}>{draft.footerNote || '—'}</Text>
              <Text style={{ fontFamily: t.font.regular, fontStyle: 'italic', fontSize: 8, color: '#cbd5e1', marginTop: 6 }}>+ document number, QR code, issued-by (added automatically)</Text>
            </View>
          </View>
        </View>
      </Card>
    </View>
  );
}
