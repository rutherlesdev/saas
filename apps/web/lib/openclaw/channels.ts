import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
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

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  const accountName = getWhatsAppAccountName();
  const credsPath = getCredentialsPath(accountName);

  try {
    await access(credsPath);
    return { linked: true, accountName };
  } catch {
    return { linked: false, accountName };
  }
}

export async function disconnectWhatsApp(): Promise<void> {
  const config = getOpenClawConfig();
  const accountName = getWhatsAppAccountName();

  const args = [
    ...getOpenClawGlobalArgs(config),
    "channels",
    "remove",
    "--channel",
    "whatsapp",
    "--account",
    accountName,
    "--delete",
  ];

  await execFileAsync(config.bin, args, {
    env: process.env,
    timeout: 30_000,
  });
}
