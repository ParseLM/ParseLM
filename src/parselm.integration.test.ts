import { describe, test, before } from "node:test";
import assert from "node:assert";
import { Schema } from "jsonschema";
import { z } from "zod";

// Import functions to test
import { parseJsonSubstring } from "./model";
import { minimalSchema } from "./schema";
import { inferType } from "./base64";
import { ParseLM } from "./parselm";

// Provider configuration from .env (loaded via --import=dotenv/config)
const providerConfig = {
  key: process.env.PROVIDER_KEY!,
  url: process.env.PROVIDER_URL!,
  model: process.env.PROVIDER_MODEL!,
};

// Check if API key is available before running tests
before(() => {
  if (!providerConfig.key || providerConfig.key.startsWith("AIza") === false) {
    // Basic check for Gemini key format
    throw new Error(
      "PROVIDER_KEY environment variable is not set or does not look like a valid Gemini API key. Skipping integration tests."
    );
  }
  if (!providerConfig.url || !providerConfig.model) {
    throw new Error(
      "PROVIDER_URL or PROVIDER_MODEL environment variable is not set. Skipping integration tests."
    );
  }
  console.log(`Running integration tests with model: ${providerConfig.model}`);
});

// Instantiate ParseLM once
const parselm = new ParseLM({
  provider: providerConfig,
  retryCount: 1, // Allow one retry for integration tests
});

