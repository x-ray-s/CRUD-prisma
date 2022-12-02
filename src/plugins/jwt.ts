import Jwt from '@hapi/jwt'
import Hapi from '@hapi/hapi'
import { Types } from '../services/prisma'

type Admin = Pick<Types.Admin, 'id' | 'role'>

const jwtPlugin: Hapi.Plugin<null> = {
    name: '_jwt',
    register: async function (server: Hapi.Server) {
        await server.register(Jwt)

        server.auth.strategy('jwt', 'jwt', {
            keys: process.env.SECRET,
            verify: {
                aud: false,
                iss: false,
                sub: false,
                exp: !process.env.DEBUG,
            },
            validate: (artifacts) => {
                return {
                    isValid: true,
                }
            },
        })
        // default auth strategy
        // server.auth.default('jwt')
        server.method({
            name: 'jwtGenurate',
            method: (user: Admin) => {
                return Jwt.token.generate(user, process.env.SECRET, {
                    ttlSec: 7 * 24 * 60 * 60, // 7 day
                })
            },
        })
    },
}

export default jwtPlugin
