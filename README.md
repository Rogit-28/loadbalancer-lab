# LoadBalancerLab

An interactive educational tool for understanding distributed systems load balancing. Explore load balancing algorithms through simulation mode, or test real-world concepts with live mode using actual HTTP servers. Built with React, TypeScript, Node.js, and WebSockets.

## Project Overview

LoadBalancerLab provides two distinct modes to learn and test load balancing:

- **Simulation Mode**: Watch algorithms distribute traffic across simulated servers with real-time metrics and interactive controls.
- **Live Mode**: Run actual HTTP servers and experience real load balancing with health checking, circuit breakers, and genuine network traffic.

**Access the Dashboard**: http://localhost:3000

## Features

### Simulation Mode

✅ **5 Load Balancing Algorithms:**
- Round Robin (sequential distribution)
- Weighted Round Robin (capacity-based distribution)
- Least Connections (fewest active connections)
- IP Hash (client IP-based routing)
- Random (random server selection)

✅ **Real-Time Simulation:**
- Live metrics update every second
- WebSocket connection for instant updates
- Response time percentiles (P50, P95, P99)
- Request rate, error rate, throughput tracking

✅ **Interactive Controls:**
- Switch algorithms in real-time
- Add/remove/configure servers (weight, capacity)
- Adjust traffic rate (1-10,000 req/s)
- Change patterns (steady, burst, spike)
- Simulation speed control (1-10x)

✅ **Visualizations:**
- Dark, sleek dashboard with TailwindCSS
- Recharts.js for interactive charts
- Real-time line charts (response times, request rates)
- Pie chart for request distribution
- Bar charts for server metrics
- Color-coded server health indicators

### Live Mode

✅ **Real HTTP Proxy:**
- Actual HTTP proxy on port 8080 routing real traffic
- Real worker servers on ports 4001+ with HTTP request handling
- Dynamic worker management (add/remove at runtime)

✅ **Health Checking & Reliability:**
- Real-time health checks every 2 seconds (configurable)
- Automatic detection and isolation of unhealthy servers
- Circuit breaker pattern with three states: closed, open, half-open
- Configurable failure threshold (default 5) and reset timeout (default 30s)

✅ **Real-Time Metrics:**
- Measured response times from actual HTTP requests
- Response time percentiles (P50, P95, P99)
- Real throughput and request distribution tracking
- Live worker status and circuit breaker state visibility

✅ **Mode Flexibility:**
- Toggle between simulation and live modes via UI
- Switch algorithms live without restarting
- Start/stop live mode workers with one click

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

## Installation

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

### Install Dependencies

```bash
# Install all dependencies for both backend and frontend
npm install

# Or install separately
cd backend && npm install
cd frontend && npm install
```

## Running the Project

### Method 1: Run Both Services (Recommended)

```bash
# From the project root
npm run dev

# This starts:
# - Backend WebSocket server on http://localhost:3001
# - Frontend React app on http://localhost:3000
# - Live mode proxy ready on http://localhost:8080
```

### Method 2: Run Services Separately

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Method 3: Run Compiled Version

```bash
# Build backend
cd backend
npm run build
node dist/index.js

# In another terminal, start frontend
cd frontend
npm run dev
```

## Access the Dashboard

Once both services are running, open your browser:

**http://localhost:3000**

## Getting Started

### Simulation Mode

#### 1. Start the Simulation

Click the **green "Start Simulation"** button in the Simulation Status panel.

#### 2. Select an Algorithm

Use the radio buttons in the **Algorithm Selector** to switch between:
- **Round Robin**: Fair, sequential distribution
- **Weighted Round Robin**: Distribution based on server weight
- **Least Connections**: Routes to server with fewest active connections
- **IP Hash**: Consistent routing based on client IP
- **Random**: Random server selection

Watch the **Server Distribution** charts update in real-time as you switch algorithms.

#### 3. Configure Traffic

In the **Traffic Configuration** panel:

- **Request Rate**: Slide to adjust (1-10,000 requests/sec)
- **Simulation Speed**: Control simulation speed (0.1x - 10x)
- **Pattern**: Choose between:
  - **Steady**: Constant rate
  - **Burst**: Occasional traffic spikes
  - **Spike**: High-intensity spikes

#### 4. Manage Servers

Use the **Servers** panel to:

- **Add Server**: Click "Add Server" button
- **Remove Server**: Click "Remove" on any server card
- **Adjust Weight**: Use slider for Weighted Round Robin (1-10)
- **Adjust Capacity**: Use slider (50-200)

