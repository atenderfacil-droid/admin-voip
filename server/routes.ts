import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertCompanySchema,
  insertServerSchema,
  insertExtensionSchema,
  insertSipTrunkSchema,
  insertIvrMenuSchema,
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Companies
  app.get("/api/companies", async (_req, res) => {
    const companies = await storage.getCompanies();
    res.json(companies);
  });

  app.get("/api/companies/:id", async (req, res) => {
    const company = await storage.getCompany(req.params.id);
    if (!company) return res.status(404).json({ message: "Empresa não encontrada" });
    res.json(company);
  });

  app.post("/api/companies", async (req, res) => {
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
    await storage.deleteCompany(req.params.id);
    res.status(204).send();
  });

  // Servers (supports ?companyId= filter)
  app.get("/api/servers", async (req, res) => {
    const companyId = req.query.companyId as string | undefined;
    const result = await storage.getServers(companyId);
    res.json(result);
  });

  app.get("/api/servers/:id", async (req, res) => {
    const server = await storage.getServer(req.params.id);
    if (!server) return res.status(404).json({ message: "Servidor não encontrado" });
    res.json(server);
  });

  app.post("/api/servers", async (req, res) => {
    const result = insertServerSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    try {
      const server = await storage.createServer(result.data);
      res.status(201).json(server);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/servers/:id", async (req, res) => {
    const result = insertServerSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    try {
      const server = await storage.updateServer(req.params.id, result.data);
      if (!server) return res.status(404).json({ message: "Servidor não encontrado" });
      res.json(server);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/servers/:id", async (req, res) => {
    await storage.deleteServer(req.params.id);
    res.status(204).send();
  });

  // Extensions (supports ?companyId= filter)
  app.get("/api/extensions", async (req, res) => {
    const companyId = req.query.companyId as string | undefined;
    const exts = await storage.getExtensions(companyId);
    res.json(exts);
  });

  app.get("/api/extensions/:id", async (req, res) => {
    const ext = await storage.getExtension(req.params.id);
    if (!ext) return res.status(404).json({ message: "Ramal não encontrado" });
    res.json(ext);
  });

  app.post("/api/extensions", async (req, res) => {
    const result = insertExtensionSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    try {
      const ext = await storage.createExtension(result.data);
      res.status(201).json(ext);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/extensions/:id", async (req, res) => {
    const result = insertExtensionSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    try {
      const ext = await storage.updateExtension(req.params.id, result.data);
      if (!ext) return res.status(404).json({ message: "Ramal não encontrado" });
      res.json(ext);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/extensions/:id", async (req, res) => {
    await storage.deleteExtension(req.params.id);
    res.status(204).send();
  });

  // SIP Trunks (supports ?companyId= filter)
  app.get("/api/sip-trunks", async (req, res) => {
    const companyId = req.query.companyId as string | undefined;
    const trunks = await storage.getSipTrunks(companyId);
    res.json(trunks);
  });

  app.get("/api/sip-trunks/:id", async (req, res) => {
    const trunk = await storage.getSipTrunk(req.params.id);
    if (!trunk) return res.status(404).json({ message: "Tronco SIP não encontrado" });
    res.json(trunk);
  });

  app.post("/api/sip-trunks", async (req, res) => {
    const result = insertSipTrunkSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    try {
      const trunk = await storage.createSipTrunk(result.data);
      res.status(201).json(trunk);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/sip-trunks/:id", async (req, res) => {
    const result = insertSipTrunkSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    try {
      const trunk = await storage.updateSipTrunk(req.params.id, result.data);
      if (!trunk) return res.status(404).json({ message: "Tronco SIP não encontrado" });
      res.json(trunk);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/sip-trunks/:id", async (req, res) => {
    await storage.deleteSipTrunk(req.params.id);
    res.status(204).send();
  });

  // IVR Menus (supports ?companyId= filter)
  app.get("/api/ivr-menus", async (req, res) => {
    const companyId = req.query.companyId as string | undefined;
    const menus = await storage.getIvrMenus(companyId);
    res.json(menus);
  });

  app.get("/api/ivr-menus/:id", async (req, res) => {
    const menu = await storage.getIvrMenu(req.params.id);
    if (!menu) return res.status(404).json({ message: "Menu IVR não encontrado" });
    res.json(menu);
  });

  app.post("/api/ivr-menus", async (req, res) => {
    const result = insertIvrMenuSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    try {
      const menu = await storage.createIvrMenu(result.data);
      res.status(201).json(menu);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/ivr-menus/:id", async (req, res) => {
    const result = insertIvrMenuSchema.partial().safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: result.error.flatten().fieldErrors });
    }
    try {
      const menu = await storage.updateIvrMenu(req.params.id, result.data);
      if (!menu) return res.status(404).json({ message: "Menu IVR não encontrado" });
      res.json(menu);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/ivr-menus/:id", async (req, res) => {
    await storage.deleteIvrMenu(req.params.id);
    res.status(204).send();
  });

  // Call Logs (supports ?companyId= filter)
  app.get("/api/call-logs", async (req, res) => {
    const companyId = req.query.companyId as string | undefined;
    const logs = await storage.getCallLogs(companyId);
    res.json(logs);
  });

  return httpServer;
}
