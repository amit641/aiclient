import { createAIClient } from 'aiclientjs';

// Create preconfigured clients for different use cases
const gpt = createAIClient({
  provider: 'openai',
  model: 'gpt-4o',
  system: 'You are a helpful assistant. Be concise.',
  temperature: 0.7,
});

const claude = createAIClient({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  system: 'You are a creative writing assistant.',
  maxTokens: 2048,
});

const local = createAIClient({
  provider: 'ollama',
  model: 'llama3.1',
  baseURL: 'http://localhost:11434',
});

// Use them without repeating config
const answer = await gpt('What is 2+2?');
console.log(answer.text);

const poem = await claude('Write a haiku about coding');
console.log(poem.text);

// Streaming works too
const stream = await gpt('Count to 10', { stream: true });
for await (const chunk of stream) {
  process.stdout.write(chunk);
}
