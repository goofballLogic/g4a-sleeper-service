const { upsertRow, createRow, listRows, fetchRow, deleteRow, createRowIfNotExists } = require("../lib/rows");
const { fetchJSONBlob, putJSONBlob, copyPrefixedBlobs } = require("../lib/blobs");
const { invalidatePrefix, readThrough } = require("../lib/crap-cache");
const { user: theUser } = require("./user");

function commonDefaults() {

    const now = new Date().toISOString();
    return { created: now, updated: now };

}

const newid = () => `${Date.now()}_${Math.round(Math.random() * 1000000)}`;

const allowedStatusTransitions = {
    "draft": ["live", "archived", "submitted"],
    "live": ["closed", "archived"],
    "closed": ["live", "archived", "draft"]
};

const allowedDispositionStatusParts = {
    "application": {
        "draft": "application"
    },
    "grant": {
        "draft": "content"
    }
}

function tenant(log, tenantId) {

    return {

        async ensureExists(defaultValues) {

            log(`Ensure tenant ${tenantId} exists`);
            await createRow(log, "Tenants", tenantId, "", { ...commonDefaults(), ...defaultValues }, true);

        },

        async ensureDefaultWorkflows(workflows) {

            log(`Ensuring default workflows for ${tenantId}`);
            for (workflow of workflows) {

                if (!(workflow.name && workflow.disposition))
                    throw new Error(`Invalid default workflow definition for tenant ${tenantId}: ${JSON.stringify(workflow)}`);
                const isNew = await createRowIfNotExists(
                    log,
                    "TenantWorkflows",
                    tenantId,
                    workflow.name,
                    {
                        ...commonDefaults(),
                        default: true,
                        id: workflow.name,
                        name: workflow.name,
                        disposition: workflow.disposition
                    }
                );
                if (isNew) {

                    log(`Adding new workflow ${workflow.name} for ${tenantId}`);
                    await putJSONBlob(log, `workflow/${workflow.name}`, tenantId, workflow);

                }

            }

        },

        async ensureUserExists(userId, defaultValues) {

            log(`Ensure user ${userId} exists`);
            const defaultUser = {
                ...commonDefaults(),
                id: userId,
                tenants: JSON.stringify([tenantId]),
                ...defaultValues
            };
            const user = await createRow(log, "Users", userId, "", defaultUser, true);
            if (!(user.tenants && user.tenants.includes(tenantId))) {
                const tenants = user.tenants || [];
                tenants.push(tenantId);
                user.tenants = tenants;
                user.updated = Date.now();
                await upsertRow(log, "Users", userId, "", user);
            }
            return user;

        },

        async ensureUserDoesNotExist(userId) {

            log(`Ensure user ${userId} does not exist`);
            await deleteRow(log, "Users", userId, "");

        },

        async fetchOrCreateGroup(groupName, permissions) {

            log(`Ensure group ${groupName} exists for tenant ${tenantId}`);
            const groups = await listRows(log, "TenantGroups", tenantId);
            let group = groups.find(g => g.name === groupName);
            if (!group) {

                const name = groupName;
                const id = newid();
                const data = { ...commonDefaults(), name, id, tenantId, permissions };
                group = await createRow(log, "TenantGroups", tenantId, id, data, true);

            }
            return {

                async ensureGroupMembership(user) {

                    log(`Ensure group ${groupName} for tenant ${tenantId} has member ${user?.id}`)
                    const data = { ...commonDefaults(), groupId: group.id, userId: user.id };
                    await createRow(log, "TenantGroupUsers", tenantId, `${data.userId}_${data.groupId}`, data, true);

                }

            };

        },

        async validateCreation(data) {

            const ret = {};
            if (!(data && data.status === "draft")) {
                ret.failure = "Status must be 'draft'";
            }
            return ret;

        },

        async validateDocumentContentUpdate(id, data) {

            return await this.validateDocumentPartUpdate(id, "content", data);

        },

        async validateDocumentPartUpdate(id, part, data) {

            const ret = {};
            const existing = await this.fetchDocument(id);
            if (!existing) {

                ret.failure = "Missing document";

            } else {

                const allowedForDisposition = allowedDispositionStatusParts[existing.disposition];
                if (!allowedForDisposition) {

                    ret.failure = `Cannot add parts to a ${existing.disposition} document`;

                } else {

                    const allowedPartStatii = allowedForDisposition[existing.status];
                    if (!allowedPartStatii) {

                        ret.failure = `Cannot modifry ${existing.disposition} when in ${existing.status} status`;

                    } else if (!allowedPartStatii.includes(part)) {

                        ret.failure = `When in ${existing.status} state, allowed parts are: ${allowedPartStatii.join(", ")}`;

                    }

                }

            }
            return ret;

        },

        async validateUpdate(id, data) {

            const ret = {};

            const existing = await this.fetchDocument(id);
            if (existing) {

                if (data && data.status && existing.status !== data.status) {

                    const allowedTransitionStatii = allowedStatusTransitions[existing.status];
                    if (!allowedTransitionStatii) {

                        ret.failure = `Cannot change status from ${existing.status}`;

                    } else if (!allowedTransitionStatii.includes(data.status)) {

                        const allowed = [existing.status, ...allowedTransitionStatii].map(x => `'${x}'`).join(", ");
                        ret.failure = `Status must be one of [${allowed}]`;

                    }

                }

            }
            return ret;

        },

        async listDocuments(options) {

            return await readThrough([tenantId, "listDocuments", JSON.stringify(options || {})], async () => {

                const conditions = options && options.disposition
                    ? [["disposition eq ?", options.disposition]]
                    : null;
                const allRows = await listRows(log, "TenantDocuments", tenantId, conditions);
                return allRows.filter(x => (!x.status) || (x.status !== "archived"));

            });

        },

        async listWorkflows(options) {

            return await readThrough([tenantId, "workflows", JSON.stringify(options || {})], async () => {

                const conditions = options && options.disposition
                    ? [["disposition eq ?", options.disposition]]
                    : null;
                const allRows = await listRows(log, "TenantWorkflows", tenantId, conditions);
                return allRows.filter(x => (!x.status) || (x.status !== "archived"));

            });

        },

        async fetchChildDocuments(docId, options) {

            return await readThrough([tenantId, docId, options, "children"], async () => {

                const conditions = [
                    ["parentId eq ?", docId],
                    ["parentIdTenant eq guid?", tenantId]
                ];
                const items = await listRows(log, "TenantDocuments", null, conditions);
                const { include } = options;
                let promised = items.map(item => decorateItemWithUserInformation(item));
                if (include)
                    promised = promised.concat(
                        items.map(item => decorateItemWithIncludedProperties(include, item.id, item))
                    );
                await Promise.all(promised);
                return items;

            });

        },

        async fetchDocument(docId, options) {

            return await readThrough([tenantId, docId, options], async () => {

                const item = await fetchRow(log, "TenantDocuments", tenantId, docId);
                const { include } = options || {};
                console.log(1234);
                if (include)
                    await decorateItemWithIncludedProperties(include, docId, item);
                console.log(2345);
                return item;

            });

        },

        async patchDocument(docId, values) {

            const item = await fetchRow(log, "TenantDocuments", tenantId, docId);
            if (!item) return null;
            Object.assign(item, values);
            await invalidatePrefix([tenantId, docId]);
            await invalidatePrefix([tenantId, "listDocuments"]);
            return await readThrough([tenantId, docId], async () => {

                return await upsertRow(log, "TenantDocuments", tenantId, docId, item);

            });

        },

        async putDocumentContent(docId, content) {

            await this.putDocumentPart(docId, "content", content);

        },

        async putDocumentPart(docId, partName, content) {

            content = (typeof content === "string") ? content : JSON.stringify(content);
            await putJSONBlob(log, `${docId}-${partName}`, tenantId, Buffer.from(content));
            await this.patchDocument(docId, { updated: new Date().toISOString() });
            await invalidatePrefix([tenantId, docId]);

        },

        async createDocumentForUser(user, values) {

            if ("clone-id" in values) {

                return await this.cloneDocumentForUser(user, values);

            } else {

                const { id: createdBy } = user;
                const id = newid();

                const data = {
                    ...whiteListValues(log, values),
                    ...commonDefaults(),
                    createdBy,
                    id,
                    tenant: tenantId
                };

                const created = await createRow(log, "TenantDocuments", tenantId, id, data);

                await invalidatePrefix([tenantId, id]);
                return created;

            }

        },

        async cloneDocumentForUser(user, values) {

            const parentId = values["clone-id"];
            const parentIdTenant = values["clone-tenant"];
            const fetched = await fetchRow(log, "TenantDocuments", parentIdTenant, parentId);

            const { id: createdBy } = user;
            const id = newid();

            const data = {
                ...fetched,
                ...whiteListValues(log, values),
                ...commonDefaults(),
                createdBy,
                id,
                tenant: tenantId,
                parentId,
                parentIdTenant
            };

            const created = await createRow(log, "TenantDocuments", tenantId, id, data);

            try {

                await copyPrefixedBlobs(log, `${parentId}-`, parentIdTenant, `${id}-`, tenantId);

            } catch (err) {

                await deleteRow(log, "TenantDocuments", tenantId, id);
                throw err;

            }
            await invalidatePrefix([tenantId, id]);
            return created;

        }

    }

    async function decorateItemWithIncludedProperties(include, docId, item) {

        await Promise.all(include.map(async include => {

            try {

                if (include === "workflow") {

                    item[include] = await fetchItemWorkflow(docId, item);

                } else {

                    item[include] = await fetchJSONBlob(log, `${docId}-${include}`, tenantId);

                }

            } catch (err) {

                if (err && err.statusCode == 404) {

                    log(`WARN: Not found - ${include} of ${docId} for tenant ${tenantId}`);
                    return null;

                }
                else
                    throw err;

            }

        }));
        return item;

    }

    async function fetchItemWorkflow(docId, item) {

        if (!item) return;
        const workflowId = item?.workflow;
        const disposition = item?.disposition;
        console.log("Disposition", disposition);
        if (disposition) {

            if (workflowId)
                record = await fetchRow(log, "TenantWorkflows", tenantId, workflowId);
            else
                record = (await listRows(log, "TenantWorkflows", tenantId, [
                    ["default eq ?", true],
                    ["disposition eq ?", disposition]
                ]))[0];

            if (record)
                return await fetchWorkflowDefinition(record);

        }
        return null;

    }

    async function fetchWorkflowDefinition(record) {

        return await fetchJSONBlob(log, `workflow/${record.id}`, tenantId);

    }

    async function decorateItemWithUserInformation(item) {

        try {

            const { createdBy } = item;
            const user = theUser(log, createdBy);
            item.createdByUser = await user.fetchADAttributes();

        } catch (err) {

            log(err);
            item.createdByUser = {};

        }

    }

}

const validKeys = /^\w*$/;
const blacklist = ["partitionkey", "rowkey"];

function whiteListValues(log, values) {

    const ret = {};
    if (values) {

        for (var key of Object.keys(values)) {

            const isValid = validKeys.test(key) && !blacklist.includes(key.toLowerCase());
            if (!isValid) {

                log(`${new Error(`Dropping key ${key}`).stack}`);

            } else {

                ret[key] = values[key];

            }

        }

    }
    return ret;

}

module.exports = {

    tenant

};