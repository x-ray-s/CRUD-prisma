import Hapi from '@hapi/hapi'
import { PrismaClient } from '@prisma/client'

declare module '@hapi/hapi' {
    interface ServerApplicationState {
        prisma: PrismaClient
    }

    interface ResponseToolkit {
        file: (route: string, options?: any) => {}
    }
}
