import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { createAMIClient } from "./asterisk";
import {
  insertCompanySchema,
  insertServerSchema,
  insertExtensionSchema,
  insertSipTrunkSchema,
  insertIvrMenuSchema,
  insertQueueSchema,
  insertUserSchema,
  type User,
} from "@shared/schema";

function excludePassword(user: User) {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || !user.active) {
    return res.status(401).json({ message: "Não autenticado" });
  }
  (req as any).user = user;
  next();
}

function getAuthUser(req: Request): User {
  return (req as any).user as User;
}

function getCompanyFilter(req: Request): string | undefined {
  const user = getAuthUser(req);
  if (user.role === "super_admin") return undefined;
  return user.companyId || undefined;
}

function isSuperAdmin(req: Request): boolean {
  return getAuthUser(req).role === "super_admin";
}

function isAdminOrAbove(req: Request): boolean {
  const role = getAuthUser(req).role;
  return role === "super_admin" || role === "admin";
}

function enforceCompanyId(req: Request, bodyCompanyId?: string | null): string | null {
  const user = getAuthUser(req);
  if (user.role === "super_admin") return bodyCompanyId ?? null;
  return user.companyId;
}

function canAccessCompany(req: Request, companyId: string | null): boolean {
  const user = getAuthUser(req);
  if (user.role === "super_admin") return true;
  return user.companyId === companyId;
}

