import { loadSync } from "@std/dotenv";
import { colorize } from "@polyseam/emoji-ansi-colorizer";
import { Node, Project, SyntaxKind, type VariableDeclaration } from "ts-morph";
import { Codepath } from "@polyseam/codepath";

export type Printer = (error: SherrorError, codepath?: Codepath) => void;

export interface SherrorError {
  error_code: number;
  app_message: string;
  post_title: string;
  post_body: string;
  _discussion_link?: string;
}

export interface SherrorConfig {
  category_name: string;
  errors: SherrorError[];
  printer?: (error: SherrorError, codepath?: string) => void;
}

interface Discussion {
  id: string;
  title: string;
  body: string;
  url?: string;
}

interface DiscussionResponse {
  repository: {
    discussion: Discussion | null;
  } | null;
}

interface CreateDiscussionResponse {
  createDiscussion: {
    discussion: {
      url: string;
    };
  };
}

export class SherrorClient {
  private ghToken: string;
  private sherrorConfig: SherrorConfig;
  private project: Project;

  /**
   * Creates a SherrorClient for the given
   */
  constructor(config: SherrorConfig) {
    loadSync({
      export: true,
    });
    this.ghToken = Deno.env.get("GITHUB_TOKEN") as string;
    if (!this.ghToken) {
      throw new Error(
        "'GITHUB_TOKEN' must be set to configure GitHub Discussions",
      );
    }
    if (!config.category_name || !config.errors) {
      throw new Error("Invalid config: missing required fields");
    }
    this.sherrorConfig = config;
    this.project = new Project();
  }

  private prettyJSON(obj: unknown) {
    return JSON.stringify(obj, null, 2);
  }

  /**
   * Synchronize local config errors with GitHub Discussions:
   * - create discussions for new errors
   * - update title/body for existing ones
   */
  private async requestRepositoryInfo(
    owner: string,
    repo: string,
    _category: string,
  ): Promise<{
    repository: {
      id: string;
      discussionCategories: {
        nodes: Array<{
          id: string;
          name: string;
        }>;
      };
    } | null;
  }> {
    interface RepositoryInfoResponse {
      repository: {
        id: string;
        discussionCategories: {
          nodes: Array<{
            id: string;
            name: string;
          }>;
        };
      } | null;
    }

    const response = await this.requestGraphQL<RepositoryInfoResponse>(
      `
      query RepoInfo($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          discussionCategories(first: 10) {
            nodes {
              id
              name
            }
          }
        }
      }
    `,
      { owner, repo },
    );

    return response;
  }

  async writebackConfig(): Promise<void> {
    const cfg = this.sherrorConfig;
    if (!cfg || !cfg.category_name || !cfg.errors) {
      throw new Error(
        "Invalid sherror config: missing category_name or errors",
      );
    }
    // ts-morph
    const sourceFile = this.project.addSourceFileAtPath("sherror.config.ts");
    const exports = sourceFile.getExportedDeclarations();
    let configDecls = exports.get("default");
    if (!configDecls?.length) {
      console.debug("No 'export default' found");
      configDecls = exports.get("config");
    }
    if (!configDecls?.length) {
      throw new Error("No 'export config' found");
    }

    const configDecl = configDecls[0] as VariableDeclaration;
    const initializer = configDecl.getInitializerOrThrow();

    // Handle both direct ObjectLiteral and satisfies Expression
    let configInit;
    if (initializer.getKind() === SyntaxKind.SatisfiesExpression) {
      const satisfiesExpr = initializer.asKindOrThrow(
        SyntaxKind.SatisfiesExpression,
      );
      configInit = satisfiesExpr.getExpression();
    } else {
      configInit = initializer;
    }

    if (!Node.isObjectLiteralExpression(configInit)) {
      throw new Error(
        `Expected config to be an object literal or satisfy an object type.`,
      );
    }

    const errorsProp = configInit.getProperty("errors");
    if (!errorsProp || !Node.isPropertyAssignment(errorsProp)) {
      throw new Error(`Expected config to have a property "errors".`);
    }
    const arrayLiteral = errorsProp.getInitializerIfKindOrThrow(
      SyntaxKind.ArrayLiteralExpression,
    );

    // Clear existing elements
    arrayLiteral.getElements().forEach((element, index) => {
      const error = cfg.errors[index];
      if (error) {
        const objText = `{
  error_code: ${error.error_code},
  app_message: ${this.prettyJSON(error.app_message)},
  post_title: ${this.prettyJSON(error.post_title)},
  post_body: ${this.prettyJSON(error.post_body)}${
          error._discussion_link
            ? `,
  _discussion_link: ${this.prettyJSON(error._discussion_link)}`
            : ""
        }
}`;
        element.replaceWithText(objText);
      }
    });

    // If there are more new errors than existing ones, add them
    if (cfg.errors.length > arrayLiteral.getElements().length) {
      const newElements = cfg.errors.slice(arrayLiteral.getElements().length)
        .map((error) =>
          `{
  error_code: ${error.error_code},
  app_message: ${this.prettyJSON(error.app_message)},
  post_title: ${this.prettyJSON(error.post_title)},
  post_body: ${this.prettyJSON(error.post_body)}${
            error._discussion_link
              ? `,
  _discussion_link: ${this.prettyJSON(error._discussion_link)}`
              : ""
          }
}`
        );

      // Add each new element one by one
      for (const element of newElements) {
        arrayLiteral.addElement(element);
      }
    }

    await this.project.save();
  }

