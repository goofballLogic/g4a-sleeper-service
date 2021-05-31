const { user: theUser } = require("../domain/user");

async function requireAnyUser(req, res, next) {

    try {

        const { log } = req.context;
        const { id } = req.user;
        if (!req.models) req.models = {};
        if (!req.models.user) req.models.user = await theUser(log, id).fetch();

        if (!req.models.user) {

            accessDenied(`Attempt by ${id} to access tenant ${tid} but not found`);

        }

    } catch (err) {

        next(err);

    }

}

async function requireUserTenancy(req, res, next) {

    try {

        const { tid } = req.params;
        const { log } = req.context;
        const { id } = req.user;

        function accessDenied(reason) {

            log(`WARN: ${reason}`);
            res.status(403).send("Access denied");

        }

        if (!tid) {

            accessDenied(`Attempt by ${id} to access an undefined tenant: ${tid}`);

        } else {
            if (!req.models) req.models = {};
            if (!req.models.user) req.models.user = await theUser(log, id).fetch();

            if (!req.models.user) {

                accessDenied(`Attempt by ${id} to access tenant ${tid} but not found`);

            } else {

                const tenants = JSON.parse(req.models.user.tenants);
                if (tid === "me" || tenants.includes(tid)) {

                    next();

                } else {

                    accessDenied(`Attempt by ${id} to access tenant ${tid} but only has ${tenants}`);

                }

            }
        }

    } catch (err) {

        next(err);

    }

}

module.exports = requireUserTenancy;