const express = require("express");
const { createHandler } = require("azure-function-express");
const initializePassport = require("../lib/bearer-strategy");
const { tenant: theTenant } = require("../domain/tenant");
const { user: theUser } = require("../domain/user");
const e = require("express");

const app = express();

const authMiddleware = initializePassport(app);

const or500 = strategy => async (req, res) => {

    try {

        await strategy(req, res);

    } catch (err) {

        if (err.stack)
            req.context.log(`ERROR: ${err.stack || err}`);
        else
            req.context.log(err);
        res.status(500).send("An error occurred");

    }

}

app.use(authMiddleware);

app.get("/api/documents", or500(async (req, res) => {

    const { user, context, query } = req;
    const { id } = user;
    const { status } = query;
    const log = context.log.bind(context);
    if (status !== "live") {

        res.status(403).send({ error: "Status not allowed" });

    } else {

        const items = await theUser(log, id).documentsWithStatus(status);
        res.status(200).json({ items });

    }

}));

app.get("/api/documents/public/:tid/:id", or500(async (req, res) => {

    const { user, context } = req;
    const { tid, id } = req.params;
    if (!(tid && id)) {

        res.status(400).send();

    } else {

        const { id: userId } = user;
        const log = context.log.bind(context);
        const item = await theUser(log, userId).fetchPublicDocument(tid, id);
        if (item)
            res.status(200).json({ item });
        else
            res.status(400).send();

    }

}));

app.get("/api/documents/:tid/:id", requireUserTenancy, or500(async (req, res) => {

    const { tid, id } = req.params;
    let { include } = req.query;
    if (include) include = include.split(",").filter(x => x);
    const log = req.context.log.bind(req.context);
    const item = await theTenant(log, tid).fetchDocument(id, { include });
    if (item)
        res.status(200).json({ item });
    else
        res.status(404).json({ error: "Not found" });

}));

app.get("/api/documents/:tid", requireUserTenancy, or500(async (req, res) => {

    const { tid } = req.params;
    const { disposition } = req.query;
    const log = req.context.log.bind(req.context);
    const items = await theTenant(log, tid).listDocuments({ disposition });
    res.json({ items });

}));

app.post("/api/documents/:tid", requireUserTenancy, or500(async (req, res) => {

    const { context, params, user, body } = req;
    const { tid } = params;
    const log = context.log.bind(context);
    console.log("Tenant", tid, "User", user);

    const item = await theTenant(log, tid).createDocumentForUser(user, body);
    res.status(201).json({ item });

}));

app.patch("/api/documents/:tid/:id", requireUserTenancy, or500(async (req, res) => {

    console.log("1234");
    const { context, params, body } = req;
    const { tid, id } = params;
    const log = context.log.bind(context);
    const item = await theTenant(log, tid).patchDocument(id, body);
    if (item)
        res.status(200).json({ item });
    else
        res.status(404).json({ error: "Not found" });

}));

app.put("/api/documents/:tid/:id/content", requireUserTenancy, or500(async (req, res) => {

    const { context, params, body } = req;
    const { tid, id } = params;
    const log = context.log.bind(context);
    await theTenant(log, tid).putDocumentContent(id, body);
    res.status(200).send();

}));

module.exports = createHandler(app);

async function requireUserTenancy(req, res, next) {

    try {

        const { tid } = req.params;
        const { log } = req.context;
        const { id } = req.user;

        if (!req.models) req.models = {};
        if (!req.models.user) req.models.user = await theUser(log, id).fetch();

        if (tid === "me") {

            req.params.tid = id;
            next();

        } else {

            const tenants = JSON.parse(req.models.user.tenants);
            if (tid === "me" || tenants.includes(tid)) {

                next();

            } else {

                log(`WARN: Attempt by ${id} to access tenant ${tid} but only has ${tenants}`);
                res.status(403).send("Access denied");

            }

        }

    } catch (err) {

        next(err);

    }

}
