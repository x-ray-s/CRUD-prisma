## Feature

- Primsa Mongodb Schema
  - model field scalar types
    - [x] String
    - [x] Boolean
    - [x] Int
    - [x] BigInt
    - [x] Float
    - [x] DateTime
    - [x] Json
    - [ ] Bytes
    - [ ] Decimal
  - modifier
    - [x] `?` modifier
    - [x] `[]` modifier
  - enums
- Hapijs server
  - JWT Auth
  - CRUD RESTful API
  - Upload Image Files
- Vue frontend
  - CRUD Dashboard
- Daisyui

## Custom Component

- Datetime Select
- Select

## Todo List

## Types

```typescript
export interface Field {
  kind: FieldKind
  name: string
  /**
   * Form validation use this field
   * and input required attribute
   */
  isRequired: boolean
  /**
   * The field is array
   */
  isList: boolean
  isUnique: boolean
  isId: boolean
  isReadOnly: boolean
  isGenerated?: boolean
  isUpdatedAt?: boolean
  /**
   * Describes the data type in the same the way is is defined in the Prisma schema:
   * BigInt, Boolean, Bytes, DateTime, Decimal, Float, Int, JSON, String, $ModelName
   * UI Components which used in created form are rendered based on type.
   */
  type: string
  dbNames?: string[] | null
  /**
   * Autocompelete and default value when create document
   */
  hasDefaultValue: boolean
  default?: FieldDefault | FieldDefaultScalar | FieldDefaultScalar[]
  relationFromFields?: string[]
  relationToFields?: any[]
  relationOnDelete?: string
  relationName?: string
  documentation?: string
  [key: string]: any
}
```
