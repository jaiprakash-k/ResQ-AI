import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { HUD } from './components/HUD';
import { SimulationEngine } from './services/SimulationEngine';
import { SimulationStats, LogEntry, Agent } from './types';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  
  const [stats, setStats] = useState<SimulationStats>({
    activeAgents: 0,
    casualties: 0,
    evacuated: 0,
    fps: 60,
    timeElapsed: 0,
    evacuationHistory: []
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [hoveredAgent, setHoveredAgent] = useState<Agent | null>(null);
  const [tooltipPos, setTooltipPos] = useState({x: 0, y: 0});

  // Helpers
  const addLog = useCallback((message: string, type: 'info' | 'alert' | 'success' | 'danger') => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'}),
      message,
      type
    };
    setLogs(prev => [entry, ...prev].slice(0, 50));
  }, []);

  const handleStatsUpdate = useCallback((newStats: SimulationStats) => {
    setStats(newStats);
  }, []);

  // Init Engine
  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      const engine = new SimulationEngine(
        canvasRef.current,
        handleStatsUpdate,
        addLog
      );
      
      // Parse URL for seed
      const urlParams = new URLSearchParams(window.location.search);
      const seed = urlParams.get('seed') ? parseInt(urlParams.get('seed')!) : Date.now();
      engine.config.seed = seed;
      
      engine.init();
      engine.loop(0);
      engineRef.current = engine;
    }
    
    return () => {
       if (engineRef.current) engineRef.current.isRunning = false;
    };
  }, [handleStatsUpdate, addLog]);

  // Command Handler
  const handleCommand = (cmd: string) => {
    if (!engineRef.current) return;

    if (cmd === 'snapshot') {
        const link = document.createElement('a');
        link.download = `resq-ai-snapshot-${Date.now()}.png`;
        link.href = canvasRef.current!.toDataURL();
        link.click();
        addLog('Snapshot captured.', 'info');
        return;
    }

    engineRef.current.executeCommand(cmd);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
      if (!engineRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      engineRef.current.click(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!engineRef.current || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const agent = engineRef.current.getAgentAt(x, y);
      if (agent) {
          // Shallow copy to force render update if we hover different agents
          setHoveredAgent({...agent}); 
          setTooltipPos({x: e.clientX, y: e.clientY});
      } else {
          setHoveredAgent(null);
      }
  };

  return (
    <div className="flex h-screen w-screen bg-neon-bg overflow-hidden relative">
      <Sidebar stats={stats} logs={logs} />
      
      <main className="flex-1 relative cursor-crosshair">
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
        />
        
        {/* CRT Scanline Overlay for the whole screen effect */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-150 contrast-150 mix-blend-overlay"></div>
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.9)]"></div>
        
        <HUD onCommand={handleCommand} fps={stats.fps} />

        {/* Floating Tooltip */}
        {hoveredAgent && (
          <div 
            className="fixed z-50 pointer-events-none bg-neon-dark/95 border border-neon-cyan/50 backdrop-blur-md p-3 rounded shadow-[0_0_15px_rgba(0,243,255,0.2)] text-xs font-mono"
            style={{
                left: tooltipPos.x + 15,
                top: tooltipPos.y + 15
            }}
          >
            <div className="text-neon-cyan font-bold mb-1">AGENT #{hoveredAgent.id}</div>
            <div className="text-gray-300">State: <span className={hoveredAgent.state === 'EVACUATING' ? 'text-neon-red animate-pulse' : 'text-neon-green'}>{hoveredAgent.state}</span></div>
            <div className="text-gray-400 mt-1">Grid: [{hoveredAgent.gridX}, {hoveredAgent.gridY}]</div>
            <div className="text-gray-500 mt-1">Speed: {(hoveredAgent.speedMultiplier * 100).toFixed(0)}%</div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;