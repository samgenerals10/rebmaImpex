// rebma-web/src/views/ProductionDashboard.tsx

import React, { useState } from 'react';
import { FileSpreadsheet, FileText, Factory, Layers, ShieldCheck, Activity, History, Package, BarChart2 } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/export';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';
import type { ProductionRequest } from '../types/erp';

interface ProductionDashboardProps {
  productionRequests: ProductionRequest[];
  setProductionRequests: React.Dispatch<React.SetStateAction<ProductionRequest[]>>;
  activeSubTab: string;
  addNotification: (msg: string) => void;
}

// WIP Stock items
const wipStock = [
  { id: 'WIP-001', productName: 'Refined Palm Oil', stage: 'Processing', qty: 250, updatedAt: '2026-05-25 09:00' },
  { id: 'WIP-002', productName: 'Polymer Granules (Grade A)', stage: 'Quality Check', qty: 1200, updatedAt: '2026-05-25 10:30' },
  { id: 'WIP-003', productName: 'Cocoa Butter Blocks', stage: 'Packaging', qty: 80, updatedAt: '2026-05-24 15:00' },
  { id: 'WIP-004', productName: 'Shea Butter Cream', stage: 'Awaiting Dispatch', qty: 340, updatedAt: '2026-05-24 17:00' },
];

