# Getting Started with Perch

## Installation

### Option 1: Install from npm (recommended)

```bash
npm install -g perch
```

### Option 2: Run from source

```bash
git clone <repo>
cd perch
npm install
npm run dev
```

## First Run

### Using the CLI

```bash
# Start Perch
perch start

# Check status
perch status

# Stop Perch
perch stop
```

### Development Mode

```bash
# From the project root
npm run dev
```

This starts both the daemon (port 7777) and the UI (port 3000).

Open **http://localhost:3000** in your browser.

## Configuration

Create a `perch.config.json` in your project root:

```json
{
  "version": "1.0",
  "groups": [
    {
      "id": "frontend",
      "name": "Frontend",
      "services": [
        {
          "id": "dev-server",
          "name": "Dev server",
          "command": "npm run dev",
          "expectedPort": 3000,
          "autoRestart": true
        }
      ]
    }
  ],
  "favorites": ["dev-server"]
}
```

## Common Recipes

### Next.js + API Server

```json
{
  "groups": [
    {
      "id": "frontend",
      "name": "Frontend",
      "services": [
        {
          "id": "next-dev",
          "name": "Next.js dev",
          "command": "npm run dev",
          "cwd": "./frontend",
          "expectedPort": 3000
        }
      ]
    },
    {
      "id": "backend",
      "name": "Backend",
      "services": [
        {
          "id": "api-dev",
          "name": "API server",
          "command": "npm run dev",
          "cwd": "./api",
          "expectedPort": 5000
        }
      ]
    }
  ]
}
```

### Monorepo Setup

```json
{
  "groups": [
    {
      "id": "web",
      "name": "Web App",
      "services": [
        { "id": "web-dev", "name": "Web dev server", "command": "npm run dev --workspace=web", "expectedPort": 3000 },
        { "id": "web-typescript", "name": "Web TypeScript", "command": "npm run type-check --workspace=web -- --watch" }
      ]
    },
    {
      "id": "api",
      "name": "API",
      "services": [
        { "id": "api-dev", "name": "API dev server", "command": "npm run dev --workspace=api", "expectedPort": 4000 }
      ]
    },
    {
      "id": "db",
      "name": "Database",
      "services": [
        { "id": "postgres", "name": "PostgreSQL", "command": "docker run -p 5432:5432 postgres:15", "expectedPort": 5432 }
      ]
    }
  ]
}
```

## Troubleshooting

**Daemon won't start**: Ensure port 7777 is free. Check `perch.config.json` for syntax errors.

**Can't see processes**: Run the daemon as a user with appropriate permissions.

**WebSocket disconnects**: The UI auto-reconnects with exponential backoff up to 10s.

**UI won't load**: Ensure the daemon is running (`perch status`) and port 3000 is free.
