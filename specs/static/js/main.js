import "./step_definitions/given.mjs";
import "./step_definitions/when.mjs";
import "./step_definitions/then.mjs";
import { prefix } from "./step_definitions/correlation.mjs";

import { entries } from "./registry.mjs";

function error(err) {
    alert(err);
}

function el(tag, classes, text) {

    const x = document.createElement(tag);
    if (classes) x.className = classes.join(" ");
    if (text) x.textContent = text;
    return x;

}

function htmlRender(output, container) {

    container = container || document.body;
    if (Array.isArray(output))
        output.forEach(x => htmlRender(x, container));
    else {

        const newContainer = container.tagName === "BODY"
            ? el("ARTICLE")
            : container.tagName === "ARTICLE"
                ? el("SECTION")
                : el("DIV");
        container.appendChild(newContainer);

        if (output.space) newContainer.classList.add("spaced");
        for (const message of output.messages) {

            const classes = [];
            if (message.bold) classes.push("bold");
            if (message.underline) classes.push("underline");
            if (message.color) classes.push(`color-${message.color}`);
            if (message.pre) classes.push("pre");
            if (message.text)
                newContainer.appendChild(el("DIV", classes, message.text));
            else if (message.error)
                newContainer.appendChild(el("DIV", classes.concat("error"), message.error));
            else
                newContainer.appendChild(el("DIV", classes.concat("error"), `Unrecognised: ${JSON.stringify(message)}`));

        }
        if (output.output) htmlRender(output.output, newContainer);

    }

}

function consoleRender(output, nesting = 0) {

    if (Array.isArray(output))
        output.forEach(x => consoleRender(x, nesting));
    else {

        if (output.space) console.log("");
        const indent = "    ".repeat(nesting);
        for (const message of output.messages) {

            let style = "";
            if (message.bold) style += "font-weight: bold;";
            if (message.underline) style += "text-decoration: underline;";
            if (message.color) style += `color: ${message.color};`;
            if (message.text)
                console.log(`%c${indent}${message.text}`, style);
            else if (message.error)
                console.error(`${indent}${message.error}`);
            else
                console.error(`${indent}Unrecognised`, message);

        }
        if (output.output) consoleRender(output.output, nesting + 1);

    }

}

const pad = (x, length) => {

    x = x?.toString() || "";
    if (x.length > length) return x;
    return " ".repeat(length - x.length) + x;

}

(async function () {

    const resp = await fetch("/api/specs/features");
    if (!resp.ok)
        error(`${resp.status} ${resp.statusText}`);
    else {

        const progressContainer = el("aside");
        document.body.appendChild(progressContainer);
        const now = Date.now();
        progress = x => {

            progressContainer.appendChild(el("div", "", `${pad(Date.now() - now, 10)}: ${x}`));
            progressContainer.scrollTop = progressContainer.scrollHeight;

        }

        try {

            progress("Loading features");
            const features = await resp.json();
            progress("Features loaded");
            const output = [];
            const runContext = {
                cid: randomInt(16)
            }

            for (const { feature, uri, pickles } of features)
                await processFeature(output, feature, pickles, uri, runContext);

            const sessionPrefix = prefix("", runContext.cid);
            htmlRender(output);
            document.body.classList.add("complete");

            fetch(`/api/specs/sessions/${sessionPrefix}`, {
                method: "DELETE"
            }).then(
                console.log.bind(console),
                console.error.bind(console)
            );

        } finally {

            document.body.classList.add("complete");

        }

    }

})();

const url = new URL(location.href);
const specificFeature = url.searchParams.get("feature");
const specificScenario = url.searchParams.get("scenario");
let progress = () => { };

function randomInt(entropy) {
    return (Date.now() * Math.random()).toString().replace(".", "").substring(0, entropy);
}

async function processFeature(output, feature, pickles, featurePath, runContext) {

    const { keyword, name: featureName, description, children } = feature;
    if (specificFeature && !featurePath.includes(specificFeature)) return;
    if (specificScenario && !children?.some(x =>
        Object.values(x).some(child =>
            child.name.startsWith(specificScenario)
        )
    )) return;

    progress(`Processing ${featureName}`);

    const ret = {
        space: true,
        messages: [
            { text: `${keyword}: ${featureName}`, bold: true, underline: true },
            { text: description, pre: true }
        ],
        output: []
    };
    output.push(ret);
    const featureContext = JSON.parse(JSON.stringify(runContext));
    for (const pickle of pickles)
        await processPickle(ret.output, pickle, children, featurePath, featureContext);

}

async function processPickle(output, pickle, children, featurePath, featureContext) {

    const { astNodeIds: scenarioIds, steps, name: scenarioName } = pickle;
    if (specificScenario && !scenarioName.startsWith(specificScenario)) return;
    const ret = {
        space: true,
        messages: [],
        output: []
    }
    output.push(ret);
    progress(`   ${scenarioName}`);
    const scenarioContext = JSON.parse(JSON.stringify(featureContext));
    scenarioContext.scid = scenarioContext.cid + "-" + randomInt(9);
    let skipping = false;
    const [scenarioId] = scenarioIds;
    const pickleChild = children.map(x => x.scenario || x.background).find(x => x.id === scenarioId);
    if (!pickleChild)
        ret.messages.push({ error: new Error(`Invalid lookupId for "${scenarioName}" in ${featurePath}`) });
    else {
        ret.messages.push({ bold: true, text: `${pickleChild.keyword}: ${scenarioName}` });
        if (steps)
            for (const step of steps) {
                const stepRet = {
                    messages: [],
                    output: []
                };
                ret.output.push(stepRet);
                const stepDef = findChildOf(step, children);
                skipping = await processStep(stepRet, step, stepDef, skipping, scenarioContext);
            }
    }

}

function findChildOf(step, children) {

    const stepId = step?.astNodeIds[0];
    if (stepId)
        for (const child of children)
            for (const value of Object.values(child)) {

                const stepDef = value.steps?.find(s => s.id === stepId);
                if (stepDef) return stepDef;

            }

}

async function processStep(ret, step, stepDef, skipping, scenarioContext) {

    const { text, matchedTest } = step;
    progress(`      ${text}`);
    if (!stepDef)
        ret.messages.push({
            error: new Error(`No step definition processing ${JSON.stringify(step)}`)
        });
    else {

        const stepText = `${stepDef.keyword}${text}`;
        if (skipping)
            ret.messages.push({ color: "silver", text: stepText });
        else if (matchedTest) {

            const test = entries.find(e => e.keyword === matchedTest.keyword &&
                e.text === matchedTest.text);
            if (test) {

                const { strategy } = test;
                try {

                    await strategy.apply(scenarioContext, matchedTest.args);
                    ret.messages.push({ color: "green", text: stepText });

                } catch (err) {

                    ret.messages.push({ color: "red", text: stepText });
                    const errorRet = { messages: [] };
                    ret.output.push(errorRet);
                    if ("expected" in err) {

                        errorRet.messages.push({ color: "red", text: `Expected: ${err.expected}` });
                        errorRet.messages.push({ color: "red", text: `Actual: ${err.actual}` });

                    }
                    else
                        errorRet.messages.push({ error: err });
                    skipping = true;

                }

            } else {

                ret.messages.push({
                    error: `Matched test not found: ${stepText} ${JSON.stringify(matchedTest)}`
                });
                skipping = true;

            }

        } else {

            ret.messages.push({ color: "blue", text: `Not defined: ${stepText}` });
            skipping = true;

        }

    }
    return skipping;
}

