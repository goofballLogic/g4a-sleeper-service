import { Then } from "../registry.mjs";

const should = typeof chai !== "undefined" && chai.should();

Then("the request to access the document succeeds", async function () {

    if (!this.lastDocumentFetch)
        throw new Error("No document was requested");
    const { ok, status, statusText, url } = this.lastDocumentFetch;
    if (!ok)
        throw new Error(`Fetch to ${url} failed with: ${status} ${statusText}`);

});

Then("the request to access the document fails", async function () {

    if (!this.lastDocumentFetch)
        throw new Error("No document was requested");
    const { ok, status, statusText, url } = this.lastDocumentFetch;
    if (ok)
        throw new Error(`Fetch to ${url} succeeded with: ${status} ${statusText}`);

});