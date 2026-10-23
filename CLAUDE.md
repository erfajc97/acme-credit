<!-- kit:block header v1 -->
# acme-credit — engineering rules

> Composed by claude-kit 0.1.3 from `.claude/kit.json`. Text between
> `<!-- kit:block … -->` markers belongs to the kit: `/kit:adopt --update` refreshes it and
> never touches anything else. The project's own rules live in `## Project rules` (IDs
> `P1, P2…`), which the kit never rewrites. Every agent reads `.claude/kit.json` first.

**Rigor: `full`.** After every finished task and before every commit the main agent runs `/kit:audit` (the whole audit chain) without being asked; milestones add judgment and senior. Every rule below is enforced.

| Scope | Kind | Stack | Path | Mode |
|---|---|---|---|---|
| api | api | nestjs | `apps/api` | enforce |
| network | api | nestjs | `apps/card-network` | enforce |
| web | web | astro | `apps/web` | enforce |
| admin | web | astro | `apps/admin` | enforce |

Modes: `enforce` — the rules apply and auditors block on findings; `report` — inherited
code: findings on code that already existed are listed as pre-existing and never block, new
code follows the rules; `off` — the kit ignores the scope.

- Requirements: `docs/challenge.md` (IDs look like `R-12`) ·
  checklist `docs/requirements-checklist.md`.
- Tracking: `docs/plan.md`, `docs/requirements-checklist.md` and the README "Progress (TODO)" list.
- Commits: the subject starts with `[ADD]`, `[FIX]`, `[STYLE]`, `[REFACTOR]`, `[TEST]`, `[DOCS]`, `[CHORE]` or `[PERF]`, then the task ID.
- Addons: money (MO), observability (OB). Brand: `docs/brand.md` — UI audits check colors, typography and voice against it.
- Mutation recipe: `.claude/kit/mutant/RECIPE.md`. Lessons learned: `docs/quality-standard.md`.
- Daily loop: task → `/kit:audit` (at the rigor above) → fixes → `/kit:phase-done` → the
  main agent commits.
<!-- /kit:block header -->

<!-- kit:block general v1 -->
## Rules — General (`G`)

Every rule is cited by ID in reviews and commits. Auditors check them with the command or
pattern given; "Grep" means the Grep tool (ripgrep syntax), never `grep` through a shell.

G1. **Plan before code.** Every task exists in `docs/plan.md` with its requirement ID
    (`R-12`), dependencies and acceptance criteria before code is
    written; a scope change is written there first. Why: work that is not in the plan is not
    audited against a requirement and drifts. Check: the task ID quoted by the builder and the
    commit appears in `docs/plan.md` (Grep the ID).

G2. **TDD.** Test first (red), minimum code (green), refactor. No logic file without its
    spec, and every acceptance criterion becomes an automated test. A bug fix brings a
    regression test that FAILS on the old code; a security or money fix also brings the
    attacker test (the exact request that exploits it) and the third-party-down test. A
    refactor without behaviour change runs the new spec against the OLD code first. The
    coverage gate (90 % lines and branches on logic folders) lives in each runner
    config and is never lowered to make a change pass. Why: "there are tests" is not
    evidence; a test that was never red proves nothing. Check: for every file added or
    changed under a logic folder (`services/`, `hooks/`, `helpers/`, `mutations/`,
    `*.service.*`, guards, validators, jobs) a spec exists — `git diff HEAD --name-only`,
    `git ls-files --others --exclude-standard`, then Glob the sibling `__tests__/` or
    `*.spec.*`/`*.test.*`; the runner exits 0 with the gate enabled.

G3. **Mutation check, not "there are tests".** Every new or changed rule is broken on
    purpose — invert a comparison, `>` → `>=`, delete a guard, return a constant, drop the
    tenant/owner filter, skip the transaction — and some test must fail. Mutants run in
    memory (the Vitest transform recipe in `.claude/kit/mutant/`, the default). Only the
    recipe's copy-and-restore fallback (Jest, or a runner without transforms) may write the
    mutant into the file, and only while no dev server, watcher or other agent reads it:
    backup first, restore in a `finally`; the source's sha256 is identical before and after. A
    mutation run only counts on a green baseline. A surviving mutant means the TEST is
    fixed (or the commit says why that mutant cannot be killed). Report `N/N killed`. The
    fake-test patterns `FT1…FT22` below are cited by number. Why: in the source projects
    half of the first mutants survived green suites. Check: the builder report has the
    `rule → mutant → killing test` table; `auditor-tests` re-runs a sample with
    `.claude/kit/mutant/mutant.mjs`.

G4. **No dead code.** No unused exports, commented-out code, unreachable branches,
    duplicated logic, or `TODO`/`FIXME` in added lines; a refactor deletes the old path in
    the same commit. Why: dead paths get "fixed" later and diverge from the live one.
    Check: `/kit:audit quick` flags commented-out code, TODOs and exports without importers;
    by hand, Grep the added lines (`git diff HEAD -U0`) for
    `^\+\s*//\s*(const|let|var|if|for|return|await|export|import|function|class)\b`.

G5. **Readable.** Names say what the data represents; a function that does not fit a
    screen (~50 lines) or nests more than 3 levels is split; more than 2 parameters → one
    object in, one object out. Comments explain WHY, never WHAT; a test says why the rule
    matters (the bug or the money it protects). Why: the next agent reads this cold.
    Check: read the touched functions; report file:line and the simpler shape.

G6. **Audit at the project's rigor — automatically.** This project runs at rigor
    **`full`**. After EVERY finished task and before EVERY commit, the main agent runs
    the audit of that level without being asked:

    | Rigor | After each task and before each commit | Milestones |
    |---|---|---|
    | `full` | `/kit:audit` — the whole `audit.chain` for the touched scopes | `auditor-judgment` + `auditor-senior` |
    | `standard` | `/kit:audit` — `rules` + `tests`; the rest of the chain on demand (`/kit:audit full`) | on demand |
    | `lite` | `/kit:audit quick` — architecture, secrets and dead code (`arch-check`, no agents) | none |

    In `lite`, the ENFORCED rules are the architecture rules of the scope blocks (layout,
    layers, imports — whatever `arch-check` checks), G9 (secrets) and G4 (dead code); every
    other rule is guidance, tests are written where cheap and G3 is skipped. In every
    level nothing is "done" with an open BLOCKER or HIGH, and after fixes only the failed
    audits re-run. With `"seal": true` the kit hook blocks `git commit` until the staged
    files match the seal of a PASS. Why: the author cannot see what the author missed.
    Check: the last audit verdict is PASS for the exact paths committed
    (`.claude/kit-seal.json` when the seal is on).

G7. **Git writes by the main agent only.** Builders and auditors never run `git add`,
    `commit`, `stash`, `checkout`, `restore`, `reset`, `rebase` or `push`. Commit message:
    the subject starts with `[ADD]`, `[FIX]`, `[STYLE]`, `[REFACTOR]`, `[TEST]`, `[DOCS]`, `[CHORE]` or `[PERF]`, then the task ID; the body says WHY, then a `Verified:` line (commands and counts) and
    `Mutation: N/N`, plus a `Deploy order:` line when a contract changes. The message goes
    in a file (`git commit -F <file>`); staging is its own command; `--no-verify` and
    `HUSKY=0` are forbidden. Why: several agents share one tree; one stray `checkout`
    destroys uncommitted work. Check: `git log -1 --format=%B` matches the format; agent
    reports contain no git writes.

G8. **Tracking.** When a task closes, update `docs/plan.md`, `docs/requirements-checklist.md` and the README "Progress (TODO)" list: the task status, the
    checklist row with its evidence (file:line, test name or command output) and
    the README "Progress (TODO)" list. Exactly one progress log is the source of truth. Why: progress kept
    from memory is wrong by the second day. Check: the closed task's ID is ticked in
    the README "Progress (TODO)" list and its checklist row has evidence, in the same commit.

G9. **Secrets.** Never in code, tests, fixtures, logs, docs, the client bundle or git.
    `.env` is git-ignored; every variable is declared in the env schema validated at boot
    (production fails closed without it), in `.env.example` with a placeholder, and in the
    env doc. Only public-prefixed variables reach a client bundle. Why: a leaked key is
    rotated, not deleted. Check: `/kit:audit quick` (tracked env files, provider keys,
    secret literals); `git ls-files '*.env' '*.env.*'` lists only `*.example` files.

G10. **Verify end to end.** Before saying "done": lint, typecheck, tests and build of every
     touched scope (the commands in `kit.json` → `commands.<scope>`), reading each EXIT
     CODE, not the summary; then the golden path in a real browser or device at the
     smallest supported viewport and at desktop. Why: green unit tests have shipped broken
     pages. Check: the builder report lists each command with its exit code
     (`<cmd>; echo "exit=$?"`).

G11. **Ambiguous or contradictory → ask, don't invent.** Write the question in
     the README "Progress (TODO)" list with a proposed option marked `(proposal)`; if it changes scope, data
     model, cost or security, ask the owner before building. `docs/challenge.md` wins
     over the checklist and the plan; report any discrepancy. Why: an invented requirement
     is a bug with good test coverage. Check: every `(proposal)` decision in the change is
     logged; no behaviour exists that no requirement or decision asks for.

G12. **One rule, one place.** A business rule (visibility, eligibility, a cap, a price
     calculation) lives in ONE function used by every door that applies it, including the
     one that charges; a rule both front and back need lives once in a shared package.
     "Twin doors": every DTO or form that receives the same field applies the same cap and
     normalization, pinned by a test that compares them; a cap shared by API and UI is one
     constant that the copy interpolates. Every business classification of an enum has a
     spec against the schema enum. Why: the second copy is the one that does not get the
     fix. Check: for each new/changed field, condition or number, Grep its name or literal
     across all scopes; two implementations is a finding.

G13. **Language.** Code, identifiers, comments, commits and docs in English. End-user copy
     (`en-US` by default) only through the i18n layer (`t('ns.key')`), never
     hard-coded — also `aria-label`, `placeholder`, `title`, toasts, emails, notifications
     and error copy; every key exists in every locale. Why: hard-coded copy cannot be
     translated or reviewed in one place. Check: Grep touched `.tsx`/`.astro`/`.vue` files
     for `>\s*[A-Za-zÁÉÍÓÚáéíóúñÑ¿¡][^<{}]*<` and
     `(aria-label|placeholder|title|alt)=["'][^"'{]+["']`; diff the key sets of the locale
     files.

