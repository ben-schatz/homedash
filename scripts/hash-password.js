// Prints a PARENT_PASSWORD_HASH line for .env. Usage: npm run hash-password
const readline = require('node:readline');
const { hashPassword } = require('../src/auth');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Parent password: ', password => {
  rl.close();
  if (password.length < 8) {
    console.error('Use at least 8 characters.');
    process.exit(1);
  }
  console.log(`\nPARENT_PASSWORD_HASH=${hashPassword(password)}`);
});
