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
            console.log(criteria);
            return await listRows(log, "TenantDocuments", null, criteria);

        },

        async fetchPublicDocument(tenantId, id) {

            const doc = await fetchRow(log, "TenantDocuments", tenantId, id);
            if (!isPublic(doc)) return null;
            return doc;

        }

    }

}

function isPublic(doc) {
    return doc && doc.status === "live";
}

module.exports = { user };