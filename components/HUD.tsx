import React, { useState, useEffect } from 'react';
import { COMMANDS } from '../constants';
import { Terminal, Send, HelpCircle, Camera, RefreshCw } from 'lucide-react';

interface HUDProps {
  onCommand: (cmd: string) => void;
  fps: number;
}

export const HUD: React.FC<HUDProps> = ({ onCommand, fps }) => {
  const [input, setInput] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim()) return;
    onCommand(input);
    setInput('');
    setShowHelp(false);
  };

  return (
    <div className="absolute bottom-6 left-80 right-0 px-8 flex flex-col gap-4 pointer-events-none">
      
      {/* Floating Action Bar */}
      <div className="self-end flex gap-2 pointer-events-auto">
        <button onClick={() => onCommand('snapshot')} className="bg-neon-dark/80 backdrop-blur border border-white/10 hover:border-neon-cyan/50 text-neon-cyan p-2 rounded transition-all">
            <Camera size={20} />
        </button>
        <button onClick={() => window.location.reload()} className="bg-neon-dark/80 backdrop-blur border border-white/10 hover:border-neon-red/50 text-neon-red p-2 rounded transition-all">
            <RefreshCw size={20} />
        </button>
      </div>

      {/* Command Input Area */}
      <div className="w-full max-w-3xl mx-auto pointer-events-auto relative">
        {/* Help Popover */}
        {showHelp && (
            <div className="absolute bottom-full mb-2 left-0 right-0 bg-neon-dark/95 border border-neon-cyan/30 rounded p-4 backdrop-blur-xl text-xs font-mono grid grid-cols-2 gap-2 shadow-[0_0_20px_rgba(0,243,255,0.1)]">
                {COMMANDS.map(c => (
                    <div key={c.cmd} className="flex justify-between border-b border-white/5 pb-1">
                        <span className="text-neon-cyan font-bold">{c.cmd}</span>
                        <span className="text-gray-400">{c.desc}</span>
                    </div>
                ))}
            </div>
        )}

        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute inset-y-0 left-3 flex items-center text-neon-cyan animate-pulse">
            <Terminal size={18} />
          </div>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setShowHelp(true)}
            onBlur={() => setTimeout(() => setShowHelp(false), 200)}
            placeholder="Enter system command..."
            className="w-full bg-neon-dark/80 backdrop-blur-md border border-neon-cyan/30 text-neon-cyan font-mono pl-10 pr-12 py-3 rounded shadow-lg focus:outline-none focus:border-neon-cyan focus:shadow-[0_0_15px_rgba(0,243,255,0.3)] transition-all placeholder:text-neon-cyan/30"
            autoFocus
          />
          
          <button 
            type="submit"
            className="absolute right-2 top-2 bottom-2 px-3 bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan rounded flex items-center justify-center transition-colors"
          >
            <Send size={16} />
          </button>
        </form>

        <div className="mt-2 flex justify-between text-[10px] font-mono text-neon-cyan/50 uppercase tracking-widest">
            <span>System Ready</span>
            <span>{fps} FPS</span>
        </div>
      </div>
    </div>
  );
};