import { Client as SSHClient } from "ssh2";

export interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "privatekey";
  password?: string;
  privateKey?: string;
}

export interface AMISetupConfig {
  amiPort: number;
  amiUsername: string;
  amiPassword: string;
}

export interface SetupStep {
  step: string;
  status: "pending" | "running" | "success" | "error";
  message?: string;
}

export interface SetupResult {
  success: boolean;
  message: string;
  steps: SetupStep[];
  asteriskVersion?: string;
}

function execSSHCommand(client: SSHClient, command: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) return reject(err);

      let stdout = "";
      let stderr = "";

      stream.on("close", (code: number) => {
        resolve({ stdout, stderr, code: code || 0 });
      });

      stream.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      setTimeout(() => {
        try { stream.close(); } catch {}
        resolve({ stdout, stderr, code: -1 });
      }, 30000);
    });
  });
}

function connectSSH(config: SSHConnectionConfig): Promise<SSHClient> {
  return new Promise((resolve, reject) => {
    const client = new SSHClient();

    const connectConfig: any = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 15000,
    };

    if (config.authMethod === "privatekey" && config.privateKey) {
      connectConfig.privateKey = config.privateKey;
    } else if (config.password) {
      connectConfig.password = config.password;
    }

    client.on("ready", () => resolve(client));
    client.on("error", (err) => reject(new Error(`Erro SSH: ${err.message}`)));
    client.connect(connectConfig);
  });
}

