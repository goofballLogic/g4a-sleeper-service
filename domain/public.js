const { listRows, fetchRow } = require("../lib/rows");
const { fetchPublicStatusForTenant } = require("./status");

module.exports = {

    public(log) {

        return {

            async fetchDocumentsByTenant(tenantId) {

                const publicStatus = await fetchPublicStatusForTenant(tenantId);
                const conditions = [
                    ["status eq ?", publicStatus]
                ];
                return await listRows(log, "TenantDocuments", tenantId, conditions);

            },

            async fetchTenantDetails(tenantId) {

                const fetched = await fetchRow(log, "Tenants", tenantId, "");
                return fetched ? {
                    displayName: fetched.displayName
                } : null;

            }

        };

    }

};
