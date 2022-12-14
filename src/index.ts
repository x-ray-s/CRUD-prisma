import Hapi from '@hapi/hapi'
import inert from '@hapi/inert'
import path from 'path'

import plugins from './plugins'
import router from './routes'
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
        files: {
            relativeTo: path.join(__dirname, '../uploads'),
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

server.route({
    method: 'GET',
    path: '/401',
    handler: (request, h) => {
        return h.response({}).code(401)
    },
})

const start = async () => {
    await server.register([...plugins, inert, router])

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
