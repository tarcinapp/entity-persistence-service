/**
 * This loader reads environment variables from a file specified in ENV_FILE
 * and loads them into process.env BEFORE any other modules are loaded.
 * 
 * Usage:
 *   node -r ./load-env.js -e "require('./dist/index')" 
 *   (with ENV_FILE environment variable set)
 */

const fs = require('fs');
const path = require('path');

if (process.env.ENV_FILE) {
  const envFile = process.env.ENV_FILE;
  
  if (!fs.existsSync(envFile)) {
    console.error(`Error: Environment file '${envFile}' not found`);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(envFile, 'utf8');
    const lines = content.split('\n');

    for (const line of lines) {
      // Skip comments and empty lines
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse key=value pairs
      const match = trimmed.match(/^\s*([^=]+?)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        process.env[key] = value;
      }
    }

    console.log(`✓ Loaded environment variables from: ${envFile}`);
  } catch (error) {
    console.error(`Error reading environment file '${envFile}':`, error.message);
    process.exit(1);
  }
}
