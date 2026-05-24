// rebma-web/src/views/BoardroomView.tsx

import { Video, Users, FileSpreadsheet, FileText } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/export';

interface BoardroomViewProps {
  boardroomMinutes: string;
  setBoardroomMinutes: (minutes: string) => void;
}

export default function BoardroomView({
  boardroomMinutes,
  setBoardroomMinutes
}: BoardroomViewProps) {
  
  const participants = [
    { role: 'CEO', name: 'Samuel Remba', status: 'Online' },
    { role: 'Operations', name: 'Ops Lead Frank', status: 'Online' },
    { role: 'Finance', name: 'Finance Controller Ama', status: 'Online' },
    { role: 'HR', name: 'HR Manager Derrick', status: 'Away' }
  ];

  const handleExportCSV = () => {
    const formattedData = [
      { Document: 'Executive Boardroom Minutes', Content: boardroomMinutes, Date: new Date().toLocaleString() }
    ];
    exportToCSV(formattedData, ['Document', 'Content', 'Date'], 'boardroom_minutes');
  };

  const handleExportPDF = () => {
    const formattedData = [
      { Document: 'Executive Boardroom Minutes', Content: boardroomMinutes, Date: new Date().toLocaleString() }
    ];
    exportToPDF('Executive Boardroom Minutes', formattedData, ['Document', 'Content', 'Date']);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Executive Boardroom</h1>
          <p className="text-sm text-slate-500 text-muted">Real-time collaborative video conference and meeting minutes manager.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Minutes (CSV)</span>
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-200"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Minutes (PDF)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Live Jitsi Video Frame */}
        <div className="lg:col-span-2 p-6 app-card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Video className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold">Secure Jitsi Video Stream</h3>
          </div>
          <div className="aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 relative">
            <iframe
              src="https://meet.jit.si/RembaImpexGhanaExecutiveBoardroom_101"
              style={{ border: 0, width: '100%', height: '100%' }}
              allow="camera; microphone; fullscreen; display-capture; autoplay"
            ></iframe>
          </div>
        </div>

        {/* Live notepad and active presence */}
        <div className="p-6 app-card flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-bold">Executive Boardroom Logs</h3>
            </div>
            
            {/* Participant presence */}
            <div className="space-y-2 mb-6">
              {participants.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">{p.name}</span>
                    <p className="text-[10px] text-slate-400 font-medium">{p.role}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    p.status === 'Online' ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-slate-200 text-slate-600'
                  }`}>{p.status}</span>
                </div>
              ))}
            </div>

            {/* Notepad Editor */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Live Meeting Minutes Editor</label>
              <textarea
                value={boardroomMinutes}
                onChange={(e) => setBoardroomMinutes(e.target.value)}
                className="w-full h-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-mono resize-none leading-relaxed"
                placeholder="Type boardroom updates here..."
              ></textarea>
            </div>
          </div>
          
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[10px] text-blue-500 leading-normal">
            <strong>Active boardroom log:</strong> Document auto-syncs to database server storage. Shared with all participants.
          </div>
        </div>

      </div>
    </div>
  );
}
