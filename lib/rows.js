const uuid = require("uuid");
const azs = require("azure-storage");

const promised = require("./promised");
const { TableQuery } = require("azure-storage");

const tableService = azs.createTableService();
const { entityGenerator } = azs.TableUtilities;
const metadataFields = ["PartitionKey", "RowKey", "Timestamp"];

function sanitize(raw) {

    const ret = {};
    for (let [key, val] of Object.entries(raw)) {

        if (key.startsWith(".") || !val || metadataFields.includes(key))
            continue;
        else
            ret[key] = val._;

    }
    return ret;

}

const modes = { CREATE_OR_FAIL: Symbol(), CREATE_OR_SUCCEED: Symbol(), CREATE_OR_OVERWRITE: Symbol() };

async function upsertRow(log, tableName, partitionKey, rowKey, data) {

    return saveOrCreateRow(log, tableName, partitionKey, rowKey, data, modes.CREATE_OR_OVERWRITE);

}

async function createRow(log, tableName, partitionKey, rowKey, data, succeedOnConflict) {

    const mode = succeedOnConflict ? modes.CREATE_OR_SUCCEED : modes.CREATE_OR_FAIL
    return saveOrCreateRow(log, tableName, partitionKey, rowKey, data, mode);

}

async function saveOrCreateRow(log, tableName, partitionKey, rowKey, data, mode) {

    const entity = {
        PartitionKey: entityGenerator.String(partitionKey),
        RowKey: entityGenerator.String(rowKey)
    };
    for (let [key, val] of Object.entries(data)) {
        if (typeof val === "string") {
            if (uuid.validate(val)) {
                entity[key] = entityGenerator.Guid(val);
            } else {
                entity[key] = entityGenerator.String(val);
            }
        } else if (typeof val === "number") {
            if (Math.round(val) === val) {
                entity[key] = entityGenerator.Int32(val);
            } else {
                entity[key] = entityGenerator.Double(val);
            }
        } else {
            log("WARN: Ignored table row field", key, val);
        }
    }
    await promised(c => tableService.createTableIfNotExists(tableName, c));
    try {
        if (mode === modes.CREATE_OR_OVERWRITE) {
            await promised(c => tableService.insertOrReplaceEntity(tableName, entity, c));
        } else {
            await promised(c => tableService.insertEntity(tableName, entity, c));
        }
    } catch (err) {
        // swallow error?
        if (!(mode === modes.CREATE_OR_SUCCEED && err.err?.statusCode === 409))
            throw err;
    }
    const fetched = await promised(c => tableService.retrieveEntity(tableName, partitionKey, rowKey, c));
    return sanitize(fetched);

}

async function listRows(log, tableName, partitionKey, conditions) {

    await promised(c => tableService.createTableIfNotExists(tableName, c));
    let query = new TableQuery();
    if (partitionKey)
        query = query.where("PartitionKey eq ?", partitionKey);
    if (conditions) {
        conditions.forEach(([condition, arguments]) => {
            query = query.where(condition, arguments);
        });
    }
    const fetched = await promised(c => tableService.queryEntities(tableName, query, null, c));
    return fetched?.entries?.map(sanitize);

}

async function fetchRow(log, tableName, partitionKey, rowKey) {

    try {
        const fetched = await promised(c => tableService.retrieveEntity(tableName, partitionKey, rowKey, c));
        return sanitize(fetched);
    } catch (err) {
        if (err.resp?.statusCode === 404)
            return null;
        else
            throw err;
    }

}

module.exports = { createRow, upsertRow, listRows, fetchRow };