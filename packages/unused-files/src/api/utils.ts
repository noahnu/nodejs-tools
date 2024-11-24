import fs from 'node:fs'
import { isBuiltin } from 'node:module'

export async function resolveRealpath(request: string): Promise<string> {
    if (isBuiltin(request)) {
        return request
    }
    try {
        return await fs.promises.realpath(request)
    } catch {
        return request
    }
}
