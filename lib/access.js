
module.exports = function access(data, path) {

    const bits = (path || "").split(".");
    while (data && bits.length > 0) {

        const bit = bits.shift();
        data = data[bit];

    }
    return (data === undefined || data === null) ? null : { value: data };

};