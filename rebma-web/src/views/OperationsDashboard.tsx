// rebma-web/src/views/OperationsDashboard.tsx

import { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Layers, 
  Truck, 
  AlertTriangle, 
  CheckCircle,
  Image as ImageIcon,
  History,
  PackageCheck,
  TicketCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import type { Order, IncomingGoods } from '../types/erp';
import { exportToCSV, exportToPDF } from '../utils/export';

interface OperationsDashboardProps {
  ordersList: Order[];
  incomingGoodsList: IncomingGoods[];
  onLogIntake: (data: Omit<IncomingGoods, 'id' | 'status'>) => void;
  onReleaseToDispatch: (id: string) => void;
  activeSubTab: string;
}

export default function OperationsDashboard({
  ordersList,
  incomingGoodsList,
  onLogIntake,
  onReleaseToDispatch,
  activeSubTab = 'PortIngestion'
}: OperationsDashboardProps) {

  const [imagePreview, setImagePreview] = useState<string>('');
  const [productName, setProductName] = useState('');
  const [goodsCode, setGoodsCode] = useState('');
  const [destination, setDestination] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lineChartData = [
    { name: 'Mon', Ingested: 120, Released: 90 },
    { name: 'Tue', Ingested: 240, Released: 150 },
    { name: 'Wed', Ingested: 180, Released: 160 },
    { name: 'Thu', Ingested: 300, Released: 220 },
    { name: 'Fri', Ingested: 210, Released: 180 },
  ];

  const totalTons = incomingGoodsList.reduce((acc, item) => acc + item.weight, 0);
  const pendingReleaseCount = ordersList.filter(o => o.status === 'PROCESSING').length;
  const pendingMgmtApprovalCount = incomingGoodsList.filter(item => item.status === 'PENDING_MANAGEMENT_APPROVAL').length;
  const discrepancyCount = incomingGoodsList.filter(item => item.discrepancies !== 'None' && item.discrepancies !== '').length;

  const approvedOrders = ordersList.filter(o => ['APPROVED', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status));
  const approvedGoods = incomingGoodsList.filter(i => i.status === 'APPROVED');

  const stats = [
    { title: 'Total Cargo Weight', value: `${totalTons.toFixed(1)} Tons`, sub: 'Accumulated cargo intake', icon: Layers, color: 'text-blue-500' },
    { title: 'Awaiting Release', value: `${pendingReleaseCount} Shipments`, sub: 'Queue ready to load', icon: Truck, color: 'text-emerald-500' },
    { title: 'Awaiting Pricing', value: `${pendingMgmtApprovalCount} Batches`, sub: 'Pending manager approval', icon: CheckCircle, color: 'text-amber-500' },
    { title: 'Discrepancy Notes', value: `${discrepancyCount} Flagged`, sub: 'Faults or damaged boxes', icon: AlertTriangle, color: 'text-rose-500' }
  ];

  const handleExportReleasesCSV = () => {
    const processingOrders = ordersList.filter(o => o.status === 'PROCESSING');
    exportToCSV(processingOrders, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status'], 'operations_release_queue');
  };
  const handleExportReleasesPDF = () => {
    const processingOrders = ordersList.filter(o => o.status === 'PROCESSING');
    exportToPDF('Warehouse Fulfillment Releases Queue', processingOrders, ['id', 'ticketNumber', 'clientName', 'productName', 'destination', 'paymentMode', 'totalAmount', 'status']);
  };
  const handleExportCargoCSV = () => {
    exportToCSV(incomingGoodsList, ['id', 'goodsCode', 'productName', 'country', 'company', 'quantity', 'weight', 'destination', 'discrepancies', 'status', 'unitPrice', 'createdAt'], 'logged_cargo_records');
  };
  const handleExportCargoPDF = () => {
    exportToPDF('Logged Port Ingested Cargo', incomingGoodsList, ['id', 'goodsCode', 'productName', 'country', 'company', 'quantity', 'weight', 'destination', 'discrepancies', 'status', 'unitPrice', 'createdAt']);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const autoGoodsCode = () => `GC-${Date.now().toString().slice(-6)}`;

  const handleSubmitIntake = (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as any;
    onLogIntake({
      productName: productName || 'Unspecified Product',
      productImage: imagePreview || undefined,
      goodsCode: goodsCode || autoGoodsCode(),
      destination: destination || 'Accra Warehouse',
      country: target.country.value,
      company: target.company.value,
      quantity: parseInt(target.quantity.value),
      weight: parseFloat(target.weight.value),
      discrepancies: target.discrepancies.value || 'None',
      createdAt: new Date().toLocaleString()
    });
    setImagePreview('');
    setProductName('');
    setGoodsCode('');
    setDestination('');
    (e.target as HTMLFormElement).reset();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      'APPROVED': 'bg-emerald-100 text-emerald-800',
      'REJECTED': 'bg-rose-100 text-rose-800',
      'PENDING_MANAGEMENT_APPROVAL': 'bg-amber-100 text-amber-800',
      'PROCESSING': 'bg-indigo-100 text-indigo-800',
      'DELIVERED': 'bg-emerald-100 text-emerald-800',
      'OUT_FOR_DELIVERY': 'bg-blue-100 text-blue-800',
    };
    return map[status] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operations Control Terminal</h1>
          <p className="text-sm text-slate-500 text-muted">Register port inventory intakes, monitor logged cargo, and process warehouse releases.</p>
        </div>
        <div className="flex gap-2">
          {activeSubTab === 'LoggedCargo' ? (
            <>
              <button onClick={handleExportCargoCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
                <FileSpreadsheet className="w-3.5 h-3.5" /><span>Cargo (CSV)</span>
              </button>
              <button onClick={handleExportCargoPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
                <FileText className="w-3.5 h-3.5" /><span>Cargo (PDF)</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={handleExportReleasesCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
                <FileSpreadsheet className="w-3.5 h-3.5" /><span>Releases (CSV)</span>
              </button>
              <button onClick={handleExportReleasesPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200">
                <FileText className="w-3.5 h-3.5" /><span>Releases (PDF)</span>
              </button>
            </>
          )}
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
              <div className={`p-4 bg-slate-100 rounded-2xl ${card.color} bg-accent-light`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="p-6 app-card">
        <div>
          <h3 className="text-lg font-bold">Cargo Inflow vs Release Velocity</h3>
          <p className="text-xs text-slate-500 text-muted">Ingestion tonnage vs cargo shipments cleared weekly.</p>
        </div>
        <div className="h-60 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="Ingested" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="Released" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Approved Orders Section — always visible */}
      {approvedOrders.length > 0 && (
        <div className="p-6 app-card space-y-3">
          <div className="flex items-center gap-2">
            <TicketCheck className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold">Approved Orders (with Ticket Numbers)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                  <th className="py-2 px-3">Ticket #</th>
                  <th className="py-2 px-3">Order ID</th>
                  <th className="py-2 px-3">Client</th>
                  <th className="py-2 px-3">Product</th>
                  <th className="py-2 px-3">Destination</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvedOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">{order.ticketNumber || '—'}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{order.id}</td>
                    <td className="py-2.5 px-3 font-medium">{order.clientName}</td>
                    <td className="py-2.5 px-3 text-slate-500">{order.productName || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-500">{order.destination || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-bold">GHS {order.totalAmount.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${statusBadge(order.status)}`}>{order.status.replace(/_/g, ' ')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approved Goods Section — always visible */}
      {approvedGoods.length > 0 && (
        <div className="p-6 app-card space-y-3">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold">Approved Incoming Goods</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvedGoods.map(item => (
              <div key={item.id} className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                {item.productImage && (
                  <img src={item.productImage} alt={item.productName} className="w-full h-24 object-cover rounded-lg" />
                )}
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{item.productName || 'Unnamed Product'}</p>
                    <p className="text-[10px] text-slate-500">Code: <code>{item.goodsCode || item.id}</code></p>
                  </div>
                  <span className="px-2 py-0.5 rounded font-bold text-[9px] bg-emerald-100 text-emerald-800">APPROVED</span>
                </div>
                <p className="text-[10px] text-slate-500">From: <strong>{item.country}</strong> via {item.company}</p>
                <p className="text-[10px] text-slate-500">Destination: <strong>{item.destination || 'Accra Warehouse'}</strong></p>
                <p className="text-[10px] text-slate-500">Qty: <strong>{item.quantity}</strong> | Weight: <strong>{item.weight}T</strong> | Unit: <strong>GHS {item.unitPrice || '—'}</strong></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab-based views */}
      <div className="border-t border-slate-100 pt-6">

        {/* PORT INGESTION FORM */}
        {activeSubTab === 'PortIngestion' && (
          <div className="p-6 app-card space-y-4 max-w-3xl">
            <h3 className="text-lg font-bold">Workflow A: Log Incoming Port Cargo</h3>
            <form onSubmit={handleSubmitIntake} className="space-y-4">
              {/* Product Name & Goods Code */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Product / Goods Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    required
                    placeholder="E.g., Palm Oil Barrels"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Goods Code <span className="text-slate-400 font-normal">(auto-generated if empty)</span></label>
                  <input
                    type="text"
                    value={goodsCode}
                    onChange={e => setGoodsCode(e.target.value)}
                    placeholder={`E.g., ${autoGoodsCode()}`}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Product Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Product Image <span className="text-slate-400 font-normal">(optional)</span></label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl text-xs text-slate-500 hover:text-blue-600 cursor-pointer transition-all"
                  >
                    <ImageIcon className="w-4 h-4" />
                    {imagePreview ? 'Change Image' : 'Upload Product Image'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  {imagePreview && (
                    <div className="relative">
                      <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                      <button type="button" onClick={() => setImagePreview('')} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] flex items-center justify-center cursor-pointer">✕</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Destination */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Delivery Destination <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  required
                  placeholder="E.g., Accra Main Warehouse, Tema Port Depot"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Country & Company */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Country of Origin <span className="text-rose-500">*</span></label>
                  <input type="text" name="country" required placeholder="E.g., Germany" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Shipping Company <span className="text-rose-500">*</span></label>
                  <input type="text" name="company" required placeholder="E.g., COSCO, Maersk" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              {/* Quantity & Weight */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Total Quantity <span className="text-rose-500">*</span></label>
                  <input type="number" name="quantity" required placeholder="E.g., 350" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Weight (Metric Tons) <span className="text-rose-500">*</span></label>
                  <input type="number" step="0.1" name="weight" required placeholder="E.g., 12.5" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              {/* Date/Time auto-display */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span><strong>Date & Time</strong> will be auto-generated on submission: <strong>{new Date().toLocaleString()}</strong></span>
              </div>

              {/* Discrepancy Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Discrepancy Notes / Faults</label>
                <input type="text" name="discrepancies" placeholder="Optional: E.g., 2 boxes damaged, missing tags" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500" />
              </div>

              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow cursor-pointer transition-all">
                Submit Cargo Logs
              </button>
            </form>
          </div>
        )}

        {/* FULFILLMENT RELEASES */}
        {activeSubTab === 'Releases' && (
          <div className="p-6 app-card space-y-4">
            <h3 className="text-lg font-bold">Fulfillment Releasing Queue</h3>
            <div className="divide-y divide-slate-100">
              {ordersList.filter(o => o.status === 'PROCESSING').map(order => (
                <div key={order.id} className="py-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800">Order: {order.id}</p>
                      {order.ticketNumber && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold">🎫 {order.ticketNumber}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">Client: <strong>{order.clientName}</strong> | Product: <strong>{order.productName || 'N/A'}</strong></p>
                    <p className="text-[10px] text-slate-500">Destination: <strong>{order.destination || '—'}</strong> | Value: <strong>GHS {order.totalAmount.toLocaleString()}</strong></p>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1">Invoice Generated. Release Authorized.</p>
                  </div>
                  <div>
                    <button
                      onClick={() => onReleaseToDispatch(order.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
                    >
                      Release & Load Truck
                    </button>
                  </div>
                </div>
              ))}
              {ordersList.filter(o => o.status === 'PROCESSING').length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No orders pending release from warehouse floor.</p>
              )}
            </div>
          </div>
        )}

        {/* INTAKE RECORDS LOG */}
        {activeSubTab === 'LoggedCargo' && (
          <div className="p-6 app-card space-y-4">
            <h3 className="text-lg font-bold">Operations Intake Logging Records</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-2">Image</th>
                    <th className="py-2.5 px-2">Cargo ID / Code</th>
                    <th className="py-2.5 px-2">Product</th>
                    <th className="py-2.5 px-2">Timestamp</th>
                    <th className="py-2.5 px-2">Origin</th>
                    <th className="py-2.5 px-2">Carrier</th>
                    <th className="py-2.5 px-2">Destination</th>
                    <th className="py-2.5 px-2 text-right">Qty</th>
                    <th className="py-2.5 px-2 text-right">Weight</th>
                    <th className="py-2.5 px-2">Discrepancies</th>
                    <th className="py-2.5 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incomingGoodsList.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-2">
                        {item.productImage ? (
                          <img src={item.productImage} alt={item.productName} className="w-10 h-10 object-cover rounded-lg border border-slate-200" />
                        ) : (
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-slate-300" />
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        <p className="font-mono font-bold text-slate-700">CARGO-{item.id}</p>
                        {item.goodsCode && <p className="text-[9px] text-slate-400">{item.goodsCode}</p>}
                      </td>
                      <td className="py-2.5 px-2 font-medium">{item.productName || '—'}</td>
                      <td className="py-2.5 px-2 text-slate-500 whitespace-nowrap text-[10px]">{item.createdAt || 'N/A'}</td>
                      <td className="py-2.5 px-2 font-medium">{item.country}</td>
                      <td className="py-2.5 px-2 text-slate-600">{item.company}</td>
                      <td className="py-2.5 px-2 text-slate-600">{item.destination || '—'}</td>
                      <td className="py-2.5 px-2 text-right">{item.quantity} u.</td>
                      <td className="py-2.5 px-2 text-right">{item.weight}T</td>
                      <td className="py-2.5 px-2 text-rose-600 font-semibold">{item.discrepancies}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${statusBadge(item.status)}`}>
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {incomingGoodsList.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-6 text-center text-slate-400">No cargo intake logs found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {activeSubTab === 'OpsHistory' && (
          <div className="p-6 app-card space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold">Operations Activity History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold text-[10px]">
                    <th className="py-2.5 px-3">Goods Code</th>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3">Origin</th>
                    <th className="py-2.5 px-3">Destination</th>
                    <th className="py-2.5 px-3">Logged At</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...incomingGoodsList].reverse().map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono text-slate-600">{item.goodsCode || `CARGO-${item.id}`}</td>
                      <td className="py-2.5 px-3 font-medium">{item.productName || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{item.country} / {item.company}</td>
                      <td className="py-2.5 px-3 text-slate-600">{item.destination || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-400 text-[10px]">{item.createdAt || 'N/A'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${statusBadge(item.status)}`}>{item.status.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">{item.unitPrice ? `GHS ${item.unitPrice}` : '—'}</td>
                    </tr>
                  ))}
                  {incomingGoodsList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">No operations history available.</td>
                    </tr>
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
