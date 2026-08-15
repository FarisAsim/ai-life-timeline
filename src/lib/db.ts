import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Turso cloud support: when TURSO_DATABASE_URL is set (e.g. in Vercel),
// the Prisma client is created with the libSQL adapter.
// Otherwise it falls back to the local SQLite file (DATABASE_URL).
export const db =
  globalForPrisma.prisma ??
  ((): PrismaClient => {
    const tursoUrl = process.env.TURSO_DATABASE_URL
    if (tursoUrl) {
      const url = tursoUrl.startsWith('libsql://')
        ? tursoUrl
        : `libsql://${tursoUrl}`
      const adapter = new PrismaLibSql({ url })
      return new PrismaClient({ adapter, log: ['error', 'warn'] })
    }
    return new PrismaClient({ log: ['error', 'warn'] })
  })()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
