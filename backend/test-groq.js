import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const key = process.env.GROQ_API_KEY;
console.log('Groq key configured:', Boolean(key));

async function test() {
  const models = [
    'llama-3.3-70b-specdec',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
  ];

  for (const model of models) {
    try {
      console.log(`\nTesting Groq model: ${model}...`);
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Hello' }],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed with ${model}: ${response.status} - ${errorText}`);
      } else {
        const data = await response.json();
        console.log(`Success with ${model}! Output:`, data.choices?.[0]?.message?.content);
        return;
      }
    } catch (err) {
      console.error(`Error with ${model}:`, err.message);
    }
  }
}

test();
