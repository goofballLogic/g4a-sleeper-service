const express = require("express");
const { createHandler } = require("azure-function-express");
const initializePassport = require("../lib/bearer-strategy");
const { tenant: theTenant } = require("../domain/tenant");
const { user: theUser } = require("../domain/user");
const { workflow: theWorkflow } = require("../domain/workflow");
const or500 = require("../lib/or500");
const requireUserTenancy = require("../lib/require-user-tenancy");

const app = express();
console.log("--- Documents function starting up ----");

const authMiddleware = initializePassport(app);

app.use(authMiddleware);

app.get("/api/documents/public", or500(async (req, res) => {

    const { user, context } = req;
    const { id: userId } = user;
    const log = context.log.bind(context);
    const items = await theUser(log, userId).fetchPublicDocuments();
    res.status(200).json({ items });

}));

app.get("/api/documents/public//", (_, res) => res.status(404).send());

app.get("/api/documents/public/:tid/:id", or500(async (req, res) => {

    const { user, context } = req;
    const { tid, id } = req.params;
    const { include } = req.query;
    if (!(tid && id)) {

        res.status(400).send();

    } else {

        const { id: userId } = user;
        const log = context.log.bind(context);
        const item = await theUser(log, userId).fetchPublicDocument(tid, id, { include });
        if (item)
            res.status(200).json({ item });
        else
            res.status(400).send();

    }

}));

app.get("/api/documents", (req, res) => res.status(404).send());

app.get("/api/documents/workflows/:tid", requireUserTenancy, or500(async (req, res) => {

    const { tid } = req.params;
    const { disposition } = req.query;
    const { context } = req;
    const log = context.log.bind(context);
    const items = await theTenant(log, tid).listWorkflows({ disposition });
    res.status(200).json({ items });

}));

app.get("/api/documents/workflows/:tid/:id", requireUserTenancy, or500(async (req, res) => {

    const { tid, id } = req.params;
    const { context } = req;
    const { include } = req.query;
    const log = context.log.bind(context);
    const item = await theWorkflow(log, tid, id).fetch({ include });
    if (item)
        res.status(200).json({ item });
    else
        res.status(404).send("Not found");

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

app.get("/api/documents/:tid/:id/grandchildren", requireUserTenancy, or500(async (req, res) => {

    const { tid, id } = req.params;
    let { include, readwrite } = req.query;
    const options = {};
    if (include) options.include = include.split(",").filter(x => x);
    if (readwrite === "true") options.readwrite = true;
    if (readwrite === "false") options.readwrite = false;

    const log = req.context.log.bind(req.context);
    const items = await theTenant(log, tid).fetchGrandChildDocuments(id, options);
    res.status(200).json({ items });

}));

app.get("/api/documents/:tid/:id/children", requireUserTenancy, or500(async (req, res) => {

    const { tid, id } = req.params;
    let { include, readwrite } = req.query;
    const options = {};
    if (include) options.include = include.split(",").filter(x => x);
    if (readwrite === "true") options.readwrite = true;
    if (readwrite === "false") options.readwrite = false;

    const log = req.context.log.bind(req.context);
    const items = await theTenant(log, tid).fetchChildDocuments(id, options);
    res.status(200).json({ items });

}));

app.get("/api/documents/:tid", requireUserTenancy, or500(async (req, res) => {

    const { tid } = req.params;
    const { disposition } = req.query;
    let { include, parentTenant } = req.query;
    const log = req.context.log.bind(req.context);
    if (include) include = include.split(",").filter(x => x);
    const items = await theTenant(log, tid).listDocuments({ disposition, include, parentTenant });
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

app.get("/api/documents/:tid/:id/parts/:part", requireUserTenancy, or500(async (req, res) => {

    const { context, params, body } = req;
    const { tid, id, part } = params;
    const log = context.log.bind(context);
    const tenant = theTenant(log, tid);
    const item = await tenant.fetchDocumentPart(id, part);
    if (!item) {

        res.status(404).send("Not found");

    } else {

        res.status(200).send({ item });

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