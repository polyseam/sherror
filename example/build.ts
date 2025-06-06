import { SherrorClient } from "@polyseam/sherror";
import { config } from "./sherror.config.ts";

const sc = new SherrorClient(config);

// this should run pre-commit, i think
console.log("reticulating splines");

await sc.sync();