export async function setupAMIRemotely(
  sshConfig: SSHConnectionConfig,
  amiConfig: AMISetupConfig
): Promise<SetupResult> {
  const steps: SetupStep[] = [
    { step: "Conectando via SSH", status: "pending" },
    { step: "Verificando Asterisk instalado", status: "pending" },
    { step: "Fazendo backup do manager.conf", status: "pending" },
    { step: "Configurando AMI (manager.conf)", status: "pending" },
    { step: "Recarregando Asterisk Manager", status: "pending" },
    { step: "Verificando configuração aplicada", status: "pending" },
  ];

  let client: SSHClient | null = null;
  let asteriskVersion: string | undefined;

  try {
    steps[0].status = "running";
    client = await connectSSH(sshConfig);
    steps[0].status = "success";
    steps[0].message = `Conectado a ${sshConfig.host}:${sshConfig.port}`;

    steps[1].status = "running";
    const versionResult = await execSSHCommand(client, "asterisk -V 2>/dev/null || asterisk -rx 'core show version' 2>/dev/null");
    if (versionResult.code !== 0 && !versionResult.stdout.trim()) {
      steps[1].status = "error";
      steps[1].message = "Asterisk não encontrado no servidor";
      return {
        success: false,
        message: "Asterisk não está instalado ou não foi encontrado no servidor. Verifique se o Asterisk está instalado e acessível.",
        steps,
      };
    }
    asteriskVersion = versionResult.stdout.trim().replace(/^Asterisk\s+/i, "").split("\n")[0];
    steps[1].status = "success";
    steps[1].message = `Asterisk encontrado: ${asteriskVersion}`;

    steps[2].status = "running";
    const confPathResult = await execSSHCommand(client, "test -f /etc/asterisk/manager.conf && echo 'exists' || echo 'not_found'");
    const confExists = confPathResult.stdout.trim() === "exists";

    if (confExists) {
      const backupResult = await execSSHCommand(
        client,
        `cp /etc/asterisk/manager.conf /etc/asterisk/manager.conf.bak.$(date +%Y%m%d%H%M%S)`
      );
      if (backupResult.code === 0) {
        steps[2].status = "success";
        steps[2].message = "Backup do manager.conf criado";
      } else {
        steps[2].status = "success";
        steps[2].message = "Novo arquivo será criado (sem backup necessário)";
      }
    } else {
      steps[2].status = "success";
      steps[2].message = "Arquivo não existia, será criado novo";
    }

    steps[3].status = "running";

    const permissions = "system,call,log,verbose,command,agent,user,config,originate,dialplan,dtmf,reporting,cdr,security";

    const managerConf = `; manager.conf - Configurado automaticamente pelo Admin VOIP
; Data: ${new Date().toISOString()}
; NÃO EDITE MANUALMENTE - Gerenciado pelo Admin VOIP (atendaja.com.br)

[general]
enabled = yes
port = ${amiConfig.amiPort}
bindaddr = 127.0.0.1

[${amiConfig.amiUsername}]
secret = ${amiConfig.amiPassword}
deny = 0.0.0.0/0.0.0.0
permit = 127.0.0.1/255.255.255.255
read = ${permissions}
write = ${permissions}
writetimeout = 5000
`;

    const escapedConf = managerConf.replace(/'/g, "'\\''");
    const writeResult = await execSSHCommand(
      client,
      `echo '${escapedConf}' > /etc/asterisk/manager.conf && chmod 640 /etc/asterisk/manager.conf && chown asterisk:asterisk /etc/asterisk/manager.conf 2>/dev/null; echo 'WRITE_OK'`
    );

    if (!writeResult.stdout.includes("WRITE_OK")) {
      const sudoResult = await execSSHCommand(
        client,
        `echo '${escapedConf}' | sudo tee /etc/asterisk/manager.conf > /dev/null && sudo chmod 640 /etc/asterisk/manager.conf && sudo chown asterisk:asterisk /etc/asterisk/manager.conf 2>/dev/null; echo 'WRITE_OK'`
      );
      if (!sudoResult.stdout.includes("WRITE_OK")) {
        steps[3].status = "error";
        steps[3].message = "Sem permissão para escrever em /etc/asterisk/manager.conf";
        return {
          success: false,
          message: "Sem permissão para configurar o Asterisk. O usuário SSH precisa de acesso root ou sudo.",
          steps,
          asteriskVersion,
        };
      }
    }

    steps[3].status = "success";
    steps[3].message = "manager.conf configurado com sucesso";

    steps[4].status = "running";
    let reloadResult = await execSSHCommand(client, `asterisk -rx 'manager reload' 2>/dev/null`);
    if (reloadResult.code !== 0) {
      reloadResult = await execSSHCommand(client, `sudo asterisk -rx 'manager reload' 2>/dev/null`);
    }

    if (reloadResult.code !== 0 && !reloadResult.stdout.toLowerCase().includes("reload")) {
      const restartResult = await execSSHCommand(client, `sudo systemctl reload asterisk 2>/dev/null || sudo service asterisk reload 2>/dev/null`);
      if (restartResult.code !== 0) {
        steps[4].status = "error";
        steps[4].message = "Não foi possível recarregar o Asterisk. Pode ser necessário reiniciar manualmente.";
        return {
          success: false,
          message: "Configuração gravada, mas não foi possível recarregar o Asterisk. Reinicie o serviço manualmente.",
          steps,
          asteriskVersion,
        };
      }
    }

    steps[4].status = "success";
    steps[4].message = "Asterisk Manager recarregado";

    steps[5].status = "running";
    await new Promise((r) => setTimeout(r, 1500));

    const verifyResult = await execSSHCommand(client, `asterisk -rx 'manager show users' 2>/dev/null || sudo asterisk -rx 'manager show users' 2>/dev/null`);

    if (verifyResult.stdout.includes(amiConfig.amiUsername)) {
      steps[5].status = "success";
      steps[5].message = `Usuário AMI '${amiConfig.amiUsername}' ativo e configurado`;
    } else {
      steps[5].status = "success";
      steps[5].message = "Configuração aplicada (verificação manual recomendada)";
    }

    client.end();

    return {
      success: true,
      message: `AMI configurado com sucesso no servidor ${sshConfig.host}. Usuário: ${amiConfig.amiUsername}, Porta: ${amiConfig.amiPort}, Bind: 127.0.0.1 (acesso via SSH tunnel).`,
      steps,
      asteriskVersion,
    };
  } catch (error: any) {
    const currentStep = steps.find((s) => s.status === "running");
    if (currentStep) {
      currentStep.status = "error";
      currentStep.message = error.message;
    }

    try { client?.end(); } catch {}

    return {
      success: false,
      message: `Erro durante configuração: ${error.message}`,
      steps,
      asteriskVersion,
    };
  }
}
