const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// Fail fast if no API key is configured
if (!NVIDIA_API_KEY) {
  console.error('FATAL: NVIDIA_API_KEY environment variable is not set.');
  process.exit(1);
}

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'NVIDIA NIM Proxy Server',
    timestamp: new Date().toISOString()
  });
});

// OpenAI-compatible chat completions
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens, stream } = req.body;

    if (!model || !messages) {
      return res.status(400).json({
        error: { message: '`model` and `messages` are required fields.', type: 'invalid_request_error' }
      });
    }

    console.log(`Request received for model: ${model}`);

    const nvidiaRequest = {
      model,
      messages,
      temperature: temperature ?? 1.0,
      stream: stream || false,
      ...(max_tokens != null && { max_tokens }) // only include if explicitly provided
    };

    const response = await axios.post(
      `${NVIDIA_BASE_URL}/chat/completions`,
      nvidiaRequest,
      {
        headers: {
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: stream ? 'stream' : 'json'
      }
    );

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      response.data.pipe(res);
      // Handle upstream stream errors
      response.data.on('error', (err) => {
        console.error('Stream error:', err.message);
        res.end();
      });
    } else {
      res.json(response.data);
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: {
        message: error.response?.data?.message || error.message,
        type: 'proxy_error',
        details: error.response?.data || null
      }
    });
  }
});

// Models endpoint
app.get('/v1/models', (req, res) => {
  const created = Math.floor(Date.now() / 1000); // Unix seconds, not ms
  res.json({
    object: 'list',
    data: [
      { id: 'deepseek-ai/deepseek-r1-0528', object: 'model', created, owned_by: 'nvidia' },
      { id: 'deepseek-ai/deepseek-v3-0324', object: 'model', created, owned_by: 'nvidia' }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`NVIDIA API Key configured: Yes`);
});
