const msal = require('@azure/msal-node');

let {
    clientID, b2cDomainHost, tenantID, policyName,
    clientSecret,
    graphEndpoint
} = process.env;

graphEndpoint = graphEndpoint || "https://graph.microsoft.com/";

if (!clientID) throw new Error("clientID not specified");
if (!b2cDomainHost) throw new Error("b2cDomainHost not specified");
if (!tenantID) throw new Error("tenantID not specified");
if (!clientSecret) throw new Error("clientSecret not specified");
if (!graphEndpoint) throw new Error("graphEndpoint not specified");

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL Node configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/configuration.md
 */
const msalConfig = {
    auth: {
        clientId: clientID,
        authority: `https://login.microsoftonline.com/${tenantID}`, //process.env.AAD_ENDPOINT + process.env.TENANT_ID,
        clientSecret
    }
};

/**
 * With client credentials flows permissions need to be granted in the portal by a tenant administrator.
 * The scope is always in the format '<resource>/.default'. For more, visit:
 * https://docs.microsoft.com/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow
 */
const tokenRequest = {
    scopes: [graphEndpoint + '.default'],
};

const apiConfig = {
    uri: graphEndpoint + 'v1.0/users',
};

/**
 * Initialize a confidential client application. For more info, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-node/docs/initialize-confidential-client-application.md
 */
const cca = new msal.ConfidentialClientApplication(msalConfig);

/**
 * Acquires token with client credentials.
 * @param {object} tokenRequest
 */
async function getToken(tokenRequest) {
    return await cca.acquireTokenByClientCredential(tokenRequest);
}

module.exports = {
    apiConfig: apiConfig,
    tokenRequest: tokenRequest,
    getToken: getToken
};