import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { createAMIClient, AsteriskAMI, type SSHConfig } from "./asterisk";
import { setupAMIRemotely } from "./ssh-config";
import {
  insertCompanySchema,
  insertServerSchema,
  insertExtensionSchema,
  insertSipTrunkSchema,
  insertIvrMenuSchema,
  insertQueueSchema,
  insertUserSchema,
  insertDidSchema,
  insertCallerIdRuleSchema,
  type User,
  type Server as ServerType,
} from "@shared/schema";
import { log } from "./index";

const cdrAbortControllers = new Map<string, AbortController>();

function startCDRListener(server: ServerType) {
  if (cdrAbortControllers.has(server.id)) {
    cdrAbortControllers.get(server.id)!.abort();
    cdrAbortControllers.delete(server.id);
  }

  if (!server.amiEnabled || !server.amiUsername || !server.amiPassword) return;

  const sshConfig: SSHConfig | undefined = server.sshEnabled
    ? {
        enabled: true,
        host: server.sshHost || server.ipAddress,
        port: server.sshPort || 22,
        username: server.sshUsername || "root",
        authMethod: (server.sshAuthMethod as "password" | "privatekey") || "password",
        password: server.sshPassword || undefined,
        privateKey: server.sshPrivateKey || undefined,
      }
    : undefined;

  const ami = new AsteriskAMI(
    server.ipAddress,
    server.amiPort || 5038,
    server.amiUsername,
    server.amiPassword,
    sshConfig
  );

  const controller = new AbortController();
  cdrAbortControllers.set(server.id, controller);

  ami.listenForCDR(async (cdr) => {
    try {
      const parseTime = (t: string) => {
        if (!t || t === "") return null;
        const d = new Date(t);
        return isNaN(d.getTime()) ? null : d;
      };

      await storage.createCallLog({
        callDate: parseTime(cdr.starttime) || new Date(),
        clid: cdr.clid || null,
        source: cdr.source || "",
        destination: cdr.destination || "",
        dcontext: cdr.dcontext || null,
        channel: cdr.channel || null,
        dstChannel: cdr.dstchannel || null,
        lastApp: cdr.lastapp || null,
        lastData: cdr.lastdata || null,
        startTime: parseTime(cdr.starttime),
        answerTime: parseTime(cdr.answertime),
        endTime: parseTime(cdr.endtime),
        duration: parseInt(cdr.duration) || 0,
        billsec: parseInt(cdr.billsec) || 0,
        disposition: cdr.disposition || "NO ANSWER",
        amaFlags: cdr.amaflags || null,
        accountCode: cdr.accountcode || null,
        uniqueId: cdr.uniqueid || null,
        linkedId: cdr.linkedid || null,
        userField: cdr.userfield || null,
        companyId: server.companyId || "",
        serverId: server.id,
      });
      log(`CDR registrado: ${cdr.source} -> ${cdr.destination} (${cdr.disposition}) [${server.name}]`);
    } catch (err: any) {
      log(`Erro ao salvar CDR [${server.name}]: ${err.message}`);
    }
  }, controller.signal).catch((err) => {
    log(`CDR listener desconectado [${server.name}]: ${err.message}`);
    cdrAbortControllers.delete(server.id);
    setTimeout(() => {
      storage.getServer(server.id).then((s) => {
        if (s && s.amiEnabled && s.status === "online") {
          log(`Reconectando CDR listener [${server.name}]...`);
          startCDRListener(s);
        }
      }).catch(() => {});
    }, 30000);
  });

  log(`CDR listener iniciado para servidor: ${server.name}`);
}

