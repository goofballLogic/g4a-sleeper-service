module.exports = async function promised(x) {
    return await new Promise((resolve, reject) => {
        x(
            (err, result, resp) => err
                ? reject(resp ? { err, resp } : err)
                : resolve(result)
        );
    });
};
