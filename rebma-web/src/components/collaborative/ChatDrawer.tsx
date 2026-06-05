// rebma-web/src/components/collaborative/ChatDrawer.tsx

import { useState } from 'react';
import { MessageSquare, Video, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage } from '../../types/erp';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages: ChatMessage[];
  onSendMessage: (content: string) => void;
  boardroomMinutes: string;
  setBoardroomMinutes: (minutes: string) => void;
}

export default function ChatDrawer({
  isOpen,
  onClose,
  chatMessages,
  onSendMessage,
  boardroomMinutes,
  setBoardroomMinutes
}: ChatDrawerProps) {
  const [chatInput, setChatInput] = useState<string>('');

  const handleSend = () => {
    if (!chatInput.trim()) return;
    onSendMessage(chatInput);
    setChatInput('');
  };

  const handleEditBoardroom = async () => {
    const text = await prompt("Edit boardroom minutes:", boardroomMinutes);
    if (text !== null) setBoardroomMinutes(text);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', duration: 0.3 }}
          className="fixed right-0 top-0 h-full w-80 bg-white border-l border-slate-200 shadow-2xl flex flex-col justify-between p-4 z-50 app-card"
        >
          {/* Header info */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span>Real-time Messaging</span>
              </h3>
              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Boardroom Tab Selector */}
            <div className="border-b border-slate-100 pb-2 mb-4 flex gap-2">
              <button className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] rounded font-bold">1-on-1 Chat</button>
              <button 
                onClick={handleEditBoardroom}
                className="px-2.5 py-1 hover:bg-slate-50 text-slate-500 text-[10px] rounded font-bold flex items-center gap-1"
              >
                <Video className="w-3 h-3" />
                <span>Boardroom Docs</span>
              </button>
            </div>

            {/* Message items list */}
            <div className="space-y-3 h-96 overflow-y-auto pr-1">
              {chatMessages.map(msg => (
                <div key={msg.id} className="p-2.5 bg-slate-50 rounded-xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-700">{msg.sender}</span>
                    <span className="text-[8px] text-slate-400">{msg.time}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{msg.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Input message drawer */}
          <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
            <input 
              type="text" 
              placeholder="Type message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500"
            />
            <button 
              onClick={handleSend}
              className="p-2 bg-blue-600 text-white rounded-xl cursor-pointer hover:bg-blue-700"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
