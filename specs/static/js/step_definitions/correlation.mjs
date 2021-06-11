const PREFIX = "g4aAPITest-";
export const prefix = (x, cid) =>
    cid
        ? x
            ? `${PREFIX}${cid}-${x}`
            : `${PREFIX}${cid}`
        : PREFIX;