export default function ProductionDashboard({
  productionRequests,
  setProductionRequests,
  activeSubTab = 'Requisition',
  addNotification
}: ProductionDashboardProps) {

  const [newMaterial, setNewMaterial] = useState('');
  const [newQty, setNewQty] = useState('');

  const barChartData = [
    { name: 'Mon', Requested: 3, Produced: 2 },
    { name: 'Tue', Requested: 5, Produced: 5 },
    { name: 'Wed', Requested: 4, Produced: 3 },
    { name: 'Thu', Requested: 6, Produced: 6 },
    { name: 'Fri', Requested: 5, Produced: 4 },
  ];

  const totalRequests = productionRequests.length;
  const approvedCount = productionRequests.filter(r => r.status === 'APPROVED').length;
  const completedCount = productionRequests.filter(r => r.status === 'COMPLETED' || r.status === 'TICKETS_ISSUED').length;
  const totalUnits = productionRequests.reduce((acc, r) => acc + r.items.reduce((s, i) => s + i.quantity, 0), 0);

  const stats = [
    { title: 'Requisition Orders', value: `${totalRequests} Requests`, sub: 'Total raw material requests', icon: Layers, color: 'text-blue-500' },
    { title: 'Approved Orders', value: `${approvedCount} Cleared`, sub: 'Management authorized', icon: ShieldCheck, color: 'text-emerald-500' },
    { title: 'Production Completed', value: `${completedCount} Batches`, sub: 'Issued to warehouse stock', icon: Factory, color: 'text-indigo-500' },
    { title: 'Total Units Processed', value: `${totalUnits.toLocaleString()} u`, sub: 'All time raw material units', icon: Activity, color: 'text-amber-500' },
  ];

  const handleCreateRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterial || !newQty) return;
    const newReq: ProductionRequest = {
      id: `PRD-${Date.now().toString().slice(-3)}`,
      items: [{ materialName: newMaterial, quantity: parseInt(newQty) }],
      status: 'PENDING_MANAGEMENT',
      createdAt: new Date().toLocaleString()
    };
    setProductionRequests(prev => [newReq, ...prev]);
    addNotification(`Production raised requisition for ${newMaterial} (${newQty} units). Forwarded to Management.`);
    setNewMaterial('');
    setNewQty('');
  };

  const handleIssueTicket = (id: string) => {
    setProductionRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'TICKETS_ISSUED' } : r));
    addNotification(`Production issued goods ticket for Requisition ${id}. Warehouse inventory updated.`);
  };

  const statusColor = (status: string) => {
    const m: Record<string, string> = {
      TICKETS_ISSUED: 'bg-emerald-100 text-emerald-800',
      COMPLETED: 'bg-emerald-100 text-emerald-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      PENDING_MANAGEMENT: 'bg-amber-100 text-amber-800',
    };
    return m[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Production Floor Control</h1>
          <p className="text-sm text-slate-500 text-muted">Manage raw material requisitions, production batches, and WIP stock.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(productionRequests, ['id', 'status', 'createdAt'], 'production_requisitions')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Export CSV</span>
          </button>
          <button onClick={() => exportToPDF('Production Requisitions', productionRequests, ['id', 'status', 'createdAt'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
            <FileText className="w-3.5 h-3.5" /><span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="p-6 app-card flex items-center justify-between hover:scale-102 transition-all">
              <div>
                <span className="text-xs text-slate-400 uppercase font-semibold">{card.title}</span>
                <h3 className="text-2xl font-bold mt-1">{card.value}</h3>
                <p className="text-[10px] text-slate-400 mt-1">{card.sub}</p>
              </div>
              <div className={`p-4 bg-slate-100 rounded-2xl ${card.color} bg-accent-light`}><Icon className="w-6 h-6" /></div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="p-6 app-card">
        <h3 className="text-lg font-bold">Raw Materials Requested vs Goods Produced</h3>
        <p className="text-xs text-slate-500 text-muted">Weekly production batches requested vs completed output.</p>
        <div className="h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip />
              <Bar dataKey="Requested" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Produced" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tab Views */}
      <div className="border-t border-slate-100 pt-6">

        {/* REQUISITION FORM */}
        {activeSubTab === 'Requisition' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <div className="p-6 app-card space-y-4">
              <h3 className="text-lg font-bold">Submit Raw Materials Requisition</h3>
              <form onSubmit={handleCreateRequisition} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Material Name <span className="text-rose-500">*</span></label>
                  <input type="text" value={newMaterial} onChange={e => setNewMaterial(e.target.value)} required placeholder="E.g., Raw Polymer Granules" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Quantity Required <span className="text-rose-500">*</span></label>
                  <input type="number" value={newQty} onChange={e => setNewQty(e.target.value)} required placeholder="E.g., 5000" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                  Submission timestamp will be auto-generated: <strong>{new Date().toLocaleString()}</strong>
                </div>
                <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer">Submit to Management</button>
              </form>
            </div>

            {/* Approved requisitions — ready to issue */}
            <div className="p-6 app-card space-y-4">
              <h3 className="text-lg font-bold">Approved — Issue Goods Tickets</h3>
              <div className="space-y-3">
                {productionRequests.filter(r => r.status === 'APPROVED').map(req => (
                  <div key={req.id} className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">{req.id}</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold">APPROVED</span>
                    </div>
                    <div className="text-[10px] text-slate-600 space-y-0.5">
                      {req.items.map((item, idx) => (
                        <p key={idx}>{item.materialName}: <strong>{item.quantity.toLocaleString()} units</strong></p>
                      ))}
                      <p>Date: {req.createdAt || 'N/A'}</p>
                    </div>
                    <button onClick={() => handleIssueTicket(req.id)} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer">Issue Goods Ticket</button>
                  </div>
                ))}
                {productionRequests.filter(r => r.status === 'APPROVED').length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">No approved requisitions pending ticket issuance.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* RAW MATERIALS */}
        {activeSubTab === 'RawMaterials' && (
          <div className="p-6 app-card space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-bold">Raw Materials Requested</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3">Req. ID</th>
                    <th className="py-2.5 px-3">Material Name</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productionRequests.flatMap(req => req.items.map((item, idx) => (
                    <tr key={`${req.id}-${idx}`} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{req.id}</td>
                      <td className="py-2.5 px-3 font-medium">{item.materialName}</td>
                      <td className="py-2.5 px-3 text-right font-bold">{item.quantity.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColor(req.status)}`}>{req.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">{req.createdAt || 'N/A'}</td>
                    </tr>
                  )))}
                  {productionRequests.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-400">No raw material requests logged.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WIP & STOCK INVENTORY */}
        {activeSubTab === 'WIPStock' && (
          <div className="p-6 app-card space-y-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold">Work in Progress & Stock Inventory</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3">Item ID</th>
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Production Stage</th>
                    <th className="py-2.5 px-3 text-right">Qty (Units)</th>
                    <th className="py-2.5 px-3">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {wipStock.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{item.id}</td>
                      <td className="py-2.5 px-3 font-medium">{item.productName}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${item.stage === 'Awaiting Dispatch' ? 'bg-emerald-100 text-emerald-800' : item.stage === 'Quality Check' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>{item.stage}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">{item.qty.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">{item.updatedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ORDERS HISTORY */}
        {activeSubTab === 'OrdersHistory' && (
          <div className="p-6 app-card space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold">Production Requisitions History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3">Req. ID</th>
                    <th className="py-2.5 px-3">Materials</th>
                    <th className="py-2.5 px-3 text-right">Total Units</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...productionRequests].reverse().map(req => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{req.id}</td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {req.items.map((i, idx) => <span key={idx} className="mr-2">{i.materialName} ({i.quantity})</span>)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">{req.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColor(req.status)}`}>{req.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">{req.createdAt || 'N/A'}</td>
                    </tr>
                  ))}
                  {productionRequests.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-400">No production history yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
