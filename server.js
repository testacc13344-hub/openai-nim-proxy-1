const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'running', 
    message: 'NVIDIA NIM Proxy Server',
    timestamp: new Date().toISOString()
  });
});

// OpenAI-compatible chat completions endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    // Extract OpenAI format request
    const { model, messages, temperature, max_tokens, stream } = req.body;

    // Prepare NVIDIA API request
    const nvidiaRequest = {
      model: 'deepseek/deepseek-r1', // NVIDIA's Deepseek v3.1 model ID
      messages: messages,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 1024,
      stream: stream || false
    };

    // Make request to NVIDIA API
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

    // Return response in OpenAI format
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      response.data.pipe(res);
    } else {
      res.json(response.data);
    }

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: {
        message: error.response?.data?.message || error.message,
        type: 'proxy_error'
      }
    });
  }
});

// Models endpoint (for compatibility)
app.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: [
      {
        id: 'deepseek-r1',
        object: 'model',
        created: Date.now(),
        owned_by: 'nvidia'
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
