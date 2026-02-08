import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["super_admin", "admin", "operator", "viewer"]);
export const serverModeEnum = pgEnum("server_mode", ["shared", "dedicated"]);
export const serverStatusEnum = pgEnum("server_status", ["online", "offline", "maintenance", "error"]);
export const extensionStatusEnum = pgEnum("extension_status", ["active", "inactive", "busy", "unavailable"]);
export const trunkStatusEnum = pgEnum("trunk_status", ["registered", "unregistered", "failed", "disabled"]);
export const ivrStatusEnum = pgEnum("ivr_status", ["active", "inactive", "draft"]);
export const companyTypeEnum = pgEnum("company_type", ["master", "tenant", "dedicated"]);
export const queueStrategyEnum = pgEnum("queue_strategy", ["ringall", "leastrecent", "fewestcalls", "random", "rrmemory", "linear", "wrandom"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  role: userRoleEnum("role").notNull().default("viewer"),
  companyId: varchar("company_id"),
  active: boolean("active").notNull().default(true),
});

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  domain: text("domain"),
  type: companyTypeEnum("type").notNull().default("tenant"),
  maxExtensions: integer("max_extensions").notNull().default(50),
  maxTrunks: integer("max_trunks").notNull().default(5),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  active: boolean("active").notNull().default(true),
  serverId: varchar("server_id"),
});

export const servers = pgTable("servers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  hostname: text("hostname").notNull(),
  ipAddress: text("ip_address").notNull(),
  port: integer("port").notNull().default(5060),
  mode: serverModeEnum("mode").notNull().default("shared"),
  status: serverStatusEnum("status").notNull().default("offline"),
  asteriskVersion: text("asterisk_version"),
  maxChannels: integer("max_channels").notNull().default(100),
  companyId: varchar("company_id"),
  amiPort: integer("ami_port").notNull().default(5038),
  amiUsername: text("ami_username"),
  amiPassword: text("ami_password"),
  amiEnabled: boolean("ami_enabled").notNull().default(false),
});

export const extensions = pgTable("extensions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull(),
  name: text("name").notNull(),
  secret: text("secret").notNull(),
  context: text("context").notNull().default("internal"),
  protocol: text("protocol").notNull().default("SIP"),
  status: extensionStatusEnum("status").notNull().default("inactive"),
  callerId: text("caller_id"),
  mailbox: text("mailbox"),
  voicemailEnabled: boolean("voicemail_enabled").notNull().default(false),
  callRecording: boolean("call_recording").notNull().default(false),
  callForwardNumber: text("call_forward_number"),
  companyId: varchar("company_id").notNull(),
  serverId: varchar("server_id").notNull(),
});

export const sipTrunks = pgTable("sip_trunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(5060),
  username: text("username"),
  password: text("trunk_password"),
  codec: text("codec").notNull().default("G.711"),
  dtmfMode: text("dtmf_mode").notNull().default("rfc2833"),
  status: trunkStatusEnum("status").notNull().default("unregistered"),
  maxChannels: integer("max_channels").notNull().default(30),
  context: text("context").notNull().default("from-trunk"),
  companyId: varchar("company_id").notNull(),
  serverId: varchar("server_id").notNull(),
});

export const ivrMenus = pgTable("ivr_menus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  welcomeMessage: text("welcome_message"),
  status: ivrStatusEnum("status").notNull().default("draft"),
  timeout: integer("timeout").notNull().default(10),
  options: jsonb("options").$type<IvrOption[]>().notNull().default([]),
  companyId: varchar("company_id").notNull(),
  serverId: varchar("server_id").notNull(),
});

export const queues = pgTable("queues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  strategy: queueStrategyEnum("strategy").notNull().default("ringall"),
  timeout: integer("timeout").notNull().default(30),
  wrapupTime: integer("wrapup_time").notNull().default(5),
  maxWaitTime: integer("max_wait_time").notNull().default(300),
  maxCallers: integer("max_callers").notNull().default(10),
  musicOnHold: text("music_on_hold").notNull().default("default"),
  announce: text("announce"),
  announceFrequency: integer("announce_frequency").notNull().default(30),
  joinEmpty: boolean("join_empty").notNull().default(false),
  leaveWhenEmpty: boolean("leave_when_empty").notNull().default(true),
  members: jsonb("members").$type<QueueMember[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
  companyId: varchar("company_id").notNull(),
  serverId: varchar("server_id").notNull(),
});

export const callLogs = pgTable("call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callDate: timestamp("call_date").notNull().defaultNow(),
  source: text("source").notNull(),
  destination: text("destination").notNull(),
  duration: integer("duration").notNull().default(0),
  status: text("call_status").notNull(),
  type: text("type").notNull(),
  companyId: varchar("company_id").notNull(),
  serverId: varchar("server_id").notNull(),
});

export interface IvrOption {
  digit: string;
  action: string;
  destination: string;
  label: string;
}

export interface QueueMember {
  interface: string;
  memberName: string;
  penalty: number;
  paused: boolean;
}

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true });
export const insertServerSchema = createInsertSchema(servers).omit({ id: true });
export const insertExtensionSchema = createInsertSchema(extensions).omit({ id: true });
export const insertSipTrunkSchema = createInsertSchema(sipTrunks).omit({ id: true });
export const insertIvrMenuSchema = createInsertSchema(ivrMenus).omit({ id: true });
export const insertQueueSchema = createInsertSchema(queues).omit({ id: true });
export const insertCallLogSchema = createInsertSchema(callLogs).omit({ id: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertServer = z.infer<typeof insertServerSchema>;
export type Server = typeof servers.$inferSelect;
export type InsertExtension = z.infer<typeof insertExtensionSchema>;
export type Extension = typeof extensions.$inferSelect;
export type InsertSipTrunk = z.infer<typeof insertSipTrunkSchema>;
export type SipTrunk = typeof sipTrunks.$inferSelect;
export type InsertIvrMenu = z.infer<typeof insertIvrMenuSchema>;
export type IvrMenu = typeof ivrMenus.$inferSelect;
export type InsertQueue = z.infer<typeof insertQueueSchema>;
export type Queue = typeof queues.$inferSelect;
export type InsertCallLog = z.infer<typeof insertCallLogSchema>;
export type CallLog = typeof callLogs.$inferSelect;
