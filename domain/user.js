const { fetchRow } = require("../lib/rows");

function user(log, userId) {

    return {

        async fetch() {

            return await fetchRow(log, "Users", userId, "");

        }

    }

}

module.exports = { user };