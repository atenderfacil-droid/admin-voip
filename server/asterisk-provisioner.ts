import { connectSSH, execSSHCommand, type SSHConnectionConfig } from "./ssh-config";
import { AsteriskAMI, type SSHConfig } from "./asterisk";
import type {
  Server as ServerType,
  Extension,
  SipTrunk,
  Queue,
  IvrMenu,
  ConferenceRoom,
  Did,
  CallerIdRule,
  SpeedDial,
} from "@shared/schema";
import { log } from "./index";

function getSSHConfig(server: ServerType): SSHConnectionConfig | null {
  if (!server.sshEnabled || !server.sshUsername) return null;
  return {
    host: server.sshHost || server.ipAddress,
    port: server.sshPort || 22,
    username: server.sshUsername,
    authMethod: (server.sshAuthMethod as "password" | "privatekey") || "password",
    password: server.sshPassword || undefined,
    privateKey: server.sshPrivateKey || undefined,
  };
}

function getAMIClient(server: ServerType): AsteriskAMI | null {
  if (!server.amiEnabled || !server.amiUsername || !server.amiPassword) return null;
  const sshCfg: SSHConfig | undefined = server.sshEnabled
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
  return new AsteriskAMI(
    server.ipAddress,
    server.amiPort || 5038,
    server.amiUsername,
    server.amiPassword,
    sshCfg
  );
}

