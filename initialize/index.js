const express = require("express");
const { createHandler } = require("azure-function-express");
const initializePassport = require("../lib/bearer-strategy");
const { tenant: theTenant } = require("../domain/tenant");
const { user: theUser } = require("../domain/user");
const or500 = require("../lib/or500");
const { frame } = require("jsonld");

const entitlements = require("../domain/entitlements");

const app = express();

const authMiddleware = initializePassport(app);

const CURRENT_VERSION = 1;

app.post("/api/initialize", authMiddleware, or500(async (req, res) => {

    const userId = req.query?.userId || req.user?.id;
    if (!userId) throw new Error("No user found");

    const log = req.context.log.bind(req.context);

    let user = await theUser(log, userId).fetch();
    if (user && user.version >= CURRENT_VERSION) {

        res.status(200).json(user);

    } else {

        const { headers } = req;
        let referer = headers["x-initialize-referer"] || headers.referer;
        if (!referer) throw new Error("Unable to determine referer");

        user = await initializeUser(userId, userId, referer, log);
        res.status(201).json(user);

    }

}));

module.exports = createHandler(app);

const defaultsShape = {
    "@context": { "@vocab": "https://tangentvision.com/g4a/vocab#" },
    "@type": "Workflow"
};

async function initializeUser(userId, defaultTenantId, referer, log) {

    log(`Initializing user ${userId}`);

    log(`Fetching default workflows from ` + referer);
    const defaultsURL = new URL(referer);
    defaultsURL.search = "";
    defaultsURL.pathname = "/.well-known/workflows/defaults.jsonld";
    const resp = await fetch(defaultsURL);
    if (!resp.ok) throw new Error(`An error occurred fetching default workflows from ${defaultsURL}: ${resp.status}`);
    const json = await resp.json();
    const framed = await frame(json, defaultsShape);
    const workflows = framed["@graph"] || [];

    const tenant = theTenant(log, defaultTenantId);
    const user = theUser(log, userId);

    try {

        const userAttributes = await user.fetchADAttributes();
        const displayName = `Grants by ${userAttributes.givenName} ${userAttributes.surname}`;
        await tenant.ensureExists({ name: "Default tenant", displayName });
        const defaultGroupPermissions = JSON.stringify([entitlements.global.CREATE_DOCUMENT]);
        const adminsGroup = await tenant.fetchOrCreateGroup("Owners", defaultGroupPermissions);
        const userEntry = await tenant.ensureUserExists(userId, { defaultTenantId });
        await adminsGroup.ensureGroupMembership(userEntry);
        await tenant.ensureDefaultWorkflows(workflows);
        await user.updateVersion(CURRENT_VERSION);

    } catch (err) {

        log(`Rolling back initialization of user ${userId} due to ${err.stack}`);
        // rollback to cause initialization to run again
        await tenant.ensureUserDoesNotExist(userId);
        throw err;

    }
    return await user.fetch();

}
