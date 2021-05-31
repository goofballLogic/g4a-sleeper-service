require("isomorphic-fetch");
const { fetchRow, listRows, upsertRow } = require("../lib/rows");
const { Client } = require("@microsoft/microsoft-graph-client");
const { getToken, tokenRequest } = require("../lib/azure-auth");
const { readThrough } = require("../lib/crap-cache");
const { fetchPublicStatusForTenant } = require("./status");

const ADcacheOptions = { expiry: 1000 * 60 * 10 };

function user(log, userId) {

    return {

        async updateVersion(version) {

            const record = await fetchRow(log, "Users", userId, "");
            record.version = version;
            await upsertRow(log, "Users", userId, "", record);
        },

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

        async fetchPublicDocuments(tenantId, id) {

            return await listRows(log, "TenantDocuments", null, [
                ["public eq ?", true]
            ]);

        },

        async fetchPublicDocument(tenantId, id, options) {

            const doc = await fetchRow(log, "TenantDocuments", tenantId, id);
            if (!doc.public) return null;

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