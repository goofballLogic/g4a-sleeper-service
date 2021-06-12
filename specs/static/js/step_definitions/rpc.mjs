export async function invoke(functionName, args, suppressThrow) {

    const resp = await fetch("/api/specs/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            functionName,
            args
        })
    });
    if (!resp.ok)
        throw new Error(`Invoking RPC /api/specs/rpc for ${functionName} got ${resp.status} ${resp.statusText}`);
    const json = await resp.json();
    if (json && json.error)
        throw new Error(`RPC ${functionName}: ${json.error}`);
    return [json, resp];

}