  async sync(): Promise<void> {
    const cfg = this.sherrorConfig;
    if (!cfg || !cfg.category_name || !cfg.errors) {
      throw new Error(
        "Invalid sherror config: missing category_name or errors",
      );
    }
    // determine GitHub repo context from git remote
    const remote = await this.getGitRemoteUrl();
    const { owner, repo } = this.parseGitRemote(remote);

    // fetch repository and discussion category ids
    const { repository } = await this.requestRepositoryInfo(
      owner,
      repo,
      cfg.category_name,
    );

    if (!repository) {
      throw new Error(`Repository ${owner}/${repo} not found`);
    }
    const repoId = repository.id;

    // Find or create the category
    const category = repository.discussionCategories.nodes.find(
      (cat) => cat.name === cfg.category_name,
    );

    let categoryId: string;

    if (!category) {
      // GitHub Discussions categories can't be created programmatically via their API
      // The repository owner needs to create the category manually in the repository settings
      // We'll provide helpful instructions instead of failing
      const availableCategories = repository.discussionCategories.nodes.map(
        (c) => `- ${c.name}`,
      ).join("\n");
      console.log(`
Error: Discussion category "${cfg.category_name}" not found in ${owner}/${repo}.

Available categories:
${availableCategories}

To fix this:
1. Go to your repository settings on GitHub
2. Click on "Options" in the left sidebar
3. Scroll down to the "Features" section
4. Make sure "Discussions" is enabled
5. Click on "Set up discussions" if not already set up
6. Create a new category named "${cfg.category_name}" in the discussions settings
7. Run this command again
`);
      throw new Error(
        `Discussion category "${cfg.category_name}" not found and cannot be created programmatically`,
      );
    } else {
      categoryId = category.id;
      console.log(`Using existing category: ${category.name} (${categoryId})`);
    }

    let updated = false;
    for (let index = 0; index < cfg.errors.length; index++) {
      const err = cfg.errors[index];
      // ensure required fields
      if (
        typeof err.post_title !== "string" || typeof err.post_body !== "string"
      ) {
        throw new Error(
          `Invalid error entry missing post_title or post_body: ${
            this.prettyJSON(err)
          }`,
        );
      }
      if (err._discussion_link) {
        // update existing discussion if changed
        const num = this.parseDiscussionNumber(err._discussion_link);
        const q = await this.requestGraphQL<DiscussionResponse>(
          `
          query GetDiscussion($owner: String!, $repo: String!, $number: Int!) {
            repository(owner: $owner, name: $repo) {
              discussion(number: $number) {
                id
                title
                body
              }
            }
          }
        `,
          { owner, repo, number: num },
        );
        const disc = q.repository?.discussion;
        if (!disc) {
          throw new Error(`Discussion #${num} not found`);
        }
        if (disc.title !== err.post_title || disc.body !== err.post_body) {
          await this.requestGraphQL<
            { updateDiscussion: { discussion: { url: string } } }
          >(
            `
            mutation UpdateDiscussion($id: ID!, $title: String!, $body: String!) {
              updateDiscussion(input: { discussionId: $id, title: $title, body: $body }) {
                discussion { url }
              }
            }
          `,
            { id: disc.id, title: err.post_title, body: err.post_body },
          );
        }
      } else {
        // create new discussion
        const cr = await this.requestGraphQL<CreateDiscussionResponse>(
          `
          mutation CreateDiscussion($repoId: ID!, $catId: ID!, $title: String!, $body: String!) {
            createDiscussion(input: { repositoryId: $repoId, categoryId: $catId, title: $title, body: $body }) {
              discussion { url }
            }
          }
        `,
          {
            repoId,
            catId: categoryId,
            title: err.post_title,
            body: err.post_body,
          },
        );
        const discussionUrl = cr.createDiscussion.discussion.url as string;
        this.sherrorConfig.errors[index]._discussion_link = discussionUrl;
        updated = true;
      }
    }

    if (updated) {
      // Update the config with the new discussion link(s)
      await this.writebackConfig();
    }
  }

  /**
   * Get the current config, including any generated discussion links
   */
  getConfig(): SherrorConfig {
    return { ...this.sherrorConfig };
  }

  private colorize(str: string): string {
    return colorize(str);
  }

