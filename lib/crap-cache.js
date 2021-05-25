const cache = {};
const DEFAULT_EXPIRY_MS = process.env.DEFAULT_CACHE_EXPIRY_MS || 30000;

async function read(name) {

    name = maybeStringify(name);
    return cache[name]?.data;

}

async function write(name, data, options) {

    name = maybeStringify(name);
    const expiry = (options && options.expiry) || DEFAULT_EXPIRY_MS;
    setTimeout(() => invalidate(name), expiry);
    cache[name] = { data };

}

async function invalidate(name) {

    name = maybeStringify(name);

    if (!name in cache) return;
    delete cache[name];

}

async function invalidatePrefix(prefix) {

    prefix = maybeStringify(prefix);
    Object.keys(cache).filter(key => key.startsWith(prefix)).forEach(invalidate);

}

async function readThrough(name, fetchStrategy, options, log) {

    name = maybeStringify(name);
    const cached = await read(name);
    if (cached) {

        if (log) log(`DEBUG: Cache hit: ${name}`);
        return cached;

    } else {

        if (log) log(`DEBUG: Cache miss: ${name}`);

    }
    const fetched = await fetchStrategy();
    write(name, fetched, options);
    return fetched;

}

const trailers = /[}\]]*$/g;

function maybeStringify(maybeName) {

    return (typeof maybeName === "string")
        ? maybeName
        : JSON.stringify(maybeName).replace(trailers, "");

}

module.exports = { invalidatePrefix, readThrough };