async function getAMIClient(serverId: string, req: Request) {
  const server = await storage.getServer(serverId);
  if (!server) throw new Error("Servidor não encontrado");
  if (!canAccessCompany(req, server.companyId)) {
    throw new Error("Acesso negado");
  }
  if (!server.amiEnabled || !server.amiUsername || !server.amiPassword) {
    throw new Error("AMI não configurado neste servidor");
  }
  return { ami: createAMIClient(server.ipAddress, server.amiPort, server.amiUsername, server.amiPassword), server };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username e password são obrigatórios" });
    }
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    if (!user.active) {
      return res.status(401).json({ message: "Usuário desativado" });
    }
    req.session.userId = user.id;
    res.json(excludePassword(user));
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao fazer logout" });
      }
      res.json({ message: "Logout realizado com sucesso" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.active) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    res.json(excludePassword(user));
  });

  app.use("/api/companies", requireAuth);
  app.use("/api/servers", requireAuth);
  app.use("/api/extensions", requireAuth);
  app.use("/api/sip-trunks", requireAuth);
  app.use("/api/ivr-menus", requireAuth);
  app.use("/api/queues", requireAuth);
  app.use("/api/call-logs", requireAuth);
  app.use("/api/users", requireAuth);

  // Companies
  app.get("/api/companies", async (req, res) => {
    const companyId = getCompanyFilter(req);
    const companies = await storage.getCompanies(companyId);
    res.json(companies);
  });

  app.get("/api/companies/:id", async (req, res) => {
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ message: "Empresa não encontrada" });
    if (!canAccessCompany(req, company.id)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    res.json(company);
  });

  app.post("/api/companies", async (req, res) => {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ message: "Apenas super_admin pode criar empresas" });
    }
    const result = insertCompanySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    try {
      const company = await storage.createCompany(result.data);
      res.status(201).json(company);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/companies/:id", async (req, res) => {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ message: "Apenas super_admin pode editar empresas" });
    }
    const result = insertCompanySchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    try {
      const company = await storage.updateCompany(req.params.id, result.data);
      if (!company) return res.status(404).json({ message: "Empresa não encontrada" });
      res.json(company);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/companies/:id", async (req, res) => {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ message: "Apenas super_admin pode remover empresas" });
    }
    await storage.deleteCompany(req.params.id);
    res.status(204).send();
  });

  // Servers (multi-tenant)
  app.get("/api/servers", async (req, res) => {
    const companyId = getCompanyFilter(req);
    const result = await storage.getServers(companyId);
    res.json(result);
  });

  app.get("/api/servers/:id", async (req, res) => {
    const server = await storage.getServer(req.params.id);
    if (!server) return res.status(404).json({ message: "Servidor não encontrado" });
    if (!canAccessCompany(req, server.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    res.json(server);
  });

  app.post("/api/servers", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const result = insertServerSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    const data = { ...result.data, companyId: enforceCompanyId(req, result.data.companyId) };
    try {
      const server = await storage.createServer(data);
      res.status(201).json(server);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/servers/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const existing = await storage.getServer(req.params.id);
    if (!existing) return res.status(404).json({ message: "Servidor não encontrado" });
    if (!canAccessCompany(req, existing.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    const result = insertServerSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    const data = { ...result.data };
    if (!isSuperAdmin(req)) delete data.companyId;
    try {
      const server = await storage.updateServer(req.params.id, data);
      if (!server) return res.status(404).json({ message: "Servidor não encontrado" });
      res.json(server);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/servers/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const existing = await storage.getServer(req.params.id);
    if (!existing) return res.status(404).json({ message: "Servidor não encontrado" });
    if (!canAccessCompany(req, existing.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    await storage.deleteServer(req.params.id);
    res.status(204).send();
  });

  // AMI Endpoints (real Asterisk integration)
  app.post("/api/servers/:id/ami/test", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.testConnection();
      res.json(result);
    } catch (error: any) {
      res.json({ success: false, message: error.message });
    }
  });

  app.get("/api/servers/:id/ami/status", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const fullStatus = await ami.getFullStatus();
      res.json(fullStatus);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/servers/:id/ami/core-status", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const status = await ami.getCoreStatus();
      res.json(status);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/servers/:id/ami/core-settings", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const settings = await ami.getCoreSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/servers/:id/ami/peers", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const [sipPeers, pjsipEndpoints] = await Promise.all([
        ami.getSIPPeers().catch(() => []),
        ami.getPJSIPEndpoints().catch(() => []),
      ]);
      res.json({ sip: sipPeers, pjsip: pjsipEndpoints });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/servers/:id/ami/channels", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const channels = await ami.getActiveChannels();
      res.json(channels);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/servers/:id/ami/registrations", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const registrations = await ami.getRegistrations();
      res.json(registrations);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/servers/:id/ami/queues", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const queueData = await ami.getQueueStatus();
      res.json(queueData);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/servers/:id/ami/queue-summary", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const summary = await ami.getQueueSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/servers/:id/ami/voicemail", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const vmUsers = await ami.getVoicemailUsers();
      res.json(vmUsers);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/servers/:id/ami/reload", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.reload(req.body.module);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post("/api/servers/:id/ami/command", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ message: "Comando obrigatório" });
    }
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const output = await ami.executeCommand(command);
      res.json({ output });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/servers/:id/ami/originate", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.originate(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post("/api/servers/:id/ami/hangup", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const { channel } = req.body;
    if (!channel) {
      return res.status(400).json({ message: "Canal obrigatório" });
    }
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.hangupChannel(channel);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post("/api/servers/:id/ami/queue-add", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const { queue, iface, memberName, penalty } = req.body;
    if (!queue || !iface) {
      return res.status(400).json({ message: "Fila e interface obrigatórios" });
    }
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.queueAdd(queue, iface, memberName, penalty);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post("/api/servers/:id/ami/queue-remove", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const { queue, iface } = req.body;
    if (!queue || !iface) {
      return res.status(400).json({ message: "Fila e interface obrigatórios" });
    }
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.queueRemove(queue, iface);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post("/api/servers/:id/ami/queue-pause", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const { queue, iface, paused, reason } = req.body;
    if (!queue || !iface || paused === undefined) {
      return res.status(400).json({ message: "Fila, interface e estado obrigatórios" });
    }
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.queuePause(queue, iface, paused, reason);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.get("/api/servers/:id/ami/extension-state/:exten/:context", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.getExtensionState(req.params.exten as string, req.params.context as string);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/servers/:id/ami/redirect", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.redirect(req.body.channel, req.body.context, req.body.exten, req.body.priority);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post("/api/servers/:id/ami/monitor", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.monitor(req.body.channel, req.body.file, req.body.mix);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Extensions (multi-tenant)
  app.get("/api/extensions", async (req, res) => {
    const companyId = getCompanyFilter(req);
    const exts = await storage.getExtensions(companyId);
    res.json(exts);
  });

  app.get("/api/extensions/:id", async (req, res) => {
    const ext = await storage.getExtension(req.params.id);
    if (!ext) return res.status(404).json({ message: "Ramal não encontrado" });
    if (!canAccessCompany(req, ext.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    res.json(ext);
  });

  app.post("/api/extensions", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const result = insertExtensionSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    const companyId = enforceCompanyId(req, result.data.companyId);
    if (!companyId) return res.status(400).json({ message: "Empresa obrigatória" });
    const data = { ...result.data, companyId };
    try {
      const ext = await storage.createExtension(data);
      res.status(201).json(ext);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/extensions/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const existing = await storage.getExtension(req.params.id);
    if (!existing) return res.status(404).json({ message: "Ramal não encontrado" });
    if (!canAccessCompany(req, existing.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    const result = insertExtensionSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    const data = { ...result.data };
    if (!isSuperAdmin(req)) delete data.companyId;
    try {
      const ext = await storage.updateExtension(req.params.id, data);
      if (!ext) return res.status(404).json({ message: "Ramal não encontrado" });
      res.json(ext);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/extensions/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const existing = await storage.getExtension(req.params.id);
    if (!existing) return res.status(404).json({ message: "Ramal não encontrado" });
    if (!canAccessCompany(req, existing.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    await storage.deleteExtension(req.params.id);
    res.status(204).send();
  });

  // SIP Trunks (multi-tenant)
  app.get("/api/sip-trunks", async (req, res) => {
    const companyId = getCompanyFilter(req);
    const trunks = await storage.getSipTrunks(companyId);
    res.json(trunks);
  });

  app.get("/api/sip-trunks/:id", async (req, res) => {
    const trunk = await storage.getSipTrunk(req.params.id);
    if (!trunk) return res.status(404).json({ message: "Tronco SIP não encontrado" });
    if (!canAccessCompany(req, trunk.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    res.json(trunk);
  });

  app.post("/api/sip-trunks", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const result = insertSipTrunkSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    const companyId = enforceCompanyId(req, result.data.companyId);
    if (!companyId) return res.status(400).json({ message: "Empresa obrigatória" });
    const data = { ...result.data, companyId };
    try {
      const trunk = await storage.createSipTrunk(data);
      res.status(201).json(trunk);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/sip-trunks/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const existing = await storage.getSipTrunk(req.params.id);
    if (!existing) return res.status(404).json({ message: "Tronco SIP não encontrado" });
    if (!canAccessCompany(req, existing.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    const result = insertSipTrunkSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    const data = { ...result.data };
    if (!isSuperAdmin(req)) delete data.companyId;
    try {
      const trunk = await storage.updateSipTrunk(req.params.id, data);
      if (!trunk) return res.status(404).json({ message: "Tronco SIP não encontrado" });
      res.json(trunk);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/sip-trunks/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const existing = await storage.getSipTrunk(req.params.id);
    if (!existing) return res.status(404).json({ message: "Tronco SIP não encontrado" });
    if (!canAccessCompany(req, existing.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    await storage.deleteSipTrunk(req.params.id);
    res.status(204).send();
  });

  // IVR Menus (multi-tenant)
  app.get("/api/ivr-menus", async (req, res) => {
    const companyId = getCompanyFilter(req);
    const menus = await storage.getIvrMenus(companyId);
    res.json(menus);
  });

  app.get("/api/ivr-menus/:id", async (req, res) => {
    const menu = await storage.getIvrMenu(req.params.id);
    if (!menu) return res.status(404).json({ message: "Menu IVR não encontrado" });
    if (!canAccessCompany(req, menu.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    res.json(menu);
  });

  app.post("/api/ivr-menus", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const result = insertIvrMenuSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    const companyId = enforceCompanyId(req, result.data.companyId);
    if (!companyId) return res.status(400).json({ message: "Empresa obrigatória" });
    const data = { ...result.data, companyId };
    try {
      const menu = await storage.createIvrMenu(data);
      res.status(201).json(menu);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/ivr-menus/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const existing = await storage.getIvrMenu(req.params.id);
    if (!existing) return res.status(404).json({ message: "Menu IVR não encontrado" });
    if (!canAccessCompany(req, existing.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    const result = insertIvrMenuSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    const data = { ...result.data };
    if (!isSuperAdmin(req)) delete data.companyId;
    try {
      const menu = await storage.updateIvrMenu(req.params.id, data);
      if (!menu) return res.status(404).json({ message: "Menu IVR não encontrado" });
      res.json(menu);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/ivr-menus/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const existing = await storage.getIvrMenu(req.params.id);
    if (!existing) return res.status(404).json({ message: "Menu IVR não encontrado" });
    if (!canAccessCompany(req, existing.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    await storage.deleteIvrMenu(req.params.id);
    res.status(204).send();
  });

  // Queues (multi-tenant)
  app.get("/api/queues", async (req, res) => {
    const companyId = getCompanyFilter(req);
    const queuesList = await storage.getQueues(companyId);
    res.json(queuesList);
  });

  app.get("/api/queues/:id", async (req, res) => {
    const queue = await storage.getQueue(req.params.id);
    if (!queue) return res.status(404).json({ message: "Fila não encontrada" });
    if (!canAccessCompany(req, queue.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    res.json(queue);
  });

  app.post("/api/queues", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const result = insertQueueSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    const companyId = enforceCompanyId(req, result.data.companyId);
    if (!companyId) return res.status(400).json({ message: "Empresa obrigatória" });
    const data = { ...result.data, companyId };
    try {
      const queue = await storage.createQueue(data);
      res.status(201).json(queue);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/queues/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const existing = await storage.getQueue(req.params.id);
    if (!existing) return res.status(404).json({ message: "Fila não encontrada" });
    if (!canAccessCompany(req, existing.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    const result = insertQueueSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    const data = { ...result.data };
    if (!isSuperAdmin(req)) delete data.companyId;
    try {
      const queue = await storage.updateQueue(req.params.id, data);
      if (!queue) return res.status(404).json({ message: "Fila não encontrada" });
      res.json(queue);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/queues/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const existing = await storage.getQueue(req.params.id);
    if (!existing) return res.status(404).json({ message: "Fila não encontrada" });
    if (!canAccessCompany(req, existing.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    await storage.deleteQueue(req.params.id);
    res.status(204).send();
  });

  // Call Logs (multi-tenant, read-only)
  app.get("/api/call-logs", async (req, res) => {
    const companyId = getCompanyFilter(req);
    const logs = await storage.getCallLogs(companyId);
    res.json(logs);
  });

  // Self-profile update (any authenticated user can edit their own profile)
  app.patch("/api/users/me", async (req, res) => {
    const authUser = getAuthUser(req);
    const allowedFields = ["fullName", "email", "password"];
    const body: any = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined && req.body[key] !== "") {
        body[key] = req.body[key];
      }
    }
    if (Object.keys(body).length === 0) {
      return res.status(400).json({ message: "Nenhum dado para atualizar" });
    }
    try {
      if (body.password) {
        body.password = await bcrypt.hash(body.password, 10);
      }
      const user = await storage.updateUser(authUser.id, body);
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
      res.json(excludePassword(user));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Users CRUD (admin+ only, multi-tenant enforced)
  app.get("/api/users", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const companyId = getCompanyFilter(req);
    const usersList = await storage.getUsers(companyId);
    res.json(usersList.map(excludePassword));
  });

  app.post("/api/users", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    const companyId = enforceCompanyId(req, result.data.companyId);
    if (result.data.role === "super_admin" && !isSuperAdmin(req)) {
      return res.status(403).json({ message: "Apenas super_admin pode criar outro super_admin" });
    }
    try {
      const hashedPassword = await bcrypt.hash(result.data.password, 10);
      const user = await storage.createUser({ ...result.data, password: hashedPassword, companyId });
      res.status(201).json(excludePassword(user));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const existing = await storage.getUser(req.params.id);
    if (!existing) return res.status(404).json({ message: "Usuário não encontrado" });
    if (!canAccessCompany(req, existing.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    const result = insertUserSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    if (result.data.role === "super_admin" && !isSuperAdmin(req)) {
      return res.status(403).json({ message: "Apenas super_admin pode promover a super_admin" });
    }
    try {
      const updateData = { ...result.data };
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }
      if (!isSuperAdmin(req)) delete updateData.companyId;
      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
      res.json(excludePassword(user));
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const existing = await storage.getUser(req.params.id);
    if (!existing) return res.status(404).json({ message: "Usuário não encontrado" });
    if (!canAccessCompany(req, existing.companyId)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    const authUser = getAuthUser(req);
    if (existing.id === authUser.id) {
      return res.status(400).json({ message: "Não é possível remover o próprio usuário" });
    }
    await storage.deleteUser(req.params.id);
    res.status(204).send();
  });

  return httpServer;
}
