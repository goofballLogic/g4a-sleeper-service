const cache = {};
const DEFAULT_EXPIRY_MS = process.env.DEFAULT_CACHE_EXPIRY_MS || 30000;

async function read(name) {

    name = maybeStringify(name);
    console.log("Cache", (name in cache) ? "hit" : "miss", name);
    return cache[name]?.data;

}

async function write(name, data) {

    name = maybeStringify(name);
    setTimeout(() => invalidate(name), DEFAULT_EXPIRY_MS);
    cache[name] = { data };

}

async function invalidate(name) {

    name = maybeStringify(name);

    if (!name in cache) return;
    console.log("Cache invalidate", name);
    delete cache[name];

}

async function invalidatePrefix(prefix) {

    prefix = maybeStringify(prefix);
    Object.keys(cache).filter(key => key.startsWith(prefix)).forEach(invalidate);

}

async function readThrough(name, fetchStrategy) {

    name = maybeStringify(name);
    const cached = await read(name);
    if (cached) return cached;
    const fetched = await fetchStrategy();
    write(name, fetched);
    return fetched;

}

const trailers = /[}\]]*$/g;

function maybeStringify(maybeName) {

    return (typeof maybeName === "string")
        ? maybeName
        : JSON.stringify(maybeName).replace(trailers, "");

}

module.exports = { invalidatePrefix, readThrough };