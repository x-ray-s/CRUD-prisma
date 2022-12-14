import _ from 'lodash'
import { DMMF } from '@prisma/client/runtime'
import { prisma } from '../../services/prisma'
import { Configuration } from './config'
import type { FieldsConfig, Actions, Operate, JWTCredentials } from './config'

const dmmf = (prisma as any)._baseDmmf

type Pagination = {
    page: number
    size: number
}

type EnumMap = {
    [key: string]: DMMF.EnumValue[]
}

type HeadField = DMMF.Field & {
    alias?: string
    component?: 'string'
}

type HeadResponseBody = {
    enums?: EnumMap
    fields: HeadField[]
    config: FieldsConfig
}

class Controller {
    model: DMMF.Model
    name: string
    fields: DMMF.Field[]
    config: Configuration
    _config: FieldsConfig
    constructor(model: DMMF.Model, config: FieldsConfig) {
        this.model = model
        this.name = model.name.toLowerCase()
        this.fields = model.fields
        this.config = new Configuration(config)
        this._config = config
    }
    async list(pagination: Pagination) {
        const { page, size } = pagination
        const data = await prisma[this.name].findMany({
            take: size,
            skip: size * (page - 1),
        })
        const removeKeys = this.config.visibleExcludeKeys('list')
        const count = await prisma[this.name].count()
        return {
            data: _.map(data, (i) => _.omit(i, removeKeys)),
            page: Math.ceil(count / size),
        }
    }
    async create(data) {
        const { create } = this.config.getActions()
        if (create) {
            const { payload } = await create(data)
            return prisma[this.name].create({
                data: payload,
            })
        }
        return prisma[this.name].create({
            data,
        })
    }
    async read(id: string) {
        const data = await prisma[this.name].findUnique({
            where: {
                id,
            },
        })

        const removeKeys = this.config.visibleExcludeKeys('read')

        return _.omit(data, removeKeys)
    }
    async update(id: string, payload) {
        return prisma[this.name].update({
            where: {
                id,
            },
            data: _.omit(payload, 'id'),
        })
    }
    async delete(id: string) {
        return prisma[this.name].delete({
            where: {
                id,
            },
        })
    }
    head(actions?: Actions): HeadResponseBody {
        // ?????? visible
        // ?????? enum
        // ?????? alias
        const removeKeys = this.config.visibleExcludeKeys(actions)

        let fields = _.filter(
            this.fields,
            (field) => !removeKeys.includes(field.name)
        ).map((field) => {
            // ?????? component
            const component = this.config.component(field.name)
            // ?????? alias
            const alias = this.config.alias(field.name)

            return { ...field, component, alias }
        })
        // ???????????????????????? id
        if (actions === 'create' || actions === 'update') {
            fields = _.filter(fields, (feild) => !feild.isId)
        }

        return {
            enums: _.chain(this.fields)
                .filter((field) => field.kind === 'enum')
                .keyBy('type')
                .mapValues((field) => dmmf.datamodelEnumMap[field.type].values)
                .value(),
            fields,
            config: this._config,
        }
    }
    async authority(operate: Operate, auth?: JWTCredentials) {
        const operation = this.config.getPermissions()[operate]
        if (typeof operation === 'boolean') {
            return operation
        }
        if (typeof operation === 'function') {
            return await operation(auth)
        }
        return true
    }
}

export default Controller
