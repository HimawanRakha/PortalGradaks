require('dotenv').config();
const Module = require('module');

// Intercept 'server-only' imports to prevent the Next.js/React environment check from throwing an error
const originalLoad = Module._load;
Module._load = function (request: string, parent: any, isMain: boolean) {
  if (request === 'server-only') {
    return {};
  }
  return originalLoad.apply(this, arguments);
};

// Now dynamically load the seed script after the interceptor and dotenv are registered
require('./seed');
