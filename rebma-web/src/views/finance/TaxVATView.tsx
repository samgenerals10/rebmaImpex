import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Download, Save, FileText, Calculator } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../../utils/export';

interface VATEntry {
  period: string;
  invoiceCount: number;
  grossSales: number;
  vatAmount: number;
  netSales: number;
  status: 'Filed' | 'Pending' | 'Draft';
}

const MOCK_VAT: VATEntry[] = [
  { period: 'Dec 2024', invoiceCount: 23, grossSales: 580000, vatAmount: 87000, netSales: 493000, status: 'Pending' },
  { period: 'Nov 2024', invoiceCount: 31, grossSales: 620000, vatAmount: 93000, netSales: 527000, status: 'Filed' },
  { period: 'Oct 2024', invoiceCount: 28, grossSales: 470000, vatAmount: 70500, netSales: 399500, status: 'Filed' },
  { period: 'Sep 2024', invoiceCount: 35, grossSales: 510000, vatAmount: 76500, netSales: 433500, status: 'Filed' },
  { period: 'Aug 2024', invoiceCount: 22, grossSales: 380000, vatAmount: 57000, netSales: 323000, status: 'Filed' },
];

interface TaxRates {
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
  const [vatData] = useState<VATEntry[]>(MOCK_VAT);
  const [rates, setRates] = useState<TaxRates>({ vat: 15, nhil: 2.5, getfund: 2.5, covid: 1, autoCalculate: true });
  const [selectedPeriod, setSelectedPeriod] = useState('Dec 2024');
  const [showRates, setShowRates] = useState(false);

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
          { label: 'VAT Collected (MTD)', value: `GHS ${(current?.vatAmount || 0).toLocaleString()}`, color: 'var(--accent)' },
          { label: 'VAT Rate', value: `${rates.vat}%`, color: '#6366f1' },
          { label: 'NHIL Amount', value: `GHS ${nhilAmount.toLocaleString()}`, color: '#f59e0b' },
          { label: 'Total Tax Liability', value: `GHS ${totalTaxLiability.toLocaleString()}`, color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className="text-xl font-bold" style={{ color }}>{value}</p>
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
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4">Invoice Aging Report</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '0–30 days', invoices: 12, amount: 280000, color: 'text-green-500' },
            { label: '31–60 days', invoices: 7, amount: 145000, color: 'text-yellow-500' },
            { label: '61–90 days', invoices: 3, amount: 68000, color: 'text-orange-500' },
            { label: '90+ days', invoices: 1, amount: 12000, color: 'text-red-500' },
          ].map(({ label, invoices, amount, color }) => (
            <div key={label} className="bg-[var(--bg-input)] rounded-xl p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{invoices} invoices</p>
              <p className="text-sm text-[var(--text-secondary)]">GHS {(amount / 1000).toFixed(0)}K</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
