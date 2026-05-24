// rebma-web/src/views/ProductionDashboard.tsx

import type { ProductionRequest } from '../types/erp';

interface ProductionDashboardProps {
  productionRequests: ProductionRequest[];
  onProductionRequest: (e: React.FormEvent) => void;
  onApproveProductionRequest: (id: string) => void;
  onIssueReleaseTickets: (id: string) => void;
  isCeo: boolean;
}

export default function ProductionDashboard({
  productionRequests,
  onProductionRequest,
  onApproveProductionRequest,
  onIssueReleaseTickets,
  isCeo
}: ProductionDashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Production WIP Tracker</h1>
        <p className="text-sm text-slate-500 text-muted">Trigger credit material requisitions and monitor operations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Material credit request form */}
        <div className="p-6 app-card space-y-4">
          <h3 className="text-lg font-bold">Workflow C: Request Raw Materials</h3>
          <form onSubmit={onProductionRequest} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Material Component</label>
              <select 
                name="material"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
              >
                <option value="Raw Polymer Granules">Raw Polymer Granules</option>
                <option value="Electric Wiring Loom">Electric Wiring Loom</option>
                <option value="Cast Iron Castings">Cast Iron Castings</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Requested Quantity</label>
              <input 
                type="number" 
                name="qty"
                required 
                placeholder="4500"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
              />
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[10px] text-amber-600">
              <strong>Note:</strong> Requisitions are logged under factory credit lines and require Management sign-off.
            </div>
            <button 
              type="submit" 
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
            >
              Submit Requisition
            </button>
          </form>
        </div>

        {/* WIP active tickets */}
        <div className="p-6 app-card lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold">Authorized Requisitions</h3>
          
          <div className="space-y-3">
            {productionRequests.map(req => (
              <div key={req.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Requisition: {req.id}</p>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {req.items.map((it, idx) => (
                      <p key={idx}>{it.materialName}: <strong>{it.quantity} units</strong></p>
                    ))}
                  </div>
                </div>
                <div>
                  {req.status === 'PENDING_MANAGEMENT' && (
                    <div className="flex gap-2">
                      {isCeo && (
                        <button 
                          onClick={() => onApproveProductionRequest(req.id)}
                          className="px-2.5 py-1 bg-amber-600 text-white rounded text-xs font-bold cursor-pointer hover:bg-amber-700"
                        >
                          CEO Sign-off
                        </button>
                      )}
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">On Hold (Mgmt Approval)</span>
                    </div>
                  )}
                  {req.status === 'APPROVED' && (
                    <button 
                      onClick={() => onIssueReleaseTickets(req.id)}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold cursor-pointer hover:bg-emerald-700"
                    >
                      Clear Release Tickets
                    </button>
                  )}
                  {req.status === 'TICKETS_ISSUED' && (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">Released for Factory Pickup</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
