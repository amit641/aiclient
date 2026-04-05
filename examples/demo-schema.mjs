import { ai } from '../dist/index.js';

const res = await ai('List 3 programming languages', {
  schema: {
    type: 'object',
    properties: { languages: { type: 'array', items: { type: 'string' } } },
  },
});
console.log(res.data);
