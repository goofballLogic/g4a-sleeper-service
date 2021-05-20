const express = require("express");
const { createHandler } = require("azure-function-express");
const initializePassport = require("../lib/bearer-strategy");
const { tenant: theTenant } = require("../domain/tenant");
const { user: theUser } = require("../domain/user");

const entitlements = require("../domain/entitlements");

const app = express();

const authMiddleware = initializePassport(app);

app.post("/api/initialize", authMiddleware, async (req, res) => {

    try {

        const userId = req.query?.userId || req.user?.id;
        if (!userId) throw new Error("No user found");

        const log = req.context.log.bind(req.context);

        let user = await theUser(log, userId).fetch();
        if (user) {

            res.status(200).json(user);

        } else {

            user = await initializeUser(userId, userId, log);
            res.status(201).json(user);

        }

    } catch (err) {

        req.context.log(err);
        req.context.log(JSON.stringify(err, null, 3));
        res.status(500).send("oops");

    }

});

module.exports = createHandler(app);

async function initializeUser(userId, defaultTenantId, log) {

    console.log("Initializing user");
    const tenant = theTenant(log, defaultTenantId);
    const user = theUser(log, userId);

    const userAttributes = await user.fetchADAttributes();

    const displayName = `Grants by ${userAttributes.givenName} ${userAttributes.surname}`;
    await tenant.ensureExists({ name: "Default tenant", displayName });
    const defaultGroupPermissions = JSON.stringify([entitlements.global.CREATE_DOCUMENT]);
    const adminsGroup = await tenant.fetchOrCreateGroup("Owners", defaultGroupPermissions);
    const userEntry = await tenant.ensureUserExists(userId, { defaultTenantId });
    await adminsGroup.ensureGroupMembership(userEntry);
    return user;

}
