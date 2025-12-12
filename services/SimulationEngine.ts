import { Agent, AgentState, Coordinates, GridNode, SimConfig, SimulationStats } from '../types';
import { THEME, BASE_SPEED, FLOOD_SPEED_MODIFIER, PANIC_SPEED_MODIFIER, TRAIL_LENGTH } from '../constants';

export class SimulationEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  config: SimConfig;
  
  grid: GridNode[][] = [];
  agents: Agent[] = [];
  
  frameCount = 0;
  isRunning = true;
  showHeatmap = false;
  
  stats: SimulationStats = {
    activeAgents: 0,
    casualties: 0,
    evacuated: 0,
    fps: 60,
    timeElapsed: 0,
    evacuationHistory: new Array(60).fill(0)
  };

  private lastTime = 0;
  private evacHistoryTimer = 0;
  private onStatsUpdate: (stats: SimulationStats) => void;
  private onLog: (msg: string, type: 'info' | 'alert' | 'success' | 'danger') => void;

  constructor(
    canvas: HTMLCanvasElement, 
    onStatsUpdate: (stats: SimulationStats) => void,
    onLog: (msg: string, type: 'info' | 'alert' | 'success' | 'danger') => void
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.onStatsUpdate = onStatsUpdate;
    this.onLog = onLog;
    
    // Default config, will be resized
    this.config = {
      gridCols: 24,
      gridRows: 16,
      cellSize: 32,
      tickRate: 1,
      seed: 123
    };

    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Seeded RNG helper
    this.srand(this.config.seed);
  }

  // --- RNG ---
  private seedVal = 1;
  private srand(seed: number) { this.seedVal = seed; }
  private random() {
    const x = Math.sin(this.seedVal++) * 10000;
    return x - Math.floor(x);
  }
  private randomInt(min: number, max: number) {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  // --- Initialization ---
  public init(agentCount: number = 50) {
    this.generateGrid();
    this.agents = [];
    this.stats = {
        activeAgents: 0,
        casualties: 0,
        evacuated: 0,
        fps: 60,
        timeElapsed: 0,
        evacuationHistory: new Array(60).fill(0)
    };
    this.spawnAgents(agentCount);
    this.onLog(`System Online. Type 'fire', 'flood', or 'evacuate' to begin.`, 'info');
  }

  private generateGrid() {
    this.grid = [];
    for (let y = 0; y < this.config.gridRows; y++) {
      const row: GridNode[] = [];
      for (let x = 0; x < this.config.gridCols; x++) {
        row.push({
          x, y,
          isWall: false, // Could generate random walls here
          isFire: false,
          isFlooded: false,
          isSafeZone: false
        });
      }
      this.grid.push(row);
    }
  }

  public spawnAgents(count: number) {
    for (let i = 0; i < count; i++) {
      const gx = this.randomInt(1, this.config.gridCols - 2);
      const gy = this.randomInt(1, this.config.gridRows - 2);
      
      this.agents.push({
        id: Math.floor(this.random() * 100000),
        x: gx,
        y: gy,
        gridX: gx,
        gridY: gy,
        targetGridX: null,
        targetGridY: null,
        state: AgentState.IDLE,
        speedMultiplier: 1.0,
        path: [],
        progress: 0,
        history: []
      });
    }
    this.stats.activeAgents = this.agents.filter(a => a.state !== AgentState.DEAD && a.state !== AgentState.EVACUATED).length;
  }

  // --- Core Loop ---
  public loop(timestamp: number) {
    if (!this.isRunning) {
      this.lastTime = timestamp;
      requestAnimationFrame(this.loop.bind(this));
      return;
    }

    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // FPS Calc
    if (this.frameCount % 20 === 0) {
      this.stats.fps = Math.round(1000 / (deltaTime || 16));
    }

    // Timer Update
    this.evacHistoryTimer += deltaTime;
    if (this.evacHistoryTimer > 1000) {
        this.evacHistoryTimer = 0;
        this.stats.timeElapsed++;
        this.stats.evacuationHistory.shift();
        this.stats.evacuationHistory.push(this.stats.evacuated);
        // Only trigger React update once per second
        this.onStatsUpdate({...this.stats});
    }

    this.update();
    this.draw();
    
    this.frameCount++;
    requestAnimationFrame(this.loop.bind(this));
  }

  private update() {
    let active = 0;
    
    for (const agent of this.agents) {
      if (agent.state === AgentState.DEAD || agent.state === AgentState.EVACUATED) continue;
      active++;

      const currentNode = this.grid[agent.gridY][agent.gridX];

      // Check Hazards
      if (currentNode.isFire) {
        agent.state = AgentState.DEAD;
        this.stats.casualties++;
        this.onLog(`Agent ${agent.id} terminated by fire.`, 'danger');
        continue;
      }

      if (currentNode.isSafeZone) {
        agent.state = AgentState.EVACUATED;
        this.stats.evacuated++;
        this.onLog(`Agent ${agent.id} safely evacuated.`, 'success');
        continue;
      }

      // Speed Calc
      let moveSpeed = BASE_SPEED * (currentNode.isFlooded ? FLOOD_SPEED_MODIFIER : 1.0);
      if (agent.state === AgentState.EVACUATING) moveSpeed *= PANIC_SPEED_MODIFIER;
      
      agent.speedMultiplier = moveSpeed;

      // Movement Logic
      if (agent.targetGridX === null) {
        // We need a target
        if (agent.path.length > 0) {
            // Follow path
            const next = agent.path.shift()!;
            agent.targetGridX = next.x;
            agent.targetGridY = next.y;
        } else {
            // No path, pick random neighbor or stay idle
            if (agent.state === AgentState.EVACUATING) {
                // If evacuating but no path, try to recalc (fallback)
                this.calculatePath(agent, this.findSafeZone());
            } else {
                // Random wander
                const neighbors = this.getNeighbors(agent.gridX, agent.gridY);
                if (neighbors.length > 0) {
                    const next = neighbors[this.randomInt(0, neighbors.length - 1)];
                    agent.targetGridX = next.x;
                    agent.targetGridY = next.y;
                }
            }
        }
      }

      // Interpolate Motion
      if (agent.targetGridX !== null && agent.targetGridY !== null) {
        agent.progress += moveSpeed;
        
        // Linear Interpolation for visual smoothness
        agent.x = agent.gridX + (agent.targetGridX - agent.gridX) * agent.progress;
        agent.y = agent.gridY + (agent.targetGridY - agent.gridY) * agent.progress;

        // Visual jitter for separation
        const jitterX = (Math.sin(agent.id + this.frameCount * 0.05) * 0.15);
        const jitterY = (Math.cos(agent.id + this.frameCount * 0.05) * 0.15);
        agent.x += jitterX;
        agent.y += jitterY;

        // Trail
        if (this.frameCount % 5 === 0) {
            agent.history.push({x: agent.x, y: agent.y});
            if (agent.history.length > TRAIL_LENGTH) agent.history.shift();
        }

        // Arrival
        if (agent.progress >= 1.0) {
            agent.gridX = agent.targetGridX;
            agent.gridY = agent.targetGridY;
            agent.x = agent.gridX; // Snap
            agent.y = agent.gridY;
            agent.progress = 0;
            agent.targetGridX = null;
            agent.targetGridY = null;
        }
      }
    }
    
    this.stats.activeAgents = active;
  }

  // --- Rendering ---
  private draw() {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const cs = this.config.cellSize;

    // Clear
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, cw, ch);

    // 1. Draw Grid
    ctx.strokeStyle = THEME.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= this.config.gridCols; x++) {
        ctx.moveTo(x * cs, 0);
        ctx.lineTo(x * cs, ch);
    }
    for (let y = 0; y <= this.config.gridRows; y++) {
        ctx.moveTo(0, y * cs);
        ctx.lineTo(cw, y * cs);
    }
    ctx.stroke();

    // 2. Nodes
    ctx.fillStyle = THEME.grid;
    for(let y=0; y<this.config.gridRows; y++) {
        for(let x=0; x<this.config.gridCols; x++) {
            ctx.fillRect(x*cs - 1, y*cs - 1, 2, 2);
        }
    }

    // 3. Hazards
    for(let y=0; y<this.config.gridRows; y++) {
        for(let x=0; x<this.config.gridCols; x++) {
            const node = this.grid[y][x];
            
            if (node.isFire) {
                // Fire Bloom
                const cx = x * cs + cs/2;
                const cy = y * cs + cs/2;
                const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, cs * 1.5);
                grad.addColorStop(0, 'rgba(255, 100, 50, 0.9)');
                grad.addColorStop(0.5, 'rgba(255, 42, 42, 0.5)');
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.fillRect(x*cs, y*cs, cs, cs);
            }
            else if (node.isFlooded) {
                ctx.fillStyle = THEME.flood;
                ctx.fillRect(x*cs, y*cs, cs, cs);
                // Ripple effect
                if ((x + y + Math.floor(this.frameCount/20)) % 2 === 0) {
                   ctx.fillStyle = 'rgba(42, 138, 255, 0.1)';
                   ctx.fillRect(x*cs+2, y*cs+2, cs-4, cs-4); 
                }
            } else if (node.isSafeZone) {
                // Safe Zone Bloom
                const cx = x * cs + cs/2;
                const cy = y * cs + cs/2;
                const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, cs);
                grad.addColorStop(0, THEME.safe);
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.fillRect(x*cs, y*cs, cs, cs);
                
                // Icon
                ctx.fillStyle = '#fff';
                ctx.font = '12px monospace';
                ctx.fillText('EVAC', x*cs + 4, y*cs + 20);
            }
        }
    }

    // 4. Agents
    for (const agent of this.agents) {
        if (agent.state === AgentState.DEAD || agent.state === AgentState.EVACUATED) continue;

        const screenX = agent.x * cs + cs/2;
        const screenY = agent.y * cs + cs/2;

        // Trails
        if (agent.history.length > 1) {
            ctx.strokeStyle = `rgba(0, 243, 255, 0.3)`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            for(let i=agent.history.length-1; i>=0; i--) {
                const p = agent.history[i];
                ctx.lineTo(p.x * cs + cs/2, p.y * cs + cs/2);
            }
            ctx.stroke();
        }

        // Body
        ctx.fillStyle = agent.state === AgentState.EVACUATING ? '#fff' : THEME.agent;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 4, 0, Math.PI * 2);
        ctx.fill();

        // State indicator
        if (agent.state === AgentState.EVACUATING) {
            ctx.strokeStyle = THEME.red;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 6 + Math.sin(this.frameCount * 0.2) * 2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // 5. Heatmap Overlay
    if (this.showHeatmap) {
        // Simple density map
        const density = new Map<string, number>();
        for(const a of this.agents) {
            if(a.state === AgentState.DEAD || a.state === AgentState.EVACUATED) continue;
            const key = `${Math.round(a.x)},${Math.round(a.y)}`;
            density.set(key, (density.get(key) || 0) + 1);
        }
        
        density.forEach((count, key) => {
            const [x, y] = key.split(',').map(Number);
            const intensity = Math.min(count / 5, 1);
            ctx.fillStyle = `rgba(255, 0, 255, ${intensity * 0.6})`;
            ctx.fillRect(x*cs, y*cs, cs, cs);
        });
    }
  }

  // --- Helper: Get Agent At Position ---
  public getAgentAt(x: number, y: number): Agent | null {
    const cs = this.config.cellSize;
    // Simple radius check
    for (const agent of this.agents) {
        if (agent.state === AgentState.DEAD || agent.state === AgentState.EVACUATED) continue;
        
        const screenX = agent.x * cs + cs/2;
        const screenY = agent.y * cs + cs/2;
        const dist = Math.hypot(x - screenX, y - screenY);
        
        if (dist < 15) { // 15px radius tolerance
            return agent;
        }
    }
    return null;
  }

  // --- Pathfinding (BFS) ---
  private calculatePath(agent: Agent, target: Coordinates | null) {
    if (!target) return;
    
    // BFS to find shortest path
    const startNode = this.grid[agent.gridY][agent.gridX];
    const endNode = this.grid[target.y][target.x];

    const queue: GridNode[] = [];
    const visited = new Set<string>();
    const cameFrom = new Map<string, GridNode>();

    queue.push(startNode);
    visited.add(`${startNode.x},${startNode.y}`);
    
    let found = false;
    let current: GridNode | null = null;

    while (queue.length > 0) {
        current = queue.shift()!;
        if (current === endNode) {
            found = true;
            break;
        }

        const neighbors = this.getNeighbors(current.x, current.y);
        for (const n of neighbors) {
            const key = `${n.x},${n.y}`;
            if (!visited.has(key) && !n.isWall && !n.isFire) { // Avoid Fire
                visited.add(key);
                cameFrom.set(key, current);
                queue.push(n);
            }
        }
    }

    if (found && current) {
        const path: Coordinates[] = [];
        let curr: GridNode | undefined = current;
        while (curr && curr !== startNode) {
            path.unshift({x: curr.x, y: curr.y});
            const key = `${curr.x},${curr.y}`;
            curr = cameFrom.get(key);
        }
        agent.path = path;
    }
  }

  private getNeighbors(x: number, y: number): GridNode[] {
    const res: GridNode[] = [];
    // Manhattan neighbors: Up, Down, Left, Right
    if (y > 0) res.push(this.grid[y - 1][x]);
    if (y < this.config.gridRows - 1) res.push(this.grid[y + 1][x]);
    if (x > 0) res.push(this.grid[y][x - 1]);
    if (x < this.config.gridCols - 1) res.push(this.grid[y][x + 1]);
    return res;
  }

  private findSafeZone(): Coordinates | null {
      for(let y=0; y<this.config.gridRows; y++) {
          for(let x=0; x<this.config.gridCols; x++) {
              if (this.grid[y][x].isSafeZone) return {x, y};
          }
      }
      return null;
  }

  // --- Commands ---
  public executeCommand(cmd: string) {
    const parts = cmd.toLowerCase().trim().split(' ');
    const command = parts[0];

    switch(command) {
        case 'fire':
            this.triggerFire();
            break;
        case 'flood':
            this.triggerFlood();
            break;
        case 'evacuate':
            this.triggerEvacuate();
            break;
        case 'clear':
            this.clearHazards();
            break;
        case 'spawn':
            const count = parseInt(parts[1]) || 10;
            this.spawnAgents(count);
            this.onLog(`Reinforcements arrived: ${count} agents spawned.`, 'info');
            break;
        case 'heatmap':
            this.showHeatmap = !this.showHeatmap;
            this.onLog(`Heatmap overlay ${this.showHeatmap ? 'ENABLED' : 'DISABLED'}.`, 'info');
            break;
        default:
            this.onLog(`Unknown command: ${command}`, 'alert');
    }
  }

  private triggerFire() {
    // Random 3x3
    const rx = this.randomInt(2, this.config.gridCols - 4);
    const ry = this.randomInt(2, this.config.gridRows - 4);
    
    let nodesCount = 0;
    for(let y=ry; y<ry+3; y++) {
        for(let x=rx; x<rx+3; x++) {
            this.grid[y][x].isFire = true;
            nodesCount++;
        }
    }
    this.onLog(`ALERT: Fire outbreak reported at sector [${rx},${ry}].`, 'danger');
    
    // Trigger repath for nearby agents? 
    // For simplicity, agents pathfind on next update if blocked
  }

  private triggerFlood() {
    const startY = Math.floor(this.config.gridRows / 2);
    let cells = 0;
    for(let y=startY; y<this.config.gridRows; y++) {
        for(let x=0; x<this.config.gridCols; x++) {
            this.grid[y][x].isFlooded = true;
            cells++;
        }
    }
    this.onLog(`WARNING: Structural breach. Flood waters entering lower sectors.`, 'alert');
  }

  private triggerEvacuate() {
    // 1. Create Safe Zone (Top Left)
    const sx = 2, sy = 2;
    // Make a 2x2 safe zone
    this.grid[sy][sx].isSafeZone = true;
    this.grid[sy+1][sx].isSafeZone = true;
    this.grid[sy][sx+1].isSafeZone = true;
    this.grid[sy+1][sx+1].isSafeZone = true;

    // 2. Alert Agents
    this.agents.forEach(a => {
        if (a.state !== AgentState.DEAD && a.state !== AgentState.EVACUATED) {
            a.state = AgentState.EVACUATING;
            this.calculatePath(a, {x: sx, y: sy});
        }
    });
    this.onLog(`PROTOCOL OMEGA: All personnel proceed to evacuation zone [${sx},${sy}].`, 'info');
  }

  private clearHazards() {
    for(let y=0; y<this.config.gridRows; y++) {
        for(let x=0; x<this.config.gridCols; x++) {
            const n = this.grid[y][x];
            n.isFire = false;
            n.isFlooded = false;
            n.isSafeZone = false;
        }
    }
    // Reset agents to IDLE if they were fleeing?
    this.agents.forEach(a => {
        if(a.state === AgentState.EVACUATING) a.state = AgentState.IDLE;
        a.path = [];
    });
    this.onLog(`All hazards cleared. System status: NORMAL.`, 'success');
  }

  public resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        
        // Recalculate grid size based on cell size or vice versa
        // Let's stick to fixed grid dimensions and scale visual size
        const idealCellW = this.canvas.width / this.config.gridCols;
        const idealCellH = this.canvas.height / this.config.gridRows;
        this.config.cellSize = Math.min(idealCellW, idealCellH);
    }
  }

  public click(x: number, y: number) {
      const gx = Math.floor(x / this.config.cellSize);
      const gy = Math.floor(y / this.config.cellSize);

      if (gx >= 0 && gx < this.config.gridCols && gy >= 0 && gy < this.config.gridRows) {
          const node = this.grid[gy][gx];
          // Toggle wall
          node.isWall = !node.isWall;
          this.onLog(`Manual override: Node [${gx},${gy}] ${node.isWall ? 'LOCKED' : 'UNLOCKED'}.`, 'info');
      }
  }
}