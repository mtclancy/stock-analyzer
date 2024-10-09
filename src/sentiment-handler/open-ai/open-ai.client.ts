import OpenAI from 'openai';

export function getOpenAiClient(key: string) {
  const client = new OpenAI({
    apiKey: key, // This is the default and can be omitted
  });
  return client;
}
