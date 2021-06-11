export function html(body, status) {

    return {
        status: status || 200,
        body,
        headers: { "Content-Type": "text/html" }
    };

}

export function json(obj, status) {

    return {
        status: status || 200,
        body: JSON.stringify(obj),
        headers: { "Content-Type": "application/json" }
    };

}

export const notFound = (text = "Not found") => ({ status: 404, body: text });

export const methodNotAllowed = (text = "Method not allowed") => ({ status: 405, body: text });

export const badRequest = (text) => ({ status: 400, body: text });

export const created = (body) => body
    ? typeof (body) === "object"
        ? json(body, 201)
        : ({ status: 201, body })
    : ({ status: 201 });