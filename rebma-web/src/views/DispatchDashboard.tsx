// rebma-web/src/views/DispatchDashboard.tsx

import { useState, useEffect } from 'react';
import { FileSpreadsheet, FileText, Truck, ShieldCheck, Activity, Users, MapPin, History, UserCheck, ChevronRight, MoreVertical, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import MiniSparkline from '../components/MiniSparkline';
import KpiDetailView from '../components/KpiDetailView';
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


const handleSort = (
  field: string,
  currentField: string,
  setField: (f: string) => void,
  currentDir: 'asc' | 'desc',
  setDir: (d: 'asc' | 'desc') => void
) => {
  if (currentField === field) {
    setDir(currentDir === 'asc' ? 'desc' : 'asc');
  } else {
    setField(field);
    setDir('asc');
  }
};

export default function DispatchDashboard({
  activeCoordinates,
  deliveryStatus,
  handleMarkDelivered,
  activeSubTab = 'Deliveries'
}: DispatchDashboardProps) {

  // Local deliveries state to support adding/duplicating/deleting rows
  const [kpiDetail, setKpiDetail] = useState<number | null>(null);
  const [cardMenuOpen, setCardMenuOpen] = useState<number | null>(null);
  const [localDeliveries, setLocalDeliveries] = useState<DeliveryRecord[]>([]);
  const [localDrivers, setLocalDrivers] = useState<Driver[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(true);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [activeMobileDetail, setActiveMobileDetail] = useState<DeliveryRecord | null>(null);

  // Sorting states
  const [delSortField, setDelSortField] = useState<string>('');
  const [delSortDir, setDelSortDir] = useState<'asc' | 'desc'>('asc');

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

  // Load deliveries and drivers from Supabase
  useEffect(() => {
    (async () => {
      try { const { data } = await supabase.from('deliveries').select('*').order('created_at', { ascending: false }); setLocalDeliveries(data ?? []); } catch { setLocalDeliveries([]); } finally { setLoadingDeliveries(false); }
    })();
    (async () => {
      try { const { data } = await supabase.from('drivers').select('*').order('created_at', { ascending: false }); setLocalDrivers(data ?? []); } catch { setLocalDrivers([]); } finally { setLoadingDrivers(false); }
    })();
  }, []);

  const lineChartData = [
    { name: 'Mon', Shipments: 12, Delays: 0 },
    { name: 'Tue', Shipments: 18, Delays: 1 },
    { name: 'Wed', Shipments: 15, Delays: 0 },
    { name: 'Thu', Shipments: 22, Delays: 2 },
    { name: 'Fri', Shipments: 30, Delays: 0 },
  ];

  const activeDrivers = localDrivers.filter(d => d.status !== 'OFFLINE').length;
  const completedDeliveries = localDeliveries.filter(d => d.status === 'DELIVERED').length;
  const inTransit = localDeliveries.filter(d => d.status === 'IN_TRANSIT').length;

  const stats = [
    { title: 'Active Routes', value: `${inTransit} Live Route${inTransit !== 1 ? 's' : ''}`, sub: 'GPS coordinates streaming', icon: Truck, color: 'text-blue-500' },
    { title: 'Completed Shipments', value: `${completedDeliveries} Done`, sub: 'Successfully dispatched', icon: ShieldCheck, color: 'text-emerald-500' },
    { title: 'On-Time Dispatch Rate', value: '96.8%', sub: 'Target threshold met', icon: Activity, color: 'text-indigo-500' },
    { title: 'Drivers Active', value: `${activeDrivers} Online`, sub: 'Active terminal sessions', icon: Users, color: 'text-amber-500' }
  ];

  const kpiDetails = [
    { title: 'Active Routes', metric: 'Live', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'In Transit',value:8}, {name:'Loading',value:3}, {name:'Idle',value:1}], tableData: [{id:'RT-01', driver:'Kwame Asante', dest:'Kumasi', eta:'2h'}, {id:'RT-02', driver:'Ama Boateng', dest:'Accra', eta:'45m'}], columns: [{key:'id',label:'Route'}, {key:'driver',label:'Driver'}, {key:'dest',label:'Destination'}, {key:'eta',label:'ETA'}] },
    { title: 'Completed Shipments', metric: 'Done', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'On Time',value:38}, {name:'Late',value:4}, {name:'Partial',value:2}], tableData: [{id:'SHP-01', client:'Kama Industries', date:'Jun 10', status:'On Time'}, {id:'SHP-02', client:'Prime Suppliers', date:'Jun 9', status:'Late'}], columns: [{key:'id',label:'Shipment'}, {key:'client',label:'Client'}, {key:'date',label:'Date'}, {key:'status',label:'Status'}] },
    { title: 'On-Time Dispatch Rate', metric: '%', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'On Time',value:94}, {name:'Delayed',value:4}, {name:'Cancelled',value:2}], tableData: [{week:'Week 1', rate:'97%', delayed:1}, {week:'Week 2', rate:'95%', delayed:2}], columns: [{key:'week',label:'Week'}, {key:'rate',label:'Rate'}, {key:'delayed',label:'Delayed'}] },
    { title: 'Drivers Active', metric: 'Online', trendData: [{name:'Jan',value:42},{name:'Feb',value:58},{name:'Mar',value:51},{name:'Apr',value:73},{name:'May',value:65},{name:'Jun',value:80}], breakdownData: [{name:'On Delivery',value:8}, {name:'Active',value:4}, {name:'Offline',value:3}], tableData: [{name:'Kwame Asante', truck:'TRK-201', status:'On Delivery'}, {name:'Ama Boateng', truck:'TRK-202', status:'Active'}], columns: [{key:'name',label:'Driver'}, {key:'truck',label:'Truck'}, {key:'status',label:'Status'}] }
  ];


  const driverStatusColor = (status: Driver['status']) => {
    if (status === 'ON_DELIVERY') return 'bg-blue-500/10 text-blue-400';
    if (status === 'ACTIVE') return 'bg-emerald-500/10 text-emerald-450';
    return 'bg-slate-500/10 text-slate-450';
  };

  // Row Action Handlers
  const handleEditDelivery = async (del: DeliveryRecord) => {
    const newClient = await prompt('Edit client name:', del.clientName);
    if (!newClient) return;
    const newDest = await prompt('Edit destination:', del.destination);
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

  const handleDeleteDelivery = async (id: string) => {
    if (!await confirm(`Delete shipment log entry ${id}?`)) return;
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

  // Sorting computed list
  const sortedDeliveries = [...filteredDeliveries].sort((a, b) => {
    if (!delSortField) return 0;
    const aVal = a[delSortField as keyof DeliveryRecord];
    const bVal = b[delSortField as keyof DeliveryRecord];
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return delSortDir === 'asc' ? comp : -comp;
  });

  if (activeMobileDetail) {
    return (
      <div className="lg:hidden bg-bg-card min-h-screen p-4 pb-24 space-y-6 animate-fade-in-up text-text-primary">
        {/* Header with Back button */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveMobileDetail(null)}
            className="px-3 py-1.5 bg-bg-card dark:bg-slate-855 border border-[var(--border)] dark:border-slate-800 rounded-full text-xs font-bold text-text-secondary dark:text-slate-350 cursor-pointer shadow-card"
          >
            ← Back
          </button>
          <h2 className="text-sm font-bold">Delivery Details</h2>
        </div>

        <div className="space-y-6">
          <div className="bg-bg-card dark:bg-slate-855 rounded-2xl p-6 shadow-card border border-[var(--border)] dark:border-slate-800 space-y-4 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-405 flex items-center justify-center font-bold text-xl shrink-0">
              <Truck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary dark:text-slate-205">{activeMobileDetail.clientName}</h3>
              <p className="text-xs text-text-muted font-mono mt-0.5">{activeMobileDetail.id}</p>
            </div>
          </div>

          <div className="bg-bg-card dark:bg-slate-855 rounded-2xl p-4 shadow-card border border-[var(--border)] dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            <div className="py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted font-medium">Delivery ID</span>
              <span className="font-semibold text-text-primary dark:text-slate-205 font-mono">{activeMobileDetail.id}</span>
            </div>
            <div className="py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted font-medium">Order ID</span>
              <span className="font-semibold text-text-primary dark:text-slate-205 font-mono">{activeMobileDetail.orderId}</span>
            </div>
            <div className="py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted font-medium">Client Name</span>
              <span className="font-semibold text-text-primary dark:text-slate-205">{activeMobileDetail.clientName}</span>
            </div>
            <div className="py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted font-medium">Destination</span>
              <span className="font-semibold text-text-primary dark:text-slate-205">{activeMobileDetail.destination}</span>
            </div>
            <div className="py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted font-medium">Driver Name</span>
              <span className="font-semibold text-text-primary dark:text-slate-205">{activeMobileDetail.driverName}</span>
            </div>
            <div className="py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted font-medium">Dispatched At</span>
              <span className="font-semibold text-text-primary dark:text-slate-205 font-mono">{activeMobileDetail.dispatchedAt}</span>
            </div>
            <div className="py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted font-medium">Delivered At</span>
              <span className="font-semibold text-text-primary dark:text-slate-205 font-mono">{activeMobileDetail.deliveredAt || '—'}</span>
            </div>
            <div className="py-3 flex justify-between items-center text-xs">
              <span className="text-text-muted font-medium">Status</span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                activeMobileDetail.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-450' :
                activeMobileDetail.status === 'IN_TRANSIT' ? 'bg-blue-500/10 text-blue-450 animate-pulse' :
                'bg-rose-500/10 text-rose-455'
              }`}>{activeMobileDetail.status.replace(/_/g, ' ')}</span>
            </div>
          </div>

          <div className="space-y-3">
            {activeMobileDetail.status === 'IN_TRANSIT' && (
              <button 
                onClick={() => { handleMarkDelivered(activeMobileDetail.id); setActiveMobileDetail(null); }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold text-center cursor-pointer shadow"
              >
                Mark as Delivered
              </button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => { handleEditDelivery(activeMobileDetail); setActiveMobileDetail(null); }}
                className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-[var(--border)] dark:border-slate-800 text-slate-750 dark:text-slate-205 cursor-pointer"
              >
                Edit Log
              </button>
              <button 
                onClick={() => { handleDuplicateDelivery(activeMobileDetail); setActiveMobileDetail(null); }}
                className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-[var(--border)] dark:border-slate-800 text-slate-750 dark:text-slate-205 cursor-pointer"
              >
                Duplicate
              </button>
            </div>
            <button 
              onClick={() => { handleDeleteDelivery(activeMobileDetail.id); setActiveMobileDetail(null); }}
              className="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 rounded-xl text-xs font-bold text-rose-600 text-center cursor-pointer"
            >
              Delete Delivery
            </button>
          </div>
        </div>
      </div>
    );
  }


  if (kpiDetail !== null) {
    const d = kpiDetails[kpiDetail];
    return <KpiDetailView title={d.title} metric={d.metric} trendData={d.trendData} breakdownData={d.breakdownData} tableData={d.tableData} columns={d.columns} onBack={() => setKpiDetail(null)} />;
  }
  return (
    <>
      {/* ══════════════ MOBILE LAYOUT (< lg) ══════════════ */}
      <div className="lg:hidden mobile-only space-y-4 pb-4 mobile-animate-up">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-text-primary tracking-tight">Dispatch Fleet</h1>
            <p className="text-[11px] text-text-muted mt-0.5">Active routes & delivery history</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(localDeliveries, ['id', 'orderId', 'clientName', 'destination', 'driverName', 'status'], 'dispatch_logs')} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card">
              <FileSpreadsheet className="w-4 h-4 text-text-secondary" />
            </button>
            <button onClick={() => exportToPDF('Dispatch Logs', localDeliveries, ['id', 'orderId', 'clientName', 'status'])} className="p-2 bg-bg-card rounded-xl border border-[var(--border)] shadow-card">
              <FileText className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Physical hero card */}
        <div className="mobile-physical-card" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' }}>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Active Routes</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">{inTransit} Live Route{inTransit !== 1 ? 's' : ''}</h2>
              <p className="text-[10px] text-white/70 mt-1">{completedDeliveries} Deliveries Completed</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">96.8% On-Time Rate</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">{activeDrivers} Drivers Active</p>
            </div>
            <div className="mobile-card-circles">
              <div className="mobile-card-circle-1" />
              <div className="mobile-card-circle-2" />
            </div>
          </div>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Completed', value: `${completedDeliveries}`, sub: 'Dispatched', bg: '#f0fdf4', color: '#16a34a', icon: ShieldCheck },
            { label: 'Drivers Online', value: `${activeDrivers}`, sub: 'Active sessions', bg: '#fef3c7', color: '#d97706', icon: Users },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="mobile-stat-card">
                <div className="mobile-stat-icon" style={{ background: s.bg }}>
                  <Icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider">{s.label}</p>
                  <p className="text-sm font-bold text-text-primary mt-0.5">{s.value}</p>
                  <p className="text-[9px] text-text-muted">{s.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Drivers list */}
        <div>
          <p className="mobile-section-label">Drivers</p>
          <div className="space-y-2">
            {localDrivers.map(d => (
              <div key={d.id} className="mobile-data-row">
                <div className="mobile-data-row-icon" style={{ background: d.status === 'ON_DELIVERY' ? '#eff6ff' : d.status === 'ACTIVE' ? '#f0fdf4' : '#f8fafc', color: d.status === 'ON_DELIVERY' ? '#3b82f6' : d.status === 'ACTIVE' ? '#16a34a' : '#94a3b8' }}>
                  {d.fullName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{d.fullName}</p>
                  <p className="text-[10px] text-text-muted truncate">{d.truckId} • {d.totalDeliveries} deliveries</p>
                </div>
                <span className={`mobile-status-pill ${
                  d.status === 'ON_DELIVERY' ? 'bg-blue-50 text-blue-700' : 
                  d.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 
                  'bg-bg-input text-text-secondary'
                }`}>
                  {d.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Deliveries list */}
        <div>
          <p className="mobile-section-label">Delivery Logs</p>
          <div className="space-y-2">
            {sortedDeliveries.map(del => (
              <div key={del.id} onClick={() => setActiveMobileDetail(del)} className="mobile-data-row cursor-pointer">
                <div className="mobile-data-row-icon" style={{ background: del.status === 'DELIVERED' ? '#f0fdf4' : del.status === 'IN_TRANSIT' ? '#eff6ff' : '#fff7ed' }}>
                  <Truck className="w-5 h-5" style={{ color: del.status === 'DELIVERED' ? '#16a34a' : del.status === 'IN_TRANSIT' ? '#3b82f6' : '#d97706' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{del.clientName}</p>
                  <p className="text-[10px] text-text-muted truncate">{del.destination}</p>
                </div>
                <span className={`mobile-status-pill ${
                  del.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' : 
                  del.status === 'IN_TRANSIT' ? 'bg-blue-50 text-blue-700' : 
                  'bg-amber-50 text-amber-700'
                }`}>
                  {del.status === 'IN_TRANSIT' ? 'Transit' : del.status === 'DELIVERED' ? 'Done' : del.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════ DESKTOP LAYOUT (lg+) — UNCHANGED ══════════════ */}
      <div className="hidden lg:block">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[var(--text-primary)]">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">Dispatch Fleet Management</h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] opacity-85">Monitor active deliveries, driver activities, and fleet history.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button onClick={() => exportToCSV(localDeliveries, ['id', 'orderId', 'clientName', 'destination', 'driverName', 'driverId', 'dispatchedAt', 'deliveredAt', 'status'], 'dispatch_logs')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-primary)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Export Logs (CSV)</span>
          </button>
          <button onClick={() => exportToPDF('Dispatch Fleet Logs', localDeliveries, ['id', 'orderId', 'clientName', 'destination', 'driverName', 'dispatchedAt', 'deliveredAt', 'status'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-primary)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-colors">
            <FileText className="w-3.5 h-3.5" /><span>Export Logs (PDF)</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} onClick={() => setKpiDetail(idx)} className="kpi-card group cursor-pointer hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-semibold leading-tight">{card.title}</span>
                <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setCardMenuOpen(cardMenuOpen === idx ? null : idx)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-0.5 rounded hover:bg-[var(--accent-light)]">
                    <MoreVertical className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </button>
                  {cardMenuOpen === idx && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                      <button onClick={() => { setKpiDetail(idx); setCardMenuOpen(null); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">View Details</button>
                      <button onClick={() => { const d = kpiDetails[idx]; exportToCSV(d.tableData, d.columns.map(c => c.key), d.title.replace(/\s/g,'_').toLowerCase()); setCardMenuOpen(null); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Export CSV</button>
                      <button onClick={() => { const d = kpiDetails[idx]; exportToPDF(d.title, d.tableData, d.columns.map(c => c.label)); setCardMenuOpen(null); }} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Export PDF</button>
                      <button onClick={() => setCardMenuOpen(null)} className="px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg text-left">Refresh</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-end justify-between mt-2 gap-2">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-none">{card.value}</h3>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1.5">{card.sub}</p>
                </div>
                <MiniSparkline width={60} height={36} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] text-[var(--text-primary)]">
        <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Dispatch Delivery & Shipments Velocity</h3>
        <p className="text-xs text-[var(--text-secondary)] opacity-80 font-semibold">Weekly active deliveries cleared vs transit delay logs.</p>
        <div className="h-48 md:h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <Line type="monotone" dataKey="Shipments" stroke="var(--accent)" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Delays" stroke="#f43f5e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tab Views */}
      <div className="border-t border-[var(--border)] pt-6">

        {/* ACTIVE DELIVERIES MAP */}
        {activeSubTab === 'Deliveries' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Map */}
            <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4 text-[var(--text-primary)]">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Live Delivery Map — Accra</h3>
              </div>
              <div className="h-[240px] sm:h-72 bg-gradient-to-br from-[var(--bg)] to-[var(--accent-light)] rounded-2xl relative overflow-hidden border border-[var(--border)]">
                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
                
                {/* Road lines simulation */}
                <svg className="absolute inset-0 w-full h-full opacity-20">
                  <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#64748b" strokeWidth="2" strokeDasharray="8,4" />
                  <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#64748b" strokeWidth="2" strokeDasharray="8,4" />
                  <line x1="0" y1="30%" x2="100%" y2="70%" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,4" />
                </svg>

                {/* Location labels */}
                <div className="absolute top-4 left-4 text-[9px] font-bold text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border)] px-2 py-0.5 rounded">Kotoka Intl Airport</div>
                <div className="absolute bottom-10 right-6 text-[9px] font-bold text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border)] px-2 py-0.5 rounded">Tema Harbour</div>
                <div className="absolute bottom-4 left-6 text-[9px] font-bold text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border)] px-2 py-0.5 rounded">Accra Central</div>
                <div className="absolute top-6 right-8 text-[9px] font-bold text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border)] px-2 py-0.5 rounded">Madina</div>

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
                  <div className="bg-[var(--accent)]/30 border-2 border-[var(--accent)] p-3 rounded-full">
                    <div className="w-4 h-4 bg-[var(--accent)] rounded-full border-2 border-white flex items-center justify-center">
                      <Truck className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                </motion.div>

                {/* Info overlay */}
                <div className="absolute bottom-3 left-3 bg-[var(--bg-card)]/95 backdrop-blur px-3 py-2 rounded-xl border border-[var(--border)] text-[10px] text-[var(--text-primary)] space-y-0.5">
                  <p className="font-bold text-[var(--accent)]">🚛 Truck #L-404 — Kofi Acheampong</p>
                  <p className="text-[var(--text-secondary)]">Lat: {activeCoordinates.lat.toFixed(6)}</p>
                  <p className="text-[var(--text-secondary)]">Lng: {activeCoordinates.lng.toFixed(6)}</p>
                  <p>Status: <span className={`font-bold uppercase ${deliveryStatus === 'DELIVERED' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`}>{deliveryStatus}</span></p>
                </div>
              </div>

              {/* Driver panel */}
              <div className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span>Driver: <strong>DRV-404 (Kofi Acheampong)</strong></span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${deliveryStatus === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-550/20 animate-pulse'}`}>{deliveryStatus}</span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] space-y-1">
                  <p>Active Cargo: <strong className="text-[var(--text-primary)]">Order ORD-101 (Inter-Ghana Foods)</strong></p>
                  <p>Destination: <strong className="text-[var(--text-primary)]">Tema Port Depot</strong></p>
                </div>
                {deliveryStatus === 'IN_TRANSIT' && (
                  <button
                    onClick={() => handleMarkDelivered('ORD-101')}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow transition-colors"
                  >Signal Order Received / Delivered</button>
                )}
                {deliveryStatus === 'DELIVERED' && (
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl text-xs text-center font-semibold border border-emerald-500/20">
                    ✅ Delivery Completed. Coordinates saved to logs.
                  </div>
                )}
              </div>
            </div>

            {/* In-transit deliveries list */}
            <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4 text-[var(--text-primary)]">
              <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">In-Transit Orders</h3>
              <div className="space-y-3">
                {localDeliveries.filter(d => d.status === 'IN_TRANSIT').map(del => (
                  <div key={del.id} className="p-4 bg-[var(--accent-light)] border border-[var(--accent)]/20 rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{del.clientName}</span>
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-450 rounded text-[9px] font-bold animate-pulse">IN TRANSIT</span>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] opacity-85 font-mono">Order: <code>{del.orderId}</code> | Del ID: <code>{del.id}</code></p>
                    <p className="text-[10px] text-[var(--text-secondary)]">Destination: <strong>{del.destination}</strong></p>
                    <p className="text-[10px] text-[var(--text-secondary)]">Driver: <strong>{del.driverName}</strong> ({del.driverId})</p>
                    <p className="text-[10px] text-[var(--text-secondary)] opacity-80 font-mono">Dispatched: {del.dispatchedAt}</p>
                  </div>
                ))}
                {localDeliveries.filter(d => d.status === 'IN_TRANSIT').length === 0 && (
                  <p className="text-xs text-[var(--text-secondary)] opacity-85 text-center py-6">No active in-transit deliveries.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DELIVERY HISTORY */}
        {activeSubTab === 'DispatchHistory' && (
          <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)]">
            {/* Toolbar */}
            <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)]">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold">Delivery History Log</h3>
                <span className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-card)] px-2 py-0.5 rounded-full border border-[var(--border)]">{filteredDeliveries.length} logs</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex items-center w-full sm:w-auto">
                  <span className="absolute left-3 text-[var(--text-secondary)] text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search logs…"
                    value={dispatchSearch}
                    onChange={e => setDispatchSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded-lg outline-none text-[var(--text-primary)] focus:border-[var(--accent)] transition w-full sm:w-40"
                  />
                </div>
                {/* Status dropdown */}
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsDispatchFilterOpen(!isDispatchFilterOpen); }}
                    className="flex items-center justify-between sm:justify-start gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)] w-full sm:w-auto"
                  >
                    <span>Status: {dispatchStatusFilter === 'ALL' ? 'All' : dispatchStatusFilter}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {isDispatchFilterOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col">
                      {(['ALL', 'DELIVERED', 'IN_TRANSIT'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => { setDispatchStatusFilter(st); setIsDispatchFilterOpen(false); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)]"
                        >
                          <span className={`w-2 h-2 rounded-full ${st === 'DELIVERED' ? 'bg-emerald-400' : st === 'IN_TRANSIT' ? 'bg-blue-450' : 'bg-text-muted'}`} />
                          {st === 'ALL' ? 'All Logs' : st}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable table */}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="theme-table-header-row text-[var(--text-secondary)] opacity-85 uppercase font-semibold text-[10px] border-b border-[var(--border)] bg-[var(--bg)]">
                    <th className="py-3 px-5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={filteredDeliveries.length > 0 && selectedDispatchRows.size === filteredDeliveries.length}
                        onChange={handleSelectAllDispatch}
                        className="accent-[var(--accent)] w-3.5 h-3.5"
                      />
                    </th>
                    <th onClick={() => handleSort('id', delSortField, setDelSortField, delSortDir, setDelSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Delivery ID</span>
                        <span className="text-[9px] opacity-70">{delSortField === 'id' ? (delSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('orderId', delSortField, setDelSortField, delSortDir, setDelSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Order ID</span>
                        <span className="text-[9px] opacity-70">{delSortField === 'orderId' ? (delSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('clientName', delSortField, setDelSortField, delSortDir, setDelSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Client</span>
                        <span className="text-[9px] opacity-70">{delSortField === 'clientName' ? (delSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('destination', delSortField, setDelSortField, delSortDir, setDelSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Destination</span>
                        <span className="text-[9px] opacity-70">{delSortField === 'destination' ? (delSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('driverName', delSortField, setDelSortField, delSortDir, setDelSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Driver</span>
                        <span className="text-[9px] opacity-70">{delSortField === 'driverName' ? (delSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('dispatchedAt', delSortField, setDelSortField, delSortDir, setDelSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <span>Dispatched</span>
                        <span className="text-[9px] opacity-70">{delSortField === 'dispatchedAt' ? (delSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('deliveredAt', delSortField, setDelSortField, delSortDir, setDelSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <span>Delivered</span>
                        <span className="text-[9px] opacity-70">{delSortField === 'deliveredAt' ? (delSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('status', delSortField, setDelSortField, delSortDir, setDelSortDir)} className="py-3 px-3 text-center whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center justify-center gap-1">
                        <span>Status</span>
                        <span className="text-[9px] opacity-70">{delSortField === 'status' ? (delSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                  {loadingDeliveries && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skel-${i}`}>
                      <td colSpan={10} className="py-3 px-5">
                        <div className="animate-pulse h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                      </td>
                    </tr>
                  ))}
                  {!loadingDeliveries && sortedDeliveries.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                          <Truck className="w-8 h-8 opacity-30" />
                          <p className="text-xs">No delivery logs found.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!loadingDeliveries && sortedDeliveries.map(del => (
                    <tr key={del.id} className="theme-table-row border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors text-[var(--text-primary)] cursor-pointer" onClick={() => setActiveMobileDetail(del)}>
                      <td className="py-3.5 px-5">
                        <input
                          type="checkbox"
                          checked={selectedDispatchRows.has(del.id)}
                          onChange={() => handleSelectDispatchRow(del.id)}
                          className="accent-[var(--accent)] w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-[var(--accent)]">{del.id}</td>
                      <td className="py-3.5 px-3 font-mono text-[var(--text-secondary)] opacity-85">{del.orderId}</td>
                      <td className="py-3.5 px-3 font-semibold text-sm text-[var(--text-primary)]">{del.clientName}</td>
                      <td className="py-3.5 px-3 text-[var(--text-secondary)]">{del.destination}</td>
                      <td className="py-3.5 px-3 text-[var(--text-secondary)] font-medium">{del.driverName}</td>
                      <td className="py-3.5 px-3 text-[var(--text-secondary)] opacity-85 font-mono text-[10px] hidden sm:table-cell">{del.dispatchedAt}</td>
                      <td className="py-3.5 px-3 text-[var(--text-secondary)] opacity-85 font-mono text-[10px] hidden sm:table-cell">{del.deliveredAt || '—'}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          del.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-400' :
                          del.status === 'IN_TRANSIT' ? 'bg-blue-500/10 text-blue-450 animate-pulse' :
                          'bg-rose-500/10 text-rose-400'
                        }`}>{del.status.replace('_', ' ')}</span>
                      </td>
                      <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveDispatchMenu(activeDispatchMenu === del.id ? null : del.id)}
                          className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors border border-[var(--border)] select-none cursor-pointer"
                        >
                          ···
                        </button>
                        {activeDispatchMenu === del.id && (
                          <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                            <button onClick={() => handleEditDelivery(del)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">✏ Edit Log</button>
                            <button onClick={() => handleDuplicateDelivery(del)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">📋 Duplicate</button>
                            <button onClick={() => handleShareDelivery(del)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">🔗 Share Link</button>
                            <div className="h-px bg-[var(--border)] my-1"></div>
                            <button onClick={() => handleDeleteDelivery(del.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left cursor-pointer">🗑 Delete Log</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)]">
              <p className="text-xs text-[var(--text-secondary)] font-mono">Showing {filteredDeliveries.length} of {localDeliveries.length} log records</p>
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30 cursor-pointer" disabled>‹</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30 cursor-pointer" disabled>›</button>
              </div>
            </div>
          </div>
        )}

        {/* DRIVER LOGS / DETAILS */}
        {activeSubTab === 'DriverLogs' && (
          <div className="p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4 text-[var(--text-primary)]">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Driver Activities & Details</h3>
            </div>
            {loadingDrivers && (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse h-4 bg-slate-200 dark:bg-slate-700 rounded" />
                ))}
              </div>
            )}
            {!loadingDrivers && localDrivers.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-[var(--text-muted)]">
                <UserCheck className="w-8 h-8 opacity-30" />
                <p className="text-sm">No drivers registered yet.</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!loadingDrivers && localDrivers.map(driver => (
                <div key={driver.id} className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">{driver.fullName}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] font-mono">ID: <code className="bg-[var(--bg-card)] px-1 rounded border border-[var(--border)] text-[var(--text-primary)]">{driver.id}</code></p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${driverStatusColor(driver.status)}`}>{driver.status.replace('_', ' ')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--text-secondary)]">
                    <div><span className="text-[var(--text-secondary)]">Phone:</span> <span className="text-[var(--text-primary)]">{driver.phone}</span></div>
                    <div><span className="text-[var(--text-secondary)]">Truck:</span> <strong className="text-[var(--text-primary)]">{driver.truckId}</strong></div>
                    <div><span className="text-[var(--text-secondary)]">License:</span> <code className="text-[var(--text-primary)]">{driver.licenseNumber}</code></div>
                    <div><span className="text-[var(--text-secondary)]">Deliveries:</span> <strong className="text-[var(--text-primary)]">{driver.totalDeliveries}</strong></div>
                    <div className="col-span-2"><span className="text-[var(--text-secondary)]">Ghana Card:</span> <code className="bg-[var(--bg-card)] px-1 rounded border border-[var(--border)] text-[var(--text-primary)]">{driver.ghanaCard}</code></div>
                    <div><span className="text-[var(--text-secondary)]">Joined:</span> <span className="text-[var(--text-primary)]">{driver.joinedAt}</span></div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => exportToCSV(localDrivers, ['id', 'fullName', 'phone', 'ghanaCard', 'licenseNumber', 'truckId', 'status', 'totalDeliveries', 'joinedAt'], 'drivers_roster')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-primary)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-colors w-full sm:w-auto justify-center">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export Drivers Roster (CSV)
            </button>
          </div>
        )}
      </div>
      </div>
      </div>
    </>
  );
}
