import { ai } from 'aiclient';

// ---- With JSON Schema ----

const result = await ai<{ colors: string[] }>('List 5 colors', {
  schema: {
    type: 'object',
    properties: {
      colors: { type: 'array', items: { type: 'string' } },
    },
    required: ['colors'],
  },
  schemaName: 'color_list',
});

console.log(result.data.colors); // ['red', 'blue', 'green', 'yellow', 'purple']

// ---- With Zod (if you have zod installed) ----

// import { z } from 'zod';
//
// const result = await ai('List 5 colors', {
//   schema: z.object({
//     colors: z.array(z.string()),
//   }),
// });
//
// console.log(result.data.colors);  // fully typed!
