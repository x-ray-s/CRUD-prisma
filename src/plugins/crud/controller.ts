import _ from 'lodash'
import { DMMF } from '@prisma/client/runtime'
import { prisma } from '../../services/prisma'
import { Configuration } from './config'
import type { FieldsConfig, Actions } from './config'

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
        const count = await prisma[this.name].count()
        return {
            data,
            page: Math.ceil(count / size),
        }
    }
    async create(data) {
        prisma[this.name].create({
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
        prisma[this.name].update({
            where: {
                id,
            },
            data: payload,
        })
    }
    async delete(id: string) {
        prisma[this.name].delete({
            where: {
                id,
            },
        })
    }
    head(actions?: Actions): HeadResponseBody {
        // 处理 visible
        // 处理 enum
        // 处理 alias
        const removeKeys = this.config.visibleExcludeKeys(actions)

        let fields = _.filter(
            this.fields,
            (feild) => !removeKeys.includes(feild.name)
        )
        // 创建时过滤 id
        if (actions === 'create') {
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
}

export default Controller