async function writeAsteriskFile(server: ServerType, filePath: string, content: string): Promise<void> {
  const sshConfig = getSSHConfig(server);
  if (!sshConfig) throw new Error("SSH não configurado neste servidor");

  const client = await connectSSH(sshConfig);
  try {
    const escapedContent = content.replace(/'/g, "'\\''");
    let result = await execSSHCommand(client, `echo '${escapedContent}' > ${filePath}`);
    if (result.code !== 0) {
      result = await execSSHCommand(client, `echo '${escapedContent}' | sudo tee ${filePath} > /dev/null`);
      if (result.code !== 0) {
        throw new Error(`Falha ao escrever ${filePath}: ${result.stderr}`);
      }
    }
    await execSSHCommand(client, `chown asterisk:asterisk ${filePath} 2>/dev/null; sudo chown asterisk:asterisk ${filePath} 2>/dev/null`);
  } finally {
    client.end();
  }
}

async function removeAsteriskFile(server: ServerType, filePath: string): Promise<void> {
  const sshConfig = getSSHConfig(server);
  if (!sshConfig) throw new Error("SSH não configurado neste servidor");

  const client = await connectSSH(sshConfig);
  try {
    let result = await execSSHCommand(client, `rm -f ${filePath}`);
    if (result.code !== 0) {
      await execSSHCommand(client, `sudo rm -f ${filePath}`);
    }
  } finally {
    client.end();
  }
}

async function reloadAsteriskModule(server: ServerType, module: string): Promise<void> {
  const ami = getAMIClient(server);
  if (ami) {
    try {
      await ami.reload(module);
      return;
    } catch (err: any) {
      log(`AMI reload falhou para ${module}, tentando via SSH: ${err.message}`);
    }
  }

  const sshConfig = getSSHConfig(server);
  if (sshConfig) {
    const client = await connectSSH(sshConfig);
    try {
      let result = await execSSHCommand(client, `asterisk -rx 'module reload ${module}' 2>/dev/null`);
      if (result.code !== 0) {
        await execSSHCommand(client, `sudo asterisk -rx 'module reload ${module}' 2>/dev/null`);
      }
    } finally {
      client.end();
    }
  }
}

// ===== EXTENSIONS (SIP/PJSIP Peers) =====

function generateSIPExtensionConfig(ext: Extension): string {
  const lines = [
    `; Extension ${ext.number} - ${ext.name}`,
    `; Gerenciado pelo Admin VOIP - NÃO EDITE MANUALMENTE`,
    `[${ext.number}]`,
    `type=friend`,
    `host=dynamic`,
    `secret=${ext.secret}`,
    `context=${ext.context || "internal"}`,
    `callerid="${ext.name}" <${ext.callerId || ext.number}>`,
    `nat=${ext.nat || "force_rport,comedia"}`,
    `qualify=${ext.qualify || "yes"}`,
    `dtmfmode=${ext.dtmfMode || "rfc2833"}`,
    `disallow=all`,
    `allow=${ext.codecs || "alaw,ulaw"}`,
    `directmedia=${ext.directMedia ? "yes" : "no"}`,
    `call-limit=${ext.callLimit || 2}`,
    `ringtimeout=${ext.ringTimeout || 30}`,
  ];

  if (ext.callGroup) lines.push(`callgroup=${ext.callGroup}`);
  if (ext.pickupGroup) lines.push(`pickupgroup=${ext.pickupGroup}`);
  if (ext.mailbox) lines.push(`mailbox=${ext.mailbox}`);
  if (ext.permitIp) lines.push(`permit=${ext.permitIp}`);
  if (ext.denyIp) lines.push(`deny=${ext.denyIp}`);

  lines.push("");
  return lines.join("\n");
}

function generatePJSIPExtensionConfig(ext: Extension): string {
  const lines = [
    `; Extension ${ext.number} - ${ext.name}`,
    `; Gerenciado pelo Admin VOIP - NÃO EDITE MANUALMENTE`,
    ``,
    `[${ext.number}]`,
    `type=endpoint`,
    `context=${ext.context || "internal"}`,
    `disallow=all`,
    `allow=${ext.codecs || "alaw,ulaw"}`,
    `transport=transport-udp`,
    `auth=${ext.number}-auth`,
    `aors=${ext.number}`,
    `callerid="${ext.name}" <${ext.callerId || ext.number}>`,
    `dtmf_mode=${ext.dtmfMode || "rfc2833"}`,
    `direct_media=${ext.directMedia ? "yes" : "no"}`,
    `rtp_symmetric=yes`,
    `force_rport=yes`,
    `rewrite_contact=yes`,
    `device_state_busy_at=${ext.callLimit || 2}`,
  ];

  if (ext.callGroup) lines.push(`call_group=${ext.callGroup}`);
  if (ext.pickupGroup) lines.push(`pickup_group=${ext.pickupGroup}`);
  if (ext.mailbox) lines.push(`mailbox=${ext.mailbox}@default`);

  lines.push(``);
  lines.push(`[${ext.number}-auth]`);
  lines.push(`type=auth`);
  lines.push(`auth_type=userpass`);
  lines.push(`username=${ext.number}`);
  lines.push(`password=${ext.secret}`);

  lines.push(``);
  lines.push(`[${ext.number}]`);
  lines.push(`type=aor`);
  lines.push(`max_contacts=1`);
  lines.push(`qualify_frequency=60`);
  lines.push(`remove_existing=yes`);

  lines.push("");
  return lines.join("\n");
}

function generateExtensionDialplan(ext: Extension): string {
  const lines = [
    `; Dialplan para ramal ${ext.number}`,
    `; Gerenciado pelo Admin VOIP`,
  ];

  if (ext.callRecording) {
    lines.push(`exten => ${ext.number},1,Set(RECORDING=${ext.number}-\${STRFTIME(\${EPOCH},,%Y%m%d-%H%M%S)})`);
    lines.push(`same => n,MixMonitor(\${RECORDING}.${ext.recordingFormat || "wav"},b)`);
  } else {
    lines.push(`exten => ${ext.number},1,NoOp(Chamada para ${ext.number})`);
  }

  if (ext.callForwardNumber && ext.forwardType === "unconditional") {
    lines.push(`same => n,Dial(SIP/${ext.callForwardNumber},${ext.ringTimeout || 30})`);
  } else {
    const protocol = ext.protocol === "PJSIP" ? "PJSIP" : "SIP";
    lines.push(`same => n,Dial(${protocol}/${ext.number},${ext.ringTimeout || 30})`);
  }

  if (ext.voicemailEnabled && ext.mailbox) {
    lines.push(`same => n,VoiceMail(${ext.mailbox}@default,u)`);
  }

  lines.push(`same => n,Hangup()`);
  lines.push("");
  return lines.join("\n");
}

function generateVoicemailConfig(ext: Extension): string | null {
  if (!ext.voicemailEnabled || !ext.mailbox) return null;
  return `${ext.mailbox} => ${ext.secret},${ext.name},${ext.callerId || ""},,`;
}

export async function provisionExtension(server: ServerType, ext: Extension): Promise<void> {
  const isPJSIP = ext.protocol === "PJSIP";
  const configDir = "/etc/asterisk";
  const fileName = isPJSIP
    ? `pjsip_endpoint_${ext.number}.conf`
    : `sip_peer_${ext.number}.conf`;

  const config = isPJSIP
    ? generatePJSIPExtensionConfig(ext)
    : generateSIPExtensionConfig(ext);

  await writeAsteriskFile(server, `${configDir}/${fileName}`, config);

  const dialplanFile = `extensions_ramal_${ext.number}.conf`;
  const dialplanConfig = generateExtensionDialplan(ext);
  await writeAsteriskFile(server, `${configDir}/${dialplanFile}`, dialplanConfig);

  if (ext.voicemailEnabled && ext.mailbox) {
    const vmLine = generateVoicemailConfig(ext);
    if (vmLine) {
      await appendToIncludeFile(server, `${configDir}/voicemail_adminvoip.conf`, ext.number, vmLine);
    }
  }

  await ensureInclude(server, isPJSIP ? "pjsip.conf" : "sip.conf", fileName);
  await ensureInclude(server, "extensions.conf", dialplanFile);

  const reloadModule = isPJSIP ? "res_pjsip.so" : "chan_sip.so";
  await reloadAsteriskModule(server, reloadModule);
  await reloadAsteriskModule(server, "pbx_config");

  log(`Ramal ${ext.number} provisionado no servidor ${server.name}`);
}

export async function removeExtension(server: ServerType, ext: Extension): Promise<void> {
  const isPJSIP = ext.protocol === "PJSIP";
  const configDir = "/etc/asterisk";
  const fileName = isPJSIP
    ? `pjsip_endpoint_${ext.number}.conf`
    : `sip_peer_${ext.number}.conf`;

  await removeAsteriskFile(server, `${configDir}/${fileName}`);
  await removeAsteriskFile(server, `${configDir}/extensions_ramal_${ext.number}.conf`);

  await removeFromIncludeFile(server, `${configDir}/voicemail_adminvoip.conf`, ext.number);

  const reloadModule = isPJSIP ? "res_pjsip.so" : "chan_sip.so";
  await reloadAsteriskModule(server, reloadModule);
  await reloadAsteriskModule(server, "pbx_config");

  log(`Ramal ${ext.number} removido do servidor ${server.name}`);
}

// ===== SIP TRUNKS =====

function generateSIPTrunkConfig(trunk: SipTrunk): string {
  const codecs = trunk.codec === "G.711" ? "alaw,ulaw" : trunk.codec === "G.729" ? "g729" : "alaw,ulaw,g729";
  const lines = [
    `; Tronco SIP: ${trunk.name} - ${trunk.provider}`,
    `; Gerenciado pelo Admin VOIP - NÃO EDITE MANUALMENTE`,
    `[${trunk.name}]`,
    `type=peer`,
    `host=${trunk.host}`,
    `port=${trunk.port || 5060}`,
    `context=${trunk.context || "from-trunk"}`,
    `disallow=all`,
    `allow=${codecs}`,
    `dtmfmode=${trunk.dtmfMode || "rfc2833"}`,
    `insecure=port,invite`,
    `qualify=yes`,
    `canreinvite=no`,
  ];

  if (trunk.username) lines.push(`username=${trunk.username}`);
  if (trunk.password) lines.push(`secret=${trunk.password}`);
  if (trunk.maxChannels) lines.push(`call-limit=${trunk.maxChannels}`);

  if (trunk.username && trunk.password) {
    lines.push(``);
    lines.push(`register => ${trunk.username}:${trunk.password}@${trunk.host}/${trunk.name}`);
  }

  lines.push("");
  return lines.join("\n");
}

export async function provisionSipTrunk(server: ServerType, trunk: SipTrunk): Promise<void> {
  const configDir = "/etc/asterisk";
  const fileName = `sip_trunk_${trunk.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.conf`;

  await writeAsteriskFile(server, `${configDir}/${fileName}`, generateSIPTrunkConfig(trunk));
  await ensureInclude(server, "sip.conf", fileName);
  await reloadAsteriskModule(server, "chan_sip.so");

  log(`Tronco SIP ${trunk.name} provisionado no servidor ${server.name}`);
}

export async function removeSipTrunk(server: ServerType, trunk: SipTrunk): Promise<void> {
  const configDir = "/etc/asterisk";
  const fileName = `sip_trunk_${trunk.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.conf`;

  await removeAsteriskFile(server, `${configDir}/${fileName}`);
  await reloadAsteriskModule(server, "chan_sip.so");

  log(`Tronco SIP ${trunk.name} removido do servidor ${server.name}`);
}

// ===== QUEUES =====

function generateQueueConfig(queue: Queue): string {
  const lines = [
    `; Fila: ${queue.displayName}`,
    `; Gerenciado pelo Admin VOIP - NÃO EDITE MANUALMENTE`,
    `[${queue.name}]`,
    `strategy=${queue.strategy || "ringall"}`,
    `timeout=${queue.timeout || 30}`,
    `wrapuptime=${queue.wrapupTime || 5}`,
    `maxlen=${queue.maxCallers || 10}`,
    `musicclass=${queue.musicOnHold || "default"}`,
    `announce-frequency=${queue.announceFrequency || 30}`,
    `joinempty=${queue.joinEmpty ? "yes" : "no"}`,
    `leavewhenempty=${queue.leaveWhenEmpty ? "yes" : "no"}`,
  ];

  if (queue.announce) lines.push(`announce=${queue.announce}`);

  const members = queue.members || [];
  for (const member of members) {
    const iface = member.interface;
    lines.push(`member => ${iface},${member.penalty || 0},${member.memberName || ""}`);
  }

  lines.push("");
  return lines.join("\n");
}

function generateQueueDialplan(queue: Queue): string {
  const lines = [
    `; Dialplan da fila ${queue.name}`,
    `; Gerenciado pelo Admin VOIP`,
    `exten => ${queue.name},1,NoOp(Entrando na fila ${queue.displayName})`,
    `same => n,Answer()`,
    `same => n,Queue(${queue.name},t,,,${queue.maxWaitTime || 300})`,
    `same => n,Hangup()`,
    "",
  ];
  return lines.join("\n");
}

export async function provisionQueue(server: ServerType, queue: Queue): Promise<void> {
  const configDir = "/etc/asterisk";
  const queueFile = `queue_${queue.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.conf`;
  const dialplanFile = `extensions_queue_${queue.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.conf`;

  await writeAsteriskFile(server, `${configDir}/${queueFile}`, generateQueueConfig(queue));
  await writeAsteriskFile(server, `${configDir}/${dialplanFile}`, generateQueueDialplan(queue));

  await ensureInclude(server, "queues.conf", queueFile);
  await ensureInclude(server, "extensions.conf", dialplanFile);

  await reloadAsteriskModule(server, "app_queue.so");
  await reloadAsteriskModule(server, "pbx_config");

  log(`Fila ${queue.name} provisionada no servidor ${server.name}`);
}

export async function removeQueue(server: ServerType, queue: Queue): Promise<void> {
  const configDir = "/etc/asterisk";
  const queueFile = `queue_${queue.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.conf`;
  const dialplanFile = `extensions_queue_${queue.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.conf`;

  await removeAsteriskFile(server, `${configDir}/${queueFile}`);
  await removeAsteriskFile(server, `${configDir}/${dialplanFile}`);

  await reloadAsteriskModule(server, "app_queue.so");
  await reloadAsteriskModule(server, "pbx_config");

  log(`Fila ${queue.name} removida do servidor ${server.name}`);
}

// ===== IVR MENUS =====

function generateIVRDialplan(ivr: IvrMenu): string {
  const ctxName = `ivr-${ivr.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const lines = [
    `; IVR/URA: ${ivr.name}`,
    `; Gerenciado pelo Admin VOIP - NÃO EDITE MANUALMENTE`,
    `[${ctxName}]`,
  ];

  if (ivr.welcomeMessage) {
    lines.push(`exten => s,1,Answer()`);
    lines.push(`same => n,Playback(${ivr.welcomeMessage})`);
  } else {
    lines.push(`exten => s,1,Answer()`);
  }

  lines.push(`same => n,WaitExten(${ivr.timeout || 10})`);

  const options = ivr.options || [];
  for (const opt of options) {
    const destination = opt.destination || "";
    const action = opt.action || "extension";

    if (action === "extension") {
      lines.push(`exten => ${opt.digit},1,Goto(internal,${destination},1)`);
    } else if (action === "queue") {
      lines.push(`exten => ${opt.digit},1,Queue(${destination})`);
    } else if (action === "ivr") {
      lines.push(`exten => ${opt.digit},1,Goto(ivr-${destination},s,1)`);
    } else if (action === "voicemail") {
      lines.push(`exten => ${opt.digit},1,VoiceMail(${destination}@default)`);
    } else if (action === "hangup") {
      lines.push(`exten => ${opt.digit},1,Hangup()`);
    } else if (action === "playback") {
      lines.push(`exten => ${opt.digit},1,Playback(${destination})`);
      lines.push(`same => n,Goto(s,1)`);
    }
  }

  lines.push(`exten => t,1,Goto(s,1)`);
  lines.push(`exten => i,1,Playback(invalid)`);
  lines.push(`same => n,Goto(s,1)`);
  lines.push("");
  return lines.join("\n");
}

export async function provisionIvrMenu(server: ServerType, ivr: IvrMenu): Promise<void> {
  const configDir = "/etc/asterisk";
  const fileName = `extensions_ivr_${ivr.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.conf`;

  await writeAsteriskFile(server, `${configDir}/${fileName}`, generateIVRDialplan(ivr));
  await ensureInclude(server, "extensions.conf", fileName);
  await reloadAsteriskModule(server, "pbx_config");

  log(`IVR ${ivr.name} provisionado no servidor ${server.name}`);
}

export async function removeIvrMenu(server: ServerType, ivr: IvrMenu): Promise<void> {
  const configDir = "/etc/asterisk";
  const fileName = `extensions_ivr_${ivr.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.conf`;

  await removeAsteriskFile(server, `${configDir}/${fileName}`);
  await reloadAsteriskModule(server, "pbx_config");

  log(`IVR ${ivr.name} removido do servidor ${server.name}`);
}

// ===== CONFERENCE ROOMS (ConfBridge) =====

function generateConfBridgeConfig(room: ConferenceRoom): string {
  const profileName = `confbridge_${room.roomNumber}`;
  const lines = [
    `; Sala de conferência: ${room.name} (${room.roomNumber})`,
    `; Gerenciado pelo Admin VOIP - NÃO EDITE MANUALMENTE`,
    ``,
    `[${profileName}_bridge]`,
    `type=bridge`,
    `max_members=${room.maxParticipants || 50}`,
    room.recordConference ? `record_conference=yes` : `record_conference=no`,
    `sound_join=confbridge-join`,
    `sound_leave=confbridge-leave`,
    ``,
    `[${profileName}_user]`,
    `type=user`,
    room.announceJoinLeave ? `announce_join_leave=yes` : `announce_join_leave=no`,
    room.waitForLeader ? `wait_marked=yes` : `wait_marked=no`,
    room.quietMode ? `quiet=yes` : `quiet=no`,
    room.musicOnHold ? `music_on_hold_when_empty=yes\nmusic_on_hold_class=${room.musicOnHold}` : `music_on_hold_when_empty=no`,
  ];

  if (room.pin) lines.push(`pin=${room.pin}`);

  lines.push(``);
  lines.push(`[${profileName}_admin]`);
  lines.push(`type=user`);
  lines.push(`admin=yes`);
  lines.push(`marked=yes`);
  if (room.adminPin) lines.push(`pin=${room.adminPin}`);

  lines.push("");
  return lines.join("\n");
}

function generateConfBridgeDialplan(room: ConferenceRoom): string {
  const profileName = `confbridge_${room.roomNumber}`;
  const lines = [
    `; Dialplan conferência ${room.roomNumber}`,
    `; Gerenciado pelo Admin VOIP`,
    `exten => ${room.roomNumber},1,Answer()`,
    `same => n,ConfBridge(${room.roomNumber},${profileName}_bridge,${profileName}_user)`,
    `same => n,Hangup()`,
    "",
  ];
  return lines.join("\n");
}

export async function provisionConferenceRoom(server: ServerType, room: ConferenceRoom): Promise<void> {
  const configDir = "/etc/asterisk";
  const confFile = `confbridge_room_${room.roomNumber}.conf`;
  const dialplanFile = `extensions_confbridge_${room.roomNumber}.conf`;

  await writeAsteriskFile(server, `${configDir}/${confFile}`, generateConfBridgeConfig(room));
  await writeAsteriskFile(server, `${configDir}/${dialplanFile}`, generateConfBridgeDialplan(room));

  await ensureInclude(server, "confbridge.conf", confFile);
  await ensureInclude(server, "extensions.conf", dialplanFile);

  await reloadAsteriskModule(server, "app_confbridge.so");
  await reloadAsteriskModule(server, "pbx_config");

  log(`Conferência ${room.roomNumber} provisionada no servidor ${server.name}`);
}

export async function removeConferenceRoom(server: ServerType, room: ConferenceRoom): Promise<void> {
  const configDir = "/etc/asterisk";
  const confFile = `confbridge_room_${room.roomNumber}.conf`;
  const dialplanFile = `extensions_confbridge_${room.roomNumber}.conf`;

  await removeAsteriskFile(server, `${configDir}/${confFile}`);
  await removeAsteriskFile(server, `${configDir}/${dialplanFile}`);

  await reloadAsteriskModule(server, "app_confbridge.so");
  await reloadAsteriskModule(server, "pbx_config");

  log(`Conferência ${room.roomNumber} removida do servidor ${server.name}`);
}

// ===== DIDs (Inbound Routes) =====

function generateDIDDialplan(did: Did): string {
  const lines = [
    `; DID/DDR: ${did.number}`,
    `; Gerenciado pelo Admin VOIP - NÃO EDITE MANUALMENTE`,
  ];

  lines.push(`exten => ${did.number},1,Answer()`);

  if (did.businessHoursStart && did.businessHoursEnd && did.businessDays) {
    const days = did.businessDays.split(",").map((d) => {
      const dayNames = ["", "mon", "tue", "wed", "thu", "fri", "sat", "sun"];
      return dayNames[parseInt(d)] || d;
    }).join("&");

    lines.push(`same => n,GotoIfTime(${did.businessHoursStart}-${did.businessHoursEnd},${days},*,*?business,afterhours)`);
    lines.push(`same => n(business),NoOp(Horário Comercial)`);
    lines.push(`same => n,${getDialplanDestination(did.destinationType, did.destinationValue)}`);
    lines.push(`same => n,Hangup()`);

    if (did.afterHoursDestType && did.afterHoursDestValue) {
      lines.push(`same => n(afterhours),NoOp(Fora do Horário)`);
      lines.push(`same => n,${getDialplanDestination(did.afterHoursDestType, did.afterHoursDestValue)}`);
    } else {
      lines.push(`same => n(afterhours),Playback(unavailable)`);
    }
  } else {
    lines.push(`same => n,${getDialplanDestination(did.destinationType, did.destinationValue)}`);
  }

  lines.push(`same => n,Hangup()`);
  lines.push("");
  return lines.join("\n");
}

function getDialplanDestination(destType: string, destValue: string): string {
  switch (destType) {
    case "extension": return `Dial(SIP/${destValue},30)`;
    case "queue": return `Queue(${destValue})`;
    case "ivr": return `Goto(ivr-${destValue},s,1)`;
    case "voicemail": return `VoiceMail(${destValue}@default)`;
    case "external": return `Dial(SIP/trunk/${destValue},60)`;
    case "conference": return `ConfBridge(${destValue})`;
    default: return `Dial(SIP/${destValue},30)`;
  }
}

export async function provisionDid(server: ServerType, did: Did): Promise<void> {
  const configDir = "/etc/asterisk";
  const fileName = `extensions_did_${did.number.replace(/[^a-zA-Z0-9_-]/g, "_")}.conf`;

  await writeAsteriskFile(server, `${configDir}/${fileName}`, generateDIDDialplan(did));
  await ensureInclude(server, "extensions.conf", fileName);
  await reloadAsteriskModule(server, "pbx_config");

  log(`DID ${did.number} provisionado no servidor ${server.name}`);
}

export async function removeDid(server: ServerType, did: Did): Promise<void> {
  const configDir = "/etc/asterisk";
  const fileName = `extensions_did_${did.number.replace(/[^a-zA-Z0-9_-]/g, "_")}.conf`;

  await removeAsteriskFile(server, `${configDir}/${fileName}`);
  await reloadAsteriskModule(server, "pbx_config");

  log(`DID ${did.number} removido do servidor ${server.name}`);
}

// ===== CALLER ID RULES =====

export async function provisionCallerIdRules(server: ServerType, rules: CallerIdRule[]): Promise<void> {
  const activeRules = rules.filter((r) => r.active).sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const lines = [
    `; Regras CallerID`,
    `; Gerenciado pelo Admin VOIP - NÃO EDITE MANUALMENTE`,
    `[callerid-rules]`,
  ];

  for (const rule of activeRules) {
    lines.push(`; Regra: ${rule.name} (${rule.action})`);
    if (rule.action === "set" && rule.value) {
      lines.push(`exten => _${rule.matchPattern},1,Set(CALLERID(num)=${rule.value})`);
    } else if (rule.action === "prefix" && rule.value) {
      lines.push(`exten => _${rule.matchPattern},1,Set(CALLERID(num)=${rule.value}\${CALLERID(num)})`);
    } else if (rule.action === "suffix" && rule.value) {
      lines.push(`exten => _${rule.matchPattern},1,Set(CALLERID(num)=\${CALLERID(num)}${rule.value})`);
    } else if (rule.action === "remove_prefix" && rule.value) {
      const prefixLen = rule.value.length;
      lines.push(`exten => _${rule.matchPattern},1,Set(CALLERID(num)=\${CALLERID(num):${prefixLen}})`);
    } else if (rule.action === "block") {
      lines.push(`exten => _${rule.matchPattern},1,Hangup(21)`);
    }
    lines.push(`same => n,Return()`);
  }

  lines.push("");

  const configDir = "/etc/asterisk";
  const fileName = "extensions_callerid_rules.conf";
  await writeAsteriskFile(server, `${configDir}/${fileName}`, lines.join("\n"));
  await ensureInclude(server, "extensions.conf", fileName);
  await reloadAsteriskModule(server, "pbx_config");

  log(`Regras CallerID provisionadas no servidor ${server.name}`);
}

// ===== SPEED DIALS / BLF =====

export async function provisionSpeedDials(server: ServerType, dials: SpeedDial[]): Promise<void> {
  const lines = [
    `; Speed Dials / BLF`,
    `; Gerenciado pelo Admin VOIP - NÃO EDITE MANUALMENTE`,
    `[speed-dials]`,
  ];

  const sorted = [...dials].sort((a, b) => (a.position || 0) - (b.position || 0));
  for (const dial of sorted) {
    lines.push(`; ${dial.label}`);
    lines.push(`exten => *${dial.position || 0}${dial.number},1,Dial(SIP/${dial.number},30)`);
    lines.push(`same => n,Hangup()`);
    if (dial.blf && dial.extension) {
      lines.push(`; BLF hint para ${dial.label}`);
      lines.push(`exten => ${dial.extension},hint,SIP/${dial.extension}`);
    }
  }

  lines.push("");

  const configDir = "/etc/asterisk";
  const fileName = "extensions_speeddials.conf";
  await writeAsteriskFile(server, `${configDir}/${fileName}`, lines.join("\n"));
  await ensureInclude(server, "extensions.conf", fileName);
  await reloadAsteriskModule(server, "pbx_config");

  log(`Speed Dials provisionados no servidor ${server.name}`);
}

// ===== HELPER: Ensure #include in main config =====

async function ensureInclude(server: ServerType, mainFile: string, includeFile: string): Promise<void> {
  const sshConfig = getSSHConfig(server);
  if (!sshConfig) return;

  const client = await connectSSH(sshConfig);
  try {
    const includeLine = `#include "${includeFile}"`;
    const checkResult = await execSSHCommand(
      client,
      `grep -qF '${includeLine}' /etc/asterisk/${mainFile} 2>/dev/null && echo 'FOUND' || echo 'NOT_FOUND'`
    );

    if (checkResult.stdout.trim() === "NOT_FOUND") {
      let result = await execSSHCommand(
        client,
        `echo '${includeLine}' >> /etc/asterisk/${mainFile}`
      );
      if (result.code !== 0) {
        await execSSHCommand(
          client,
          `echo '${includeLine}' | sudo tee -a /etc/asterisk/${mainFile} > /dev/null`
        );
      }
    }
  } finally {
    client.end();
  }
}

// ===== HELPER: Append/Remove lines from include-style files =====

async function appendToIncludeFile(server: ServerType, filePath: string, identifier: string, content: string): Promise<void> {
  const sshConfig = getSSHConfig(server);
  if (!sshConfig) return;

  const client = await connectSSH(sshConfig);
  try {
    await removeFromIncludeFileSSH(client, filePath, identifier);
    const escapedContent = content.replace(/'/g, "'\\''");
    const line = `; ADMINVOIP:${identifier}\n${escapedContent}\n; END:${identifier}`;
    let result = await execSSHCommand(client, `echo '${line}' >> ${filePath}`);
    if (result.code !== 0) {
      await execSSHCommand(client, `echo '${line}' | sudo tee -a ${filePath} > /dev/null`);
    }
  } finally {
    client.end();
  }
}

async function removeFromIncludeFile(server: ServerType, filePath: string, identifier: string): Promise<void> {
  const sshConfig = getSSHConfig(server);
  if (!sshConfig) return;

  const client = await connectSSH(sshConfig);
  try {
    await removeFromIncludeFileSSH(client, filePath, identifier);
  } finally {
    client.end();
  }
}

async function removeFromIncludeFileSSH(client: any, filePath: string, identifier: string): Promise<void> {
  let result = await execSSHCommand(
    client,
    `sed -i '/; ADMINVOIP:${identifier}/,/; END:${identifier}/d' ${filePath} 2>/dev/null`
  );
  if (result.code !== 0) {
    await execSSHCommand(
      client,
      `sudo sed -i '/; ADMINVOIP:${identifier}/,/; END:${identifier}/d' ${filePath} 2>/dev/null`
    );
  }
}

// ===== COMPARE / IMPORT: Comparar informações do servidor =====

export interface ComparisonResult {
  extensions: {
    onlyInServer: string[];
    onlyInSystem: string[];
    inBoth: string[];
  };
  trunks: {
    onlyInServer: string[];
    onlyInSystem: string[];
    inBoth: string[];
  };
  queues: {
    onlyInServer: string[];
    onlyInSystem: string[];
    inBoth: string[];
  };
  conferences: {
    onlyInServer: string[];
    onlyInSystem: string[];
    inBoth: string[];
  };
}

export async function compareServerData(
  server: ServerType,
  systemExtensions: Extension[],
  systemTrunks: SipTrunk[],
  systemQueues: Queue[],
  systemConferences: ConferenceRoom[]
): Promise<ComparisonResult> {
  const ami = getAMIClient(server);
  if (!ami) throw new Error("AMI não configurado neste servidor");

  const [sipPeers, pjsipEndpoints, queueStatus] = await Promise.all([
    ami.getSIPPeers().catch(() => []),
    ami.getPJSIPEndpoints().catch(() => []),
    ami.getQueueStatus().catch(() => []),
  ]);

  let confRooms: string[] = [];
  try {
    const confResult = await ami.executeCommand("confbridge list");
    const confLines = confResult.split("\n").filter((l) => l.trim() && !l.includes("Conference") && !l.includes("="));
    confRooms = confLines.map((l) => l.trim().split(/\s+/)[0]).filter((n) => n && n.length > 0);
  } catch {}

  const serverExtNames = [
    ...sipPeers.map((p) => p.objectname),
    ...pjsipEndpoints.map((e) => e.objectname),
  ].filter((n) => n && n.length > 0);

  const systemExtNames = systemExtensions.filter((e) => e.serverId === server.id).map((e) => e.number);

  const serverQueueNames = queueStatus.map((q) => q.queue).filter((n) => n.length > 0);
  const systemQueueNames = systemQueues.filter((q) => q.serverId === server.id).map((q) => q.name);

  const serverTrunkNames: string[] = [];
  try {
    const regResult = await ami.getRegistrations();
    serverTrunkNames.push(...regResult.map((r) => r.username).filter((n) => n.length > 0));
  } catch {}
  const systemTrunkNames = systemTrunks.filter((t) => t.serverId === server.id).map((t) => t.name);

  const systemConfNames = systemConferences.filter((c) => c.serverId === server.id).map((c) => c.roomNumber);

  return {
    extensions: compareArrays(serverExtNames, systemExtNames),
    trunks: compareArrays(serverTrunkNames, systemTrunkNames),
    queues: compareArrays(serverQueueNames, systemQueueNames),
    conferences: compareArrays(confRooms, systemConfNames),
  };
}

function compareArrays(serverItems: string[], systemItems: string[]): { onlyInServer: string[]; onlyInSystem: string[]; inBoth: string[] } {
  const serverSet = new Set(serverItems);
  const systemSet = new Set(systemItems);

  return {
    onlyInServer: serverItems.filter((s) => !systemSet.has(s)),
    onlyInSystem: systemItems.filter((s) => !serverSet.has(s)),
    inBoth: serverItems.filter((s) => systemSet.has(s)),
  };
}

export async function importExtensionsFromServer(
  server: ServerType,
  extensionNames: string[],
  companyId: string
): Promise<Array<{ number: string; name: string; protocol: string }>> {
  const ami = getAMIClient(server);
  if (!ami) throw new Error("AMI não configurado");

  const imported: Array<{ number: string; name: string; protocol: string }> = [];

  const sipPeers = await ami.getSIPPeers().catch(() => []);
  const pjsipEndpoints = await ami.getPJSIPEndpoints().catch(() => []);

  for (const extName of extensionNames) {
    const sipPeer = sipPeers.find((p) => p.objectname === extName);
    if (sipPeer) {
      imported.push({
        number: sipPeer.objectname,
        name: sipPeer.description || sipPeer.objectname,
        protocol: "SIP",
      });
      continue;
    }

    const pjsipEp = pjsipEndpoints.find((e) => e.objectname === extName);
    if (pjsipEp) {
      imported.push({
        number: pjsipEp.objectname,
        name: pjsipEp.objectname,
        protocol: "PJSIP",
      });
    }
  }

  return imported;
}
