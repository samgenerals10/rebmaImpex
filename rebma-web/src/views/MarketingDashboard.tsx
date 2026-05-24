// rebma-web/src/views/MarketingDashboard.tsx

import type { Order } from '../types/erp';
import { FileSpreadsheet, FileText, UserPlus, Users } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/export';

interface Customer {
  id: string;
  name: string;
  phone: string;
  location: string;
  companyName: string;
  registeredAt: string;
}

interface MarketingDashboardProps {
  ordersList: Order[];
  onCreateOrder: (e: React.FormEvent) => void;
  customersList: Customer[];
  onRegisterCustomer: (e: React.FormEvent) => void;
}

export default function MarketingDashboard({
  ordersList,
  onCreateOrder,
  customersList,
  onRegisterCustomer
}: MarketingDashboardProps) {

  const handleExportCSV = () => {
    exportToCSV(ordersList, ['id', 'clientName', 'paymentMode', 'totalAmount', 'status', 'createdAt'], 'marketing_orders_ledger');
  };

  const handleExportPDF = () => {
    exportToPDF('Sales Orders Ledger', ordersList, ['id', 'clientName', 'paymentMode', 'totalAmount', 'status', 'createdAt']);
  };

  const handleExportCustomersCSV = () => {
    exportToCSV(customersList, ['id', 'name', 'phone', 'location', 'companyName', 'registeredAt'], 'registered_customers_list');
  };

  const handleExportCustomersPDF = () => {
    exportToPDF('Registered Customer List', customersList, ['id', 'name', 'phone', 'location', 'companyName', 'registeredAt']);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketing Pipeline</h1>
          <p className="text-sm text-slate-500 text-muted">Create client sales orders, register active customers, and inspect history logs.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Orders (CSV)</span>
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Orders (PDF)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create Order form */}
        <div className="p-6 app-card space-y-4">
          <h3 className="text-lg font-bold">Workflow B: Create Client Order</h3>
          <form onSubmit={onCreateOrder} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Client Customer</label>
              <select 
                name="client"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
              >
                {customersList.map(cust => (
                  <option key={cust.id} value={cust.name}>{cust.name} ({cust.companyName})</option>
                ))}
                {customersList.length === 0 && (
                  <option value="Standard Retail Distributer">Standard Retail Distributer</option>
                )}
              </select>
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

        {/* Register Customer Form */}
        <div className="p-6 app-card space-y-4">
          <div className="flex items-center gap-1.5">
            <UserPlus className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold">Register New Customer</h3>
          </div>
          <form onSubmit={onRegisterCustomer} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Customer Name</label>
              <input 
                type="text" 
                name="customerName"
                required 
                placeholder="E.g., Kofi Owusu"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Corporate / Company Name</label>
              <input 
                type="text" 
                name="company"
                required 
                placeholder="E.g., Owusu Retail Hub"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone Number</label>
                <input 
                  type="text" 
                  name="phone"
                  required 
                  placeholder="+233 24 123 4567"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">City / Location</label>
                <input 
                  type="text" 
                  name="location"
                  required 
                  placeholder="E.g., Kumasi"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                />
              </div>
            </div>
            <button 
              type="submit" 
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow cursor-pointer transition-all"
            >
              Add Customer Registry
            </button>
          </form>
        </div>

        {/* Registered Customer Directory List */}
        <div className="p-6 app-card space-y-4">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-1.5">
              <Users className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-bold">Customer Directory</h3>
            </div>
            <div className="flex gap-1">
              <button 
                onClick={handleExportCustomersCSV}
                title="Export Customers to CSV"
                className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={handleExportCustomersPDF}
                title="Export Customers to PDF"
                className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {customersList.map(cust => (
              <div key={cust.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <p className="text-xs font-bold text-slate-800">{cust.name}</p>
                <p className="text-[10px] text-slate-500">Company: <strong>{cust.companyName}</strong> | City: {cust.location}</p>
                <p className="text-[9px] text-slate-400 mt-1">Tel: {cust.phone} | Registered: {cust.registeredAt}</p>
              </div>
            ))}
            {customersList.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">No registered customers logged.</p>
            )}
          </div>
        </div>

      </div>

      {/* Active Orders List */}
      <div className="p-6 app-card space-y-4">
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
  );
}
