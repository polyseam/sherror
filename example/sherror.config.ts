import type { SherrorConfig, SherrorError } from "../mod.ts";

export const config: SherrorConfig = {
  category_name: "sherror-example",
  errors: [
    {
      error_code: 1,
      app_message: "<🔴>You must include a <🔵>--foo</🔵> option</🔴>",
      post_title: "Error 1",
      post_body: "if this happens, do that",
      _discussion_link: "https://github.com/polyseam/sherror/discussions/27",
    },
    {
      error_code: 2,
      app_message: "<🔴>You must include a <🔵>--bar</🔵> option</🔴>",
      post_title: "Error 2: `bar` must be defined",
      post_body:
        "finding the correct value for `bar` can be done by consulting the orb 🔮",
      _discussion_link: "https://github.com/polyseam/sherror/discussions/28",
    },
  ],
  printer: (error: SherrorError, codepath?: string) => {
    console.debug(
      `Error Code: ${error.error_code}\n` +
        `App Message: ${error.app_message}\n` +
        `Codepath: ${codepath ?? "N/A"}\n` +
        `Discussion Link: ${error._discussion_link ?? "N/A"}`,
    );
  },
}; // satisfies SherrorConfig;
