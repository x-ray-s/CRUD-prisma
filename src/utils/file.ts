import { readdir } from 'fs/promises'
import path from 'path'
import _ from 'lodash'
/**
 * ts dynamic import files
 * which are in root dir
 * excludes index and sourcemap
 */
const importRootFiles = async (_path: string) => {
    const files = await readdir(_path, { withFileTypes: true })
    const extname = process.env.TS_NODE_DEV ? 'ts' : 'js'
    const filename = `index.${extname}`

    const withoutSourcemap = files.filter(
        (i) => i.name !== filename && !i.name.endsWith('.map')
    )

    return Promise.all(
        withoutSourcemap.map((i) => {
            let name = i.name
            if (i.isDirectory()) {
                name = i.name + '/' + filename
            }
            return import(path.join(_path, name))
        })
    )
}

export { importRootFiles }
