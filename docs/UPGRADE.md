# Upgrade Guide

## App code (your own changes)

```bash
cd /opt/coursevault
git pull
docker compose up -d --build   # migrations run automatically on start
```

Schema changes: create migrations in development with
`npx prisma migrate dev --name describe_change`, commit the generated folder
under `prisma/migrations/`, and production applies them on the next deploy via
`prisma migrate deploy`. Never edit an applied migration.

## Pinned transitive versions (`overrides` in package.json)

`npm audit` reported eight high-severity advisories, all of them in packages
this project does not depend on directly — they arrive underneath `next`,
`@eslint/eslintrc` and the `prisma` CLI. npm's suggested fix was `next@16` and
`prisma@6.12`, i.e. a major upgrade and a major downgrade, for defects in
transitive dependencies. The `overrides` block pins the patched versions
instead:

| Package | Pinned | Arrives via | Why |
| --- | --- | --- | --- |
| `sharp` | `^0.35.3` | `next` (optional dep, `^0.34.3`) | libvips CVEs. This is the copy next/image uses; the app's own upload pipeline was already on 0.35. |
| `postcss` | `^8.5.26` | `next` (pinned `8.4.31`) | sourceMappingURL path traversal. Build-time only. |
| `brace-expansion` | `^5.0.9` | `minimatch` under the eslint parser | ReDoS-style unbounded expansion. Dev only. |
| `js-yaml` | `^5.3.0` | `@eslint/eslintrc` | Quadratic CPU in `!!omap`. Dev only; this project uses flat config, so it is never parsed. |
| `deepmerge-ts` | `^8.0.2` | `@prisma/config` | Stack exhaustion on recursive graphs. Prisma CLI only. |

Verified after pinning, not assumed: `npm run build`, a request through
`/_next/image` (the only thing that actually exercises next's `sharp` — it
returned a correctly resized JPEG), `eslint`, `prisma validate`,
`prisma generate`, `prisma migrate deploy`, and the test suite. `npm audit`
reports 0 vulnerabilities.

When upgrading `next` or `prisma`, re-check whether these are still needed —
an override that outlives its reason silently holds a dependency back.

## Dependencies (monthly)

```bash
npm outdated                 # see what's behind
npm update                   # safe within semver ranges
npm audit                    # review advisories
npm run typecheck && npm run lint && npm run build   # must all pass
```

Test locally (`npm run dev`, click through home → course → download → admin)
before deploying.

## Major version upgrades — notes specific to this codebase

- **Next.js**: check the codemod (`npx @next/codemod@latest upgrade`). Areas
  most likely to need attention: `unstable_cache`/`revalidateTag` (settings
  cache), `after()` (view counter), middleware matcher, `output: "standalone"`
  behavior in the Dockerfile.
- **Prisma**: run `npx prisma generate` after upgrading; scan the changelog
  for breaking client API changes. The schema itself is version-agnostic.
- **Auth.js (next-auth)**: currently on v5 beta channel; pin exact versions
  and re-test login + middleware redirects after any bump.
- **Tailwind**: v4 uses CSS-based config in `globals.css` (`@theme`,
  `@utility`, `@custom-variant`) — there is no `tailwind.config.js` to migrate.
- **Zod**: v4 semantics are relied upon (`.prefault()` on settings objects,
  `z.input`/`z.output` split in forms).
- **React 19 / RHF / resolvers**: forms use the
  `useForm<Input, unknown, Output>` triple-generic pattern; keep
  `@hookform/resolvers` in step with zod.

## Node.js base image

The Dockerfile tracks `node:24-alpine`. To upgrade Node, bump the three `FROM`
lines, rebuild, and verify sharp works (it ships prebuilt musl binaries; a
mismatch fails loudly at upload time).

## Rollback

```bash
git log --oneline            # find the last good commit
git checkout <commit>
docker compose up -d --build
```

Database rollbacks: restore the pre-upgrade dump (see BACKUP_RESTORE.md) —
Prisma migrations are forward-only. Always back up right before an upgrade
that includes migrations.
