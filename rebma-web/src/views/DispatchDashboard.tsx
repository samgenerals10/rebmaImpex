// rebma-web/src/views/DispatchDashboard.tsx

import React, { useState } from 'react';
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

  const [deliveries] = useState<DeliveryRecord[]>(seedDeliveries);

  const lineChartData = [
    { name: 'Mon', Shipments: 12, Delays: 0 },
    { name: 'Tue', Shipments: 18, Delays: 1 },
    { name: 'Wed', Shipments: 15, Delays: 0 },
    { name: 'Thu', Shipments: 22, Delays: 2 },
    { name: 'Fri', Shipments: 30, Delays: 0 },
  ];

  const activeDrivers = seedDrivers.filter(d => d.status !== 'OFFLINE').length;
  const completedDeliveries = deliveries.filter(d => d.status === 'DELIVERED').length;
  const inTransit = deliveries.filter(d => d.status === 'IN_TRANSIT').length;

  const stats = [
    { title: 'Active Routes', value: `${inTransit} Live Route${inTransit !== 1 ? 's' : ''}`, sub: 'GPS coordinates streaming', icon: Truck, color: 'text-blue-500' },
    { title: 'Completed Shipments', value: `${completedDeliveries} Done`, sub: 'Successfully dispatched', icon: ShieldCheck, color: 'text-emerald-500' },
    { title: 'On-Time Dispatch Rate', value: '96.8%', sub: 'Target threshold met', icon: Activity, color: 'text-indigo-500' },
    { title: 'Drivers Active', value: `${activeDrivers} Online`, sub: 'Active terminal sessions', icon: Users, color: 'text-amber-500' }
  ];

  const driverStatusColor = (status: Driver['status']) => {
    if (status === 'ON_DELIVERY') return 'bg-blue-100 text-blue-800';
    if (status === 'ACTIVE') return 'bg-emerald-100 text-emerald-800';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dispatch Fleet Management</h1>
          <p className="text-sm text-slate-500 text-muted">Monitor active deliveries, driver activities, and fleet history.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(deliveries, ['id', 'orderId', 'clientName', 'destination', 'driverName', 'driverId', 'dispatchedAt', 'deliveredAt', 'status'], 'dispatch_logs')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Export Logs (CSV)</span>
          </button>
          <button onClick={() => exportToPDF('Dispatch Fleet Logs', deliveries, ['id', 'orderId', 'clientName', 'destination', 'driverName', 'dispatchedAt', 'deliveredAt', 'status'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
            <FileText className="w-3.5 h-3.5" /><span>Export Logs (PDF)</span>
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
        <h3 className="text-lg font-bold">Dispatch Delivery & Shipments Velocity</h3>
        <p className="text-xs text-slate-500 text-muted">Weekly active deliveries cleared vs transit delay logs.</p>
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
      <div className="border-t border-slate-100 pt-6">

        {/* ACTIVE DELIVERIES MAP */}
        {activeSubTab === 'Deliveries' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Map */}
            <div className="p-6 app-card space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-bold">Live Delivery Map — Accra</h3>
              </div>
              <div className="h-72 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl relative overflow-hidden border border-slate-200">
                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
                
                {/* Road lines simulation */}
                <svg className="absolute inset-0 w-full h-full opacity-20">
                  <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#64748b" strokeWidth="2" strokeDasharray="8,4" />
                  <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#64748b" strokeWidth="2" strokeDasharray="8,4" />
                  <line x1="0" y1="30%" x2="100%" y2="70%" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,4" />
                </svg>

                {/* Location labels */}
                <div className="absolute top-4 left-4 text-[9px] font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded">Kotoka Intl Airport</div>
                <div className="absolute bottom-10 right-6 text-[9px] font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded">Tema Harbour</div>
                <div className="absolute bottom-4 left-6 text-[9px] font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded">Accra Central</div>
                <div className="absolute top-6 right-8 text-[9px] font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded">Madina</div>

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
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span>Driver: <strong>DRV-404 (Kofi Acheampong)</strong></span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${deliveryStatus === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800 animate-pulse'}`}>{deliveryStatus}</span>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>Active Cargo: <strong>Order ORD-101 (Inter-Ghana Foods)</strong></p>
                  <p>Destination: <strong>Tema Port Depot</strong></p>
                </div>
                {deliveryStatus === 'IN_TRANSIT' && (
                  <button
                    onClick={() => handleMarkDelivered('ORD-101')}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow transition-all"
                  >Signal Order Received / Delivered</button>
                )}
                {deliveryStatus === 'DELIVERED' && (
                  <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl text-xs text-center font-semibold">
                    ✅ Delivery Completed. Coordinates saved to logs.
                  </div>
                )}
              </div>
            </div>

            {/* In-transit deliveries list */}
            <div className="p-6 app-card space-y-4">
              <h3 className="text-lg font-bold">In-Transit Orders</h3>
              <div className="space-y-3">
                {deliveries.filter(d => d.status === 'IN_TRANSIT').map(del => (
                  <div key={del.id} className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">{del.clientName}</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[9px] font-bold animate-pulse">IN TRANSIT</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Order: <code>{del.orderId}</code> | Del ID: <code>{del.id}</code></p>
                    <p className="text-[10px] text-slate-500">Destination: <strong>{del.destination}</strong></p>
                    <p className="text-[10px] text-slate-500">Driver: <strong>{del.driverName}</strong> ({del.driverId})</p>
                    <p className="text-[10px] text-slate-400">Dispatched: {del.dispatchedAt}</p>
                  </div>
                ))}
                {deliveries.filter(d => d.status === 'IN_TRANSIT').length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">No active in-transit deliveries.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DELIVERY HISTORY */}
        {activeSubTab === 'DispatchHistory' && (
          <div className="p-6 app-card space-y-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold">Delivery History Log</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3">Delivery ID</th>
                    <th className="py-2.5 px-3">Order</th>
                    <th className="py-2.5 px-3">Client</th>
                    <th className="py-2.5 px-3">Destination</th>
                    <th className="py-2.5 px-3">Driver</th>
                    <th className="py-2.5 px-3">Dispatched</th>
                    <th className="py-2.5 px-3">Delivered</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...deliveries].reverse().map(del => (
                    <tr key={del.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">{del.id}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{del.orderId}</td>
                      <td className="py-2.5 px-3 font-medium">{del.clientName}</td>
                      <td className="py-2.5 px-3 text-slate-500">{del.destination}</td>
                      <td className="py-2.5 px-3 text-slate-600">{del.driverName}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">{del.dispatchedAt}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">{del.deliveredAt || '—'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${del.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : del.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>{del.status.replace('_', ' ')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <div key={driver.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{driver.fullName}</p>
                      <p className="text-[10px] text-slate-500">ID: <code className="bg-white px-1 rounded border border-slate-100">{driver.id}</code></p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${driverStatusColor(driver.status)}`}>{driver.status.replace('_', ' ')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600">
                    <div><span className="text-slate-400">Phone:</span> {driver.phone}</div>
                    <div><span className="text-slate-400">Truck:</span> <strong>{driver.truckId}</strong></div>
                    <div><span className="text-slate-400">License:</span> <code>{driver.licenseNumber}</code></div>
                    <div><span className="text-slate-400">Deliveries:</span> <strong>{driver.totalDeliveries}</strong></div>
                    <div className="col-span-2"><span className="text-slate-400">Ghana Card:</span> <code className="bg-white px-1 rounded border border-slate-100">{driver.ghanaCard}</code></div>
                    <div><span className="text-slate-400">Joined:</span> {driver.joinedAt}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => exportToCSV(seedDrivers, ['id', 'fullName', 'phone', 'ghanaCard', 'licenseNumber', 'truckId', 'status', 'totalDeliveries', 'joinedAt'], 'drivers_roster')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export Drivers Roster (CSV)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
