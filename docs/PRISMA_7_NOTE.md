# Why Prisma is pinned to 6.x

Prisma 7 requires moving the datasource URL out of `schema.prisma`
into a `prisma.config.ts` + driver adapter (`@prisma/adapter-pg`)
setup. That's a real architectural change, not a drop-in upgrade, and
wasn't worth adopting on day one of this project. Revisit once the
driver-adapter pattern is more established across the ecosystem.
