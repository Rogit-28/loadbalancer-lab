# LoadBalancerLab

An interactive educational platform for learning load balancing and distributed systems. This isn't just another tutorial—you get hands-on experience with real algorithms, real HTTP traffic, and a beautiful dashboard showing everything that happens in real-time.

The project has two distinct modes: run simulations to understand the algorithms, or switch to live mode and watch the load balancer route actual HTTP requests through real worker servers with health checking and circuit breakers.

## Why I Built This

Most resources about load balancing are either totally theoretical (too abstract) or production-grade systems (too complicated). LoadBalancerLab fills the middle ground. You can see exactly how Round Robin differs from Least Connections, what happens when a server fails, how the circuit breaker pattern saves you from cascading failures. And unlike static demos, you're working with real network traffic and real responses.

Built with React, TypeScript, Node.js, Express, and Socket.IO for real-time dashboards.

## What You'll Learn

This project covers core distributed systems concepts hands-on:

- Load balancing algorithms (Round Robin, Weighted, Least Connections, IP Hash, Random)
- Health checking patterns and failure detection
- Circuit breaker pattern for fault tolerance and recovery
- Real-time metrics and observability
- HTTP reverse proxy design
- WebSocket communication for real-time dashboards
- Node.js process management

## Quick Start

Get up and running in under a minute:

```bash
# Install dependencies (all packages for backend and frontend)
npm install

# Start everything (backend + frontend + live mode proxy)
npm run dev

# Open your browser
# http://localhost:3000
```

That's it. The dashboard opens, and you're ready to explore.

## Project Overview

LoadBalancerLab runs in two modes, each with a different purpose:

**Simulation Mode:** Run synthetic traffic against simulated servers. Switch algorithms instantly, adjust traffic patterns, add/remove servers, and watch real-time charts. Perfect for understanding how each algorithm behaves under different conditions.

**Live Mode:** Spin up actual HTTP worker servers, route real traffic through a working proxy, and see genuine response times and failures. This is where simulation meets reality. You can trigger real health checks, watch circuit breakers open and close, and understand what load balancing actually does in a real system.

Access the dashboard at **http://localhost:3000**

## Features

### Simulation Mode

Run synthetic load against a virtual server pool. Ideal for testing algorithms without spinning up real infrastructure.

**5 Load Balancing Algorithms:**
- Round Robin: Distribute sequentially across all servers. Use when you have balanced capacity and want simplicity.
- Weighted Round Robin: Distribute based on assigned weights. Use when servers have different capacity levels.
- Least Connections: Always route to the server handling the fewest active connections. Use for long-lived connections (WebSockets, persistent sessions).
- IP Hash: Route based on client IP for consistency. Use when you need session affinity across requests.
- Random: Route randomly. Use as a simple baseline or when true randomness is acceptable.

**Real-Time Simulation:**
- Metrics update every second via WebSocket
- Response time percentiles tracked (P50, P95, P99)
- Request rate, error rate, and throughput calculated live
- Adjustable simulation speed (0.1x to 10x) to compress or slow time

**Interactive Controls:**
- Switch algorithms on the fly and watch metrics update instantly
- Add or remove servers and see how the load rebalances
- Adjust traffic rate (1 to 10,000 requests per second)
- Choose traffic patterns: steady, burst, or spike
- Tweak server capacity and weight to simulate real-world scenarios

**Visualizations:**
- Dark mode dashboard built with TailwindCSS
- Interactive charts powered by Recharts
- Real-time line charts for response times and request rates
- Pie and bar charts for request distribution
- Color-coded server health indicators

### Live Mode

This is where things get real. Start actual Node.js worker servers and send them real HTTP traffic through a working reverse proxy. See health checks fail servers, watch circuit breakers open under load, and get genuine response time measurements.

**Real HTTP Proxy:**
- Full HTTP reverse proxy on port 8080 that routes real traffic
- Worker servers on ports 4001, 4002, etc. that handle actual requests
- Add or remove workers at runtime without stopping traffic

**Health Checking & Reliability:**
- Automatic health checks every 2 seconds (configurable)
- Unhealthy servers get isolated from traffic automatically
- Circuit breaker pattern with three states: closed (healthy), open (failing hard), half-open (recovery attempt)
- Configurable failure thresholds and recovery timeouts
- Real monitoring of circuit breaker state for each worker

**Real-Time Metrics:**
- Actual measured response times from HTTP requests
- Response percentiles (P50, P95, P99) calculated from real data
- Genuine throughput and request distribution tracking
- Live visibility into worker health status and circuit breaker state

**Flexible Mode Switching:**
- Toggle between simulation and live modes without restarting
- Change algorithms on live traffic without dropping requests
- Start or stop workers with a single click

