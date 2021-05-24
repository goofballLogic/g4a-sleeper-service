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

        async fetchDefinitionState(stateId) {

            const definition = await this.fetchDefinition();
            if (!definition) return { failure: "Workflow missing" };

            return definition.workflow?.find(x => x.id === stateId);

        },

        async validateTransition(fromStateId, toStateId) {

            const fromState = await this.fetchDefinitionState(fromStateId);
            if (!fromState) {

                log(`ERROR: Workflow ${workflowId} for tenant ${tenantId} doesn't contain specified state ${fromStateId}`);
                return { failure: "Existing state invalid" };

            }
            const validTransitions = Array.isArray(fromState.transitions)
                ? fromState.transitions
                : fromState.transitions
                    ? [fromState.transitions]
                    : [];

            if (!validTransitions.find(x => x.id === toStateId)) {

                return {
                    failure: `Invalid target state. Must be one of: ${validTransitions.map(x => x.id).join(", ")}`
                };

            }
            return {};

        },

        async ensureExists(workflowDefinition) {

            const isNew = await createRowIfNotExists(
                log,
                "TenantWorkflows",
                tenantId,
                workflowId,
                {
                    ...commonDefaults(),
                    default: !!(workflowDefinition?.default),
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
    if (!record) {

        log(`WARN: missing workflow for ${item.id} in ${tenantId}`);
        return null;

    }
    return workflow(log, tenantId, record.id);

}


module.exports = { workflow, workflowForItem };