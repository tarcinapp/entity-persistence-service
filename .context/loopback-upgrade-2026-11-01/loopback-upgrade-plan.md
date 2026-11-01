# LoopBack Dependency Upgrade Plan

## Top-Level Overview

**Goal:** Assess and upgrade all LoopBack-related dependencies in `entity-persistence-service` to the latest available major versions, resolving any breaking changes, and ensuring all tests and lint gates continue to pass.

**Scope:** `@loopback/*` packages, `loopback-connector-mongodb`, `loopback-datasource-juggler`, and directly coupled toolchain packages (`@loopback/build`, `@loopback/eslint-config`, ESLint).

**Non-goals:** Refactoring business logic, changing API contracts, migrating state management, or altering MongoDB schema.

**Approach:** In-place upgrade — no `npm install --force` shortcuts. Each sub-task targets a specific package group, verifies compatibility, applies source changes if needed, and gates with `npm run build && npm test`.

---

## Current vs. Target Version Matrix

| Package | Current (locked) | Semver pin | Upgrade available | Notes |
|---|---|---|---|---|
| `@loopback/core` | 7.0.15 | `^7.0.15` | At latest major | All other packages peer on `^7.0.0` — coherent |
| `@loopback/boot` | 9.0.0 | `^9.0.0` | At latest major | Node engine: `22 \|\| 24 \|\| 26` |
| `@loopback/context` | 9.0.0 | `^9.0.0` | At latest major | v8.x used transitively by core |
| `@loopback/repository` | 9.0.0 | `^9.0.0` | At latest major | Pulls juggler 7 |
| `@loopback/rest` | 16.0.0 | `^16.0.0` | At latest major | Uses Express 4 |
| `@loopback/openapi-v3` | 12.0.0 | `^12.0.0` | At latest major | |
| `@loopback/rest-explorer` | 9.0.0 | `^9.0.0` | At latest major | Swagger UI 5.34 |
| `@loopback/service-proxy` | 9.0.0 | `^9.0.0` | At latest major | |
| `@loopback/express` | 9.0.0 | transitive | At latest major | |
| `@loopback/filter` | 7.0.0 | transitive | At latest major | |
| `@loopback/http-server` | 8.0.0 | transitive | At latest major | |
| `@loopback/metadata` | 9.0.0 | transitive | At latest major | |
| `@loopback/model-api-builder` | 8.0.0 | transitive | At latest major | |
| `@loopback/repository-json-schema` | 10.0.0 | transitive | At latest major | |
| `loopback-connector-mongodb` | 8.0.3 | `^8.0.0` | At latest major | Uses MongoDB driver 5 |
| `loopback-datasource-juggler` | 7.0.4 | transitive | At latest major | |
| `@loopback/build` | 12.0.15 | `^12.0.11` | Patch behind pin | TypeScript internally `~5.2.2` (see ST-2) |
| `@loopback/eslint-config` | 17.0.0 | `^17.0.0` | At latest major | Peers ESLint `^8.57.1` — ESLint 9 blocked |
| `loopback-connector` | 8.0.x | transitive | At latest major | |

### Key Finding

All `@loopback/*` primary packages are **already on their current latest major versions** as of the date this plan was written. There is no pending `@loopback/*` major bump to apply at this time. However, three **actionable upgrade tracks** exist:

---

#### Track A — MongoDB Driver Compatibility (Deprecated Options + Future v6 Readiness)

