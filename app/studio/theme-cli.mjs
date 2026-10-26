// Noninteractive, shell-free CLI transport. Model IDs checked against the live
// orchestration catalog on 2026-10-24; account access is determined by each CLI.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import modelOptions from './theme-models.cjs';

export const { FAMILY_DEFAULT, CODEX_MODELS, ENGINE_IDS } = modelOptions;
export const CLI_BILLING = 'CLI account usage; subscription limits, extra usage or API charges depend on the configured login. Reported token cost is not a subscription invoice.';

export function selectModel(engine, requested) {
  if (!ENGINE_IDS.includes(engine)) throw Error(`Unknown engine: ${engine}`);
  if (engine === 'offline') {
    if (requested) throw Error('--model requires an AI engine.');
    return '';
  }
  if (requested !== undefined && (typeof requested !== 'string' || !requested.trim() || requested.startsWith('--'))) throw Error('--model requires a full model ID.');
  const model = requested || (engine === 'codex-cli' ? CODEX_MODELS[0] : FAMILY_DEFAULT[engine.replace('claude-', '')] || FAMILY_DEFAULT.sonnet);
  const valid = engine === 'codex-cli' ? /^gpt-\d[\w.-]*$/.test(model) : /^claude-(opus|sonnet|haiku)-\d[\w.-]*$/.test(model);
  if (!valid) throw Error(`Use a full ${engine === 'codex-cli' ? 'Codex' : 'Claude'} model ID, not a family alias: ${model}`);
  if (!engine.endsWith('-cli') && !model.startsWith(`${engine}-`)) throw Error(`Model ${model} does not match engine ${engine}.`);
  return model;
}

export function findCli(engine, { env = process.env, platform = process.platform, arch = process.arch, exists = fs.existsSync } = {}) {
  const name = engine === 'codex-cli' ? 'codex' : 'claude';
  const p = platform === 'win32' ? path.win32 : path.posix;
  const dirs = String(env.PATH || env.Path || '').split(platform === 'win32' ? ';' : ':').filter(Boolean).map(d => d.replace(/^"|"$/g, ''));
  for (const dir of dirs) {
    const candidates = [p.join(dir, platform === 'win32' ? `${name}.exe` : name)];
    if (platform === 'win32') {
      // npm shims spawn extra processes without windowsHide. Resolve their native
      // payload directly; never run .cmd/.bat files or interpolate a shell command.
      if (name === 'claude') candidates.push(p.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'));
      else {
        const triple = arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
        const vendor = p.join('vendor', triple, 'bin', 'codex.exe');
        candidates.push(p.join(dir, 'node_modules', '@openai', 'codex', 'node_modules', '@openai', `codex-win32-${arch}`, vendor),
          p.join(dir, 'node_modules', '@openai', `codex-win32-${arch}`, vendor), p.join(dir, 'node_modules', '@openai', 'codex', vendor));
      }
    }
    for (const candidate of candidates) if (exists(candidate)) return candidate;
  }
  throw Error(`${name} CLI executable not found on PATH (Windows requires a native or supported npm installation).`);
}

export function cliArgs(engine, model, maxUsd, outputFile) {
  selectModel(engine, model);
  if (engine === 'claude-cli') return ['-p', '--output-format', 'json', '--model', model, '--tools', '', '--safe-mode', '--strict-mcp-config', '--no-session-persistence', '--max-budget-usd', String(maxUsd)];
  if (engine !== 'codex-cli') throw Error('Not a CLI engine.');
  return ['--no-daemon', '--ask-for-approval', 'never', 'exec', '--model', model, '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '--ignore-user-config', '--ignore-rules',
    ...['shell_tool', 'unified_exec', 'hooks', 'plugins', 'apps', 'multi_agent', 'multi_agent_v2', 'browser_use', 'computer_use', 'image_generation', 'code_mode'].flatMap(f => ['--disable', f]),
    '-c', 'web_search="disabled"', '--color', 'never', '--json', '--output-last-message', outputFile, '-'];
}

export function runCliProcess(command, args, { input, cwd, env, deadline, spawnImpl = spawn, platform = process.platform, maxBytes = 4 * 1024 * 1024 }) {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (!(remaining > 0)) return reject(Error('CLI deadline expired before starting.'));
    let child, timer, settled = false, stopping = false, stdout = '', stderr = '', bytes = 0;
    const finish = (error, result) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(result); };
    const stop = error => {
      if (settled || stopping) return;
      stopping = true;
      clearTimeout(timer);
      // Only this invocation's PID tree is stopped, never other user CLI sessions.
      if (platform === 'win32' && child?.pid) {
        try {
          const killer = spawnImpl(path.win32.join(env.SystemRoot || process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false, stdio: 'ignore' });
          // Wait briefly for tree termination before deleting scratch output.
          timer = setTimeout(() => { try { child.kill(); } catch {} finish(error); }, 1000);
          killer.on('error', () => { try { child.kill(); } catch {} finish(error); });
          killer.on('close', () => finish(error));
          return;
        } catch { try { child.kill(); } catch {} }
      } else if (child?.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch {} }
      }
      finish(error);
    };
    try { child = spawnImpl(command, args, { cwd, env, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'], detached: platform !== 'win32' }); }
    catch (e) { return finish(e); }
    timer = setTimeout(() => stop(Error('CLI timed out; usage may have been billed.')), remaining);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    for (const [stream, which] of [[child.stdout, 'out'], [child.stderr, 'err']]) stream.on('data', data => {
      if (settled || stopping) return;
      bytes += Buffer.byteLength(data);
      if (bytes > maxBytes) return stop(Error('CLI output exceeded the size limit.'));
      if (which === 'out') stdout += data; else stderr += data;
    });
    child.on('error', error => { if (!stopping) finish(error); });
    child.stdin.on('error', error => stop(Error(`CLI input failed: ${error.code || error.message}`)));
    child.on('close', (code, signal) => { if (!stopping) finish(code === 0 ? null : Error(`CLI exited ${code ?? signal}: ${(stderr || stdout).slice(0, 240)}`), stdout); });
    child.stdin.end(input);
  });
}

