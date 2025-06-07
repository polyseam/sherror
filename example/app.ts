import { config } from "./sherror.config.ts";
import { SherrorClient } from "../mod.ts";

// Initialize the Sherror client
const sc = new SherrorClient(config);

const error = sc.get(1);
const codepath = new error.Codepath(); // constructed here for accuracy
error.print(codepath);
error.exit();