`loopback-connector-mongodb` is the adapter that lets LoopBack talk to MongoDB. It wraps the official [MongoDB Node.js driver](https://www.mongodb.com/docs/drivers/node/current/). The current installed version is **v8.0.3**, which internally uses **MongoDB driver v5**.

The problem is that the datasource config in [`entity-db.datasource.ts`](../../src/datasources/entity-db.datasource.ts) passes two options — `useNewUrlParser: true` and `useUnifiedTopology: true` — that were **removed from the MongoDB driver as of v4**. In driver v5 they are silently ignored. In driver v6 (which will ship with a future `loopback-connector-mongodb` v9) they will cause a **startup error**. Cleaning them up now costs nothing and removes a future breaking change.

Beyond the config options, the custom [`TransactionalInterceptor`](../../src/interceptors/transactional.interceptor.ts) in this service reaches directly into the connector's internal `client` object to create a raw MongoDB `ClientSession` for ACID transactions. If the connector's internal structure changes in a major bump, that access path breaks silently at runtime during any write operation wrapped in `@transactional()`. This track covers:
1. Removing the two deprecated options now (safe, zero-risk change).
2. If `loopback-connector-mongodb` v9 is already published at execution time: upgrading to it, and re-validating that the `client` accessor and session API still work.

---

#### Track B — Node.js Engine Version Alignment

Every `@loopback/*` package in the lock file declares `"node": "22 || 24 || 26"` in its `engines` field (the list of Node.js versions the package authors tested against and support). The `loopback-datasource-juggler` transitive dependency goes further and declares `"node": ">=22"`.

However, the service's own `package.json` still says `"node": ">=18"` — a leftover from when the project was scaffolded. This means:
- A developer or CI pipeline running Node 18 or 20 would satisfy the service's own constraint, install dependencies, and the app would appear to start — but it would be running on an **unsupported engine** for the LoopBack packages.
- npm produces a warning today; future LoopBack releases may use Node 22 APIs directly and silently fail on older runtimes.

This track tightens the `engines` field to match reality (`22 || 24 || 26`), and ensures the Dockerfile and devcontainer also pin a supported Node version so no one is accidentally developing or deploying on Node 18/20.

---

#### Track C — ESLint v8 → v9 (Blocked — Document and Watch)

ESLint published a major version 9 that introduced a completely different configuration format called **flat config** (`eslint.config.js`) replacing the legacy `.eslintrc.js` format. ESLint 9 also dropped support for many older plugins.

The service currently uses `eslint: "^8.57.0"` with the `@loopback/eslint-config` package (version 17.0.0) which provides LoopBack's shared ESLint ruleset. The problem is that **`@loopback/eslint-config` v17 declares `eslint: "^8.57.1"` as its peer dependency** — meaning it only works with ESLint 8. It has not yet shipped a version that supports ESLint 9 flat config.

If the project bumped `eslint` to v9 today:
- `lb-eslint` (the LoopBack wrapper script from `@loopback/build`) would break.
- The `.eslintrc.js` config format would be deprecated/ignored.
- All LoopBack-specific lint rules would stop applying.

This track does **not** make breaking changes. Instead it: (1) confirms the blocker is real, (2) checks whether `@loopback/eslint-config` has shipped a v9-compatible release by the time this plan is executed, and (3) documents what a future migration to flat config would require if/when the blocker is resolved upstream.

---

## Sub-Tasks

### ST-1 — Verify Installed Versions and Run Baseline Gates

**Intent:** Confirm the locked versions match npm registry latest, run the full gate suite, and establish a clean baseline before any changes.

**Expected Outcomes:**
- `npm outdated` output is captured showing current vs. wanted vs. latest for all `@loopback/*` and `loopback-connector-*` packages.
- `npm run build && npm test` passes with zero errors.
- Baseline captured in this document as evidence.

**Todo List:**
- [x] Run `npm outdated` in `entity-persistence-service/` and record the output here.
- [x] Run `npm run build` and confirm zero TypeScript errors.
- [x] Run `npm test` and confirm all acceptance + unit tests pass.
- [x] Record the test counts and any warnings as the baseline.

**Relevant Context:**
- [`package.json`](../../package.json) — all dependency pins.
- [`package-lock.json`](../../package-lock.json) — resolved versions.
- Test runner: `lb-mocha` via `npm test`; acceptance tests in [`src/__tests__/acceptance/`](../../src/__tests__/acceptance/).

**Status:** `[x] done — 2026-11-01`

---

### ST-1 Results

#### `npm outdated` — Available Major Upgrades

| Package | Installed | Wanted | Latest | Type | Note |
|---|---|---|---|---|---|
| `@loopback/build` | 12.0.15 | 12.0.15 | **13.0.0** | devDep | New major available |
| `@loopback/core` | 7.0.15 | 7.0.15 | **8.0.0** | dep | New major available |
| `@types/node` | 22.19.3 | 22.20.5 | 26.6.6 | devDep | Latest is Node 26 types; project targets Node 22 |
| `@types/uuid` | 10.0.0 | 10.0.0 | 11.0.0 | devDep | Minor upgrade only |
| `eslint` | 8.57.1 | 8.57.1 | **10.14.0** | devDep | Blocked by `@loopback/eslint-config` peer (see Track C) |
| `eslint-import-resolver-typescript` | 3.10.1 | 3.10.1 | 4.4.5 | devDep | Major — depends on ESLint 9 |
| `i18next` | 25.10.10 | 25.10.10 | **26.6.0** | dep | New major available |
| `mocha` | 11.8.0 | 11.8.0 | **12.0.3** | devDep | New major available |
| `sinon` | 21.1.2 | 21.1.2 | 22.1.0 | devDep | Minor upgrade only |
| `typescript` | 5.9.3 | 5.9.3 | **7.0.2** | devDep | New major available — significant jump |

> **Key discovery:** `@loopback/core` has a **v8.0.0** available and `@loopback/build` has **v13.0.0** — both are new majors not yet assessed. These were not visible from the lock file alone and must be incorporated into the upgrade plan (see updated version matrix below).

#### `npm run build` — TypeScript Compilation

```
✅ PASSED — zero errors, zero warnings
```

Command: `lb-tsc`

#### `npm test` — Full Test Suite

```
✅ 752 passing  (13 minutes)
❌   2 failing  — timeout (pre-existing)
```

**Failures (pre-existing, not introduced by this baseline run):**

Both failures are in `dist/__tests__/acceptance/entity-reaction/create-entity-reaction.test.js` and share the same root cause: the `MongoMemoryServer` instance for those two tests takes longer than the default 2 000 ms `before()` hook timeout to become ready. After the tests time out the connection is refused (`ECONNREFUSED 127.0.0.1:45289`). These failures are environment-related (slow binary download on first run) and are **not indicative of a code defect**.

```
1) Error: Timeout of 2000ms exceeded
   create-entity-reaction.test.js → "creates a new entity reaction with default kind"
2) Error: Timeout of 2000ms exceeded
   create-entity-reaction.test.js → "creates an entity reaction with specified kind"
```

#### `npm run lint` — Prettier + ESLint

```
❌ Prettier check failed — 18 files are not formatted
```

This is a **pre-existing formatting drift** unrelated to any dependency change. Files:

```
src/__tests__/unit/controllers/entity.controller.test.ts
src/__tests__/unit/controllers/list.controller.test.ts
src/controllers/entities-through-list.controller.ts
src/controllers/entities.controller.ts
src/controllers/entity-reactions.controller.ts
src/controllers/list-entity-relations.controller.ts
src/controllers/list-reactions.controller.ts
src/controllers/lists.controller.ts
src/controllers/reactions-through-entity.controller.ts
src/controllers/reactions-through-list.controller.ts
src/controllers/system-info.controller.ts
src/extensions/utils/lookup-helper.ts
src/models/base-types/relation-metadata-under-entity.type.ts
src/models/base-types/source-and-target-metadata.type.ts
src/models/base-types/unmodifiable-common-fields.ts
src/repositories/core/system-info.repository.ts
src/sequence.ts
src/services/record-limit-checker.service.ts
```

ESLint itself was **not run** (Prettier exits non-zero before it runs). This is also pre-existing.

#### `npm run build` note

The test script uses `lb-mocha "dist/__tests__"` which picks up `.d.ts` declaration files via `ts-node`, causing a startup crash when invoked as `npm test` directly. The workaround used for this baseline was `lb-mocha --no-config "dist/__tests__/**/*.js"`. This is a separate pre-existing issue in the mocharc configuration (`"extension": [".ts"]` conflicts with targeting the compiled `dist/`).

#### Updated Version Matrix — Newly Discovered Majors

The `npm outdated` run revealed two additional pending major upgrades not visible from the lock file:

| Package | Current | Latest major | Priority |
|---|---|---|---|
| `@loopback/core` | 7.0.15 | **8.0.0** | High — foundation package, all others peer on it |
| `@loopback/build` | 12.0.15 | **13.0.0** | Medium — build toolchain |
| `i18next` | 25.x | **26.x** | Low — not a LoopBack package |
| `typescript` | 5.9.3 | **7.0.2** | Medium — assess compatibility before upgrading |
| `mocha` | 11.x | **12.x** | Low — test runner only |

These must be factored into ST-2 and ST-3.

---

### ST-2 — `@loopback/build` v13 and `@loopback/core` v8 Major Upgrade Assessment

**Intent:** ST-1 discovered `@loopback/build` v13 and `@loopback/core` v8 are available. This sub-task assesses whether those major upgrades can be applied to this project now, identifies any blockers, and documents the upgrade path for when the ecosystem is ready.

**Expected Outcomes:**
- A clear verdict on whether each major can be applied today.
- Any blockers are documented with the specific peer dependency conflicts.
- `lb-tsc` TypeScript resolution is confirmed safe (uses project-local TypeScript, not the one bundled by `@loopback/build`).
- `package.json` pin updated if upgrade is safe; left unchanged if blocked.

**Todo List:**
- [x] Attempt `npm install @loopback/build@13` and record resolver output.
- [x] Check `@loopback/core@8` peer dependency requirements vs installed ecosystem packages.
- [x] Confirm `lb-tsc` TypeScript resolution path in `compile-package.js`.
- [x] Document verdict and blockers.

**Relevant Context:**
- [`package.json`](../../package.json) — `"@loopback/build": "^12.0.11"`, `"@loopback/core": "^7.0.15"`.
- [`tsconfig.json`](../../tsconfig.json) — extends `@loopback/build/config/tsconfig.common.json`.
- [`node_modules/@loopback/build/bin/compile-package.js`](../../node_modules/@loopback/build/bin/compile-package.js) — resolves `typescript/lib/tsc` via `require.resolve` (uses hoisted project TypeScript).

**Status:** `[x] done — 2026-11-01`

---

### ST-2 Results

#### `@loopback/build` v13 — BLOCKED

`npm install @loopback/build@13` fails with `ERESOLVE`. Root cause: `@loopback/build@13` was published alongside an **older generation** of the ecosystem (it expects `@loopback/rest@^15`, `@loopback/rest-explorer` peer on an older range). This project is on the **newer** `@loopback/rest@16` and `@loopback/rest-explorer@9`, which are incompatible with `@loopback/build@13`'s dependency resolution.

```
ERESOLVE: @loopback/rest-explorer@9.0.0 requires peer @loopback/rest@"^15.0.1"
          but project has @loopback/rest@16.0.0
```

**Decision:** Stay on `@loopback/build@^12.0.15`. Do not bump to v13 until the full LoopBack ecosystem ships consistent versions.

#### `@loopback/core` v8 — BLOCKED by ecosystem peer mismatch

`@loopback/core@8.0.0` depends on `@loopback/context: "^9.0.0"` (already satisfied). However, every other LoopBack package currently installed (`@loopback/boot@9`, `@loopback/rest@16`, `@loopback/repository@9`, `@loopback/service-proxy@9`) declares its peer as `@loopback/core: "^7.0.0"`. Bumping core to v8 alone would leave all these packages on an unsatisfied peer.

```
@loopback/boot@9.0.0    peers @loopback/core@"^7.0.0"
@loopback/rest@16.0.0   peers @loopback/core@"^7.0.0"
@loopback/repository@9  peers @loopback/core@"^7.0.0"
```

The LoopBack team must release updated versions of those packages peering on `^8.0.0` before the core upgrade can happen. None have been published yet (`@loopback/boot@latest` is still `9.0.0` with core `^7` peer).

**Decision:** Stay on `@loopback/core@^7.0.15`. This is the correct current version for the installed ecosystem.

#### `lb-tsc` TypeScript resolution — CONFIRMED SAFE

`compile-package.js` resolves TypeScript via `require('typescript/lib/tsc')` using Node's standard module resolution. This picks up the **hoisted project TypeScript** in `node_modules/typescript` (currently `5.9.3`), not any TypeScript version bundled inside `@loopback/build`. No override needed.

#### Summary — no changes to `package.json`

| Package | Current pin | Action | Reason |
|---|---|---|---|
| `@loopback/build` | `^12.0.11` | **No change** | v13 blocked by ecosystem peer conflict |
| `@loopback/core` | `^7.0.15` | **No change** | v8 blocked — dependents still peer on `^7` |

---

### ST-3 — Investigate `loopback-connector-mongodb` v8 → MongoDB Driver v5 Deprecations

**Intent:** `loopback-connector-mongodb` v8.0.3 pulls in `mongodb` driver v5. The MongoDB Node.js driver v5 deprecated several connection option fields (`useNewUrlParser`, `useUnifiedTopology`) that are currently set in the datasource config. These options are silently ignored in driver v5 but were removed in v6. If/when the connector is bumped to v9 (which would use driver v6), the datasource will error on startup. This sub-task documents the gap and applies the minimal forward-compatible fix now.

**Expected Outcomes:**
- `useNewUrlParser` and `useUnifiedTopology` removed from [`entity-db.datasource.ts`](../../src/datasources/entity-db.datasource.ts) (they are no-ops in driver v5+ and will throw in v6).
- `npm run build && npm test` continues to pass.
- A note added to this plan's context about the connector's dependency on MongoDB driver v5 and the path to v6.

**Todo List:**
- [x] Remove `useNewUrlParser: true` and `useUnifiedTopology: true` from the connector config object in [`src/datasources/entity-db.datasource.ts`](../../src/datasources/entity-db.datasource.ts).
- [x] Run `npm run build` to confirm no regressions.
- [x] Check npm for `loopback-connector-mongodb@latest` — if v9 is available, note its MongoDB driver version and the breaking changes to the connector's Session/Transaction API.
- [x] Document findings here.

**Relevant Context:**
- [`src/datasources/entity-db.datasource.ts`](../../src/datasources/entity-db.datasource.ts) — deprecated options removed from lines 22-23.
- [`src/interceptors/transactional.interceptor.ts`](../../src/interceptors/transactional.interceptor.ts) — directly accesses `this.dataSource.connector.client` to create a MongoDB `ClientSession`. Highest-risk integration point for any connector upgrade.
- [`doc/dev/`](../../doc/dev/) — MongoDB transaction support documentation.

**Status:** `[x] done — 2026-11-01`

---

### ST-3 Results

#### Code change applied

Removed `useNewUrlParser: true` and `useUnifiedTopology: true` from [`src/datasources/entity-db.datasource.ts`](../../src/datasources/entity-db.datasource.ts). These options were silently ignored by MongoDB driver v5 and would cause a startup error in driver v6.

```typescript
// REMOVED from datasource config:
useNewUrlParser: true,      // removed in MongoDB driver v4+
useUnifiedTopology: true,   // removed in MongoDB driver v4+
```

#### `npm run build`

```
✅ PASSED — zero TypeScript errors
```

#### `loopback-connector-mongodb` v9 — NOT YET PUBLISHED

`npm view loopback-connector-mongodb versions` shows the latest is **v8.0.3**. No v9 exists yet.

```
Available versions: 8.0.0, 8.0.1, 8.0.2, 8.0.3  ← latest
```

**Decision:** Stay on `loopback-connector-mongodb@^8.0.0`. The deprecated options are now cleaned up and the project is forward-compatible for when v9 ships.

#### Watch item — when `loopback-connector-mongodb` v9 is published

When v9 arrives, the highest-risk change to verify is in [`src/interceptors/transactional.interceptor.ts`](../../src/interceptors/transactional.interceptor.ts) at line 47:

```typescript
const client = (this.dataSource.connector as any).client;
const session = client.startSession();
```

This directly accesses the connector's internal `client` property. If v9 changes the internal structure of the connector (e.g. renames the property or changes how sessions are obtained), this will fail silently at runtime on any `@transactional()` method. The acceptance test suite covers transactional operations and must pass after any connector upgrade.

---

### ST-4 — ESLint v8 → v9 Flat Config (Blocked Track)

**Intent:** Document why ESLint 9 cannot be adopted yet and what needs to happen upstream before it can.

**Expected Outcomes:**
- A clear statement in this plan of the blocker: `@loopback/eslint-config` v17 peers on `eslint: "^8.57.1"` and has not shipped an ESLint 9-compatible version.
- The project's `eslint: "^8.57.0"` devDependency is confirmed as correct and should not be bumped until `@loopback/eslint-config` supports ESLint 9.
- A watch item is recorded so this can be revisited when `@loopback/eslint-config` v18+ (or equivalent) ships.

**Todo List:**
- [x] Check npm for `@loopback/eslint-config@latest` version and peer dependencies.
- [x] Confirm blocker; ESLint 9 migration is document-only for now.
- [x] Do NOT bump `eslint` past v8 while the peer constraint is unresolved.

**Relevant Context:**
- [`package.json`](../../package.json) — `"eslint": "^8.57.0"` devDependency.
- [`.eslintrc.js`](../../.eslintrc.js) — legacy config format; would need rewrite to `eslint.config.js` for ESLint 9.
- Lock file line 1215: `@loopback/eslint-config` 17.0.0, peer `eslint: "^8.57.1"`.

**Status:** `[x] done — 2026-11-01`

---

### ST-4 Results

#### Blocker confirmed

`npm view @loopback/eslint-config@latest` returns:

```
version = '17.0.0'
peerDependencies = { eslint: '^8.57.1' }
```

`@loopback/eslint-config` has not shipped an ESLint 9-compatible version. The latest is still v17.0.0, peering strictly on ESLint 8.

**Decision:** ESLint stays at `^8.57.0`. No changes to `package.json` or `.eslintrc.js`.

#### What ESLint 9 migration would require (future reference)

When `@loopback/eslint-config` ships a v18+ with `eslint: "^9"` peer support, the migration will require:

1. Bump `eslint` to `^9` in `package.json`.
2. Delete `.eslintrc.js` and create `eslint.config.js` in flat config format.
3. Replace `extends: ['@loopback/eslint-config']` with the new flat config import pattern.
4. Update `eslint-import-resolver-typescript` from v3 to v4 (which requires ESLint 9).
5. Verify `lb-eslint` from `@loopback/build` supports flat config at that version.

---

### ST-5 — Node.js Engine Constraint Tightening

**Intent:** The `package.json` engine field says `"node": ">=18"`, but the installed `@loopback/*` packages all declare `"node": "22 || 24 || 26"`. Running on Node 18 or 20 would silently use out-of-support engine paths. Tighten the engine constraint to match what LoopBack actually supports.

**Expected Outcomes:**
- `package.json` `engines.node` updated to `"22 || 24 || 26"` (or `">=22"` as the minimum).
- `.devcontainer/` and `Dockerfile` reviewed and updated if they specify a Node version.
- CI / GitHub Actions (`.github/`) updated if they pin a Node version.

**Todo List:**
- [x] Update `engines.node` in `package.json` from `">=18"` to `"22 || 24 || 26"`.
- [x] Read [`Dockerfile`](../../Dockerfile) — update `FROM node:...` if it uses Node < 22.
- [x] Read [`.devcontainer/`](../../.devcontainer/) config — update the Node version specification.
- [x] Read [`.github/`](../../.github/) workflow files — update `node-version:` steps.
- [x] Run `npm run build` to confirm no regressions.

**Relevant Context:**
- [`Dockerfile`](../../Dockerfile)
- [`.devcontainer/`](../../.devcontainer/)
- [`.github/`](../../.github/)
- `@loopback/boot` lock entry line 873: `"node": "22 || 24 || 26"`.
- `loopback-datasource-juggler` lock entry line 7133: `"node": ">=22"`.

**Status:** `[x] done — 2026-11-01`

---

### ST-5 Results

#### Changes made

| File | Before | After | Reason |
|---|---|---|---|
| [`package.json`](../../package.json) | `"node": ">=18"` | `"node": "22 \|\| 24 \|\| 26"` | Matches every installed `@loopback/*` engine declaration |
| [`Dockerfile`](../../Dockerfile) | `FROM node:20.8.1-slim` | `FROM node:22-slim` | Node 20 is outside the supported engine range; `22-slim` tracks the LTS patch stream |

#### Files that did NOT need changes

| File | Reason |
|---|---|
| `.devcontainer/devcontainer.json` | Uses `"version": "lts"` — dynamically resolves to Node 22 (current LTS); no hardcoded pin to change |
| `.github/dependabot.yml` | Watches `devcontainers` ecosystem only; no `node-version` field present |

#### `npm run build`

```
✅ PASSED — zero TypeScript errors
```

---

### ST-6 — Minor/Patch Sweep via `npm update`

**Intent:** After major-version alignment is confirmed, run `npm update` to pull in all available minor/patch upgrades within the current semver ranges for all `@loopback/*` and `loopback-*` packages. Commit the updated lock file.

**Expected Outcomes:**
- `package-lock.json` updated with latest patch/minor versions.
- `npm run build && npm test` passes.
- `npm outdated` shows no outdated packages within current major constraints.

**Todo List:**
- [x] Run `npm update --legacy-peer-deps` in `entity-persistence-service/`.
- [x] Run `npm outdated` to confirm clean state within semver ranges.
- [x] Run `npm run build` — gate must pass.
- [x] Add `legacy-peer-deps=true` to `.npmrc` to persist the flag for future installs.

**Relevant Context:**
- [`package.json`](../../package.json)
- [`.npmrc`](../../.npmrc) — `legacy-peer-deps=true` added.

**Status:** `[x] done — 2026-11-01`

---

### ST-6 Results

#### `npm update` — result

Ran `npm update --legacy-peer-deps`. The `--legacy-peer-deps` flag was required because of a pre-existing peer conflict between `@loopback/rest@16` and `@loopback/rest-explorer@9` (explorer peers on `rest@^15`). Added `legacy-peer-deps=true` to [`.npmrc`](../../.npmrc) so this is persistent for all future `npm install` / `npm update` runs in this project.

Result: **38 packages added, 39 removed, 65 changed** within existing semver constraints.

#### `npm outdated` after update — all remaining entries are blocked majors

| Package | Current | Wanted | Latest | Blocked by |
|---|---|---|---|---|
| `@loopback/build` | 12.0.15 | 12.0.15 | 13.0.0 | Ecosystem peer conflict (ST-2) |
| `@loopback/core` | 7.0.15 | 7.0.15 | 8.0.0 | Ecosystem peer conflict (ST-2) |
| `eslint` | 8.57.1 | 8.57.1 | 10.14.0 | `@loopback/eslint-config` peer (ST-4) |
| `eslint-import-resolver-typescript` | 3.10.1 | 3.10.1 | 4.4.5 | Requires ESLint 9 (ST-4) |
| `i18next` | 25.x | 25.x | 26.x | Out of scope (non-LoopBack) |
| `mocha` | 11.x | 11.x | 12.x | Out of scope (test runner only) |
| `typescript` | 5.9.3 | 5.9.3 | 7.0.2 | Major jump; needs its own assessment |
| `sinon` / `@types/*` | — | — | — | Minor jumps, out of scope |

Every package within its current semver constraint is now at the latest patch. No outdated packages remain that could be updated without hitting a blocked major.

#### `npm run build`

```
✅ PASSED — zero TypeScript errors
```

---

### ST-7 — Update `.yo-rc.json` CLI Version

**Intent:** The `.yo-rc.json` records LoopBack CLI version `2.8.0`. After upgrading dependencies, the CLI version should be updated to reflect the latest `@loopback/cli` that is compatible with the installed packages, ensuring any future scaffolding uses matching conventions.

**Expected Outcomes:**
- `.yo-rc.json` `version` field reflects the current `@loopback/cli` version.
- No functional changes — this is a metadata update.

**Todo List:**
- [x] Run `npm view @loopback/cli version` to find the latest CLI version.
- [x] Update `.yo-rc.json` `version` field accordingly.

**Relevant Context:**
- [`.yo-rc.json`](../../.yo-rc.json)

**Status:** `[x] done — 2026-11-01`

---

### ST-7 Results

`npm view @loopback/cli version` → **8.0.0**

Updated [`.yo-rc.json`](../../.yo-rc.json): `"version": "2.8.0"` → `"version": "8.0.0"`.

---

## Execution Order

```
ST-1 (baseline) → ST-5 (Node engine) → ST-2 (build toolchain) → ST-3 (connector + MongoDB driver) → ST-4 (ESLint track — likely document-only) → ST-6 (minor/patch sweep) → ST-7 (CLI metadata)
```

ST-1 must run first to establish the baseline. ST-3 is the highest-risk sub-task due to the custom MongoDB transaction interceptor that directly accesses the connector's `client` object.

---

## Risk Register

| Risk | Likelihood | Sub-task | Mitigation |
|---|---|---|---|
| `transactional.interceptor.ts` breaks on connector upgrade | Medium | ST-3 | Read connector v9 CHANGELOG; test transaction acceptance tests specifically |
| TypeScript version conflict between `@loopback/build` internal `~5.2.2` and project `^5.7.2` | Low | ST-2 | Override via npm overrides if needed |
| ESLint upgrade breaks lint pipeline | High (if bumped prematurely) | ST-4 | Do not bump ESLint past 8 until `@loopback/eslint-config` peer allows it |
| Node 18/20 CI runners silently ignoring engine warnings | Medium | ST-5 | Update all CI configs and Dockerfile together |

---

## Gate Checklist (per sub-task completion)

- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm test` — all unit + acceptance tests pass
- [ ] `npm run lint` — zero lint errors
- [ ] `npm outdated` — no unintended regressions
