import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'marketing-agent-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ping', (_req, res) => {
  res.json({ message: 'pong' });
});

// ── Analyze endpoint (Claude stub) ────────────────────────
// This will later call the Claude API with real campaign data
app.post('/api/analyze/run', async (req, res) => {
  try {
    const { campaigns, business_context } = req.body;

    if (!campaigns || !Array.isArray(campaigns)) {
      return res.status(400).json({
        error: 'Missing or invalid campaigns array in request body',
      });
    }

    // TODO: Replace this stub with real Claude API call
    // The Claude API key lives in .env as ANTHROPIC_API_KEY
    const stubResponse = {
      executive_summary:
        'Stub response. Wire up ANTHROPIC_API_KEY in .env to get real Claude analysis.',
      priority_actions: campaigns.map((c: Record<string, unknown>, i: number) => ({
        entity_name: c.name || `Campaign ${i + 1}`,
        entity_type: 'campaign',
        platform: c.platform || 'unknown',
        issue: 'Awaiting real data analysis',
        diagnosis: 'Claude integration not yet wired',
        recommended_action: 'Add ANTHROPIC_API_KEY to .env and implement Claude call',
        priority: 'medium',
        bucket: 'need_more_data',
        confidence: 0,
      })),
      pause_list: [],
      scale_list: [],
      monitor_list: [],
      data_gaps: ['Claude API not connected yet'],
      received_at: new Date().toISOString(),
      business_context: business_context || null,
    };

    return res.json(stubResponse);
  } catch (error) {
    console.error('Error in /api/analyze/run:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Start server ──────────────────────────────────────────
app.listen(port, () => {
  console.log(`Marketing Agent API running on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/api/health`);
});
