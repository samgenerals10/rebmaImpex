// rebma-web/src/views/DispatchDashboard.tsx

interface DispatchDashboardProps {
  activeCoordinates: { lat: number; lng: number };
  deliveryStatus: string;
  handleMarkDelivered: (id: string) => void;
}

export default function DispatchDashboard({
  activeCoordinates,
  deliveryStatus,
  handleMarkDelivered
}: DispatchDashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dispatch Fleet Management</h1>
        <p className="text-sm text-slate-500 text-muted">Control active delivery logs and simulate transit coordinates.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Active Route GPS logger */}
        <div className="p-6 app-card space-y-4">
          <h3 className="text-lg font-bold">Active Driver Mobile Interface Simulator</h3>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span>Driver ID: <strong>DRV-404 (Kofi)</strong></span>
              <span className={`px-2 py-0.5 rounded font-bold ${
                deliveryStatus === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800 animate-pulse'
              }`}>{deliveryStatus}</span>
            </div>
            
            <div className="text-xs space-y-1.5 text-slate-600">
              <p>Current Coordinates: <strong>{activeCoordinates.lat.toFixed(5)}, {activeCoordinates.lng.toFixed(5)}</strong></p>
              <p>Active Cargo: <strong>Order ORD-101 (Credit Order)</strong></p>
            </div>

            {deliveryStatus === 'IN_TRANSIT' ? (
              <button 
                onClick={() => handleMarkDelivered('ORD-101')}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow transition-all"
              >
                Signal Order Received / Delivered
              </button>
            ) : (
              <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl text-xs text-center font-semibold">
                Delivery Completed. Coordinates saved to Neon database logs.
              </div>
            )}
          </div>
        </div>

        {/* Coordinates Sync logs */}
        <div className="p-6 app-card space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold">Zustand Offline Synchronizer</h3>
            <p className="text-xs text-slate-500 text-muted">Simulates buffering coordinates in Zustand store when connection drops.</p>
          </div>

          <div className="space-y-3 bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-[10px] h-48 overflow-y-auto">
            <p className="text-slate-500">// Simulated Sync Logs</p>
            <p className="text-emerald-400">[Zustand Store] Sync Queue: Empty. Link Active.</p>
            <p>[Log] Lat: {activeCoordinates.lat.toFixed(5)} | Lng: {activeCoordinates.lng.toFixed(5)} (Sent successfully)</p>
            <p>[Log] Lat: {(activeCoordinates.lat + 0.001).toFixed(5)} | Lng: {(activeCoordinates.lng - 0.001).toFixed(5)} (Sent successfully)</p>
            {deliveryStatus === 'DELIVERED' && (
              <p className="text-blue-400">[Sync Status] Finished streaming. Delivery logged cleanly.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
