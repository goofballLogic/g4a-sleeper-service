const { user: theUser } = require("../domain/user");

async function requireAnyUser(req, res, next) {

    try {

        const { log } = req.context;
        const { id } = req.user;

        function accessDenied(reason) {

            log(`WARN: ${reason}`);
            res.status(403).send("Access denied");

        }

        if (!req.models) req.models = {};
        if (!req.models.user) req.models.user = await theUser(log, id).fetch();

        if (!req.models.user) {

            accessDenied(`Attempt by ${id} to access but user not found`);

        }

        next();

    } catch (err) {

        next(err);

    }

}

module.exports = requireAnyUser;