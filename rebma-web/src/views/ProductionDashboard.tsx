// rebma-web/src/views/ProductionDashboard.tsx

import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { FileSpreadsheet, FileText, Factory, Layers, ShieldCheck, Activity, History, Package, BarChart2, ChevronRight, Settings } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/export';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { ProductionRequest } from '../types/erp';

interface ProductionDashboardProps {
  productionRequests: ProductionRequest[];
  setProductionRequests: Dispatch<SetStateAction<ProductionRequest[]>>;
  activeSubTab: string;
  addNotification: (msg: string) => void;
}

// WIP Stock seed data
const initialWipStock = [
  { id: 'WIP-001', productName: 'Refined Palm Oil', stage: 'Processing', qty: 250, updatedAt: '2026-05-25 09:00' },
  { id: 'WIP-002', productName: 'Polymer Granules (Grade A)', stage: 'Quality Check', qty: 1200, updatedAt: '2026-05-25 10:30' },
  { id: 'WIP-003', productName: 'Cocoa Butter Blocks', stage: 'Packaging', qty: 80, updatedAt: '2026-05-24 15:00' },
  { id: 'WIP-004', productName: 'Shea Butter Cream', stage: 'Awaiting Dispatch', qty: 340, updatedAt: '2026-05-24 17:00' },
];

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

