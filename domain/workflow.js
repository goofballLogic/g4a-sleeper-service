const { listRows, createRowIfNotExists, fetchRow } = require("../lib/rows");
const { fetchJSONBlob, putJSONBlob } = require("../lib/blobs");
const { readThrough, invalidatePrefix } = require("../lib/crap-cache");
const extractors = {
    "metadata": require("./extractors/metadata")
};
const constraintValidators = {
    "nowIsBefore": require("./constraints/nowIsBefore")
};

/* circular ref */
let theTenant = null;
setTimeout(() => { theTenant = require("./tenant").tenant; });
/* end circular ref */

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

        async fetchValidTransitions(item) {

            const { status } = item;
            if (!status) {

                throw new Error("Not implemented");

            }
            const state = await this.fetchDefinitionState(status);
            if (!state) {

                log(`ERROR: Unable to determine valid transitions for state ${status} in workflow ${workflowId} in tenant ${tenantId}`);
                return [];

            }
            return await Promise.all(asArray(state.transitions).map(x =>
                this.resolveConstraint(x, item)
            ));

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

        async fetchDefinitionDefaultState() {

            return await this.fetchDefinitionState();

        },

        async fetchDefinitionState(stateId) {

            const definition = await this.fetchDefinition();
            if (!definition) return { failure: "Workflow missing" };
            const criteria = stateId ? x => x.id === stateId : x => x.default;
            const found = definition.workflow?.find(criteria);
            if (!found) log(`WARN: Workflow state not found: ${stateId || "(default)"}`);
            return found;

        },

        async fetchWorkflowValues(item) {

            const definition = await this.fetchDefinition();
            if (!definition) return { failure: "Workflow missing" };

            const fetching = [];
            if (definition.values) {

                for (const [extractor, spec] of Object.entries(definition.values)) {

                    if (extractor in extractors) {

                        fetching.push(extractors[extractor](log, spec).fetchValuesForItem(item));

                    } else {

                        log(`ERROR: Extractor ${extractor} not recognised in workflow ${workflowId}`);

                    }

                }

            }
            const fetched = await Promise.all(fetching);
            return fetched.reduce((hash, values) => ({ ...hash, ...values }), {});

        },

        async mutateStateForItem(previousValues, nextValues) {

            const nextStateDefinition = await this.fetchDefinitionState(nextValues.status);
            if (!nextStateDefinition) {

                log(`ERROR: Workflow state not found for ${nextValues.id} trying to mutate state`);
                throw new Error("An error occurred");

            }
            log(`Mutating state for item ${nextValues.id} from ${previousValues?.status} to ${nextStateDefinition.id}`);
            assignStatePropertiesToItem(nextValues, nextStateDefinition);
            if (previousValues) {

                const previousStateDefinition = await this.fetchDefinitionState(previousValues.status);
                if (!previousStateDefinition) {

                    log(`ERROR: Previous workflow state not found for ${previousValues.id} trying to mutate state from ${previousValues.status}`);
                    throw new Error("An error occurred");

                }
                if (previousStateDefinition.id !== nextStateDefinition.id) {

                    const transition = asArray(previousStateDefinition.transitions).find(t => t.id === nextStateDefinition.id);
                    if (!transition) {

                        log(`ERROR: Transition not found for ${previousValues.id} trying to mutate state from ${previousValues.status} to ${nextValues.status}`);
                        throw new Error("An error occurred");

                    }
                    if (transition.clone) {

                        return await createCloneForTransition(nextValues, transition);

                    }

                }

            }

        },

        async validateTransition(fromStateId, toStateId) {

            const fromState = await this.fetchDefinitionState(fromStateId);
            if (!fromState) {

                log(`ERROR: Workflow ${workflowId} for tenant ${tenantId} doesn't contain specified state ${fromStateId}`);
                return { failure: "Existing state invalid" };

            }
            const validTransitions = asArray(fromState.transitions);
            if (!validTransitions.find(x => x.id === toStateId)) {

                return {
                    failure: `Invalid target state. Must be one of: ${validTransitions.map(x => x.id).join(", ")}`
                };

            }
            return {};

        },

        async resolveConstraint(transition, item) {

            transition = JSON.parse(JSON.stringify(transition));
            const fail = (key, message) => {

                if (!transition.failedConstraints) transition.failedConstraints = {};
                transition.failedConstraints[key] = message;

            };
            if (!transition.constraint) return transition;
            for (const [key, value] of Object.entries(transition.constraint)) {

                if (key in constraintValidators) {

                    constraintValidators[key](log, value, item, message => fail(key, message));

                } else {

                    throw new Error(`Unknown constraint ${transition.constraint}`);

                }

            }
            return transition;

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

    async function createCloneForTransition(prototype, transition) {

        const targetOwner = transition.clone["target-owner"];
        if (targetOwner && !["parent", "same"].includes(targetOwner))
            throw new Error(`Invalid target owner in transition clone: ${JSON.stringify(transition)}`);
        const cloneWorkflowId = transition.clone["target-workflow"];
        if (!cloneWorkflowId)
            throw new Error(`Invalid target workflow in transition clone: ${JSON.stringify(transition)}`);

        const cloneTenantId = targetOwner === "parent" ? prototype.parentIdTenant : tenantId
        const cloneWorkflow = workflow(log, cloneTenantId, cloneWorkflowId);

        const cloneWorkflowRecord = await cloneWorkflow.fetch();
        if (!cloneWorkflowRecord)
            throw new Error(`Invalid target workflow in transition clone: ${JSON.stringify(transition)}`);
        const state = await cloneWorkflow.fetchDefinitionDefaultState();
        if (!state)
            throw new Error(`No default workflow status for workflow ${cloneWorkflowId} in tenant ${cloneTenantId}`);

        const clone = JSON.parse(JSON.stringify(prototype));
        clone["clone-id"] = clone.id;
        clone["clone-tenant"] = tenantId;
        clone["workflow"] = cloneWorkflowId;
        clone["disposition"] = cloneWorkflowRecord.disposition;

        const cloneTenant = theTenant(log, cloneTenantId);
        const created = await cloneTenant.cloneDocumentForTenant(clone);
        log(`Cloned document ${prototype.id} as ${created.id} in tenant ${cloneTenantId}`);
        return async () => {

            log(`Deleting cloned document ${created.id} in tenant ${cloneTenantId}`);
            await cloneTenant.deleteDocument(created.id);

        };

    }

}

function assignStatePropertiesToItem(item, stateDefinition) {

    item.status = stateDefinition.id;
    item.public = !!stateDefinition.public;
    item.readwrite = !!stateDefinition.readwrite;

}

async function mutateWorkflowStateForItem(log, tenantId, previousValues, nextValues) {

    const workflow = await workflowForItem(log, previousValues || nextValues);
    if (!workflow) {

        log(`ERROR: default workflow state not found mutating state for item ${nextValues.id}, ${tenantId}`);
        throw new Error("An error occurred");

    }
    return await workflow.mutateStateForItem(previousValues, nextValues);

}

async function workflowForItem(log, item) {

    if (!item) throw new Error("Item not specified");
    const tenantId = item.tenant;
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