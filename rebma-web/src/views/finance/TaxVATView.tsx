import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Download, Save, FileText, Calculator } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../../utils/export';
import CountUp from '../../components/CountUp';
import { useCeoSettings } from '../../contexts/CeoSettingsContext';

interface VATEntry {
  period: string;
  invoiceCount: number;
  grossSales: number;
  vatAmount: number;
  netSales: number;
  status: 'Filed' | 'Pending' | 'Draft';
}


interface TaxRates {
  [key: string]: number | boolean;
  vat: number;
  nhil: number;
  getfund: number;
  covid: number;
  autoCalculate: boolean;
}

interface Props {
  addNotification?: (msg: string) => void;
  currentUser?: { fullName: string; department: string } | null;
}

export default function FinanceTaxVATView({ addNotification, currentUser }: Props) {
  const { getSetting } = useCeoSettings();
  const [vatData, setVatData] = useState<VATEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<TaxRates>({ vat: 15, nhil: 2.5, getfund: 2.5, covid: 1, autoCalculate: true });
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [showRates, setShowRates] = useState(false);
  const [agingData, setAgingData] = useState([
    { label: '0–30 days', invoices: 0, amount: 0, color: 'text-green-500' },
    { label: '31–60 days', invoices: 0, amount: 0, color: 'text-yellow-500' },
    { label: '61–90 days', invoices: 0, amount: 0, color: 'text-orange-500' },
    { label: '90+ days', invoices: 0, amount: 0, color: 'text-red-500' },
  ]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('finance_vat_periods')
          .select('*')
          .order('period', { ascending: false })
          .limit(500);
        const rows = (data ?? []) as VATEntry[];
        setVatData(rows);
        if (rows.length > 0) setSelectedPeriod(rows[0].period);

        // Aging buckets computed server-side over the full orders table
        // (get_vat_aging_summary) instead of pulling every order ever
        // placed just to bucket the ones with a balance still due.
        const { data: agingRows } = await supabase.rpc('get_vat_aging_summary');
        const AGING_META: Record<string, string> = {
          '0-30 days': 'text-green-500', '31-60 days': 'text-yellow-500',
          '61-90 days': 'text-orange-500', '90+ days': 'text-red-500',
        };
        if (agingRows) {
          setAgingData((agingRows as any[]).map(r => ({
            label: r.bucket.replace('-', '–'),
            invoices: Number(r.invoices || 0),
            amount: Number(r.amount || 0),
            color: AGING_META[r.bucket] || 'text-gray-500',
          })));
        }
      } catch {
        setVatData([]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const current = vatData[0];
  const totalVatCollected = vatData.filter(v => v.status === 'Filed').reduce((s, v) => s + v.vatAmount, 0);
  const totalTaxLiability = current ? current.grossSales * ((rates.vat + rates.nhil + rates.getfund + rates.covid) / 100) : 0;
  const nhilAmount = current ? current.grossSales * (rates.nhil / 100) : 0;

  function saveRates() {
    supabase.from('finance_settings').upsert([{ key: 'tax_rates', value: JSON.stringify(rates), updated_by: currentUser?.fullName || 'Finance', updated_at: new Date().toISOString() }]).then(() => {}, () => {});
    addNotification?.('Tax rates saved successfully');
    setShowRates(false);
  }

  function generateReport() {
    if (!getSetting('report_generation_enabled', true)) { addNotification?.('Report generation is currently disabled by the CEO.'); return; }
    exportToPDF(
      `Tax Report — ${selectedPeriod}`,
      vatData.filter(v => v.period === selectedPeriod).map(v => ({
        Period: v.period, Invoices: v.invoiceCount, 'Gross Sales': `GHS ${v.grossSales.toLocaleString()}`,
        'VAT Amount': `GHS ${v.vatAmount.toLocaleString()}`, 'Net Sales': `GHS ${v.netSales.toLocaleString()}`, Status: v.status,
      })),
      ['Period', 'Invoices', 'Gross Sales', 'VAT Amount', 'Net Sales', 'Status']
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Tax & VAT Management</h1>
          <p className="text-sm text-[var(--text-secondary)]">Track VAT collection and tax compliance</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRates(!showRates)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"><Calculator size={14} /> Tax Rates</button>
          <button onClick={generateReport} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--accent)' }}><FileText size={14} /> Generate Report</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'VAT Collected (MTD)', value: current?.vatAmount || 0, prefix: 'GHS ', suffix: '', color: 'var(--accent)' },
          { label: 'VAT Rate', value: rates.vat, prefix: '', suffix: '%', color: '#6366f1' },
          { label: 'NHIL Amount', value: nhilAmount, prefix: 'GHS ', suffix: '', color: '#f59e0b' },
          { label: 'Total Tax Liability', value: totalTaxLiability, prefix: 'GHS ', suffix: '', color: '#ef4444' },
        ].map(({ label, value, prefix, suffix, color }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-xl font-bold" style={{ color }}><CountUp value={value} prefix={prefix} suffix={suffix} /></p>
          </div>
        ))}
      </div>

      {showRates && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-[var(--text-primary)]">Tax Rate Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'VAT Rate (%)', key: 'vat' },
              { label: 'NHIL Rate (%)', key: 'nhil' },
              { label: 'GETFUND Rate (%)', key: 'getfund' },
              { label: 'COVID Levy (%)', key: 'covid' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{label}</label>
                <input type="number" step="0.5" value={(rates as Record<string, number | boolean>)[key] as number} onChange={e => setRates(r => ({ ...r, [key]: parseFloat(e.target.value) }))} className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
            <input type="checkbox" checked={rates.autoCalculate} onChange={e => setRates(r => ({ ...r, autoCalculate: e.target.checked }))} className="rounded" />
            Auto-calculate on all invoices
          </label>
          <div className="p-3 bg-[var(--bg-input)] rounded-xl">
            <p className="text-xs text-[var(--text-muted)] mb-2">Effective Rate Preview</p>
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <span className="text-[var(--text-secondary)]">VAT: <strong className="text-[var(--text-primary)]">{rates.vat}%</strong></span>
              <span className="text-[var(--text-muted)]">+</span>
              <span className="text-[var(--text-secondary)]">NHIL: <strong className="text-[var(--text-primary)]">{rates.nhil}%</strong></span>
              <span className="text-[var(--text-muted)]">+</span>
              <span className="text-[var(--text-secondary)]">GETFUND: <strong className="text-[var(--text-primary)]">{rates.getfund}%</strong></span>
              <span className="text-[var(--text-muted)]">+</span>
              <span className="text-[var(--text-secondary)]">COVID: <strong className="text-[var(--text-primary)]">{rates.covid}%</strong></span>
              <span className="text-[var(--text-muted)]">=</span>
              <span className="font-bold" style={{ color: 'var(--accent)' }}>Total: {rates.vat + rates.nhil + rates.getfund + rates.covid}%</span>
            </div>
          </div>
          <button onClick={saveRates} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: 'var(--accent)' }}><Save size={14} /> Save Rates</button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} className="px-3 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-secondary)] focus:outline-none">
          {vatData.map(v => <option key={v.period}>{v.period}</option>)}
        </select>
        <button onClick={() => exportToCSV(vatData.map(v => ({ Period: v.period, Invoices: v.invoiceCount, 'Gross Sales': v.grossSales, 'VAT Amount': v.vatAmount, 'Net Sales': v.netSales, Status: v.status })), ['Period', 'Invoices', 'Gross Sales', 'VAT Amount', 'Net Sales', 'Status'], 'vat_report')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"><Download size={14} /> Export CSV</button>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6">{[0,1,2,3,4].map(i => <div key={i} className="animate-pulse h-10 bg-slate-200 dark:bg-slate-700 rounded mb-2" />)}</div>
        ) : vatData.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-[var(--text-muted)]">
            <Calculator size={32} className="opacity-30 mb-2" />
            <p className="text-sm">No VAT records found</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[var(--border)]">{['Period', 'Invoice Count', 'Gross Sales', 'VAT Amount', 'Net Sales', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-[var(--border)]">
              {vatData.map(v => (
                <tr key={v.period} className="hover:bg-[var(--bg-input)]">
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{v.period}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{v.invoiceCount}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)]">GHS {v.grossSales.toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--accent)' }}>GHS {v.vatAmount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)]">GHS {v.netSales.toLocaleString()}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${v.status === 'Filed' ? 'bg-green-100 text-green-700' : v.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{v.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4">Invoice Aging Report</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {agingData.map(({ label, invoices, amount, color }) => (
            <div key={label} className="bg-[var(--bg-input)] rounded-xl p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}><CountUp value={invoices} suffix=" invoices" /></p>
              <p className="text-sm text-[var(--text-secondary)]">GHS <CountUp value={amount} decimals={2} /></p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
