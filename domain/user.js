const { fetchRow, listRows } = require("../lib/rows");

function user(log, userId) {

    return {

        async fetch() {

            return await fetchRow(log, "Users", userId, "");

        },

        async listDocuments(options) {

            const { status, disposition } = options || {};
            if (status && status !== "live") throw new Error(`Invalid parameter status: ${status}`);

            const criteria = [];
            if (status) criteria.push(["status eq ?", status]);
            if (disposition) criteria.push(["disposition eq ?", disposition]);
            return await listRows(log, "TenantDocuments", userId, criteria);

        },

        // TODO: live should not have a special meaning here

        async fetchPublicDocuments(tenantId, id) {

            return await listRows(log, "TenantDocuments", null, [["status eq ?", "live"]]);

        },

        async fetchPublicDocument(tenantId, id) {

            const doc = await fetchRow(log, "TenantDocuments", tenantId, id);
            if (!doc.status === "live") return null;
            return doc;

        }

    }

}

module.exports = { user };