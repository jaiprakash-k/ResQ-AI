export enum AgentState {
  IDLE = 'IDLE',
  FLEEING = 'FLEEING',
  EVACUATING = 'EVACUATING',
  DEAD = 'DEAD',
  EVACUATED = 'EVACUATED'
}

export interface Coordinates {
  x: number;
  y: number;
}

export interface GridNode extends Coordinates {
  isWall: boolean;
  isFire: boolean;
  isFlooded: boolean;
  isSafeZone: boolean;
  gCost?: number; // For pathfinding
  hCost?: number;
  parent?: GridNode | null;
}

export interface Agent {
  id: number;
  x: number; // Visual X (interpolated)
  y: number; // Visual Y (interpolated)
  gridX: number; // Logical Grid X
  gridY: number; // Logical Grid Y
  targetGridX: number | null; // Moving towards
  targetGridY: number | null;
  state: AgentState;
  speedMultiplier: number;
  path: Coordinates[]; // Queue of nodes to visit
  progress: number; // 0.0 to 1.0 between grid nodes
  history: Coordinates[]; // For particle trails
}

export interface SimulationStats {
  activeAgents: number;
  casualties: number;
  evacuated: number;
  fps: number;
  timeElapsed: number;
  evacuationHistory: number[]; // For sparkline
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'alert' | 'success' | 'danger';
}

export interface SimConfig {
  gridCols: number;
  gridRows: number;
  cellSize: number;
  tickRate: number;
  seed: number;
}