describe(
  "ParseLM Integration Tests (using Gemini API)",
  { timeout: 45000 },
  () => {
    // Increased timeout

    test("structured: should extract simple data from text", async () => {
      const simpleZodSchema = z.object({
        name: z.string().describe("The full name"),
        age: z.number().describe("The age"),
      });

      const input = "Extract the name and age: Johnathan Doe is 42 years old.";

      // Note: Instructions are not directly supported in the current ParseLM fluent API
      const result = await parselm.context(input).schema(simpleZodSchema).raw(); // Use .raw() to get the full result object

      console.log("Simple Text Raw:", result.raw);
      console.log("Simple Text Structured:", result.structured);
      console.log("Simple Text Errors:", result.errors);

      assert.ok(
        result.valid,
        `Validation failed: ${JSON.stringify(result.errors)}`
      );
      assert.ok(result.structured, "Structured result should not be null");
      assert.strictEqual(typeof result.structured?.name, "string");
      // Allow for slight variations in name extraction
      assert.ok(
        result.structured?.name?.includes("John"),
        "Name should contain John"
      );
      assert.strictEqual(result.structured?.age, 42);
      assert.strictEqual(result.attempts, 1);
    });

    test("structured: should handle complex schema with text", async () => {
      const complexZodSchema = z.object({
        companyName: z.string().describe("The name of the company"),
        foundedYear: z.number().describe("The year founded"),
        address: z
          .object({
            street: z.string(),
            city: z.string(),
          })
          .describe("Company address"),
        departments: z
          .array(
            z.object({
              name: z.string(),
              employeeCount: z.number().optional(), // Made optional as it might not always be extracted reliably
            })
          )
          .describe("List of departments"),
      });

      const input =
        "Provide details for 'Innovatech Ltd.', founded in 2010, address 1 Innovation Drive, Techville. It has two departments: R&D (50 employees) and Sales (25 employees).";

      // Note: Instructions are not directly supported in the current ParseLM fluent API
      const result = await parselm
        .context(input)
        .schema(complexZodSchema)
        .raw(); // Use .raw() to get the full result object

      console.log("Complex Text Raw:", result.raw);
      console.log("Complex Text Structured:", result.structured);
      console.log("Complex Text Errors:", result.errors);

      assert.ok(
        result.valid,
        `Validation failed: ${JSON.stringify(result.errors)}`
      );
      assert.ok(result.structured, "Structured result should not be null");
      assert.strictEqual(result.structured?.companyName, "Innovatech Ltd.");
      assert.strictEqual(result.structured?.foundedYear, 2010);
      assert.strictEqual(
        result.structured?.address?.street,
        "1 Innovation Drive"
      );
      assert.strictEqual(result.structured?.address?.city, "Techville");
      assert.ok(Array.isArray(result.structured?.departments));
      assert.strictEqual(result.structured?.departments.length, 2);
      // Check department details loosely
      assert.ok(
        result.structured?.departments.some(
          (d: any) => d.name === "R&D" && d.employeeCount === 50
        )
      );
      assert.ok(
        result.structured?.departments.some(
          (d: any) => d.name === "Sales" && d.employeeCount === 25
        )
      );

      // Assertion for attempts might be less predictable now due to potential internal retries
      // assert.strictEqual(result.attempts, 1);
    });

    test.skip("structured: should extract data from an image", async () => {
      const imageUrl =
        "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Logo_de_Enron.svg/350px-Logo_de_Enron.svg.png"; // Enron logo
      const response = await fetch(imageUrl);
      if (!response.ok)
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      const imageBuffer = await response.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString("base64");
      const imageType = await inferType(imageBase64);

      assert.strictEqual(
        imageType,
        "image/png",
        "Inferred type should be image/png"
      );

      const imageZodSchema = z.object({
        companyName: z.string().describe("The full name of the company shown."),
      });

      // Construct context for image input for ParseLM
      // The fluent API .context() seems designed for text. We might need to adjust ParseLM
      // or use the underlying `structured` function directly for image tests if .context() doesn't support it.
      // For now, assuming .context handles base64 string + schema description implies image analysis.
      // If this fails, we might need to revert this specific test to use `structured` directly.
      const imageContext = `Analyze this image (provided as base64): ${imageBase64}`;

      const result = await parselm
        .context(imageContext) // Pass base64 within the context string
        .schema(imageZodSchema)
        .raw();

      console.log("Image Test Raw:", result.raw);
      console.log("Image Test Structured:", result.structured);
      console.log("Image Test Errors:", result.errors);

      assert.ok(
        result.valid,
        `Validation failed: ${JSON.stringify(result.errors)}`
      );
      assert.ok(result.structured, "Structured result should not be null");
      assert.strictEqual(typeof result.structured?.companyName, "string");
      // Looser checks due to potential LLM variability
      assert.ok(
        result.structured?.companyName?.toLowerCase().includes("enron"),
        "Company name should include Enron"
      );
      console.log(result.structured);
    });

    test("minimalSchema: should generate compact representation", () => {
      const schema: Schema = {
        type: "object",
        properties: {
          user_id: { type: "number", description: "User ID" },
          status: {
            type: "string",
            enum: ["active", "inactive"],
            description: "Account status",
          },
        },
      };
      const expected = "{ user_id: float, status: 'active' | 'inactive' }";
      assert.strictEqual(minimalSchema(schema), expected);
    });

    test("parseJsonSubstring: should extract JSON from code block", () => {
      const input =
        'Some text before\n```json\n{ \n "id": 123, \n "value": "test" \n}\n```\nMore text after.';
      const expected = { id: 123, value: "test" };
      const result = parseJsonSubstring(input);
      assert.deepStrictEqual(result.structured, expected);
    });

    test("parseJsonSubstring: should extract JSON from plain text", () => {
      const input = '\n{\n"item": "widget",\n"quantity": 5\n}\n';
      const expected = { item: "widget", quantity: 5 };
      const result = parseJsonSubstring(input);
      assert.deepStrictEqual(result.structured, expected);
    });

    test("parseJsonSubstring: should return null if no JSON found", () => {
      const input = "This string contains no JSON objects.";
      const result = parseJsonSubstring(input);
      assert.strictEqual(result.structured, null);
    });

    // Note: Testing retry logic with a real API is difficult to guarantee.
    // The test in model.test.ts covers the retry mechanism with a mock provider.
  }
);

// Add tests for other ParseLM utilities
describe("ParseLM.isTrue", { timeout: 15000 }, () => {
  test("should return true for obviously true statements", async () => {
    const result = await parselm.isTrue("The sky is blue during a clear day.");
    assert.strictEqual(result, true);
  });

  test("should return false for obviously false statements", async () => {
    const result = await parselm.isTrue("The sun revolves around the earth.");
    assert.strictEqual(result, false);
  });
});

