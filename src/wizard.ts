// Interactive wizard — stdlib `readline` only, no extra deps.

import type { Cfg } from './types';
import { args, REQUIRED, USAGE, buildCfg, deriveAssetBase, type RawArgs } from './args';

/**
 * Robust line reader: queues stdin lines so repeated prompts never drop input
 * (plain readline.question loses lines on fast piped/file input). Works for both
 * an interactive TTY and piped/scripted stdin.
 */
function makeAsker() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: !!process.stdin.isTTY,
  });
  const queue: string[] = [];
  const waiters: Array<(line: string | null) => void> = [];
  let closed = false;
  rl.on('line', (line: string) => {
    if (waiters.length) waiters.shift()!(line);
    else queue.push(line);
  });
  rl.on('close', () => {
    closed = true;
    while (waiters.length) waiters.shift()!(null);
  });
  const nextLine = (): Promise<string | null> =>
    new Promise((res) => {
      if (queue.length) return res(queue.shift()!);
      if (closed) return res(null);
      waiters.push(res);
    });
  const ask = async (text: string, def?: string): Promise<string> => {
    // Use readline's own prompt (not a raw stdout.write) so it knows the
    // prompt's length and math backspace/redraw against it correctly —
    // otherwise backspace eats into the prompt text instead of the input.
    rl.setPrompt(`  ${text}${def ? ` [${def}]` : ''}: `);
    rl.prompt();
    const line = await nextLine();
    return (line && line.trim()) || def || '';
  };
  return { ask, close: () => rl.close(), isClosed: () => closed };
}

/**
 * Undo what a terminal does when you drag a file onto it (iTerm2, Terminal.app,
 * VS Code's integrated terminal): it types the absolute path as shell-escaped
 * text — either backslash-escaped special chars (`/a/My\ Photo.webp`) or the
 * whole path wrapped in single/double quotes. Plain input is returned as-is.
 */
export function unescapeDroppedPath(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  const quoted =
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2) ||
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2);
  if (quoted) {
    s = s.slice(1, -1);
    if (s.startsWith("'")) return s.replace(/\\'/g, "'"); // single-quoted: no other escapes
  }
  // backslash-escaped: `\ ` `\(` etc. → the literal char
  return s.replace(/\\(.)/g, '$1');
}

/** Interactive prompt asking for scheme/asset names and (optional) image paths. */
async function runWizard(): Promise<Cfg> {
  const { ask, close, isClosed } = makeAsker();
  const askRequired = async (text: string, def?: string): Promise<string> => {
    let v = '';
    while (!v) {
      v = await ask(text, def);
      if (!v) {
        if (isClosed()) throw new Error(`input ended before "${text}" was given`);
        console.log('    (required)');
      }
    }
    return v;
  };

  console.log('\n=== gen-card-scheme — interactive ===\n');
  const a: RawArgs = {};
  a.scheme = await askRequired('Tên scheme (enum CARD_PRODUCT_SCHEME)');
  a.value = await ask('Giá trị enum (string)', a.scheme as string);
  a.base = await ask('Base CardProductName', 'VIKKI_ONE_CONNECT_PREPAID');
  const defaultCard = deriveAssetBase(a.scheme as string, a.value as string);
  a.card = await ask('Tên asset thẻ (card)', defaultCard);
  a.shadow = await ask('Tên asset shadow', `${a.card}Shadow`);
  a.layout = await ask('Tên asset layout', `${a.card}Layout`);

  console.log(
    '\n  Đường dẫn file ảnh (.webp) — kéo-thả file vào terminal cũng được, hoặc Enter để bỏ qua:',
  );
  const askPath = async (text: string): Promise<string> => unescapeDroppedPath(await ask(text));
  a['card-img'] = await askPath('  → file ảnh thẻ');
  a['shadow-img'] = await askPath('  → file ảnh shadow');
  a['layout-img'] = await askPath('  → file ảnh layout');

  const proceed = await ask('\nGhi thay đổi ngay? (y = write, n = dry-run)', 'y');
  a.dryRun = !/^y(es)?$/i.test(proceed);
  close();
  return buildCfg(a);
}

/** Flags → Cfg, or launch the wizard when required flags are missing/absent. */
export async function resolveConfig(): Promise<Cfg> {
  const noArgs = process.argv.slice(2).length === 0;
  const haveAll = REQUIRED.every((k) => args[k]);

  // Run the wizard when: launched with no args at all, explicitly asked for it,
  // or some required flags are missing.
  if (noArgs || args.interactive || !haveAll) {
    // Only block when the user passed SOME flags but not all AND there's no TTY
    // and nothing piped to read from (e.g. a misconfigured CI invocation).
    if (!noArgs && !args.interactive && !process.stdin.isTTY) {
      const missing = REQUIRED.filter((k) => !args[k]);
      console.error(
        `[gen-card-scheme] Missing required flags: ${missing
          .map((m) => '--' + m)
          .join(', ')}\n${USAGE}`,
      );
      process.exit(1);
    }
    return runWizard();
  }
  return buildCfg(args);
}
