import Hapi from '@hapi/hapi'
import { prisma } from '../services/prisma'
import joi from 'joi'
import { DMMF } from '@prisma/client/runtime'
import _ from 'lodash'
import { password } from '../controllers/password'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

type PropertyConfig = {
    /** field visible in frontend */
    visible?: boolean
    /** format field value in frontend */
    format?: (v?: string) => string
    /** field alias */
    alias?: string
    /**
     * render upload component in frontend
     */
    upload?: {
        type: string
    }
}

type ActionBody<T> = {
    payload: T
    isValid: boolean
}

interface RequestPayload {
    [key: string]: string
}

interface ActionConfig {
    create?: (
        payload: RequestPayload
    ) => ActionBody<RequestPayload> | Promise<ActionBody<RequestPayload>>
}

type Config = {
    property: {
        [key: string]: PropertyConfig
    }
    actions?: ActionConfig
}

class Property {
    field: DMMF.Field
    config: Config
    constructor(field: DMMF.Field, config: Config) {
        this.field = field
        this.config = config
    }
    isHidden() {
        return this.config.property[this.field.name]?.visible === false
    }
    isRelation() {
        return Boolean(this.field.relationName)
    }
    viewFilter() {
        return !this.isHidden() && !this.isRelation()
    }
    alias() {
        return this.config.property[this.field.name]?.alias
    }
    isUpload() {
        return this.config.property[this.field.name]?.upload
    }
}

const localUploadProvider = async (filesMap: { [key: string]: any }) => {
    const r = {}

    await Promise.all(
        Object.keys(filesMap).map((fieldName) => {
            return new Promise((resolve, reject) => {
                const file = filesMap[fieldName]
                const [, extname] = file.hapi.filename.split('.')
                const key =
                    crypto.randomBytes(20).toString('hex') + '.' + extname
                const _path = path.resolve(__dirname, '../../uploads/' + key)

                const write = fs.createWriteStream(_path)
                write.on('error', (err) => console.error(err))

                file.pipe(write)

                file.on('end', (err) => {
                    r[fieldName] = { key, path: '/uploads/' + key }
                    resolve(true)
                })
            })
        })
    )
    return r
}

function handler(model: DMMF.Model, config: Config) {
    const collection = model.name.toLowerCase()

    const map = new Map()

    const fields = model.fields
        .map((i) => {
            const property = new Property(i, config)
            map.set(i.name, property)
            if (property.alias()) {
                i.alias = property.alias()
            }
            return i
        })
        .filter((i) => {
            if (map.has(i.name)) {
                const property = map.get(i.name)
                return property.viewFilter()
            }
            return true
        })

    const validate = joi.object(
        model.fields.reduce((prev, acc) => {
            const key = acc.name
            let chain: any = joi.string()

            if (acc.isId || acc.relationName) {
                return prev
            }

            if (map.get(key).isUpload()) {
                // TODO: Readable validate
                chain = joi.any()
            } else if (acc.type === 'Boolean') {
                chain = joi.boolean()
            } else if (acc.type === 'Int' || acc.type === 'DateTime') {
                chain = joi.number()
            }

            if (acc.isList) {
                chain = joi.array()
            }

            if (acc.isRequired && !acc.hasDefaultValue) {
                chain = chain.required()
            }

            if (chain) {
                prev[key] = chain
            }

            return prev
        }, {})
    )

    const uploadFields = model.fields.filter((i) => {
        return map.get(i.name).isUpload()
    })

    return [
        {
            method: 'GET',
            path: `/admin/${collection}/{id}`,
            handler: async (request, h) => {
                const { id } = request.params
                return prisma[collection].findUnique({
                    where: {
                        id,
                    },
                })
            },
        },

        {
            method: 'POST',
            path: `/admin/${collection}`,
            options: {
                validate: {
                    payload: validate,
                    failAction: async (request, h, err) => {
                        request.log('error', err)
                        throw err
                    },
                },
                payload: {
                    allow: ['multipart/form-data', 'application/json'],
                    multipart: true,
                    output: 'stream',
                },
            },
            handler: async (request, h) => {
                let payload = request.payload
                if (config.actions?.create) {
                    const { payload: _payload } = await config.actions.create(
                        payload
                    )
                    payload = _payload
                }

                const uploadPayload = uploadFields.reduce((prev, acc) => {
                    if (request.payload[acc.name]) {
                        prev[acc.name] = request.payload[acc.name]
                    }
                    return prev
                }, {})

                const data = await localUploadProvider(uploadPayload)

                await prisma[collection].create({
                    data: { ...payload, ..._.mapValues(data, 'path') },
                })
                return h.response({}).code(201)
            },
        },

        {
            method: 'PATCH',
            path: `/admin/${collection}/{id}`,
            handler: async (request, h) => {
                const payload = request.payload
                const id = request.params.id
                await prisma[collection].update({
                    where: {
                        id,
                    },
                    data: payload,
                })
                return h.response({}).code(201)
            },
        },

        {
            method: 'DELETE',
            path: `/admin/${collection}/{id}`,
            handler: async (request, h) => {
                const id = request.params.id
                await prisma[collection].delete({
                    where: {
                        id,
                    },
                })
                return h.response({}).code(201)
            },
        },

        {
            method: 'GET',
            path: `/admin/${collection}_list`,
            handler: async (request, h) => {
                const { page = 1 } = request.query
                const size = 10

                const list = await prisma[collection].findMany({
                    take: size,
                    skip: size * (page - 1),
                    select: fields
                        .map((i) => i.name)
                        .reduce((prev, acc) => {
                            prev[acc] = true
                            return prev
                        }, {}),
                })
                const count = await prisma[collection].count()
                return {
                    list: list.map((i) => {
                        return Object.keys(i).reduce((prev, acc) => {
                            const property = config.property[acc]
                            if (typeof property === 'object') {
                                // format
                                if (property.format) {
                                    prev[acc] = (
                                        config.property[acc] as any
                                    ).format(i[acc])
                                }
                            }

                            return prev
                        }, i as any)
                    }),
                    page: Math.ceil(count / size),
                }
            },
        },
        {
            method: 'GET',
            path: `/admin/${collection}`,
            handler: async () => {
                return {
                    fields: fields.map((i) => {
                        if (i.kind === 'enum') {
                            i.enumMap = dmmf.datamodelEnumMap[i.type]
                        }
                        return i
                    }),
                    config,
                }
            },
        },
    ]
}

