import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  companies,
  servers,
  extensions,
  sipTrunks,
  ivrMenus,
  queues,
  callLogs,
  dids,
  callerIdRules,
  type User,
  type InsertUser,
  type Company,
  type InsertCompany,
  type Server,
  type InsertServer,
  type Extension,
  type InsertExtension,
  type SipTrunk,
  type InsertSipTrunk,
  type IvrMenu,
  type InsertIvrMenu,
  type Queue,
  type InsertQueue,
  type CallLog,
  type InsertCallLog,
  type Did,
  type InsertDid,
  type CallerIdRule,
  type InsertCallerIdRule,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUsers(companyId?: string): Promise<User[]>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  getCompanies(companyId?: string): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<void>;

  getServers(companyId?: string): Promise<Server[]>;
  getServer(id: string): Promise<Server | undefined>;
  createServer(server: InsertServer): Promise<Server>;
  updateServer(id: string, server: Partial<InsertServer>): Promise<Server | undefined>;
  deleteServer(id: string): Promise<void>;

  getExtensions(companyId?: string): Promise<Extension[]>;
  getExtensionsByServer(serverId: string): Promise<Extension[]>;
  getExtension(id: string): Promise<Extension | undefined>;
  createExtension(extension: InsertExtension): Promise<Extension>;
  updateExtension(id: string, extension: Partial<InsertExtension>): Promise<Extension | undefined>;
  deleteExtension(id: string): Promise<void>;

  getSipTrunks(companyId?: string): Promise<SipTrunk[]>;
  getSipTrunk(id: string): Promise<SipTrunk | undefined>;
  createSipTrunk(trunk: InsertSipTrunk): Promise<SipTrunk>;
  updateSipTrunk(id: string, trunk: Partial<InsertSipTrunk>): Promise<SipTrunk | undefined>;
  deleteSipTrunk(id: string): Promise<void>;

  getIvrMenus(companyId?: string): Promise<IvrMenu[]>;
  getIvrMenu(id: string): Promise<IvrMenu | undefined>;
  createIvrMenu(menu: InsertIvrMenu): Promise<IvrMenu>;
  updateIvrMenu(id: string, menu: Partial<InsertIvrMenu>): Promise<IvrMenu | undefined>;
  deleteIvrMenu(id: string): Promise<void>;

  getQueues(companyId?: string): Promise<Queue[]>;
  getQueue(id: string): Promise<Queue | undefined>;
  createQueue(queue: InsertQueue): Promise<Queue>;
  updateQueue(id: string, queue: Partial<InsertQueue>): Promise<Queue | undefined>;
  deleteQueue(id: string): Promise<void>;

  getCallLogs(filters: {
    companyId?: string;
    serverId?: string;
    disposition?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: CallLog[]; total: number }>;
  createCallLog(log: InsertCallLog): Promise<CallLog>;

  getDids(companyId?: string): Promise<Did[]>;
  getDid(id: string): Promise<Did | undefined>;
  createDid(did: InsertDid): Promise<Did>;
  updateDid(id: string, did: Partial<InsertDid>): Promise<Did | undefined>;
  deleteDid(id: string): Promise<void>;

  getCallerIdRules(companyId?: string): Promise<CallerIdRule[]>;
  getCallerIdRule(id: string): Promise<CallerIdRule | undefined>;
  createCallerIdRule(rule: InsertCallerIdRule): Promise<CallerIdRule>;
  updateCallerIdRule(id: string, rule: Partial<InsertCallerIdRule>): Promise<CallerIdRule | undefined>;
  deleteCallerIdRule(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getUsers(companyId?: string): Promise<User[]> {
    if (companyId) {
      return db.select().from(users).where(eq(users.companyId, companyId));
    }
    return db.select().from(users);
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getCompanies(companyId?: string): Promise<Company[]> {
    if (companyId) {
      return db.select().from(companies).where(eq(companies.id, companyId));
    }
    return db.select().from(companies);
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    const [created] = await db.insert(companies).values(company).returning();
    return created;
  }

  async updateCompany(id: string, company: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updated] = await db.update(companies).set(company).where(eq(companies.id, id)).returning();
    return updated;
  }

  async deleteCompany(id: string): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  async getServers(companyId?: string): Promise<Server[]> {
    if (companyId) {
      return db.select().from(servers).where(eq(servers.companyId, companyId));
    }
    return db.select().from(servers);
  }

  async getServer(id: string): Promise<Server | undefined> {
    const [server] = await db.select().from(servers).where(eq(servers.id, id));
    return server;
  }

  async createServer(server: InsertServer): Promise<Server> {
    const [created] = await db.insert(servers).values(server).returning();
    return created;
  }

  async updateServer(id: string, server: Partial<InsertServer>): Promise<Server | undefined> {
    const [updated] = await db.update(servers).set(server).where(eq(servers.id, id)).returning();
    return updated;
  }

  async deleteServer(id: string): Promise<void> {
    await db.delete(servers).where(eq(servers.id, id));
  }

  async getExtensions(companyId?: string): Promise<Extension[]> {
    if (companyId) {
      return db.select().from(extensions).where(eq(extensions.companyId, companyId));
    }
    return db.select().from(extensions);
  }

  async getExtensionsByServer(serverId: string): Promise<Extension[]> {
    return db.select().from(extensions).where(eq(extensions.serverId, serverId));
  }

  async getExtension(id: string): Promise<Extension | undefined> {
    const [ext] = await db.select().from(extensions).where(eq(extensions.id, id));
    return ext;
  }

  async createExtension(extension: InsertExtension): Promise<Extension> {
    const [created] = await db.insert(extensions).values(extension).returning();
    return created;
  }

  async updateExtension(id: string, extension: Partial<InsertExtension>): Promise<Extension | undefined> {
    const [updated] = await db.update(extensions).set(extension).where(eq(extensions.id, id)).returning();
    return updated;
  }

  async deleteExtension(id: string): Promise<void> {
    await db.delete(extensions).where(eq(extensions.id, id));
  }

  async getSipTrunks(companyId?: string): Promise<SipTrunk[]> {
    if (companyId) {
      return db.select().from(sipTrunks).where(eq(sipTrunks.companyId, companyId));
    }
    return db.select().from(sipTrunks);
  }

  async getSipTrunk(id: string): Promise<SipTrunk | undefined> {
    const [trunk] = await db.select().from(sipTrunks).where(eq(sipTrunks.id, id));
    return trunk;
  }

  async createSipTrunk(trunk: InsertSipTrunk): Promise<SipTrunk> {
    const [created] = await db.insert(sipTrunks).values(trunk).returning();
    return created;
  }

  async updateSipTrunk(id: string, trunk: Partial<InsertSipTrunk>): Promise<SipTrunk | undefined> {
    const [updated] = await db.update(sipTrunks).set(trunk).where(eq(sipTrunks.id, id)).returning();
    return updated;
  }

  async deleteSipTrunk(id: string): Promise<void> {
    await db.delete(sipTrunks).where(eq(sipTrunks.id, id));
  }

  async getIvrMenus(companyId?: string): Promise<IvrMenu[]> {
    if (companyId) {
      return db.select().from(ivrMenus).where(eq(ivrMenus.companyId, companyId));
    }
    return db.select().from(ivrMenus);
  }

  async getIvrMenu(id: string): Promise<IvrMenu | undefined> {
    const [menu] = await db.select().from(ivrMenus).where(eq(ivrMenus.id, id));
    return menu;
  }

  async createIvrMenu(menu: InsertIvrMenu): Promise<IvrMenu> {
    const [created] = await db.insert(ivrMenus).values(menu as any).returning();
    return created;
  }

  async updateIvrMenu(id: string, menu: Partial<InsertIvrMenu>): Promise<IvrMenu | undefined> {
    const [updated] = await db.update(ivrMenus).set(menu as any).where(eq(ivrMenus.id, id)).returning();
    return updated;
  }

  async deleteIvrMenu(id: string): Promise<void> {
    await db.delete(ivrMenus).where(eq(ivrMenus.id, id));
  }

  async getQueues(companyId?: string): Promise<Queue[]> {
    if (companyId) {
      return db.select().from(queues).where(eq(queues.companyId, companyId));
    }
    return db.select().from(queues);
  }

  async getQueue(id: string): Promise<Queue | undefined> {
    const [queue] = await db.select().from(queues).where(eq(queues.id, id));
    return queue;
  }

  async createQueue(queue: InsertQueue): Promise<Queue> {
    const [created] = await db.insert(queues).values(queue as any).returning();
    return created;
  }

  async updateQueue(id: string, queue: Partial<InsertQueue>): Promise<Queue | undefined> {
    const [updated] = await db.update(queues).set(queue as any).where(eq(queues.id, id)).returning();
    return updated;
  }

  async deleteQueue(id: string): Promise<void> {
    await db.delete(queues).where(eq(queues.id, id));
  }

  async getCallLogs(filters: {
    companyId?: string;
    serverId?: string;
    disposition?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: CallLog[]; total: number }> {
    const conditions = [];
    if (filters.companyId) conditions.push(eq(callLogs.companyId, filters.companyId));
    if (filters.serverId) conditions.push(eq(callLogs.serverId, filters.serverId));
    if (filters.disposition) conditions.push(eq(callLogs.disposition, filters.disposition));
    if (filters.startDate) conditions.push(gte(callLogs.callDate, filters.startDate));
    if (filters.endDate) conditions.push(lte(callLogs.callDate, filters.endDate));
    if (filters.search) {
      conditions.push(
        sql`(${callLogs.source} ILIKE ${'%' + filters.search + '%'} OR ${callLogs.destination} ILIKE ${'%' + filters.search + '%'} OR ${callLogs.clid} ILIKE ${'%' + filters.search + '%'})`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const [totalResult] = await db.select({ count: sql<number>`count(*)::int` }).from(callLogs).where(where);
    const logs = await db.select().from(callLogs).where(where).orderBy(desc(callLogs.callDate)).limit(limit).offset(offset);

    return { logs, total: totalResult?.count || 0 };
  }

  async createCallLog(log: InsertCallLog): Promise<CallLog> {
    const [created] = await db.insert(callLogs).values(log).returning();
    return created;
  }

  async getDids(companyId?: string): Promise<Did[]> {
    if (companyId) {
      return db.select().from(dids).where(eq(dids.companyId, companyId));
    }
    return db.select().from(dids);
  }

  async getDid(id: string): Promise<Did | undefined> {
    const [did] = await db.select().from(dids).where(eq(dids.id, id));
    return did;
  }

  async createDid(did: InsertDid): Promise<Did> {
    const [created] = await db.insert(dids).values(did).returning();
    return created;
  }

  async updateDid(id: string, did: Partial<InsertDid>): Promise<Did | undefined> {
    const [updated] = await db.update(dids).set(did).where(eq(dids.id, id)).returning();
    return updated;
  }

  async deleteDid(id: string): Promise<void> {
    await db.delete(dids).where(eq(dids.id, id));
  }

  async getCallerIdRules(companyId?: string): Promise<CallerIdRule[]> {
    if (companyId) {
      return db.select().from(callerIdRules).where(eq(callerIdRules.companyId, companyId));
    }
    return db.select().from(callerIdRules);
  }

  async getCallerIdRule(id: string): Promise<CallerIdRule | undefined> {
    const [rule] = await db.select().from(callerIdRules).where(eq(callerIdRules.id, id));
    return rule;
  }

  async createCallerIdRule(rule: InsertCallerIdRule): Promise<CallerIdRule> {
    const [created] = await db.insert(callerIdRules).values(rule).returning();
    return created;
  }

  async updateCallerIdRule(id: string, rule: Partial<InsertCallerIdRule>): Promise<CallerIdRule | undefined> {
    const [updated] = await db.update(callerIdRules).set(rule).where(eq(callerIdRules.id, id)).returning();
    return updated;
  }

  async deleteCallerIdRule(id: string): Promise<void> {
    await db.delete(callerIdRules).where(eq(callerIdRules.id, id));
  }
}

export const storage = new DatabaseStorage();