async function initCDRListeners() {
  try {
    const allServers = await storage.getServers();
    const amiServers = allServers.filter(
      (s) => s.amiEnabled && s.amiUsername && s.amiPassword && s.status === "online"
    );
    for (const server of amiServers) {
      startCDRListener(server);
    }
    log(`CDR listeners iniciados para ${amiServers.length} servidor(es)`);
  } catch (err: any) {
    log(`Erro ao iniciar CDR listeners: ${err.message}`);
  }
}

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

  let sshConfig: SSHConfig | undefined;
  if (server.sshEnabled) {
    if (!server.sshUsername) {
      throw new Error("SSH habilitado mas usuário SSH não configurado");
    }
    if (server.sshAuthMethod === "password" && !server.sshPassword) {
      throw new Error("SSH habilitado com autenticação por senha mas senha SSH não configurada");
    }
    if (server.sshAuthMethod === "privatekey" && !server.sshPrivateKey) {
      throw new Error("SSH habilitado com autenticação por chave mas chave privada não configurada");
    }
    sshConfig = {
      enabled: true,
      host: server.sshHost || server.ipAddress,
      port: server.sshPort || 22,
      username: server.sshUsername,
      authMethod: server.sshAuthMethod || "password",
      password: server.sshPassword || undefined,
      privateKey: server.sshPrivateKey || undefined,
    };
  }

  return { ami: createAMIClient(server.ipAddress, server.amiPort, server.amiUsername, server.amiPassword, sshConfig), server };
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
  app.use("/api/online-calls", requireAuth);
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
      if (server.amiEnabled && server.status === "online") {
        startCDRListener(server);
      } else if (cdrAbortControllers.has(server.id)) {
        cdrAbortControllers.get(server.id)!.abort();
        cdrAbortControllers.delete(server.id);
      }
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

  app.post("/api/servers/:id/ami/connect", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const serverId = req.params.id as string;
    try {
      const { ami } = await getAMIClient(serverId, req);
      const result = await ami.testConnection();
      if (result.success) {
        let version: string | undefined;
        try {
          const coreStatus = await ami.getCoreStatus();
          version = coreStatus?.version;
        } catch {}
        const updateData: any = { status: "online" };
        if (version) updateData.asteriskVersion = version;
        await storage.updateServer(serverId, updateData);
        res.json({ success: true, message: "Servidor conectado com sucesso", status: "online", version });
      } else {
        await storage.updateServer(serverId, { status: "offline" });
        res.json({ success: false, message: result.message || "Falha na conexão AMI", status: "offline" });
      }
    } catch (error: any) {
      try {
        await storage.updateServer(serverId, { status: "offline" });
      } catch {}
      res.json({ success: false, message: error.message, status: "offline" });
    }
  });

  app.post("/api/servers/:id/ami/setup-remote", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    const serverId = req.params.id as string;
    try {
      const server = await storage.getServer(serverId);
      if (!server) return res.status(404).json({ message: "Servidor não encontrado" });
      if (!canAccessCompany(req, server.companyId)) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      if (!server.sshEnabled || !server.sshHost || !server.sshUsername) {
        return res.status(400).json({ message: "SSH não está configurado neste servidor. Configure o túnel SSH primeiro." });
      }
      if (!server.amiUsername || !server.amiPassword) {
        return res.status(400).json({ message: "Credenciais AMI (usuário e senha) são obrigatórias para configuração remota." });
      }

      const result = await setupAMIRemotely(
        {
          host: server.sshHost,
          port: server.sshPort || 22,
          username: server.sshUsername,
          authMethod: (server.sshAuthMethod as "password" | "privatekey") || "password",
          password: server.sshPassword || undefined,
          privateKey: server.sshPrivateKey || undefined,
        },
        {
          amiPort: server.amiPort || 5038,
          amiUsername: server.amiUsername,
          amiPassword: server.amiPassword,
        }
      );

      if (result.success) {
        const updateData: any = { amiEnabled: true, status: "online" };
        if (result.asteriskVersion) updateData.asteriskVersion = result.asteriskVersion;
        await storage.updateServer(serverId, updateData);
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message, steps: [] });
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

  app.post("/api/servers/:id/ami/fetch-extensions", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { ami, server } = await getAMIClient(req.params.id as string, req);
      const [sipPeers, pjsipEndpoints] = await Promise.all([
        ami.getSIPPeers().catch(() => []),
        ami.getPJSIPEndpoints().catch(() => []),
      ]);

      const existingExtensions = await storage.getExtensionsByServer(req.params.id as string);
      const existingNumbers = new Set(existingExtensions.map((e) => e.number));

      const serverExtensions: Array<{
        number: string;
        name: string;
        protocol: string;
        status: string;
        ipAddress: string;
        exists: boolean;
        existingId?: string;
      }> = [];

      for (const peer of sipPeers) {
        const number = peer.objectname;
        if (!number || number === "anonymous") continue;
        const existing = existingExtensions.find((e) => e.number === number);
        serverExtensions.push({
          number,
          name: peer.description || number,
          protocol: "SIP",
          status: peer.status?.toLowerCase().includes("ok") ? "active" : "inactive",
          ipAddress: peer.ipaddress || "-",
          exists: existingNumbers.has(number),
          existingId: existing?.id,
        });
      }

      for (const ep of pjsipEndpoints) {
        const number = ep.objectname;
        if (!number || number === "anonymous") continue;
        const existing = existingExtensions.find((e) => e.number === number);
        serverExtensions.push({
          number,
          name: number,
          protocol: "PJSIP",
          status: ep.devicestate?.toLowerCase().includes("not") ? "inactive" : "active",
          ipAddress: "-",
          exists: existingNumbers.has(number),
          existingId: existing?.id,
        });
      }

      res.json({
        extensions: serverExtensions,
        serverId: req.params.id,
        serverName: server.name,
        companyId: server.companyId,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/servers/:id/ami/import-extensions", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const server = await storage.getServer(req.params.id as string);
      if (!server) return res.status(404).json({ message: "Servidor não encontrado" });
      if (!canAccessCompany(req, server.companyId)) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const { extensions: toImport } = req.body;
      if (!Array.isArray(toImport) || toImport.length === 0) {
        return res.status(400).json({ message: "Nenhum ramal selecionado para importar" });
      }

      const existingExtensions = await storage.getExtensionsByServer(req.params.id as string);
      const existingNumbers = new Set(existingExtensions.map((e) => e.number));

      const imported: any[] = [];
      const skipped: string[] = [];

      for (const ext of toImport) {
        if (existingNumbers.has(ext.number)) {
          skipped.push(ext.number);
          continue;
        }
        const created = await storage.createExtension({
          number: ext.number,
          name: ext.name || ext.number,
          secret: ext.secret || Math.random().toString(36).slice(2, 10),
          context: ext.context || "internal",
          protocol: ext.protocol || "SIP",
          callerId: `"${ext.name || ext.number}" <${ext.number}>`,
          mailbox: `${ext.number}@default`,
          voicemailEnabled: false,
          callRecording: false,
          callForwardNumber: "",
          companyId: server.companyId!,
          serverId: req.params.id as string,
        });
        imported.push(created);
      }

      res.json({
        imported: imported.length,
        skipped: skipped.length,
        skippedNumbers: skipped,
        total: toImport.length,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/servers/:id/extensions/check-duplicate/:number", requireAuth, async (req, res) => {
    try {
      const existingExtensions = await storage.getExtensionsByServer(req.params.id as string);
      const exists = existingExtensions.some((e) => e.number === req.params.number);
      res.json({ exists, number: req.params.number });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/online-calls", async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const allServers = await storage.getServers(companyId);
      const amiServers = allServers.filter(
        (s) => s.amiEnabled && s.amiUsername && s.amiPassword && s.status === "online"
      );

      const calls: Array<{
        channel: string;
        callerIdNum: string;
        callerIdName: string;
        extension: string;
        context: string;
        state: string;
        application: string;
        data: string;
        duration: string;
        bridgedChannel: string;
        uniqueId: string;
        serverId: string;
        serverName: string;
      }> = [];

      await Promise.all(
        amiServers.map(async (server) => {
          try {
            const { ami } = await getAMIClient(server.id, req);
            const channels = await ami.getActiveChannels();
            for (const ch of channels) {
              calls.push({
                channel: ch.channel,
                callerIdNum: ch.calleridnum,
                callerIdName: ch.calleridname,
                extension: ch.extension,
                context: ch.context,
                state: ch.state,
                application: ch.application,
                data: ch.data,
                duration: ch.duration,
                bridgedChannel: ch.bridgedchannel,
                uniqueId: ch.uniqueid,
                serverId: server.id,
                serverName: server.name,
              });
            }
          } catch (err) {
            // Server unreachable, skip
          }
        })
      );

      res.json(calls);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/extensions/live-status", async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const allServers = await storage.getServers(companyId);
      const amiServers = allServers.filter(
        (s) => s.amiEnabled && s.amiUsername && s.amiPassword && s.status === "online"
      );

      const liveStatus: Record<string, { status: string; ipAddress: string; serverId: string; serverName: string }> = {};

      await Promise.all(
        amiServers.map(async (server) => {
          try {
            const { ami } = await getAMIClient(server.id, req);
            const [sipPeers, pjsipEndpoints] = await Promise.all([
              ami.getSIPPeers().catch(() => []),
              ami.getPJSIPEndpoints().catch(() => []),
            ]);

            for (const peer of sipPeers) {
              const name = peer.objectname;
              if (!name) continue;
              const statusLower = (peer.status || "").toLowerCase();
              let normalizedStatus = "inactive";
              if (statusLower.includes("ok") || statusLower.includes("reachable")) {
                normalizedStatus = "active";
              } else if (statusLower.includes("lagged")) {
                normalizedStatus = "active";
              } else if (statusLower.includes("unreachable") || statusLower.includes("unreach")) {
                normalizedStatus = "unavailable";
              } else if (statusLower.includes("unknown")) {
                normalizedStatus = "inactive";
              }
              liveStatus[`${server.id}:${name}`] = {
                status: normalizedStatus,
                ipAddress: peer.ipaddress || "-",
                serverId: server.id,
                serverName: server.name,
              };
            }

            for (const ep of pjsipEndpoints) {
              const name = ep.objectname;
              if (!name) continue;
              const deviceState = (ep.devicestate || "").toLowerCase();
              let normalizedStatus = "inactive";
              if (deviceState.includes("ringing") || deviceState.includes("busy") || (deviceState.includes("inuse") && !deviceState.includes("not_inuse"))) {
                normalizedStatus = "busy";
              } else if (deviceState.includes("not_inuse") || deviceState === "idle") {
                normalizedStatus = "active";
              } else if (deviceState.includes("unavailable") || deviceState.includes("invalid")) {
                normalizedStatus = "unavailable";
              }
              liveStatus[`${server.id}:${name}`] = {
                status: normalizedStatus,
                ipAddress: "-",
                serverId: server.id,
                serverName: server.name,
              };
            }
          } catch (err) {
            // Server unreachable, skip
          }
        })
      );

      res.json(liveStatus);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
      const existingInServer = await storage.getExtensionsByServer(data.serverId);
      if (existingInServer.some((e) => e.number === data.number)) {
        return res.status(409).json({ message: `Ramal ${data.number} já existe neste servidor` });
      }
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

  // Call Logs (multi-tenant, read-only with filters)
  app.get("/api/call-logs", async (req, res) => {
    try {
      const companyId = getCompanyFilter(req);
      const filters: any = {};
      if (companyId) filters.companyId = companyId;
      if (req.query.serverId) filters.serverId = req.query.serverId as string;
      if (req.query.disposition) filters.disposition = req.query.disposition as string;
      if (req.query.search) filters.search = req.query.search as string;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
      if (req.query.offset) filters.offset = parseInt(req.query.offset as string);

      const result = await storage.getCallLogs(filters);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
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

  // ===== DID/DDR ROUTES =====
  app.get("/api/dids", async (req, res) => {
    const user = getAuthUser(req);
    const companyId = isSuperAdmin(req) ? undefined : user.companyId || undefined;
    const didsList = await storage.getDids(companyId);
    res.json(didsList);
  });

  app.get("/api/dids/:id", async (req, res) => {
    const did = await storage.getDid(req.params.id);
    if (!did) return res.status(404).json({ message: "DID não encontrado" });
    if (!canAccessCompany(req, did.companyId)) return res.status(403).json({ message: "Acesso negado" });
    res.json(did);
  });

  app.post("/api/dids", async (req, res) => {
    try {
      if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
      const data = insertDidSchema.parse(req.body);
      if (!canAccessCompany(req, data.companyId)) return res.status(403).json({ message: "Acesso negado" });
      const created = await storage.createDid(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/dids/:id", async (req, res) => {
    try {
      if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
      const existing = await storage.getDid(req.params.id);
      if (!existing) return res.status(404).json({ message: "DID não encontrado" });
      if (!canAccessCompany(req, existing.companyId)) return res.status(403).json({ message: "Acesso negado" });
      const updated = await storage.updateDid(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/dids/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    const existing = await storage.getDid(req.params.id);
    if (!existing) return res.status(404).json({ message: "DID não encontrado" });
    if (!canAccessCompany(req, existing.companyId)) return res.status(403).json({ message: "Acesso negado" });
    await storage.deleteDid(req.params.id);
    res.status(204).send();
  });

  // ===== CALLER ID RULES ROUTES =====
  app.get("/api/caller-id-rules", async (req, res) => {
    const user = getAuthUser(req);
    const companyId = isSuperAdmin(req) ? undefined : user.companyId || undefined;
    const rules = await storage.getCallerIdRules(companyId);
    res.json(rules);
  });

  app.get("/api/caller-id-rules/:id", async (req, res) => {
    const rule = await storage.getCallerIdRule(req.params.id);
    if (!rule) return res.status(404).json({ message: "Regra não encontrada" });
    if (!canAccessCompany(req, rule.companyId)) return res.status(403).json({ message: "Acesso negado" });
    res.json(rule);
  });

  app.post("/api/caller-id-rules", async (req, res) => {
    try {
      if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
      const data = insertCallerIdRuleSchema.parse(req.body);
      if (!canAccessCompany(req, data.companyId)) return res.status(403).json({ message: "Acesso negado" });
      const created = await storage.createCallerIdRule(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/caller-id-rules/:id", async (req, res) => {
    try {
      if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
      const existing = await storage.getCallerIdRule(req.params.id);
      if (!existing) return res.status(404).json({ message: "Regra não encontrada" });
      if (!canAccessCompany(req, existing.companyId)) return res.status(403).json({ message: "Acesso negado" });
      const updated = await storage.updateCallerIdRule(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/caller-id-rules/:id", async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    const existing = await storage.getCallerIdRule(req.params.id);
    if (!existing) return res.status(404).json({ message: "Regra não encontrada" });
    if (!canAccessCompany(req, existing.companyId)) return res.status(403).json({ message: "Acesso negado" });
    await storage.deleteCallerIdRule(req.params.id);
    res.status(204).send();
  });

  // ===== CALL REPORTS ROUTES =====
  app.get("/api/reports/calls-summary", async (req, res) => {
    const user = getAuthUser(req);
    const companyId = isSuperAdmin(req) ? undefined : user.companyId || undefined;
    const serverId = req.query.serverId as string | undefined;
    const period = (req.query.period as string) || "day";
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const result = await storage.getCallLogs({
      companyId,
      serverId,
      startDate,
      endDate,
      limit: 10000,
      offset: 0,
    });

    const dispositionCount: Record<string, number> = {};
    const hourlyCount: Record<string, number> = {};
    const dailyCount: Record<string, number> = {};
    let totalDuration = 0;
    let totalBillsec = 0;
    let answered = 0;

    result.logs.forEach((log) => {
      const disp = log.disposition || "UNKNOWN";
      dispositionCount[disp] = (dispositionCount[disp] || 0) + 1;
      if (disp === "ANSWERED") answered++;
      totalDuration += log.duration;
      totalBillsec += log.billsec;

      if (log.callDate) {
        const d = new Date(log.callDate);
        const hour = d.getHours().toString().padStart(2, "0");
        hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
        const day = d.toISOString().split("T")[0];
        dailyCount[day] = (dailyCount[day] || 0) + 1;
      }
    });

    res.json({
      total: result.total,
      answered,
      answerRate: result.total > 0 ? Math.round((answered / result.total) * 100) : 0,
      avgDuration: result.total > 0 ? Math.round(totalDuration / result.total) : 0,
      avgBillsec: answered > 0 ? Math.round(totalBillsec / answered) : 0,
      dispositionCount,
      hourlyCount,
      dailyCount,
    });
  });

  setTimeout(() => initCDRListeners(), 3000);

  return httpServer;
}
