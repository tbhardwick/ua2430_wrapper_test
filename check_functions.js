#!/usr/bin/env node

const path = require('path');
const ua2430 = require(path.join(__dirname, 'build', 'Release', 'ua2430'));

console.log("\nAvailable functions in the ua2430 module:");

// Get all available function names
const functionNames = Object.keys(ua2430).filter(name => 
  typeof ua2430[name] === 'function'
);

functionNames.sort().forEach(name => {
  console.log(`- ${name}`);
});

console.log('\nTotal functions available:', functionNames.length); 