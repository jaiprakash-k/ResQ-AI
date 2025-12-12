export const THEME = {
  bg: '#02030a',
  grid: '#111827',
  gridLine: '#1f2937',
  agent: '#00f3ff',
  agentDead: '#4b5563',
  fire: '#ef4444',
  flood: 'rgba(42, 138, 255, 0.4)',
  safe: '#10b981',
  text: '#e5e7eb',
  red: '#ef4444'
};

export const INITIAL_AGENTS = 50;
export const DEFAULT_GRID_COLS = 32;
export const DEFAULT_GRID_ROWS = 20;
export const TRAIL_LENGTH = 8;
export const BASE_SPEED = 0.05; // Grid cells per tick
export const FLOOD_SPEED_MODIFIER = 0.4;
export const PANIC_SPEED_MODIFIER = 1.5;

export const COMMANDS = [
  { cmd: 'fire', desc: 'Ignite random 3x3 sector' },
  { cmd: 'flood', desc: 'Flood southern sectors' },
  { cmd: 'evacuate', desc: 'Signal global evacuation' },
  { cmd: 'clear', desc: 'Reset hazards' },
  { cmd: 'spawn <n>', desc: 'Add agents' },
  { cmd: 'heatmap', desc: 'Toggle density view' }
];