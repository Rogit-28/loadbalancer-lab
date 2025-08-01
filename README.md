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
