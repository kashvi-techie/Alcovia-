# Windows Node v24 ENOENT: node:sea Error Fix

## Problem
On Windows with Node v24, Expo web builds fail with `ENOENT: node:sea` error due to the colon (`:`) character restriction in Windows folder names. The `node:` protocol is used for Node.js built-in modules, but Windows file systems don't allow colons in paths.

## Solution Applied

### 1. Updated `client/package.json`
- Changed `"main"` from `"node_modules/expo/AppEntry.js"` to `"App.tsx"`
- Added `babel-plugin-module-resolver` to devDependencies

### 2. Updated `client/babel.config.js`
- Added module-resolver plugin to redirect `node:sea` imports
- Added ignore pattern for `node:` protocol modules in node_modules

### 3. Created `client/metro.config.js`
- Added custom Metro resolver to block `node:` protocol resolution
- Returns empty module for `node:sea` and other `node:*` imports to prevent ENOENT errors

### 4. Verified `client/.env`
- `EXPO_USE_METRO_WORKSPACE_ROOT=true` ✓
- `REACT_APP_API_URL=http://localhost:3001` ✓

## Installation & Usage

### Step 1: Install Dependencies
```bash
cd client
npm install
```

### Step 2: Single Command to Kill All Node Processes and Start Server

```bash
npm run clean:start
```

Or manually:
```bash
taskkill /F /IM node.exe 2>nul || echo "No node processes" && set EXPO_USE_METRO_WORKSPACE_ROOT=true && npx expo start --web --clear
```

### Alternative Commands

**Clear Metro cache specifically:**
```bash
npm run clear:metro
```

**Start without cache (force rebuild):**
```bash
set EXPO_USE_METRO_WORKSPACE_ROOT=true && npx expo start --web --clear
```

## What These Fixes Do

1. **Babel Configuration**: Intercepts and blocks `node:sea` module resolution at the Babel transpilation level
2. **Metro Configuration**: COMPLETELY DISABLES all `node:` protocol module resolution including `node:sea`
   - Blocks all `node:*` imports at the resolver level
   - Returns empty module for any `node:` protocol requests
   - Logs warnings when blocking modules for debugging
3. **Environment Variables**: 
   - `EXPO_USE_METRO_WORKSPACE_ROOT=true` helps Metro handle monorepo structures correctly
   - `REACT_APP_API_URL` ensures proper API endpoint configuration
4. **Web Compatibility**: Verified no Node.js-specific modules (fs, path, etc.) are used in frontend

## Troubleshooting

If you still encounter issues:

1. **Delete all cache directories:**
   ```bash
   rm -rf client/.expo client/node_modules/.cache
   ```

2. **Reinstall dependencies:**
   ```bash
   cd client
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Start with maximum clearing:**
   ```bash
   npx expo start --web --clear --reset-cache
   ```

## Notes

- These changes are Windows-specific workarounds for Node v24 compatibility
- The fixes don't affect macOS or Linux builds
- The `node:` protocol is used for Node.js built-in modules, but Expo web runs in browser environment where these aren't needed