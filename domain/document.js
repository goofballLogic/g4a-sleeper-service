const { readThrough } = require("../lib/crap-cache");
const { fetchJSONBlobs, fetchJSONBlob } = require("../lib/blobs");
const { listRows, fetchRow } = require("../lib/rows");

const { user: theUser } = require("./user");
const { workflowForItem } = require("./workflow");

module.exports = (log, documentId) => ({

    async read(tenantId, options) {

        return await readThrough([tenantId, documentId, options], async () => {

            const item = await fetchRow(log, "TenantDocuments", tenantId, documentId);
            if (item)
                await decorateItem(options, item);
            return item;

        }, null, log);

    }

});


async function decorateItem(options, item) {
    const { include } = options || {};
    await decorateItemWithUserInformation(log, item);
    const workflow = await workflowForItem(log, item);
    if (workflow)
        item.values = await workflow.fetchWorkflowValues(item);
    if (include)
        await decorateItemWithIncludedProperties(include, item);
}

async function decorateItemWithUserInformation(log, item) {

    if (!item) return;
    try {

        const { createdBy } = item;
        item.createdByUser = await theUser(log, createdBy).fetchADAttributes();

    } catch (err) {

        log(err);
        item.createdByUser = {};

    }

}


async function decorateItemWithIncludedProperties(include, item) {

    await Promise.all(include.map(async include => {

        try {

            if (include === "workflow") {

                const workflow = await workflowForItem(log, item);
                item[include] = workflow && await workflow.fetchDefinition();

            } else if (include === "transitions") {

                const workflow = await workflowForItem(log, item);
                if (workflow) {

                    item.values = item.values || await workflow.fetchWorkflowValues(item);
                    item[include] = await workflow.fetchValidTransitions(item);

                }

            } else if (include === "values") {

                const workflow = await workflowForItem(log, item);
                if (workflow)
                    item[include] = await workflow.fetchWorkflowValues(item);

            } else if (include.endsWith("*")) {

                const prefix = include.substring(0, include.length - 1);
                item[prefix] = await fetchJSONBlobs(log, `${item.id}-${prefix}`, tenantId);

            } else {

                item[include] = await fetchJSONBlob(log, `${item.id}-${include}`, tenantId);

            }

        } catch (err) {

            if (err && err.statusCode == 404) {

                log(`WARN: Not found - ${include} of ${item.id}`);
                return null;

            }
            else
                throw err;

        }

    }));
    return item;

}