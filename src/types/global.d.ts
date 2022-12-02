declare namespace NodeJS {
    export interface ProcessEnv {
        DATABASE_URL: string
        DEBUG?: boolean
        SECRET: string
    }
}
