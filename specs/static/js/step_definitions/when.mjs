import { When } from "../registry.mjs";

When("{word} tries to access the document {string}", async function (userName, documentName) {

    await fetchDocumentForUser(this, documentName, userName, `/api/documents/{tid}/{docId}`);

});

When("{word} tries to access the public document {string}", async function (userName, documentName) {

    await fetchDocumentForUser(this, documentName, userName, `/api/documents/public/{tid}/{docId}`);

});

When("{word} tries to access the document they created {string}", async function (userName, documentName) {

    await fetchDocumentForUser(this, documentName, userName, `/api/documents/author/{tid}/{docId}`);

});

async function fetchDocumentForUser(context, documentName, userName, urlTemplate) {

    const document = context.documents && context.documents[documentName];
    if (!document)
        throw new Error("Unknown document");
    const user = context.users && context.users[userName];
    if (!user)
        throw new Error("Unknown user");
    const docId = document.body.id;
    const tid = document.tenant;
    const url = urlTemplate.replace(/\{tid\}/g, tid).replace(/\{docId\}/g, docId);
    context.lastDocumentFetch = await fetch(url, { headers: { "X-test-user": user.name } });

}
