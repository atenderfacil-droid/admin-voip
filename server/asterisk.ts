import * as net from "net";

interface AMIResponse {
  response: string;
  actionid?: string;
  message?: string;
  [key: string]: any;
}

interface AMIEvent {
  event: string;
  [key: string]: any;
}

export class AsteriskAMI {
  private host: string;
  private port: number;
  private username: string;
  private password: string;

  constructor(host: string, port: number, username: string, password: string) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
  }

  private sendAction(
    socket: net.Socket,
    action: Record<string, string>
  ): void {
    let msg = "";
    for (const [key, value] of Object.entries(action)) {
      msg += `${key}: ${value}\r\n`;
    }
    msg += "\r\n";
    socket.write(msg);
  }

  private parseResponse(data: string): AMIResponse[] {
    const blocks = data.split("\r\n\r\n").filter((b) => b.trim().length > 0);
    const responses: AMIResponse[] = [];
    for (const block of blocks) {
      const obj: any = {};
      const lines = block.split("\r\n");
      for (const line of lines) {
        const idx = line.indexOf(": ");
        if (idx > 0) {
          const key = line.substring(0, idx).toLowerCase().replace(/-/g, "");
          const value = line.substring(idx + 2);
          obj[key] = value;
        }
      }
      if (Object.keys(obj).length > 0) {
        responses.push(obj);
      }
    }
    return responses;
  }

  private connect(): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(8000);

      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("Timeout ao conectar ao servidor Asterisk"));
      });

      socket.on("error", (err) => {
        reject(new Error(`Erro de conexão AMI: ${err.message}`));
      });

      let welcomed = false;
      socket.on("data", (data) => {
        if (!welcomed) {
          const greeting = data.toString();
          if (greeting.includes("Asterisk Call Manager")) {
            welcomed = true;
            resolve(socket);
          }
        }
      });

      socket.connect(this.port, this.host);
    });
  }

  private async executeAction(
    action: Record<string, string>,
    collectEvents = false,
    eventEndMarker?: string
  ): Promise<{ response: AMIResponse; events: AMIResponse[] }> {
    const socket = await this.connect();
    const actionId = `admin-voip-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    action["ActionID"] = actionId;

    return new Promise((resolve, reject) => {
      let buffer = "";
      let loginDone = false;
      let actionSent = false;
      let mainResponse: AMIResponse | null = null;
      const events: AMIResponse[] = [];
      let timeout: NodeJS.Timeout;

      const cleanup = () => {
        clearTimeout(timeout);
        try {
          this.sendAction(socket, { Action: "Logoff" });
        } catch {}
        setTimeout(() => {
          try { socket.destroy(); } catch {}
        }, 200);
      };

      timeout = setTimeout(() => {
        cleanup();
        if (mainResponse) {
          resolve({ response: mainResponse, events });
        } else {
          reject(new Error("Timeout aguardando resposta AMI"));
        }
      }, 10000);

      socket.on("data", (data) => {
        buffer += data.toString();

        while (buffer.includes("\r\n\r\n")) {
          const endIdx = buffer.indexOf("\r\n\r\n");
          const block = buffer.substring(0, endIdx);
          buffer = buffer.substring(endIdx + 4);

          const parsed = this.parseBlock(block);
          if (!parsed) continue;

          if (!loginDone) {
            if (parsed.response === "Success") {
              loginDone = true;
              this.sendAction(socket, action);
              actionSent = true;
            } else if (parsed.response === "Error") {
              cleanup();
              reject(new Error(`Falha no login AMI: ${parsed.message || "Credenciais inválidas"}`));
              return;
            }
            continue;
          }

          if (!actionSent) continue;

          if (parsed.actionid === actionId || !parsed.actionid) {
            if (parsed.response && !parsed.event) {
              mainResponse = parsed;
              if (!collectEvents) {
                cleanup();
                resolve({ response: mainResponse, events });
                return;
              }
            } else if (parsed.event) {
              if (eventEndMarker && parsed.event.toLowerCase().includes(eventEndMarker.toLowerCase())) {
                cleanup();
                resolve({ response: mainResponse || { response: "Success" }, events });
                return;
              }
              events.push(parsed);
            }
          }
        }
      });

      socket.on("error", (err) => {
        cleanup();
        reject(new Error(`Erro AMI: ${err.message}`));
      });

      this.sendAction(socket, {
        Action: "Login",
        Username: this.username,
        Secret: this.password,
      });
    });
  }

  private parseBlock(block: string): AMIResponse | null {
    const obj: any = {};
    const lines = block.split("\r\n");
    for (const line of lines) {
      const idx = line.indexOf(": ");
      if (idx > 0) {
        const key = line.substring(0, idx).toLowerCase().replace(/-/g, "");
        const value = line.substring(idx + 2);
        obj[key] = value;
      }
    }
    return Object.keys(obj).length > 0 ? obj : null;
  }

  async testConnection(): Promise<{ success: boolean; message: string; version?: string }> {
    try {
      const socket = await this.connect();

      return new Promise((resolve) => {
        let buffer = "";
        const timeout = setTimeout(() => {
          socket.destroy();
          resolve({ success: false, message: "Timeout no login AMI" });
        }, 5000);

        socket.on("data", (data) => {
          buffer += data.toString();
          if (buffer.includes("\r\n\r\n")) {
            const parsed = this.parseBlock(buffer.split("\r\n\r\n")[0]);
            if (parsed) {
              clearTimeout(timeout);
              if (parsed.response === "Success") {
                this.sendAction(socket, { Action: "Logoff" });
                setTimeout(() => socket.destroy(), 200);
                resolve({
                  success: true,
                  message: parsed.message || "Conectado com sucesso",
                });
              } else {
                socket.destroy();
                resolve({
                  success: false,
                  message: parsed.message || "Falha na autenticação AMI",
                });
              }
            }
          }
        });

        this.sendAction(socket, {
          Action: "Login",
          Username: this.username,
          Secret: this.password,
        });
      });
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async getCoreStatus(): Promise<{
    version?: string;
    uptime?: string;
    reloadDate?: string;
    currentCalls?: number;
    startupDate?: string;
  }> {
    const { response } = await this.executeAction({ Action: "CoreStatus" });
    return {
      version: response.coreversion,
      uptime: response.coreuptime,
      reloadDate: response.corereloaddate,
      currentCalls: parseInt(response.corecurrentcalls || "0"),
      startupDate: response.corestartupdate,
    };
  }

  async getCoreSettings(): Promise<{
    version?: string;
    amiVersion?: string;
    maxCalls?: number;
    maxLoadAvg?: number;
    runUser?: string;
    runGroup?: string;
    maxFileHandles?: number;
    realtimeEnabled?: string;
    cdrEnabled?: string;
    httpEnabled?: string;
  }> {
    const { response } = await this.executeAction({ Action: "CoreSettings" });
    return {
      version: response.asteriskversion,
      amiVersion: response.amiversion,
      maxCalls: parseInt(response.coremaxcalls || "0"),
      maxLoadAvg: parseFloat(response.coremaxloadavg || "0"),
      runUser: response.corerunuser,
      runGroup: response.corerungroup,
      maxFileHandles: parseInt(response.coremaxfilehandles || "0"),
      realtimeEnabled: response.corerealtimeenabled,
      cdrEnabled: response.corecdrEnabled,
      httpEnabled: response.corehttpenabled,
    };
  }

  async getSIPPeers(): Promise<Array<{
    objectname: string;
    ipaddress: string;
    ipport: string;
    dynamic: string;
    forcerport: string;
    videosupport: string;
    textsupport: string;
    acl: string;
    status: string;
    realtimedevice: string;
    description: string;
    channeltype: string;
  }>> {
    const { events } = await this.executeAction(
      { Action: "SIPpeers" },
      true,
      "PeerlistComplete"
    );
    return events
      .filter((e) => e.event === "PeerEntry" || e.event === "peerentry")
      .map((e) => ({
        objectname: e.objectname || e.name || "",
        ipaddress: e.ipaddress || e.ipport || "-",
        ipport: e.ipport || "5060",
        dynamic: e.dynamic || "no",
        forcerport: e.forcerport || "no",
        videosupport: e.videosupport || "no",
        textsupport: e.textsupport || "no",
        acl: e.acl || "no",
        status: e.status || "Unknown",
        realtimedevice: e.realtimedevice || "no",
        description: e.description || "",
        channeltype: e.channeltype || "SIP",
      }));
  }

  async getPJSIPEndpoints(): Promise<Array<{
    objectname: string;
    transport: string;
    aor: string;
    auth: string;
    devicestate: string;
    activechannels: string;
  }>> {
    try {
      const { events } = await this.executeAction(
        { Action: "PJSIPShowEndpoints" },
        true,
        "EndpointListComplete"
      );
      return events
        .filter((e) => e.event === "EndpointList" || e.event === "endpointlist")
        .map((e) => ({
          objectname: e.objectname || "",
          transport: e.transport || "",
          aor: e.aor || "",
          auth: e.auth || "",
          devicestate: e.devicestate || "Unavailable",
          activechannels: e.activechannels || "0",
        }));
    } catch {
      return [];
    }
  }

  async getActiveChannels(): Promise<Array<{
    channel: string;
    context: string;
    extension: string;
    priority: string;
    state: string;
    application: string;
    data: string;
    calleridnum: string;
    calleridname: string;
    accountcode: string;
    bridgedchannel: string;
    uniqueid: string;
    duration: string;
  }>> {
    const { events } = await this.executeAction(
      { Action: "CoreShowChannels" },
      true,
      "CoreShowChannelsComplete"
    );
    return events
      .filter((e) => e.event === "CoreShowChannel" || e.event === "coreshowchannel")
      .map((e) => ({
        channel: e.channel || "",
        context: e.context || "",
        extension: e.exten || e.extension || "",
        priority: e.priority || "",
        state: e.channelstatedesc || e.state || "",
        application: e.application || "",
        data: e.applicationdata || e.data || "",
        calleridnum: e.calleridnum || "",
        calleridname: e.calleridname || "",
        accountcode: e.accountcode || "",
        bridgedchannel: e.bridgedchannel || "",
        uniqueid: e.uniqueid || "",
        duration: e.duration || "0",
      }));
  }

  async getQueueStatus(queueName?: string): Promise<Array<{
    queue: string;
    max: string;
    strategy: string;
    calls: string;
    holdtime: string;
    talktime: string;
    completed: string;
    abandoned: string;
    servicelevel: string;
    servicelevelperf: string;
    weight: string;
    members: Array<{
      name: string;
      location: string;
      stateinterface: string;
      membership: string;
      penalty: string;
      callstaken: string;
      lastcall: string;
      lastpause: string;
      incall: string;
      status: string;
      paused: string;
      pausedreason: string;
    }>;
  }>> {
    const action: Record<string, string> = { Action: "QueueStatus" };
    if (queueName) action["Queue"] = queueName;

    const { events } = await this.executeAction(action, true, "QueueStatusComplete");

    const queuesMap: Record<string, any> = {};

    for (const e of events) {
      if (e.event === "QueueParams" || e.event === "queueparams") {
        const q = e.queue || "";
        if (!queuesMap[q]) {
          queuesMap[q] = {
            queue: q,
            max: e.max || "0",
            strategy: e.strategy || "ringall",
            calls: e.calls || "0",
            holdtime: e.holdtime || "0",
            talktime: e.talktime || "0",
            completed: e.completed || "0",
            abandoned: e.abandoned || "0",
            servicelevel: e.servicelevel || "0",
            servicelevelperf: e.servicelevelperf || "0",
            weight: e.weight || "0",
            members: [],
          };
        }
      } else if (e.event === "QueueMember" || e.event === "queuemember") {
        const q = e.queue || "";
        if (!queuesMap[q]) {
          queuesMap[q] = { queue: q, members: [] };
        }
        queuesMap[q].members.push({
          name: e.name || e.membername || "",
          location: e.location || e.stateinterface || "",
          stateinterface: e.stateinterface || "",
          membership: e.membership || "dynamic",
          penalty: e.penalty || "0",
          callstaken: e.callstaken || "0",
          lastcall: e.lastcall || "0",
          lastpause: e.lastpause || "0",
          incall: e.incall || "0",
          status: e.status || "0",
          paused: e.paused || "0",
          pausedreason: e.pausedreason || "",
        });
      }
    }

    return Object.values(queuesMap);
  }

  async getQueueSummary(queueName?: string): Promise<Array<{
    queue: string;
    loggedIn: string;
    available: string;
    callers: string;
    holdtime: string;
    talktime: string;
    longestHoldTime: string;
  }>> {
    const action: Record<string, string> = { Action: "QueueSummary" };
    if (queueName) action["Queue"] = queueName;

    const { events } = await this.executeAction(action, true, "QueueSummaryComplete");

    return events
      .filter((e) => e.event === "QueueSummary" || e.event === "queuesummary")
      .map((e) => ({
        queue: e.queue || "",
        loggedIn: e.loggedin || "0",
        available: e.available || "0",
        callers: e.callers || "0",
        holdtime: e.holdtime || "0",
        talktime: e.talktime || "0",
        longestHoldTime: e.longestholdtime || "0",
      }));
  }

  async getRegistrations(): Promise<Array<{
    host: string;
    port: string;
    username: string;
    domain: string;
    domainport: string;
    refresh: string;
    state: string;
    registrationtime: string;
  }>> {
    try {
      const { events } = await this.executeAction(
        { Action: "SIPshowregistry" },
        true,
        "RegistrationsComplete"
      );
      return events
        .filter((e) => e.event === "RegistryEntry" || e.event === "registryentry")
        .map((e) => ({
          host: e.host || "",
          port: e.port || "5060",
          username: e.username || "",
          domain: e.domain || "",
          domainport: e.domainport || "",
          refresh: e.refresh || "0",
          state: e.state || "Unknown",
          registrationtime: e.registrationtime || "",
        }));
    } catch {
      return [];
    }
  }

  async getVoicemailUsers(): Promise<Array<{
    vmcontext: string;
    voicemailbox: string;
    fullname: string;
    email: string;
    newmessages: string;
    oldmessages: string;
  }>> {
    try {
      const { events } = await this.executeAction(
        { Action: "VoicemailUsersList" },
        true,
        "VoicemailUsersListComplete"
      );
      return events
        .filter((e) => e.event === "VoicemailUserEntry" || e.event === "voicemailuserentry")
        .map((e) => ({
          vmcontext: e.vmcontext || "default",
          voicemailbox: e.voicemailbox || "",
          fullname: e.fullname || "",
          email: e.email || "",
          newmessages: e.newmessagecount || e.newmessages || "0",
          oldmessages: e.oldmessagecount || e.oldmessages || "0",
        }));
    } catch {
      return [];
    }
  }

  async reload(module?: string): Promise<{ success: boolean; message: string }> {
    const action: Record<string, string> = { Action: "Reload" };
    if (module) action["Module"] = module;

    const { response } = await this.executeAction(action);
    return {
      success: response.response === "Success",
      message: response.message || "Reload executado",
    };
  }

  async executeCommand(command: string): Promise<string> {
    const { response } = await this.executeAction({
      Action: "Command",
      Command: command,
    });
    return response.output || response.message || JSON.stringify(response);
  }

  async originate(params: {
    channel: string;
    context: string;
    exten: string;
    priority: string;
    callerid?: string;
    timeout?: string;
    variable?: string;
  }): Promise<{ success: boolean; message: string }> {
    const action: Record<string, string> = {
      Action: "Originate",
      Channel: params.channel,
      Context: params.context,
      Exten: params.exten,
      Priority: params.priority,
      Async: "true",
    };
    if (params.callerid) action["CallerID"] = params.callerid;
    if (params.timeout) action["Timeout"] = params.timeout;
    if (params.variable) action["Variable"] = params.variable;

    const { response } = await this.executeAction(action);
    return {
      success: response.response === "Success",
      message: response.message || "Chamada originada",
    };
  }

  async hangupChannel(channel: string): Promise<{ success: boolean; message: string }> {
    const { response } = await this.executeAction({
      Action: "Hangup",
      Channel: channel,
    });
    return {
      success: response.response === "Success",
      message: response.message || "Canal encerrado",
    };
  }

  async queueAdd(queue: string, iface: string, memberName?: string, penalty?: number): Promise<{ success: boolean; message: string }> {
    const action: Record<string, string> = {
      Action: "QueueAdd",
      Queue: queue,
      Interface: iface,
    };
    if (memberName) action["MemberName"] = memberName;
    if (penalty !== undefined) action["Penalty"] = String(penalty);

    const { response } = await this.executeAction(action);
    return {
      success: response.response === "Success",
      message: response.message || "Membro adicionado à fila",
    };
  }

  async queueRemove(queue: string, iface: string): Promise<{ success: boolean; message: string }> {
    const { response } = await this.executeAction({
      Action: "QueueRemove",
      Queue: queue,
      Interface: iface,
    });
    return {
      success: response.response === "Success",
      message: response.message || "Membro removido da fila",
    };
  }

  async queuePause(queue: string, iface: string, paused: boolean, reason?: string): Promise<{ success: boolean; message: string }> {
    const action: Record<string, string> = {
      Action: "QueuePause",
      Queue: queue,
      Interface: iface,
      Paused: paused ? "true" : "false",
    };
    if (reason) action["Reason"] = reason;

    const { response } = await this.executeAction(action);
    return {
      success: response.response === "Success",
      message: response.message || (paused ? "Membro pausado" : "Membro retomado"),
    };
  }

  async getExtensionState(exten: string, context: string): Promise<{ status: number; statusText: string }> {
    const { response } = await this.executeAction({
      Action: "ExtensionState",
      Exten: exten,
      Context: context,
    });
    const status = parseInt(response.status || "-1");
    const statusTexts: Record<number, string> = {
      [-1]: "Extension not found",
      [0]: "Idle",
      [1]: "In Use",
      [2]: "Busy",
      [4]: "Unavailable",
      [8]: "Ringing",
      [9]: "In Use & Ringing",
      [16]: "On Hold",
    };
    return {
      status,
      statusText: response.statustextdesc || statusTexts[status] || "Unknown",
    };
  }

  async sipQualifyPeer(peer: string): Promise<{ success: boolean; message: string }> {
    const { response } = await this.executeAction({
      Action: "SIPqualifypeer",
      Peer: peer,
    });
    return {
      success: response.response === "Success",
      message: response.message || "Qualify enviado",
    };
  }

  async getMailboxStatus(mailbox: string): Promise<{ newMessages: number; oldMessages: number }> {
    const { response } = await this.executeAction({
      Action: "MailboxCount",
      Mailbox: mailbox,
    });
    return {
      newMessages: parseInt(response.newmessages || "0"),
      oldMessages: parseInt(response.oldmessages || "0"),
    };
  }

  async dbGet(family: string, key: string): Promise<string | null> {
    try {
      const { response } = await this.executeAction({
        Action: "DBGet",
        Family: family,
        Key: key,
      });
      return response.val || null;
    } catch {
      return null;
    }
  }

  async dbPut(family: string, key: string, val: string): Promise<boolean> {
    const { response } = await this.executeAction({
      Action: "DBPut",
      Family: family,
      Key: key,
      Val: val,
    });
    return response.response === "Success";
  }

  async dbDel(family: string, key: string): Promise<boolean> {
    const { response } = await this.executeAction({
      Action: "DBDel",
      Family: family,
      Key: key,
    });
    return response.response === "Success";
  }

  async getModules(): Promise<string> {
    return this.executeCommand("module show");
  }

  async redirect(channel: string, context: string, exten: string, priority: string): Promise<{ success: boolean; message: string }> {
    const { response } = await this.executeAction({
      Action: "Redirect",
      Channel: channel,
      Context: context,
      Exten: exten,
      Priority: priority,
    });
    return {
      success: response.response === "Success",
      message: response.message || "Canal redirecionado",
    };
  }

  async monitor(channel: string, file: string, mix: boolean = true): Promise<{ success: boolean; message: string }> {
    const { response } = await this.executeAction({
      Action: "Monitor",
      Channel: channel,
      File: file,
      Mix: mix ? "true" : "false",
    });
    return {
      success: response.response === "Success",
      message: response.message || "Monitoramento iniciado",
    };
  }

  async stopMonitor(channel: string): Promise<{ success: boolean; message: string }> {
    const { response } = await this.executeAction({
      Action: "StopMonitor",
      Channel: channel,
    });
    return {
      success: response.response === "Success",
      message: response.message || "Monitoramento parado",
    };
  }

  async getFullStatus(): Promise<{
    coreStatus: any;
    coreSettings: any;
    peers: any[];
    channels: any[];
    registrations: any[];
  }> {
    const [coreStatus, coreSettings, peers, channels, registrations] = await Promise.all([
      this.getCoreStatus().catch(() => ({})),
      this.getCoreSettings().catch(() => ({})),
      this.getSIPPeers().catch(() => []),
      this.getActiveChannels().catch(() => []),
      this.getRegistrations().catch(() => []),
    ]);

    return { coreStatus, coreSettings, peers, channels, registrations };
  }
}

export function createAMIClient(host: string, port: number, username: string, password: string): AsteriskAMI {
  return new AsteriskAMI(host, port, username, password);
}
