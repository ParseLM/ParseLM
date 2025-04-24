# ParseLM

> **ParseLM: Reliably Structure LLM Outputs for Data and Control Flow.**

ParseLM is a lightweight TypeScript library designed to streamline interactions with Large Language Models (LLMs). It enables you to reliably extract structured data, perform classifications, and conditionally execute code based on text content, all in a type-safe manner using familiar schema definitions.

## Features

*   **Structured Data Extraction:** Define your desired data structure using schemas and let ParseLM handle the LLM interaction to extract matching, validated data.
*   **Provider Agnostic:** Configure ParseLM with different LLM providers (e.g., OpenAI, Google Gemini, Anthropic) through a simple `ProviderConfig` interface.
*   **Type Safety:** Ensures the extracted data conforms to your expected types at runtime and compile time.
*   **Built-in Retries:** Handles transient LLM API errors with configurable retry logic and exponential backoff.
*   **Utility Methods:** Provides convenient helpers for common tasks like boolean checks, single classifications (`oneOf`), list generation (`toList`, `toListOf`), and conditional function execution based on classification (`switch`).

## Installation

```bash
# Using npm
npm install parselm

# Using yarn
yarn add parselm
```

## Basic Usage

The core idea is to provide text context, define a schema for the desired output using a library like Zod, and let ParseLM orchestrate the LLM call and validation.

```typescript
import { ParseLM, createOpenAICompatibleProvider } from "parselm";
import { z } from "zod";

const parselm = new ParseLM({
  provider: createOpenAICompatibleProvider("gemini-2.0-flash", "https://generativelanguage.googleapis.com/v1beta", process.env.API_KEY),
});

const context = "User: John Doe, Age: 30, Email: john.doe@example.com";

// Define the schema for the data you want
const userSchema = z.object({
  name: z.string().describe("User's full name"),
  age: z.number().int().positive().describe("User's age"),
  email: z.string().email().describe("User's email address"),
});

// Extract the structured data
async function getUserData() {
  try {
    // 1. Provide context
    // 2. Define schema
    // 3. Get value
    const userData = await parselm
      .context(context)
      .schema(userSchema)
      .value(); // Throws on error

    console.log("Extracted User Data:", userData);
    // Expected Output (example):
    // Extracted User Data: { name: 'John Doe', age: 30, email: 'john.doe@example.com' }
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

getUserData();
```

## Advanced Usage

### Error Handling with safeValue()

For cases where you want to handle extraction failures gracefully without try/catch blocks:

```typescript
async function getSafeUserData() {
  // Returns { success: true, value: ... } or { success: false, error: ..., value: null }
  const result = await parselm
    .context(context)
    .schema(userSchema)
    .safeValue();

  if (result.success) {
    console.log("Safely Extracted:", result.value);
    return result.value;
  } else {
    console.error("Extraction failed:", result.error);
    return null;
  }
}
```

### Configuring Retries

Configure automatic retries for handling transient LLM API errors:

```typescript
const parselm = new ParseLM({
  provider: createOpenAICompatibleProvider("gemini-2.0-flash", "https://generativelanguage.googleapis.com/v1beta", process.env.API_KEY),
  retryCount: 3, // Retry up to 3 times after initial attempt
  backoffFactor: 2, // Exponential backoff, doubling delay between retries
});
```

## API

### `new ParseLM(config: ParseLMConfig)`

Creates a new ParseLM instance.

**Config:**

*   `provider`: `ProviderConfig` - An object conforming to the provider interface, handling the actual LLM API calls.
*   `retryCount?`: `number` (Default: `0`) - The number of times to retry the LLM call if it fails, *after* the initial attempt.
*   `backoffFactor?`: `number` (Default: `2`) - The factor by which the delay increases between retries (exponential backoff).

### `parselm.context(context: string)`

Sets the text context for subsequent operations. Returns an object with a `schema` method.

