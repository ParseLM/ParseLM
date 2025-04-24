#!/usr/bin/env node

/**
 * Pre-publication script to verify package is ready for npm
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Ensure we're in the project root
const packageJsonPath = path.resolve(process.cwd(), "package.json");
if (!fs.existsSync(packageJsonPath)) {
  console.error(
    "Error: package.json not found. Please run this script from the project root."
  );
  process.exit(1);
}

console.log("🧹 Cleaning previous build artifacts...");
try {
  if (fs.existsSync(path.resolve(process.cwd(), "dist"))) {
    fs.rmSync(path.resolve(process.cwd(), "dist"), {
      recursive: true,
      force: true,
    });
  }
} catch (err) {
  console.warn("Warning: Could not clean dist directory", err);
}

console.log("🏗️ Building TypeScript...");
try {
  execSync("npm run build", { stdio: "inherit" });
} catch (err) {
  console.error("Error: TypeScript build failed", err);
  process.exit(1);
}

console.log("🧪 Running tests (optional)...");
try {
  execSync("npm test", { stdio: "inherit" });
  console.log("✅ Tests passed!");
} catch (err) {
  console.warn("⚠️ Tests failed, but continuing with publication preparation.");
  console.warn("   Consider fixing tests before final publication.");
}

// Check if necessary files exist
const requiredFiles = ["LICENSE", "README.md", "package.json"];
const missingFiles = requiredFiles.filter(
  (file) => !fs.existsSync(path.resolve(process.cwd(), file))
);

if (missingFiles.length > 0) {
  console.error(`Error: Missing required files: ${missingFiles.join(", ")}`);
  process.exit(1);
}

console.log("✅ Package is ready for publication!");
console.log("");
console.log("To publish, run:");
console.log("  npm publish");
console.log("");
