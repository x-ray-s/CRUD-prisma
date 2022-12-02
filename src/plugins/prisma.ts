import Hapi from '@hapi/hapi'
import pc from 'picocolors'

import { prisma } from '../services/prisma'

// plugin to instantiate Prisma Client
const prismaPlugin: Hapi.Plugin<null> = {
    name: 'prisma',
    register: async function (server: Hapi.Server) {
        server.app.prisma = prisma
        // console connect ping
        console.info(
            await prisma.$runCommandRaw({
                ping: '1',
            })
        )
        console.info(pc.bgGreen(pc.black('mongodb connected')))
        // Close DB connection after the server's connection listeners are stopped
        // Related issue: https://github.com/hapijs/hapi/issues/2839
        server.ext({
            type: 'onPostStop',
            method: async (server: Hapi.Server) => {
                server.app.prisma?.$disconnect()
            },
        })
    },
}

export default prismaPlugin
