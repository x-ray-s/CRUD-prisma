import _ from 'lodash'
import { DMMF } from '@prisma/client/runtime'

export type Actions = 'create' | 'list' | 'update' | 'delete' | 'read'

type Visible = Partial<Record<Actions, boolean>>

export type PropertyConfig = {
    /** field visible in frontend */
    visible?: boolean | Visible
    /** format field value in frontend */
    format?: (v?: string) => string
    /** field alias */
    alias?: string
    /**
     * render upload component in frontend
     */
    component?: 'upload'
}

interface RequestPayload {
    [key: string]: string
}

type ActionBody<T> = {
    payload: T
    isValid: boolean
}

interface ActionConfig {
    create?: (
        payload: RequestPayload
    ) => ActionBody<RequestPayload> | Promise<ActionBody<RequestPayload>>
}

export type FieldsConfig = {
    property: {
        [key: string]: PropertyConfig
    }
    actions?: ActionConfig
}

export class Configuration {
    config: FieldsConfig
    constructor(config: FieldsConfig) {
        this.config = config
    }
    /**
     * exclude invisible key
     * @param actions
     * @returns string[]
     */
    visibleExcludeKeys(actions?: Actions): string[] {
        const properties = this.config.property
        return _.chain(properties)
            .keys()
            .filter((key: string) => {
                const property = properties[key]
                if (property.visible && actions) {
                    return property.visible?.[actions] === false
                }

                return property.visible === false
            })
            .value()
    }

    getProperty(key: string) {
        return this.config.property[key]
    }

    alias(key) {
        return this.getProperty(key)?.alias
    }

    component(key) {
        return this.getProperty(key)?.component
    }
}

export class Property {
    field: DMMF.Field
    config: FieldsConfig
    constructor(field: DMMF.Field, config: FieldsConfig) {
        this.field = field
        this.config = config
    }
    isHidden() {
        return this.config.property[this.field.name]?.visible === false
    }
    isActionHidden(actions: Actions) {
        if (this.isHidden()) {
            return this.isHidden()
        }
        return (
            this.config.property[this.field.name]?.visible?.[actions] === false
        )
    }
    isRelation() {
        return Boolean(this.field.relationName)
    }
    alias() {
        return this.config.property[this.field.name]?.alias
    }
    isUpload() {
        return this.config.property[this.field.name]?.component === 'upload'
    }
}
