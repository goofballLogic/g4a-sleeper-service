const { user: theUser } = require("../domain/user");

async function requireUserTenancy(req, res, next) {

    try {

        const { tid } = req.params;
        const { log } = req.context;
        const { id } = req.user;

        if (!req.models) req.models = {};
        if (!req.models.user) req.models.user = await theUser(log, id).fetch();

        if (tid === "me") {

            req.params.tid = id;
            next();

        } else {

            const tenants = JSON.parse(req.models.user.tenants);
            if (tid === "me" || tenants.includes(tid)) {

                next();

            } else {

                log(`WARN: Attempt by ${id} to access tenant ${tid} but only has ${tenants}`);
                res.status(403).send("Access denied");

            }

        }

    } catch (err) {

        next(err);

    }

}

module.exports = requireUserTenancy;