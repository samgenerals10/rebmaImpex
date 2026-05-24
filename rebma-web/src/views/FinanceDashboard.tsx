// rebma-web/src/views/FinanceDashboard.tsx

import { Download } from 'lucide-react';
import type { Order } from '../types/erp';

interface FinanceDashboardProps {
  ordersList: Order[];
  onEvaluateOrder: (id: string, approve: boolean) => void;
  onFinalizeOrder: (id: string) => void;
}

export default function FinanceDashboard({
  ordersList,
  onEvaluateOrder,
  onFinalizeOrder
}: FinanceDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance Ledgers</h1>
          <p className="text-sm text-slate-500 text-muted">Clear cash invoice payments and verify credit requests.</p>
        </div>
        
        {/* CSV Exporter trigger from API backend */}
        <a 
          href="/api/reports/export-csv" 
          download
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow cursor-pointer transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Export Order Ledger (CSV)</span>
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* evaluate payment terms queue */}
        <div className="p-6 app-card lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold">Workflow B: Order Payment Evaluation Queue</h3>
          <div className="space-y-3">
            {ordersList.filter(o => o.status === 'PENDING_FINANCE').map(order => (
              <div key={order.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">{order.clientName} ({order.id})</p>
                  <p className="text-xs text-slate-500">Payment: <strong>{order.paymentMode}</strong> | Amount: <strong>${order.totalAmount}</strong></p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onEvaluateOrder(order.id, true)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700"
                  >
                    Clear Terms
                  </button>
                  <button 
                    onClick={() => onEvaluateOrder(order.id, false)}
                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-red-200"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
            {ordersList.filter(o => o.status === 'PENDING_FINANCE').length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No order payment checks pending clearance.</p>
            )}
          </div>
        </div>

        {/* Finalize invoicing for approved orders */}
        <div className="p-6 app-card space-y-4">
          <h3 className="text-lg font-bold">Invoice Inception Portal</h3>
          <div className="space-y-3">
            {ordersList.filter(o => o.status === 'APPROVED').map(order => (
              <div key={order.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <p className="text-xs font-bold text-slate-800">{order.clientName}</p>
                <p className="text-[10px] text-slate-500">Invoice Amount: <strong>${order.totalAmount}</strong></p>
                <button 
                  onClick={() => onFinalizeOrder(order.id)}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
                >
                  Generate PDF Invoice
                </button>
              </div>
            ))}
            {ordersList.filter(o => o.status === 'APPROVED').length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No approved order invoices pending inception.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
