import fs from 'fs';

const content = fs.readFileSync('./dist/assets/index-DqtzJvdx.js', 'utf8');

console.log('File size:', content.length);
console.log('Contains turnstile script:', content.includes('challenges.cloudflare.com'));
console.log('Contains placeholder sitekey:', content.includes('1x00000000000000000000AA'));
console.log('Contains Turnstile.tsx text:', content.includes('onloadTurnstileCallback'));
