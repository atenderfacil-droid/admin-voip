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
- **Authentication**: Sessions with bcrypt password hashing
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
    landing.tsx        - Landing page pública do sistema VOIP
    login.tsx          - Tela de login
    dashboard.tsx      - Main dashboard with stats and server status
    companies.tsx      - Company/tenant management (CRUD)
    servers.tsx        - Asterisk server management (CRUD)
    extensions.tsx     - SIP extensions/ramais management (CRUD + real-time AMI status)
    sip-trunks.tsx     - SIP trunk configuration (CRUD)
    ivr.tsx            - IVR/URA menu management (CRUD)
    queues.tsx         - Queue management (CRUD + real-time AMI status)
    call-logs.tsx      - Call detail records viewer with filters
    integrations.tsx   - Device compatibility, SIP providers, API docs
    settings.tsx       - Platform configuration settings
    users.tsx          - Gestão de usuários do sistema (CRUD)
server/
  index.ts             - Express server entry point
  routes.ts            - All API routes (auth + CRUD + AMI)
  asterisk.ts          - AsteriskAMI service (TCP socket AMI client)
  ssh-config.ts        - Remote AMI configuration via SSH tunnel
  storage.ts           - Database storage layer (IStorage interface)
  db.ts                - Database connection (Drizzle + pg)
  seed.ts              - Seed data for initial setup
shared/
  schema.ts            - Drizzle schema + Zod validators + TypeScript types
```

## Key Features
- Landing page pública com apresentação do sistema VOIP
- Sistema de login e autenticação com sessões seguras
- Gestão de usuários com níveis de acesso (super_admin, admin, operator, viewer)
- Isolamento multi-tenant: dados filtrados por empresa do usuário logado
- Dashboard with server monitoring (real AMI data when configured)
- Multi-tenant company management (Master/Tenant/Dedicated)
- Asterisk server management with full AMI integration (shared/dedicated modes)
- **AMI Integration**: Real-time connection to Asterisk via TCP socket on port 5038
  - Test connection, CoreStatus, CoreSettings, SIP/PJSIP peers
  - Active channels with hangup capability
  - Queue status with member management (add/remove/pause)
  - Voicemail users list, SIP registrations
  - Reload Asterisk, CLI command execution
  - Originate calls, redirect channels, monitoring
- SIP extension management with voicemail and call recording
- SIP trunk configuration for VoIP providers
- IVR/URA menu builder with multi-level options
- **Queue management** (CRUD + real-time AMI queue status)
- Call detail records (CDR) with filtering
- Integration documentation (softphones, IP phones, SIP providers, API)
- Dark/light theme support
- Responsive design

## User Roles & Permissions
- **super_admin**: Acesso total, vê dados de TODAS as empresas (Master)
- **admin**: Acesso administrativo dentro da própria empresa
- **operator**: Operações do dia-a-dia dentro da própria empresa
- **viewer**: Apenas visualização dentro da própria empresa

## Database Models
- users, companies, servers (with AMI fields), extensions, sipTrunks, ivrMenus, queues, callLogs

## API Endpoints
All prefixed with `/api/`:
- `/auth/login` - POST login
- `/auth/logout` - POST logout
- `/auth/me` - GET current user
- `/users` - CRUD (admin only)
- `/companies` - CRUD
- `/servers` - CRUD
- `/extensions` - CRUD
- `/extensions/live-status` - GET real-time peer status from all AMI servers (polled every 15s)
- `/sip-trunks` - CRUD
- `/ivr-menus` - CRUD
- `/queues` - CRUD
- `/call-logs` - GET only
- `/servers/:id/ami/test` - POST test AMI connection
- `/servers/:id/ami/status` - GET full AMI status
- `/servers/:id/ami/core-status` - GET Asterisk core status
- `/servers/:id/ami/core-settings` - GET Asterisk core settings
- `/servers/:id/ami/peers` - GET SIP/PJSIP peers
- `/servers/:id/ami/channels` - GET active channels
- `/servers/:id/ami/registrations` - GET SIP registrations
- `/servers/:id/ami/queues` - GET queue status from Asterisk
- `/servers/:id/ami/queue-summary` - GET queue summary
- `/servers/:id/ami/voicemail` - GET voicemail users
- `/servers/:id/ami/reload` - POST reload Asterisk
- `/servers/:id/ami/command` - POST execute CLI command
- `/servers/:id/ami/originate` - POST originate call
- `/servers/:id/ami/hangup` - POST hangup channel
- `/servers/:id/ami/queue-add` - POST add member to queue
- `/servers/:id/ami/queue-remove` - POST remove member from queue
- `/servers/:id/ami/queue-pause` - POST pause/unpause queue member
- `/servers/:id/ami/extension-state/:exten/:context` - GET extension state
- `/servers/:id/ami/redirect` - POST redirect channel
- `/servers/:id/ami/monitor` - POST start monitoring

## Running
- `npm run dev` starts Express + Vite on port 5000

## User Preferences
- UI language: Portuguese Brazilian (pt-BR)
- Default theme: Dark mode with toggle support

## Development Rules (OBRIGATÓRIO)
1. Não alterar nada que não esteja nas solicitações
2. Não aplicar configurações ou recursos sem aprovação prévia
3. Não editar telas que não estejam no planejamento
4. Não criar telas com simulação - sempre planejar para funcionalidades reais
5. Não editar ou recriar códigos já aprovados e funcionais
6. Não excluir recursos ou telas já criadas sem solicitação explícita
7. Toda tela nova deve seguir o padrão visual e de código já estabelecido na base
8. Não criar informações falsas - proibido usar dados MOCK/FALSOS
9. Quando planejado e aprovado, implantar TUDO que foi apresentado até o fim
10. Todas as páginas criadas ou corrigidas devem ter funções e botões validados
11. Proibido criar ou editar páginas com método MOCK/FALSOS
12. Nunca usar favicon do Replit - usar favicon personalizado do Admin VOIP
13. Todos os campos criados no sistema devem salvar e manter dados preenchidos, não podem ficar vazios quando obrigatórios