G14. **Multi-agent hygiene.** Each agent touches only the paths of its task. Shared files
     (error catalog, i18n locales, DB schema, module registries, env schema) are edited
     surgically — append, never rewrite or reorder. Before creating a "new" file, Glob and
     `git ls-files` for it; search with the Grep tool. A batch's state lives in a file that
     is enough to resume after a cut; once a batch closes its scope is frozen (new findings
     go to the backlog, except a HIGH in security or money). Why: parallel agents silently
     overwrite each other. Check: `git diff HEAD --stat` of shared files shows additions
     only; no file outside the task's paths changed.

G15. **Quality standard.** Rules learned the hard way live in `docs/quality-standard.md`:
     each entry tells the real bug, the correct way, how it is enforced (rule ID, census or
     test) and cites the commit that taught it. The same defect found twice becomes an
     entry; auditors read the file before auditing. Why: fixes were applied to old code and
     the next feature repeated the mistake. Check: every entry has a commit hash
     (`git cat-file -t <hash>` → `commit`) and an enforcement line.

G16. **Censuses only shrink.** A mechanical check that needs the whole repo is a script
     `scripts/census-<name>.mjs` (read-only, never opens `.env`, no network) that exits 1 on
     any NEW occurrence. Pre-existing occurrences sit in its `BASELINE` list, each with a
     reason; an entry that no longer occurs also fails, so the baseline only shrinks. Each
     census has a `node --test` spec with synthetic cases that must bite. A rule that is a
     layout, import or naming rule goes to `.claude/kit-structure/*.structure.json` instead,
     so `/kit:audit quick` checks it. Why: a rule that only lives in prose is broken by the
     next feature. Check: run every `scripts/census-*.mjs` and read the exit code.

G17. **No invisible control characters.** No raw bidi controls, zero-width spaces or
     direction marks in any text file (code, specs, docs, JSON, YAML); code that needs one
     builds it with `String.fromCodePoint`. Why: the text reads differently from what it
     executes ("trojan source"). Check: `/kit:audit quick`; by hand, Grep
     `[\x{202A}-\x{202E}\x{2066}-\x{2069}\x{200B}\x{200E}\x{200F}]` → zero hits.

G18. **No silent failure.** Every `catch` handles the error, reports it, or says in a
     comment why neither applies; no empty `catch {}`, no `except: pass`, no promise left
     floating (`void promise()` without `.catch`). Why: a swallowed error turns an outage
     into a support ticket. Check: Grep added lines for
     `catch\s*(\(\w*\))?\s*\{\s*\}`, `\.catch\(\(\)\s*=>\s*(\{\s*\}|undefined|null)\)`,
     `except(\s+\w+)?:\s*pass` and `\bvoid\s+\w+\(`.

G19. **pnpm, locked down (supply chain).** Every JavaScript package installs with pnpm
     ≥ 10.26 (the first version that reads `allowBuilds`, the only build allowlist pnpm 11
     and later still read). The root `package.json` pins it exactly in `packageManager`
     (`"pnpm@<x.y.z>"`) and every machine and CI job runs that version: pnpm switches to
     the pin by itself (`pmOnFail: download`, the default from pnpm 11), or Corepack does
     (`corepack enable`; bundled with Node.js only before 25, `npm i -g corepack` after).
     `pnpm-lock.yaml` is committed and CI installs with `pnpm install --frozen-lockfile`.
     Nobody runs `npm install` or `yarn` here: no `package-lock.json` or `yarn.lock` exists.
     Supply-chain settings live in `pnpm-workspace.yaml` (from pnpm 11, `.npmrc` holds only
     auth and registry settings and the rest of it is ignored). Dependency lifecycle scripts
     never run unless allowed (blocked by default since pnpm 10.0): each package that needs
     its build script is listed `true` in `allowBuilds` (`pnpm approve-builds`, since 10.1,
     writes it; `onlyBuiltDependencies` is its pre-10.26 spelling, removed in pnpm 11) with a
     comment saying why, after someone read that script; `strictDepBuilds: true` (the
     default only from pnpm 11) makes an unreviewed build fail the install;
     `dangerouslyAllowAllBuilds` is never set. `minimumReleaseAge: 1440` (minutes; since
     pnpm 10.16, where it defaults to 0; setting it explicitly also makes pnpm 11 strict
     about it) keeps versions younger than a day out — the window in which most malicious
     releases are found and pulled; an exception goes in `minimumReleaseAgeExclude` with a
     reason. CI runs `pnpm audit --prod`; an accepted advisory is ignored by its GHSA id with
     a reason. The isolated `node_modules` layout stays (the default `nodeLinker`), so code
     cannot import a package it does not declare; `publicHoistPattern` lists only tooling
     binaries that must resolve from the root (`*eslint*`, `*prettier*`), never runtime
     libraries. Expo supports isolated installs from SDK 54: `nodeLinker: hoisted` only when
     a native library is proven to break without it, scoped to that app (with the default
     shared lockfile the linker applies to the whole workspace, so that app gets its own
     lockfile) and recorded in an ADR naming the library and the error. Why: npm runs every
     dependency's install scripts by default and its flat `node_modules` lets code use
     packages it never declared; a hijacked release does its damage in the hours after it
     is published. Check: `node -p "require('./package.json').packageManager"` prints
     `pnpm@` plus an exact version; `git ls-files pnpm-lock.yaml` → 1 line and
     `git ls-files '*package-lock.json' '*yarn.lock'` → none; Grep the CI workflows for
     `pnpm (i|install)\b` and confirm `--frozen-lockfile` on every hit, and for
     `pnpm audit --prod` → present; Grep `pnpm-workspace.yaml` for `allowBuilds:` and
     `minimumReleaseAge:` → present, and for
     `dangerouslyAllowAllBuilds:\s*true|onlyBuiltDependencies|nodeLinker:\s*hoisted` → none
     (or the ADR exists); Grep `.npmrc` for
     `hoist|node-linker|built-dependencies|release-age` → none; Grep scripts, Dockerfiles, CI
     and docs for `\bnpm (install|i|ci)\b|\byarn (install|add)\b` → none.

G20. **One command to boot and one to test, on any OS.** The root `package.json` scripts
     are the interface every person, agent and doc uses: `docker:up` (build and boot the
     whole stack, migrated and seeded, and wait until it is healthy), `docker:down` (stop,
     keep data), `docker:reset` (wipe volumes and boot again), `test:<scope>` for each
     scope (its lint, format check, typecheck and tests; a Python scope calls `uv run …`),
     `test:web` (the same over every web package), `e2e` and `e2e:install`. Booting differs
     per OS, so `docker:up` runs a node dispatcher (`scripts/up.mjs`) that starts
     `scripts/up.ps1` on Windows and `scripts/up.sh` elsewhere: the boot logic lives once
     per shell, and it creates `.env` from `.env.example` on the first run. E2E base URLs are
     built from the ports in `.env`, never hard-coded. `make` targets, when the repo has a
     Makefile, call these scripts or the same boot script and never repeat their logic. The
     README "Quick start" and "Testing" sections give exactly these commands, each of which
     runs unchanged in PowerShell and in sh (a `pnpm <script>` line, never `export`,
     `./x.sh` or a shell-only chain as the only way). Why: a stack that boots one way on the
     author's machine is a stack a reviewer on Windows cannot run, and two copies of the
     boot logic drift apart. Check:
     `node -p "Object.keys(require('./package.json').scripts).join(' ')"` lists `docker:up`,
     `docker:down`, `docker:reset`, `test:web`, `e2e`, `e2e:install` and a `test:<scope>` per
     scope; Grep the README for `pnpm docker:up` and `pnpm e2e` → present
     under "Quick start" and "Testing"; Grep the E2E config and support files for
     `https?://(localhost|127\.0\.0\.1):\d+` → none.

### Fake-test patterns (`FT`)

The ONE list. Auditors walk it entirely over the specs of a change and cite `FT<n>`. A new
pattern is appended at the end, never renumbered.

FT1. **One-sided boundary.** The limit is tested only on the failing side; the last value
     that PASSES is untested, so `> MAX` mutated to `>= MAX` stays green (also tolerances).

FT2. **Always-true assertion.** `toBeTruthy()` on an object, `toBeLessThanOrEqual(999)`, a
     spy "was called" as the only proof.

FT3. **Generic rejection.** `rejects.toThrow()`, `rejects.toBeTruthy()` or
     `raises(Exception)` that also accepts a TypeError or a 500 — assert the error code
     (`rejects.toMatchObject({ code })`).

FT4. **Invalid base body.** "Rejects X" with a body that was already invalid for another
     reason; one case proves the base body passes and the error is asserted on THAT field.

FT5. **Coinciding fixtures.** Fields or sources share values; every field gets a unique
     value, two tenants get different data, and each switch is flipped one at a time.

FT6. **Doubles that lie.** A database double that ignores the `where`, does not throw on
     what it does not understand, or lacks the unique/partial indexes of the migration;
     data rules are tested against the real database.

FT7. **Clock or timezone dependence.** Time not fixed (fake timers) or timezone not
     pinned (`TZ` explicit, or dates built in local time).

FT8. **Mocks that render `null`.** Every stub renders its `data-testid`.

FT9. **Invalidation by literal key.** Cache invalidation asserted by a literal key or by
     the call instead of its effect — use the exported `*_KEY` and assert the query is
     invalidated with the real key shape (paginated if the query is).

FT10. **Not really mounted.** The test passes without mounting or hydrating; assert what
      the user sees (roles, labels, text), and hydration specs hydrate
      (`renderToString` + `hydrateRoot` with `onRecoverableError`, zero recoverable errors).

FT11. **No empty and no foreign case.** No case for the empty state (null user, empty list,
      absent optional field — one per guard) and, in multi-tenant code, no other-tenant case.

FT12. **Snapshot as the only assertion.** A large snapshot proves the output did not
      change, not that it is right.

FT13. **Rounding-blind fixtures.** Values where round, floor and trunc agree (0.633) or that
      do not move; pick a third decimal ≥ 5 to pin the rounding direction.

FT14. **Unused overrides.** A test helper declares an overrides parameter and never applies it.

FT15. **Orphaned tests.** "Coverage missing on purpose" comments, or tests left without an
      object after a behaviour change; rewrite them for today's behaviour or delete them
      saying why.

FT16. **Upstream normalization.** A `Math.ceil`, clamp, trim or lowercase upstream already
      does what the test believes it verifies.

FT17. **Validation without production metadata.** The validation spec builds its own
      schema or pipe; use the real DTO from its file through the production validation pipe.

FT18. **Invented error shapes.** Errors or states simulated in a shape the library never
      produces; copy the shape from the library's source.

FT19. **Order-dependent checks.** Two checks whose order matters, with no case that
      satisfies both.