export default function ProductionDashboard({
  productionRequests,
  setProductionRequests,
  activeSubTab = 'Requisition',
  addNotification
}: ProductionDashboardProps) {

  // Local state for WIP stock and syncing for requests
  const [localWip, setLocalWip] = useState(initialWipStock);
  const [activeMobileDetail, setActiveMobileDetail] = useState<{ type: 'requisition' | 'wip' | 'history'; data: any } | null>(null);
  const [materialsSearch, setMaterialsSearch] = useState('');
  const [materialsStatusFilter, setMaterialsStatusFilter] = useState<string>('ALL');
  const [isMaterialsFilterOpen, setIsMaterialsFilterOpen] = useState(false);
  const [selectedMaterialsRows, setSelectedMaterialsRows] = useState<Set<string>>(new Set());
  const [activeMaterialsMenu, setActiveMaterialsMenu] = useState<string | null>(null);

  const [wipSearch, setWipSearch] = useState('');
  const [wipStageFilter, setWipStageFilter] = useState<string>('ALL');
  const [isWipFilterOpen, setIsWipFilterOpen] = useState(false);
  const [selectedWipRows, setSelectedWipRows] = useState<Set<string>>(new Set());
  const [activeWipMenu, setActiveWipMenu] = useState<string | null>(null);

  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
  const [isHistoryFilterOpen, setIsHistoryFilterOpen] = useState(false);
  const [selectedHistoryRows, setSelectedHistoryRows] = useState<Set<string>>(new Set());
  const [activeHistoryMenu, setActiveHistoryMenu] = useState<string | null>(null);

  // Sorting states for Materials
  const [materialsSortField, setMaterialsSortField] = useState<string>('');
  const [materialsSortDir, setMaterialsSortDir] = useState<'asc' | 'desc'>('asc');

  // Sorting states for WIP
  const [wipSortField, setWipSortField] = useState<string>('');
  const [wipSortDir, setWipSortDir] = useState<'asc' | 'desc'>('asc');

  // Sorting states for History
  const [historySortField, setHistorySortField] = useState<string>('');
  const [historySortDir, setHistorySortDir] = useState<'asc' | 'desc'>('asc');

  const [newMaterial, setNewMaterial] = useState('');
  const [newQty, setNewQty] = useState('');

  // Close menus on click outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMaterialsMenu(null);
      setActiveWipMenu(null);
      setActiveHistoryMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

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
      TICKETS_ISSUED: 'bg-emerald-500/10 text-emerald-400',
      COMPLETED: 'bg-emerald-500/10 text-emerald-400',
      APPROVED: 'bg-blue-500/10 text-blue-400',
      PENDING_MANAGEMENT: 'bg-amber-500/10 text-amber-400',
    };
    return m[status] || 'bg-slate-500/10 text-slate-400';
  };

  // Requisitions (Raw Materials) Actions
  const handleEditRequisition = async (req: ProductionRequest, index: number) => {
    const item = req.items[index];
    const newName = await prompt(`Edit material name:`, item.materialName);
    if (!newName) return;
    const newQtyStr = await prompt(`Edit quantity:`, item.quantity.toString());
    if (!newQtyStr || isNaN(parseInt(newQtyStr))) return;

    setProductionRequests(prev => prev.map(r => {
      if (r.id === req.id) {
        const updatedItems = [...r.items];
        updatedItems[index] = { materialName: newName, quantity: parseInt(newQtyStr) };
        return { ...r, items: updatedItems };
      }
      return r;
    }));
    addNotification(`Updated materials request ${req.id}`);
  };

  const handleDuplicateRequisition = (req: ProductionRequest) => {
    const duplicated: ProductionRequest = {
      ...req,
      id: `PRD-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toLocaleString()
    };
    setProductionRequests(prev => [duplicated, ...prev]);
    addNotification(`Duplicated materials request ${req.id} as ${duplicated.id}`);
  };

  const handleShareRequisition = (req: ProductionRequest) => {
    const shareText = `Rebma Requisition order: ${req.id} - Status: ${req.status} - Materials: ${req.items.map(i => `${i.materialName} (${i.quantity})`).join(', ')}`;
    navigator.clipboard.writeText(shareText).then(() => {
      addNotification(`Copied sharing link for Requisition ${req.id} to clipboard!`);
    }).catch(() => alert(shareText));
  };

  const handleDeleteRequisition = async (id: string) => {
    if (!await confirm(`Are you sure you want to delete Requisition ${id}?`)) return;
    setProductionRequests(prev => prev.filter(r => r.id !== id));
    addNotification(`Deleted Requisition order ${id}`);
  };

  // WIP Inventory Actions
  const handleEditWip = async (item: typeof initialWipStock[0]) => {
    const newName = await prompt('Edit product name:', item.productName);
    if (!newName) return;
    const newQtyStr = await prompt('Edit Qty (Units):', item.qty.toString());
    if (!newQtyStr || isNaN(parseInt(newQtyStr))) return;

    setLocalWip(prev => prev.map(w => w.id === item.id ? { ...w, productName: newName, qty: parseInt(newQtyStr), updatedAt: new Date().toLocaleString() } : w));
    addNotification(`Updated WIP item details for ${item.id}`);
  };

  const handleDuplicateWip = (item: typeof initialWipStock[0]) => {
    const duplicated = {
      ...item,
      id: `WIP-${Math.floor(100 + Math.random() * 900)}`,
      productName: `${item.productName} (Copy)`,
      updatedAt: new Date().toLocaleString()
    };
    setLocalWip(prev => [...prev, duplicated]);
    addNotification(`Duplicated WIP item ${item.id} as ${duplicated.id}`);
  };

  const handleShareWip = (item: typeof initialWipStock[0]) => {
    const shareText = `Rebma WIP Inventory: ${item.productName} (${item.id}) - Stage: ${item.stage} - Qty: ${item.qty}`;
    navigator.clipboard.writeText(shareText).then(() => {
      addNotification(`Copied WIP item details link to clipboard!`);
    }).catch(() => alert(shareText));
  };

  const handleDeleteWip = async (id: string) => {
    if (!await confirm(`Delete WIP stock record ${id}?`)) return;
    setLocalWip(prev => prev.filter(w => w.id !== id));
    addNotification(`Deleted WIP stock record ${id}`);
  };

  const handleAddWip = async () => {
    const name = await prompt('Enter product name:');
    if (!name) return;
    const qty = await prompt('Enter quantity:');
    if (!qty || isNaN(parseInt(qty))) return;
    const stage = await prompt('Enter stage (Processing/Quality Check/Packaging/Awaiting Dispatch):', 'Processing');

    const newItem = {
      id: `WIP-${Math.floor(100 + Math.random() * 900)}`,
      productName: name,
      stage: stage || 'Processing',
      qty: parseInt(qty),
      updatedAt: new Date().toLocaleString()
    };
    setLocalWip(prev => [...prev, newItem]);
    addNotification(`Added new WIP inventory stock item for ${name}`);
  };

  // Requisitions Table Row Checkboxes
  const handleSelectAllMaterials = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedMaterialsRows(new Set(flatRequests.map(r => r.flatId)));
    } else {
      setSelectedMaterialsRows(new Set());
    }
  };

  const handleSelectMaterialsRow = (flatId: string) => {
    const updated = new Set(selectedMaterialsRows);
    if (updated.has(flatId)) {
      updated.delete(flatId);
    } else {
      updated.add(flatId);
    }
    setSelectedMaterialsRows(updated);
  };

  // WIP Table Row Checkboxes
  const handleSelectAllWip = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedWipRows(new Set(filteredWip.map(w => w.id)));
    } else {
      setSelectedWipRows(new Set());
    }
  };

  const handleSelectWipRow = (id: string) => {
    const updated = new Set(selectedWipRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedWipRows(updated);
  };

  // History Checkboxes
  const handleSelectAllHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedHistoryRows(new Set(filteredHistory.map(h => h.id)));
    } else {
      setSelectedHistoryRows(new Set());
    }
  };

  const handleSelectHistoryRow = (id: string) => {
    const updated = new Set(selectedHistoryRows);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedHistoryRows(updated);
  };

  // Pre-mapping flat materials list for search and index tracking
  const flatRequests = productionRequests.flatMap((req) =>
    req.items.map((item, idx) => ({
      flatId: `${req.id}-${idx}`,
      reqId: req.id,
      itemIdx: idx,
      materialName: item.materialName,
      quantity: item.quantity,
      status: req.status,
      createdAt: req.createdAt,
      originalReq: req
    }))
  );

  const filteredMaterials = flatRequests.filter(m => {
    const matchesSearch = m.materialName.toLowerCase().includes(materialsSearch.toLowerCase()) ||
                          m.reqId.toLowerCase().includes(materialsSearch.toLowerCase());
    const matchesStatus = materialsStatusFilter === 'ALL' || m.status === materialsStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredWip = localWip.filter(w => {
    const matchesSearch = w.productName.toLowerCase().includes(wipSearch.toLowerCase()) ||
                          w.id.toLowerCase().includes(wipSearch.toLowerCase());
    const matchesStage = wipStageFilter === 'ALL' || w.stage === wipStageFilter;
    return matchesSearch && matchesStage;
  });

  const filteredHistory = productionRequests.filter(h => {
    const matchesSearch = h.id.toLowerCase().includes(historySearch.toLowerCase()) ||
                          h.items.some(i => i.materialName.toLowerCase().includes(historySearch.toLowerCase()));
    const matchesStatus = historyStatusFilter === 'ALL' || h.status === historyStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedMaterials = [...filteredMaterials].sort((a, b) => {
    if (!materialsSortField) return 0;
    let aVal: any = a[materialsSortField as keyof typeof a];
    let bVal: any = b[materialsSortField as keyof typeof b];
    if (materialsSortField === 'id') {
      aVal = a.reqId;
      bVal = b.reqId;
    }
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return materialsSortDir === 'asc' ? comp : -comp;
  });

  const sortedWip = [...filteredWip].sort((a, b) => {
    if (!wipSortField) return 0;
    const aVal = a[wipSortField as keyof typeof a];
    const bVal = b[wipSortField as keyof typeof b];
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return wipSortDir === 'asc' ? comp : -comp;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    if (!historySortField) return 0;
    let aVal: any;
    let bVal: any;
    if (historySortField === 'id') {
      aVal = a.id;
      bVal = b.id;
    } else if (historySortField === 'createdAt') {
      aVal = a.createdAt || '';
      bVal = b.createdAt || '';
    } else if (historySortField === 'status') {
      aVal = a.status;
      bVal = b.status;
    } else if (historySortField === 'materialName') {
      aVal = a.items[0]?.materialName || '';
      bVal = b.items[0]?.materialName || '';
    } else if (historySortField === 'quantity') {
      aVal = a.items[0]?.quantity || 0;
      bVal = b.items[0]?.quantity || 0;
    }
    if (aVal === undefined || bVal === undefined) return 0;
    const comp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal));
    return historySortDir === 'asc' ? comp : -comp;
  });

  if (activeMobileDetail) {
    return (
      <div className="lg:hidden bg-white min-h-screen p-4 pb-24 space-y-6 animate-fade-in-up text-slate-800">
        {/* Header with Back button */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setActiveMobileDetail(null)}
            className="px-3 py-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-350 cursor-pointer shadow-sm"
          >
            ← Back
          </button>
          <h2 className="text-sm font-bold">Record Details</h2>
        </div>

        {activeMobileDetail.type === 'requisition' ? (() => {
          const m = activeMobileDetail.data; // flattened requisition item
          return (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-855 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xl shrink-0">
                  REQ
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{m.materialName}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{m.flatId}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-855 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Requisition ID</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{m.reqId}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Material Name</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{m.materialName}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Quantity</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{m.quantity.toLocaleString()}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Status</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColor(m.status)}`}>
                    {m.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Created At</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{m.createdAt || 'N/A'}</span>
                </div>
              </div>

              <div className="space-y-3">
                {m.status === 'APPROVED' && (
                  <button 
                    onClick={() => { handleIssueTicket(m.reqId); setActiveMobileDetail(null); }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold text-center cursor-pointer shadow"
                  >
                    Issue Goods Ticket
                  </button>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { handleEditRequisition(m.originalReq, m.itemIdx); setActiveMobileDetail(null); }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
                  >
                    Edit Request
                  </button>
                  <button 
                    onClick={() => { handleDuplicateRequisition(m.originalReq); setActiveMobileDetail(null); }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
                  >
                    Duplicate
                  </button>
                </div>
                <button 
                  onClick={() => { handleDeleteRequisition(m.reqId); setActiveMobileDetail(null); }}
                  className="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 rounded-xl text-xs font-bold text-rose-600 text-center cursor-pointer"
                >
                  Delete Request
                </button>
              </div>
            </div>
          );
        })() : activeMobileDetail.type === 'wip' ? (() => {
          const item = activeMobileDetail.data;
          return (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-white dark:bg-slate-855 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xl shrink-0">
                  WIP
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{item.productName}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{item.id}</p>
                </div>
              </div>

              {/* Fields */}
              <div className="bg-white dark:bg-slate-855 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Item ID</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{item.id}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Product Name</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{item.productName}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Stage</span>
                  <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${
                    item.stage === 'Awaiting Dispatch' ? 'bg-emerald-500/10 text-emerald-400' :
                    item.stage === 'Quality Check' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>{item.stage}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Quantity</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{item.qty.toLocaleString()}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Last Updated</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{item.updatedAt}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { handleEditWip(item); setActiveMobileDetail(null); }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
                  >
                    Edit Item
                  </button>
                  <button 
                    onClick={() => { handleDuplicateWip(item); setActiveMobileDetail(null); }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
                  >
                    Duplicate
                  </button>
                </div>
                <button 
                  onClick={() => { handleDeleteWip(item.id); setActiveMobileDetail(null); }}
                  className="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 rounded-xl text-xs font-bold text-rose-600 text-center cursor-pointer"
                >
                  Delete WIP Item
                </button>
              </div>
            </div>
          );
        })() : (() => {
          const req = activeMobileDetail.data as ProductionRequest;
          return (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-white dark:bg-slate-855 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xl shrink-0">
                  HIS
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">History Log</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{req.id}</p>
                </div>
              </div>

              {/* Fields */}
              <div className="bg-white dark:bg-slate-855 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Requisition ID</span>
                  <span className="font-semibold text-slate-850 dark:text-slate-200 font-mono">{req.id}</span>
                </div>
                <div className="py-3 flex justify-between items-start text-xs">
                  <span className="text-slate-400 font-medium pt-0.5">Materials</span>
                  <div className="flex flex-col items-end gap-1 font-semibold text-slate-800 dark:text-slate-200">
                    {req.items.map((it, idx) => (
                      <span key={idx}>{it.materialName} ({it.quantity})</span>
                    ))}
                  </div>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Total Units</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{req.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()}</span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Status</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColor(req.status)}`}>
                    {req.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="py-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Date</span>
                  <span className="font-semibold text-slate-850 dark:text-slate-200 font-mono">{req.createdAt || 'N/A'}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { handleDuplicateRequisition(req); setActiveMobileDetail(null); }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
                  >
                    Duplicate Order
                  </button>
                  <button 
                    onClick={() => { handleShareRequisition(req); }}
                    className="py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-center border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-200 cursor-pointer"
                  >
                    Share Details
                  </button>
                </div>
                <button 
                  onClick={() => { handleDeleteRequisition(req.id); setActiveMobileDetail(null); }}
                  className="w-full py-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 rounded-xl text-xs font-bold text-rose-600 text-center cursor-pointer"
                >
                  Delete Entry
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <>
      {/* ══ MOBILE LAYOUT (< lg) ══ */}
      <div className="lg:hidden mobile-only space-y-4 pb-4 mobile-animate-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">Production</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Floor control & requisitions</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => exportToCSV(productionRequests, ['id', 'status', 'createdAt'], 'production_requests')} className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm"><FileSpreadsheet className="w-4 h-4 text-slate-500" /></button>
            <button onClick={() => exportToPDF('Production Report', productionRequests, ['id', 'status'])} className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm"><FileText className="w-4 h-4 text-slate-500" /></button>
          </div>
        </div>

        <div className="mobile-physical-card" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)' }}>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Requisition Orders</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">{totalRequests} Requests</h2>
              <p className="text-[10px] text-white/70 mt-1">{approvedCount} Approved • {completedCount} Completed</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">{totalUnits.toLocaleString()} Total Units</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">Production Floor System</p>
            </div>
            <div className="mobile-card-circles"><div className="mobile-card-circle-1" /><div className="mobile-card-circle-2" /></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Approved', value: `${approvedCount}`, sub: 'Management cleared', bg: '#f0fdf4', color: '#16a34a', icon: ShieldCheck },
            { label: 'Completed', value: `${completedCount}`, sub: 'Warehouse issued', bg: '#eef2ff', color: '#6366f1', icon: Factory },
          ].map((s, i) => { const Icon = s.icon; return (
            <div key={i} className="mobile-stat-card">
              <div className="mobile-stat-icon" style={{ background: s.bg }}><Icon className="w-5 h-5" style={{ color: s.color }} /></div>
              <div className="min-w-0">
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">{s.label}</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{s.value}</p>
                <p className="text-[9px] text-slate-400">{s.sub}</p>
              </div>
            </div>
          ); })}
        </div>

        <div>
          <p className="mobile-section-label">Production Requests</p>
          <div className="space-y-2">
            {productionRequests.slice(0, 6).map(req => (
              <div key={req.id} onClick={() => setActiveMobileDetail({ type: 'requisition', data: req })} className="mobile-data-row cursor-pointer">
                <div className="mobile-data-row-icon" style={{ background: req.status === 'APPROVED' ? '#f0fdf4' : req.status === 'COMPLETED' || req.status === 'TICKETS_ISSUED' ? '#eef2ff' : '#fefce8', color: req.status === 'APPROVED' ? '#16a34a' : req.status === 'COMPLETED' || req.status === 'TICKETS_ISSUED' ? '#6366f1' : '#d97706' }}>
                  <Layers className="w-5 h-5" style={{ color: req.status === 'APPROVED' ? '#16a34a' : req.status === 'COMPLETED' || req.status === 'TICKETS_ISSUED' ? '#6366f1' : '#d97706' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{req.id}</p>
                  <p className="text-[10px] text-slate-400 truncate">{req.items.map(i => i.materialName).join(', ')}</p>
                </div>
                <span className={`mobile-status-pill ${
                  req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                  req.status === 'COMPLETED' || req.status === 'TICKETS_ISSUED' ? 'bg-indigo-50 text-indigo-700' :
                  'bg-amber-50 text-amber-700'
                }`}>{req.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* WIP Stock mini list */}
        <div>
          <p className="mobile-section-label">WIP Stock</p>
          <div className="space-y-2">
            {localWip.map(w => (
              <div key={w.id} className="mobile-data-row">
                <div className="mobile-data-row-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                  <Package className="w-5 h-5" style={{ color: '#7c3aed' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{w.productName}</p>
                  <p className="text-[10px] text-slate-400 truncate">{w.stage} • {w.qty} units</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* ══ DESKTOP LAYOUT (lg+) — UNCHANGED ══ */}
      <div className="hidden lg:block">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[var(--text-primary)]">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">Production Floor Control</h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] opacity-85">Manage raw material requisitions, production batches, and WIP stock.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <button onClick={() => exportToCSV(productionRequests, ['id', 'status', 'createdAt'], 'production_requisitions')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-primary)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-colors">
            <FileSpreadsheet className="w-3.5 h-3.5" /><span>Export CSV</span>
          </button>
          <button onClick={() => exportToPDF('Production Requisitions', productionRequests, ['id', 'status', 'createdAt'])} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-primary)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-colors">
            <FileText className="w-3.5 h-3.5" /><span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((card, idx) => {
          const Icon = card.icon;
          const isProminent = idx < 2;
          return (
            <div key={idx} className="p-4 md:p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border-b-[3px] border-[var(--accent)] flex items-center justify-between hover:scale-[1.02] transition-all duration-300 text-[var(--text-primary)]">
              <div>
                <span className="text-xs text-[var(--text-secondary)] uppercase font-semibold">{card.title}</span>
                <h3 className={`font-bold mt-1 text-[var(--text-primary)] ${isProminent ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}`}>{card.value}</h3>
                <p className="text-[10px] text-[var(--text-secondary)] opacity-80 mt-1">{card.sub}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)] shrink-0"><Icon className="w-5 h-5 md:w-6 md:h-6" /></div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] text-[var(--text-primary)]">
        <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Raw Materials Requested vs Goods Produced</h3>
        <p className="text-xs text-[var(--text-secondary)] opacity-80 font-semibold">Weekly production batches requested vs completed output.</p>
        <div className="h-48 md:h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} />
              <YAxis stroke="var(--text-muted)" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              <Bar dataKey="Requested" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Produced" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tab Views */}
      <div className="border-t border-[var(--border)] pt-6">

        {/* REQUISITION FORM */}
        {activeSubTab === 'Requisition' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4 text-[var(--text-primary)]">
              <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Submit Raw Materials Requisition</h3>
              <form onSubmit={handleCreateRequisition} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Material Name <span className="text-rose-500">*</span></label>
                  <input type="text" value={newMaterial} onChange={e => setNewMaterial(e.target.value)} required placeholder="E.g., Raw Polymer Granules" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Quantity Required <span className="text-rose-500">*</span></label>
                  <input type="number" value={newQty} onChange={e => setNewQty(e.target.value)} required placeholder="E.g., 5000" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div className="p-3 bg-[var(--accent-light)] border border-[var(--border)] rounded-xl text-xs text-[var(--accent)] font-semibold">
                  Submission timestamp will be auto-generated: <strong>{new Date().toLocaleString()}</strong>
                </div>
                <button type="submit" className="w-full py-2.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold cursor-pointer transition-opacity shadow">Submit to Management</button>
              </form>
            </div>

            {/* Approved requisitions — ready to issue */}
            <div className="p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] space-y-4 text-[var(--text-primary)]">
              <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Approved — Issue Goods Tickets</h3>
              <div className="space-y-3">
                {productionRequests.filter(r => r.status === 'APPROVED').map(req => (
                  <div key={req.id}>
                    {/* Mobile list card layout */}
                    <div className="lg:hidden mobile-list-card">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                          <Settings className="w-5 h-5 text-[var(--accent-color,#068d5c)]" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-205">{req.id}</p>
                          <div className="text-[10px] text-slate-400 space-y-0.5 mt-0.5">
                            {req.items.map((item, idx) => (
                              <span key={idx} className="mr-1">{item.materialName}: <strong>{item.quantity.toLocaleString()}</strong></span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleIssueTicket(req.id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold" title="Issue Goods Ticket">Issue</button>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>

                    {/* Desktop layout */}
                    <div className="hidden lg:block p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{req.id}</span>
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[9px] font-bold">APPROVED</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)] space-y-0.5">
                        {req.items.map((item, idx) => (
                          <p key={idx}>{item.materialName}: <strong>{item.quantity.toLocaleString()} units</strong></p>
                        ))}
                        <p>Date: {req.createdAt || 'N/A'}</p>
                      </div>
                      <button onClick={() => handleIssueTicket(req.id)} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors">Issue Goods Ticket</button>
                    </div>
                  </div>
                ))}
                {productionRequests.filter(r => r.status === 'APPROVED').length === 0 && (
                  <p className="text-xs text-[var(--text-secondary)] text-center py-6">No approved requisitions pending ticket issuance.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* RAW MATERIALS TABLE */}
        {activeSubTab === 'RawMaterials' && (
          <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)]">
            {/* Toolbar */}
            <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)]">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold">Raw Materials Requested</h3>
                <span className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-card)] px-2 py-0.5 rounded-full border border-[var(--border)]">{filteredMaterials.length} requests</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex items-center w-full sm:w-auto">
                  <span className="absolute left-3 text-[var(--text-secondary)] text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search material…"
                    value={materialsSearch}
                    onChange={e => setMaterialsSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded-lg outline-none text-[var(--text-primary)] focus:border-[var(--accent)] transition w-full sm:w-40"
                  />
                </div>
                {/* Status dropdown */}
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsMaterialsFilterOpen(!isMaterialsFilterOpen); }}
                    className="flex items-center justify-between sm:justify-start gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)] w-full sm:w-auto"
                  >
                    <span>Status: {materialsStatusFilter === 'ALL' ? 'All' : materialsStatusFilter.replace(/_/g, ' ')}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {isMaterialsFilterOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-full sm:w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col">
                      {(['ALL', 'PENDING_MANAGEMENT', 'APPROVED', 'TICKETS_ISSUED'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => { setMaterialsStatusFilter(st); setIsMaterialsFilterOpen(false); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)]"
                        >
                          <span className={`w-2 h-2 rounded-full ${st === 'APPROVED' ? 'bg-blue-400' : st === 'TICKETS_ISSUED' ? 'bg-emerald-400' : st === 'ALL' ? 'bg-slate-400' : 'bg-amber-400'}`} />
                          {st === 'ALL' ? 'All Status' : st.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Mobile Card List */}
            <div className="lg:hidden space-y-3 p-4">
              {filteredMaterials.map(m => (
                <div 
                  key={m.flatId} 
                  onClick={() => setActiveMobileDetail({ type: 'requisition', data: m })}
                  className="bg-white dark:bg-slate-855 rounded-2xl shadow-sm p-4 border border-slate-100 dark:border-slate-805 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-405 flex items-center justify-center font-bold text-sm shrink-0">
                      Req
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-205">{m.materialName}</h4>
                      <p className="text-xs text-slate-400 font-semibold">{m.reqId}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{m.quantity.toLocaleString()} units</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColor(m.status)}`}>
                      {m.status.replace(/_/g, ' ')}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
              {filteredMaterials.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-855 rounded-2xl">No raw materials matched search filters.</div>
              )}
            </div>

            {/* Scrollable table (Desktop only) */}
            <div className="hidden lg:block overflow-x-auto w-full">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="theme-table-header-row text-[var(--text-secondary)] opacity-85 uppercase font-semibold text-[10px] border-b border-[var(--border)] bg-[var(--bg)]">
                    <th className="py-3 px-5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={filteredMaterials.length > 0 && selectedMaterialsRows.size === filteredMaterials.length}
                        onChange={handleSelectAllMaterials}
                        className="accent-[var(--accent)] w-3.5 h-3.5"
                      />
                    </th>
                    <th onClick={() => handleSort('id', materialsSortField, setMaterialsSortField, materialsSortDir, setMaterialsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Req. ID</span>
                        <span className="text-[9px] opacity-70">{materialsSortField === 'id' ? (materialsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('materialName', materialsSortField, setMaterialsSortField, materialsSortDir, setMaterialsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Material Name</span>
                        <span className="text-[9px] opacity-70">{materialsSortField === 'materialName' ? (materialsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('quantity', materialsSortField, setMaterialsSortField, materialsSortDir, setMaterialsSortDir)} className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center justify-end gap-1">
                        <span>Units</span>
                        <span className="text-[9px] opacity-70">{materialsSortField === 'quantity' ? (materialsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('status', materialsSortField, setMaterialsSortField, materialsSortDir, setMaterialsSortDir)} className="py-3 px-3 text-center whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center justify-center gap-1">
                        <span>Status</span>
                        <span className="text-[9px] opacity-70">{materialsSortField === 'status' ? (materialsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('createdAt', materialsSortField, setMaterialsSortField, materialsSortDir, setMaterialsSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <span>Date</span>
                        <span className="text-[9px] opacity-70">{materialsSortField === 'createdAt' ? (materialsSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                  {filteredMaterials.map(m => (
                    <tr key={m.flatId} className="theme-table-row border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors text-[var(--text-primary)]">
                      <td className="py-3.5 px-5">
                        <input
                          type="checkbox"
                          checked={selectedMaterialsRows.has(m.flatId)}
                          onChange={() => handleSelectMaterialsRow(m.flatId)}
                          className="accent-[var(--accent)] w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-[var(--accent)]">{m.reqId}</td>
                      <td className="py-3.5 px-3 font-semibold text-[13px] text-[var(--text-primary)]">{m.materialName}</td>
                      <td className="py-3.5 px-3 text-right font-bold font-mono text-[13px] text-[var(--text-primary)]">{m.quantity.toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColor(m.status)}`}>
                          {m.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-[var(--text-secondary)] opacity-85 font-mono text-[10px] hidden sm:table-cell">{m.createdAt}</td>
                      <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveMaterialsMenu(activeMaterialsMenu === m.flatId ? null : m.flatId)}
                          className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors border border-[var(--border)] select-none cursor-pointer"
                        >
                          ···
                        </button>
                        {activeMaterialsMenu === m.flatId && (
                          <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                            <button onClick={() => handleEditRequisition(m.originalReq, m.itemIdx)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">✏ Edit Request</button>
                            <button onClick={() => handleDuplicateRequisition(m.originalReq)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">📋 Duplicate</button>
                            <button onClick={() => handleShareRequisition(m.originalReq)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">🔗 Share Link</button>
                            <div className="h-px bg-[var(--border)] my-1"></div>
                            <button onClick={() => handleDeleteRequisition(m.reqId)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left cursor-pointer">🗑 Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredMaterials.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-[var(--text-secondary)] opacity-85">No raw materials matched search filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)]">
              <p className="text-xs text-[var(--text-secondary)] font-mono">Showing {filteredMaterials.length} of {flatRequests.length} batches</p>
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30 cursor-pointer" disabled>‹</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30 cursor-pointer" disabled>›</button>
              </div>
            </div>
          </div>
        )}

        {/* WIP STOCK INVENTORY TABLE */}
        {activeSubTab === 'WIPStock' && (
          <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)]">
            {/* Toolbar */}
            <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)]">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold">Work in Progress & Stock Inventory</h3>
                <span className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-card)] px-2 py-0.5 rounded-full border border-[var(--border)]">{filteredWip.length} stock items</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex items-center w-full sm:w-auto">
                  <span className="absolute left-3 text-[var(--text-secondary)] text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search product…"
                    value={wipSearch}
                    onChange={e => setWipSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded-lg outline-none text-[var(--text-primary)] focus:border-[var(--accent)] transition w-full sm:w-40"
                  />
                </div>
                {/* Stage dropdown */}
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsWipFilterOpen(!isWipFilterOpen); }}
                    className="flex items-center justify-between sm:justify-start gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)] w-full sm:w-auto"
                  >
                    <span>Stage: {wipStageFilter === 'ALL' ? 'All' : wipStageFilter}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {isWipFilterOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-full sm:w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col">
                      {(['ALL', 'Processing', 'Quality Check', 'Packaging', 'Awaiting Dispatch'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => { setWipStageFilter(st); setIsWipFilterOpen(false); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)]"
                        >
                          <span className={`w-2 h-2 rounded-full ${st === 'Processing' ? 'bg-blue-400' : st === 'Awaiting Dispatch' ? 'bg-emerald-400' : st === 'ALL' ? 'bg-slate-400' : 'bg-amber-400'}`} />
                          {st === 'ALL' ? 'All Stages' : st}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Add Wip */}
                <button onClick={handleAddWip} className="flex items-center justify-center gap-1 text-xs text-white bg-[var(--accent)] hover:opacity-90 px-3 py-1.5 rounded-lg transition-colors font-bold shadow w-full sm:w-auto cursor-pointer">
                  <span>＋</span> Add Item
                </button>
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
                        checked={filteredWip.length > 0 && selectedWipRows.size === filteredWip.length}
                        onChange={handleSelectAllWip}
                        className="accent-[var(--accent)] w-3.5 h-3.5"
                      />
                    </th>
                    <th onClick={() => handleSort('id', wipSortField, setWipSortField, wipSortDir, setWipSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Item ID</span>
                        <span className="text-[9px] opacity-70">{wipSortField === 'id' ? (wipSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('productName', wipSortField, setWipSortField, wipSortDir, setWipSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Product Name</span>
                        <span className="text-[9px] opacity-70">{wipSortField === 'productName' ? (wipSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('stage', wipSortField, setWipSortField, wipSortDir, setWipSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Production Stage</span>
                        <span className="text-[9px] opacity-70">{wipSortField === 'stage' ? (wipSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('qty', wipSortField, setWipSortField, wipSortDir, setWipSortDir)} className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center justify-end gap-1">
                        <span>Qty (Units)</span>
                        <span className="text-[9px] opacity-70">{wipSortField === 'qty' ? (wipSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('updatedAt', wipSortField, setWipSortField, wipSortDir, setWipSortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <span>Last Updated</span>
                        <span className="text-[9px] opacity-70">{wipSortField === 'updatedAt' ? (wipSortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                  {sortedWip.map(item => (
                    <tr key={item.id} className="theme-table-row border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors text-[var(--text-primary)]">
                      <td className="py-3.5 px-5">
                        <input
                          type="checkbox"
                          checked={selectedWipRows.has(item.id)}
                          onChange={() => handleSelectWipRow(item.id)}
                          className="accent-[var(--accent)] w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-[var(--accent)]">{item.id}</td>
                      <td className="py-3.5 px-3 font-medium text-[13px] text-[var(--text-primary)]">{item.productName}</td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${
                          item.stage === 'Awaiting Dispatch' ? 'bg-emerald-500/10 text-emerald-400' :
                          item.stage === 'Quality Check' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-blue-500/10 text-blue-400'
                        }`}>{item.stage}</span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold font-mono text-[13px] text-[var(--text-primary)]">{item.qty.toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-[var(--text-secondary)] opacity-85 font-mono text-[10px] hidden sm:table-cell">{item.updatedAt}</td>
                      <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveWipMenu(activeWipMenu === item.id ? null : item.id)}
                          className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors border border-[var(--border)] select-none cursor-pointer"
                        >
                          ···
                        </button>
                        {activeWipMenu === item.id && (
                          <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                            <button onClick={() => handleEditWip(item)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">✏ Edit Item</button>
                            <button onClick={() => handleDuplicateWip(item)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">📋 Duplicate</button>
                            <button onClick={() => handleShareWip(item)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">🔗 Share Link</button>
                            <div className="h-px bg-[var(--border)] my-1"></div>
                            <button onClick={() => handleDeleteWip(item.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left cursor-pointer">🗑 Delete</button>
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
              <p className="text-xs text-[var(--text-secondary)] font-mono">Showing {filteredWip.length} of {localWip.length} items</p>
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30 cursor-pointer" disabled>‹</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30 cursor-pointer" disabled>›</button>
              </div>
            </div>
          </div>
        )}

        {/* ORDERS REQUISITION HISTORY TABLE */}
        {activeSubTab === 'OrdersHistory' && (
          <div className="theme-table-wrapper border border-[var(--border)] bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)]">
            {/* Toolbar */}
            <div className="theme-table-toolbar flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg)] text-[var(--text-primary)]">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold">Production Requisitions History</h3>
                <span className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-card)] px-2 py-0.5 rounded-full border border-[var(--border)]">{filteredHistory.length} ledger history entries</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex items-center w-full sm:w-auto">
                  <span className="absolute left-3 text-[var(--text-secondary)] text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    placeholder="Search ledger…"
                    value={historySearch}
                    onChange={e => setHistorySearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-card)] border border-[var(--border)] rounded-lg outline-none text-[var(--text-primary)] focus:border-[var(--accent)] transition w-full sm:w-40"
                  />
                </div>
                {/* Status filter dropdown */}
                <div className="relative w-full sm:w-auto">
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsHistoryFilterOpen(!isHistoryFilterOpen); }}
                    className="flex items-center justify-between sm:justify-start gap-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] px-3 py-1.5 rounded-lg transition-colors border border-[var(--border)] w-full sm:w-auto"
                  >
                    <span>Status: {historyStatusFilter === 'ALL' ? 'All' : historyStatusFilter.replace(/_/g, ' ')}</span>
                    <span className="text-[10px]">▼</span>
                  </button>
                  {isHistoryFilterOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-full sm:w-48 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-20 p-1 flex flex-col">
                      {(['ALL', 'PENDING_MANAGEMENT', 'APPROVED', 'TICKETS_ISSUED'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => { setHistoryStatusFilter(st); setIsHistoryFilterOpen(false); }}
                          className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-[var(--accent-light)] text-left transition-colors text-[var(--text-primary)]"
                        >
                          <span className={`w-2 h-2 rounded-full ${st === 'APPROVED' ? 'bg-blue-400' : st === 'TICKETS_ISSUED' ? 'bg-emerald-400' : st === 'ALL' ? 'bg-slate-400' : 'bg-amber-400'}`} />
                          {st === 'ALL' ? 'All History' : st.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Card List */}
            <div className="lg:hidden space-y-3 p-4">
              {sortedHistory.map(req => (
                <div 
                  key={req.id} 
                  onClick={() => setActiveMobileDetail({ type: 'history', data: req })}
                  className="bg-white dark:bg-slate-855 rounded-2xl shadow-sm p-4 border border-slate-100 dark:border-slate-805 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-455 flex items-center justify-center font-bold text-sm shrink-0">
                      His
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-205">{req.id}</h4>
                      <p className="text-xs text-slate-400 font-semibold truncate max-w-[150px]">
                        {req.items.map(i => i.materialName).join(', ')}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{req.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()} units</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColor(req.status)}`}>
                      {req.status.replace(/_/g, ' ')}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              ))}
              {filteredHistory.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs bg-white dark:bg-slate-855 rounded-2xl">No history records found.</div>
              )}
            </div>

            {/* Scrollable table (Desktop only) */}
            <div className="hidden lg:block overflow-x-auto w-full">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="theme-table-header-row text-[var(--text-secondary)] opacity-85 uppercase font-semibold text-[10px] border-b border-[var(--border)] bg-[var(--bg)]">
                    <th className="py-3 px-5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={filteredHistory.length > 0 && selectedHistoryRows.size === filteredHistory.length}
                        onChange={handleSelectAllHistory}
                        className="accent-[var(--accent)] w-3.5 h-3.5"
                      />
                    </th>
                    <th onClick={() => handleSort('id', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Req. ID</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'id' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('materialName', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center gap-1">
                        <span>Materials</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'materialName' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('quantity', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 text-right whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center justify-end gap-1">
                        <span>Total Units</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'quantity' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('status', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 text-center whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none">
                      <div className="flex items-center justify-center gap-1">
                        <span>Status</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'status' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th onClick={() => handleSort('createdAt', historySortField, setHistorySortField, historySortDir, setHistorySortDir)} className="py-3 px-3 whitespace-nowrap cursor-pointer hover:bg-[var(--accent-light)] transition-colors select-none hidden sm:table-cell">
                      <div className="flex items-center gap-1">
                        <span>Date</span>
                        <span className="text-[9px] opacity-70">{historySortField === 'createdAt' ? (historySortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-5 text-center whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                  {sortedHistory.map(req => (
                    <tr key={req.id} className="theme-table-row border-b border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors text-[var(--text-primary)]">
                      <td className="py-3.5 px-5">
                        <input
                          type="checkbox"
                          checked={selectedHistoryRows.has(req.id)}
                          onChange={() => handleSelectHistoryRow(req.id)}
                          className="accent-[var(--accent)] w-3.5 h-3.5"
                        />
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-[var(--accent)]">{req.id}</td>
                      <td className="py-3.5 px-3 text-[var(--text-secondary)]">
                        {req.items.map((i, idx) => <span key={idx} className="mr-2 font-medium bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] px-1.5 py-0.5 rounded text-[11px]">{i.materialName} ({i.quantity})</span>)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold font-mono text-[13px] text-[var(--text-primary)]">{req.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColor(req.status)}`}>
                          {req.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-[var(--text-secondary)] opacity-85 font-mono text-[10px] hidden sm:table-cell">{req.createdAt || 'N/A'}</td>
                      <td className="py-3.5 px-5 text-center relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveHistoryMenu(activeHistoryMenu === req.id ? null : req.id)}
                          className="w-8 h-8 inline-flex items-center justify-center bg-[var(--bg)] hover:bg-[var(--accent-light)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors border border-[var(--border)] select-none cursor-pointer"
                        >
                          ···
                        </button>
                        {activeHistoryMenu === req.id && (
                          <div className="absolute right-5 mt-1 w-44 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-30 p-1 flex flex-col">
                            <button onClick={() => handleDuplicateRequisition(req)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">📋 Duplicate Order</button>
                            <button onClick={() => handleShareRequisition(req)} className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors text-left cursor-pointer">🔗 Share Details</button>
                            <div className="h-px bg-[var(--border)] my-1"></div>
                            <button onClick={() => handleDeleteRequisition(req.id)} className="flex items-center gap-2 px-3 py-2 text-xs text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-left cursor-pointer">🗑 Delete Entry</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-[var(--text-secondary)] opacity-85">No requisitions history matching criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="theme-table-footer flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)]">
              <p className="text-xs text-[var(--text-secondary)] font-mono">Showing {filteredHistory.length} of {productionRequests.length} logs</p>
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30 cursor-pointer" disabled>‹</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-white bg-[var(--accent)] rounded-lg font-bold">1</button>
                <button className="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--accent-light)] rounded-lg transition-colors border border-[var(--border)] disabled:opacity-30 cursor-pointer" disabled>›</button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
      </div>
    </>
  );
}
