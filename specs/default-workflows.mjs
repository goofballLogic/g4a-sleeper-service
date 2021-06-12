import { shapeLDWorkflows } from "../initialize/index.js";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const json = readFileSync(resolve(__dirname, "default-workflows.jsonld"));
const parsed = JSON.parse(json);
const shaped = await shapeLDWorkflows(parsed);
export default shaped;