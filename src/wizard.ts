// Interactive wizard — stdlib `readline` only, no extra deps.

import type { Cfg } from './types';
import {
  args,
  REQUIRED,
  USAGE,
  buildCfg,
  deriveTemplateKey,
  deriveBrand,
  deriveHomeTodoKey,
  type RawArgs,
} from './args';

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

  console.log('\n=== gen-card-scheme — interactive (org-card flow, PR #3378) ===\n');
  const a: RawArgs = {};
  // CARD_PRODUCT_SCHEME key and string value are always identical — one prompt covers both.
  a.scheme = await askRequired('Tên scheme (enum CARD_PRODUCT_SCHEME)');

  const defaultTemplateKey = deriveTemplateKey(a.scheme as string);
  a['template-key'] = await ask('Tên enum CARD_TEMPLATE', defaultTemplateKey);
  a['template-value'] = await askRequired(
    'Giá trị CARD_TEMPLATE (prefix số thẻ, vd VK0302391568E)',
  );

  const defaultBrand = deriveBrand(a['template-key'] as string);
  a.brand = await ask('Brand code (tiền tố tên asset, vd DAMTC)', defaultBrand);
  const brand = a.brand as string;

  console.log('\n  Tên các asset (Enter để dùng gợi ý theo brand code):');
  a.header = await ask('  → asset header (org-card)', `${brand}Header`);
  a.bg = await ask('  → asset background (org-card)', `${brand}BG`);
  a.front = await ask('  → asset mặt thẻ (physical card front)', `${brand}Front`);
  a.layout = await ask('  → asset layout (dual-card)', `${brand}VikkiOneConnectLayout`);
  a['banner-en'] = await ask(
    '  → asset banner trang chủ (EN)',
    `${brand}VikkiOneConnectBannerEN`,
  );
  a['banner-vi'] = await ask(
    '  → asset banner trang chủ (VI)',
    `${brand}VikkiOneConnectBannerVI`,
  );

  a['home-todo'] = await ask(
    'Tên HomeTodoType (mục nhắc onboard ở trang chủ)',
    deriveHomeTodoKey(a['template-key'] as string),
  );
  a.color = await ask(
    'Màu chữ tên/ID/chức danh trên thẻ (VikkiOrgName)',
    'Colors.Labels.StrongWhite',
  );

  console.log(
    '\n  Đường dẫn file ảnh (.webp) — kéo-thả file vào terminal cũng được, hoặc Enter để bỏ qua:',
  );
  const askPath = async (text: string): Promise<string> => unescapeDroppedPath(await ask(text));
  a['header-img'] = await askPath('  → file ảnh header');
  a['bg-img'] = await askPath('  → file ảnh background');
  a['front-img'] = await askPath('  → file ảnh mặt thẻ');
  a['layout-img'] = await askPath('  → file ảnh layout');
  a['banner-en-img'] = await askPath('  → file ảnh banner (EN)');
  a['banner-vi-img'] = await askPath('  → file ảnh banner (VI)');

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
