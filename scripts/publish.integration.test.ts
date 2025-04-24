#!/usr/bin/env node

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Get package name and version from package.json
const packageJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
);
const packageName = packageJson.name;
const packageVersion = packageJson.version;

console.log(`Testing published package: ${packageName}@${packageVersion}`);

// Create temporary directory
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "parselm-test-"));
console.log(`Created temporary directory: ${tmpDir}`);

try {
  // Copy .env file to the temp directory
  console.log("Copying .env file to temp directory...");
  const envFilePath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envFilePath)) {
    fs.copyFileSync(envFilePath, path.join(tmpDir, ".env"));
  } else {
    console.warn("Warning: .env file not found in project root");
  }

  // Initialize a new npm project in the temp directory
  console.log("Initializing npm project...");
  execSync("npm init -y", { cwd: tmpDir, stdio: "inherit" });

  // Install typescript and ts-node
  console.log("Installing typescript dependencies...");
  execSync("npm install --save-dev typescript ts-node @types/node dotenv", {
    cwd: tmpDir,
    stdio: "inherit",
  });

  // Install the published package
  console.log(`Installing ${packageName}@${packageVersion}...`);
  execSync(`npm install ${packageName}@${packageVersion}`, {
    cwd: tmpDir,
    stdio: "inherit",
  });

  // Install required peer dependencies
  console.log("Installing peer dependencies...");
  execSync("npm install zod @google/generative-ai openai @anthropic-ai/sdk", {
    cwd: tmpDir,
    stdio: "inherit",
  });

  // Create a simple test file
  const testFile = path.join(tmpDir, "test.ts");
  console.log(`Creating test file: ${testFile}`);

  fs.writeFileSync(
    testFile,
    `
import { ParseLM, createOpenAICompatibleProvider } from '${packageName}';
import { z } from 'zod';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runTest() {
  // Verify environment variables
  if (!process.env.PROVIDER_KEY || !process.env.PROVIDER_URL || !process.env.PROVIDER_MODEL) {
    console.error("TEST_ERROR: Missing required environment variables PROVIDER_KEY, PROVIDER_URL, or PROVIDER_MODEL");
    return false;
  }

  // Create provider with environment variables
  const provider = createOpenAICompatibleProvider(
    process.env.PROVIDER_MODEL,
    process.env.PROVIDER_URL,
    process.env.PROVIDER_KEY
  );

  const parselm = new ParseLM({
    provider,
    retryCount: 1
  });

  const schema = z.object({
    name: z.string().describe('The person\\'s name'),
    age: z.number().describe('The person\\'s age')
  });

  try {
    const result = await parselm
      .context('Extract information about John Doe who is 30 years old')
      .schema(schema)
      .value();

    console.log('TEST_RESULT: ' + JSON.stringify(result));
    
    // Validate result has expected structure
    if (typeof result === 'object' && 
        result !== null && 
        'name' in result && 
        'age' in result &&
        typeof result.name === 'string' &&
        typeof result.age === 'number') {
      console.log('TEST_SUCCESS: Package is working correctly');
      return true;
    } else {
      console.log('TEST_FAILURE: Unexpected result format');
      return false;
    }
  } catch (error) {
    console.error('TEST_ERROR:', error);
    return false;
  }
}

runTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Uncaught error:', error);
    process.exit(1);
  });
`
  );

  // Create tsconfig.json
  const tsconfigFile = path.join(tmpDir, "tsconfig.json");
  console.log(`Creating tsconfig.json: ${tsconfigFile}`);
  fs.writeFileSync(
    tsconfigFile,
    `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true
  }
}`
  );

  // Run the test
  console.log("Running test...");
  const output = execSync("npx ts-node test.ts", { cwd: tmpDir }).toString();

  console.log("\nTest output:");
  console.log(output);

  // Check for success
  if (output.includes("TEST_SUCCESS")) {
    console.log("\nPublished package test: PASSED");
  } else {
    console.error("\nPublished package test: FAILED");
    process.exit(1);
  }
} catch (error) {
  console.error("Error during test:", error);
  process.exit(1);
} finally {
  // Clean up temporary directory
  console.log(`\nCleaning up temporary directory: ${tmpDir}`);
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log("Test completed successfully");
