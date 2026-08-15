// Prisma 7 configuration: connection URL lives here instead of schema.prisma.
import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
})
