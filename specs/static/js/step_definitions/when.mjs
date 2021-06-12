import { When } from "../registry.mjs";

When("{word} tries to access the document {string}", async function (userName, documentName) {

    await accessDocumentForUser.call(this, userName, documentName);

});

When("{word} tries to access the public document {string}", async function (userName, documentName) {

    await accessDocumentForUser.call(this, userName, documentName, null, true);

});

When("{word} tries to access the document they created {string}", async function (userName, documentName) {

    await accessDocumentForUser.call(this, userName, documentName, "created");

});

async function accessDocumentForUser(userName, documentName, tid, isPublic) {

    const user = this.users && this.users[userName];
    if (!user)
        throw new Error("Unknown user");
    const document = this.documents && this.documents[documentName];
    if (!document)
        throw new Error("Unknown document");
    const docId = document.body.id;
    tid = tid || document.body.tenant;
    const url = `/api/documents/${isPublic ? "public/" : ""}${tid}/${docId}`;
    this.lastDocumentFetch = await fetch(url, {
        method: "GET",
        headers: { "X-test-user": user.name }
    });

}