## Quick Tour

### Running Simulation Mode

1. Start the app with `npm run dev` and open http://localhost:3000
2. Click "Start Simulation" in the Simulation Status panel
3. Select an algorithm using the radio buttons (Round Robin, Weighted, Least Connections, IP Hash, Random)
4. Watch the charts update as traffic flows. Try switching algorithms and see the distribution change.
5. Adjust the traffic rate slider to increase load
6. Add a new server and watch the system rebalance traffic
7. Add another server but give it lower weight or capacity to simulate a weaker machine
8. Try the different traffic patterns (steady, burst, spike) and watch how each algorithm handles spikes

The key insight: some algorithms handle bursts better, some are fairer, some are faster. You'll see the tradeoffs play out in real numbers.

### Running Live Mode

1. Make sure you've started the app with `npm run dev`
2. Click the mode toggle to switch to Live Mode
3. Click "Start Live Mode" to spin up 3 worker servers
4. Open a terminal and send some requests:
   ```bash
   # Single request
   curl http://localhost:8080/api/test

   # Rapid fire requests
   for i in {1..100}; do curl http://localhost:8080/api/test; done

   # From another terminal, keep watching the dashboard
   ```
5. Watch the dashboard show real response times and request distribution
6. While traffic is flowing, remove a worker and watch the circuit breaker open and then recover
7. Try different algorithms in live mode—the requests keep flowing while you switch
8. Add new workers and watch traffic rebalance to them

This is the powerful part: you're not simulating. Real HTTP servers are running. Real requests are flowing. Real failures are happening. And you can see it all in the dashboard.

## Architecture

### Simulation Mode

```
┌─────────────────┐      ┌─────────────────┐      ┌──────────────────┐
│   React Frontend│      │ WebSocket Backend│      │   Server Pool    │
│   (Port 3000)   │      │   (Port 3001)    │      │                  │
├─────────────────┤      ├─────────────────┤      ├──────────────────┤
│ • Vite          │◄────►│ • Express       │◄────►│ • Algorithms     │
│ • TypeScript    │      │ • Socket.IO     │      │ • Traffic Gen    │
│ • Zustand       │      │ • TypeScript    │      │ • Metrics        │
│ • Recharts      │      │ • Real-time     │      │ • Server Sim     │
│ • TailwindCSS   │      │ • Metrics       │      └──────────────────┘
└─────────────────┘      └─────────────────┘
```

The frontend connects via WebSocket to receive metric updates every second. The backend runs the simulation engine, generates synthetic traffic, applies the selected load balancing algorithm, and collects metrics like response time percentiles and throughput.

### Live Mode

```
┌──────────────┐      ┌──────────────┐      ┌────────────┐      ┌────────────────┐
│   Frontend   │      │  Backend API │      │  HTTP Proxy│      │   Worker Pool  │
│ (Port 3000)  │      │ (Port 3001)  │      │(Port 8080) │      │  (Ports 4001+) │
├──────────────┤      ├──────────────┤      ├────────────┤      ├────────────────┤
│ • Mode UI    │      │ • WebSocket  │      │ • Routes   │◄────►│ • HTTP Servers │
│ • Dashboard  │◄────►│ • Mode Mgmt  │◄────►│ • Balances │      │ • Processes    │
│ • Metrics    │      │ • Health Chk │      │ • Metrics  │      │ • Handles reqs │
│              │      │ • Circuit BR │      │            │      │                │
└──────────────┘      └──────────────┘      └────────────┘      └────────────────┘
                           ^
                           │ Health Checks
                           │ Real metrics
```

Real HTTP requests come in on port 8080. The proxy routes them to available workers (ports 4001+) based on the selected algorithm. The backend continuously health-checks workers, manages circuit breaker state, collects actual metrics, and broadcasts updates to the frontend via WebSocket. This is a working reverse proxy, not a simulation.

## Installation

### Prerequisites

You'll need Node.js v18 or higher and npm v9 or higher.

### Install Dependencies

```bash
# Install everything at once (backend + frontend)
npm install

# Or install them separately if you prefer
cd backend && npm install
cd ../frontend && npm install
```

## Running the Project

### Recommended: Start Everything Together

```bash
npm run dev
```

This starts:
- Backend WebSocket server on http://localhost:3001
- Frontend React app on http://localhost:3000
- Live mode proxy ready on http://localhost:8080

Open http://localhost:3000 and you're ready to go.

### Or Run Services Separately

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

### Production Build

```bash
# Build everything
npm run build

# Or build individually
cd backend && npm run build
cd frontend && npm run build

# Run the built backend
cd backend && npm start
```

## Data Flow

### Simulation Mode

