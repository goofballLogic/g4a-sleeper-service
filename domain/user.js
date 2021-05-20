require("isomorphic-fetch");
const { fetchRow, listRows } = require("../lib/rows");
const { Client } = require("@microsoft/microsoft-graph-client");
const { getToken, tokenRequest } = require("../lib/azure-auth");
const { readThrough } = require("../lib/crap-cache");
const { fetchPublicStatusForTenant } = require("./status");

const ADcacheOptions = { expiry: 1000 * 60 * 10 };

function user(log, userId) {

    return {

        async fetch() {

            return await fetchRow(log, "Users", userId, "");

        },

        async fetchADAttributes() {

            const props = "givenName,surname,identities";
            const { givenName, surname, identities } = await readThrough(["user", userId, props], async () => {

                const authProvider = async (callback) => {
                    const tokenResponse = await getToken(tokenRequest);
                    callback(null, tokenResponse.accessToken);
                };
                const options = {
                    authProvider,
                };
                const client = Client.init(options);
                const path = `/users/${userId}`;
                return await client.api(path).select(props).get();

            }, ADcacheOptions);
            const emailSignIn = identities?.find(x => x?.signInType === "emailAddress");
            const email = emailSignIn?.issuerAssignedId;
            return { givenName, surname, email };

        },

        async listDocuments(options) {

            const { status, disposition } = options || {};
            const publicStatus = await fetchPublicStatusForTenant(tenantId);
            if (status && status !== publicStatus) throw new Error(`Invalid parameter status: ${status}`);

            const criteria = [];
            if (status) criteria.push(["status eq ?", status]);
            if (disposition) criteria.push(["disposition eq ?", disposition]);
            return await listRows(log, "TenantDocuments", userId, criteria);

        },

        async fetchPublicDocuments(tenantId, id) {

            const publicStatus = await fetchPublicStatusForTenant(tenantId);
            return await listRows(log, "TenantDocuments", null, [["status eq ?", publicStatus]]);

        },

        async fetchPublicDocument(tenantId, id, options) {

            const doc = await fetchRow(log, "TenantDocuments", tenantId, id);

            const publicStatus = await fetchPublicStatusForTenant(tenantId);
            if (doc.status !== publicStatus) return null;

            if (options && options.include) {

                const { include } = options;
                if (include === "my-children") {

                    const conditions = [
                        ["parentIdTenant eq guid?", tenantId],
                        ["parentId eq ?", id],
                        ["createdBy eq guid?", userId]
                    ];
                    doc.myChildren = (await listRows(log, "TenantDocuments", null, conditions))
                        .map(({ tenant, id, status }) => ({ tenant, id, status }));

                }

            }
            return doc;

        }

    }

}

module.exports = { user };