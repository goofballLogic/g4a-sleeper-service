import { When } from "../registry.mjs";
import { prefix } from "./correlation.mjs";

When("{word} tries to access the document {string}", async function (userName, documentName) {

    await fetchDocumentForUser(this, documentName, userName, `/api/documents/{tid}/{docId}`);

});

When("{word} tries to access the public document {string}", async function (userName, documentName) {

    await fetchDocumentForUser(this, documentName, userName, `/api/documents/public/{tid}/{docId}`);

});

When("{word} tries to access the document {string} as the author", async function (userName, documentName) {

    await fetchDocumentForUser(this, documentName, userName, `/api/documents/author/{tid}/{docId}`);

});

When("{word} lists documents in {word}", async function (userName, tenantName) {

    const headers = requireUserHeader(this, userName);
    const tenant = prefix(tenantName, this.scid);
    const resp = await fetch(`/api/documents/${tenant}`, { headers });
    this.lastListFetch = resp;
    this.lastListFetchBody = resp.ok ? await resp.json() : null;

});

When("I call to initialize as user {word}", async function (userName) {

    const headers = {
        "Authorization": `Bearer TESTUSER: ${userName}`,
        "x-initialize-referer": "https://grants4all.z35.web.core.windows.net"
    };
    this.lastInitializeFetch = await fetch(`/api/initialize`, { method: "POST", headers });

});

async function fetchDocumentForUser(context, documentName, userName, urlTemplate) {

    const document = context.documents && context.documents[documentName];
    if (!document)
        throw new Error("Unknown document");
    const docId = document.body.id;
    const tid = document.tenant;
    const url = urlTemplate.replace(/\{tid\}/g, tid).replace(/\{docId\}/g, docId);
    context.lastDocumentFetch = await fetch(url, { headers: requireUserHeader(context, userName) });

}

function requireUserHeader(context, userName) {

    const user = requireUser(context, userName);
    return { "X-test-user": user.name };

}

function requireUser(context, userName) {

    const user = context.users && context.users[userName];
    if (!user)
        throw new Error("Unknown user");
    return user;

}