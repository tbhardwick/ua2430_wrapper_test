#!/usr/bin/env node

/**
 * UA2430 Function Checker
 * ----------------------
 * 
 * Purpose:
 * This utility script lists all available functions in the UA2430 wrapper module.
 * It's useful for quickly checking what functions are exposed by the SWIG-generated wrapper.
 * 
 * Usage:
 * node check_functions.js
 * 
 * Expected Output:
 * A sorted list of all available function names in the UA2430 module and the total count.
 */

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