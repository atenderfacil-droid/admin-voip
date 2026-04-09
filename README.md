# Admin VOIP — Plataforma de Gerenciamento Asterisk

Plataforma SaaS multi-tenant para gerenciamento completo de servidores **Asterisk PBX** via AMI (Asterisk Manager Interface). Desenvolvida para provedores VOIP e empresas de telefonia que precisam administrar ramais, troncos, filas e toda a infraestrutura de voz em um único painel.

🌐 **Produção:** [atendeja.com.br](https://atendeja.com.br)

---

## Tipos de Empresa

| Tipo | Descrição |
|------|-----------|
| **Master** | Empresa proprietária da plataforma (Admin VOIP) |
| **Tenant** | Clientes que compartilham os servidores do Master |
| **Dedicated** | Clientes com servidores Asterisk dedicados |

---

## Tecnologias

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + Shadcn/UI
- **Backend:** Express.js + TypeScript
- **Banco de Dados:** PostgreSQL + Drizzle ORM
- **Autenticação:** Sessions + bcrypt
- **Roteamento:** Wouter (frontend) + Express (backend)
- **Estado:** TanStack Query v5
- **AMI:** Conexão TCP direta na porta 5038 (ou via SSH Tunnel)
- **SSH:** Node.js ssh2 para operações de arquivo remoto

---

## Funcionalidades Principais

### Gestão de Infraestrutura
- 📡 **Servidores Asterisk** — CRUD completo com configuração AMI + SSH
- 🏢 **Empresas/Tenants** — Isolamento multi-tenant por empresa
- 👥 **Usuários** — 4 níveis de acesso (super_admin, admin, operator, viewer)

### Telefonia (Provisioning via SSH)
- 📞 **Ramais SIP/PJSIP** — Geração automática de config + dialplan
- 🔗 **Troncos SIP** — Configuração de provedores VoIP
- 🌳 **IVR/URA** — Menus de atendimento multi-nível
- 📋 **Filas** — Gestão de filas com membros em tempo real
- 🎤 **Salas de Conferência** — ConfBridge com PIN, gravação, MoH
- 📟 **DIDs/DDR** — Roteamento de ramais com horário comercial
- 🆔 **Regras de CallerID** — Manipulação de identificação de chamadas
- ⚡ **Speed Dial/BLF** — Teclas de discagem rápida com monitoramento

### Monitoramento em Tempo Real (AMI)
- 📊 **Dashboard** — Status dos servidores com dados reais do Asterisk
- 📱 **Chamadas Online** — Canais ativos com hangup individual/em massa
- 📈 **Status de Ramais** — Status SIP/PJSIP ao vivo (polling 15s)
- 🎯 **Status de Filas** — Membros, chamadas em espera, pausas

### Relatórios e Histórico
- 📅 **CDR (Call Detail Records)** — Captura em tempo real via AMI Event
- 📊 **Relatórios** — Gráficos por hora/disposição/dia com export CSV/PDF
- 🎙️ **Gravações** — Browser de arquivos via SSH com playback inline
- 📬 **Voicemail** — Gestão de caixas postais e mensagens via SSH

### Segurança e Manutenção
- 🔥 **Firewall** — Visualização Fail2ban + IPTables via SSH
- 💾 **Backups** — Backup/restauração de configs Asterisk via SSH
- 📝 **Log de Atividades** — Auditoria completa de ações dos usuários
- 🎵 **Music on Hold** — Gestão de arquivos MoH via SSH

### Integrações
- 📚 **Documentação API** — Endpoints, softphones, provedores SIP compatíveis
- 📓 **Agenda de Contatos** — CRUD com favoritos e busca

---

## Arquitetura

```
client/src/
  App.tsx                   # Roteamento principal + layout sidebar
  components/
    app-sidebar.tsx         # Sidebar com perfil e navegação
    theme-provider.tsx      # Tema dark/light
    ui/                     # Componentes Shadcn/UI
  pages/                    # 20+ páginas da aplicação
server/
  index.ts                  # Entry point Express
  routes.ts                 # Todas as rotas da API
  asterisk.ts               # Cliente AMI (TCP socket)
  asterisk-provisioner.ts   # Motor de provisionamento SSH
  ssh-config.ts             # Utilitários SSH + tunnel AMI
  storage.ts                # Camada de dados (IStorage interface)
  db.ts                     # Conexão PostgreSQL (Drizzle)
  seed.ts                   # Dados iniciais
shared/
  schema.ts                 # Schema Drizzle + Zod validators + Types
```

---

## Instalação e Desenvolvimento

### Pré-requisitos
- Node.js 20+
- PostgreSQL 14+

### Configuração

```bash
# Clone o repositório
git clone https://github.com/atenderfacil-droid/admin-voip.git
cd admin-voip

# Instale as dependências
npm install

# Configure as variáveis de ambiente
# DATABASE_URL=postgresql://user:password@host:5432/adminvoip
# SESSION_SECRET=sua-chave-secreta

# Execute as migrações
npm run db:push

# Inicie em desenvolvimento
npm run dev
```

A aplicação estará disponível em `http://localhost:5000`.

---

## Variáveis de Ambiente

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `DATABASE_URL` | URL de conexão PostgreSQL | ✅ |
| `SESSION_SECRET` | Chave secreta para sessões | ✅ |

---

## Modelos de Dados Principais

- `users` — Usuários com níveis de acesso por empresa
- `companies` — Empresas Master/Tenant/Dedicated
- `servers` — Servidores Asterisk com credenciais AMI + SSH
- `extensions` — Ramais SIP/PJSIP com voicemail e gravação
- `sipTrunks` — Troncos SIP para provedores VoIP
- `ivrMenus` — Menus IVR/URA multi-nível
- `queues` — Filas de atendimento com membros
- `conferenceRooms` — Salas ConfBridge
- `dids` — Números DID com roteamento por horário
- `callerIdRules` — Regras de manipulação de CallerID
- `speedDials` — Teclas de discagem rápida / BLF
- `callLogs` — CDR capturado via AMI em tempo real
- `contacts` — Agenda de contatos por empresa
- `activityLogs` — Log de auditoria de ações

---

## Padrão de Provisionamento

Todas as operações CRUD salvam no banco de dados e respondem imediatamente ao frontend. O provisionamento para os servidores Asterisk via SSH roda em **background (fire-and-forget)** sem bloquear a interface:

```
Browser → POST /api/extensions → Salva no DB → HTTP 201 ✅
                                              ↓ (background)
                                         SSH → Escreve config
                                              ↓
                                         AMI → Reload módulo
```

---

## Papéis de Usuário

| Papel | Acesso |
|-------|--------|
| `super_admin` | Total — vê dados de TODAS as empresas |
| `admin` | Administrativo dentro da própria empresa |
| `operator` | Operações do dia-a-dia dentro da empresa |
| `viewer` | Somente visualização dentro da empresa |

---

## Licença

Proprietário — Admin VOIP / Atendeja.com.br. Todos os direitos reservados.
