import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import { getOpenClawConfig, getOpenClawGlobalArgs } from "@/lib/openclaw/config";
import { extractJsonPayload } from "@/lib/openclaw/json";

const execFileAsync = promisify(execFile);

export interface ProvisionOpenClawAgentInput {
  agentId: string;
  displayName: string;
  workspacePath: string;
  agentDirPath: string;
}

export interface ProvisionOpenClawAgentResult {
  agentId: string;
  workspace: string;
  agentDir: string;
  identityApplied: boolean;
  identityWarning?: string;
}

interface OpenClawAgentAddResponse {
  agentId?: string;
  workspace?: string;
  agentDir?: string;
}

async function ensureReservedDirectory(dir: string) {
  await fs.mkdir(path.dirname(dir), { recursive: true });

  try {
    await fs.mkdir(dir);
    return;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "EEXIST") {
      throw error;
    }
  }

  const entries = await fs.readdir(dir);
  if (entries.length > 0) {
    throw new Error(`OpenClaw path already exists and is not empty: ${dir}`);
  }
}

async function runOpenClawJsonCommand<T>(args: string[]) {
  const config = getOpenClawConfig();
  const commandArgs = [...getOpenClawGlobalArgs(config), ...args];

  const { stdout, stderr } = await execFileAsync(config.bin, commandArgs, {
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
    timeout: config.timeoutMs,
  });

  const combinedOutput = [stdout, stderr].filter(Boolean).join("\n");
  return extractJsonPayload<T>(combinedOutput);
}

/**
 * Bind an agent to a channel account.
 * Equivalent to: openclaw agents bind --agent {agentId} --bind {channel}:{accountName}
 */
export async function bindAgentToChannel(
  agentId: string,
  channel: string,
  accountName: string
): Promise<void> {
  const config = getOpenClawConfig();
  const args = [
    ...getOpenClawGlobalArgs(config),
    "agents",
    "bind",
    "--agent",
    agentId,
    "--bind",
    `${channel}:${accountName}`,
  ];

  await execFileAsync(config.bin, args, {
    env: process.env,
    maxBuffer: 1024 * 1024,
    timeout: config.timeoutMs,
  });
}

export async function provisionOpenClawAgent(
  input: ProvisionOpenClawAgentInput
): Promise<ProvisionOpenClawAgentResult> {
  const config = getOpenClawConfig();

  await ensureReservedDirectory(input.workspacePath);
  await ensureReservedDirectory(input.agentDirPath);

  const addArgs = [
    "agents",
    "add",
    input.agentId,
    "--workspace",
    input.workspacePath,
    "--agent-dir",
    input.agentDirPath,
    "--non-interactive",
    "--json",
  ];

  if (config.model) {
    addArgs.push("--model", config.model);
  }

  const created = await runOpenClawJsonCommand<OpenClawAgentAddResponse>(addArgs);

  let identityApplied = true;
  let identityWarning: string | undefined;

  try {
    await runOpenClawJsonCommand<Record<string, unknown>>([
      "agents",
      "set-identity",
      "--agent",
      input.agentId,
      "--workspace",
      input.workspacePath,
      "--name",
      input.displayName,
      "--json",
    ]);
  } catch (error) {
    identityApplied = false;
    identityWarning =
      error instanceof Error ? error.message : "Failed to set agent identity";
  }

  return {
    agentId: created.agentId || input.agentId,
    workspace: created.workspace || input.workspacePath,
    agentDir: created.agentDir || input.agentDirPath,
    identityApplied,
    identityWarning,
  };
}
