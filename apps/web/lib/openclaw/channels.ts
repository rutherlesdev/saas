import { execFile } from "node:child_process";
import { access, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { getOpenClawConfig, getOpenClawGlobalArgs } from "@/lib/openclaw/config";

const execFileAsync = promisify(execFile);

export interface WhatsAppStatus {
  linked: boolean;
  accountName: string;
}

export function getWhatsAppAccountName(): string {
  return process.env.OPENCLAW_WHATSAPP_ACCOUNT || "default";
}

function getCredentialsPath(accountName: string): string {
  const home = process.env.HOME || "/home/openclaw";
  return path.join(
    home,
    ".openclaw",
    "credentials",
    "whatsapp",
    accountName,
    "creds.json"
  );
}

function getCredentialsDir(accountName: string): string {
  return path.dirname(getCredentialsPath(accountName));
}

async function hasWhatsAppAuthState(accountName: string): Promise<boolean> {
  try {
    await access(getCredentialsPath(accountName));
    return true;
  } catch {
    return false;
  }
}

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  const accountName = getWhatsAppAccountName();
  const linked = await hasWhatsAppAuthState(accountName);

  return { linked, accountName };
}

export async function disconnectWhatsApp(): Promise<void> {
  const config = getOpenClawConfig();
  const accountName = getWhatsAppAccountName();

  const args = [
    ...getOpenClawGlobalArgs(config),
    "channels",
    "logout",
    "--channel",
    "whatsapp",
    "--account",
    accountName,
  ];

  let logoutError: unknown = null;

  try {
    await execFileAsync(config.bin, args, {
      env: process.env,
      timeout: 30_000,
    });
  } catch (error) {
    logoutError = error;
  }

  if (!(await hasWhatsAppAuthState(accountName))) {
    return;
  }

  await rm(getCredentialsDir(accountName), {
    recursive: true,
    force: true,
  });

  if (!(await hasWhatsAppAuthState(accountName))) {
    return;
  }

  if (logoutError instanceof Error) {
    throw logoutError;
  }

  throw new Error(
    `Falha ao limpar o estado autenticado do WhatsApp para a conta ${accountName}.`
  );
}