const dmmf = (prisma as any)._baseDmmf

type PluginOption = {
    model: DMMF.Model
    config: Config
}

const plugin = {
    name: 'prisma-crud',
    version: '1.0.0',
    register: async function (server, options) {
        const data: PluginOption[] = [
            {
                model: dmmf.modelMap.User,
                config: {
                    property: {
                        password: {
                            visible: false,
                        },
                        encrypt_id: {
                            alias: '加密ID',
                        },
                        email: {
                            format: (v) => {
                                if (!v) {
                                    return ''
                                }
                                return v.replace(
                                    /[^\@]+(?=@)/g,
                                    (match, p1, p2) => {
                                        return match.slice(0, 4) + '****'
                                    }
                                )
                            },
                        },
                    },
                },
            },
            {
                model: dmmf.modelMap.Admin,
                config: {
                    property: {
                        avatar: {
                            upload: {
                                type: 'image',
                            },
                        },
                        password: {
                            visible: false,
                        },
                    },
                    actions: {
                        create: async (payload) => {
                            if (payload.password) {
                                payload.password = await password.generate(
                                    payload.password
                                )
                            }
                            return {
                                payload: { ...payload },
                                isValid: true,
                            }
                        },
                    },
                },
            },
        ]

        server.route(
            _.flattenDeep(
                data.map((i) => {
                    return handler(i.model, i.config)
                })
            )
        )

        server.route({
            method: 'GET',
            path: '/admin/_dashboard',
            handler: (req, h) => {
                return data.map((i) => {
                    const name = i.model.name.toLowerCase()
                    return {
                        name: name,
                        path: `/${name}`,
                    }
                })
            },
        })

        server.route({
            method: 'POST',
            path: '/admin/_login',
            handler: async (request: Hapi.Request, h: Hapi.ResponseToolkit) => {
                const payload = request.payload as {
                    username: string
                    password: string
                }
                const admin = await prisma.admin.findFirst({
                    where: {
                        username: payload.username,
                    },
                })
                if (!admin) {
                    return {
                        error: '1000',
                        msg: 'User is undefined',
                    }
                }

                if (
                    !(await password.verify(payload.password, admin.password))
                ) {
                    return {
                        error: '1001',
                        msg: 'Login failed',
                    }
                }

                const token = request.server.methods.jwtGenurate({
                    id: admin.id,
                    role: admin.role,
                })

                return {
                    token,
                }
            },
        })
    },
}

export default plugin
