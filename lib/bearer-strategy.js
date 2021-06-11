const passport = require("passport");
const { BearerStrategy } = require("passport-azure-ad");
const TEST_PREFIX = require("../specs/test-prefix");

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
        done(null, {
            id: token.oid
        }, token);
    });
    passport.use(bearerStrategy);

    const authenticateMiddleware = passport.authenticate(
        "oauth-bearer",
        { session: false }
    );

    return (req, res, next) => {

        const testUser = req.headers["x-test-user"];
        if (testUser && testUser.startsWith(TEST_PREFIX)) {

            req.user = { id: testUser };
            next();
        }
        else
            authenticateMiddleware(req, res, next);

    };

};
