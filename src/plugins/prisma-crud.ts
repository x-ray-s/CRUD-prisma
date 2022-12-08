import Hapi from '@hapi/hapi'
import { prisma } from '../services/prisma'
import joi from 'joi'
import { DMMF } from '@prisma/client/runtime'
import _ from 'lodash'
import { password } from '../controllers/password'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import Controller from './crud/controller'
import { Configuration } from './crud/config'
import type { PropertyConfig } from './crud/config'

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

type FieldsConfig = {
    property: {
        [key: string]: PropertyConfig
    }
    actions?: ActionConfig
}

const localUploadProvider = async (filesMap: {
    [key: string]: any
}): Promise<{
    [key: string]: {
        key: string
        path: string
    }
}> => {
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
const stringify = (data) => {
    return JSON.stringify(
        data,
        (key, value) => (typeof value === 'bigint' ? value.toString() : value) // return everything else unchanged
    )
}

function handler(model: DMMF.Model, config: FieldsConfig) {
    const collection = model.name.toLowerCase()

    const controller = new Controller(model, config)
    const configure = new Configuration(config)
    const customComponentKeys = configure.componentKeys()

    const validate = joi.object(
        model.fields.reduce((prev, acc) => {
            const key = acc.name
            let chain: any = joi.string()

            if (acc.isId || acc.relationName) {
                return prev
            }

            if (customComponentKeys.includes(acc.name)) {
                // TODO: Readable validate
                chain = joi.any()
            } else if (acc.type === 'Boolean') {
                chain = joi.boolean()
            } else if (
                acc.type === 'Int' ||
                acc.type === 'BigInt' ||
                acc.type === 'Float'
            ) {
                chain = joi.number()
            } else if (acc.type === 'Json') {
                chain = joi.object()
            } else if (acc.type === 'DateTime') {
                chain = joi.date().timestamp()
            }

            if (acc.isList) {
                chain = joi.array()
            }

            if (acc.isRequired && !acc.hasDefaultValue && !acc.isUpdatedAt) {
                chain = chain.required()
            } else {
                if (acc.type === 'String') {
                    chain = chain.allow('')
                }
            }

            if (chain) {
                prev[key] = chain
            }

            return prev
        }, {})
    )

    const validatePatch = joi.object(
        model.fields.reduce((prev, acc) => {
            const key = acc.name
            let chain: any = joi.string()

            if (acc.isId || acc.relationName) {
                return prev
            }

            if (customComponentKeys.includes(acc.name)) {
                // TODO: Readable validate
                chain = joi.any()
            } else if (acc.type === 'Boolean') {
                chain = joi.boolean()
            } else if (
                acc.type === 'Int' ||
                acc.type === 'BigInt' ||
                acc.type === 'Float'
            ) {
                chain = joi.number()
            } else if (acc.type === 'Json') {
                chain = joi.object()
            } else if (acc.type === 'DateTime') {
                chain = joi.date().timestamp()
            }

            if (acc.isList) {
                chain = joi.array()
            }

            chain = chain.optional()

            if (chain) {
                prev[key] = chain
            }

            return prev
        }, {})
    )

    return [
        {
            method: 'GET',
            path: `/admin/${collection}/{id}`,
            handler: async (request, h) => {
                const { id } = request.params
                const data = await controller.read(id)
                return stringify(data)
            },
        },
        {
            method: 'POST',
            path: `/admin/${collection}/upload`,
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

                const uploadPayload = customComponentKeys.reduce(
                    (prev, acc) => {
                        if (request.payload[acc]) {
                            prev[acc] = request.payload[acc]
                        }
                        return prev
                    },
                    {}
                )

                const data = await localUploadProvider(uploadPayload)

                await controller.create({
                    ...payload,
                    ..._.mapValues(data, 'path'),
                })
                return h.response({}).code(201)
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
            },
            handler: async (request, h) => {
                await controller.create(request.payload)
                return h.response({}).code(201)
            },
        },

        {
            method: 'PATCH',
            path: `/admin/${collection}/{id}`,
            options: {
                validate: {
                    payload: validatePatch,
                },
            },
            handler: async (request, h) => {
                const { id } = request.params
                await controller.update(id, request.payload)
                return h.response({}).code(201)
            },
        },

        {
            method: 'DELETE',
            path: `/admin/${collection}/{id}`,
            handler: async (request, h) => {
                const { id } = request.params
                await controller.delete(id)
                return h.response({}).code(201)
            },
        },

        {
            method: 'GET',
            path: `/admin/${collection}_list`,
            handler: async (request, h) => {
                const { page = 1 } = request.query
                const size = 10

                const data = await controller.list({
                    page,
                    size,
                })
                return stringify(data)
            },
        },
        {
            method: 'GET',
            path: `/admin/${collection}`,
            handler: (request: Hapi.Request) => {
                const { type } = request.query
                return controller.head(type)
            },
        },
    ]
}

const dmmf = (prisma as any)._baseDmmf

type PluginOption = {
    model: DMMF.Model
    config: FieldsConfig
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
                            component: 'upload',
                        },
                        password: {
                            visible: {
                                list: false,
                                read: false,
                            },
                        },
                        role: {
                            alias: '权限',
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
            {
                model: dmmf.modelMap.Post,
                config: {
                    property: {
                        text: {
                            component: 'quill',
                        },
                    },
                },
            },
            {
                model: dmmf.modelMap.Types,
                config: {
                    property: {},
                },
            },
            {
                model: dmmf.modelMap.Modifier,
                config: {
                    property: {},
                },
            },
            {
                model: dmmf.modelMap.Attributes,
                config: {
                    property: {},
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