FT20. **Allowlist by absence.** An allowlist tested with "does not contain X"; assert the
      EXACT key set.

FT21. **Impossible input.** An input the real component never delivers; test it as it
      arrives — keystroke by keystroke, pasted, prefilled.

FT22. **Fake contract.** A double of a contract nobody meets (a fake analytics global, a
      stubbed toaster); integrations are tested with the REAL library and real providers.

### Definition of done

A task is done when: its acceptance criteria are automated tests that a mutant fails (G2,
G3; in `lite`, tests where cheap); lint, typecheck, tests and build are green for every
touched scope (G10); the audit of the project's rigor has no open BLOCKER or HIGH (G6); no
hard-coded UI copy (G13); the golden path works at the smallest viewport and at desktop
(G10); and the tracking docs are updated in the same commit (G8).
<!-- /kit:block general -->

<!-- kit:block api-common v1 -->
## Rules — API, any backend stack (`A`)

A1. **Feature modules with layers.** Each domain is one module (feature slice) under
    `apps/api` (api), `apps/card-network` (network): controller/router = HTTP only (parse, access marker, call the
    service, map to the response DTO, status code); service = business rules and the
    transaction boundary; repository = data access only (returns rows, never raises HTTP
    errors), created when queries are not trivial; DTOs = request and response as SEPARATE
    types. Cross-cutting code lives in `core/` (config, database, errors, http, auth,
    storage, queue, logging) and `core/` never imports a module; a module never imports
    another module's repository. A layer file exists only when the module needs it.
    Why: the folder tree says what the system does and a change stays inside one slice.
    Check: an architecture test in the suite walks imports and fails on `core → module`,
    `controller → repository` and cross-module repository imports; spot-check with Grep
    for `modules/` or `features/` imports under `core/`.
A2. **No SQL in strings.** Queries go through the ORM / query builder or parameterized
    tagged templates. No string concatenation or interpolation into SQL, no unsafe raw
    APIs, no SQL built from user text. Migrations use the migration tool's DDL.
    Why: one interpolated fragment is an injection. Check: lint bans the unsafe APIs;
    Grep `\$queryRawUnsafe|\$executeRawUnsafe|Prisma\.raw\(|sqlalchemy\.text\(|execute\(f["']|(SELECT|INSERT|UPDATE|DELETE) .*\$\{`
    in changed files → none.
A3. **Strict, validated DTOs with shared limits.** Every body, query and param is a DTO:
    unknown keys rejected (strict / forbid extra); body booleans and numbers are NOT
    coerced (`"false"` is not `true`, `""` is not `0`); every string trimmed, minimum
    measured after trim, and capped with the SAME constant as its DB column (one limits
    module); every array has a max length; numbers have min/max; enums validated;
    pagination has a floor and a ceiling (`page ≥ 1`, `1 ≤ limit ≤ 100`) and a stable
    sort from an allowlist. Twin doors reuse the same field definition (G12). Why: the DTO
    is the attack surface, and a cap that differs from the column turns into a 500.
    Check: Grep `z\.string\(\)|@IsString\(\)|: str\b` in DTO files and confirm each hit
    carries its cap (`.max(`, `@MaxLength`, `max_length`); each DTO has a test where the
    base body passes, then the last passing and the first failing value of each cap (FT1,
    FT4).
A4. **No mass assignment; PATCH validates the merged state.** DTO → persistence fields
    are mapped one by one; never spread a request body into a write. A partial update
    loads the stored row, merges (`{ ...stored, ...patch }`), validates the MERGED state
    against the business rules and writes explicit values; "not sent" (`undefined`) keeps
    the stored value, `null` clears it. A new field appears in every create/update mapping
    with a test that reads it back. Prices, totals and ownership are derived server-side,
    never taken from the client. Why: a spread lets clients write columns they must not,
    and validating only the patch lets invalid combinations through. Check: Grep
    `data:\s*\{\s*\.\.\.(dto|body|input|payload)|\*\*(dto|payload|body)\.(model_)?dump\(|Object\.assign\([^,]+,\s*(dto|body)`
    → none.
