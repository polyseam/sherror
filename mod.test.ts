import { assert, assertThrows } from "@std/assert";
import { SherrorClient, type SherrorConfig } from "./mod.ts";

// Mock Deno.env for testing
const originalEnv = { ...Deno.env.toObject() };
function resetEnv() {
  for (const key of Object.keys(Deno.env.toObject())) {
    if (!(key in originalEnv)) {
      Deno.env.delete(key);
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    Deno.env.set(key, value);
  }
}

// Test data
const TEST_CONFIG: SherrorConfig = {
  category_name: "Test Category",
  errors: [
    {
      error_code: 1001,
      app_message: "Test error occurred",
      post_title: "Test Error 1001",
      post_body: "This is a test error",
      _discussion_link: undefined,
    },
  ],
};

Deno.test({
  name: "SherrorClient initialization",
  fn() {
    // Test missing GITHUB_TOKEN
    const originalToken = Deno.env.get("GITHUB_TOKEN");
    try {
      // Test invalid config
      Deno.env.set("GITHUB_TOKEN", "test-token-123");
      assertThrows(
        () => new SherrorClient({} as SherrorConfig),
        Error,
        "Invalid config: missing required fields",
      );

      // Test valid initialization
      const client = new SherrorClient(TEST_CONFIG);
      assert(client instanceof SherrorClient);
    } finally {
      // Restore original token
      if (originalToken) {
        Deno.env.set("GITHUB_TOKEN", originalToken);
      } else {
        Deno.env.delete("GITHUB_TOKEN");
      }
    }
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

// Clean up after all tests
Deno.test({
  name: "cleanup",
  fn() {
    resetEnv();
  },
  sanitizeResources: true,
  sanitizeOps: true,
});
