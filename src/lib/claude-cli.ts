import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

// Runs the locally installed Claude Code CLI in headless print mode instead of
// calling a hosted API. Useful when you are working locally and would rather
// spend a Claude subscription than API credits.
//
// IMPORTANT: this only works where the binary exists — a developer machine or a
// server where it is installed (the production VPS doesn't have it), so the
// caller must fall back to an API provider elsewhere.

const DEFAULT_CANDIDATES = [
  path.join(os.homedir(), ".local/bin/claude"),
  path.join(os.homedir(), ".claude/local/claude"),
  "/usr/local/bin/claude",
  "/opt/homebrew/bin/claude",
];

/** First existing CLI path (or an explicit override), else null. */
export function resolveClaudeCli(explicitPath?: string | null): string | null {
  const candidates = explicitPath?.trim() ? [explicitPath.trim(), ...DEFAULT_CANDIDATES] : DEFAULT_CANDIDATES;
  for (const c of candidates) {
    try {
      if (existsSync(c)) return c;
    } catch {
      // ignore unreadable paths
    }
  }
  return null;
}

// If the app itself was started from inside a Claude Code session, the process
// inherits that session's variables and a spawned CLI refuses to run as a nested
// child (exit code 1, no stderr). Drop those, plus NODE_OPTIONS, which would be
// applied to the CLI's own Node runtime.
function sanitizedEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("CLAUDE_CODE_")) delete env[key];
  }
  delete env.CLAUDE_PID;
  delete env.CLAUDE_EFFORT;
  delete env.CLAUDE_AGENT_SDK_VERSION;
  delete env.NODE_OPTIONS;
  return env;
}

export interface ClaudeCliResult {
  text: string;
  costUsd: number;
  durationMs: number;
  model?: string;
}

/**
 * Execute one prompt and return the assistant's text.
 *
 * The prompt is passed via stdin and arguments are given as an array (never a
 * shell string), so nothing in the prompt can be interpreted as a command.
 */
export async function runClaudeCli(opts: {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  cliPath?: string | null;
  timeoutMs?: number;
}): Promise<ClaudeCliResult> {
  const bin = resolveClaudeCli(opts.cliPath);
  if (!bin) {
    throw new Error(
      "Claude CLI not found on this machine. Install Claude Code, or set the binary path in Settings → AI Configuration. (Not available on the deployed site.)"
    );
  }

  const args = ["-p", "--output-format", "json", "--max-turns", "1"];
  // Only Claude models are valid here. A connection may still carry a default
  // model string from another provider (e.g. "google/gemini-…"), which the CLI
  // rejects outright — in that case fall back to its own default.
  if (opts.model && /claude|opus|sonnet|haiku/i.test(opts.model)) {
    args.push("--model", opts.model);
  }
  if (opts.systemPrompt) args.push("--append-system-prompt", opts.systemPrompt);

  const timeoutMs = opts.timeoutMs ?? 180_000;
  const startedAt = Date.now();

  return new Promise<ClaudeCliResult>((resolve, reject) => {
    // cwd is the OS temp dir: the CLI reads project context from its working
    // directory, and generating an email should not pick up this repo's files.
    const child = spawn(bin, args, {
      cwd: os.tmpdir(),
      env: sanitizedEnv(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`Claude CLI timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Could not start the Claude CLI: ${err.message}`));
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        const detail = [
          `exit ${code}`,
          stderr.trim() ? `stderr: ${stderr.trim().slice(0, 400)}` : "",
          (() => {
            try {
              const j = JSON.parse(stdout);
              return j?.result ? `cli: ${String(j.result).slice(0, 300)}` : "";
            } catch { return stdout.trim() ? `stdout: ${stdout.trim().slice(0, 300)}` : ""; }
          })(),
          `bin: ${bin}`,
        ].filter(Boolean).join(" | ");
        reject(new Error(`Claude CLI failed (${detail})`));
        return;
      }
      try {
        const data = JSON.parse(stdout);
        if (data.is_error) {
          reject(new Error(String(data.result || "The Claude CLI reported an error").slice(0, 300)));
          return;
        }
        resolve({
          text: String(data.result ?? ""),
          costUsd: Number(data.total_cost_usd || 0),
          durationMs: Date.now() - startedAt,
          model: Object.keys(data.modelUsage || {})[0],
        });
      } catch {
        // Fall back to raw stdout if the JSON envelope is missing.
        if (stdout.trim()) resolve({ text: stdout.trim(), costUsd: 0, durationMs: Date.now() - startedAt });
        else reject(new Error("The Claude CLI returned no output"));
      }
    });

    child.stdin.write(opts.prompt);
    child.stdin.end();
  });
}