1. Traffic Generator creates synthetic requests at your configured rate
2. Load Balancer receives each request and selects a server based on the algorithm
3. Server Pool simulates processing (including realistic latency based on CPU/memory load)
4. Metrics Collector calculates percentiles, throughput, error rates
5. WebSocket Server broadcasts metrics to all connected clients
6. React Dashboard renders the updated charts and stats

### Live Mode

1. HTTP Proxy receives incoming traffic on port 8080
2. Load Balancer selects a worker using the current algorithm
3. Health Checker probes workers regularly and updates their status
4. Circuit Breaker manages failure states (closed, open, half-open) per worker
5. Worker Servers process the actual HTTP request and send back real responses
6. Metrics Collector measures actual response times and request distribution
7. WebSocket Server broadcasts live metrics and worker status changes
8. React Dashboard displays real-time status, health indicators, and circuit breaker states

## API Reference

### REST Endpoints (Port 3001)

```
GET  /api/status              - System status (always available)
GET  /api/live/status         - Live mode status
GET  /api/live/workers        - List all workers (name, port, health, CB state)
POST /api/live/workers        - Add a new worker
DELETE /api/live/workers/:id  - Remove a worker
GET  /api/live/metrics        - Current live metrics (response times, throughput)
GET  /api/live/circuit-breakers - Circuit breaker states for all workers
POST /api/live/start          - Start live mode (spawn workers)
POST /api/live/stop           - Stop live mode (terminate workers)
```

### WebSocket Events (Port 3001)

**Messages You Send:**
- `get-mode` - Request the current mode (simulation or live)
- `switch-mode` - Change between simulation and live
- `get-config` - Request current configuration (sim mode only)
- `update-algorithm` - Change the load balancing algorithm
- `update-traffic` - Update traffic settings (sim mode: rate, pattern, speed)
- `add-server` - Add a new simulated server
- `remove-server` - Remove a simulated server
- `update-server` - Modify a server's properties (weight, capacity)
- `start-simulation` - Start synthetic traffic
- `stop-simulation` - Stop synthetic traffic
- `live-start` - Start live mode workers
- `live-stop` - Stop live mode workers
- `live-add-worker` - Add a worker to the pool
- `live-remove-worker` - Remove a worker from the pool

**Messages You Receive:**
- `mode-update` - Notification that mode changed
- `config-update` - Notification that configuration changed (sim mode)
- `metrics-update` - Simulation metrics broadcasted every second
- `live-metrics-update` - Live mode metrics broadcasted every second
- `live-workers-update` - Notification of worker status changes
- `live-request-log` - Batch of recent requests with routing details

## Configuration

Live mode can be configured via environment variables (read from `backend/src/config.ts`):

```bash
# API and proxy ports
PORT=3001                      # Backend API port (default 3001)
PROXY_PORT=8080               # Live mode proxy port (default 8080)
WORKER_BASE_PORT=4001         # First worker port (default 4001)

# Worker pool
WORKER_COUNT=3                # Number of workers to start (default 3)

# Health checking
HEALTH_CHECK_INTERVAL=2000    # Health check interval in ms (default 2000)

# Circuit breaker
CB_FAILURE_THRESHOLD=5        # Failed checks before opening (default 5)
CB_RESET_TIMEOUT=30000        # Time before half-open attempt (default 30000ms)
CB_HALF_OPEN_MAX=3            # Requests allowed in half-open (default 3)

# Logging
LOG_LEVEL=info                # Log level: error, warn, info, debug (default 'info')
```

Example with custom settings:

```bash
PROXY_PORT=9000 WORKER_COUNT=5 CB_FAILURE_THRESHOLD=3 npm run dev
```

## Performance

**Simulation Mode:**
- Handles up to 10,000 concurrent simulated requests
- Metrics update every second
- Smooth 60fps UI animations
- Efficient WebSocket communication
- Low memory footprint with automatic history rotation

**Live Mode:**
- Real HTTP traffic handling with actual network latency
- Genuine response time measurement
- Health checks every 2 seconds (configurable)
- Circuit breaker recovery in 30 seconds (configurable)
- Up to 10 simultaneous worker processes

## Troubleshooting

### Port Already in Use

If you see an "EADDRINUSE" error, something else is using the ports. Kill existing processes:

```bash
# Fastest way (Windows, macOS, Linux)
npx kill-port 3000 3001 8080 4001 4002 4003

# Or kill all Node processes (less precise but works)
taskkill /F /IM node.exe  # Windows
killall node              # macOS/Linux
```

Then restart with `npm run dev`.

### WebSocket Connection Fails

The dashboard won't update if the WebSocket connection drops. Try these steps:

