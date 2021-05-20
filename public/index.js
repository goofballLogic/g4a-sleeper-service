const express = require("express");
const { createHandler } = require("azure-function-express");
const { public: thePublic } = require("../domain/public");
const or500 = require("../lib/or500");

const app = express();

app.get("/api/public/documents", (_, res) => res.status(404).send());

app.get("/api/public/documents/:tid", or500(async (req, res) => {

    const { context, params } = req;
    const { tid } = params
    const log = context.log.bind(context);
    const public = thePublic(log);
    const items = await public.fetchDocumentsByTenant(tid);
    res.status(200).json({ items });

}));

app.get("/api/public/tenants/:tid", or500(async (req, res) => {

    const { context, params } = req;
    const { tid } = params
    const log = context.log.bind(context);
    const public = thePublic(log);
    const item = await public.fetchTenantDetails(tid);
    res.status(200).json({ item });

}));


module.exports = createHandler(app);
