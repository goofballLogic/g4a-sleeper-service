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

Then("the list contains the documents", async function (expectedTable) {

    if (!this.lastListFetch)
        throw new Error("No list found");
    if (!this.lastListFetch.ok)
        throw new Error(`Fetching the list caught ${this.lastListFetch.status} ${this.lastListFetch.statusText}`);
    const expected = expectedTable.hashes();
    const actual = this.lastListFetchBody?.items;
    console.log(expected, actual);
    throw new Error();

});

Then("the initialization call should have succeeded", function () {

    const { lastInitializeFetch } = this;
    if (!lastInitializeFetch)
        throw new Error("No initialize was requested");
    if (!lastInitializeFetch.ok)
        throw new Error(`Initialize failed: ${lastInitializeFetch.status} ${lastInitializeFetch.statusText}`);

});

Then("the initialization call should have failed", function () {

    const { lastInitializeFetch } = this;
    if (!lastInitializeFetch)
        throw new Error("No initialize was requested");
    if (lastInitializeFetch.ok)
        throw new Error(`Initialize succeeded: ${lastInitializeFetch.status} ${lastInitializeFetch.statusText}`);

});