# vikki-card-codegen

Standalone **AST codemod** that wires a new **prepaid card scheme variant** into
the existing `vikki-host-app` source — mirroring PR #3215
(`feat: card vikki one connect prepaid victoria`).

It does **not** scaffold new screens. It **injects** small, well-anchored
snippets into **9 existing files** using the TypeScript AST (`ts-morph`), so the
edits always land in the exact right node regardless of surrounding line shifts.

Distribute as its own GitHub repo and run it on any machine — no copy into the
host-app needed.

## Run it (any machine)

From **inside** a `vikki-host-app` checkout (it auto-detects the repo root).

### Interactive (recommended)

Run with **no flags** — it launches a wizard that asks for the scheme name, asset
names (shadow/layout names are auto-suggested), and the **paths to your `.webp`
image files** (which it copies into the right asset folders, renamed):

```bash
npx github:<your-org>/vikki-card-codegen
# or force it explicitly:
npx github:<your-org>/vikki-card-codegen --interactive
```

Example session:

```
=== gen-card-scheme — interactive ===

  Tên scheme (enum CARD_PRODUCT_SCHEME): VIKKI_ONE_CONNECT_PP_VICTORIA_PRESCHOOL
  Giá trị enum (string) [VIKKI_ONE_CONNECT_PP_VICTORIA_PRESCHOOL]:
  Base CardProductName [VIKKI_ONE_CONNECT_PREPAID]:
  Tên asset thẻ (card): VikkiOneConnectPrepaidMarina
  Tên asset shadow [VikkiOneConnectPrepaidMarinaShadow]:
  Tên asset layout [VikkiOneConnectPrepaidMarinaLayout]: VikkiGoProPrepaidMarinaCardLayout

  Đường dẫn file ảnh (.webp) — Enter để bỏ qua, copy sau:
    → file ảnh thẻ: ~/Downloads/marina-card.webp
    → file ảnh shadow: ~/Downloads/marina-shadow.webp
    → file ảnh layout: ~/Downloads/marina-layout.webp

Ghi thay đổi ngay? (y = write, n = dry-run) [y]:
```

### Non-interactive (CI / scripted)

```bash
npx github:<your-org>/vikki-card-codegen \
  --scheme VIKKI_ONE_CONNECT_PP_VICTORIA_PRESCHOOL \
  --base   VIKKI_ONE_CONNECT_PREPAID \
  --card   VikkiOneConnectPrepaidMarina \
  --shadow VikkiOneConnectPrepaidMarinaShadow \
  --layout VikkiGoProPrepaidMarinaCardLayout \
  --card-img   ./marina-card.webp \
  --shadow-img ./marina-shadow.webp \
  --layout-img ./marina-layout.webp
```

`npx` clones the repo, installs `ts-morph` automatically, and runs the bin.

### Alternatives

```bash
# Global install
npm install -g github:<your-org>/vikki-card-codegen
gen-card-scheme --scheme ... --base ... --card ... --shadow ... --layout ...

# Clone & link for local dev
git clone https://github.com/<your-org>/vikki-card-codegen
cd vikki-card-codegen && npm install && npm link
# then from inside vikki-host-app:
gen-card-scheme --scheme ...
```

If you are not inside the repo, point at it explicitly: `--root /path/to/vikki-host-app`.

## Flags

| Flag        | Required | Meaning                                                              |
|-------------|----------|----------------------------------------------------------------------|
| `--scheme`  | yes      | enum member added to `CARD_PRODUCT_SCHEME`                           |
| `--base`    | yes      | `CardProductName` the scheme branches under (e.g. `VIKKI_ONE_CONNECT_PREPAID`) |
| `--card`    | yes      | card image asset name in `vikki-go-card/assets`                     |
| `--shadow`  | yes      | shadow image asset name in `vikki-go-card/assets`                   |
| `--layout`  | yes      | layout image asset name in `assets/new-images/card`                 |
| `--card-img`   | no    | source `.webp` for the card image (copied + renamed to `--card`)    |
| `--shadow-img` | no    | source `.webp` for the shadow image                                 |
| `--layout-img` | no    | source `.webp` for the layout image                                 |
| `--value`   | no       | enum string value (defaults to `--scheme`)                          |
| `--root`    | no       | path to `vikki-host-app` root (default: auto-detect from cwd)        |
| `--interactive`, `-i` | no | force the interactive wizard                                      |
| `--dry-run` | no       | print planned changes, write nothing                                |

## Files edited (9)

1. `src/modules/card-onboard/constants/index.ts` — enum member
2. `src/modules/vikki-go-card/assets/index.ts` — register card + shadow assets
3. `assets/new-images/card/index.ts` — register layout asset
4. `src/components/vikki-card/VikkiCard.tsx` — import + `IMAGE_SOURCE` entry + `imgSrc` guard
5. `src/modules/cards/components/card-banners/CardCTABanner.tsx` — `imageSource` branch
6. `src/modules/cards/components/layout/PrepaidCardLayoutV3.tsx` — nested branch + `useMemo` deps
7. `src/modules/vikki-go-card/screens/TransitCardCvpScreen.tsx` — nested branch (shadow image)
8. `src/modules/vikki-go-card/store/saga/vikki-go.saga.ts` — pass `productScheme` through navigate
9. `src/modules/vikki-go-card/vikki-go-card.navigation.tsx` — `productScheme` in ParamList

## Behaviour

- **Idempotent** — re-running with the same scheme is a no-op.
- **Atomic** — edits stay in memory; nothing is written unless all 9 steps succeed.
- **No binary assets generated** — the 3 `.webp` files are designer-provided. The
  tool registers them and **warns** if missing; drop them in and re-run (safe).
- **Formatting** — runs the host-app's own Prettier on changed files (falls back
  to the bundled one), so the diff matches the repo style.

## Publishing this repo

```bash
cd vikki-card-codegen
git init && git add . && git commit -m "feat: card scheme codemod"
gh repo create <your-org>/vikki-card-codegen --private --source=. --push
```

`node_modules/` is git-ignored; `ts-morph` is a declared dependency so consumers
get it automatically via `npx`/`npm install`.
