const express = require("express");
const { createHandler } = require("azure-function-express");

const azs = require("@azure/storage-blob");
const blobServiceClient = azs.BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

const app = express();

app.post("/api/initialize", async (req, res) => {

    try {
        const containerName = `signups-${Date.now()}-${Math.round(Math.random() * 100000)}`;
        const containerClient = blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists();
        const blobClient = containerClient.getBlockBlobClient("body.json");
        const data = JSON.stringify(req.body);
        await blobClient.upload(data, data.length, {
            blobHTTPHeaders: {
                blobContentType: "application/json"
            }
        });
        res.status(200).send("ok");
    } catch (err) {
        console.error(err);
        res.status(500).send("oops");
    }

});

module.exports = createHandler(app);