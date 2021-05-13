const express = require("express");
const { createHandler } = require("azure-function-express");
const initializePassport = require("../lib/bearer-strategy");
const { tenant: theTenant } = require("../domain/tenant");
const { user: theUser } = require("../domain/user");

// const azs = require("@azure/storage-blob");
// const blobServiceClient = azs.BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

const app = express();

const authMiddleware = initializePassport(app);

const or500 = strategy => async (req, res) => {

    try {

        await strategy(req, res);

    } catch (err) {

        res.status(500).send(err);

    }

}

app.use(authMiddleware);

app.get("/api/documents/:tid/:id", requireUserTenancy, or500(async (req, res) => {

    const { tid, id } = req.params;
    const log = req.context.log.bind(req.context);
    const item = await theTenant(log, tid).fetchDocument(id);
    if (item)
        res.status(200).send({ item });
    else
        res.status(404).send({ error: "Not found" });

}));

app.get("/api/documents/:tid", requireUserTenancy, or500(async (req, res) => {

    const { tid } = req.params;
    const log = req.context.log.bind(req.context);
    const items = await theTenant(log, tid).listDocuments();
    res.json({ items });

}));

app.post("/api/documents/:tid", requireUserTenancy, or500(async (req, res) => {

    const { context, params, user, body } = req;
    const { tid } = params;
    const log = context.log.bind(context);
    const item = await theTenant(log, tid).createDocumentForUser(user, body);
    res.status(201).json({ item });

}));

module.exports = createHandler(app);

async function requireUserTenancy(req, res, next) {

    try {

        const { tid } = req.params;
        const { log } = req.context;
        const { id } = req.user;

        if (!req.models) req.models = {};
        if (!req.models.user) req.models.user = await theUser(log, id).fetch();
        const tenants = JSON.parse(req.models.user.tenants);
        if (tenants.includes(tid)) {

            next();

        } else {

            log(`WARN: Attempt by ${id} to access tenant ${tid} but only has ${tenants}`);
            res.status(403).send("Access denied");

        }

    } catch (err) {

        next(err);

    }

}
