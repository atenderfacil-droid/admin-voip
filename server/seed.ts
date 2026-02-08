import { db } from "./db";
import { companies, servers, extensions, sipTrunks, ivrMenus, callLogs, users } from "@shared/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcrypt";

export async function seedDatabase() {
  const existingCompanies = await db.select().from(companies);
  if (existingCompanies.length > 0) return;

  console.log("Seeding database with initial data...");

  const [masterCompany] = await db.insert(companies).values([
    {
      name: "Admin VOIP",
      domain: "admin-voip.com.br",
      type: "master",
      maxExtensions: 500,
      maxTrunks: 50,
      contactName: "Carlos Administrador",
      contactEmail: "admin@admin-voip.com.br",
      contactPhone: "+55 11 99999-0000",
      active: true,
    },
  ]).returning();

  const [tenantCompany1] = await db.insert(companies).values([
    {
      name: "TechSoft Soluções",
      domain: "techsoft.com.br",
      type: "tenant",
      maxExtensions: 100,
      maxTrunks: 10,
      contactName: "Ana Silva",
      contactEmail: "ana@techsoft.com.br",
      contactPhone: "+55 11 98765-4321",
      active: true,
    },
  ]).returning();

  const [tenantCompany2] = await db.insert(companies).values([
    {
      name: "Vendas Express",
      domain: "vendasexpress.com.br",
      type: "tenant",
      maxExtensions: 50,
      maxTrunks: 5,
      contactName: "Roberto Mendes",
      contactEmail: "roberto@vendasexpress.com.br",
      contactPhone: "+55 21 97654-3210",
      active: true,
    },
  ]).returning();

  const [dedicatedCompany] = await db.insert(companies).values([
    {
      name: "Call Center Pro",
      domain: "callcenterpro.com.br",
      type: "dedicated",
      maxExtensions: 200,
      maxTrunks: 20,
      contactName: "Marina Oliveira",
      contactEmail: "marina@callcenterpro.com.br",
      contactPhone: "+55 31 96543-2109",
      active: true,
    },
  ]).returning();

  await db.insert(companies).values([
    {
      name: "Imobiliária Central",
      domain: "imobiliariacentral.com.br",
      type: "tenant",
      maxExtensions: 30,
      maxTrunks: 3,
      contactName: "Fernando Costa",
      contactEmail: "fernando@imobiliariacentral.com.br",
      contactPhone: "+55 41 95432-1098",
      active: false,
    },
  ]);

  await db.insert(users).values([
    {
      username: "admin",
      password: bcrypt.hashSync("admin123", 10),
      fullName: "Carlos Administrador",
      email: "admin@admin-voip.com.br",
      role: "super_admin" as const,
      companyId: masterCompany.id,
      active: true,
    },
    {
      username: "ana.silva",
      password: bcrypt.hashSync("senha123", 10),
      fullName: "Ana Silva",
      email: "ana@techsoft.com.br",
      role: "admin" as const,
      companyId: tenantCompany1.id,
      active: true,
    },
    {
      username: "roberto.mendes",
      password: bcrypt.hashSync("senha123", 10),
      fullName: "Roberto Mendes",
      email: "roberto@vendasexpress.com.br",
      role: "operator" as const,
      companyId: tenantCompany2.id,
      active: true,
    },
    {
      username: "marina.oliveira",
      password: bcrypt.hashSync("senha123", 10),
      fullName: "Marina Oliveira",
      email: "marina@callcenterpro.com.br",
      role: "admin" as const,
      companyId: dedicatedCompany.id,
      active: true,
    },
  ]);

  const [server1] = await db.insert(servers).values([
    {
      name: "PBX-Principal",
      hostname: "pbx01.admin-voip.com.br",
      ipAddress: "192.168.1.10",
      port: 5060,
      mode: "shared",
      status: "online",
      asteriskVersion: "22.8.2",
      maxChannels: 200,
      activeChannels: 47,
      cpuUsage: 35,
      memoryUsage: 62,
      uptime: "45d 12h 30m",
      companyId: masterCompany.id,
    },
  ]).returning();

  const [server2] = await db.insert(servers).values([
    {
      name: "PBX-Backup",
      hostname: "pbx02.admin-voip.com.br",
      ipAddress: "192.168.1.11",
      port: 5060,
      mode: "shared",
      status: "online",
      asteriskVersion: "22.8.2",
      maxChannels: 150,
      activeChannels: 12,
      cpuUsage: 15,
      memoryUsage: 38,
      uptime: "30d 8h 15m",
      companyId: masterCompany.id,
    },
  ]).returning();

  const [server3] = await db.insert(servers).values([
    {
      name: "PBX-CallCenter",
      hostname: "pbx-cc.callcenterpro.com.br",
      ipAddress: "10.0.1.50",
      port: 5060,
      mode: "dedicated",
      status: "online",
      asteriskVersion: "22.8.2",
      maxChannels: 300,
      activeChannels: 89,
      cpuUsage: 55,
      memoryUsage: 71,
      uptime: "60d 3h 45m",
      companyId: dedicatedCompany.id,
    },
  ]).returning();

  await db.insert(servers).values([
    {
      name: "PBX-Dev",
      hostname: "pbx-dev.admin-voip.com.br",
      ipAddress: "192.168.2.100",
      port: 5060,
      mode: "shared",
      status: "maintenance",
      asteriskVersion: "23.2.1",
      maxChannels: 50,
      activeChannels: 0,
      cpuUsage: 5,
      memoryUsage: 20,
      uptime: "2d 1h 10m",
      companyId: masterCompany.id,
    },
  ]);

  const extensionData = [
    { number: "1001", name: "Recepção Principal", secret: "xK9m2p", context: "internal", protocol: "SIP", status: "active" as const, callerId: '"Recepcao" <1001>', voicemailEnabled: true, callRecording: true, companyId: masterCompany.id, serverId: server1.id },
    { number: "1002", name: "Carlos - Diretor", secret: "hY7n4q", context: "internal", protocol: "PJSIP", status: "active" as const, callerId: '"Carlos" <1002>', voicemailEnabled: true, callRecording: false, companyId: masterCompany.id, serverId: server1.id },
    { number: "1003", name: "Suporte Técnico", secret: "wR5t8v", context: "internal", protocol: "SIP", status: "busy" as const, callerId: '"Suporte" <1003>', voicemailEnabled: true, callRecording: true, companyId: masterCompany.id, serverId: server1.id },
    { number: "2001", name: "Ana - Gerente", secret: "pL3k6m", context: "tenant-techsoft", protocol: "SIP", status: "active" as const, callerId: '"Ana" <2001>', voicemailEnabled: true, callRecording: false, companyId: tenantCompany1.id, serverId: server1.id },
    { number: "2002", name: "Dev Team", secret: "jN8f2w", context: "tenant-techsoft", protocol: "WebRTC", status: "active" as const, callerId: '"DevTeam" <2002>', voicemailEnabled: false, callRecording: false, companyId: tenantCompany1.id, serverId: server1.id },
    { number: "3001", name: "Roberto - Vendas", secret: "qT4r7y", context: "tenant-vendas", protocol: "SIP", status: "inactive" as const, callerId: '"Roberto" <3001>', voicemailEnabled: true, callRecording: true, companyId: tenantCompany2.id, serverId: server2.id },
    { number: "3002", name: "Atendimento SAC", secret: "bV6h9k", context: "tenant-vendas", protocol: "SIP", status: "active" as const, callerId: '"SAC" <3002>', voicemailEnabled: true, callRecording: true, companyId: tenantCompany2.id, serverId: server2.id },
    { number: "4001", name: "Operador 01", secret: "mX2c5n", context: "callcenter", protocol: "PJSIP", status: "active" as const, callerId: '"Op01" <4001>', voicemailEnabled: false, callRecording: true, companyId: dedicatedCompany.id, serverId: server3.id },
    { number: "4002", name: "Operador 02", secret: "fG7j3p", context: "callcenter", protocol: "PJSIP", status: "busy" as const, callerId: '"Op02" <4002>', voicemailEnabled: false, callRecording: true, companyId: dedicatedCompany.id, serverId: server3.id },
    { number: "4003", name: "Supervisor", secret: "dS9l1q", context: "callcenter", protocol: "PJSIP", status: "active" as const, callerId: '"Supervisor" <4003>', voicemailEnabled: true, callRecording: true, companyId: dedicatedCompany.id, serverId: server3.id },
  ];

  await db.insert(extensions).values(extensionData);

  const trunkData = [
    { name: "Telnyx-Principal", provider: "Telnyx", host: "sip.telnyx.com", port: 5060, username: "adminvoip_main", password: "secure123", codec: "G.711", dtmfMode: "rfc2833", status: "registered" as const, maxChannels: 60, activeChannels: 15, context: "from-telnyx", companyId: masterCompany.id, serverId: server1.id },
    { name: "Twilio-Backup", provider: "Twilio", host: "sip.twilio.com", port: 5060, username: "adminvoip_twilio", password: "tw1l10pass", codec: "G.722", dtmfMode: "rfc2833", status: "registered" as const, maxChannels: 30, activeChannels: 3, context: "from-twilio", companyId: masterCompany.id, serverId: server1.id },
    { name: "Flowroute-TechSoft", provider: "Flowroute", host: "us-west-or.sip.flowroute.com", port: 5060, username: "techsoft_flow", password: "fl0wr0ut3", codec: "G.711", dtmfMode: "rfc2833", status: "registered" as const, maxChannels: 20, activeChannels: 5, context: "from-flowroute", companyId: tenantCompany1.id, serverId: server1.id },
    { name: "VoIPms-Vendas", provider: "VoIP.ms", host: "atlanta.voip.ms", port: 5060, username: "vendas_voipms", password: "v01pms_s3c", codec: "G.729", dtmfMode: "rfc2833", status: "unregistered" as const, maxChannels: 15, activeChannels: 0, context: "from-voipms", companyId: tenantCompany2.id, serverId: server2.id },
    { name: "Sangoma-CallCenter", provider: "Sangoma SIPStation", host: "sip.sangoma.com", port: 5060, username: "callcenter_sangoma", password: "s4ng0m4cc", codec: "Opus", dtmfMode: "rfc2833", status: "registered" as const, maxChannels: 100, activeChannels: 42, context: "from-sangoma", companyId: dedicatedCompany.id, serverId: server3.id },
  ];

  await db.insert(sipTrunks).values(trunkData);

  const ivrData = [
    {
      name: "Menu Principal Admin VOIP",
      description: "Menu principal de atendimento da Admin VOIP",
      welcomeMessage: "Bem-vindo à Admin VOIP. Para vendas, pressione 1. Para suporte técnico, pressione 2. Para financeiro, pressione 3.",
      status: "active" as const,
      timeout: 10,
      options: [
        { digit: "1", action: "dial", destination: "1001", label: "Vendas" },
        { digit: "2", action: "dial", destination: "1003", label: "Suporte Técnico" },
        { digit: "3", action: "dial", destination: "1002", label: "Financeiro" },
        { digit: "0", action: "dial", destination: "1001", label: "Recepção" },
      ],
      companyId: masterCompany.id,
      serverId: server1.id,
    },
    {
      name: "IVR TechSoft",
      description: "Atendimento automático da TechSoft Soluções",
      welcomeMessage: "Obrigado por ligar para a TechSoft. Para falar com um consultor, pressione 1. Para suporte, pressione 2.",
      status: "active" as const,
      timeout: 15,
      options: [
        { digit: "1", action: "dial", destination: "2001", label: "Consultor" },
        { digit: "2", action: "queue", destination: "suporte-techsoft", label: "Fila de Suporte" },
      ],
      companyId: tenantCompany1.id,
      serverId: server1.id,
    },
    {
      name: "URA Call Center Pro",
      description: "Menu de entrada do Call Center Pro com distribuição automática",
      welcomeMessage: "Call Center Pro. Para atendimento, pressione 1. Para cancelamento, pressione 2. Para ouvidoria, pressione 3.",
      status: "active" as const,
      timeout: 8,
      options: [
        { digit: "1", action: "queue", destination: "atendimento-geral", label: "Atendimento" },
        { digit: "2", action: "queue", destination: "cancelamento", label: "Cancelamento" },
        { digit: "3", action: "dial", destination: "4003", label: "Ouvidoria" },
        { digit: "9", action: "voicemail", destination: "4003", label: "Deixar Recado" },
      ],
      companyId: dedicatedCompany.id,
      serverId: server3.id,
    },
    {
      name: "IVR Vendas Express (Rascunho)",
      description: "Menu em construção para a Vendas Express",
      welcomeMessage: "",
      status: "draft" as const,
      timeout: 10,
      options: [
        { digit: "1", action: "dial", destination: "3001", label: "Vendas" },
      ],
      companyId: tenantCompany2.id,
      serverId: server2.id,
    },
  ];

  await db.insert(ivrMenus).values(ivrData);

  const now = new Date();
  const callData = [];
  const statuses = ["answered", "missed", "forwarded", "answered", "answered", "answered", "missed", "answered"];
  const types = ["inbound", "outbound", "internal", "inbound", "outbound", "inbound", "inbound", "internal"];
  const sources = ["(11) 3456-7890", "1001", "2001", "(21) 9876-5432", "3002", "(31) 4567-8901", "(11) 2345-6789", "4001"];
  const destinations = ["1001", "(11) 98765-4321", "2002", "3002", "(21) 3456-7890", "4001", "1003", "4003"];
  const durations = [185, 0, 43, 312, 67, 145, 0, 28];
  const companyIds = [masterCompany.id, masterCompany.id, tenantCompany1.id, tenantCompany2.id, tenantCompany2.id, dedicatedCompany.id, masterCompany.id, dedicatedCompany.id];
  const serverIds = [server1.id, server1.id, server1.id, server2.id, server2.id, server3.id, server1.id, server3.id];

  for (let i = 0; i < 8; i++) {
    const callDate = new Date(now.getTime() - (i * 3600000 + Math.random() * 3600000));
    callData.push({
      callDate,
      source: sources[i],
      destination: destinations[i],
      duration: durations[i],
      status: statuses[i],
      type: types[i],
      companyId: companyIds[i],
      serverId: serverIds[i],
    });
  }

  await db.insert(callLogs).values(callData);

  console.log("Database seeded successfully!");
}
