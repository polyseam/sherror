import { config } from "./sherror.config.ts";
import { SherrorClient } from "../mod.ts";

// Initialize the Sherror client
const sc = new SherrorClient(config);

const error = sc.get(1);
const codepath = new error.Codepath();
console.log(error.app_message);
console.log(codepath.toString());
console.log(error?._discussion_link);

// Sync with GitHub Discussions (requires GITHUB_TOKEN)
// await client.syncWithGitHub("your-org", "your-repo");
// const updatedConfig = client.getConfig();
// console.log(updatedConfig);
