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
