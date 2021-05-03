const passport = require("passport");
const { BearerStrategy } = require("passport-azure-ad");

const { clientID, b2cDomainHost, tenantID, policyName } = process.env;

const options = {
    identityMetadata: `https://${b2cDomainHost}/${tenantID}/${policyName}/v2.0/.well-known/openid-configuration/`,
    clientID: clientID,
    policyName: policyName,
    isB2C: true,
    validateIssuer: true,
    loggingLevel: "error"
};

module.exports = function initialize(app) {
    app.use(passport.initialize());
    const bearerStrategy = new BearerStrategy(options, (token, done) => {
        done(null, { id: token.oid }, token);
    });
    passport.use(bearerStrategy);
    return passport.authenticate("oauth-bearer", { session: false });
};
