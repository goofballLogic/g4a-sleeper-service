module.exports = strategy => async (req, res) => {

    try {

        await strategy(req, res);

    } catch (err) {

        if (err.stack)
            req.context.log(`ERROR: ${err.stack || err}`);
        else
            req.context.log(err);
        res.status(500).send("An error occurred");

    }

};