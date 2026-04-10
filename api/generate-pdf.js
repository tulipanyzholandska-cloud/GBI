import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { rid } = req.query;
  if (!rid) return res.status(400).json({ error: 'Missing rid' });

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('results').select('plan, quiz_data').eq('id', rid).single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });

    const plan = data.plan;
    const idea = plan.top_idea.name;
    const fp = plan.full_plan;

    const msg = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: `Create a concise 30-day action plan for someone starting: "${idea}".

Based on this data:
- First customer approach: ${fp.first_customer}
- Pricing: ${fp.pricing.recommended_price}
- Days 1-7: ${fp.action_plan.days_1_7.join(', ')}
- Days 8-30: ${fp.action_plan.days_8_30.join(', ')}

Return ONLY valid JSON:
{"title":"","subtitle":"","week1":{"title":"","tasks":["",""]},"week2":{"title":"","tasks":["",""]},"week3":{"title":"","tasks":["",""]},"week4":{"title":"","tasks":["",""]},"first_client_script":"","daily_habit":"","success_metric":""}` }]
    });

    const pdf = JSON.parse(msg.content[0].text.replace(/```json|```/g, '').trim());
    res.json({ ok: true, idea, pdf });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
