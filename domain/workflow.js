const { listRows, createRowIfNotExists, fetchRow } = require("../lib/rows");
const { fetchJSONBlob, putJSONBlob } = require("../lib/blobs");
const { readThrough, invalidatePrefix } = require("../lib/crap-cache");

const WORKFLOW_CACHE_EXPIRY_MS = process.env.WORKFLOW_CACHE_EXPIRY_MS || (1000 * 60 * 5);
const safeEncode = x => x.toLowerCase().replace(/\W/g, "_");

function commonDefaults() {

    const now = new Date().toISOString();
    return { created: now, updated: now };

}

const asArray = x => Array.isArray(x) ? x : x ? [x] : [];

function workflow(log, tenantId, workflowId) {

    return {

        async fetch(options) {

            return await readThrough([tenantId, workflowId, options], async () => {

                const record = await fetchRow(log, "TenantWorkflows", tenantId, workflowId);
                if (options && options.include) {

                    const includes = options.include.split(",").map(x => x.trim()).filter(x => x);
                    for (const include of includes) {

                        if (include === "workflow") {

                            record.workflow = await this.fetchDefinition();

                        } else {

                            log(`WARN: Invalid workflow include requested: ${include}`);

                        }

                    }

                }
                return record;

            }, null, log);

        },

        async fetchValidTransitions(currentStatus) {

            if (!currentStatus) {

                throw new Error("Not implemented");

            }
            const state = await this.fetchDefinitionState(currentStatus);
            if (!state) {

                log(`ERROR: Unable to determine valid transitions for state ${currenStatus} in workflow ${workflowId} in tenant ${tenantId}`);
                return [];

            }
            return asArray(state.transitions);

        },

        async fetchDefinition() {

            const blobName = `workflow/${workflowId}`;
            return await readThrough(
                [tenantId, blobName],
                async () => await fetchJSONBlob(log, blobName, tenantId),
                { expiry: WORKFLOW_CACHE_EXPIRY_MS },
                log
            );

        },

        async fetchDefinitionState(stateId) {

            const definition = await this.fetchDefinition();
            if (!definition) return { failure: "Workflow missing" };
            const criteria = stateId ? x => x.id === stateId : x => x.default;
            const found = definition.workflow?.find(criteria);
            if (!found) log(`WARN: Workflow state not found: ${stateId}`);
            return found;

        },

        async mutateStateForItem(item) {

            const stateDefinition = await this.fetchDefinitionState(item.status);
            if (!stateDefinition) {

                log(`ERROR: Workflow state not found for ${item.id} trying to mutate state`);
                throw new Error("An error occurred");

            }
            log(`Mutating state for item ${JSON.stringify(item)} - ${JSON.stringify(stateDefinition)}`);
            item.status = stateDefinition.id;
            item.public = !!stateDefinition.public;
            item.readwrite = !!stateDefinition.readwrite;

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

                log(`Adding new workflow ${workflowDefinition.name} (${workflowId}) for ${tenantId}`);
                await putJSONBlob(log, `workflow/${workflowId}`, tenantId, workflowDefinition);

            }

        }

    };

}

async function mutateWorkflowStateForItem(log, tenantId, item) {

    const workflow = await workflowForItem(log, tenantId, item);
    if (!workflow) {

        log(`ERROR: default workflow state not found mutating state for item ${item.id}, ${tenantId}`);
        throw new Error("An error occurred");

    }
    await workflow.mutateStateForItem(item);

}

async function workflowForItem(log, tenantId, item) {

    if (!item) throw new Error("Item not specified");
    if (!tenantId) throw new Error("TenantId not specified");
    const workflowId = item.workflow;
    const disposition = item.disposition;
    const cacheKey = [tenantId, "workflow-for-item", workflowId, disposition];
    const record = await readThrough(cacheKey, async () => {

        if (workflowId)
            return await fetchRow(log, "TenantWorkflows", tenantId, workflowId);
        else if (disposition) {

            return (await listRows(log, "TenantWorkflows", tenantId, [
                ["default eq ?", true],
                ["disposition eq ?", disposition]
            ]))[0];

        }
        return null;

    }, { expiry: WORKFLOW_CACHE_EXPIRY_MS }, log);
    if (!record) {

        log(`WARN: missing workflow for ${item.id} in ${tenantId}`);
        await invalidatePrefix(cacheKey);
        return null;

    }
    return workflow(log, tenantId, record.id);

}

module.exports = {
    safeEncode,
    workflow,
    workflowForItem,
    mutateWorkflowStateForItem
};