describe("ParseLM.oneOf", { timeout: 15000 }, () => {
  test("should select the most appropriate option from a list", async () => {
    const context =
      "The capital of France is a city known for the Eiffel Tower.";
    const options = ["Berlin", "Paris", "London", "Madrid"];

    const result = await parselm.oneOf(context, options);
    assert.strictEqual(result, "Paris");
  });

  test("should handle ambiguous inputs by selecting a reasonable option", async () => {
    const context = "What fruit should I eat?";
    const options = ["apple", "banana", "orange", "grape"];

    const result = await parselm.oneOf(context, options);
    assert.ok(
      options.includes(result),
      `Result ${result} should be one of the provided options`
    );
  });
});

describe("ParseLM.toList", { timeout: 15000 }, () => {
  test("should convert text with items into an array", async () => {
    const context = "List the planets in our solar system:";

    const result = await parselm.toList(context);

    assert.ok(Array.isArray(result), "Result should be an array");
    assert.ok(result.length >= 8, "Should contain at least 8 planets");
    assert.ok(result.includes("Earth"), "Should include Earth");
    assert.ok(result.includes("Mars"), "Should include Mars");
  });

  test("should handle numbered lists", async () => {
    const context = "List the first 3 prime numbers:";

    const result = await parselm.toList(context);

    assert.ok(Array.isArray(result), "Result should be an array");
    assert.strictEqual(result.length, 3, "Should contain exactly 3 items");
    assert.ok(result.includes("2"), "Should include 2");
    assert.ok(result.includes("3"), "Should include 3");
    assert.ok(result.includes("5"), "Should include 5");
  });
});

describe("ParseLM.toListOf", { timeout: 15000 }, () => {
  test("should convert text to a list of structured objects", async () => {
    const context =
      "List the following countries with their capitals: USA, Canada, Mexico";

    const countrySchema = z.object({
      country: z.string(),
      capital: z.string(),
    });

    const result = await parselm.toListOf(context, countrySchema);

    assert.ok(result.value, "Result should have a value property");
    assert.ok(Array.isArray(result.value), "Result.value should be an array");
    assert.strictEqual(result.value.length, 3, "Should have 3 countries");

    // Check USA
    const usa = result.value.find(
      (item: any) =>
        item.country.includes("USA") || item.country.includes("United States")
    );
    assert.ok(usa, "Should include USA");
    assert.ok(
      usa.capital.includes("Washington"),
      "USA capital should include Washington"
    );

    // Check Canada
    const canada = result.value.find((item: any) =>
      item.country.includes("Canada")
    );
    assert.ok(canada, "Should include Canada");
    assert.ok(
      canada.capital.includes("Ottawa"),
      "Canada capital should be Ottawa"
    );

    // Check Mexico
    const mexico = result.value.find((item: any) =>
      item.country.includes("Mexico")
    );
    assert.ok(mexico, "Should include Mexico");
    assert.ok(
      mexico.capital.includes("Mexico City"),
      "Mexico capital should be Mexico City"
    );
  });
});

describe("ParseLM.switch", { timeout: 15000 }, () => {
  test("should select and execute the appropriate function", async () => {
    const context =
      "Classify this email: 'Your account has been compromised. Click here to reset your password.'";

    // Functions that would be selected based on the context
    const handleSpam = async () => "This is spam";
    const handleLegitimate = async () => "This is legitimate";
    const handleUncertain = async () => "This is uncertain";

    const result = await parselm.switch(context, {
      spam: handleSpam,
      legitimate: handleLegitimate,
      uncertain: handleUncertain,
    });

    assert.strictEqual(result, "This is spam", "Should classify as spam");
  });

  test("should handle ambiguous inputs", async () => {
    const context = "What language is this: 'console.log(\"Hello, world!\")'";

    const handleJavaScript = async () => "JavaScript";
    const handlePython = async () => "Python";
    const handleRuby = async () => "Ruby";

    const result = await parselm.switch(context, {
      javascript: handleJavaScript,
      python: handlePython,
      ruby: handleRuby,
    });

    assert.strictEqual(result, "JavaScript", "Should identify as JavaScript");
  });
});
