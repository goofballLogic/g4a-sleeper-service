const azs = require("@azure/storage-blob");

const blobServiceClient = azs.BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

async function fetchJSONBlob(log, blobName, container) {

    const client = blobServiceClient
        .getContainerClient(container)
        .getBlobClient(blobName);
    const resp = await client.download();
    const data = await streamToString(resp.readableStreamBody);
    return JSON.parse(data);

}

async function putJSONBlob(log, blobName, container, content) {

    const containerClient = blobServiceClient.getContainerClient(container);
    await containerClient.createIfNotExists();
    const client = containerClient.getBlockBlobClient(blobName);
    await client.uploadData(content);

}

function streamToString(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    })
}


module.exports = { fetchJSONBlob, putJSONBlob };