class LRUMap<V> {
    #map: Map<string, V>
    #keys: string[]

    constructor(private options: { size: number }) {
        this.#map = new Map()
        this.#keys = []
    }

    has(key: string): boolean {
        return this.#map.has(key)
    }

    get(key: string): V | undefined {
        return this.#map.get(key)
    }

    set(key: string, value: V): void {
        if (!this.has(key)) {
            if (this.#keys.length > this.options.size) {
                const oldestKey = this.#keys.shift()
                if (oldestKey) {
                    this.#map.delete(oldestKey)
                }
            }
            this.#keys.push(key)
        }
        this.#map.set(key, value)
    }

    clear(): void {
        this.#keys.splice(0, this.#keys.length)
        this.#map.clear()
    }
}

type LRUCacheEnhanced<F extends (...args: any[]) => any> = F & { clear(): void }

export function lru<F extends (...args: any[]) => any>(
    func: F,
    options: {
        size: number
    },
): F {
    const cache = new LRUMap<F>({ size: options.size })
    return Object.assign(
        (...args: Parameters<F>): ReturnType<F> => {
            const key = JSON.stringify(args)
            if (cache.has(key)) {
                return cache.get(key) as ReturnType<F>
            }

            const result: ReturnType<F> = func(...args)
            cache.set(key, result)
            return result
        },
        {
            clear() {
                cache.clear()
            },
        },
    ) as LRUCacheEnhanced<F>
}
