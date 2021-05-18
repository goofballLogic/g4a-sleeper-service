const { upsertRow, createRow, listRows, fetchRow, deleteRow } = require("../lib/rows");
const { fetchJSONBlob, putJSONBlob, copyPrefixedBlobs } = require("../lib/blobs");
const { invalidatePrefix, readThrough } = require("../lib/crap-cache");

function commonDefaults() {

    const now = new Date().toISOString();
    return { created: now, updated: now };

}

const newid = () => `${Date.now()}_${Math.round(Math.random() * 1000000)}`;

function tenant(log, tenantId) {

    return {

        async ensureExists(defaultValues) {

            log(`Ensure tenant ${tenantId} exists`);
            await createRow(log, "Tenants", tenantId, "", { ...commonDefaults(), ...defaultValues }, true);

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

        async listDocuments(options) {

            return await readThrough([tenantId, "listDocuments"], async () => {

                const conditions = options && options.disposition
                    ? [["disposition eq ?", options.disposition]]
                    : null;
                const allRows = await listRows(log, "TenantDocuments", tenantId, conditions);
                return allRows.filter(x => console.log(x) || (!x.status) || (x.status !== "archived"));

            });

        },

        async fetchDocument(docId, options) {

            return await readThrough([tenantId, docId, options], async () => {

                const item = await fetchRow(log, "TenantDocuments", tenantId, docId);
                const { include } = options;
                if (include) {

                    const bits = await Promise.all(include.map(async include => {
                        try {
                            return await fetchJSONBlob(log, `${docId}-${include}`, tenantId);
                        } catch (err) {

                            if (err && err.statusCode == 404)
                                return null;
                            else
                                throw err;
                        }
                    }));
                    include.forEach((key, i) => {
                        item[key] = bits[i];
                    });

                }

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

            await putJSONBlob(log, `${docId}-content`, tenantId, Buffer.from(content));
            await this.patchDocument(docId, { updated: new Date().toISOString() });
            await invalidatePrefix([tenantId, docId]);

        },

        async createDocumentForUser(user, values) {

            if ("clone-id" in values) {

                return await this.cloneDocumentForUser(user, values);

            } else {

                const { id: createdBy } = user;
                const id = newid();

                const data = { ...values, ...commonDefaults(), createdBy, id, tenant: tenantId };

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

            const data = { ...fetched, ...commonDefaults(), createdBy, id, tenant: tenantId, parentId, parentIdTenant };

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

}

module.exports = {

    tenant

};