export function parseCliOutput(engine, stdout, finalText, receipt) {
  if (engine === 'claude-cli') {
    const result = JSON.parse(stdout);
    if (Number.isFinite(result.total_cost_usd) && result.total_cost_usd >= 0) receipt.usd_estimate = result.total_cost_usd;
    receipt.usage = result.usage; receipt.session_id = result.session_id;
    const models = Object.keys(result.modelUsage || {});
    receipt.observed_model = result.model || (models.length === 1 ? models[0] : null);
    if (result.is_error || (result.subtype && result.subtype !== 'success')) throw Error('Claude CLI: ' + String(result.result || result.subtype).slice(0, 200));
    if (typeof result.result !== 'string' || !result.result.trim()) throw Error('Claude CLI returned no final text.');
    return result.result;
  }
  let complete = false;
  for (const line of stdout.split(/\r?\n/).filter(l => l.trim())) {
    const event = JSON.parse(line);
    if (event.type === 'error' || event.type === 'turn.failed') throw Error('Codex CLI: ' + String(event.error?.message || event.message || 'turn failed').slice(0, 200));
    if (event.type === 'thread.started') receipt.session_id = event.thread_id;
    if (event.type === 'turn.completed') { complete = true; receipt.usage = event.usage; }
    if (event.model) receipt.observed_model = event.model;
  }
  if (!complete || typeof finalText !== 'string' || !finalText.trim()) throw Error('Codex CLI returned no completed final text.');
  return finalText;
}

export async function callCli({ engine, model, system, messages, maxUsd, deadline, receipts, progress = () => {} }, deps = {}) {
  selectModel(engine, model);
  if (!Number.isFinite(maxUsd) || maxUsd <= 0) throw Error('Set a positive finite --max-usd before using an AI engine.');
  const cli = (deps.findCli || findCli)(engine);
  const receipt = { at: new Date().toISOString(), engine, model, requested_model: model, observed_model: null, status: 'sent', billing: CLI_BILLING,
    usd_cap_requested: maxUsd, usd_cap: engine === 'claude-cli' ? maxUsd : null, usd_cap_enforced: engine === 'claude-cli', usd_estimate: null };
  receipts.push(receipt);
  progress(`${model} via ${engine}: thinking…${engine === 'codex-cli' ? ' (dollar cap unavailable; account usage applies)' : ''}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't3-theme-cli-'));
  const outputFile = path.join(dir, 'reply.txt');
  try {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.ANTHROPIC_API_KEY; delete env.OPENAI_API_KEY; delete env.CODEX_API_KEY; delete env.CLAUDECODE;
    const input = 'Design a theme using the supplied context only. Do not use tools or access files. Reply with the requested JSON only.\n\n' + system + '\n\n' + messages.map(m => `${m.role}:\n${m.content}`).join('\n\n');
    const stdout = await (deps.runProcess || runCliProcess)(cli, cliArgs(engine, model, maxUsd, outputFile), { input, cwd: dir, env, deadline });
    const finalText = engine === 'codex-cli' && fs.existsSync(outputFile) ? (fs.statSync(outputFile).size <= 2 * 1024 * 1024 ? fs.readFileSync(outputFile, 'utf8') : '') : null;
    const text = parseCliOutput(engine, stdout, finalText, receipt);
    receipt.status = 'ok';
    return { text, usd: receipt.usd_estimate, model: receipt.observed_model || model };
  } catch (e) { receipt.status = 'uncertain'; receipt.error = String(e.message).slice(0, 240); throw e; }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

export function totalKnownCost(receipts) {
  return receipts.length && receipts.every(r => Number.isFinite(r.usd_estimate)) ? receipts.reduce((sum, r) => sum + r.usd_estimate, 0) : null;
}
