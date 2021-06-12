import handlebars from "handlebars";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { html, json, badRequest, methodNotAllowed, notFound, created } from "./res.mjs";
import { tenant } from "../domain/tenant.js";
import features from "./features.mjs";
import defaultWorkflows from "./default-workflows.mjs";
import { deleteRowsWithPartitionPrefix, fetchRow } from "../lib/rows.js";
import { deleteBlobContainersWithPrefix } from "../lib/blobs.js";
import TEST_PREFIX from "./test-prefix.js";

const allTables = [
    "TenantDocuments",
    "TenantGroups",
    "TenantGroupUsers",
    "Tenants",
    "TenantWorkflows",
    "Users"
];

const { compile } = handlebars;

const __dirname = dirname(fileURLToPath(import.meta.url));

const { ENABLE_CACHE } = process.env;
const enableCache = ENABLE_CACHE === "true";
if (!enableCache) console.warn(`Cache is not enabled: ENABLE_CACHE=${ENABLE_CACHE}`);
const cache = {};

const readThrough = (name, strategy) => cache[name] = (enableCache && cache[name]) || strategy();
const contentOf = relativeFileName => readThrough(
    relativeFileName,
    () => readFileSync(join(__dirname, relativeFileName)).toString()
);
const skeletonTemplate = compile(contentOf("skeleton.html"));
const skeleton = (data, status) => html(skeletonTemplate(data), status);

const isWhiteListed = x => x && x.startsWith(TEST_PREFIX);

async function users(route, context, req) {

    if (route.length > 1)
        return notFound();
    if (req.method !== "POST")
        return methodNotAllowed(`Expected POST but got ${req.method}`);
    const { name, tenant: tenantName } = req.body;
    if (!isWhiteListed(name))
        return badRequest(`User's name must begin with ${TEST_PREFIX} but got ${name}`);
    if (!isWhiteListed(tenantName))
        return badRequest(`Tenant's name must begin with ${TEST_PREFIX} but got ${tenantName}`);

    const testTenant = tenant(context.log, tenantName);
    await Promise.all([
        testTenant.ensureExists({ name: tenantName }),
        testTenant.ensureDefaultWorkflows(defaultWorkflows),
        testTenant.ensureUserExists(name, { defaultTenantId: tenantName })
    ]);

    return created();

}

async function documents(route, context, req) {

    if (route.length > 1)
        return notFound();
    if (req.method !== "POST")
        return methodNotAllowed(`Expected POST but got ${req.method}`);
    const {
        name,
        disposition,
        tenant: tenantName,
        user: userName
    } = req.body;
    if (!isWhiteListed(name))
        return badRequest(`Document's name must begin with ${TEST_PREFIX} but got ${name}`);
    if (!isWhiteListed(userName))
        return badRequest(`User's name must begin with ${TEST_PREFIX} but got ${userName}`);
    if (!isWhiteListed(tenantName))
        return badRequest(`Tenant's name must begin with ${TEST_PREFIX} but got ${tenantName}`);

    const testTenant = tenant(context.log, tenantName);
    const [, , item] = await Promise.all([
        testTenant.ensureExists({ name: tenantName }),
        testTenant.ensureDefaultWorkflows(defaultWorkflows),
        testTenant.createDocumentForUser({ id: userName }, { disposition })
    ]);

    return created(item);

}

async function sessions(route, context, req) {

    if (route.length > 2)
        return notFound();
    if (req.method !== "DELETE")
        return methodNotAllowed(`Expected DELETE but got ${req.method}`);
    const sessionPrefix = route[1] || TEST_PREFIX;
    if (!sessionPrefix.startsWith(TEST_PREFIX))
        return badRequest(`Expected sesion prefix ${TEST_PREFIX} but got ${sessionPrefix}`);
    const pending = [];
    pending.push(deleteBlobContainersWithPrefix(context.log, sessionPrefix));
    for (const tableName of allTables)
        pending.push(deleteRowsWithPartitionPrefix(context.log, tableName, sessionPrefix));
    await Promise.all(pending);
    context.log(`Deleted session ${sessionPrefix}`);

}

const rpcFunctions = {

    async MakePublic(log, args) {
        console.log(1);
        if (!args) return { error: "Arguments missing" };
        const { document: documentId, tenant: tenantId } = args;
        if (!isWhiteListed(tenantId)) return { error: `Invalid tenant id: ${tenantId}` };
        try {

            return await tenant(log, tenantId).dangerouslyOverrideDocumentValues(documentId, { "public": true });

        } catch (err) {

            return { error: err.message };

        }

    }

};

async function rpc(route, context, req) {

    if (route.length > 1)
        return notFound();
    if (req.method !== "POST")
        return methodNotAllowed(`Expected POST but got ${req.method}`);
    const functionName = req.body?.functionName;
    if (!(functionName in rpcFunctions))
        return badRequest(`Unrecognised function ${functionName}`);
    const result = await rpcFunctions[functionName](context.log, req.body?.args);
    return json(result);

}

async function serveDynamic(route, context, req) {

    switch (route[0]) {
        case undefined:
            return skeleton({
                "head": contentOf("specs-head.html"),
                "main": contentOf("specs-main.html")
            });
        case "features":
            return json(features);
        case "users":
            return users(route, context, req);
        case "documents":
            return documents(route, context, req);
        case "sessions":
            return sessions(route, context, req);
        case "rpc":
            return rpc(route, context, req);
        default:
            return skeleton({ "main": "Not found" }, 404);
    }

}


function serveStatic(relativePath) {

    const contentType = (relativePath.endsWith(".js") || relativePath.endsWith(".mjs"))
        ? "text/javascript"
        : relativePath.endsWith(".css")
            ? "text/css"
            : relativePath.endsWith(".html")
                ? "text/html"
                : "text/plain";

    try {

        return {
            body: contentOf(relativePath),
            headers: { "Content-Type": contentType },
            status: 200
        }

    } catch (err) {

        if (err.code === "ENOENT")
            return {
                body: "Not found",
                status: 404
            };
        throw err;

    }

}

export default async function (context, req) {

    try {

        const pathname = new URL(req.url).pathname;
        const route = pathname.split("/").slice(3);
        const routeName = route.join("/");

        context.log("specs", route);
        if (route[0] === "static")
            context.res = serveStatic(routeName);
        else
            context.res = await serveDynamic(route, context, req);

    } catch (err) {

        context.log.error(err);
        context.res = skeleton({ "main": "An internal server error occurred" }, 500);

    }

};