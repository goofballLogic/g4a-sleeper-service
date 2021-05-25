const { readThrough, invalidatePrefix } = require("../lib/crap-cache");
const { listRows, fetchRow } = require("../lib/rows");
const { fetchPublicStatusForTenant } = require("./status");

const PUBLIC_DOCUMENTS_CACHE_EXPIRY = process.env.PUBLIC_DOCUMENTS_CACHE_EXPIRY || (1000 * 60 * 5);

module.exports = {

    public(log) {

        return {

            async fetchDocumentsByTenant(tenantId) {

                return await readThrough([tenantId, "pulbic-documents"], async () => {

                    const conditions = [
                        ["public eq ?", true]
                    ];
                    return await listRows(log, "TenantDocuments", tenantId, conditions);

                }, { expiry: PUBLIC_DOCUMENTS_CACHE_EXPIRY }, log);

            },

            async fetchTenantDetails(tenantId) {

                const fetched = await fetchRow(log, "Tenants", tenantId, "");
                return fetched ? {
                    displayName: fetched.displayName
                } : null;

            },

            async invalidateForTenant(tenantId) {

                await invalidatePrefix([tenantId, "public-documents"]);

            }

        };

    },

};
