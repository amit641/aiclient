import { ai } from '../dist/index.js';

const res = await ai('Explain quantum computing in one sentence');
console.log(res.text);
console.log('Tokens:', res.usage.totalTokens);
