const uuid = require("uuid");
const azs = require("azure-storage");

const promised = require("./promised");
const { TableQuery, TableBatch } = require("azure-storage");

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

async function deleteRow(log, tableName, partitionKey, rowKey) {

    const entity = {
        PartitionKey: entityGenerator.String(partitionKey),
        RowKey: entityGenerator.String(rowKey)
    };
    return await promised(c => tableService.deleteEntity(tableName, entity, c));

}

function incrementFinalCharOf(x) {

    if (!x) return x;
    const finalIndex = x.length - 1;
    const finalCharCode = x[finalIndex].charCodeAt(0);
    return x.substring(0, finalIndex) + String.fromCharCode(finalCharCode + 1);

}

async function deleteRowsWithPartitionPrefix(log, tableName, partitionKeyPrefix) {

    const gtPartitionKeyPrefix = incrementFinalCharOf(partitionKeyPrefix);
    const query = new TableQuery()
        .where("PartitionKey gt ?", partitionKeyPrefix)
        .and("PartitionKey lt ?", gtPartitionKeyPrefix);
    const decoratedLog = x => log(`${x} with partitionKey prefix ${partitionKeyPrefix}`);
    await deleteQueryEntries(tableName, query, decoratedLog);

}

async function deleteRows(log, tableName, partitionKey) {

    const query = new TableQuery().where(["PartitionKey eq ?", partitionKey]);
    const decoratedLog = x => log(`${x} with partitionKey ${partitionKey}`);
    await deleteQueryEntries(tableName, query, decoratedLog);

}

async function deleteQueryEntries(tableName, query, log) {

    let fetched = await promised(c => tableService.queryEntities(tableName, query, null, c));
    let { continuationToken } = fetched;
    let safety = 1000;
    while (safety-- > 0 && fetched && fetched.entries && fetched.entries.length) {

        const partitionKeys = new Set(fetched.entries.map(x => x.PartitionKey));
        for (const partitionKey of partitionKeys) {

            const batch = new TableBatch();
            for (const item of fetched.entries.filter(x => x.PartitionKey === partitionKey))
                batch.deleteEntity(item);
            await promised(c => tableService.executeBatch(tableName, batch, c));

        }
        log(`Deleted ${fetched.entries.length} entities from ${tableName}`);
        fetched = continuationToken
            && await promised(c => tableService.queryEntities(tableName, query, continuationToken, c));
        continuationToken = fetched?.continuationToken;

    }

}

async function createRowIfNotExists(log, tableName, partitionKey, rowKey, data) {

    const entity = buildEntity(partitionKey, rowKey, data, log);
    await promised(c => tableService.createTableIfNotExists(tableName, c));
    try {
        await promised(c => tableService.insertEntity(tableName, entity, c));
        return true;
    } catch (err) {
        if (err.err?.statusCode !== 409)
            throw err;
    }
    return false;

}

async function saveOrCreateRow(log, tableName, partitionKey, rowKey, data, mode) {

    const entity = buildEntity(partitionKey, rowKey, data, log);
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

function buildEntity(partitionKey, rowKey, data, log) {

    const entity = {
        PartitionKey: entityGenerator.String(partitionKey),
        RowKey: entityGenerator.String(rowKey)
    };
    for (const [key, val] of Object.entries(data)) {

        if (typeof val === "string") {

            if (uuid.validate(val))
                entity[key] = entityGenerator.Guid(val);
            else
                entity[key] = entityGenerator.String(val);

        } else if (typeof val === "number") {

            if (Math.round(val) === val)
                entity[key] = entityGenerator.Int32(val);
            else
                entity[key] = entityGenerator.Double(val);


        } else if (typeof val === "boolean") {

            entity[key] = entityGenerator.Boolean(val);

        } else {

            log("WARN: Ignored table row field", key, val);

        }

    }
    return entity;
}

async function listRows(log, tableName, partitionKey, conditions) {

    await promised(c => tableService.createTableIfNotExists(tableName, c));
    let query = new TableQuery();
    if (partitionKey) conditions = [["PartitionKey eq ?", partitionKey], ...conditions || []];
    if (conditions) {

        conditions.forEach(([condition, ...args], index) => {
            if (index === 0)
                query = query.where(condition, ...args);
            else {
                query = query.and(condition, ...args);
            }

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

module.exports = {
    createRow,
    createRowIfNotExists,
    upsertRow,
    listRows,
    fetchRow,
    deleteRow,
    deleteRows,
    deleteRowsWithPartitionPrefix
};