Watch how changes affect the **metrics** and **charts** in real-time.

#### 5. Monitor Metrics

The dashboard shows:

- **Metrics Cards**: Total Requests, Avg Response Time, Error Rate, Throughput, Active Connections
- **Response Time Chart**: P50, P95, P99 latency over time
- **Request Rate Chart**: Requests per second
- **Server Distribution**: Pie chart and bar chart with error rate color coding

### Live Mode

#### 1. Switch to Live Mode

Use the **mode toggle** in the top navigation to switch from Simulation to Live mode.

#### 2. Start Live Workers

Click **"Start Live Mode"** to spin up actual HTTP worker servers. These start on ports 4001, 4002, etc.

#### 3. Send Real Traffic

Use curl or any HTTP client to send requests to the proxy:

```bash
# Simple request
curl http://localhost:8080/api/test

# Multiple requests
for i in {1..10}; do curl http://localhost:8080/api/test; done

# With custom path
curl http://localhost:8080/api/custom-path
```

#### 4. Monitor Live Metrics

Watch the dashboard update with:
- Real response times from actual HTTP requests
- Worker health status (healthy/unhealthy)
- Circuit breaker states for each worker
- Real-time request distribution

#### 5. Manage Workers

In the **Worker Management** panel:

- **Add Worker**: Adds a new worker to the pool
- **Remove Worker**: Removes a worker from the pool
- **View Status**: See health and circuit breaker state for each

#### 6. Change Algorithm

The same 5 algorithms apply to live mode. Switch them in real-time while traffic flows.

## Data Flow

### Simulation Mode

1. **Traffic Generator** creates synthetic requests at configured rate
2. **Load Balancer** routes based on selected algorithm
3. **Server Pool** processes requests (with realistic CPU/memory simulation)
4. **Metrics Collector** calculates percentiles and rates
5. **WebSocket Server** broadcasts metrics to all connected clients
6. **React Dashboard** receives updates and renders real-time charts

### Live Mode

1. **HTTP Proxy** receives incoming traffic on port 8080
2. **Load Balancer** routes using selected algorithm
3. **Health Checker** probes workers every 2 seconds
4. **Circuit Breaker** manages failure states and recovery
5. **Worker Servers** process real HTTP requests
6. **Metrics Collector** measures actual response times
7. **WebSocket Server** broadcasts live metrics and events
8. **React Dashboard** displays real-time status and metrics

## API Endpoints

### REST API (Port 3001)

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

**Client to Server:**
- `get-mode` - Request current mode (simulation or live)
- `switch-mode` - Change between simulation and live
- `get-config` - Request current configuration (sim mode)
- `update-algorithm` - Change load balancing algorithm
- `update-traffic` - Update traffic settings (sim mode)
- `add-server` - Add server (sim mode)
- `remove-server` - Remove server (sim mode)
- `update-server` - Update server properties (sim mode)
- `start-simulation` - Start simulation traffic
- `stop-simulation` - Stop simulation traffic
- `live-start` - Start live mode workers
- `live-stop` - Stop live mode workers
- `live-add-worker` - Add worker to live pool
- `live-remove-worker` - Remove worker from live pool

**Server to Client:**
- `mode-update` - Broadcast mode change (simulation or live)
- `config-update` - Broadcast configuration changes (sim mode)
- `metrics-update` - Broadcast metrics every second
- `live-metrics-update` - Broadcast live mode metrics every second
- `live-workers-update` - Broadcast worker status changes
- `live-request-log` - Broadcast batch of requests

## Performance

### Simulation Mode
- Supports up to 10,000 concurrent simulated requests
- Metrics update every 1 second
- Smooth 60fps UI animations
- Efficient WebSocket communication
- Minimal memory footprint with request history rotation

### Live Mode
- Real HTTP traffic handling
- Actual response time measurement
- Health checks every 2 seconds (configurable)
- Circuit breaker recovery in 30 seconds (configurable)
- Can run up to 10 workers simultaneously

## Configuration

Live mode is highly configurable via environment variables. These are read from `backend/src/config.ts`:

```bash
# Backend and proxy ports
PORT=3001                      # Backend API port (default 3001)
PROXY_PORT=8080               # Live mode proxy port (default 8080)
WORKER_BASE_PORT=4001         # First worker port (default 4001)

# Worker management
WORKER_COUNT=3                # Number of workers to start (default 3)
