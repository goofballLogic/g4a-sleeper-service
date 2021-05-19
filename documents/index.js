const express = require("express");
const { createHandler } = require("azure-function-express");
const initializePassport = require("../lib/bearer-strategy");
const { tenant: theTenant } = require("../domain/tenant");
const { user: theUser } = require("../domain/user");

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

app.get("/api/documents/public", or500(async (req, res) => {

    const { user, context } = req;
    const { id: userId } = user;
    const log = context.log.bind(context);
    const items = await theUser(log, userId).fetchPublicDocuments();
    res.status(200).json({ items });

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

app.get("/api/documents", (req, res) => res.status(404).send());

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

app.get("/api/documents/:tid/:id/children", requireUserTenancy, or500(async (req, res) => {

    const { tid, id } = req.params;
    let { include } = req.query;
    if (include) include = include.split(",").filter(x => x);
    const log = req.context.log.bind(req.context);
    const items = await theTenant(log, tid).fetchChildDocuments(id, { include });
    res.status(200).json({ items });

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
    const tenant = theTenant(log, tid);
    const validation = await tenant.validateCreation(body);
    if (validation.failure) {

        res.status(400).send(validation.failure);

    } else {

        const item = await tenant.createDocumentForUser(user, body);
        res.status(201).json({ item });

    }

}));

app.patch("/api/documents/:tid/:id", requireUserTenancy, or500(async (req, res) => {

    const { context, params, body } = req;
    const { tid, id } = params;
    const log = context.log.bind(context);
    const tenant = theTenant(log, tid);
    const validation = await tenant.validateUpdate(id, body);
    if (validation.failure) {

        res.status(400).send(validation.failure);

    } else {

        const item = await tenant.patchDocument(id, body);
        if (item)
            res.status(200).json({ item });
        else
            res.status(404).json({ error: "Not found" });

    }

}));

app.put("/api/documents/:tid/:id/content", requireUserTenancy, or500(async (req, res) => {

    const { context, params, body } = req;
    const { tid, id } = params;
    const log = context.log.bind(context);
    const tenant = theTenant(log, tid);
    const validation = await tenant.validateDocumentContentUpdate(id, body);
    if (validation.failure) {

        res.status(400).send(validation.failure);

    } else {

        await tenant.putDocumentContent(id, body);
        res.status(200).send();

    }

}));

app.put("/api/documents/:tid/:id/parts/:part", requireUserTenancy, or500(async (req, res) => {

    const { context, params, body } = req;
    const { tid, id, part } = params;
    const log = context.log.bind(context);
    const tenant = theTenant(log, tid);
    const validation = await tenant.validateDocumentPartUpdate(id, part, body);
    if (validation.failure) {

        res.status(400).send(validation.failure);

    } else {

        await tenant.putDocumentPart(id, part, body);
        res.status(200).send();

    }

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
