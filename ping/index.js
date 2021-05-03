const express = require("express");
const { createHandler } = require("azure-function-express");
const initializePassport = require("../lib/bearer-strategy");

const app = express();

const authMiddleware = initializePassport(app);

app.get("/api/ping", authMiddleware, async (_, res) => {

    res.status(200).send(true);

});

module.exports = createHandler(app);