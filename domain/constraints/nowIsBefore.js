const access = require("../../lib/access");

module.exports = function nowIsBefore(log, path, item, fail) {

    if (!path && typeof (path) === "string")
        throw new Error(`Invalid path specifid: ${path}`);

    const itemValue = access(item, path);
    if (!itemValue) {

        log(`WARN: no value found for ${path} in ${item.id} ${item.tenant}`);

    } else {

        try {

            if (itemValue.value.length === 10)
                itemValue.value += "T00:00:00.000Z";
            const parsed = new Date(itemValue.value);
            if (parsed.valueOf() < Date.now()) {

                fail(`Date has expired (${itemValue.value})`);

            }

        } catch (err) {

            log(`ERROR: failed to parse value ${itemValue.value} for ${value} in ${item.id} ${item.tenant}`);
            fail("Non date value specified");

        }

    }

};