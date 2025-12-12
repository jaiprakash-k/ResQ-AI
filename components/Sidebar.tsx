import React from 'react';
import { Activity, Users, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { SimulationStats, LogEntry } from '../types';
import * as d3 from 'd3';

interface SidebarProps {
  stats: SimulationStats;
  logs: LogEntry[];
}

export const Sidebar: React.FC<SidebarProps> = ({ stats, logs }) => {
  // Sparkline rendering
  const sparklinePath = React.useMemo(() => {
    if (stats.evacuationHistory.length < 2) return '';
    const h = 40;
    const w = 240;
    const max = Math.max(...stats.evacuationHistory, 10);
    const xScale = d3.scaleLinear().domain([0, stats.evacuationHistory.length - 1]).range([0, w]);
    const yScale = d3.scaleLinear().domain([0, max]).range([h, 0]);
    
    const line = d3.line<number>()
      .x((d, i) => xScale(i))
      .y(d => yScale(d))
      .curve(d3.curveMonotoneX);
      
    return line(stats.evacuationHistory) || '';
  }, [stats.evacuationHistory]);

  return (
    <div className="w-80 h-full bg-neon-panel border-r border-neon-cyan/20 flex flex-col backdrop-blur-md z-10 font-mono text-sm relative overflow-hidden">
      {/* Scanline overlay for sidebar */}
      <div className="absolute inset-0 pointer-events-none opacity-5 animate-scanline bg-gradient-to-b from-transparent via-neon-cyan to-transparent h-4" />

      {/* Header */}
      <div className="p-6 border-b border-neon-cyan/20">
        <h1 className="text-2xl font-display font-bold text-neon-cyan tracking-wider">RESQ-AI</h1>
        <p className="text-xs text-neon-blue uppercase tracking-[0.2em] opacity-80 mt-1">Disaster Protocol v1.0</p>
      </div>

      {/* Stats Grid */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <StatBox label="Active" value={stats.activeAgents} icon={<Users size={14} />} color="text-neon-cyan" />
        <StatBox label="Casualties" value={stats.casualties} icon={<AlertTriangle size={14} />} color="text-neon-red" />
        <StatBox label="Evacuated" value={stats.evacuated} icon={<CheckCircle size={14} />} color="text-neon-green" />
        <StatBox label="Time" value={`${stats.timeElapsed}s`} icon={<Clock size={14} />} color="text-neon-blue" />
      </div>

      {/* Sparkline */}
      <div className="px-6 py-4 border-b border-neon-cyan/10">
        <div className="flex justify-between items-end mb-2">
            <span className="text-xs text-gray-400 uppercase">Evacuation Rate (60s)</span>
            <span className="text-xs text-neon-green">{stats.evacuated} total</span>
        </div>
        <svg width="100%" height="40" className="overflow-visible">
            <path d={sparklinePath} fill="none" stroke="#00ff9d" strokeWidth="2" filter="drop-shadow(0 0 2px #00ff9d)" />
        </svg>
      </div>

      {/* Logs */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-2 bg-neon-dark/50 border-y border-neon-cyan/10">
          <span className="text-xs uppercase text-gray-500 font-bold flex items-center gap-2">
            <Activity size={12} /> Live Feed
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {logs.slice().reverse().map((log) => (
            <div key={log.id} className={`text-xs border-l-2 pl-3 py-1 animate-pulse-fast ${
                log.type === 'danger' ? 'border-neon-red text-red-400' :
                log.type === 'success' ? 'border-neon-green text-green-400' :
                log.type === 'alert' ? 'border-neon-blue text-blue-300' :
                'border-gray-600 text-gray-400'
            }`}>
              <span className="opacity-50 text-[10px] block mb-0.5">{log.timestamp}</span>
              {log.message}
            </div>
          ))}
          {logs.length === 0 && <div className="text-gray-600 italic text-center mt-10">Awaiting system input...</div>}
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value, icon, color }: any) => (
  <div className="bg-neon-dark/40 border border-white/5 p-3 rounded">
    <div className={`flex items-center gap-2 mb-1 ${color}`}>
      {icon}
      <span className="text-[10px] uppercase font-bold opacity-80">{label}</span>
    </div>
    <div className="text-xl font-display font-bold text-gray-100">{value}</div>
  </div>
);