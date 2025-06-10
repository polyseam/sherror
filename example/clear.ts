import { SherrorClient } from "@polyseam/sherror";
import { config } from "./sherror.config.ts";

const sc = new SherrorClient(config);

// clear all discussions in the configured category
await sc.clear();
