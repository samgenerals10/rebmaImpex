// rebma-web/src/views/BoardroomView.tsx

import { useState } from 'react';
import { Video, Users, FileSpreadsheet, FileText, Send, Calendar, Clock } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/export';
import type { ChatMessage, BoardroomMeeting, CurrentUser } from '../types/erp';

interface BoardroomViewProps {
  boardroomMinutes: string;
  setBoardroomMinutes: (minutes: string) => void;
  activeSubTab: string;
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  currentUser: CurrentUser | null;
  meetingsList: BoardroomMeeting[];
  setMeetingsList: React.Dispatch<React.SetStateAction<BoardroomMeeting[]>>;
}

export default function BoardroomView({
  boardroomMinutes,
  setBoardroomMinutes,
  activeSubTab = 'VideoConf',
  chatMessages,
  setChatMessages,
  currentUser,
  meetingsList,
  setMeetingsList
}: BoardroomViewProps) {
  
  // Community chat message input
  const [announcementText, setAnnouncementText] = useState('');

  // Direct messaging states
  const [selectedDept, setSelectedDept] = useState<string>('FINANCE');
  const [dmText, setDmText] = useState('');

  // Schedule meeting form states
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingParticipants, setMeetingParticipants] = useState<string[]>(['CEO', 'OPERATIONS', 'FINANCE']);

  const departmentsList = [
    'CEO', 'MANAGEMENT', 'FINANCE', 'OPERATIONS', 'MARKETING', 
    'HR', 'PRODUCTION', 'RECEPTION', 'DISPATCH', 'LOGISTICS'
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

  const handleSendAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim()) return;
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: currentUser?.fullName || currentUser?.department || 'Staff Member',
      content: announcementText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, newMsg]);
    setAnnouncementText('');
  };

  const handleSendDM = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmText.trim()) return;
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: currentUser?.fullName || currentUser?.department || 'Staff Member',
      content: dmText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      receiver: selectedDept
    };
    setChatMessages(prev => [...prev, newMsg]);
    setDmText('');
  };

  const handleScheduleMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingTitle.trim() || !meetingDate || !meetingTime) {
      alert('Please fill out all meeting details');
      return;
    }
    const newMtg: BoardroomMeeting = {
      id: `MTG-${Date.now().toString().slice(-4)}`,
      title: meetingTitle.trim(),
      date: meetingDate,
      time: meetingTime,
      organizer: currentUser?.fullName || 'Samuel Remba',
      participants: meetingParticipants
    };
    setMeetingsList(prev => [newMtg, ...prev]);
    setMeetingTitle('');
    setMeetingDate('');
    setMeetingTime('');
  };

  const handleParticipantToggle = (dept: string) => {
    if (meetingParticipants.includes(dept)) {
      setMeetingParticipants(prev => prev.filter(d => d !== dept));
    } else {
      setMeetingParticipants(prev => [...prev, dept]);
    }
  };

  // Filter public announcements (no receiver set)
  const publicMessages = chatMessages.filter(msg => !msg.receiver);

  // Filter DMs involving the current user/department and the selected department
  const userRole = currentUser?.department || 'CEO';
  const directMessages = chatMessages.filter(msg => {
    return (
      (msg.sender === userRole && msg.receiver === selectedDept) ||
      (msg.sender === selectedDept && msg.receiver === userRole) ||
      (msg.receiver === selectedDept && msg.sender === currentUser?.fullName)
    );
  });

  return (
    <>
      {/* ══ MOBILE LAYOUT (< lg) ══ */}
      <div className="lg:hidden mobile-only space-y-4 pb-4 mobile-animate-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">Boardroom</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Announcements & schedules</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm" title="Export CSV">
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            </button>
            <button onClick={handleExportPDF} className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm" title="Export PDF">
              <FileText className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Physical Gradient Card */}
        <div className="mobile-physical-card" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)' }}>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Scheduled Meetings</p>
              <h2 className="text-3xl font-extrabold text-white mt-1 tracking-tight">{meetingsList.length} Meetings</h2>
              <p className="text-[10px] text-white/70 mt-1">Live Jitsi channel enabled</p>
            </div>
            <div className="mobile-card-chip mt-1" />
          </div>
          <div className="flex justify-between items-end mt-8 relative z-10">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-white/60">•••• •••• •••• 1010</p>
              <p className="text-[10px] font-bold text-white/80 mt-1 uppercase tracking-wider">Executive Boardroom Office</p>
            </div>
            <div className="mobile-card-circles">
              <div className="mobile-card-circle-1" />
              <div className="mobile-card-circle-2" />
            </div>
          </div>
        </div>

        {/* Meeting Calendar List */}
        <div>
          <p className="mobile-section-label">Upcoming Calendar Meetings</p>
          <div className="space-y-2">
            {meetingsList.slice(0, 3).map(mtg => (
              <div key={mtg.id} className="mobile-data-row flex-col items-start gap-2">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div className="mobile-data-row-icon bg-indigo-50 text-indigo-600">
                      <Calendar className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{mtg.title}</p>
                      <p className="text-[9px] text-slate-400 font-mono">{mtg.date} at {mtg.time}</p>
                    </div>
                  </div>
                  <a href="https://meet.jit.si/RembaImpexGhanaExecutiveBoardroom_101" target="_blank" rel="noreferrer" className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold">
                    Join Stream
                  </a>
                </div>
              </div>
            ))}
            {meetingsList.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">No boardroom meetings scheduled</p>
            )}
          </div>
        </div>

        {/* Public Announcements board */}
        <div>
          <p className="mobile-section-label">Public Announcements ({publicMessages.length})</p>
          <div className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm space-y-3">
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {publicMessages.slice(-5).map(msg => (
                <div key={msg.id} className="text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[10px] text-slate-500">
                    <span>{msg.sender}</span>
                    <span className="font-normal text-[9px] text-slate-400">• {msg.time}</span>
                  </div>
                  <p className="text-slate-800 mt-0.5 bg-slate-50 rounded-lg p-2">{msg.content}</p>
                </div>
              ))}
              {publicMessages.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">No announcements posted.</p>
              )}
            </div>
            <form onSubmit={handleSendAnnouncement} className="flex gap-1">
              <input 
                type="text" 
                value={announcementText} 
                onChange={e => setAnnouncementText(e.target.value)} 
                placeholder="Broadcast to boardroom..." 
                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
              />
              <button type="submit" className="p-1.5 bg-blue-600 text-white rounded-xl"><Send className="w-4 h-4" /></button>
            </form>
          </div>
        </div>
      </div>

      {/* ══ DESKTOP LAYOUT (lg+) ══ */}
      <div className="hidden lg:block">
        <div className="space-y-6">
          {/* Title Row */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">Executive Boardroom</h1>
              <p className="text-xs sm:text-sm text-[var(--text-muted)]">Slack-like announcements, private direct messaging, scheduling, and live video minutes.</p>
            </div>
            {activeSubTab === 'VideoConf' && (
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button 
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Export Minutes (CSV)</span>
                </button>
                <button 
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-light)] hover:opacity-90 text-[var(--accent)] rounded-lg text-xs font-semibold cursor-pointer border border-[var(--border)] transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export Minutes (PDF)</span>
                </button>
              </div>
            )}
          </div>

          {/* Main Tab Rendering */}
          <div className="border-t border-[var(--border)] pt-6">
            {activeSubTab === 'VideoConf' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live Jitsi Video Frame */}
                <div className="lg:col-span-2 p-4 md:p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Video className="w-5 h-5 text-[var(--accent)]" />
                    <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Secure Jitsi Video Stream</h3>
                  </div>
                  <div className="h-60 sm:h-80 md:h-[400px] lg:h-[480px] bg-black rounded-2xl overflow-hidden border border-[var(--border)] relative">
                    <iframe
                      src="https://meet.jit.si/RembaImpexGhanaExecutiveBoardroom_101"
                      style={{ border: 0, width: '100%', height: '100%' }}
                      allow="camera; microphone; fullscreen; display-capture; autoplay"
                    ></iframe>
                  </div>
                </div>

                {/* Live notepad and active presence */}
                <div className="p-4 md:p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] flex flex-col justify-between space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-5 h-5 text-emerald-500" />
                      <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Active Presence</h3>
                    </div>
                    
                    {/* Participant presence */}
                    <div className="space-y-2 mb-6">
                      {[
                        { role: 'CEO', name: 'Samuel Remba', status: 'Online' },
                        { role: 'Operations', name: 'Ops Lead Frank', status: 'Online' },
                        { role: 'Finance', name: 'Finance Controller Ama', status: 'Online' },
                        { role: 'HR', name: 'HR Manager Derrick', status: 'Away' }
                      ].map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs">
                          <div>
                            <span className="font-semibold text-[var(--text-primary)]">{p.name}</span>
                            <p className="text-[10px] text-[var(--text-muted)] font-medium">{p.role}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                            p.status === 'Online' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                          }`}>{p.status}</span>
                        </div>
                      ))}
                    </div>

                    {/* Notepad Editor */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Live Meeting Minutes Editor</label>
                      <textarea
                        value={boardroomMinutes}
                        onChange={(e) => setBoardroomMinutes(e.target.value)}
                        className="w-full h-48 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] font-mono resize-none leading-relaxed"
                        placeholder="Type boardroom updates here..."
                      ></textarea>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-[var(--accent-light)] border border-[var(--accent)]/20 rounded-xl text-[10px] text-[var(--accent)] leading-normal">
                    <strong>Active boardroom log:</strong> Document auto-syncs to database server storage. Shared with all participants.
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'Announcements' && (
              <div className="p-4 md:p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-4 max-w-4xl mx-auto flex flex-col h-[550px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--border)] gap-2">
                  <div>
                    <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]"># community-chat</h3>
                    <p className="text-xs text-[var(--text-muted)]">Public Slack-style pool chat channel for staff updates.</p>
                  </div>
                  <span className="text-[10px] px-2 py-1 bg-[var(--accent-light)] text-[var(--accent)] font-bold uppercase rounded self-start sm:self-auto">Public Board</span>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {publicMessages.map(msg => (
                    <div key={msg.id} className="flex gap-3 text-xs">
                      <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold font-mono">
                        {msg.sender[0].toUpperCase()}
                      </div>
                      <div className="flex-1 bg-[var(--bg)] p-3 rounded-2xl border border-[var(--border)]">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-[var(--text-primary)]">{msg.sender}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{msg.time}</span>
                        </div>
                        <p className="text-[var(--text-primary)] leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {publicMessages.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)] text-center py-12">No announcements logged. Be the first to post!</p>
                  )}
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendAnnouncement} className="flex gap-2 pt-3 border-t border-[var(--border)]">
                  <input 
                    type="text" 
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Type an announcement to the entire team..."
                    className="flex-1 px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-full text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button 
                    type="submit" 
                    className="p-2.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-full cursor-pointer transition-all shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {activeSubTab === 'DirectMessages' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-auto md:h-[550px] max-w-5xl mx-auto">
                {/* Sidebar departments list */}
                <div className="p-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] overflow-x-auto md:overflow-x-visible md:overflow-y-auto md:col-span-1 flex flex-row md:flex-col gap-2 md:gap-1 shrink-0 pb-3 md:pb-4 select-none">
                  <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-0 md:mb-3 px-2 self-center md:self-start hidden md:block">Departments</h4>
                  {departmentsList.map(dept => (
                    <button
                      key={dept}
                      onClick={() => setSelectedDept(dept)}
                      className={`flex-none md:w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
                        selectedDept === dept 
                          ? 'bg-[var(--accent)] text-white shadow' 
                          : 'text-[var(--text-primary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]'
                      }`}
                    >
                      <span>{dept}</span>
                      {dept === userRole && (
                        <span className="text-[8px] bg-[var(--accent-light)] text-[var(--accent)] px-1 py-0.5 rounded uppercase ml-1.5 md:ml-0">You</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Chat thread console */}
                <div className="md:col-span-3 p-4 md:p-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-[var(--box-shadow)] flex flex-col justify-between h-[450px] md:h-full">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">Secure DM: {selectedDept}</h3>
                      <p className="text-[10px] text-[var(--text-muted)]">1-on-1 private messaging channel with {selectedDept} desk.</p>
                    </div>
                  </div>

                  {/* Chat Timeline */}
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
                    {directMessages.map(msg => {
                      const isSentByMe = msg.sender === currentUser?.fullName || msg.sender === userRole;
                      return (
                        <div key={msg.id} className={`flex gap-3 text-xs ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
                          {!isSentByMe && (
                            <div className="w-8 h-8 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center font-bold font-mono">
                              {msg.sender[0].toUpperCase()}
                            </div>
                          )}
                          <div className={`p-3 rounded-2xl border max-w-sm ${
                            isSentByMe 
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)] rounded-tr-none' 
                              : 'bg-[var(--bg)] text-[var(--text-primary)] border-[var(--border)] rounded-tl-none'
                          }`}>
                            <div className="flex justify-between gap-4 items-center mb-1">
                              <span className={`font-bold ${isSentByMe ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                                {isSentByMe ? 'You' : msg.sender}
                              </span>
                              <span className={`text-[9px] ${isSentByMe ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>
                                {msg.time}
                              </span>
                            </div>
                            <p className="leading-relaxed">{msg.content}</p>
                          </div>
                        </div>
                      );
                    })}
                    {directMessages.length === 0 && (
                      <p className="text-xs text-[var(--text-muted)] text-center py-12">No message thread history found with {selectedDept} desk.</p>
                    )}
                  </div>

                  {/* Input console */}
                  <form onSubmit={handleSendDM} className="flex gap-2 pt-3 border-t border-[var(--border)]">
                    <input 
                      type="text" 
                      value={dmText}
                      onChange={(e) => setDmText(e.target.value)}
                      placeholder={`Send direct message to ${selectedDept}...`}
                      className="flex-1 px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-full text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    />
                    <button 
                      type="submit" 
                      className="p-2.5 bg-[var(--accent)] hover:bg-blue-700 text-white rounded-full cursor-pointer transition-all shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            )}

            {activeSubTab === 'Meetings' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Scheduler Form */}
                <div className="p-4 md:p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] space-y-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-5 h-5 text-[var(--accent)]" />
                    <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Organize Meeting</h3>
                  </div>
                  <form onSubmit={handleScheduleMeeting} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Meeting Title / Topic</label>
                      <input 
                        type="text" 
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
                        required
                        placeholder="E.g., Logistics & Fleet Align"
                        className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Date</label>
                        <input 
                          type="date" 
                          value={meetingDate}
                          onChange={(e) => setMeetingDate(e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Time</label>
                        <input 
                          type="time" 
                          value={meetingTime}
                          onChange={(e) => setMeetingTime(e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">Select Participants</label>
                      <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-[var(--bg)] border border-[var(--border)] rounded-xl">
                        {departmentsList.map(dept => (
                          <label key={dept} className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={meetingParticipants.includes(dept)} 
                              onChange={() => handleParticipantToggle(dept)} 
                              className="cursor-pointer"
                            />
                            {dept}
                          </label>
                        ))}
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full py-2.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-xl text-xs font-bold shadow cursor-pointer transition-all"
                    >
                      Schedule Executive Board Meeting
                    </button>
                  </form>
                </div>

                {/* Scheduled Timeline */}
                <div className="p-4 md:p-6 bg-[var(--bg-card)] rounded-2xl shadow-[var(--box-shadow)] border border-[var(--border)] lg:col-span-2 space-y-4">
                  <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">Scheduled Board Meetings Timeline</h3>
                  <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
                    {meetingsList.map(mtg => (
                      <div key={mtg.id} className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:scale-101 transition-all">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] bg-[var(--accent-light)] text-[var(--accent)] font-bold px-2 py-0.5 rounded font-mono">
                              {mtg.id}
                            </span>
                            <h4 className="text-sm font-bold text-[var(--text-primary)]">{mtg.title}</h4>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)] font-medium">
                            <p className="flex items-center gap-1 text-[10px]">
                              <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                              {mtg.date}
                            </p>
                            <p className="flex items-center gap-1 text-[10px]">
                              <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                              {mtg.time}
                            </p>
                            <p className="text-[10px]">Organizer: <strong className="text-[var(--text-primary)]">{mtg.organizer}</strong></p>
                          </div>
                          <div className="pt-2 flex flex-wrap gap-1">
                            {mtg.participants.map(p => (
                              <span key={p} className="text-[8px] bg-[var(--accent-light)] text-[var(--accent)] px-1.5 py-0.5 rounded font-semibold uppercase">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center">
                          <a 
                            href="https://meet.jit.si/RembaImpexGhanaExecutiveBoardroom_101" 
                            target="_blank" 
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-all shadow"
                          >
                            Join Stream
                          </a>
                        </div>
                      </div>
                    ))}
                    {meetingsList.length === 0 && (
                      <p className="text-xs text-[var(--text-muted)] text-center py-12">No meetings scheduled on the board calendar.</p>
                    )}
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
