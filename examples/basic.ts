import { ai } from 'aiclientjs';

// Simple text completion (uses OPENAI_API_KEY env var by default)
const response = await ai('Explain quantum computing in one sentence');
console.log(response.text);
console.log(`Tokens used: ${response.usage.totalTokens}`);

// Use a different provider
const claudeResponse = await ai('Explain quantum computing in one sentence', {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
});
console.log(claudeResponse.text);

// Use a local model via Ollama
const localResponse = await ai('Explain quantum computing in one sentence', {
  provider: 'ollama',
  model: 'llama3.1',
});
console.log(localResponse.text);
