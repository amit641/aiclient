import { ai } from '../dist/index.js';

const stream = await ai('Write a haiku about TypeScript', { stream: true });
for await (const chunk of stream) process.stdout.write(chunk);
console.log();
