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
    app-sidebar.tsx    - Navigation sidebar with user profile editing dialog
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
    online-calls.tsx   - Chamadas ativas com hangup individual e MixMonitor
    sip-trunks.tsx     - SIP trunk configuration (CRUD)
    ivr.tsx            - IVR/URA menu management (CRUD)
    queues.tsx         - Queue management (CRUD + real-time AMI status)
    conference-rooms.tsx - Salas de conferência ConfBridge (CRUD + AMI kick/mute/lock)
    call-logs.tsx      - CDR (Call Detail Records) viewer with real-time AMI capture, filters and pagination
    dids.tsx           - DID/DDR management (CRUD) with business hours routing
    caller-id-rules.tsx - CallerID rules management (CRUD) with pattern matching
    speed-dials.tsx    - Speed Dial / BLF management (CRUD)
    voicemail.tsx      - Voicemail management (AMI users + SSH messages browse/play/delete)
    reports.tsx        - Call reports with charts (hourly/disposition/daily) and CSV/PDF export
    recordings.tsx     - Call recordings browser via SSH (list/play/download/delete)
    music-on-hold.tsx  - Music on Hold file management via SSH (list/play/download/delete)
    firewall.tsx       - Fail2ban + IPTables security visualization via SSH
    phonebook.tsx      - Agenda de contatos (CRUD com favoritos)
    activity-log.tsx   - Log de atividades/auditoria do sistema
    backups.tsx        - Backup & Restauração de configurações Asterisk via SSH
    integrations.tsx   - Device compatibility, SIP providers, API docs
    settings.tsx       - Platform configuration settings
    users.tsx          - Gestão de usuários do sistema (CRUD)
server/
  index.ts             - Express server entry point
  routes.ts            - All API routes (auth + CRUD + AMI + SSH recordings/firewall + provisioning)
  asterisk.ts          - AsteriskAMI service (TCP socket AMI client)
  asterisk-provisioner.ts - Provisioning engine: writes Asterisk config files via SSH and reloads modules
  ssh-config.ts        - Remote AMI configuration via SSH tunnel + exported SSH utilities
  storage.ts           - Database storage layer (IStorage interface)
  db.ts                - Database connection (Drizzle + pg)
  seed.ts              - Seed data for initial setup
shared/
  schema.ts            - Drizzle schema + Zod validators + TypeScript types
