const express = require("express");
const { createHandler } = require("azure-function-express");
const initializePassport = require("../lib/bearer-strategy");
const azs = require("azure-storage");
const promised = require("../lib/promised");
const blobService = azs.createBlobService();

const app = express();

const authMiddleware = initializePassport(app);


app.post("/api/session", authMiddleware, async (req, res) => {

    const userContainer = req.user?.id;
    if (!userContainer) throw new Error("No user id");
    await promised(c => blobService.createContainerIfNotExists(userContainer, c));
    res.status(200).send(req.user?.id);

});

module.exports = createHandler(app);