### `context(...).schema<T>(schema: z.ZodSchema<T>)`

Defines the Zod schema for the data to be extracted from the `context`. Returns an object with methods to retrieve the value.

*   **`.value(): Promise<T>`**: Executes the LLM call (if not already done) and returns the parsed, validated data according to the schema. Throws an error if parsing, validation, or the LLM call fails.
*   **`.safeValue(): Promise<{ success: true; value: T } | { success: false; error: string; value: null }>`**: Executes the LLM call and returns a result object indicating success or failure, avoiding thrown exceptions.
*   **`.raw(): Promise<{ structured: T | null, raw: string, cost?: number | null }>`**: Executes the LLM call and returns an object containing the parsed data (or null on failure), the raw text response from the LLM, and potentially the cost estimation if provided by the model.

### Utility Methods

These are shortcuts built on top of the core `context().schema()` flow.

*   **`parselm.isTrue(context: string): Promise<boolean>`**: Determines if the `context` represents a logically true statement. Useful for simple yes/no checks.
    ```typescript
    const text = "The system status is green and operational.";
    const isOperational = await parselm.isTrue(text);
    console.log(`System operational: ${isOperational}`); // Likely true
    ```

*   **`parselm.oneOf(context: string, strings: string[]): Promise<string>`**: Classifies the `context` into exactly one of the provided `strings`. Throws an error if the LLM's classification doesn't match one of the options.
    ```typescript
    const inputText = "This feedback is highly positive and encouraging!";
    const sentiment = await parselm.oneOf(inputText, ["positive", "negative", "neutral"]);
    console.log(`Detected sentiment: ${sentiment}`); // Likely "positive"
    ```

*   **`parselm.toList(context: string): Promise<string[]>`**: Extracts a list of strings from the `context`.
    ```typescript
    const listText = "Items needed: apples, bananas, oranges.";
    const items = await parselm.toList(listText);
    console.log("Shopping list:", items); // Likely ["apples", "bananas", "oranges"]
    ```

*   **`parselm.toListOf<T>(context: string, itemSchema: z.ZodSchema<T>): Promise<T[]>`**: Extracts a list where each item conforms to the provided Zod `itemSchema`.
    ```typescript
    const taskSchema = z.object({ description: z.string(), priority: z.number() });
    const tasksText = "Task 1: Write report (Priority 1). Task 2: Schedule meeting (Priority 3).";
    const tasks = await parselm.toListOf(tasksText, taskSchema);
    console.log("Parsed tasks:", tasks);
    // Likely:
    // [
    //   { description: 'Write report', priority: 1 },
    //   { description: 'Schedule meeting', priority: 3 }
    // ]
    ```

*   **`parselm.switch(context: string, fns: Record<string, Function>): Promise<any>`**: Classifies the `context` based on the keys (names) provided in the `fns` object map. It then executes the function associated with the chosen key, passing the original `context` to that function. Returns the result of the executed function.
    ```typescript
    async function handleBug(ctx: string) {
      console.log("Handling bug report:", ctx);
      // ... logic to file bug ticket
      return { status: "Bug Filed" };
    }

    async function handleFeature(ctx: string) {
      console.log("Handling feature request:", ctx);
      // ... logic to add to backlog
      return { status: "Feature Added to Backlog" };
    }

    async function handleQuestion(ctx: string) {
        console.log("Handling question:", ctx);
        // ... logic to route to support
        return { status: "Question Routed" };
    }

    const ticketText = "The login button isn't working on the staging server.";

    const result = await parselm.switch(ticketText, {
      reportBug: () => handleBug(ticketText),
      requestFeature: () => handleFeature(ticketText),
      askQuestion: () => handleQuestion(ticketText),
    });

    console.log("Switch result:", result);
    // Likely Output:
    // Handling bug report: The login button isn't working on the staging server.
    // Switch result: { status: 'Bug Filed' }
    ```