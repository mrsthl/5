#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cwd = data.cwd || process.cwd();
    const configFile = path.join(cwd, '.5', 'config.json');

    if (fs.existsSync(configFile)) {
      process.exit(0);
    }

    // No config — block with helpful message
    process.stderr.write(
      'Configuration not found. Please run /5:configure first to set up your project.\n\n' +
      'The configure command will:\n' +
      '  - Detect your project type and build commands\n' +
      '  - Set up ticket tracking conventions\n' +
      '  - Write project configuration'
    );
    process.exit(2);
  } catch (e) {
    process.exit(0); // Silent failure — don't block on parse errors
  }
});
