const axios = require('axios');

// Turns text into a 384-dim vector (BAAI/bge-small-en-v1.5) for semantic search.
//
// Prefers Cloudflare Workers AI (free daily allowance, no RAM on our servers,
// and search doesn't have to wake the AI engine). Falls back to the AI engine's
// /create-vector (FastEmbed, same model) when Cloudflare isn't configured.
const CF_MODEL = '@cf/baai/bge-small-en-v1.5';

const provider = () =>
  process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN ? 'cloudflare' : 'ai-engine';

async function embed(text, { timeout = 15000 } = {}) {
  if (provider() === 'cloudflare') {
    const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`;
    const { data } = await axios.post(url, { text: [text] }, {
      headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}` },
      timeout,
    });
    const vector = data?.result?.data?.[0];
    if (!Array.isArray(vector) || vector.length !== 384) throw new Error('Unexpected embedding response from Cloudflare');
    return vector;
  }

  if (!process.env.AI_SERVICE_URL) throw new Error('No embedding provider configured');
  const { data } = await axios.post(`${process.env.AI_SERVICE_URL}/create-vector`, { text }, { timeout });
  return data.vector;
}

const toPgVector = (vector) => `[${vector.join(',')}]`;

module.exports = { embed, toPgVector, provider };
