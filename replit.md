# Admin VOIP - Asterisk Management Platform

## Overview
Admin VOIP is a SaaS platform for managing Asterisk PBX servers. It supports multi-tenant architecture with three company types:
- **Master**: The platform owner company (Admin VOIP itself)
- **Tenant (Multi-Tenant)**: Clients sharing the master's servers
- **Dedicated**: Clients with their own dedicated servers

## Architecture
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + Shadcn/UI
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Routing**: Wouter (frontend), Express (backend)
- **State Management**: TanStack Query v5

## Project Structure
```
client/src/
  App.tsx              - Main app with sidebar layout and routing
  components/
    app-sidebar.tsx    - Navigation sidebar
    theme-provider.tsx - Dark/light theme provider
    theme-toggle.tsx   - Theme toggle button
    ui/                - Shadcn UI components
  pages/
    dashboard.tsx      - Main dashboard with stats and server status
    companies.tsx      - Company/tenant management (CRUD)
    servers.tsx        - Asterisk server management (CRUD)
    extensions.tsx     - SIP extensions/ramais management (CRUD)
    sip-trunks.tsx     - SIP trunk configuration (CRUD)
    ivr.tsx            - IVR/URA menu management (CRUD)
    call-logs.tsx      - Call detail records viewer with filters
    integrations.tsx   - Device compatibility, SIP providers, API docs
    settings.tsx       - Platform configuration settings
server/
  index.ts             - Express server entry point
  routes.ts            - All API routes
  storage.ts           - Database storage layer (IStorage interface)
  db.ts                - Database connection (Drizzle + pg)
  seed.ts              - Seed data for initial setup
shared/
  schema.ts            - Drizzle schema + Zod validators + TypeScript types
```

## Key Features
- Dashboard with server monitoring (CPU, memory, channels, uptime)
- Multi-tenant company management (Master/Tenant/Dedicated)
- Asterisk server management (shared/dedicated modes)
- SIP extension management with voicemail and call recording
- SIP trunk configuration for VoIP providers
- IVR/URA menu builder with multi-level options
- Call detail records (CDR) with filtering
- Integration documentation (softphones, IP phones, SIP providers, API)
- Dark/light theme support
- Responsive design

## Database Models
- users, companies, servers, extensions, sipTrunks, ivrMenus, callLogs

## API Endpoints
All prefixed with `/api/`:
- `/companies` - CRUD
- `/servers` - CRUD
- `/extensions` - CRUD
- `/sip-trunks` - CRUD
- `/ivr-menus` - CRUD
- `/call-logs` - GET only

## Running
- `npm run dev` starts Express + Vite on port 5000
