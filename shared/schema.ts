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
export const didDestinationTypeEnum = pgEnum("did_destination_type", ["extension", "queue", "ivr", "external"]);
export const calleridRuleActionEnum = pgEnum("callerid_rule_action", ["set", "prefix", "suffix", "remove_prefix", "block"]);

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

export const sshAuthMethodEnum = pgEnum("ssh_auth_method", ["password", "privatekey"]);

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
  sshEnabled: boolean("ssh_enabled").notNull().default(false),
  sshHost: text("ssh_host"),
  sshPort: integer("ssh_port").notNull().default(22),
  sshUsername: text("ssh_username"),
  sshAuthMethod: sshAuthMethodEnum("ssh_auth_method").notNull().default("password"),
  sshPassword: text("ssh_password"),
  sshPrivateKey: text("ssh_private_key"),
  amiAuthDigest: text("ami_auth_digest").default("md5"),
});

export const amiAuthDigestOptions = ["md5", "sha256", "sha512-256"] as const;

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
  nat: text("nat").default("force_rport,comedia"),
  qualify: text("qualify").default("yes"),
  dtmfMode: text("dtmf_mode").default("rfc2833"),
  codecs: text("codecs").default("alaw,ulaw"),
  directMedia: boolean("direct_media").notNull().default(false),
  callLimit: integer("call_limit").notNull().default(2),
  callGroup: text("call_group"),
  pickupGroup: text("pickup_group"),
  forwardType: text("forward_type"),
  forwardDestination: text("forward_destination"),
  ringTimeout: integer("ring_timeout").notNull().default(30),
  recordingFormat: text("recording_format").default("wav"),
  permitIp: text("permit_ip"),
  denyIp: text("deny_ip"),
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
  clid: text("clid"),
  source: text("source").notNull(),
  destination: text("destination").notNull(),
  dcontext: text("dcontext"),
  channel: text("channel"),
  dstChannel: text("dst_channel"),
  lastApp: text("last_app"),
  lastData: text("last_data"),
  startTime: timestamp("start_time"),
  answerTime: timestamp("answer_time"),
  endTime: timestamp("end_time"),
  duration: integer("duration").notNull().default(0),
  billsec: integer("billsec").notNull().default(0),
  disposition: text("disposition").notNull().default("NO ANSWER"),
  amaFlags: text("ama_flags"),
  accountCode: text("account_code"),
  uniqueId: text("unique_id"),
  linkedId: text("linked_id"),
  userField: text("user_field"),
  companyId: varchar("company_id").notNull(),
  serverId: varchar("server_id").notNull(),
});

export const dids = pgTable("dids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull(),
  description: text("description"),
  destinationType: didDestinationTypeEnum("destination_type").notNull().default("extension"),
  destinationValue: text("destination_value").notNull(),
  businessHoursStart: text("business_hours_start").default("08:00"),
  businessHoursEnd: text("business_hours_end").default("18:00"),
  businessDays: text("business_days").default("1,2,3,4,5"),
  afterHoursDestType: didDestinationTypeEnum("after_hours_dest_type"),
  afterHoursDestValue: text("after_hours_dest_value"),
  active: boolean("active").notNull().default(true),
  companyId: varchar("company_id").notNull(),
  serverId: varchar("server_id").notNull(),
});

export const callerIdRules = pgTable("caller_id_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  matchPattern: text("match_pattern").notNull(),
  action: calleridRuleActionEnum("action").notNull().default("set"),
  value: text("value"),
  priority: integer("priority").notNull().default(0),
  active: boolean("active").notNull().default(true),
  companyId: varchar("company_id").notNull(),
  serverId: varchar("server_id"),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  company: text("company"),
  department: text("department"),
  notes: text("notes"),
  favorite: boolean("favorite").notNull().default(false),
  companyId: varchar("company_id").notNull(),
});

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: varchar("resource_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  companyId: varchar("company_id"),
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
export const insertDidSchema = createInsertSchema(dids).omit({ id: true });
export const insertCallerIdRuleSchema = createInsertSchema(callerIdRules).omit({ id: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true });
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });

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
export type InsertDid = z.infer<typeof insertDidSchema>;
export type Did = typeof dids.$inferSelect;
export type InsertCallerIdRule = z.infer<typeof insertCallerIdRuleSchema>;
export type CallerIdRule = typeof callerIdRules.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
