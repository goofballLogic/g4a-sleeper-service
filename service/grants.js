const { saveRow, listRows } = require("./rows");
const copyBlob = require("./copyBlob");

const { INBOX_SAS_URL_TEMPLATE, INBOX_SAS_QUERY_STRING } = process.env;

async function tryFunc(res, log, func) {
    try {
        await func();
    } catch (err) {
        log(`ERROR: ${err} ${JSON.stringify(err, null, 3)}`);
        res.status(500).send("An error occurred");
    }
}

async function createGrant(req, res) {
    const { user, body } = req;
    const { name } = body;
    const log = req.context.log.bind(req.context);

    const { identifier: templateId } = body["grant-template"];

    await tryFunc(res, log, async function () {
        const grantId = `${Date.now()}-${Math.round(Math.random() * 10000000)}`;
        const sourceURL = `${INBOX_SAS_URL_TEMPLATE.replace("{id}", templateId)}${INBOX_SAS_QUERY_STRING}`;
        const targetContainer = `grants-${grantId}`;
        await copyBlob(log, sourceURL, targetContainer, "template");
        const saved = await saveRow(log, "UserGrants", user.id, grantId, {
            when: (new Date().toISOString()),
            user: user.id,
            id: grantId,
            name
        });
        req.context.log(saved);
        res.status(201).json({ grantId });
    });

}

async function listGrants(req, res) {

    const { user } = req;
    const log = req.context.log.bind(req.context);
    await tryFunc(res, log, async function () {
        const items = await listRows(log, "UserGrants", user.id);
        items.sort((a, b) => a?.when > b?.when ? 1 : (a?.when < b?.when) ? -1 : 0);
        res.status(200).json({ items });
    });
}

module.exports = { createGrant, listGrants };