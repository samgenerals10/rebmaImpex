// rebma-web/src/views/OperationsDashboard.tsx

import type { Order } from '../types/erp';

interface OperationsDashboardProps {
  ordersList: Order[];
  onLogIntake: (e: React.FormEvent) => void;
  onReleaseToDispatch: (id: string) => void;
}

export default function OperationsDashboard({
  ordersList,
  onLogIntake,
  onReleaseToDispatch
}: OperationsDashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Operations Log Sheet</h1>
        <p className="text-sm text-slate-500 text-muted">Register port inventory intakes and process raw release tickets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Log Port Ingestion */}
        <div className="p-6 app-card space-y-4">
          <h3 className="text-lg font-bold">Workflow A: Log Incoming Port Cargo</h3>
          <form onSubmit={onLogIntake} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Country of Origin</label>
                <input 
                  type="text" 
                  name="country"
                  required 
                  placeholder="E.g., Germany"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Shipping Company</label>
                <input 
                  type="text" 
                  name="company"
                  required 
                  placeholder="COSCO, Maersk"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Total Quantity</label>
                <input 
                  type="number" 
                  name="quantity"
                  required 
                  placeholder="350"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Weight (Metric Tons)</label>
                <input 
                  type="number" 
                  step="0.1"
                  name="weight"
                  required 
                  placeholder="12.5"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Discrepancy Notes / Faults</label>
              <input 
                type="text" 
                name="discrepancies"
                placeholder="Optional: Damaged boxes, missing tags"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow cursor-pointer transition-all"
            >
              Submit Cargo Logs
            </button>
          </form>
        </div>

        {/* Stock releases & Ingestion audit log list */}
        <div className="p-6 app-card lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold">Fulfillment Releasing Queue</h3>
          
          <div className="divide-y divide-slate-100">
            {ordersList.filter(o => o.status === 'PROCESSING').map(order => (
              <div key={order.id} className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Order Release: {order.id}</p>
                  <p className="text-[10px] text-slate-500">Client: <strong>{order.clientName}</strong> | Value: <strong>${order.totalAmount}</strong></p>
                  <p className="text-[10px] text-emerald-600 font-semibold mt-1">Invoice Generated. Release Authorized.</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onReleaseToDispatch(order.id)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Release & Load Truck
                  </button>
                </div>
              </div>
            ))}
            {ordersList.filter(o => o.status === 'PROCESSING').length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No order releases pending release from warehouse floor.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
