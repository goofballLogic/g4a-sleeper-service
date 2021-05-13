const { upsertRow, createRow, listRows, fetchRow } = require("../lib/rows");

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

        async listDocuments() {

            return await listRows(log, "TenantDocuments", tenantId);

        },

        async fetchDocument(docId) {

            return await fetchRow(log, "TenantDocuments", tenantId, docId);

        },

        async createDocumentForUser(user, values) {

            const { id: createdBy } = user;
            const id = newid();
            const data = { ...values, ...commonDefaults(), createdBy, id };
            return await createRow(log, "TenantDocuments", tenantId, id, data);

        }

    }

}

module.exports = {

    tenant

};