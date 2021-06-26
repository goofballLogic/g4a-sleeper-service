import { Given } from "../registry.mjs";
import { prefix } from "./correlation.mjs";
import { invoke } from "./rpc.mjs";

Given("user {word} exists in {word}", async function (userName, tenantName) {

    this.users = this.users || {};
    this.users[userName] = {
        name: prefix(userName, this.scid),
        tenant: prefix(tenantName, this.scid)
    };
    const resp = await fetch("/api/specs/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.users[userName])
    });
    if (!resp.ok)
        throw new Error(`While trying to set up the user, got a ${resp.status} ${resp.statusText}`);

});

Given("{word} has a public {string} document named {string} created by {word}", async function (
    tenantName, disposition, documentName, userName) {

    await createDocumentForUser.call(this, documentName, disposition, tenantName, userName);
    const doc = this.documents[documentName];
    await invoke("MakePublic", {
        document: doc.body.id,
        tenant: doc.body.tenant
    });

});

Given("{word} has a(n) {string} document named {string} created by {word}", async function (
    tenantName, disposition, documentName, userName) {

    await createDocumentForUser.call(this, documentName, disposition, tenantName, userName);

});

async function createDocumentForUser(documentName, disposition, tenantName, userName) {
    this.documents = this.documents || {};
    this.documents[documentName] = {
        name: prefix(documentName, this.scid),
        disposition,
        tenant: prefix(tenantName, this.scid),
        user: prefix(userName, this.scid)
    };
    const resp = await fetch("/api/specs/documents", {
        method: "POST",
        headers: { "Content-type": "application/json" },
        body: JSON.stringify(this.documents[documentName])
    });
    if (!resp.ok)
        throw new Error(`While trying to set up the document, got a ${resp.status} ${resp.statusText}`);
    this.documents[documentName].body = await resp.json();
}
