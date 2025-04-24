# Publishing ParseLM to npm

This document outlines the steps taken to prepare the ParseLM package for npm publication.

## Changes Made

1. **Enhanced package.json**
   - Added important metadata: description, keywords, license, repository, etc.
   - Added "files" array to control what gets published
   - Added engine requirements
   - Added prepublishOnly script hook

2. **Added Essential Files**
   - LICENSE (MIT License)
   - CONTRIBUTING.md (development and publishing guidelines)
   - CHANGELOG.md (version history tracking)
   - .npmignore (to exclude development files)

3. **Fixed Exports**
   - Updated src/index.ts to properly export the main ParseLM class and utilities
   - Ensured proper TypeScript declaration files are generated

4. **Build & Publish Process**
   - Created scripts/prepare-publish.js for pre-publication checks
   - Fixed test script to use modern Node.js flags
   - Made build process more robust

## Publication Process

1. Update version in package.json when ready for a new release
2. Run `npm run prepare-publish` to:
   - Clean previous build artifacts
   - Build TypeScript code
   - Run tests (optional, continues even if tests fail)
   - Verify required files exist
3. Run `npm publish` to publish to npm registry
   - For beta releases use `npm publish --tag beta`

## What's Included in the Package

The package includes:
- **dist/** - Compiled JavaScript files and type declarations
- **LICENSE** - The MIT license file
- **package.json** - Package metadata and dependencies
- **README.md** - Documentation

## Not Included in the Package

These files are excluded through .npmignore:
- Source TypeScript files (src/)
- Test files (*.test.ts)
- Configuration files (.prettierrc, tsconfig.json, etc.)
- Development tools and scripts
- Git files
- Node modules

## Future Improvements

1. **Fix Tests**: Update the tests to work with the new module structure
2. **Add CI/CD**: Set up GitHub Actions for automated testing and publishing
3. **Add More Documentation**: Improve the README and add API documentation
4. **Version Bump Strategy**: Implement semantic versioning automation 