```

## Key Features
- Landing page pública com 7 seções (hero, 9 features, diferenciais, planos, tecnologias, footer)
- Sistema de login e autenticação com sessões seguras
- Gestão de usuários com níveis de acesso (super_admin, admin, operator, viewer)
- Edição de perfil do usuário via dialog na sidebar (nome, email, senha)
- Isolamento multi-tenant: dados filtrados por empresa do usuário logado
- Dashboard com atalhos rápidos e atividade recente
- Configurações da plataforma com persistência real no banco (21 campos)
- Dashboard with server monitoring (real AMI data when configured)
- Multi-tenant company management (Master/Tenant/Dedicated)
- Asterisk server management with full AMI integration (shared/dedicated modes)
- **AMI Integration**: Real-time connection to Asterisk via TCP socket on port 5038
  - Test connection, CoreStatus, CoreSettings, SIP/PJSIP peers
  - Active channels with hangup capability (individual + mass hangup with regex)
  - Queue status with member management (add/remove/pause)
  - ConfBridge room listing, kick, mute/unmute, lock/unlock
  - Voicemail users list, SIP registrations
  - Reload Asterisk, CLI command execution
  - Originate calls, redirect channels, monitoring
  - MixMonitor start/stop for call recording
  - PJSIPShowEndpoint with ActiveChannels
- **Asterisk 22 LTS Features**:
  - CoreProcessedCalls field in CoreStatus (displayed in dashboard)
  - SHA-256 and SHA-512/256 authentication digest support
  - MixMonitor stereo recording option
  - Mass hangup with regex/glob pattern matching
- **Provisioning Síncrono com Feedback**: Todas as operações CRUD (criar/editar/excluir) em extensões, troncos SIP, IVR, filas, conference rooms, DIDs, CallerID rules e speed dials agora aguardam o resultado do provisionamento e retornam feedback no toast:
  - Se SSH habilitado e provisionamento sucesso: toast verde "X criado/atualizado/removido e aplicado no servidor"
  - Se SSH não habilitado ou falha: toast vermelho "X criado/atualizado/removido no banco de dados" com mensagem descritiva
  - Backend usa helper `tryProvision()` em routes.ts que retorna `{ provisioned: boolean, provisioningMessage: string }`
- SIP extension management with voicemail and call recording
- SIP trunk configuration for VoIP providers
- IVR/URA menu builder with multi-level options
- **Conference Rooms (ConfBridge)**: Room management with PIN/Admin PIN, recording, MoH, announce join/leave, wait for leader, quiet mode + live AMI actions (kick/mute/lock)
- **DID/DDR Management**: Inbound number routing with business hours and after-hours destinations
- **CallerID Rules**: Pattern matching and manipulation (set/prefix/suffix/remove_prefix/block)
- **Speed Dial / BLF**: Fast dial key management with BLF monitoring support
- **Queue management** (CRUD + real-time AMI queue status)
- **CDR Integration**: Real-time call detail records captured via AMI Event: Cdr
  - Persistent CDR listeners auto-start at boot for all AMI-enabled servers
  - Auto-reconnect on disconnect with 30s retry
  - Server-side filtering by date range, server, disposition, search text
  - Pagination with configurable page size
  - Full Asterisk CDR fields (clid, channel, dstchannel, disposition, billsec, uniqueid, etc.)
- **Reports**: Call summary with charts (hourly/disposition/daily) built with divs+Tailwind, CSV/PDF export
- **Call Recordings**: Browse, play, download, and delete recording files from Asterisk servers via SSH
  - Scans multiple Asterisk recording directories
  - Inline HTML5 audio playback
  - Date and filename search filters with pagination
- **Voicemail Management**: AMI voicemail users list + SSH-based message browsing
  - Two tabs: Caixas Postais (mailboxes) and Mensagens (messages)
  - Inline audio playback, download, delete
- **Music on Hold**: SSH-based MoH file management
  - List/play/download/delete MoH files
  - MoH class detection and display
- **Firewall/Security**: Fail2ban and IPTables visualization via SSH
  - Security overview: Fail2ban version, rules count, failed logins, open SIP ports
  - Fail2ban jail status with banned IPs and unban capability
  - IPTables chain listing with rules detail
  - Recent auth log viewer
- **Phonebook/Contacts**: Contact management with favorite toggle, search filtering
- **Activity Log**: User action audit trail with resource filtering, pagination, colored action badges
- **Backup & Restore**: Asterisk config backup via SSH with create/list/download/restore/delete
  - Restore requires super_admin with double confirmation
- Integration documentation (softphones, IP phones, SIP providers, API)
- Dark/light theme support
- Responsive design

## User Roles & Permissions
- **super_admin**: Acesso total, vê dados de TODAS as empresas (Master)
- **admin**: Acesso administrativo dentro da própria empresa
- **operator**: Operações do dia-a-dia dentro da própria empresa
- **viewer**: Apenas visualização dentro da própria empresa

## Database Models
- users, companies, servers (with AMI + SSH fields), extensions, sipTrunks, ivrMenus, queues, callLogs, dids, callerIdRules, conferenceRooms, speedDials, contacts, activityLogs

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
- `/conference-rooms` - CRUD
- `/speed-dials` - CRUD
- `/contacts` - CRUD
- `/dids` - CRUD
- `/caller-id-rules` - CRUD
- `/call-logs` - GET only
- `/activity-logs` - GET with filters (admin only)
- `/reports/calls-summary` - GET call summary data for reports
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
- `/servers/:id/ami/voicemail-list` - GET voicemail users via AMI
- `/servers/:id/ami/confbridge-list` - GET ConfBridge room list
- `/servers/:id/ami/confbridge-kick` - POST kick participant
- `/servers/:id/ami/confbridge-mute` - POST mute/unmute participant
- `/servers/:id/ami/confbridge-lock` - POST lock/unlock conference
- `/servers/:id/ami/reload` - POST reload Asterisk
- `/servers/:id/ami/command` - POST execute CLI command
- `/servers/:id/ami/originate` - POST originate call
- `/servers/:id/ami/hangup` - POST hangup channel
- `/servers/:id/ami/hangup-multiple` - POST mass hangup with regex/glob patterns
- `/servers/:id/ami/mixmonitor` - POST start MixMonitor recording
- `/servers/:id/ami/stopmixmonitor` - POST stop MixMonitor recording
- `/servers/:id/ami/queue-add` - POST add member to queue
- `/servers/:id/ami/queue-remove` - POST remove member from queue
- `/servers/:id/ami/queue-pause` - POST pause/unpause queue member
- `/servers/:id/ami/extension-state/:exten/:context` - GET extension state
- `/servers/:id/ami/redirect` - POST redirect channel
- `/servers/:id/ami/monitor` - POST start monitoring
- `/servers/:id/ami/pjsip-endpoint/:endpoint` - GET PJSIP endpoint details
- `/servers/:id/ami/pjsip-endpoints` - GET all PJSIP endpoints
- `/servers/:id/recordings` - GET list / DELETE remove recordings via SSH
- `/servers/:id/recordings/download` - GET stream/download recording file via SSH
- `/servers/:id/voicemail-messages` - GET list / DELETE voicemail messages via SSH
- `/servers/:id/voicemail-messages/download` - GET stream voicemail audio
- `/servers/:id/moh` - GET list / DELETE MoH files via SSH
- `/servers/:id/moh/download` - GET stream MoH audio file
- `/servers/:id/backups` - GET list / DELETE backup files via SSH
- `/servers/:id/backup` - POST create backup
- `/servers/:id/backups/download` - GET download backup file
- `/servers/:id/backups/restore` - POST restore backup (super_admin only)
- `/servers/:id/firewall/fail2ban` - GET Fail2ban status via SSH
- `/servers/:id/firewall/fail2ban/unban` - POST unban IP from Fail2ban jail
- `/servers/:id/firewall/iptables` - GET IPTables rules via SSH
- `/servers/:id/firewall/overview` - GET security overview via SSH

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
