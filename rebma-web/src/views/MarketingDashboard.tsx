// rebma-web/src/views/MarketingDashboard.tsx

import type { Order } from '../types/erp';

interface MarketingDashboardProps {
  ordersList: Order[];
  onCreateOrder: (e: React.FormEvent) => void;
}

export default function MarketingDashboard({
  ordersList,
  onCreateOrder
}: MarketingDashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Marketing Pipeline</h1>
        <p className="text-sm text-slate-500 text-muted">Create client sales orders and inspect historical items.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create Order form */}
        <div className="p-6 app-card space-y-4">
          <h3 className="text-lg font-bold">Workflow B: Create Client Order</h3>
          <form onSubmit={onCreateOrder} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Client Name</label>
              <input 
                type="text" 
                name="client"
                required 
                placeholder="E.g., West Coast Distributers"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Payment Mode</label>
                <select 
                  name="mode"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                >
                  <option value="CASH">Cash Payment</option>
                  <option value="ONLINE">Prepaid Online</option>
                  <option value="CREDIT">On Credit Terms</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Order Amount ($)</label>
                <input 
                  type="number" 
                  name="amount"
                  required 
                  placeholder="35000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <button 
              type="submit" 
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow cursor-pointer transition-all"
            >
              Submit Order
            </button>
          </form>
        </div>

        {/* Order History tracking lists */}
        <div className="p-6 app-card lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold">Active Sales Orders</h3>
          <div className="divide-y divide-slate-100">
            {ordersList.map(order => (
              <div key={order.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">{order.clientName} ({order.id})</p>
                  <p className="text-[10px] text-slate-500">Term: <strong>{order.paymentMode}</strong> | Amount: <strong>${order.totalAmount}</strong></p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Submitted: {order.createdAt}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    order.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' :
                    order.status === 'PROCESSING' ? 'bg-indigo-100 text-indigo-800' :
                    order.status === 'PENDING_MANAGEMENT' ? 'bg-purple-100 text-purple-800' :
                    order.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>{order.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
