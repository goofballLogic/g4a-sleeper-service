const azs = require("@azure/storage-blob");

const blobServiceClient = azs.BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);

const containerPattern = /^[a-z0-9\-]*$/;
function normaliseContainerName(name, source) {

    name = name.toLowerCase();
    if (!containerPattern.test(name))
        throw new Error(`Invalid container name ${name}${source ? ` (${source})` : ""}`);
    return name;

}

async function fetchJSONBlobs(_log, blobNamePrefix, containerName) {

    blobNamePrefix = blobNamePrefix.toLowerCase();
    containerName = normaliseContainerName(containerName);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobs = [];
    for await (const blob of containerClient.listBlobsFlat({ prefix: blobNamePrefix }))
        blobs.push(blob);
    return await Promise.all(blobs.map(

        async ({ name, properties }) => ({
            name,
            created: properties.createdOn,
            updated: properties.lastModified,
            item: await fetchJSONBlobFromContainerClient(containerClient, name)
        })

    ));

}

async function fetchJSONBlob(_log, blobName, containerName) {

    blobName = blobName.toLowerCase();
    containerName = normaliseContainerName(containerName);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    return await fetchJSONBlobFromContainerClient(containerClient, blobName);

}

async function fetchJSONBlobFromContainerClient(containerClient, blobName) {

    blobName = blobName.toLowerCase();
    const blobClient = containerClient.getBlobClient(blobName);
    const resp = await blobClient.download();
    const data = await streamToString(resp.readableStreamBody);
    return JSON.parse(data);

}

async function putJSONBlob(_log, blobName, containerName, content) {

    blobName = blobName.toLowerCase();
    containerName = normaliseContainerName(containerName);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();
    const client = containerClient.getBlockBlobClient(blobName);
    if (!(content instanceof Buffer)) {

        if (typeof content !== "string") content = JSON.stringify(content);
        content = Buffer.from(content);

    }
    await client.uploadData(content);

}

async function deleteBlobContainersWithPrefix(log, prefix, doNotWait = false) {

    prefix = normaliseContainerName(prefix);

    const pending = []
    for await (const container of blobServiceClient.listContainers({ prefix }))
        pending.push(blobServiceClient.deleteContainer(container.name, null));
    if (!doNotWait)
        await Promise.all(pending);
    log(`Deleted ${pending.length} containers with prefix ${prefix}`);

}

async function copyPrefixedBlobs(_log, sourcePrefix, sourceContainerName, targetPrefix, targetContainerName) {

    sourcePrefix = sourcePrefix.toLowerCase();
    targetPrefix = targetPrefix.toLowerCase();
    sourceContainerName = normaliseContainerName(sourceContainerName, "sourceContainerName");
    targetContainerName = normaliseContainerName(targetContainerName, "targetContainerName");

    if (sourcePrefix === targetPrefix && sourceContainerName === targetContainerName)
        throw new Error("Source and target are the same");

    // ensure source container
    const sourceContainerClient = blobServiceClient.getContainerClient(sourceContainerName);
    if (!await sourceContainerClient.exists()) return;

    // ensure target container
    const targetContainerClient = blobServiceClient.getContainerClient(targetContainerName);
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


module.exports = {
    fetchJSONBlob, fetchJSONBlobs,
    putJSONBlob,
    copyPrefixedBlobs,
    deleteBlobContainersWithPrefix
};