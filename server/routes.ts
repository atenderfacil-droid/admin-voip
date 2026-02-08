import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import { createAMIClient, AsteriskAMI, type SSHConfig } from "./asterisk";
import { setupAMIRemotely, connectSSH, execSSHCommand, type SSHConnectionConfig } from "./ssh-config";
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
  insertConferenceRoomSchema,
  insertSpeedDialSchema,
  insertContactSchema,
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

  app.post("/api/servers/:id/ami/mixmonitor", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.mixMonitor(req.body.channel, req.body.file, req.body.options);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post("/api/servers/:id/ami/stopmixmonitor", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.stopMixMonitor(req.body.channel);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post("/api/servers/:id/ami/hangup-multiple", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.hangupMultipleChannels(req.body.pattern);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.get("/api/servers/:id/ami/pjsip-endpoint/:endpoint", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.getPJSIPEndpointDetail(req.params.endpoint as string);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.get("/api/servers/:id/ami/pjsip-endpoints", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id as string, req);
      const result = await ami.getPJSIPEndpoints();
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

  // === CONFERENCE ROOMS CRUD ===
  app.get("/api/conference-rooms", requireAuth, async (req, res) => {
    const companyId = getCompanyFilter(req);
    const result = await storage.getConferenceRooms(companyId);
    res.json(result);
  });

  app.post("/api/conference-rooms", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    const parsed = insertConferenceRoomSchema.safeParse({
      ...req.body,
      companyId: enforceCompanyId(req, req.body.companyId),
    });
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
    const room = await storage.createConferenceRoom(parsed.data);
    await logActivity(req, "create", "conference", room.id, `Sala criada: ${room.name}`);
    res.status(201).json(room);
  });

  app.put("/api/conference-rooms/:id", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    const updated = await storage.updateConferenceRoom(req.params.id, {
      ...req.body,
      companyId: enforceCompanyId(req, req.body.companyId),
    });
    if (!updated) return res.status(404).json({ message: "Sala não encontrada" });
    await logActivity(req, "update", "conference", updated.id, `Sala atualizada: ${updated.name}`);
    res.json(updated);
  });

  app.delete("/api/conference-rooms/:id", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    const room = await storage.getConferenceRoom(req.params.id);
    if (room) await logActivity(req, "delete", "conference", req.params.id, `Sala excluída: ${room.name}`);
    await storage.deleteConferenceRoom(req.params.id);
    res.json({ success: true });
  });

  // === CONFERENCE ROOMS: Live status via AMI (ConfBridge) ===
  app.get("/api/servers/:id/ami/confbridge-list", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id, req);
      try {
        const result = await ami.sendAction({ Action: "ConfbridgeListRooms" });
        res.json(result);
      } finally {
        ami.disconnect();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/servers/:id/ami/confbridge-kick", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    const { conference, channel } = req.body;
    try {
      const { ami } = await getAMIClient(req.params.id, req);
      try {
        const result = await ami.sendAction({ Action: "ConfbridgeKick", Conference: conference, Channel: channel });
        res.json(result);
      } finally {
        ami.disconnect();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/servers/:id/ami/confbridge-mute", requireAuth, async (req, res) => {
    const { conference, channel, mute } = req.body;
    try {
      const { ami } = await getAMIClient(req.params.id, req);
      try {
        const action = mute ? "ConfbridgeMute" : "ConfbridgeUnmute";
        const result = await ami.sendAction({ Action: action, Conference: conference, Channel: channel });
        res.json(result);
      } finally {
        ami.disconnect();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/servers/:id/ami/confbridge-lock", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    const { conference, lock } = req.body;
    try {
      const { ami } = await getAMIClient(req.params.id, req);
      try {
        const action = lock ? "ConfbridgeLock" : "ConfbridgeUnlock";
        const result = await ami.sendAction({ Action: action, Conference: conference });
        res.json(result);
      } finally {
        ami.disconnect();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === SPEED DIAL / BLF CRUD ===
  app.get("/api/speed-dials", requireAuth, async (req, res) => {
    const companyId = getCompanyFilter(req);
    const result = await storage.getSpeedDials(companyId);
    res.json(result);
  });

  app.post("/api/speed-dials", requireAuth, async (req, res) => {
    const parsed = insertSpeedDialSchema.safeParse({
      ...req.body,
      companyId: enforceCompanyId(req, req.body.companyId),
    });
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
    const dial = await storage.createSpeedDial(parsed.data);
    await logActivity(req, "create", "speedDial", dial.id, `Speed Dial criado: ${dial.label}`);
    res.status(201).json(dial);
  });

  app.put("/api/speed-dials/:id", requireAuth, async (req, res) => {
    const updated = await storage.updateSpeedDial(req.params.id, {
      ...req.body,
      companyId: enforceCompanyId(req, req.body.companyId),
    });
    if (!updated) return res.status(404).json({ message: "Speed Dial não encontrado" });
    await logActivity(req, "update", "speedDial", updated.id, `Speed Dial atualizado: ${updated.label}`);
    res.json(updated);
  });

  app.delete("/api/speed-dials/:id", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    const dial = await storage.getSpeedDial(req.params.id);
    if (dial) await logActivity(req, "delete", "speedDial", req.params.id, `Speed Dial excluído: ${dial.label}`);
    await storage.deleteSpeedDial(req.params.id);
    res.json({ success: true });
  });

  // === VOICEMAIL: List via AMI ===
  app.get("/api/servers/:id/ami/voicemail-list", requireAuth, async (req, res) => {
    try {
      const { ami } = await getAMIClient(req.params.id, req);
      try {
        const result = await ami.sendAction({ Action: "VoicemailUsersList" });
        res.json(result);
      } finally {
        ami.disconnect();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === VOICEMAIL: List messages via SSH ===
  app.get("/api/servers/:id/voicemail-messages", requireAuth, async (req, res) => {
    try {
      const { client } = await getSSHClient(req.params.id, req);
      try {
        const vmPath = "/var/spool/asterisk/voicemail";
        const result = await execSSHCommand(client, `find ${vmPath} -name "msg*.txt" -o -name "msg*.wav" -o -name "msg*.WAV" 2>/dev/null | head -500`);
        const files = result.split("\n").filter(Boolean);
        const messages: any[] = [];
        const txtFiles = files.filter(f => f.endsWith(".txt"));
        for (const txtFile of txtFiles.slice(0, 100)) {
          try {
            const content = await execSSHCommand(client, `cat "${txtFile}" 2>/dev/null`);
            const parts = txtFile.split("/");
            const context = parts[parts.indexOf("voicemail") + 1] || "default";
            const mailbox = parts[parts.indexOf("voicemail") + 2] || "";
            const folder = parts[parts.indexOf("voicemail") + 3] || "";
            const callerid = content.match(/callerid=(.*)/)?.[1] || "";
            const origtime = content.match(/origtime=(.*)/)?.[1] || "";
            const duration = content.match(/duration=(.*)/)?.[1] || "0";
            const msgnum = txtFile.match(/msg(\d+)\.txt/)?.[1] || "";
            const wavFile = txtFile.replace(".txt", ".wav");
            const hasAudio = files.includes(wavFile);
            messages.push({ context, mailbox, folder, callerid, origtime, duration: parseInt(duration), msgnum, txtFile, wavFile: hasAudio ? wavFile : null });
          } catch {}
        }
        client.end();
        res.json({ messages });
      } catch (err: any) {
        client.end();
        res.status(500).json({ message: err.message });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === VOICEMAIL: Stream audio file ===
  app.get("/api/servers/:id/voicemail-messages/download", requireAuth, async (req, res) => {
    try {
      const filePath = req.query.file as string;
      if (!filePath) return res.status(400).json({ message: "Parâmetro file é obrigatório" });
      const { client } = await getSSHClient(req.params.id, req);
      const sftp = await new Promise<any>((resolve, reject) => {
        client.sftp((err: any, sftp: any) => {
          if (err) { client.end(); reject(err); return; }
          resolve(sftp);
        });
      });
      const stream = sftp.createReadStream(filePath);
      const fileName = filePath.split("/").pop() || "voicemail.wav";
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      stream.pipe(res);
      stream.on("end", () => client.end());
      stream.on("error", () => { client.end(); res.status(500).end(); });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === VOICEMAIL: Delete message ===
  app.delete("/api/servers/:id/voicemail-messages", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    try {
      const filePath = req.query.file as string;
      if (!filePath) return res.status(400).json({ message: "Parâmetro file é obrigatório" });
      const { client } = await getSSHClient(req.params.id, req);
      const basePath = filePath.replace(/\.(txt|wav|WAV)$/, "");
      await execSSHCommand(client, `rm -f "${basePath}".* 2>/dev/null`);
      client.end();
      await logActivity(req, "delete", "voicemail", null, `Voicemail excluído: ${filePath}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === CONTACTS CRUD ===
  app.get("/api/contacts", requireAuth, async (req, res) => {
    const companyId = getCompanyFilter(req);
    const result = await storage.getContacts(companyId);
    res.json(result);
  });

  app.post("/api/contacts", requireAuth, async (req, res) => {
    const parsed = insertContactSchema.safeParse({
      ...req.body,
      companyId: enforceCompanyId(req, req.body.companyId),
    });
    if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
    const contact = await storage.createContact(parsed.data);
    await logActivity(req, "create", "contact", contact.id, `Contato criado: ${contact.name}`);
    res.status(201).json(contact);
  });

  app.put("/api/contacts/:id", requireAuth, async (req, res) => {
    const updated = await storage.updateContact(req.params.id, {
      ...req.body,
      companyId: enforceCompanyId(req, req.body.companyId),
    });
    if (!updated) return res.status(404).json({ message: "Contato não encontrado" });
    await logActivity(req, "update", "contact", updated.id, `Contato atualizado: ${updated.name}`);
    res.json(updated);
  });

  app.delete("/api/contacts/:id", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    const contact = await storage.getContact(req.params.id);
    if (contact) await logActivity(req, "delete", "contact", req.params.id, `Contato excluído: ${contact.name}`);
    await storage.deleteContact(req.params.id);
    res.json({ success: true });
  });

  // === ACTIVITY LOGS ===
  app.get("/api/activity-logs", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    const companyId = getCompanyFilter(req);
    const userId = req.query.userId as string | undefined;
    const resource = req.query.resource as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const result = await storage.getActivityLogs({ companyId, userId, resource, limit, offset });
    res.json({ ...result, page, limit, totalPages: Math.ceil(result.total / limit) });
  });

  // === MUSIC ON HOLD: List MoH files via SSH ===
  app.get("/api/servers/:id/moh", requireAuth, async (req, res) => {
    try {
      const { client } = await getSSHClient(req.params.id, req);
      try {
        const mohPaths = [
          "/var/lib/asterisk/moh",
          "/usr/share/asterisk/moh",
          "/var/lib/asterisk/sounds/moh",
        ];
        const findCmd = `for dir in ${mohPaths.join(" ")}; do [ -d "$dir" ] && find "$dir" -type f \\( -name "*.wav" -o -name "*.mp3" -o -name "*.gsm" -o -name "*.ulaw" -o -name "*.alaw" \\) -printf '%T@ %s %p\\n' 2>/dev/null; done | sort -rn`;
        const result = await execSSHCommand(client, findCmd);
        const lines = result.stdout.trim().split("\n").filter(l => l.trim());

        const classesCmd = `grep -r "^\\[" /etc/asterisk/musiconhold.conf 2>/dev/null || echo ''`;
        const classesResult = await execSSHCommand(client, classesCmd);
        const classNames = classesResult.stdout.match(/\[([^\]]+)\]/g)?.map(c => c.replace(/[\[\]]/g, "")) || ["default"];

        const files = lines.map((line) => {
          const parts = line.split(" ");
          const timestamp = parseFloat(parts[0]) * 1000;
          const size = parseInt(parts[1]);
          const filePath = parts.slice(2).join(" ");
          const fileName = filePath.split("/").pop() || "";
          const parentDir = filePath.split("/").slice(-2, -1)[0] || "";
          return { fileName, filePath, size, date: new Date(timestamp).toISOString(), mohClass: parentDir, extension: fileName.split(".").pop()?.toLowerCase() || "" };
        }).filter(r => r.fileName);

        res.json({ files, classes: classNames });
      } finally {
        client.end();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === MUSIC ON HOLD: Delete MoH file ===
  app.delete("/api/servers/:id/moh", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    try {
      const { client } = await getSSHClient(req.params.id, req);
      try {
        const filePath = req.query.file as string;
        if (!filePath) return res.status(400).json({ message: "Parâmetro 'file' é obrigatório" });
        const sanitized = filePath.replace(/[;&|`$]/g, "");
        await execSSHCommand(client, `rm -f "${sanitized}"`);
        await execSSHCommand(client, "asterisk -rx 'moh reload' 2>/dev/null || true");
        res.json({ success: true, message: "Arquivo MoH excluído" });
      } finally {
        client.end();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === MUSIC ON HOLD: Download/stream MoH file ===
  app.get("/api/servers/:id/moh/download", requireAuth, async (req, res) => {
    try {
      const { client } = await getSSHClient(req.params.id, req);
      const filePath = req.query.file as string;
      if (!filePath) { client.end(); return res.status(400).json({ message: "Parâmetro 'file' é obrigatório" }); }
      const sanitized = filePath.replace(/[;&|`$]/g, "");
      const fileName = sanitized.split("/").pop() || "moh";
      const ext = fileName.split(".").pop()?.toLowerCase() || "wav";
      const ct: Record<string, string> = { wav: "audio/wav", mp3: "audio/mpeg", gsm: "audio/x-gsm", ulaw: "audio/basic", alaw: "audio/basic" };
      res.setHeader("Content-Type", ct[ext] || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      client.exec(`cat "${sanitized}"`, (err, stream) => {
        if (err) { client.end(); return res.status(500).json({ message: "Erro ao ler arquivo" }); }
        stream.pipe(res);
        stream.on("close", () => client.end());
        stream.on("error", () => { client.end(); res.end(); });
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === BACKUP: Create backup of Asterisk configs via SSH ===
  app.post("/api/servers/:id/backup", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    try {
      const { client, server } = await getSSHClient(req.params.id, req);
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupDir = "/var/backups/asterisk";
        const backupFile = `asterisk-backup-${timestamp}.tar.gz`;

        await execSSHCommand(client, `mkdir -p ${backupDir}`);
        const result = await execSSHCommand(client, `tar czf ${backupDir}/${backupFile} /etc/asterisk/ /var/spool/asterisk/voicemail/ 2>/dev/null; echo $?`);

        await logActivity(req, "backup", "server", server.id, `Backup criado: ${backupFile}`);
        res.json({ success: true, message: `Backup criado: ${backupFile}`, fileName: backupFile, path: `${backupDir}/${backupFile}` });
      } finally {
        client.end();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === BACKUP: List backups via SSH ===
  app.get("/api/servers/:id/backups", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    try {
      const { client } = await getSSHClient(req.params.id, req);
      try {
        const result = await execSSHCommand(client, `ls -la /var/backups/asterisk/*.tar.gz 2>/dev/null | awk '{print $5, $6, $7, $8, $9}' || echo ''`);
        const lines = result.stdout.trim().split("\n").filter(l => l.trim());
        const backups = lines.map((line) => {
          const parts = line.trim().split(/\s+/);
          const size = parseInt(parts[0]) || 0;
          const filePath = parts[parts.length - 1] || "";
          const fileName = filePath.split("/").pop() || "";
          return { fileName, filePath, size, date: parts.slice(1, -1).join(" ") };
        }).filter(b => b.fileName);
        res.json({ backups });
      } finally {
        client.end();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === BACKUP: Download backup file via SSH ===
  app.get("/api/servers/:id/backups/download", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    try {
      const { client } = await getSSHClient(req.params.id, req);
      const filePath = req.query.file as string;
      if (!filePath) { client.end(); return res.status(400).json({ message: "Parâmetro 'file' é obrigatório" }); }
      const sanitized = filePath.replace(/[;&|`$]/g, "");
      const fileName = sanitized.split("/").pop() || "backup.tar.gz";
      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      client.exec(`cat "${sanitized}"`, (err, stream) => {
        if (err) { client.end(); return res.status(500).json({ message: "Erro ao ler backup" }); }
        stream.pipe(res);
        stream.on("close", () => client.end());
        stream.on("error", () => { client.end(); res.end(); });
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === BACKUP: Delete backup via SSH ===
  app.delete("/api/servers/:id/backups", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) return res.status(403).json({ message: "Permissão insuficiente" });
    try {
      const { client } = await getSSHClient(req.params.id, req);
      try {
        const filePath = req.query.file as string;
        if (!filePath) return res.status(400).json({ message: "Parâmetro 'file' é obrigatório" });
        const sanitized = filePath.replace(/[;&|`$]/g, "");
        await execSSHCommand(client, `rm -f "${sanitized}"`);
        res.json({ success: true, message: "Backup excluído" });
      } finally {
        client.end();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === BACKUP: Restore backup via SSH ===
  app.post("/api/servers/:id/backups/restore", requireAuth, async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ message: "Apenas super_admin pode restaurar backups" });
    try {
      const { client, server } = await getSSHClient(req.params.id, req);
      try {
        const { file } = req.body;
        if (!file) return res.status(400).json({ message: "Parâmetro 'file' é obrigatório" });
        const sanitized = file.replace(/[;&|`$]/g, "");

        await execSSHCommand(client, `cp -a /etc/asterisk /etc/asterisk.pre-restore-$(date +%Y%m%d%H%M%S)`);
        const result = await execSSHCommand(client, `tar xzf "${sanitized}" -C / 2>&1`);
        await execSSHCommand(client, "asterisk -rx 'core reload' 2>/dev/null || true");

        await logActivity(req, "restore", "server", server.id, `Backup restaurado: ${sanitized}`);
        res.json({ success: result.code === 0, message: result.code === 0 ? "Backup restaurado com sucesso" : result.stderr || "Erro na restauração" });
      } finally {
        client.end();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === Activity log helper ===
  async function logActivity(req: Request, action: string, resource: string, resourceId?: string, details?: string) {
    try {
      const user = getAuthUser(req);
      await storage.createActivityLog({
        userId: user.id,
        userName: user.fullName || user.username,
        action,
        resource,
        resourceId: resourceId || undefined,
        details,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || undefined,
        companyId: user.companyId || undefined,
      });
    } catch {}
  }

  // === SSH helper to get SSH client from server ===
  async function getSSHClient(serverId: string, req: Request) {
    const server = await storage.getServer(serverId);
    if (!server) throw new Error("Servidor não encontrado");
    if (!canAccessCompany(req, server.companyId)) {
      throw new Error("Acesso negado");
    }
    if (!server.sshEnabled || !server.sshHost || !server.sshUsername) {
      throw new Error("SSH não está configurado neste servidor");
    }
    const sshConfig: SSHConnectionConfig = {
      host: server.sshHost || server.ipAddress,
      port: server.sshPort || 22,
      username: server.sshUsername,
      authMethod: (server.sshAuthMethod as "password" | "privatekey") || "password",
      password: server.sshPassword || undefined,
      privateKey: server.sshPrivateKey || undefined,
    };
    const client = await connectSSH(sshConfig);
    return { client, server };
  }

  // === RECORDINGS: List recordings via SSH ===
  app.get("/api/servers/:id/recordings", requireAuth, async (req, res) => {
    try {
      const { client, server } = await getSSHClient(req.params.id, req);
      try {
        const searchDate = (req.query.date as string) || "";
        const searchTerm = (req.query.search as string) || "";
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;

        const paths = [
          "/var/spool/asterisk/monitor",
          "/var/lib/asterisk/sounds/monitor",
          "/var/spool/asterisk/recording",
          "/tmp/asterisk-recordings",
        ];

        const findCmd = `for dir in ${paths.join(" ")}; do [ -d "$dir" ] && find "$dir" -type f \\( -name "*.wav" -o -name "*.gsm" -o -name "*.mp3" -o -name "*.ogg" -o -name "*.WAV" \\) -printf '%T@ %s %p\\n' 2>/dev/null; done | sort -rn`;

        const result = await execSSHCommand(client, findCmd);
        const lines = result.stdout.trim().split("\n").filter(l => l.trim());

        const recordings = lines.map((line) => {
          const parts = line.split(" ");
          const timestamp = parseFloat(parts[0]) * 1000;
          const size = parseInt(parts[1]);
          const filePath = parts.slice(2).join(" ");
          const fileName = filePath.split("/").pop() || "";
          return {
            fileName,
            filePath,
            size,
            date: new Date(timestamp).toISOString(),
            extension: fileName.split(".").pop()?.toLowerCase() || "",
          };
        }).filter(r => r.fileName);

        let filtered = recordings;
        if (searchDate) {
          filtered = filtered.filter(r => r.date.startsWith(searchDate));
        }
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          filtered = filtered.filter(r => r.fileName.toLowerCase().includes(term) || r.filePath.toLowerCase().includes(term));
        }

        const total = filtered.length;
        const offset = (page - 1) * limit;
        const paginated = filtered.slice(offset, offset + limit);

        res.json({ recordings: paginated, total, page, limit, totalPages: Math.ceil(total / limit) });
      } finally {
        client.end();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === RECORDINGS: Download/stream a recording file via SSH ===
  app.get("/api/servers/:id/recordings/download", requireAuth, async (req, res) => {
    try {
      const { client, server } = await getSSHClient(req.params.id, req);
      const filePath = req.query.file as string;
      if (!filePath) {
        client.end();
        return res.status(400).json({ message: "Parâmetro 'file' é obrigatório" });
      }

      const sanitized = filePath.replace(/[;&|`$]/g, "");
      const fileName = sanitized.split("/").pop() || "recording";
      const ext = fileName.split(".").pop()?.toLowerCase() || "wav";

      const contentTypes: Record<string, string> = {
        wav: "audio/wav",
        mp3: "audio/mpeg",
        gsm: "audio/x-gsm",
        ogg: "audio/ogg",
      };

      res.setHeader("Content-Type", contentTypes[ext] || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

      client.exec(`cat "${sanitized}"`, (err, stream) => {
        if (err) {
          client.end();
          return res.status(500).json({ message: "Erro ao ler arquivo" });
        }
        stream.pipe(res);
        stream.on("close", () => client.end());
        stream.on("error", () => {
          client.end();
          res.end();
        });
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === RECORDINGS: Delete a recording via SSH ===
  app.delete("/api/servers/:id/recordings", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { client } = await getSSHClient(req.params.id, req);
      try {
        const filePath = req.query.file as string;
        if (!filePath) return res.status(400).json({ message: "Parâmetro 'file' é obrigatório" });
        const sanitized = filePath.replace(/[;&|`$]/g, "");
        const result = await execSSHCommand(client, `rm -f "${sanitized}"`);
        if (result.code === 0) {
          res.json({ success: true, message: "Gravação excluída" });
        } else {
          res.status(500).json({ message: result.stderr || "Erro ao excluir gravação" });
        }
      } finally {
        client.end();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === FIREWALL: Fail2ban status via SSH ===
  app.get("/api/servers/:id/firewall/fail2ban", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { client } = await getSSHClient(req.params.id, req);
      try {
        const statusResult = await execSSHCommand(client, "fail2ban-client status 2>/dev/null || echo 'NOT_INSTALLED'");
        if (statusResult.stdout.includes("NOT_INSTALLED")) {
          return res.json({ installed: false, jails: [] });
        }

        const jailListMatch = statusResult.stdout.match(/Jail list:\s*(.*)/);
        const jailNames = jailListMatch ? jailListMatch[1].split(",").map(j => j.trim()).filter(Boolean) : [];

        const jails = [];
        for (const name of jailNames) {
          const jailResult = await execSSHCommand(client, `fail2ban-client status ${name} 2>/dev/null`);
          const currentlyBanned = jailResult.stdout.match(/Currently banned:\s*(\d+)/);
          const totalBanned = jailResult.stdout.match(/Total banned:\s*(\d+)/);
          const bannedIps = jailResult.stdout.match(/Banned IP list:\s*(.*)/);
          const currentlyFailed = jailResult.stdout.match(/Currently failed:\s*(\d+)/);
          const totalFailed = jailResult.stdout.match(/Total failed:\s*(\d+)/);

          jails.push({
            name,
            currentlyBanned: parseInt(currentlyBanned?.[1] || "0"),
            totalBanned: parseInt(totalBanned?.[1] || "0"),
            bannedIps: bannedIps?.[1]?.trim().split(/\s+/).filter(Boolean) || [],
            currentlyFailed: parseInt(currentlyFailed?.[1] || "0"),
            totalFailed: parseInt(totalFailed?.[1] || "0"),
          });
        }

        res.json({ installed: true, jails });
      } finally {
        client.end();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === FIREWALL: Fail2ban unban IP ===
  app.post("/api/servers/:id/firewall/fail2ban/unban", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { client } = await getSSHClient(req.params.id, req);
      try {
        const { jail, ip } = req.body;
        if (!jail || !ip) return res.status(400).json({ message: "Jail e IP são obrigatórios" });
        const sanitizedJail = jail.replace(/[;&|`$]/g, "");
        const sanitizedIp = ip.replace(/[;&|`$]/g, "");
        const result = await execSSHCommand(client, `fail2ban-client set ${sanitizedJail} unbanip ${sanitizedIp}`);
        res.json({ success: result.code === 0, message: result.stdout || result.stderr });
      } finally {
        client.end();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === FIREWALL: IPTables rules via SSH ===
  app.get("/api/servers/:id/firewall/iptables", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { client } = await getSSHClient(req.params.id, req);
      try {
        const result = await execSSHCommand(client, "iptables -L -n -v --line-numbers 2>/dev/null || echo 'NO_ACCESS'");
        if (result.stdout.includes("NO_ACCESS")) {
          return res.json({ accessible: false, chains: [] });
        }

        const lines = result.stdout.trim().split("\n");
        const chains: Array<{ name: string; policy: string; rules: Array<{ num: string; pkts: string; bytes: string; target: string; prot: string; source: string; destination: string; extra: string }> }> = [];
        let currentChain: any = null;

        for (const line of lines) {
          const chainMatch = line.match(/^Chain\s+(\S+)\s+\(policy\s+(\S+)/);
          if (chainMatch) {
            if (currentChain) chains.push(currentChain);
            currentChain = { name: chainMatch[1], policy: chainMatch[2], rules: [] };
            continue;
          }
          if (currentChain && /^\s*\d+/.test(line)) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 8) {
              currentChain.rules.push({
                num: parts[0],
                pkts: parts[1],
                bytes: parts[2],
                target: parts[3],
                prot: parts[4],
                source: parts[6],
                destination: parts[7],
                extra: parts.slice(8).join(" "),
              });
            }
          }
        }
        if (currentChain) chains.push(currentChain);

        res.json({ accessible: true, chains });
      } finally {
        client.end();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === FIREWALL: System security overview via SSH ===
  app.get("/api/servers/:id/firewall/overview", requireAuth, async (req, res) => {
    if (!isAdminOrAbove(req)) {
      return res.status(403).json({ message: "Permissão insuficiente" });
    }
    try {
      const { client } = await getSSHClient(req.params.id, req);
      try {
        const [fail2banVer, iptablesCount, lastAuthLogs, sipPorts] = await Promise.all([
          execSSHCommand(client, "fail2ban-client --version 2>/dev/null | head -1 || echo 'NOT_INSTALLED'"),
          execSSHCommand(client, "iptables -L -n 2>/dev/null | grep -c '^' || echo '0'"),
          execSSHCommand(client, "tail -20 /var/log/auth.log 2>/dev/null || tail -20 /var/log/secure 2>/dev/null || echo ''"),
          execSSHCommand(client, "ss -tlnp 2>/dev/null | grep -E ':(5060|5061|5038|8088|8089)' || echo ''"),
        ]);

        const authLines = lastAuthLogs.stdout.trim().split("\n").filter(Boolean);
        const failedLogins = authLines.filter(l => l.toLowerCase().includes("failed") || l.toLowerCase().includes("invalid")).length;

        res.json({
          fail2banVersion: fail2banVer.stdout.includes("NOT_INSTALLED") ? null : fail2banVer.stdout.trim(),
          iptablesRuleCount: parseInt(iptablesCount.stdout.trim()) || 0,
          recentFailedLogins: failedLogins,
          openSipPorts: sipPorts.stdout.trim().split("\n").filter(Boolean),
          lastAuthLogs: authLines.slice(-10),
        });
      } finally {
        client.end();
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  setTimeout(() => initCDRListeners(), 3000);

  return httpServer;
}
