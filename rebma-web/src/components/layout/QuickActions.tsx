import {
  UserPlus, ClipboardList, Calendar, Megaphone, UserCheck,
  BarChart3, Video, AlertCircle, Building2, Ship, Ticket, Flag, Truck,
  DollarSign, FileText, CheckSquare, BookOpen, ShoppingCart, TrendingUp,
  Download, Boxes, Hammer, PackagePlus, MapPin, LogIn, LogOut, Map,
  GitMerge, Tag, ShieldAlert, CheckCircle, CreditCard,
} from 'lucide-react';

interface QuickActionsProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  activeDepartment: string;
  handleQuickAction: (actionName: string, dept: string) => void;
  accentColor: string;
}

export function QuickActions({
  isOpen,
  setIsOpen,
  activeDepartment,
  handleQuickAction,
  accentColor: _accentColor,
}: QuickActionsProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[250] transition-opacity duration-300"
        onClick={() => setIsOpen(false)}
      />
      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 max-h-[80vh] bg-bg-card dark:bg-slate-900 border-t border-[var(--border)] dark:border-slate-800 rounded-t-3xl p-6 z-[260] overflow-y-auto flex flex-col gap-4 animate-fade-in-up">
        <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-1 shrink-0" />

        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-850 dark:text-text-muted uppercase tracking-wider">
            Quick Actions ({activeDepartment})
          </h3>
          <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text-secondary text-xs font-bold">
            Close
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 py-2">
          {activeDepartment === 'HR' && (
            <>
              <QABtn icon={<UserPlus className="w-5 h-5" />} color="bg-emerald-500" label="Add New Staff" onClick={() => handleQuickAction('Add New Staff', 'HR')} />
              <QABtn icon={<ClipboardList className="w-5 h-5" />} color="bg-blue-500" label="Log Attendance" onClick={() => handleQuickAction('Log Attendance', 'HR')} />
              <QABtn icon={<Calendar className="w-5 h-5" />} color="bg-indigo-500" label="Schedule Meeting" onClick={() => handleQuickAction('Schedule Meeting', 'HR')} />
              <QABtn icon={<Megaphone className="w-5 h-5" />} color="bg-amber-500" label="Send Announcement" onClick={() => handleQuickAction('Send Announcement', 'HR')} />
              <QABtn icon={<UserCheck className="w-5 h-5" />} color="bg-teal-500" label="Approve Pending" onClick={() => handleQuickAction('Approve Pending Staff', 'HR')} />
            </>
          )}
          {activeDepartment === 'CEO' && (
            <>
              <QABtn icon={<BarChart3 className="w-5 h-5" />} color="bg-indigo-500" label="View Reports" onClick={() => handleQuickAction('View Reports', 'CEO')} />
              <QABtn icon={<Video className="w-5 h-5" />} color="bg-violet-500" label="Schedule Boardroom" onClick={() => handleQuickAction('Schedule Boardroom', 'CEO')} />
              <QABtn icon={<AlertCircle className="w-5 h-5" />} color="bg-rose-500" label="Send Alert" onClick={() => handleQuickAction('Send Alert', 'CEO')} />
              <QABtn icon={<Building2 className="w-5 h-5" />} color="bg-sky-500" label="View All Depts" onClick={() => handleQuickAction('View All Departments', 'CEO')} />
            </>
          )}
          {activeDepartment === 'OPERATIONS' && (
            <>
              <QABtn icon={<Ship className="w-5 h-5" />} color="bg-sky-500" label="Log Cargo Intake" onClick={() => handleQuickAction('Log Cargo Intake', 'OPERATIONS')} />
              <QABtn icon={<Ticket className="w-5 h-5" />} color="bg-teal-500" label="Fulfillment Ticket" onClick={() => handleQuickAction('Create Fulfillment Ticket', 'OPERATIONS')} />
              <QABtn icon={<Flag className="w-5 h-5" />} color="bg-rose-500" label="Flag Discrepancy" onClick={() => handleQuickAction('Flag Discrepancy', 'OPERATIONS')} />
              <QABtn icon={<Truck className="w-5 h-5" />} color="bg-amber-500" label="Release Dispatch" onClick={() => handleQuickAction('Release to Dispatch', 'OPERATIONS')} />
            </>
          )}
          {activeDepartment === 'FINANCE' && (
            <>
              <QABtn icon={<DollarSign className="w-5 h-5" />} color="bg-emerald-500" label="Record Payment" onClick={() => handleQuickAction('Record Payment', 'FINANCE')} />
              <QABtn icon={<FileText className="w-5 h-5" />} color="bg-blue-500" label="Create Invoice" onClick={() => handleQuickAction('Create Invoice', 'FINANCE')} />
              <QABtn icon={<CheckSquare className="w-5 h-5" />} color="bg-teal-500" label="Approve Credit" onClick={() => handleQuickAction('Approve Credit Order', 'FINANCE')} />
              <QABtn icon={<BookOpen className="w-5 h-5" />} color="bg-indigo-500" label="View Ledger" onClick={() => handleQuickAction('View Ledger', 'FINANCE')} />
            </>
          )}
          {activeDepartment === 'MARKETING' && (
            <>
              <QABtn icon={<ShoppingCart className="w-5 h-5" />} color="bg-emerald-500" label="Create Order" onClick={() => handleQuickAction('Create Order', 'MARKETING')} />
              <QABtn icon={<UserPlus className="w-5 h-5" />} color="bg-blue-500" label="Register Customer" onClick={() => handleQuickAction('Register Customer', 'MARKETING')} />
              <QABtn icon={<TrendingUp className="w-5 h-5" />} color="bg-indigo-500" label="View Pipeline" onClick={() => handleQuickAction('View Pipeline', 'MARKETING')} />
              <QABtn icon={<Download className="w-5 h-5" />} color="bg-amber-500" label="Export Report" onClick={() => handleQuickAction('Export Report', 'MARKETING')} />
            </>
          )}
          {activeDepartment === 'PRODUCTION' && (
            <>
              <QABtn icon={<Boxes className="w-5 h-5" />} color="bg-indigo-500" label="Request Materials" onClick={() => handleQuickAction('Request Materials', 'PRODUCTION')} />
              <QABtn icon={<Hammer className="w-5 h-5" />} color="bg-amber-500" label="Update WIP Status" onClick={() => handleQuickAction('Update WIP Status', 'PRODUCTION')} />
              <QABtn icon={<BarChart3 className="w-5 h-5" />} color="bg-teal-500" label="Log Output" onClick={() => handleQuickAction('Log Output', 'PRODUCTION')} />
              <QABtn icon={<ClipboardList className="w-5 h-5" />} color="bg-blue-500" label="View Requisitions" onClick={() => handleQuickAction('View Requisitions', 'PRODUCTION')} />
            </>
          )}
          {activeDepartment === 'DISPATCH' && (
            <>
              <QABtn icon={<PackagePlus className="w-5 h-5" />} color="bg-blue-500" label="Assign Delivery" onClick={() => handleQuickAction('Assign Delivery', 'DISPATCH')} />
              <QABtn icon={<MapPin className="w-5 h-5" />} color="bg-rose-500" label="Update GPS" onClick={() => handleQuickAction('Update GPS', 'DISPATCH')} />
              <QABtn icon={<CheckCircle className="w-5 h-5" />} color="bg-emerald-500" label="Mark Delivered" onClick={() => handleQuickAction('Mark Delivered', 'DISPATCH')} />
              <QABtn icon={<Truck className="w-5 h-5" />} color="bg-sky-500" label="View Fleet" onClick={() => handleQuickAction('View Fleet', 'DISPATCH')} />
            </>
          )}
          {activeDepartment === 'RECEPTION' && (
            <>
              <QABtn icon={<LogIn className="w-5 h-5" />} color="bg-emerald-500" label="Check In Visitor" onClick={() => handleQuickAction('Check In Visitor', 'RECEPTION')} />
              <QABtn icon={<LogOut className="w-5 h-5" />} color="bg-rose-500" label="Check Out Visitor" onClick={() => handleQuickAction('Check Out Visitor', 'RECEPTION')} />
              <QABtn icon={<ClipboardList className="w-5 h-5" />} color="bg-blue-500" label="Staff Attendance" onClick={() => handleQuickAction('Log Staff Attendance', 'RECEPTION')} />
              <QABtn icon={<BookOpen className="w-5 h-5" />} color="bg-indigo-500" label="View Today's Log" onClick={() => handleQuickAction("View Today's Log", 'RECEPTION')} />
            </>
          )}
          {activeDepartment === 'LOGISTICS' && (
            <>
              <QABtn icon={<Ship className="w-5 h-5" />} color="bg-blue-500" label="Add Shipment" onClick={() => handleQuickAction('Add Shipment', 'LOGISTICS')} />
              <QABtn icon={<Map className="w-5 h-5" />} color="bg-teal-500" label="Update Route" onClick={() => handleQuickAction('Update Route', 'LOGISTICS')} />
              <QABtn icon={<GitMerge className="w-5 h-5" />} color="bg-indigo-500" label="View Supply Chain" onClick={() => handleQuickAction('View Supply Chain', 'LOGISTICS')} />
              <QABtn icon={<FileText className="w-5 h-5" />} color="bg-amber-500" label="Export Manifest" onClick={() => handleQuickAction('Export Manifest', 'LOGISTICS')} />
            </>
          )}
          {activeDepartment === 'MANAGEMENT' && (
            <>
              <QABtn icon={<CheckCircle className="w-5 h-5" />} color="bg-emerald-500" label="Approve Intake" onClick={() => handleQuickAction('Approve Intake', 'MANAGEMENT')} />
              <QABtn icon={<Tag className="w-5 h-5" />} color="bg-amber-500" label="Set Price" onClick={() => handleQuickAction('Set Price', 'MANAGEMENT')} />
              <QABtn icon={<CreditCard className="w-5 h-5" />} color="bg-indigo-500" label="Approve Credit" onClick={() => handleQuickAction('Approve Credit', 'MANAGEMENT')} />
              <QABtn icon={<ShieldAlert className="w-5 h-5" />} color="bg-rose-500" label="View Audit Log" onClick={() => handleQuickAction('View Audit Log', 'MANAGEMENT')} />
            </>
          )}
          {['CEO', 'HR', 'MANAGEMENT', 'MARKETING', 'OPERATIONS', 'FINANCE', 'PRODUCTION', 'RECEPTION', 'DISPATCH', 'LOGISTICS'].indexOf(activeDepartment) === -1 && (
            <div className="col-span-2 text-center text-xs text-text-muted py-6">
              No quick actions available.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function QABtn({ icon, color, label, onClick }: { icon: React.ReactNode; color: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-4 bg-bg-page dark:bg-slate-800 rounded-2xl flex flex-col items-center gap-2 border border-[var(--border)] dark:border-slate-800 hover:bg-bg-input dark:hover:bg-slate-700 transition-colors cursor-pointer"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${color} shadow-card shrink-0`}>
        {icon}
      </div>
      <span className="text-[11px] font-bold text-text-primary dark:text-text-muted text-center">{label}</span>
    </button>
  );
}
