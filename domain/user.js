const { fetchRow, listRows } = require("../lib/rows");

function user(log, userId) {

    return {

        async fetch() {

            return await fetchRow(log, "Users", userId, "");

        },

        async documentsWithStatus(status) {

            if (status !== "live") throw new Error(`Invalid parameter status: ${status}`);
            return await listRows(log, "TenantDocuments", null, [["status eq ?", status]]);

        },
        async fetchPublicDocument(id) {

            const doc = await fetchRow(log, "TenantDocuments", null, id);
            console.log(doc);

        }

    }

}

module.exports = { user };