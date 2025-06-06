import { SherrorConfig } from "../mod.ts";

export const config: SherrorConfig = {
  category_name: "sherror-example",
  errors: [
    {
      error_code: 1,
      app_message: "<🔴>You must include a <🔵>--foo</🔵> option</🔴>",
      post_title: "Error 1",
      post_body: "if this happens, do that",
      _discussion_link: "https://github.com/polyseam/discussions/36",
    },
    {
      error_code: 2,
      app_message: "<🔴>You must include a <🔵>--bar</🔵> option</🔴>",
      post_title: "Error 2: `bar` must be defined",
      post_body:
        "finding the correct value for `bar` can be done by consulting the orb 🔮",
    },
  ],
} satisfies SherrorConfig;
