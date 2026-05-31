// rebma-web/src/views/DispatchDashboard.tsx

import { useState, useEffect } from 'react';
import { FileSpreadsheet, FileText, Truck, ShieldCheck, Activity, Users, MapPin, History, UserCheck } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/export';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import type { Driver, DeliveryRecord } from '../types/erp';

interface DispatchDashboardProps {
  activeCoordinates: { lat: number; lng: number };
  deliveryStatus: string;
  handleMarkDelivered: (id: string) => void;
  activeSubTab: string;
}

// Seed Drivers
const seedDrivers: Driver[] = [
  { id: 'DRV-404', fullName: 'Kofi Acheampong', phone: '+233 24 111 2233', ghanaCard: 'GHA-4040404-4', licenseNumber: 'GH-DL-2024-0404', truckId: 'GR-1234-22', status: 'ON_DELIVERY', totalDeliveries: 87, joinedAt: 'Jan 2023' },
  { id: 'DRV-405', fullName: 'Yaw Darko', phone: '+233 20 555 6677', ghanaCard: 'GHA-5050505-5', licenseNumber: 'GH-DL-2024-0405', truckId: 'GR-5678-22', status: 'ACTIVE', totalDeliveries: 62, joinedAt: 'Mar 2023' },
  { id: 'DRV-406', fullName: 'Kwame Asare', phone: '+233 27 888 9900', ghanaCard: 'GHA-6060606-6', licenseNumber: 'GH-DL-2024-0406', truckId: 'GR-9012-21', status: 'OFFLINE', totalDeliveries: 45, joinedAt: 'Jul 2023' },
  { id: 'DRV-407', fullName: 'Emmanuel Tetteh', phone: '+233 23 222 3344', ghanaCard: 'GHA-7070707-7', licenseNumber: 'GH-DL-2024-0407', truckId: 'GR-3456-23', status: 'ACTIVE', totalDeliveries: 31, joinedAt: 'Dec 2023' },
];

// Seed Delivery History
const seedDeliveries: DeliveryRecord[] = [
  { id: 'DEL-001', orderId: 'ORD-102', clientName: 'Accra Retail Hub', destination: 'Accra Central Depot', driverName: 'Kofi Acheampong', driverId: 'DRV-404', dispatchedAt: '2026-05-24 08:00', deliveredAt: '2026-05-24 11:30', status: 'DELIVERED' },
  { id: 'DEL-002', orderId: 'ORD-098', clientName: 'Kumasi Foods Ltd', destination: 'Kumasi Warehouse', driverName: 'Yaw Darko', driverId: 'DRV-405', dispatchedAt: '2026-05-23 09:15', deliveredAt: '2026-05-23 14:00', status: 'DELIVERED' },
  { id: 'DEL-003', orderId: 'ORD-101', clientName: 'Inter-Ghana Foods Ltd', destination: 'Tema Port Depot', driverName: 'Kofi Acheampong', driverId: 'DRV-404', dispatchedAt: '2026-05-25 07:30', status: 'IN_TRANSIT' },
];

