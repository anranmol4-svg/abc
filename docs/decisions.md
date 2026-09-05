# Technical Decisions

## 1. Using Node Portable instead of Global Installation
- **Chose**: Download portable Node.js and run commands with local path.
- **Rejected**: Using winget to install Node.js globally.
- **Why**: Avoids UAC prompts and environment variables not updating within the active agent session.

## 2. Using Yarn over NPM
- **Chose**: Yarn for dependency management.
- **Rejected**: NPM.
- **Why**: NPM v10.5.0 had cache issues (`edgesOut` error) on Node 20.12.2. Yarn provided a stable alternative.

## 3. Ignoring Engine Strictness
- **Chose**: `yarn config set ignore-engines true`.
- **Rejected**: Forcing a Node version update.
- **Why**: Vitest and other latest packages require Node 22, but the portable version is Node 20. Modifying package versions individually would be too time consuming.

*(More decisions will be added as implementation progresses)*
