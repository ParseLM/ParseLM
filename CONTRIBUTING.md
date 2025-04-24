# Contributing to ParseLM

Thank you for your interest in contributing to ParseLM! This document provides guidance on development, testing, and releasing the package.

## Development Setup

1. Clone the repository
   ```bash
   git clone https://github.com/username/parselm.git
   cd parselm
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Build the package
   ```bash
   npm run build
   ```

4. Run tests
   ```bash
   npm test
   ```

## Development Workflow

- Make your changes in the `src` directory
- Run `npm run format` to format your code
- Run `npm run lint` to check for code style issues
- Run `npm test` to ensure all tests pass

## Publishing to npm

Before publishing, ensure:

1. All tests pass: `npm test`
2. The version is updated in `package.json`
3. All changes are documented in README.md or appropriate documentation

### Publishing Process

1. Prepare the package (clean, build, test):
   ```bash
   npm run prepare-publish
   ```

2. Log in to npm (if not already logged in):
   ```bash
   npm login
   ```

3. Publish the package:
   ```bash
   npm publish
   ```

For beta releases, use:
```bash
npm publish --tag beta
```

## Version Guidelines

- Patch releases (0.0.x): Bug fixes and minor updates that don't change the API
- Minor releases (0.x.0): New features that don't break backward compatibility
- Major releases (x.0.0): Breaking changes to the API

Always update the CHANGELOG.md file with your changes before publishing. 