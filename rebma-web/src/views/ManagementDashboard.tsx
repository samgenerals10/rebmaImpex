// rebma-web/src/views/ManagementDashboard.tsx

import type { IncomingGoods, Order } from '../types/erp';

interface ManagementDashboardProps {
  incomingGoodsList: IncomingGoods[];
  ordersList: Order[];
  onApproveIntake: (id: string, approve: boolean, price?: number) => void;
  onApproveCredit: (id: string, approve: boolean) => void;
}

export default function ManagementDashboard({
  incomingGoodsList,
  ordersList,
  onApproveIntake,
  onApproveCredit
}: ManagementDashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Management Control approvals</h1>
        <p className="text-sm text-slate-500 text-muted">Set wholesale pricing catalog and authorize credit limits.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Workflow A: Ingest Goods Approval Gate */}
        <div className="p-6 app-card space-y-4">
          <div>
            <h3 className="text-lg font-bold">Workflow A: Port Cargo Approval Queue</h3>
            <p className="text-xs text-slate-500 text-muted">Inspect logged intakes and verify pricing before stocking.</p>
          </div>

          <div className="space-y-3">
            {incomingGoodsList.filter(i => i.status === 'PENDING_MANAGEMENT_APPROVAL').map(item => (
              <div key={item.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Origin: {item.country} ({item.company})</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold">Awaiting Pricing</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                  <p>Qty: <strong>{item.quantity} units</strong></p>
                  <p>Weight: <strong>{item.weight}T</strong></p>
                  <p>Faults: <strong className="text-red-500">{item.discrepancies}</strong></p>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-xs font-bold">$</span>
                    <input 
                      type="number" 
                      placeholder="Set Unit Price"
                      id={`price-input-${item.id}`}
                      className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      const val = parseFloat((document.getElementById(`price-input-${item.id}`) as any).value);
                      if (isNaN(val)) return alert('Enter a price');
                      onApproveIntake(item.id, true, val);
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700"
                  >
                    Approve & Pricing
                  </button>
                  <button 
                    onClick={() => onApproveIntake(item.id, false)}
                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-red-200"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {incomingGoodsList.filter(i => i.status === 'PENDING_MANAGEMENT_APPROVAL').length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No cargo awaiting management pricing reviews.</p>
            )}
          </div>
        </div>

        {/* Workflow B: Credit Order Approval Gate */}
        <div className="p-6 app-card space-y-4">
          <div>
            <h3 className="text-lg font-bold">Workflow B: Credit order Approvals</h3>
            <p className="text-xs text-slate-500 text-muted">Review orders with CREDIT terms forwarded by Finance.</p>
          </div>

          <div className="space-y-3">
            {ordersList.filter(o => o.status === 'PENDING_MANAGEMENT').map(order => (
              <div key={order.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-700">{order.clientName}</p>
                  <p className="text-xs text-slate-500">Order ID: {order.id} | Total Amount: <strong>${order.totalAmount}</strong></p>
                  <p className="text-[10px] text-amber-600 font-semibold uppercase mt-1">Pending Credit Check</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onApproveCredit(order.id, true)}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700"
                  >
                    Authorize Credit
                  </button>
                  <button 
                    onClick={() => onApproveCredit(order.id, false)}
                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-red-200"
                  >
                    Block
                  </button>
                </div>
              </div>
            ))}
            {ordersList.filter(o => o.status === 'PENDING_MANAGEMENT').length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No credit limit audits pending.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
