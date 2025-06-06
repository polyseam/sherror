# sherror

> Pronounced _share-roar_

A tool to keep error codes in your codebase useful, up‑to‑date, and shareable by
leveraging GitHub Discussions.

## Features

- Define error codes with rich messages and metadata in TypeScript
- Automatically create and sync GitHub Discussions for each error
- Enrich runtime errors with user-friendly messages and direct discussion links
- Track error locations with automatic code path detection
- Supports styled console output with emoji and colors

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
import { SherrorConfig } from "@polyseam/sherror";

export const config: SherrorConfig = {
  category_name: "sherror-errors",
  errors: [
    {
      error_code: 1,
      app_message: "<🔴>You must include a <🔵>--foo</🔵> option</🔴>",
      post_title: "Error 1: Missing required option",
      post_body:
        "## Description\nThis error occurs when the required `--foo` option is missing.\n\n## Resolution\nMake sure to include the `--foo` option with a valid value.",
    },
    {
      error_code: 2,
      app_message: "<🔴>Invalid value for <🔵>--bar</🔵> option</🔴>",
      post_title: "Error 2: Invalid option value",
      post_body:
        "## Description\nThe value provided for `--bar` is invalid.\n\n## Valid Values\n- Value 1\n- Value 2\n- Value 3",
    },
  ],
} satisfies SherrorConfig;
```

2. Use errors in your application:

```typescript
import { config } from "./sherror.config.ts";
import { SherrorClient } from "@polyseam/sherror";

// Initialize the Sherror client
const sc = new SherrorClient(config);

// Get an error by code
const error = sc.get(1);

// Get code path information
const codepath = new error.Codepath();

// Log the error with rich formatting
console.log(error.app_message);
console.log(codepath.toString());

// Access the discussion link (if synced with GitHub)
console.log(error?._discussion_link);
```

3. Sync with GitHub Discussions (optional):

```typescript
// In your build script (e.g., build.ts)
import { SherrorClient } from "@polyseam/sherror";
import { config } from "./sherror.config.ts";

const sc = new SherrorClient(config);

// This will create/update discussions for all errors
await sc.sync();
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

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

### Configuration Options

- **category_name** (string): GitHub Discussions category name.
- **errors** (array): List of error definitions:
  - `error_code` (number): Unique code (e.g., exit code).
  - `app_message` (string): User-facing message (supports inline emojis/styles).
  - `post_title` (string): Title for the Discussion thread.
  - `post_body` (string): Body content for the Discussion thread.
  - `codepath` (string): Code pointer for runtime debugging.
  - `_discussion_link` (string, optional): GitHub Discussion URL (auto-generated
    if not provided).

See [example.ts](./example.ts) for a complete usage example.

## Usage

```ts
import { SherrorClient } from "@polyseam/sherror";

const sc = new SherrorClient("./sherror.ts");

// at build-time
sc.sync();

// at runtime
const sherror = sc.get(1);
sherror.print(); // print error message, discussion link, and codepath
Deno.exit(sherror.error_code);
```

At runtime, `sherror` will provide you with:

1. Display the registered `app_message`.
2. Print a URL linking to the live GitHub Discussion.
3. Point to the runtime `codepath`.
4. Error details you can persist to telemetry.
5. Exit with the specified error code.

## Example Usage

```typescript
import { SherrorClient, type SherrorConfig } from "@polyseam/sherror";

// Define your error configuration
const config: SherrorConfig = {
  category_name: "widget-errors",
  errors: [
    {
      error_code: 1,
      app_message: "<🔴>You must include a <🔵>--foo</🔵> option</🔴>",
      post_title: "Error 1",
      post_body: "If this happens, do that.",
      codepath: "src/foo.ts:myFunction:42",
      _discussion_link: "https://github.com/polyseam/discussions/36",
    },
    {
      error_code: 2,
      app_message: "<🔴>You must include a <🔵>--bar</🔵> option</🔴>",
      post_title: "Error 2: `bar` must be defined",
      post_body:
        "Finding the correct value for `bar` can be done by consulting the orb 🔮.",
      codepath: "src/foo.ts:myFunction:58",
    },
  ],
};

// Initialize the Sherror client
const client = new SherrorClient(config);

// Example: Get and handle an error
function handleError(errorCode: number) {
  const error = config.errors.find((e) => e.error_code === errorCode);
  if (!error) throw new Error(`Error ${errorCode} not found`);

  const sherror = {
    error_code: error.error_code,
    app_message: error.app_message,
    discussion_link: error._discussion_link || "",
    codepath: error.codepath,
    print() {
      console.log(
        `${this.app_message}\n${this.discussion_link}\n${this.codepath}`,
      );
    },
  };

  return sherror;
}

// Usage
const error = handleError(1);
error.print();

// Sync with GitHub Discussions (requires GITHUB_TOKEN)
// await client.syncWithGitHub("your-org", "your-repo");
// const updatedConfig = client.getConfig();
```

## Environment Variables

- `GITHUB_TOKEN` (required): Personal Access Token with `repo` and `discussions`
  scopes to manage GitHub Discussions.

## Roadmap

- [ ] Create and update discussions based on config diffs.
- [ ] Support multiple discussion platforms (e.g., GitLab).
- [ ] Integration with CI for automated sync.
- [ ] Telemetry backend for aggregated error tracking.

## Contributing

Contributions, issues, and feature requests are welcome! Please open an issue or
submit a pull request.