  /**
   * Get the Sherror instance for the given error code.
   */
  get(
    code: number,
  ): SherrorError & {
    Codepath: typeof Codepath;
    print: (codepath?: Codepath) => void;
    exit: () => void;
  } {
    const err = this.sherrorConfig.errors.find((e) => e.error_code === code);
    if (!err) throw new Error(`Error code ${code} not found in config`);
    const app_message = this.colorize(err.app_message);

    return {
      ...err,
      app_message,
      Codepath,
      print: (codepath?: Codepath) => {
        const e: SherrorError = { ...err, app_message };
        this.sherrorConfig?.printer?.(e, codepath?.toString());
      },
      exit: () => Deno.exit(code),
    };
  }

  private async requestGraphQL<T = unknown>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `bearer ${this.ghToken}`,
      },
      body: this.prettyJSON({ query, variables }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub GraphQL error ${res.status}: ${text}`);
    }
    const data = await res.json();
    if (data.errors) {
      throw new Error(`GraphQL errors: ${this.prettyJSON(data.errors)}`);
    }
    return data.data;
  }

  private async getGitRemoteUrl(): Promise<string> {
    const cmd = new Deno.Command("git", {
      args: ["config", "--get", "remote.origin.url"],
      stdout: "piped",
    });
    const { stdout } = await cmd.output();
    return new TextDecoder().decode(stdout).trim();
  }

  private parseGitRemote(remote: string): { owner: string; repo: string } {
    // git@github.com:owner/repo.git or https://github.com/owner/repo.git
    let path = "";
    if (remote.startsWith("git@")) {
      const parts = remote.split(":");
      path = parts[1];
    } else if (/^https?:\/\//.test(remote)) {
      const url = new URL(remote);
      path = url.pathname.slice(1);
    } else {
      throw new Error(`Unrecognized git remote URL: ${remote}`);
    }
    path = path.replace(/\.git$/, "");
    const [owner, repo] = path.split("/");
    if (!owner || !repo) throw new Error(`Invalid git remote path: ${path}`);
    return { owner, repo };
  }

  private parseDiscussionNumber(link: string): number {
    try {
      const url = new URL(link);
      const parts = url.pathname.split("/");
      const num = parts.pop() || "";
      return parseInt(num, 10);
    } catch {
      throw new Error(`Invalid discussion link: ${link}`);
    }
  }

  /**
   * Clear all discussions in the configured category.
   * @returns Promise that resolves when all discussions are deleted
   */
  async clear(): Promise<void> {
    const cfg = this.sherrorConfig;
    if (!cfg?.category_name) {
      throw new Error("Invalid config: missing category_name");
    }

    // Get repository info
    const remote = await this.getGitRemoteUrl();
    const { owner, repo } = this.parseGitRemote(remote);
    const { repository } = await this.requestRepositoryInfo(
      owner,
      repo,
      cfg.category_name,
    );

    if (!repository) {
      throw new Error(`Repository ${owner}/${repo} not found`);
    }

    // Find the category
    const category = repository.discussionCategories.nodes.find(
      (cat) => cat.name === cfg.category_name,
    );

    if (!category) {
      console.log(`No discussions found in category "${cfg.category_name}"`);
      return;
    }

    // Get all discussions in the category
    const response = await this.requestGraphQL<{
      repository: {
        discussions: {
          nodes: Array<{ id: string; number: number; title: string }>;
        };
      };
    }>(
      `
      query GetDiscussions($owner: String!, $repo: String!, $categoryId: ID!) {
        repository(owner: $owner, name: $repo) {
          discussions(first: 100, categoryId: $categoryId) {
            nodes {
              id
              number
              title
            }
          }
        }
      }
    `,
      { owner, repo, categoryId: category.id },
    );

    const discussions = response.repository.discussions.nodes;
    if (discussions.length === 0) {
      console.log(`No discussions found in category "${cfg.category_name}"`);
      return;
    }

    console.log(`Found ${discussions.length} discussions to delete...`);

    // Delete each discussion
    for (const discussion of discussions) {
      console.log(
        `Deleting discussion #${discussion.number}: ${discussion.title}`,
      );
      try {
        await this.requestGraphQL(
          `
          mutation DeleteDiscussion($id: ID!) {
            deleteDiscussion(input: { id: $id }) {
              clientMutationId
            }
          }
        `,
          { id: discussion.id },
        );
      } catch (error) {
        console.error(
          `Failed to delete discussion #${discussion.number}:`,
          error,
        );
        throw error;
      }
    }

    console.log(
      `Successfully deleted ${discussions.length} discussions from category "${cfg.category_name}"`,
    );

    // Clear the discussion links from the config
    if (this.sherrorConfig.errors) {
      let updated = false;
      this.sherrorConfig.errors.forEach((error) => {
        if (error._discussion_link) {
          delete error._discussion_link;
          updated = true;
        }
      });

      if (updated) {
        await this.writebackConfig();
      }
    }
  }
}
