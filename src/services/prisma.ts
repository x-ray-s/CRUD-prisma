import Types, { PrismaClient } from '@prisma/client'

declare global {
    var prisma: PrismaClient
}

const prisma = globalThis.prisma || new PrismaClient()
// new PrismaClient({ log: process.env.DEBUG ? ['query', 'info'] : [] })

if (process.env.DEBUG) globalThis.prisma = prisma

export { Types, PrismaClient, prisma }
