#!/usr/bin/env node

import { executeCli } from '../dist/index.js';

const args = process.argv.slice(2);
const apiUrl = process.env.CLIPSYNC_API_URL || 'http://localhost:4000';

executeCli({ args, apiUrl })
  .then((result) => {
    if (result.output) {
      if (result.exitCode === 0) {
        console.log(result.output);
      } else {
        console.error(result.output);
      }
    }
    process.exit(result.exitCode);
  })
  .catch((err) => {
    console.error('Fatal CLI Error:', err);
    process.exit(1);
  });
