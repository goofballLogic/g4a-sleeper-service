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
    if (!(content instanceof Buffer)) {

        if (typeof content !== "string") content = JSON.stringify(content);
        content = Buffer.from(content);

    }
    await client.uploadData(content);

}

async function copyPrefixedBlobs(log, sourcePrefix, sourceContainer, targetPrefix, targetContainer) {

    if (sourcePrefix === targetPrefix && sourceContainer === targetContainer)
        throw new Error("Source and target are the same");

    // ensure source container
    const sourceContainerClient = blobServiceClient.getContainerClient(sourceContainer);
    if (!await sourceContainerClient.exists()) return;

    // ensure target container
    const targetContainerClient = blobServiceClient.getContainerClient(targetContainer);
    await targetContainerClient.createIfNotExists();

    // list all matching blobs in the source container
    const lister = sourceContainerClient.listBlobsFlat({ prefix: `${sourcePrefix}` });

    let item = await lister.next();
    const copying = [];
    while (!item.done) {

        const sourceName = item.value.name;
        const targetName = `${targetPrefix}${sourceName.substring(sourcePrefix.length)}`;

        const sourceBlobClient = sourceContainerClient.getBlobClient(sourceName);
        const targetBlobClient = targetContainerClient.getBlockBlobClient(targetName);

        const sasURL = await sourceBlobClient.generateSasUrl({
            permissions: azs.BlobSASPermissions.from({ read: true }),
            expiresOn: new Date(Date.now() + (5 * 60000))
        });

        copying.push(targetBlobClient.syncCopyFromURL(sasURL));

        item = await lister.next();

    }
    await Promise.all(copying);

}

function streamToString(stream) {

    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

}


module.exports = { fetchJSONBlob, putJSONBlob, copyPrefixedBlobs };