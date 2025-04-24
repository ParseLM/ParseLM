import { describe, test } from "node:test";
import assert from "node:assert";
import { parseJsonSubstring, structured } from "./model";
import { Schema } from "jsonschema";

describe("structured", () => {
  test("Retries on error", async () => {
    // Mock provider that fails first time, succeeds second time
    let attempts = 0;
    const mockProvider = async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error("Simulated failure");
      }
      return '{"result": "success"}';
    };

    const schema: Schema = {
      type: "object",
      properties: {
        result: { type: "string" },
      },
    };

    const result = await structured({
      input: "test input",
      schema,
      provider: mockProvider,
      retryCount: 1,
    });

    assert.strictEqual(attempts, 2);
    assert.deepStrictEqual(result.structured, { result: "success" });
    assert.strictEqual(result.attempts, 2);
  });
});

describe("parseJsonSubstring", () => {
  test("Extracts JSON from a code block", () => {
    const input = 'Here is JSON:\n```json\n{\n"character": "Shrek"\n}\n```';
    assert.deepStrictEqual(parseJsonSubstring(input).structured, {
      character: "Shrek",
    });
  });

  test("Extracts JSON from plain text", () => {
    const input = '\n{\n"character": "Shrek"\n}\n';
    assert.deepStrictEqual(parseJsonSubstring(input).structured, {
      character: "Shrek",
    });
  });

  test("Chooses last JSON object when multiple exist", () => {
    const input = `
    {
      "character": "Shrek"
    }

    {
      "character": "Donkey"
    }`;
    assert.deepStrictEqual(parseJsonSubstring(input).structured, {
      character: "Donkey",
    });
  });

  test("Extracts JSON from last valid code block", () => {
    const input = `
    Here is the first JSON:
    \`\`\`json
    { "character": "Shrek" }
    \`\`\`

    And here is the second one:
    \`\`\`json
    { "character": "Donkey" }
    \`\`\``;
    assert.deepStrictEqual(parseJsonSubstring(input).structured, {
      character: "Donkey",
    });
  });

  test("Handles JSON with nested objects", () => {
    const input = `
    \`\`\`json
    {
      "character": "Shrek",
      "details": {
        "age": 30,
        "species": "ogre"
      }
    }
    \`\`\``;
    assert.deepStrictEqual(parseJsonSubstring(input).structured, {
      character: "Shrek",
      details: {
        age: 30,
        species: "ogre",
      },
    });
  });

  test("Handles text before and after JSON", () => {
    const input =
      'Some text before\n{\n"character": "Shrek"\n}\nSome text after';
    assert.deepStrictEqual(parseJsonSubstring(input).structured, {
      character: "Shrek",
    });
  });

  test("Handles JSON with spaces and newlines", () => {
    const input = '  \n  {  \n  "character"  :  "Shrek"  \n  }  \n  ';
    assert.deepStrictEqual(parseJsonSubstring(input).structured, {
      character: "Shrek",
    });
  });

  test("Ignores invalid/malformed JSON", () => {
    const input = "Here is a malformed JSON: ```json { character: Shrek } ```";
    assert.strictEqual(parseJsonSubstring(input).structured, null);
  });

  test("Returns null when no JSON is found", () => {
    const input = "This is just some text with no JSON.";
    assert.strictEqual(parseJsonSubstring(input).structured, null);
  });

  test("Returns null for empty input", () => {
    const input = "";
    assert.strictEqual(parseJsonSubstring(input).structured, null);
  });
});
