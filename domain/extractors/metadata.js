module.exports = function (log, spec) {

    const tenant = require("../tenant").tenant;

    return {

        async fetchValuesForItem(item) {

            let parent = null;
            const result = {};
            for (let [path, key] of Object.entries(spec)) {

                dataSource = item;
                const pathBits = path.split(".");
                if (pathBits.length > 1) {

                    const sourcePath = pathBits.shift();
                    if (sourcePath === "parent") {

                        if (!parent) {

                            parent = await loadParentForItem(item);

                        }
                        dataSource = parent;

                    } else {

                        log(`ERROR: Invalid compound path "${path}" in spec ${JSON.stringify(spec)} reading item ${item.id}`);

                    }

                }
                const value = dataSource ? dataSource[pathBits[0]] : undefined;
                result[key] = value;

            }
            return result;

        }

    }

    async function loadParentForItem(item) {

        const { parentId, parentIdTenant } = item;
        if (!(parentId && parentIdTenant)) {

            log(`WARN: No parent found for item ${item.id} trying to access metadata values`);
            return null;

        }
        const parentTenant = tenant(log, parentIdTenant);
        return await parentTenant.fetchDocument(parentId);

    }

};