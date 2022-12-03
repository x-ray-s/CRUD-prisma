import Hapi from '@hapi/hapi'
import _ from 'lodash'
import { importRootFiles } from '../utils/file'

const routerPlugin: Hapi.Plugin<null> = {
    name: 'router',
    register: async function (server: Hapi.Server) {
        const routes = await importRootFiles(__dirname)

        server.route({
            method: 'GET',
            path: '/uploads/{param*}',
            handler: {
                directory: {
                    path: '.',
                    redirectToSlash: true,
                    index: true,
                },
            },
        })

        server.route([
            ..._.flattenDeep(
                routes.map((i) => {
                    return i.default as []
                })
            ),
        ] as Hapi.ServerRoute[])
    },
}

export default routerPlugin
