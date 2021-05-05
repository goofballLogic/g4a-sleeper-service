const express = require("express");
const { createHandler } = require("azure-function-express");
const initializePassport = require("../lib/bearer-strategy");
const { createGrant, listGrants } = require("./grants");

const app = express();

const authMiddleware = initializePassport(app);

app.post("/api/service", authMiddleware, async (req, res) => {

    const { user, body } = req;
    if (!(user && user.id)) throw new Error("User not specified");
    if (!(body && body.op)) {
        res.status(400).send("No operation specified");
    } else {
        switch (body.op) {
            case "create-grant":
                await createGrant(req, res);
                break;
            default:
                res.status(400).send(`Unrecognised operation specified: ${body.op}`);
        }
    }
});

app.get("/api/service", authMiddleware, async (req, res) => {

    const { user, query: searchParams } = req;
    if (!(user && user.id)) throw new Error("User not specified");
    const { query } = searchParams;
    if (!query) {
        res.status(400).send("No query specified");
    } else {
        switch (query) {
            case "grants":
                await listGrants(req, res);
                break;
            default:
                res.status(400).send(`Unrecognised query: ${query}`);
        }
    }

});

module.exports = createHandler(app);