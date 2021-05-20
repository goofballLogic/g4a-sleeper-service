async function publicStatusesForTenant(tenantId) {

    return ["live"];

}

module.exports = {

    async fetchPublicStatusForTenant(tenantId) {

        const publicStatuses = await publicStatusesForTenant(tenantId);
        if (publicStatuses.length != 1)
            throw new Error("Not implemented - not single public status");
        return publicStatuses[0];

    }

};
