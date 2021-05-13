const express = require("express");
const { createHandler } = require("azure-function-express");
const initializePassport = require("../lib/bearer-strategy");
const { tenant: theTenant } = require("../domain/tenant");
const { user: theUser } = require("../domain/user");

const entitlements = require("../domain/entitlements");

// const azs = require("@azure/storage-blob");
// const blobServiceClient = azs.BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

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
    await tenant.ensureExists({ name: "Default tenant" });
    const defaultGroupPermissions = JSON.stringify([entitlements.global.CREATE_DOCUMENT]);
    const adminsGroup = await tenant.fetchOrCreateGroup("Owners", defaultGroupPermissions);
    const user = await tenant.ensureUserExists(userId, { defaultTenantId });
    await adminsGroup.ensureGroupMembership(user);
    return user;

}
