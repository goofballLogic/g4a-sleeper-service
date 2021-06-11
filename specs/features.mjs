import { resolve, dirname } from "path";
import { prepare } from "gherkinickel";
import { fileURLToPath } from "url";
import * as registry from "./static/js/registry.mjs";
import "./static/js/step_definitions/given.mjs";
import "./static/js/step_definitions/when.mjs";
import "./static/js/step_definitions/then.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const options = { featuresPath: resolve(__dirname, "./features") };
const features = await prepare(registry, options);

export default features;