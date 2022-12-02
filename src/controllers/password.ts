import crypto from 'crypto'

export default class Password {
    #secret: string

    constructor(secret: string) {
        this.#secret = secret
    }

    generate(pwd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(
                pwd,
                this.#secret,
                1024,
                64,
                'sha256',
                (err, derivedKey) => {
                    if (err) reject(err)
                    resolve(derivedKey.toString('hex'))
                }
            )
        })
    }
    async verify(pwd: string, pwd_hash: string): Promise<boolean> {
        const hash = await this.generate(pwd)
        return hash === pwd_hash
    }
}
const password = new Password(process.env.SECRET)

export { password }
