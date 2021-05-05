const azs = require("azure-storage");

const promised = require("./promised");

const blobService = azs.createBlobService();

module.exports = async function copyBlob(log, sourceUri, targetContainer, targetBlob) {
    log("Ensure container exists");
    await promised(c => blobService.createContainerIfNotExists(targetContainer, c));
    log("Start to copy blob");
    const result = await promised(c => blobService.startCopyBlob(sourceUri, targetContainer, targetBlob, c));
    log("Check if blob exists");
    let existsResult = await promised(c => blobService.doesBlobExist(targetContainer, targetBlob, c));
    const timeout = Date.now() + 30000;
    while (!existsResult.exists || (existsResult.copy && existsResult.copy.status === "pending")) {
        log("Copying progress", existsResult.copy?.progress);
        existsResult = await promised(c => blobService.doesBlobExist(targetContainer, targetBlob, c));
        if (timeout < Date.now())
            break;
        await promised(c => setTimeout(c, 200));
    }
    const succeeded = existsResult.exists && (!existsResult.copy || existsResult.copy.status === "success");
    if (!succeeded)
        throw new Error("Failed to copy blob");
};
