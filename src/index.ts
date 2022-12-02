import Hapi from '@hapi/hapi'

import plugins from './plugins'
import router from './routes'
import os from 'os'

const server = Hapi.server({
    port: 4000,
    routes: {
        cors: {
            origin: [
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'http://localhost:3001',
            ],
        },
    },
})

server.route({
    method: 'GET',
    path: '/ping',
    handler: () => {
        return 'pong'
    },
})

const start = async () => {
    await server.register([...plugins, router])
    await server.start()
    console.log('start')
}

start()

server.events.on('request', (request, event: any, tags) => {
    if (tags.error) {
        console.log(
            `Request ${event.request} error: ${
                event.error ? event.error.message : 'unknown'
            }`
        )
    }
})

process.on('unhandledRejection', async (err) => {
    console.error('unhandledRejection', err)
})

process.on('SIGINT', async () => {
    process.exit(0)
})