1. Check the backend is running: `curl http://localhost:3001/api/status`
2. Look at your browser console (F12) for any errors
3. Make sure your firewall isn't blocking port 3001
4. Restart the backend with `npm run dev`

### Live Mode Workers Won't Start

If clicking "Start Live Mode" doesn't work:

1. Check the backend logs for error messages
2. Verify ports 4001+ are actually available (not used by something else)
3. Kill any stray Node processes: `taskkill /F /IM node.exe` (Windows) or `killall node` (macOS/Linux)
4. Make sure NODE_ENV is not set to 'production'
5. Try restarting the backend

### Live Proxy Not Responding

If requests to http://localhost:8080 time out:

1. Check backend logs for "Live mode started" confirmation
2. Test the proxy is listening: `curl http://localhost:8080/ -v`
3. Verify worker processes exist: `tasklist | findstr node` (Windows)
4. Restart live mode: click "Stop Live Mode" then "Start Live Mode"

### Frontend Build Errors

If you see errors when building the frontend:

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## Development

### Project Structure

```
loadbalancer-lab/
├── backend/
│   ├── src/
│   │   ├── config.ts                    # Configuration defaults
│   │   ├── logger.ts                    # Logger setup
│   │   ├── index.ts                     # Entry point
│   │   ├── algorithms.ts                # Load balancing algorithms
│   │   ├── simulator.ts                 # Simulation engine
│   │   ├── traffic-generator.ts         # Request generator
│   │   ├── server.ts                    # Server simulation
│   │   ├── types.ts                     # TypeScript interfaces
│   │   ├── modes/
│   │   │   ├── mode-manager.ts          # Mode state management
│   │   │   ├── mode-handler.ts          # Mode request handling
│   │   │   └── index.ts                 # Mode exports
│   │   ├── live-mode/
│   │   │   ├── orchestrator.ts          # Live mode coordinator
│   │   │   ├── proxy.ts                 # HTTP proxy server
│   │   │   ├── worker-server.ts         # Worker HTTP server
│   │   │   ├── process-manager.ts       # Worker process management
│   │   │   ├── health-checker.ts        # Health checking logic
│   │   │   ├── circuit-breaker.ts       # Circuit breaker pattern
│   │   │   ├── metrics-collector.ts     # Live metrics collection
│   │   │   ├── api-routes.ts            # Live mode API routes
│   │   │   └── index.ts                 # Live mode exports
│   │   └── websocket.ts                 # WebSocket event handling
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx                      # Main app component
│   │   ├── main.tsx                     # Entry point
│   │   ├── components/
│   │   │   ├── AlgorithmSelector.tsx    # Algorithm selection
│   │   │   ├── AlgorithmComparison.tsx  # Algorithm comparison
│   │   │   ├── TrafficControls.tsx      # Traffic configuration
│   │   │   ├── ServerList.tsx           # Server management (sim)
│   │   │   ├── SimulationStatus.tsx     # Sim status panel
│   │   │   ├── MetricsCards.tsx         # Metrics display
│   │   │   ├── RealTimeChart.tsx        # Charts
│   │   │   ├── ServerDistribution.tsx   # Distribution charts
│   │   │   ├── RequestLog.tsx           # Request log display
│   │   │   ├── ModeToggle.tsx           # Mode switcher
│   │   │   ├── LiveModeStatus.tsx       # Live mode status
│   │   │   └── WorkerManagement.tsx     # Live worker controls
│   │   ├── hooks/
│   │   │   ├── useSimulator.ts          # Simulation hook
│   │   │   └── useLiveMode.ts           # Live mode hook
│   │   ├── types.ts                     # Type interfaces
│   │   └── index.css                    # TailwindCSS styles
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── package.json                          # Root workspace configuration
```

### Building for Production

```bash
# Build both projects
npm run build

# Build backend only
cd backend && npm run build

# Build frontend only
cd frontend && npm run build

# Run backend in production
cd backend && npm start
```

### Running Tests

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Zustand, Recharts, TailwindCSS, Lucide Icons
- **Backend**: Node.js, Express, Socket.IO, TypeScript
- **Live Mode**: Node.js HTTP proxy implementation, real HTTP servers, health checking, circuit breaker pattern
- **Real-Time Communication**: WebSocket via Socket.IO
- **Development**: npm workspaces, TypeScript strict mode

## License

MIT

## Contributing

Pull requests welcome! This project is designed for learning load balancing and distributed systems concepts. If you have improvements, optimizations, or new algorithms to add, I'd love to see them.

## Credits

Built with React, TypeScript, Node.js, Socket.IO, and Recharts. The live mode implements HTTP reverse proxy patterns, health checking, and the circuit breaker pattern. UI powered by TailwindCSS and Lucide React icons.
