# sherror

> Pronounced _share-roar_

> [!CAUTION]
> Experimental. Do not use this yet!

A tool to keep error codes in your codebase useful, up‑to‑date, and shareable by
leveraging GitHub Discussions.

## Features

- Define error codes with rich messages and metadata in TypeScript
- Automatically create and sync GitHub Discussions for each error
- Enrich runtime errors with user-friendly messages and direct discussion links
- Track error locations with automatic code path detection
- Supports styled console output with emoji and colors
- Customizable error printing

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Usage](#usage)
- [GitHub Integration](#github-integration)
- [API Reference](#api-reference)
- [Contributing](#contributing)

## Installation

```bash
deno add @polyseam/sherror
```

## Quick Start

1. Create a configuration file (e.g., `sherror.config.ts`):

```typescript
import type { SherrorConfig } from "@polyseam/sherror";

export const config: SherrorConfig = {
  category_name: "sherror-errors",
  errors: [
    {
      error_code: 1,
      app_message: "<🔴>You must include a <🔵>--foo</🔵> option</🔴>",
      post_title: "Error 1: Missing required option",
      post_body:
        "## Description\nThis error occurs when the required `--foo` option is missing.\n\n## Resolution\nMake sure to include the `--foo` option with a valid value.",
      _discussion_link: "https://github.com/your-org/your-repo/discussions/1",
    },
    {
      error_code: 2,
      app_message: "<🔴>Invalid value for <🔵>--bar</🔵> option</🔴>",
      post_title: "Error 2: Invalid option value",
      post_body:
        "## Description\nThe value provided for `--bar` is invalid.\n\n## Valid Values\n- Value 1\n- Value 2\n- Value 3",
    },
  ],
  printer: (error, codepath) => {
    console.debug(
      `Error Code: ${error.error_code}\n` +
        `App Message: ${error.app_message}\n` +
        `Codepath: ${codepath || "N/A"}\n` +
        `Discussion Link: ${error._discussion_link || "N/A"}`,
    );
  },
} satisfies SherrorConfig;
```

2. Create a build script (e.g., `build.ts`) to sync errors with GitHub
   Discussions:

```typescript
import { SherrorClient } from "@polyseam/sherror";
import { config } from "./sherror.config.ts";

const sc = new SherrorClient(config);
console.log("Synchronizing errors with GitHub Discussions...");
await sc.sync();
```

3. Use errors in your application:

```typescript
import { config } from "./sherror.config.ts";
import { SherrorClient } from "@polyseam/sherror";

// Initialize the Sherror client
const sc = new SherrorClient(config);

// Get an error by code
const error = sc.get(1);
const codepath = new error.Codepath();

// Print the error with codepath
error.print(codepath);

// Optionally, exit the process with the error code
error.exit();
```

## GitHub Integration

To enable GitHub Discussions integration:

1. Create a personal access token with `public_repo` scope at
   [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Set the token as an environment variable:
   ```bash
   export GITHUB_TOKEN=your_token_here
   ```
3. Enable Discussions in your repository settings:
   - Go to your repository on GitHub
   - Click on "Settings" > "Options"
   - Scroll down to "Features"
   - Enable "Discussions"
   - Create a category (e.g., "sherror-errors") in the Discussions settings
4. Set the `category_name` in your config to match the category you created
5. Run your build script to sync errors with GitHub Discussions

## API Reference

### SherrorClient

```typescript
class SherrorClient {
  constructor(config: SherrorConfig);

  // Get an error by its code
  get(code: number): SherrorError;

  // Sync errors with GitHub Discussions
  sync(): Promise<void>;

  // Get the current configuration
  getConfig(): SherrorConfig;
}
```

### SherrorConfig

```typescript
interface SherrorConfig {
  // Name of the GitHub Discussions category
  category_name: string;

  // Array of error definitions
  errors: SherrorError[];

  // Optional custom printer function
  printer?: (error: SherrorError, codepath?: string) => void;
}

interface SherrorError {
  // Unique error code (number)
  error_code: number;

  // Message to display to users (supports HTML-like tags for styling)
  app_message: string;

  // Title for the GitHub Discussion
  post_title: string;

  // Body content for the GitHub Discussion (supports Markdown)
  post_body: string;

  // Automatically managed - link to the GitHub Discussion
  _discussion_link?: string;
}
```

## Styling Messages

Sherror supports simple styling in error messages using HTML-like tags:

- `<🔴>Red text</🔴>` - Red text for error messages
- `<🔵>Blue text</🔵>` - Blue text for important values

These will be converted to appropriate ANSI escape codes when logged to the
console.

## Custom Printing

You can customize how errors are printed by providing a `printer` function in
your config:

```typescript
printer: ((error, codepath) => {
  console.error(
    `[ERROR ${error.error_code}] ${error.app_message}\n` +
      `Location: ${codepath || "unknown"}\n` +
      `For more information, see: ${
        error._discussion_link || "No discussion available"
      }`,
  );
});
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

### Development

1. Clone the repository
2. Run tests:
   ```bash
   deno test
   ```
3. Make your changes
4. Ensure tests pass
5. Submit a pull request

## License

MIT