export default function DispatchDashboard({
  activeCoordinates,
  deliveryStatus,
  handleMarkDelivered,
  activeSubTab = 'Deliveries'
}: DispatchDashboardProps) {

  // Local deliveries state to support adding/duplicating/deleting rows
  const [localDeliveries, setLocalDeliveries] = useState<DeliveryRecord[]>(seedDeliveries);

  // Table interactive states: Delivery History Log
  const [dispatchSearch, setDispatchSearch] = useState('');
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState('ALL');
  const [isDispatchFilterOpen, setIsDispatchFilterOpen] = useState(false);
  const [selectedDispatchRows, setSelectedDispatchRows] = useState<Set<string>>(new Set());
  const [activeDispatchMenu, setActiveDispatchMenu] = useState<string | null>(null);

  // Click outside to close menus
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDispatchMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const lineChartData = [
    { name: 'Mon', Shipments: 12, Delays: 0 },
    { name: 'Tue', Shipments: 18, Delays: 1 },
    { name: 'Wed', Shipments: 15, Delays: 0 },
    { name: 'Thu', Shipments: 22, Delays: 2 },
    { name: 'Fri', Shipments: 30, Delays: 0 },
  ];

  const activeDrivers = seedDrivers.filter(d => d.status !== 'OFFLINE').length;
  const completedDeliveries = localDeliveries.filter(d => d.status === 'DELIVERED').length;
  const inTransit = localDeliveries.filter(d => d.status === 'IN_TRANSIT').length;

  const stats = [
    { title: 'Active Routes', value: `${inTransit} Live Route${inTransit !== 1 ? 's' : ''}`, sub: 'GPS coordinates streaming', icon: Truck, color: 'text-blue-500' },
    { title: 'Completed Shipments', value: `${completedDeliveries} Done`, sub: 'Successfully dispatched', icon: ShieldCheck, color: 'text-emerald-500' },
    { title: 'On-Time Dispatch Rate', value: '96.8%', sub: 'Target threshold met', icon: Activity, color: 'text-indigo-500' },
    { title: 'Drivers Active', value: `${activeDrivers} Online`, sub: 'Active terminal sessions', icon: Users, color: 'text-amber-500' }
  ];

  const driverStatusColor = (status: Driver['status']) => {
    if (status === 'ON_DELIVERY') return 'bg-blue-500/10 text-blue-400';
    if (status === 'ACTIVE') return 'bg-emerald-500/10 text-emerald-450';
    return 'bg-slate-500/10 text-slate-450';
  };

  // Row Action Handlers
  const handleEditDelivery = (del: DeliveryRecord) => {
    const newClient = prompt('Edit client name:', del.clientName);
    if (!newClient) return;
    const newDest = prompt('Edit destination:', del.destination);
    if (!newDest) return;
    setLocalDeliveries(prev => prev.map(d => d.id === del.id ? { ...d, clientName: newClient, destination: newDest } : d));
  };

  const handleDuplicateDelivery = (del: DeliveryRecord) => {
    const duplicated: DeliveryRecord = {
      ...del,
      id: `DEL-${Math.floor(100 + Math.random() * 900)}`,
      dispatchedAt: new Date().toLocaleString()
    };
    setLocalDeliveries(prev => [duplicated, ...prev]);
  };

  const handleShareDelivery = (del: DeliveryRecord) => {
    const shareText = `Rebma Shipment details: ID: ${del.id} - Order: ${del.orderId} - Driver: ${del.driverName} - Dest: ${del.destination}`;
    navigator.clipboard.writeText(shareText).then(() => {
      alert('Copied delivery info link to clipboard!');
    }).catch(() => alert(shareText));
  };

  const handleDeleteDelivery = (id: string) => {
    if (!confirm(`Delete shipment log entry ${id}?`)) return;
    setLocalDeliveries(prev => prev.filter(d => d.id !== id));
  };

  // Row selection checkboxes
  const handleSelectAllDispatch = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedDispatchRows(new Set(filteredDeliveries.map(d => d.id)));
    } else {
      setSelectedDispatchRows(new Set());
    }
  };

  const handleSelectDispatchRow = (id: string) => {
    const updated = new Set(selectedDispatchRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedDispatchRows(updated);
  };

  // Filter List
  const filteredDeliveries = localDeliveries.filter(d => {
    const matchesSearch = d.clientName.toLowerCase().includes(dispatchSearch.toLowerCase()) ||
                          d.driverName.toLowerCase().includes(dispatchSearch.toLowerCase()) ||
                          d.id.toLowerCase().includes(dispatchSearch.toLowerCase()) ||
                          d.orderId.toLowerCase().includes(dispatchSearch.toLowerCase());
    const matchesStatus = dispatchStatusFilter === 'ALL' || d.status === dispatchStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dispatch Fleet Management</h1>
          <p className="text-sm text-muted">Monitor active deliveries, driver activities, and fleet history.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(localDeliveries, ['id', 'orderId', 'clientName', 'destination', 'driverName', 'driverId', 'dispatchedAt', 'deliveredAt', 'status'], 'dispatch_logs')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Export Logs (CSV)</span>
          </button>
          <button onClick={() => exportToPDF('Dispatch Fleet Logs', localDeliveries, ['id', 'orderId', 'clientName', 'destination', 'driverName', 'dispatchedAt', 'deliveredAt', 'status'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors">
            <FileText className="w-3.5 h-3.5" /><span>Export Logs (PDF)</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="p-6 app-card flex items-center justify-between hover:scale-102 transition-all duration-300">
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
        <h3 className="text-lg font-bold">Dispatch Delivery & Shipments Velocity</h3>
        <p className="text-xs text-muted">Weekly active deliveries cleared vs transit delay logs.</p>
        <div className="h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="Shipments" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Delays" stroke="#f43f5e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tab Views */}
      <div className="border-t border-custom pt-6">

        {/* ACTIVE DELIVERIES MAP */}
        {activeSubTab === 'Deliveries' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Map */}
            <div className="p-6 app-card space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-bold">Live Delivery Map — Accra</h3>
              </div>
              <div className="h-72 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-2xl relative overflow-hidden border border-custom">
                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
                
                {/* Road lines simulation */}
                <svg className="absolute inset-0 w-full h-full opacity-20">
                  <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#64748b" strokeWidth="2" strokeDasharray="8,4" />
                  <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#64748b" strokeWidth="2" strokeDasharray="8,4" />
                  <line x1="0" y1="30%" x2="100%" y2="70%" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,4" />
                </svg>

                {/* Location labels */}
                <div className="absolute top-4 left-4 text-[9px] font-bold text-slate-500 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-custom">Kotoka Intl Airport</div>
                <div className="absolute bottom-10 right-6 text-[9px] font-bold text-slate-500 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-custom">Tema Harbour</div>
                <div className="absolute bottom-4 left-6 text-[9px] font-bold text-slate-500 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-custom">Accra Central</div>
                <div className="absolute top-6 right-8 text-[9px] font-bold text-slate-500 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-custom">Madina</div>

                {/* Animated truck marker */}
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute z-10"
                  style={{
                    left: `${Math.max(10, Math.min(85, 45 + (activeCoordinates.lat - 5.6037) * 2000))}%`,
                    top: `${Math.max(10, Math.min(80, 50 + (activeCoordinates.lng + 0.187) * 2000))}%`
                  }}
                >
                  <div className="bg-blue-500/30 border-2 border-blue-500 p-3 rounded-full">
                    <div className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center">
                      <Truck className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                </motion.div>

                {/* Info overlay */}
                <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur px-3 py-2 rounded-xl border border-slate-700 text-[10px] text-white space-y-0.5">
                  <p className="font-bold text-blue-400">🚛 Truck #L-404 — Kofi Acheampong</p>
                  <p>Lat: {activeCoordinates.lat.toFixed(6)}</p>
                  <p>Lng: {activeCoordinates.lng.toFixed(6)}</p>
                  <p>Status: <span className={`font-bold uppercase ${deliveryStatus === 'DELIVERED' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`}>{deliveryStatus}</span></p>
                </div>
              </div>

              {/* Driver panel */}
              <div className="p-4 bg-slate-100/50 dark:bg-slate-800/20 border border-custom rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span>Driver: <strong>DRV-404 (Kofi Acheampong)</strong></span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${deliveryStatus === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-450' : 'bg-blue-500/10 text-blue-450 animate-pulse'}`}>{deliveryStatus}</span>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <p>Active Cargo: <strong>Order ORD-101 (Inter-Ghana Foods)</strong></p>
                  <p>Destination: <strong>Tema Port Depot</strong></p>
                </div>
                {deliveryStatus === 'IN_TRANSIT' && (
                  <button
                    onClick={() => handleMarkDelivered('ORD-101')}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow transition-colors"
                  >Signal Order Received / Delivered</button>
                )}
                {deliveryStatus === 'DELIVERED' && (
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl text-xs text-center font-semibold border border-custom">
                    ✅ Delivery Completed. Coordinates saved to logs.
                  </div>
                )}
              </div>
            </div>

            {/* In-transit deliveries list */}
            <div className="p-6 app-card space-y-4">
              <h3 className="text-lg font-bold">In-Transit Orders</h3>
              <div className="space-y-3">
                {localDeliveries.filter(d => d.status === 'IN_TRANSIT').map(del => (
                  <div key={del.id} className="p-4 bg-blue-500/5 border border-blue-500/25 rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold">{del.clientName}</span>
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[9px] font-bold animate-pulse">IN TRANSIT</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Order: <code>{del.orderId}</code> | Del ID: <code>{del.id}</code></p>
                    <p className="text-[10px] text-slate-400">Destination: <strong>{del.destination}</strong></p>
                    <p className="text-[10px] text-slate-400">Driver: <strong>{del.driverName}</strong> ({del.driverId})</p>
                    <p className="text-[10px] text-slate-500 font-mono">Dispatched: {del.dispatchedAt}</p>
                  </div>
                ))}
                {localDeliveries.filter(d => d.status === 'IN_TRANSIT').length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">No active in-transit deliveries.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DELIVERY HISTORY */}
        {activeSubTab === 'DispatchHistory' && (
          <div className="theme-table-wrapper">
            {/* Toolbar */}
            <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold">Delivery History Log</h3>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{filteredDeliveries.length} logs</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-500 text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search logs…"
                    value={dispatchSearch}
                    onChange={e => setDispatchSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none transition w-40"
                  />
                </div>
                {/* Status dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsDispatchFilterOpen(!isDispatchFilterOpen); }}
                    className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors border border-custom"
                  >
                    <span>Status: {dispatchStatusFilter === 'ALL' ? 'All' : dispatchStatusFilter}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {isDispatchFilterOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-20 p-1 flex flex-col">
                      {(['ALL', 'DELIVERED', 'IN_TRANSIT'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => { setDispatchStatusFilter(st); setIsDispatchFilterOpen(false); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors text-[var(--text-primary)]"
                        >
                          <span className={`w-2 h-2 rounded-full ${st === 'DELIVERED' ? 'bg-emerald-400' : st === 'IN_TRANSIT' ? 'bg-blue-450' : 'bg-slate-400'}`} />
                          {st === 'ALL' ? 'All Logs' : st}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="theme-table-header-row text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-3 px-5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={filteredDeliveries.length > 0 && selectedDispatchRows.size === filteredDeliveries.length}
                        onChange={handleSelectAllDispatch}
                        className="accent-blue-600 w-3.5 h-3.5"
                      />
                    </th>
                    <th className="py-3 px-3 whitespace-nowrap">Delivery ID</th>
                    <th className="py-3 px-3 whitespace-nowrap">Order ID</th>
                    <th className="py-3 px-3 whitespace-nowrap">Client</th>
                    <th className="py-3 px-3 whitespace-nowrap">Destination</th>
                    <th className="py-3 px-3 whitespace-nowrap">Driver</th>
                    <th className="py-3 px-3 whitespace-nowrap">Dispatched</th>
                    <th className="py-3 px-3 whitespace-nowrap">Delivered</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-custom">
                  {filteredDeliveries.map(del => (
                    <tr key={del.id} className="theme-table-row group">
                      <td className="py-3.5 px-5">
                        <input
                          type="checkbox"
                          checked={selectedDispatchRows.has(del.id)}
                          onChange={() => handleSelectDispatchRow(del.id)}
                          className="accent-blue-600 w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold">{del.id}</td>
                      <td className="py-3.5 px-3 font-mono text-slate-400">{del.orderId}</td>
                      <td className="py-3.5 px-3 font-semibold text-sm">{del.clientName}</td>
                      <td className="py-3.5 px-3 text-slate-400">{del.destination}</td>
                      <td className="py-3.5 px-3 text-slate-300 font-medium">{del.driverName}</td>
                      <td className="py-3.5 px-3 text-slate-450 font-mono text-[10px]">{del.dispatchedAt}</td>
                      <td className="py-3.5 px-3 text-slate-450 font-mono text-[10px]">{del.deliveredAt || '—'}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          del.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-400' :
                          del.status === 'IN_TRANSIT' ? 'bg-blue-500/10 text-blue-400 animate-pulse' :
                          'bg-rose-500/10 text-rose-400'
                        }`}>{del.status.replace('_', ' ')}</span>
                      </td>
                      <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveDispatchMenu(activeDispatchMenu === del.id ? null : del.id)}
                          className="w-8 h-8 inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-500 dark:text-slate-400 transition-colors select-none"
                        >
                          ···
                        </button>
                        {activeDispatchMenu === del.id && (
                          <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-custom rounded-xl shadow-xl z-30 p-1 flex flex-col">
                            <button onClick={() => handleEditDelivery(del)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">✏ Edit Log</button>
                            <button onClick={() => handleDuplicateDelivery(del)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">📋 Duplicate</button>
                            <button onClick={() => handleShareDelivery(del)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left">🔗 Share Link</button>
                            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                            <button onClick={() => handleDeleteDelivery(del.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left">🗑 Delete Log</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4">
              <p className="text-xs text-slate-400 font-mono">Showing {filteredDeliveries.length} of {localDeliveries.length} log records</p>
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>‹</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-blue-600 rounded-lg font-bold">1</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-slate-400 hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors border border-custom disabled:opacity-30" disabled>›</button>
              </div>
            </div>
          </div>
        )}

        {/* DRIVER LOGS / DETAILS */}
        {activeSubTab === 'DriverLogs' && (
          <div className="p-6 app-card space-y-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-bold">Driver Activities & Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {seedDrivers.map(driver => (
                <div key={driver.id} className="p-4 bg-slate-100/50 dark:bg-slate-800/20 border border-custom rounded-xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold">{driver.fullName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">ID: <code className="bg-white dark:bg-slate-800 px-1 rounded border border-custom">{driver.id}</code></p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${driverStatusColor(driver.status)}`}>{driver.status.replace('_', ' ')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                    <div><span className="text-slate-500">Phone:</span> {driver.phone}</div>
                    <div><span className="text-slate-500">Truck:</span> <strong>{driver.truckId}</strong></div>
                    <div><span className="text-slate-500">License:</span> <code>{driver.licenseNumber}</code></div>
                    <div><span className="text-slate-500">Deliveries:</span> <strong>{driver.totalDeliveries}</strong></div>
                    <div className="col-span-2"><span className="text-slate-500">Ghana Card:</span> <code className="bg-white dark:bg-slate-800 px-1 rounded border border-custom">{driver.ghanaCard}</code></div>
                    <div><span className="text-slate-500">Joined:</span> {driver.joinedAt}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => exportToCSV(seedDrivers, ['id', 'fullName', 'phone', 'ghanaCard', 'licenseNumber', 'truckId', 'status', 'totalDeliveries', 'joinedAt'], 'drivers_roster')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200 transition-colors w-full sm:w-auto justify-center">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export Drivers Roster (CSV)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
