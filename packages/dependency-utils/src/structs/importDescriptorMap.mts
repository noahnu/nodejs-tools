import { createHash } from 'node:crypto'

export enum ImportDescriptorKind {
    Import = 'import',
    DynamicImport = 'dynamic-import',
    Require = 'require',
}

export interface ImportDescriptor {
    /** The manner in which the dependency was imported. */
    kind: ImportDescriptorKind

    /** The original request. E.g. "react/test-utils". */
    source: string
}

export class ImportDescriptorMap<V> {
    private map: Map<string, V>

    constructor() {
        this.map = new Map()
    }

    private computeKeyHash(descriptor: ImportDescriptor): string {
        const hash = createHash('sha512')

        hash.update(
            JSON.stringify({
                kind: descriptor.kind,
                source: descriptor.source,
            }),
        )

        return hash.digest('hex')
    }

    get size() {
        return this.map.size
    }
    clear(): void {
        this.map.clear()
    }
    delete(key: ImportDescriptor): boolean {
        return this.map.delete(this.computeKeyHash(key))
    }
    get(key: ImportDescriptor): V | undefined {
        return this.map.get(this.computeKeyHash(key))
    }
    has(key: ImportDescriptor): boolean {
        return this.map.has(this.computeKeyHash(key))
    }
    set(key: ImportDescriptor, value: V): this {
        this.map.set(this.computeKeyHash(key), value)
        return this
    }
    keys(): MapIterator<string> {
        return this.map.keys()
    }
    values(): MapIterator<V> {
        return this.map.values()
    }
    entries(): MapIterator<[string, V]> {
        return this.map.entries()
    }
    [Symbol.iterator](): MapIterator<[string, V]> {
        return this.entries()
    }
}

export class ImportDescriptorSet {
    private map: ImportDescriptorMap<ImportDescriptor>

    constructor() {
        this.map = new ImportDescriptorMap<ImportDescriptor>()
    }

    add(value: ImportDescriptor) {
        this.map.set(value, value)
    }

    has(value: ImportDescriptor): boolean {
        return this.map.has(value)
    }

    values(): Iterable<ImportDescriptor> {
        return this.map.values()
    }

    [Symbol.iterator](): Iterator<ImportDescriptor> {
        return this.map.values()
    }
}
