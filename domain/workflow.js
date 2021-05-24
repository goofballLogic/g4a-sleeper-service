const { listRows, createRowIfNotExists } = require("../lib/rows");
const { fetchJSONBlob, putJSONBlob } = require("../lib/blobs");

function commonDefaults() {

    const now = new Date().toISOString();
    return { created: now, updated: now };

}

function workflow(log, tenantId, workflowId) {

    return {

        async fetchDefinition() {

            return await fetchJSONBlob(log, `workflow/${workflowId}`, tenantId);

        },

        async ensureExists(workflowDefinition) {

            const isNew = await createRowIfNotExists(
                log,
                "TenantWorkflows",
                tenantId,
                workflowId,
                {
                    ...commonDefaults(),
                    id: workflowId,
                    name: workflowDefinition.name,
                    disposition: workflowDefinition.disposition
                }
            );
            if (isNew) {

                log(`Adding new workflow ${workflowDefinition.name} for ${tenantId}`);
                await putJSONBlob(log, `workflow/${workflowDefinition.name}`, tenantId, workflowDefinition);

            }

        }

    };

}

async function workflowForItem(log, tenantId, item) {

    if (!item) throw new Error("Item not specified");
    if (!tenantId) throw new Error("TenantId not specified");

    const workflowId = item.workflow;
    const disposition = item.disposition;
    let record;
    if (workflowId)
        record = await fetchRow(log, "TenantWorkflows", tenantId, workflowId);
    else if (disposition) {

        record = (await listRows(log, "TenantWorkflows", tenantId, [
            ["default eq ?", true],
            ["disposition eq ?", disposition]
        ]))[0];

    }
    if (!record) return null;
    return workflow(log, tenantId, record.id);

}


module.exports = { workflow, workflowForItem };