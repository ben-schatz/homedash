// Prints a PARENT_PIN_HASH line for .env. Usage: npm run hash-pin
const readline = require('node:readline');
const { hashPassword } = require('../src/auth');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('PIN: ', password => {
  rl.close();
  if (password.length < 4) {
    console.error('Use at least 4 characters.');
    process.exit(1);
  }
  console.log(`\nPARENT_PIN_HASH=${hashPassword(password)}`);
});
