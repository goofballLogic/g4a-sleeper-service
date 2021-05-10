const uuid = require("uuid");
const azs = require("azure-storage");

const promised = require("../lib/promised");
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

async function saveRow(log, tableName, partitionKey, rowKey, data) {
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
        } else {
            log("WARN: Ignored table row field", key, val);
        }
    }
    await promised(c => tableService.insertEntity("UserGrants", entity, c));
    const fetched = await promised(c => tableService.retrieveEntity(tableName, partitionKey, rowKey, c));
    return sanitize(fetched);
}

async function listRows(log, tableName, partitionKey) {

    const query = new TableQuery().where("PartitionKey eq ?", partitionKey);
    log(query);
    const fetched = await promised(c => tableService.queryEntities(tableName, query, null, c));
    return fetched?.entries?.map(sanitize);

}

async function fetchRow(log, tableName, partitionKey, rowKey) {

    try {
        const fetched = await promised(c => tableService.retrieveEntity(tableName, partitionKey, rowKey, c));
        return sanitize(fetched);
    } catch (err) {
        console.log(err);
        if (err.resp?.statusCode === 404)
            return null;
        else
            throw err;
    }

}

module.exports = { saveRow, listRows, fetchRow };