A5. **Responses are allowlists.** Every response is mapped to a response DTO or an
    explicit field selection: never the raw entity (no password hashes, tokens, internal
    flags, other owners' ids). Private responses are never stored by shared caches
    (`Cache-Control: private, no-store`; never `s-maxage` on private data). A GET never
    changes state. Why: returning the entity leaks every column added later. Check: Grep
    handlers/services returning ORM results without a select/mapper; Grep `s-maxage` on
    authenticated routes; Grep GET handlers that call write methods; integration tests
    assert the EXACT response key set (FT20).
A6. **Money is never float; time has types.** Amounts are fixed-point decimals end to end
    (DB `NUMERIC`/`Decimal(p,s)`, a decimal type in code, a decimal string in JSON) with a
    currency; never float arithmetic; round once, at the end. Instants are `timestamptz`
    (UTC), business dates are `date`; the business time zone comes from configuration.
    Payments, idempotency and money locks follow `addon-money` (`MO`) when it is enabled.
    Why: `0.1 + 0.2` and naive timestamps are silent data corruption. Check: Grep money
    columns typed `Float|Double|REAL|float` and `parseFloat\(|Number\(` / `float\(` on
    amount fields → none.
A7. **One error envelope, one code catalog.** Services raise a domain error with a code
    from ONE catalog; one global handler turns every error (domain, framework, validation,
    DB constraint, unexpected) into the same envelope with at least `code`, `message`,
    `details?` and `requestId`. Business errors carry no free-text message (ids go in
    `details`); clients branch on `code`, never on `message`. No stack traces or internals
    leak; an unexpected error is logged once with its request id and answered as a generic
    500 code (no silent failure: G18). A missing resource, or one that belongs to someone
    else, is 404 (never 403: do not reveal existence). "Not confirmed / pending" is never
    a 2xx. A new code is added to the catalog first, then its copy in every locale, then a
    test asserting the code (`rejects.toMatchObject({ code })` / `exc.value.code ==`, FT3).
    Why: one shape lets every client translate and handle errors; free text cannot be
    localized or matched. Check: Grep framework exceptions thrown outside the handler
    (`new (BadRequest|NotFound|Forbidden|Unauthorized|Conflict)Exception\(`,
    `raise HTTPException\(`) → none; a test proves every catalog code has copy in every
    locale.
A8. **One config module, validated at boot.** The env schema G9 requires is parsed ONCE,
    at startup, by the config module, which is the only reader of `process.env` /
    `os.environ`; services receive typed settings. Production refuses to start on a
    missing secret OR a development default; development shortcuts additionally require a
    non-production environment. Error messages name the keys, never the values. Why: a
    missing secret must stop the deploy, not the first request. Check: Grep
    `process\.env\.|os\.environ|os\.getenv` outside the config module (seeds and scripts
    aside) → none; a test boots with a production env missing a secret and expects a
    non-zero exit.
A9. **Third-party I/O behind a port, with timeouts.** Every external call (HTTP APIs,
    storage, mail, SMS, payments, LLMs) goes through an interface with an adapter; only
    the adapter imports the vendor SDK; every call has a timeout (`AbortSignal.timeout`,
    client timeout, or a `withTimeout` wrapper for clients without signals) and maps
    failures to catalog codes; tests swap the adapter for a fake, never patch internals.
    A URL chosen by a user is never fetched without an allowlist (SSRF). A timeout or 5xx
    is "unknown", not "no": it is never treated as a failure that can be refunded or
    retried blindly. Why: a hung vendor must not hang the API, and a test must not depend
    on the network. Check: Grep `fetch\(|axios\.|httpx\.|requests\.` and vendor SDK imports
    outside adapter folders → none; each adapter call has a timeout.
A10. **Background work off the request.** Anything that can take more than a few seconds
    (AI, imports, exports, bulk e-mail/SMS/push, reports, reminders) runs in a queue or
    background task: the request returns 202 with a status resource. Jobs are idempotent
    (deterministic job id), retried with backoff, and their final failure is reported.
    Queue and cache connections are lazy (never opened at import time), with no reconnect
    loops and no polling without a stop condition. Why: proxies cut long requests and the
    client retries, doing the work twice; eager connections burn paid resources. Check:
    Grep `new (Redis|Queue|Worker)\(` and confirm none runs at module top level; Grep
    `setInterval\(` and confirm each has a stop condition; job ids are derived from the
    payload.
A11. **Hand-written migrations with constraints and indexes.** Migrations are reviewed
    DDL written or edited by hand, never applied by an interactive/auto tool against a
    shared database (`prisma migrate dev`, `prisma db push`, unreviewed autogenerate).
    They are additive (expand → backfill verified → contract), carry their constraints
    (`NOT NULL`, `CHECK`, `UNIQUE` incl. partial, FK with an explicit `ON DELETE`) and an
    index for every column used in a filter, sort or join. Once applied anywhere shared, a
    migration is never edited: changes are new migrations, timestamped with the real time
    and ordered after the last one. A drift test proves migrations build exactly the
    declared schema. Why: auto tools propose dropping what only lives in SQL (partial
    indexes, CHECKs). Check: Grep docs, scripts and package files for `migrate dev|db push`
    → none; the drift test passes; every new filter/sort column has an index in the
    migration.
A12. **HTTP security baseline.** Security headers (helmet or equivalent); JSON body
    ≤ 1 MB (uploads have their own limits); CORS from an env allowlist (never `*` with
    credentials) with every custom header listed; a global rate limit plus stricter limits
    on auth, OTP, password reset, public forms and every endpoint that costs money
    (paid third parties, presigned uploads, e-mail/SMS); passwords hashed with Argon2id
    (or bcrypt); tokens never in URLs (except hashed single-use links); `JSON.parse` of
    external input in try/catch and validated after; no regex built from user text;
    objects from users never merged without filtering `__proto__`/`constructor`; webhooks
    verify the signature and process only what it covers; no PII, tokens or secrets in
    logs, analytics or error reports. Why: these are the holes every audit finds first.
    Check: Grep the bootstrap for headers, body limit, CORS and throttler; Grep
    `new RegExp\(`, `JSON\.parse\(`, `[?&](token|access_token|id_token)=` in changed files.
A13. **Uploads are capped and verified.** Files go to private storage through the storage
    port: the server builds the key (`<owner>/<kind>/<uuid>`), enforces a MIME allowlist
    (never SVG or HTML), a size cap in the signed policy or the multipart limits (plus
    file count and text-field caps), and sniffs the real type from magic bytes after
    upload; downloads use short-lived signed URLs (≤ 5 min) with `attachment`. A file or
    image URL sent by a client is accepted only if it points to our storage and belongs to
    that owner and resource; the server re-derives the key. Why: upload endpoints are the
    cheapest path to stored XSS and storage abuse. Check: Grep upload handlers for the
    MIME allowlist, size limits and magic-byte check; an integration test uploads a
    renamed SVG and an oversized file → rejected with their codes.
A14. **Access is explicit and default-deny.** Every route declares exactly one access
    marker (public, authenticated, role/permission, …); a route without one is denied at
    runtime AND fails a route-discovery test in CI. Ownership is checked in the service
    query (`where owner = …`), not after loading. Why: a forgotten decorator must break
    the build, not expose data. Check: the route-discovery test lists 0 unmarked and 0
    double-marked routes; Grep new public markers and justify each.
A15. **Structured logs with a request id.** Logs are structured (JSON in containers);
    every request gets one id (accepted from `X-Request-ID` or generated), returned in the
    `X-Request-ID` response header and in every error envelope, and propagated to jobs it
    enqueues; logs carry ids and enums, never PII, tokens or secrets (a redaction list
    covers auth headers, cookies, passwords). Why: one id joins the user's report, the log
    and the trace. Check: Grep `console\.log|print\(` in source → none; an integration
    test asserts the header and the envelope share the id.
A16. **Strict typing.** TypeScript `strict: true` with lint `no-explicit-any`, or Python
    `mypy --strict`; `any` / `Any` only at true boundaries with a comment saying why; no
    `@ts-ignore` / `type: ignore` without a reason. Why: types are the cheapest test.
    Check: `pnpm --filter @acme/api typecheck` (api), `pnpm --filter @acme/card-network typecheck` (network) exits 0; Grep `as any|: any\b|@ts-ignore|# type: ignore$`
    in changed files.
A17. **Unit and integration tests, errors by code.** Services are unit-tested with
    hand-written fakes; data rules (filters, uniqueness, constraints, locks, ownership)
    are tested against a real database (container or throwaway database), never a DB
    double (FT6). Each endpoint's integration test covers the happy path, a validation
    failure with a base body that passes first (FT4), an access denial and a 404 for a
    missing or foreign resource. Errors are asserted by `code` (FT3). Why: a double that
    ignores `where` passes every wrong query. Check: every new route appears in an
    integration spec; Grep tests asserting `message` text → none.
A18. **Backward-compatible contract.** Contract changes are additive or versioned. A
    hardened endpoint keeps accepting (and ignoring, with a cap) what published clients
    still send, and answers with codes old clients already handle; a new required request
    field ships API-first. When a change affects the contract, the commit body states the
    deploy order (API before clients, G7). A generated API spec or client, when the
    project has one, is regenerated and committed in the same change. Why: clients and
    API are never deployed at the same instant. Check: diff of the API spec; commit body
    names the deploy order when request/response shapes changed.
A19. **Tooling green with a coverage gate.** `pnpm --filter @acme/api lint` (api), `pnpm --filter @acme/card-network lint` (network),
    `pnpm --filter @acme/api typecheck` (api), `pnpm --filter @acme/card-network typecheck` (network), `pnpm --filter @acme/api test` (api), `pnpm --filter @acme/card-network test` (network), the integration suite and
    `pnpm --filter @acme/api build` (api), `pnpm --filter @acme/card-network build` (network) exit 0 (G10). The G2 coverage gate covers the API's core and
    modules (generated code, module wiring and DTO declarations excluded), enforced by the
    runner config so CI fails below it. Why: a gate in config cannot be
    forgotten. Check: run each command and read its exit code; the thresholds live in the
    runner config.

A20. **A third party with no SLA on a critical path is hedged.** When a request a user is
    waiting on depends on a provider without an SLA (a public geocoder, a free search or
    lookup API), its A9 adapter is a hedge behind the same port: the primary searches
    alone for a short delay (from configuration); if it is late, fails or answers empty, a
    backup provider is asked as well. The first answer WITH results wins; the loser is
    cancelled AND awaited, so no task, connection or log line outlives the request; the
    whole search keeps ONE overall deadline. Only the primary's own non-empty answers are
    cached: a backup's answer or an empty answer may come from an outage and would be served
    for the whole TTL after the provider recovers. Both answering empty (or the primary
    empty and the backup failing) is "no results"; the primary failing with the backup
    empty, both failing, or the deadline passing is the catalog's `unavailable` code (A7),
    never "no results". The client shows that state with a retry and never silently
    degrades to unvalidated free text (W18). Why: waiting for the primary's timeout before
    asking a backup makes every slow request slower, and an outage reported or cached as
    "nothing found" lies to users long after it ends. Check: the hedge's tests cover a slow
    primary (the backup's answer wins), an empty primary, a failing primary with an empty
    backup (→ `unavailable`), both failing, the deadline, and the loser's cancellation with
    no task left pending afterwards (Python: `asyncio.all_tasks()` holds only the test's
    own; Node: the loser's `AbortSignal` fired); the cache test proves a backup answer and
    an empty answer are not stored.
<!-- /kit:block api-common -->

<!-- kit:block api-nestjs v1 -->
## Rules — NestJS + Prisma (`AN`)

AN1. **Module layout; `core` never imports a module.** `apps/api` (api), `apps/card-network` (network) follows:
    ```
    src/
      main.ts  app.module.ts          (worker.ts  worker.module.ts when there are jobs)
      core/                           config/ database/ errors/ auth/ http/ queue/ storage/ observability/
      modules/<domain>/
        <domain>.module.ts  <domain>.controller.ts  <domain>.service.ts
        <domain>.repository.ts        (only for non-trivial queries)
        dto/  jobs/  helpers/  __tests__/
    test/integration/<domain>.int-spec.ts
    prisma/schema.prisma  prisma/migrations/  prisma/seed.ts
    ```
    Controllers are thin: no `PrismaService`, no transactions, no business branching.
    Why: the layout is what A1 means in Nest terms. Check: Grep
    `from ['"](\.\./)+modules/` in `src/core` → none; Grep `PrismaService|\$transaction`
    in `*.controller.ts` → none.
AN2. **DTOs with `nestjs-zod`.** Default nestjs-zod: `class CreateXDto
    extends createZodDto(createXSchema) {}` with `.strict()` schemas whose caps come from
    the shared limits module (shared with the front-end when both validate the field),
    and a global `ZodValidationPipe` (`APP_PIPE`). Projects that already use
    class-validator keep it: global `ValidationPipe({ whitelist: true,
    forbidNonWhitelisted: true, transform: true })`, every body and query is a class from
    a `*.dto.ts` imported as a VALUE (an `import type` erases the class and silently
    disables validation), nested objects use `@ValidateNested()` + `@Type()`, every string
    has `@MaxLength(LIMIT)`, arrays `@ArrayMaxSize`, numbers `@Min`/`@Max`, and body
    booleans/numbers are not implicitly converted. Never `@Body() body: any`,
    `@Body('field')`, `@Query('field')` or inline object types. Why: the pipe only
    validates what it can see as a DTO class. Check: Grep in `*.controller.ts`
    `@Body\(\)\s+\w+:\s*(any|Record|\{)|@Body\(['"]|@Query\(['"]|import type .*Dto` → none.
AN3. **`AppHttpException` and one global filter.** Business errors are
    `throw new AppHttpException('KEY', details?)` with `KEY` from the error catalog; never
    `new BadRequestException('text')` and friends (lint `no-restricted-syntax` on
    `NewExpression[callee.name=/^(BadRequest|NotFound|Forbidden|Unauthorized|Conflict)Exception$/]`).
    One `@Catch()` filter (`APP_FILTER`) maps `AppHttpException`, framework
    `HttpException`, validation errors, Prisma known errors (detected by `name` + `code`:
    `P2002` → conflict code, `P2025` → not-found code, `P2000` → validation code) and
    unknown errors (500, logged once, reported) into the A7 envelope with `requestId`.
    Why: one place decides status, code and redaction. Check: the lint rule is configured;
    Grep `new (BadRequest|NotFound|Forbidden|Unauthorized|Conflict|InternalServerError)Exception\(`
    in `src/` outside specs → none.
AN4. **`PrismaService` with explicit `select`.** App code injects `PrismaService`;
    `new PrismaClient()` exists only in seed, scripts and the test harness (lint
    `NewExpression[callee.name='PrismaClient']`). Every query whose result leaves the
    service uses `select` (no bare `include`, never `passwordHash` or tokens). Lists use
    `skip`/`take` from the pagination DTO and an `orderBy` with a unique tiebreaker
    (`[{ createdAt: 'asc' }, { id: 'asc' }]`). No queries inside loops: batch with
    `where: { id: { in: ids } }` or a nested `select`. Why: whole models leak columns and
    loops are N+1. Check: Grep `new PrismaClient\(` under `src/` → none; Grep `include:` and
    `find(Many|Unique|First)\(\{` in services and confirm a `select`; Grep multiline
    `for \([^)]*\) \{[\s\S]{0,300}?await this\.prisma` → none.
AN5. **Transactions.** Writes that touch more than one table or row set run in
    `prisma.$transaction`: interactive (`async (tx) => …`) when logic sits between
    statements; statements awaited one after another (never `Promise.all` over `tx`);
    what decides is read INSIDE the transaction; `tx` is passed explicitly to helpers; no
    try/catch that continues after a failed statement (the transaction is already
    aborted: 25P02); no external side effects inside (mail, queue jobs, analytics, HTTP):
    they run after commit. Why: half-written state and side effects of a rolled-back
    transaction are the classic data bugs. Check: Grep multiline
    `\$transaction\([\s\S]{0,1500}?(Promise\.all|sendMail|\.add\(|track\(|fetch\(|catch \()`
    and review every hit.
AN6. **Atomic counters and locks.** Counters, quotas, stock and "one live row per X" are
    protected atomically: a conditional update (`updateMany({ where: { id, used: { lte:
    limit - n } }, data: { used: { increment: n } } })` and require `count === 1`), or
    `SELECT … FOR UPDATE` / `pg_advisory_xact_lock(hashtextextended(${key}, 0))` as the
    FIRST statement of the transaction, with lock keys taken in one global order. A
    `P2002` counts as a lost race only if the winner's row exists (re-read it); otherwise
    rethrow. Raw SQL only through tagged `$queryRaw` / `$executeRaw` templates (lint bans
    `$queryRawUnsafe`, `$executeRawUnsafe`, `Prisma.raw`). Why: check-then-write without a
    lock lets two requests pass the same check. Check: an integration test fires two
    concurrent requests and asserts one success and one catalog code; Grep
    `\$queryRawUnsafe|\$executeRawUnsafe|Prisma\.raw\(` → none.
AN7. **Create/update traps (A4 in Prisma).** A new column appears in the `data` of every
    `create`, `update`, `upsert` and `createMany` that writes the model, with a test that
    reads it back. PATCH = `findUnique` (absent → `AppHttpException` not-found) → merge with the
    DTO → validate the merged state → `update` with explicit fields (`keepUnlessSent(dto.x,
    stored.x)`), never `data: { ...dto }`. `undefined` never reaches a `where`: Prisma
    drops the key and the filter matches every row, so ownership and visibility filters
    are built from required, validated values. Replace-all writes (`deleteMany` +
    `createMany`) reject an empty set unless emptying is the intent. Why: these compile,
    pass review and corrupt data. Check: Grep `data:\s*\{\s*\.\.\.` → none; Grep `where:`
    objects built from optional DTO fields and confirm a presence check; one persistence
    test per new column.
AN8. **Migrations by diff, never `migrate dev`.** `prisma migrate dev` and
    `prisma db push` are forbidden (they hang without a TTY and propose dropping what only
    lives in SQL). Flow: edit `schema.prisma` → `prisma migrate diff --from-migrations
    prisma/migrations --to-schema prisma/schema.prisma --script` (shadow database URL from
    env) → save as `prisma/migrations/<YYYYMMDDHHmmss>_<snake_name>/migration.sql` with a
    comment saying why → add by hand what Prisma cannot express (CHECK, partial or
    expression indexes, triggers) and document each with `///` on its model →
    `prisma migrate deploy` → `prisma generate` (then rebuild a db package consumed from
    `dist`). Datasource and shadow URLs live in `prisma.config.ts`, read from env. Why:
    A11 in Prisma terms. Check: Grep `migrate dev|db push` in package scripts, docs and
    scripts → none; the drift test (AN14) runs `prisma migrate diff --from-migrations
    prisma/migrations --to-schema prisma/schema.prisma --exit-code` and expects exit 0.
AN9. **Schema types.** Money is `Decimal @db.Decimal(p, s)`, never `Float`; Prisma
    `Decimal` serializes as a string, so code converts it with the decimal helper and never
    does `Number()` arithmetic on money. Instants are `DateTime @db.Timestamptz(3)`,
    business dates `@db.Date`. Every relation has an explicit `onDelete`; every filter or
    sort column has an `@@index`; enums that a front-end maps are compared against the
    schema enum by a test. Why: A6 and A11 enforced where the types are declared. Check:
    Grep `schema.prisma` for `\bFloat\b` → none; Grep `DateTime` lines and confirm
    `@db.Timestamptz` or `@db.Date`; Grep `@relation\(` lines and confirm `onDelete`.
AN10. **Guards default-deny, one marker per route.** Global guards via `APP_GUARD`
    (authentication → permission/role → throttler). Every handler declares exactly one
    access-marker decorator from the project's set (e.g. `@Public()`,
    `@RequirePermission('resource:action')`); an unmarked route is denied by the guard,
    and a test scans every controller (`MetadataScanner` + `Reflector` over
    `PATH_METADATA`) and fails on 0 or more than 1 marker. `@Throttle()` is stricter on
    auth, OTP, password reset and cost routes. A new static route is verified against the
    running router so an earlier `:param` route does not swallow it. Why: A14 made
    mechanical. Check: the route-marker test is green; Grep `@Public\(\)` in the diff and
    justify each hit.
AN11. **BullMQ for heavy work.** Queue names and typed payloads live in `core/queue`;
    producers go through one producer service; `@Processor` classes live in
    `modules/<domain>/jobs/` and are registered only in the worker module (separate
    `worker.ts` entry and process). Jobs are added with a deterministic `jobId`,
    `attempts` and exponential `backoff`, and `removeOnComplete` / `removeOnFail` caps; the
    last failed attempt is reported. Redis connections are lazy (`lazyConnect: true`;
    `maxRetriesPerRequest: null` for workers) and never opened at import time. Why: A10
    with BullMQ. Check: Grep `@Processor\(` outside `jobs/` → none; Grep `\.add\(` on
    queues and confirm a `jobId`; Grep module-level `new (Redis|Queue|Worker)\(` → none.
AN12. **Files only through `StorageService`.** It is the only importer of the storage
    SDK (`@aws-sdk/*`): `createUploadPost({ owner, kind, mime, size })` builds the key
    server-side and signs `content-length-range` and `Content-Type` from the allowlist;
    `createDownloadUrl({ owner, key, ttlSeconds })` with `ttlSeconds ≤ 300` and
    `attachment`; `head` / `get` / `put` / `delete` take `{ owner, key }` and a key outside
    the owner's prefix is a 404; magic bytes are verified after upload. Why: A13 in one
    place. Check: Grep `@aws-sdk/` imports outside `core/storage` → none.
AN13. **Unit tests with hand-written stubs.** Runner `vitest` (api), `vitest` (network) (Vitest; Jest
    only when the project already uses it). Services are instantiated directly:
    `new OrdersService(prisma as unknown as PrismaService)` with
    `const prisma = { order: { findUnique: vi.fn(), update: vi.fn() }, $transaction: vi.fn((fn) => fn(prisma)) }`;
    never `@nestjs/testing` for service specs, and no controller specs (integration covers
    controllers). `vitest.config.ts` pins `env: { TZ: 'UTC' }`, maps NodeNext `.js`
    imports to `.ts`, and enforces the G2 gate in `coverage.thresholds` (lines and
    branches) over `src/core` and `src/modules` (excluding `*.module.ts`,
    `*.controller.ts`, `dto/`). Why: fast, explicit tests; data rules go to AN14. Check:
    Grep `@nestjs/testing` under `src/**/__tests__` → none; the thresholds exist in the
    config; `pnpm --filter @acme/api test` (api), `pnpm --filter @acme/card-network test` (network) exits 0.
AN14. **Integration tests on real Postgres.** `test/integration/*.int-spec.ts` boot the
    whole app (`NestFactory.create(AppModule)` plus the same bootstrap helper `main.ts`
    uses) and call it with supertest against real Postgres: Testcontainers
    (`@testcontainers/postgresql`) or a throwaway database created in Vitest
    `globalSetup`, migrated with `prisma migrate deploy` (the real migrations), seeded
    with the real seed and dropped at teardown. A separate `vitest.integration.config.ts`
    uses `unplugin-swc` (esbuild emits no decorator metadata) and
    `fileParallelism: false` when files share Redis, storage or throttler state. Errors
    are asserted with `expect(res.body).toMatchObject({ code })`. The suite includes the
    drift test (AN8) and the route-marker test (AN10). Why: a stub cannot prove a `where`,
    a constraint or a lock. Check: the integration command exits 0 with Docker up; every
    new route appears in a spec.
<!-- /kit:block api-nestjs -->

<!-- kit:block web-common v1 -->
## Rules — Web front-end, React (`W`)

W1. **Feature folders (ANKO).** Every feature under `apps/web/src/app/features/<feature>/` (web), `apps/admin/src/app/features/<feature>/` (admin):
    ```
    <Feature>.tsx   ONE root = the entry (island or route), named after the entity (Contacts.tsx, not ContactsTable.tsx)
    components/     DUMB views, 1 file = 1 component
    hooks/          ALL logic: state, derived data, view decisions, handlers
    mutations/      TanStack mutations: toasts + invalidation by *_KEY
    services/       one function per endpoint + DTO ⇄ domain mapping
    helpers/        pure functions
    __tests__/      every test of the feature
    types.ts  data.ts (constants, options, columns)  schema.ts (forms only)
    ```
    Nothing else at the feature root. Shared queries live in `src/app/tanstack-queries/`,
    shared UI in `src/app/components/UI/` (or the project's UI package), cross-feature
    pure functions in `src/app/helpers/`. No imports between features: what two need moves
    up. When `services/` or `types.ts` do not apply (shared query, shared type), the
    feature says why in a one-line comment in its root. Why: a feature reads the same way
    everywhere and logic is testable in isolation. Check: Glob each touched feature root
    against the list; Grep `features/` imports inside a feature that point to another
    feature → none.
W2. **Dumb components.** Files in `components/` take props and return JSX: no
    `useEffect`, queries, mutations, service or HTTP calls, toasts, tracking or business
    decisions. A decision that lives in JSX (`canEdit`, `showUpgrade`, an amount, whether
    an action is enabled) moves to the hook or a helper with its test. Exception: a
    one-line `setHydrated(true)` mount gate. Why: logic in JSX is logic nobody tests.
    Check: Grep `useEffect|useQuery|useMutation|axios|fetch\(|toast|sonnerResponse|trackEvent`
    in `**/components/**/*.tsx` → none.
W3. **`useEffect` is the last resort and never hits the network.** In this order: derive
    in render → event handler → TanStack Query (`enabled`, `staleTime`) or a mutation →
    store `persist` → reset with `key` → mount gate → effect, with a comment saying why.
    No fetch, mutate, refetch or invalidate inside an effect; dependencies are stable
    (no objects/functions created in render); no `setState` that changes the effect's own
    dependencies; every interval or poll has a stop condition and never starts a tick
    while the previous one runs. Why: an effect that re-runs becomes an endless request
    loop. Check: Grep multiline
    `useEffect\([\s\S]{0,800}?(fetch\(|axios|Service\.|\.mutate\(|mutateAsync\(|refetch\(|invalidateQueries\()`
    → none; Grep `setInterval\(|refetchInterval` and confirm each stop condition; Network
    tab shows no repeated requests on load or navigation.
W4. **Server state only in TanStack Query.** One `QueryClient` singleton (explicit
    `staleTime`, `retry: 1` and no retry on 4xx, `refetchOnWindowFocus: false` unless the
    screen needs it). Shared queries live in `src/app/tanstack-queries/` and export a
    `*_KEY` constant; query keys include every parameter; invalidation uses the exported
    constant, never a literal. A query that needs a session is `enabled` only with a
    session. Server data is never copied into local state or a store; client-only state
    lives in hooks or a store. Skeletons are gated by `isLoading` (a disabled query stays
    `isPending` forever). Why: one cache, one source of truth, no stale copies. Check: Grep
    `queryKey:\s*\[\s*['"]` and `invalidateQueries\(\{\s*queryKey:\s*\[\s*['"]` → none; Grep
    `isPending` used to gate skeletons → none.
W5. **Toasts only in mutations; dialogs close on success.** Success and error toasts
    live in the mutation's `onSuccess` / `onError` (sole exception: the validation gate of
    a hook's `submit()`). A notice shown when a page loads is rendered in the page, not as
    a toast; the reason a control is disabled is shown next to it. Dialogs close in
    `onSuccess`, never `onSettled`; a `mutateAsync` caller handles the rejection (G18). No
    `window.alert/confirm/prompt` (use the confirm-dialog wrapper). Why: closing on settle
    reports an action that failed and discards what the user typed. Check: Grep
    `toast|sonnerResponse` outside `mutations/` and hooks' submit gates → none; Grep
    multiline `onSettled[\s\S]{0,200}?(onClose|onOpenChange\(false|setOpen\(false|setIsOpen\(false)`
    → none; Grep `window\.(alert|confirm|prompt)\(` → none.
W6. **Errors by code.** `onError` reads the code from the API envelope and maps it with
    `translateError(code)` → `t('errors.<code>')`; the backend `message` is never shown
    or compared; an error without a code falls back to a generic copy key. Every code the
    API can return to that screen has copy in every locale and a test. Why: messages are
    not localized and change; codes are the contract. Check: Grep `\.message` in
    `mutations/` and `hooks/` → none (or only inside the fallback for non-API errors); a
    test per code the screen handles.
W7. **UI kit through wrappers.** No raw `<button>`, `<input>`, `<select>`, `<textarea>` or
    `<table>` in `.tsx` outside `src/app/components/UI/` (or the UI package): use the UI
    kit or its wrapper (lint `react/forbid-elements`). Forms use a native
    `<form noValidate>`. Before creating a component, search for an existing one; a
    pattern used twice becomes a wrapper. Icons are one component per file in
    `src/assets/svg/`, never inline `<svg>` in features. Why: one place fixes styling,
    accessibility and kit quirks. Check: Grep `<(button|input|select|textarea|table)[\s>]`
    in `.tsx` outside the wrapper folders → none; Grep `<svg` in `features/` → none.
W8. **Design tokens only.** Colors, radii, fonts, spacing and shadows come from the
    theme tokens (defined once, in the global CSS): no hex/rgb/hsl/oklch literals, no
    `var(--…)` in `className` or `style`, no raw palette classes (`bg-white`,
    `text-black`, `text-gray-500`) in `.tsx` / `.astro`; light and dark themes both work
    through tokens. When `kit.json` sets `brand` (`docs/brand.md`), token values, typography,
    imagery and tone match it; without it, only "tokens only" is enforced. Why: a rebrand
    is a token change, not a hunt. Check: Grep `#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(`
    in `.tsx` / `.astro` → none; Grep
    `\b(bg|text|border|ring|fill|stroke)-(white|black|(gray|slate|zinc|neutral|stone|red|blue|green|yellow)-\d+)\b`
    → none.
W9. **Mobile-first from 360 px.** Unprefixed utilities are the phone layout;
    `sm:`/`md:`/`lg:` add the larger ones. Every screen is built and verified at 360 px
    first, then 1280 px: no horizontal scroll at 360, touch targets ≥ 44 px, the right
    keyboard per field (`inputMode`, `autoComplete`), tables become cards on small
    screens, the primary action within thumb reach. Why: most users are on phones and
    desktop-first layouts break there. Check: screenshots at 360×800 and 1280×800 in the
    builder report; the E2E mobile project runs at 360 px wide;
    `document.documentElement.scrollWidth <= 360` on each touched page.
W10. **Accessibility.** Every control has an accessible name (associated label or
    `aria-label`); text contrast meets WCAG AA; focus is visible; everything works with
    the keyboard; async status changes are announced (`aria-live`); one `h1` per page;
    images have `alt` (`alt=""` when decorative); motion respects
    `prefers-reduced-motion`. Why: accessibility bugs are bugs. Check: lint includes
    `eslint-plugin-jsx-a11y` recommended; the browser console has no accessible-name
    warnings; when the project has `@axe-core/playwright`, key pages report 0 serious or
    critical violations.
W11. **Forms mirror the API.** react-hook-form + zod; the schema uses the same shared
    limits as the API DTO (`.trim().max(N)`, e-mail `.max(254)` lowercased, password
    `.min(8).max(128)`) and inputs carry `maxLength`. Amounts and percentages are text
    inputs sanitized as decimals (a comma is a decimal separator in many locales; pasted
    thousands separators are normalized) — never `type="number"`; an empty field is not
    zero (`''` → `undefined`); an invalid amount is flagged, never auto-corrected. Submit
    is disabled while pending; field errors returned by the API in `details` map to their
    field. Why: a client that validates differently from the server either blocks valid
    input or sends invalid input. Check: Grep `type=["']number["']` → none; Grep
    `Number\(` on form values and confirm an empty-string guard; each schema has a test
    with the last passing and the first failing value.
W12. **i18n for every string.** G13 applies to every view: labels, placeholders,
    `aria-label`s, toasts, empty states, page titles and descriptions and the copy in
    `data.ts` all go through `t('ns.key')` from the app's i18n module, with every key in
    every locale in the same change; the default UI locale is `en-US`. The active
    locale is resolved once (stored preference → `Accept-Language` → default) and applied
    after mount so server and client render the same text. Dates, numbers and currency use
    `Intl`-based formatters with the active locale; amounts from the API arrive as decimal
    strings and are formatted, never `toFixed` on the raw value. Why: a missing key shows
    the raw key to users and a hand-formatted number is wrong in half the locales. Check:
    a test compares the key sets of all locales; the G13 greps over touched `.tsx` /
    `.astro` files → none; Grep `toFixed\(|toLocaleString\(\)` on API values → none.
W13. **Loading, empty and error states; resilient images.** Every query renders a
    skeleton (gated by `isLoading`), an empty state with a call to action, and an error
    state with a retry; uploads show progress; buttons are disabled while their action is
    pending. A partial payload does not crash the screen (defaults where the type allows
    absence). Every remote image goes through a safe-image wrapper with fixed dimensions,
    lazy loading below the fold and a placeholder on error. Why: real networks and real
    data are partial. Check: for each `use\w+Query\(` consumer, the hook exposes and the
    root renders loading, empty and error branches, each with a test; Grep `<img` in
    `.tsx` outside the wrapper → none.
W14. **Public env only; no unsafe HTML.** Client code reads only public-prefixed
    variables (G9) through one typed env module; nothing secret reaches the bundle. The access
    token lives in memory and the refresh token in an httpOnly cookie; nothing sensitive
    in `localStorage` / `sessionStorage`. No `dangerouslySetInnerHTML`, `set:html` or
    `innerHTML` with user data (lint `react/no-danger`); redirects and `next=` targets
    only to own routes; no tokens in URLs. Why: anything in the bundle or in storage is
    readable by any script on the page. Check: Grep
    `dangerouslySetInnerHTML|set:html|\.innerHTML\s*=` → none or justified; Grep
    `(localStorage|sessionStorage)\.setItem\([^)]*(token|jwt|session)` → none; Grep
    `import\.meta\.env\.\w+` and `process\.env\.` in client code and confirm each is a
    public variable or a framework flag.
W15. **Tests assert behaviour.** Vitest + React Testing Library (jsdom) for components,
    hooks, mutations, services and helpers: mock at the service boundary (or with MSW),
    never the unit under test; assert what the user sees (roles, labels, text, FT10);
    every stub renders a `data-testid` (FT8); integrations (toaster, providers, query
    client) are the real ones (FT22); invalidation is asserted by its effect using the
    exported `*_KEY` (FT9). The G2 coverage gate applies per file to `hooks/`,
    `helpers/`, `mutations/`, `services/` and the app-level `lib/`, `store/` and
    `tanstack-queries/`. Cross-page flows are Playwright specs owned by the E2E agent.
    Why: a test that mocks what it tests proves nothing. Check: `pnpm --filter @acme/web test` (web), `pnpm --filter @acme/admin test` (admin)
    exits 0 with the thresholds; Grep tests that `vi.mock` the file they test → none.
W16. **Tooling green and a clean console.** `pnpm --filter @acme/web lint` (web), `pnpm --filter @acme/admin lint` (admin) (ESLint with
    react-hooks, jsx-a11y and canonical-class rules), `pnpm --filter @acme/web typecheck` (web), `pnpm --filter @acme/admin typecheck` (admin) (strict
    TypeScript), `pnpm --filter @acme/web test` (web), `pnpm --filter @acme/admin test` (admin) and `pnpm --filter @acme/web build` (web), `pnpm --filter @acme/admin build` (admin) exit 0 (G10), and the
    browser console is clean (no React, hydration or accessibility warnings) on every
    touched page and its dialogs. Why: runtime warnings are invisible to type checkers and
    linters. Check: run each command and read its exit code; open the page and its dialogs
    and read the console.

W17. **List state lives in the URL, and every way back restores it.** A list's filters,
    sort and page are query parameters, read and written by ONE parser and serialiser per
    list: the link can be shared, a reload keeps it and the browser's Back walks through
    it. Each list remembers its canonical query for the current tab in `sessionStorage`
    (one key per list), passed through the list's own parser both when it is written AND
    when it is read, so only valid filters ever reach a link. It records only while the
    address is the list itself, because a list that mounts during Back → Forward would
    otherwise overwrite the memory with a stale query. Every in-app way back to the list —
    back link, breadcrumb, not-found action, redirect after a delete — is built from that
    memory by one helper; server-rendered links stay the plain list (without JavaScript,
    or with an empty memory, they still work) and the client only swaps their `href`.
    Section and navigation links always open a fresh list. The `Referer` header and
    `history.back()` are never the source of the way back: after a deep link, a new tab
    or another site they lead out of the app or nowhere. Why: a user who narrowed 200 rows
    to 3, opened one and came back to page 1 of everything stops trusting the list. Check:
    a unit test of the helper covers an invalid stored query, a write while the address is
    not the list, and an empty memory; an E2E test filters, opens an item, goes Back →
    Forward, then uses the in-app back link and lands on the filtered list; Grep -i
    `history\.back\(|document\.referrer|headers\.get\(['"]referer` in the web scopes → none.

W18. **Values that must come from a lookup are picked, not typed.** A field whose value must
    exist in a provider or a catalog — an address from a geocoder, a catalog item, a user
    from a directory — is saved only with the structured value the user PICKED from the
    lookup (its id and the fields the API needs), never with the typed text alone, and the
    API validates the same. An edit keeps the value the record opened with: an untouched
    field saves without a new lookup, and typing the saved label back restores the saved
    structure. A provider outage blocks only a new or changed value: the draft is kept, the
    field shows the lookup's `unavailable` state (by code, W6) with a retry, and unchanged
    values still save (A20). Why: typed text that looks like an address is how unroutable
    deliveries and duplicate catalog items get in, and an outage must not cost the user
    what they already wrote. Check: the form's tests cover create blocked without a pick,
    a pick unblocking it, an unchanged edit passing, a changed edit blocked until a new
    pick, and outage → draft kept → retry → pick.
<!-- /kit:block web-common -->

<!-- kit:block web-astro v1 -->
## Rules — Astro + React islands (`WA`)

WA1. **Astro-first.** Everything static is `.astro` (zero JS): layouts, headers, footers,
    heroes, copy, listings without interaction, and the skeletons islands show while they
    load. React islands exist only where there is state, events, queries, forms or
    dialogs. A page mounts ONE feature root per interactive region; data available at
    build or request time is passed as props from the frontmatter instead of being fetched
    again in the browser. Pages live in `src/pages/`, layouts in `src/layouts/`
    (BaseLayout = head, SEO, fonts, theme init; app and public layouts on top). Why: every
    island is JavaScript the user downloads and hydrates. Check: Grep `src/pages/**/*.astro`
    for more than one feature root per region; review new `.tsx` files without hooks,
    state or handlers → they should be `.astro`.
WA2. **Hydration directives and an SSR-safe first render.** Prefer `client:visible` >
    `client:idle` > `client:load` (load only for above-the-fold controls used at once).
    Islands that render query data in a static build with `<ClientRouter />` — and every
    authenticated screen — use `client:only="react"` with an `.astro` skeleton in
    `slot="fallback"`, never a blank area. The first client render must equal the server
    HTML: never read `window`, `localStorage`, `sessionStorage`, `location` or a cookie in
    `useState` initializers or render; use a mount gate. Why: a mismatch makes React throw
    away and rebuild the whole island. Check: Grep `client:only` lines and confirm a
    `slot="fallback"` child; Grep
    `useState\(\(\) =>[^)]*\b(window|localStorage|sessionStorage|location|document\.cookie)`
    → none; the console shows no hydration errors.
WA3. **Islands share state through stores.** One `QueryClient` module singleton is
    shared by every island; each island root wraps itself in the app providers; exactly
    one toaster per page (`withToaster` on one island). State shared between islands lives
    in Zustand stores, never React Context (each island is a separate React tree). Why:
    Context silently does not cross islands and two toasters duplicate every toast. Check:
    Grep `new QueryClient\(` → exactly one; count toaster mounts per page → 1; Grep
    `createContext\(` and confirm its consumers live in the same island.
WA4. **ClientRouter lifecycle.** With `<ClientRouter />` (view transitions), page setup
    runs in `document.addEventListener('astro:page-load', …)`, never `DOMContentLoaded`
    or top-level code that assumes a fresh document; listeners and timers added per page
    are removed on `astro:before-swap`; the theme is re-applied on `astro:after-swap` to
    avoid a flash; `transition:persist` only on elements that must survive navigation
    (players, persistent heroes). Why: client-side navigation does not reload scripts, so
    setup code silently stops running or runs twice. Check: when `ClientRouter` is used,
    Grep `DOMContentLoaded` in `src/` → none; each `addEventListener` in page scripts has a
    matching removal.
WA5. **Prefetch and cache headers.** Internal links prefetch (`prefetch` enabled, hover or
    viewport strategy); hashed assets under `/_astro/` are served
    `Cache-Control: public, max-age=31536000, immutable`; HTML is `no-cache` (public pages
    may add a short `s-maxage`); authenticated pages and API responses are never stored
    by shared caches. Why: instant navigation without stale HTML or leaked private pages.
    Check: the host's headers config contains the rules; `curl -sI` on a page and on an
    `/_astro/` asset of the build shows them.
WA6. **SEO-first public pages.** Every public page has a unique `<title>` ≤ 60 chars, a
    meta description of 100–155 chars, a canonical URL (`site` set in the Astro config),
    Open Graph and Twitter tags, JSON-LD for its page type, exactly one `h1`, and `lang`
    set to the page locale; `@astrojs/sitemap` and `robots.txt` exist (`llms.txt` when the
    project publishes one); private and auth pages are `noindex, follow` and excluded from
    the sitemap; localized routes declare reciprocal `hreflang` plus `x-default` and never
    auto-redirect by IP or `Accept-Language`. Titles and descriptions come from i18n.
    Why: these pages exist to be found. Check: after `pnpm --filter @acme/web build` (web), `pnpm --filter @acme/admin build` (admin), scan
    `dist/**/*.html` of public routes for title length, description length, canonical,
    one `h1`, and JSON-LD that parses.
WA7. **Typed `astro:env`.** Configuration is declared in `astro.config.*`
    `env.schema` with `envField` (`context: 'client', access: 'public'` for browser values
    such as `PUBLIC_API_URL`; `context: 'server', access: 'secret'` for secrets) and read
    from `astro:env/client` / `astro:env/server`; app code never reads
    `import.meta.env.<NAME>` for configuration, and client code never reads
    `process.env`. Why: a typed schema fails the build on a missing variable and keeps
    secrets out of client bundles. Check: Grep `import\.meta\.env\.` in `src/` and confirm
    only framework flags (`DEV`, `PROD`, `MODE`, `SSR`, `BASE_URL`, `SITE`); Grep
    `process\.env` in `.tsx` → none.
WA8. **HeroUI v3.** `@heroui/react` with `@heroui/styles` imported after `tailwindcss` in
    the global CSS; no `HeroUIProvider`, no `@heroui/theme`, no v2 APIs: Button uses
    `variant` (not `color`) and `onPress` (not `onClick`); `isLoading` does not exist (use
    `isDisabled` plus a spinner or pending label); `Input` takes no `label` (the field
    wrapper composes `TextField` + `Label` + `Input`); `useDisclosure` is a local hook;
    `Switch` needs `Switch.Control` + `Switch.Thumb` (use the toggle wrapper); a
    controlled modal without a trigger controls `Modal.Backdrop` (`isOpen`,
    `onOpenChange`) instead of a `<Modal>` root; never HeroUI's `<Form>`; every react-aria
    control (Select, ComboBox, icon-only Button) has an accessible name. HeroUI CSS
    variables (`--accent`, `--surface`, `--field-background`, `--danger`, …) are mapped to
    project tokens in the global CSS. When unsure of an API, read the installed types in
    `node_modules/@heroui/react`. Why: v2 habits compile and then render broken or warn
    at runtime. Check: Grep
    `HeroUIProvider|@heroui/theme|<Button[^>]*\b(color=|isLoading|onClick=)|<Form[\s>]`
    in `.tsx` → none; the console shows no `PressResponder` or `aria-label` warnings.
WA9. **Tailwind v4 canonical classes.** CSS-first configuration (`@import "tailwindcss"`
    and `@theme` tokens in the global CSS). No v3 names (`bg-gradient-to-*` →
    `bg-linear-to-*`, `flex-shrink-0` → `shrink-0`, `flex-grow` → `grow`,
    `overflow-ellipsis` → `text-ellipsis`, `break-words` → `wrap-break-word`); no arbitrary
    value that exists in the scale (px ÷ 4: `min-h-[300px]` → `min-h-75`,
    `aspect-[3/4]` → `aspect-3/4`); brackets only for `calc()`, `var()`, `%`, viewport
    units, `deg`, `ch` and off-scale ratios; canonical state variants (`data-hovered:`,
    `data-selected:`); a component's own size lives outside theme namespaces
    (`--bottom-nav-height` + `var()`), so it never becomes a spacing token. Names v4
    reused with new values (`shadow-sm`, `rounded-sm`, `blur-sm`, `outline-none`) are not
    replaced blindly. Why: the build and most linters accept v3 names silently. Check:
    lint with `better-tailwindcss/enforce-canonical-classes` (or the project's canonical
    class check) exits 0; Grep `bg-gradient-to-|flex-shrink-|flex-grow|overflow-ellipsis|-\[\d+px\]`
    → none.
WA10. **Dev server and build hygiene.** `vite.optimizeDeps.include` lists every heavy
    dependency islands import (react, react-dom/client, the JSX runtimes,
    `@heroui/react`, `@tanstack/react-query`, zustand, sonner, the HTTP client,
    react-hook-form, `@hookform/resolvers/zod`, zod), so the dev server never
    re-optimizes mid-session ("504 Outdated Optimize Dep"); the dev toolbar is disabled;
    `astro check` / `astro build` never run against the same `node_modules/.vite` as a
    running dev server (type-check with `tsc --noEmit` meanwhile, and never delete `.vite`
    under a live server). Islands stay small (vendor chunks split, each chunk < 500 kB);
    images use `astro:assets` or explicit `width`/`height`; fonts are self-hosted or
    preconnected with `display=swap`. Why: these break hydration in dev and Core Web
    Vitals in production. Check: inspect `astro.config.*`; the build output has no chunk
    warning.
WA11. **Auth in static builds.** Prerendered HTML never contains private data:
    authenticated screens are `client:only` islands behind the session gate, which
    bootstraps the session once (refresh single-flight) and redirects to the sign-in route
    without one; SSR routes (`prerender = false`) check the session in
    `src/middleware.ts`; private pages are `noindex`. Why: static HTML is public by
    construction. Check: Grep private pages for `client:only` roots and `noindex`; the
    built HTML of private routes contains only skeletons.
<!-- /kit:block web-astro -->

<!-- kit:block addon-money v1 -->
## Rules — Money, idempotency and locks (`MO`)

Applies to anything that charges, pays, credits, refunds, reserves, prices or meters.
Every money fix brings the attacker test and the third-party-down test (G2). Base rules
this block builds on instead of repeating: decimal types (A6, AN9), decimal input (A3, W11,
M16), transactions and atomic locks (AN5, AN6 — the same mechanics apply to any backend),
long work off the request (A10) and the backward-compatible contract with its deploy order
(A18, M13).

MO1. **Cents and rounding.** On top of A6: amounts are split into cents with the
     largest-remainder method, never `Math.floor(x * 100)`; reserve, check and release call
     the SAME function with the same rounding; a tolerance is one-sided; any comparison with
     `NaN` stops the operation. Why: 4.35 × 100 is 434.999…, an invoice lost a cent, and
     two rounding paths let a reserved cent look free. Check: Grep
     `Math\.(floor|trunc|round)\([^)]*\*\s*100`, `Math\.abs\(` inside an amount tolerance
     and `parseFloat\(` in money code → findings.

MO2. **Client-generated idempotency key.** Every action that moves money or prices carries
     an idempotency key generated by the CLIENT that survives closing the dialog, reloading
     and unmounting (persisted per scope, e.g. session storage for 24 h), bound to the
     content (same key with a different payload → 409), recorded in the SAME transaction as
     the effect, and REQUIRED in the DTO, the client type and the service signature. A
     disabled button is not idempotency. Why: a proxy timeout plus a retry applied a price
     increase twice. Check: Grep money DTOs and service signatures for an idempotency field
     declared optional (`?:`, `.optional()`, `@IsOptional`) → finding; a test replays the
     same key (one effect) and the same key with another payload (409).

MO3. **The same money never moves twice.** Money writes use the AN5/AN6 mechanics (lock
     as the first statement, keys in one global order, decide inside the transaction, no
     catch-and-continue, side effects after commit) and, in addition, either a serializable
     transaction wrapped in ONE retry helper (serialization failure → retry; on giving up,
     409 with a code such as `operation.in_progress`) or a conditional update whose row
     count is checked. Every READ COMMITTED writer of the same balance (refunds, reversals,
     debt payments) waits for the same locks. Why: a swap read the free balance from before
     a payment's lock and the same money left twice. Check: Grep `isolationLevel` → each
     call goes through the retry helper; a concurrency test fires N parallel requests and
     exactly one effect happens.

MO4. **Payment rails.** Settling, confirming, capturing or crediting re-reads the payment
     at the provider by OUR reference; an id or amount coming from the client never pays,
     delivers or credits anything. "Not confirmed" (pending, foreign, closed order) is a 4xx
     with a code, never a 2xx. A webhook processes only what its signature covers and
     re-reads the state at the provider. Uncertain is not "no": a 5xx or timeout from the
     provider never refunds, cancels, deletes or marks failed blindly — a sweep asks again
     and settles late approvals through the SAME path, and a critical incident is opened
     ONCE per fact (deduplicated by the purchase, grouped by fingerprint). Why: a made-up
     transaction id paid a real order. Check: Grep settle/confirm/capture handlers for DTO
     fields used as the provider id or amount; a test sends a foreign reference → 4xx; a
     test with the provider returning 5xx → no state change and one incident.

MO5. **Record at request time.** Whatever decides money and can change between request and
     payment (payout account, country cost, price, invoice series, exchange rate) is stored
     with the request and read from there, never recomputed with today's settings. Before an
     irreversible external effect everything is validated and the balance is RESERVED under
     a lock; it is released only when it is known the effect did not happen; the id given
     to the third party is one per attempt. Why: a payout approved for one account was paid
     to another after a settings change. Check: Grep the settle/release path for a
     recomputation of a stored value.

MO6. **Money tests.** Each money rule has: the boundary pair (last passing, first failing —
     FT1), rounding fixtures that pin the direction (FT13), the attacker request, the
     provider-down case, and a concurrency test for every lock (N parallel → one effect).
     Why: money bugs pass happy-path suites. Check: `auditor-tests` lists these five per
     touched money rule.
<!-- /kit:block addon-money -->

<!-- kit:block addon-observability v1 -->
## Rules — Observability (`OB`)

Error tracking, product analytics, logs, heartbeats and bot protection are reached only
through adapters, work without keys, and never carry personal data. Base rules this block
builds on instead of repeating: vendor SDKs behind a port with timeouts (A9), structured
logs with a request id (A15), the mobile reporting module (M12), env variables (G9) and no
silent `catch` (G18).

OB1. **SDKs only inside adapters.** A provider SDK (`@sentry/*`, `posthog-js`,
     `posthog-node`, `@logtail/*`, `@datadog/*`, `mixpanel*`, bot-protection SDKs…) is
     imported only under `**/observability/adapters/**` — static or dynamic `import()` —
     and a lint rule enforces it. App code calls the facade (`captureError`, `trackEvent`,
     `ErrorReporter.capture`, `AnalyticsService.track`, `HeartbeatService.ping`). Swapping a
     provider is a new adapter, not an app change. Why: a direct import is where scrubbing
     and the no-op are skipped. Check: `/kit:audit quick` (OB1 import check); Grep for
     `eslint-disable` next to such imports.

OB2. **No-op without keys.** With every key empty (dev, test, CI, and production until the
     owner pastes them) each adapter is a no-op: no SDK download, no network, no listeners,
     no timers. A test per adapter proves it. Production makes a key mandatory only through
     the env schema, by an explicit decision. Why: observability must never be the reason a
     process fails to boot or a test hits the network. Check: each adapter has a "no key"
     test asserting no SDK init and no request; run them.

OB3. **No personal data in events or reports.** Events and error contexts carry ids
     (hashed for analytics) and enums only — never names, emails, phones, documents,
     addresses, free text typed by a user, or amounts of an identifiable person. Error
     reports drop request bodies, cookies, auth headers and query strings; `before_send`
     strips query and fragment from every URL; breadcrumbs drop console and query;
     autocapture, heatmaps, session recording and dead-click capture are off IN CODE. Why:
     analytics has more readers than the database. Check: Grep
     `trackEvent\(|\.track\(|captureException\(|captureError\(` in touched files and read
     every property; a spec asserts the exact set of keys the scrubber keeps (FT20).

OB4. **Success and failure for every action.** Every mutation and every service with I/O
     emits a success event AND a failure event (`domain_action` in snake_case, e.g.
     `order_paid`, `order_payment_failed`); multi-step flows emit one event per step. One
     emitter per fact: the API emits the success; a client emits only what the API cannot
     see (a network cut) with an `origin` property; names and outcomes match across clients.
     The number in an event is the ACTION's, not the screen's state. Why: without both
     events there is no funnel and failures are learned from customers. Check: for each
     touched mutation/service, Grep the success and failure event names; Grep the same
     event name in two emitters.

OB5. **Errors captured once; business errors are not errors.** A 4xx with an error code
     is business: it goes to analytics (`*_rejected { reason }`), not to error tracking.
     Network failures and 5xx are captured exactly ONCE — by the HTTP interceptor or by the
     `onError`, never both. Why: duplicated or noisy reports bury the real ones. Check: read
     each touched `onError`/`catch` against the interceptor's behaviour; Grep
     `window\.Sentry|window\.posthog` → zero (module SDKs do not define globals).

OB6. **Heartbeats, uptime and shutdown.** Every cron or periodic job pings its heartbeat
     AFTER a successful run (never before, never in the `catch`) and reports its failure;
     endpoints critical to charging or delivering have an uptime monitor; an admin-only
     health endpoint reports which integrations are configured, as booleans only; buffered
     clients flush on shutdown within a deadline (timeouts in general: A9). Why: a job that
     silently stops is found by the customer, and a flush without a deadline ate the whole
     shutdown window. Check: Grep `@Cron|@Interval|setInterval\(|schedule\(` in touched code
     for a heartbeat ping after success and an error capture.

OB7. **Real SDK in tests, live check after deploy.** Integrations are tested with the real
     library and real providers (FT22). After deploy the owner verifies that the app's OWN
     events arrive (not only page views) and that a test error lands. Why: a fake global
     kept a test green while production sent zero events for a month. Check: Grep tests for
     `window\.(posthog|Sentry)\s*=` → FT22 finding; the auditor adds the live check to
     "Notes for the owner".

OB8. **Consent where required.** Public sites load analytics only after consent when the
     jurisdiction requires it; events before consent are dropped, not queued; revoking stops
     collection. Why: legal exposure, not just hygiene. Check: the public layout's analytics
     init is gated by the consent state; a test denies consent and asserts no init.
<!-- /kit:block addon-observability -->

## Project rules

<!-- Rules specific to this project, IDs P1, P2… (stable, append-only). Same format as the
kit rules: the rule, then Why, then Check. The kit never writes or rewrites this section. -->

P1. **Money is integer cents (`BIGINT`), not `Decimal`.** Overrides AN9's `Decimal(p, s)` for
    money (ADR-0002). Amounts are `BigInt` in Prisma / `BIGINT` in Postgres with `CHECK`
    constraints, a `Money` value object around `bigint` in code, and strings of integer cents
    in JSON (`"12550"`). Decimal user input (`"125.50"`) is parsed to cents by ONE function
    shared through `packages/contracts`, which rejects a third fractional digit, exponents
    and signs where they are not allowed. Display formats from cents with `Intl`. Why: one
    currency at cent precision; integer arithmetic is exact and leaves no `Number` trap.
    Check: Grep `schema.prisma` for money fields → `BigInt`; Grep `Number\(|parseFloat\(|toFixed\(`
    on amounts → none; the parser has boundary fixtures (FT1, FT13).

P2. **Events through a transactional outbox, not BullMQ.** Domain events are rows in an
    `outbox` table written in the SAME transaction as the change; the worker entrypoint
    (`src/worker.ts`) claims batches with `FOR UPDATE SKIP LOCKED`, handles each event
    idempotently (by event id) and marks it done. No Redis in this project. AN11 applies to
    the worker's shape (separate entry and process, capped retries with backoff, last failure
    reported). Why: an event must exist if and only if its change committed (ADR-0001). Check:
    Grep for publishing or HTTP calls inside `$transaction` → none; the worker has a test for
    a crash between claim and done (the event is re-processed once).

P3. **Every call between services is signed and idempotent.** card-network → core and the
    payment provider → core webhooks carry an HMAC-SHA256 signature over
    `timestamp.method.path.body` (header `X-Signature`, timestamp within ±5 min) and an
    `Idempotency-Key`. The core verifies the signature before parsing the body and re-reads
    the provider's state by OUR reference before crediting anything (MO4). Why: the network
    and the provider are outside our trust boundary. Check: an integration test sends a
    forged, a stale and a replayed request → 401, 401, replayed response.

<!-- kit:block commands v1 -->
## Commands

### api (apps/api)

```bash
pnpm --filter @acme/api lint   # lint
pnpm --filter @acme/api typecheck   # typecheck
pnpm --filter @acme/api test   # test
pnpm --filter @acme/api test:integration   # integration
pnpm --filter @acme/api build   # build
```

### network (apps/card-network)

```bash
pnpm --filter @acme/card-network lint   # lint
pnpm --filter @acme/card-network typecheck   # typecheck
pnpm --filter @acme/card-network test   # test
pnpm --filter @acme/card-network test:integration   # integration
pnpm --filter @acme/card-network build   # build
```

### web (apps/web)

```bash
pnpm --filter @acme/web lint   # lint
pnpm --filter @acme/web typecheck   # typecheck
pnpm --filter @acme/web test   # test
pnpm --filter @acme/web build   # build
```

### admin (apps/admin)

```bash
pnpm --filter @acme/admin lint   # lint
pnpm --filter @acme/admin typecheck   # typecheck
pnpm --filter @acme/admin test   # test
pnpm --filter @acme/admin build   # build
```

### e2e

```bash
pnpm --filter @acme/e2e test   # e2e
```
<!-- /kit:block commands -->
