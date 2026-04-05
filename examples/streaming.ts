import { ai } from 'aiclientjs';

// Stream tokens as they arrive
const stream = await ai('Write a short poem about TypeScript', {
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk);
}

console.log('\n--- Done ---');

// You can also get the full response after streaming
const stream2 = await ai('Tell me a joke', { stream: true });
const fullResponse = await stream2.response();
console.log(`\nFull text: ${fullResponse.text}`);
console.log(`Tokens: ${fullResponse.usage.totalTokens}`);

// Convert to a Web ReadableStream (useful in server frameworks)
const stream3 = await ai('Hello', { stream: true });
const readable = stream3.toReadableStream();
// Pass `readable` to a Response, e.g.: return new Response(readable);
