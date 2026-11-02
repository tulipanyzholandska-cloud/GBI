import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from './_supabase.js';
import { generateBlockData } from './_blocks.js';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const LANG_MAP = { en: 'English', cs: 'Czech', sk: 'Slovak', de: 'German' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { block, rid, ideaName: requestedIdea } = req.body || {};

  // PAYWALL: premium blocks are only generated for a result row that has been paid for.
  // Block 5 (30-day coach) is a separate upsell and additionally requires plan.upsell_paid.
  if (!rid) return res.status(402).json({ error: 'Payment required' });
  let row;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('results').select('plan, quiz_data, paid').eq('id', rid).single();
    if (error || !data) return res.status(404).json({ error: 'Not found' });
    row = data;
  } catch (e) {
    console.error('generate-block lookup error:', e.message);
    return res.status(500).json({ error: 'Lookup failed' });
  }
  if (row.paid !== true) return res.status(402).json({ error: 'Payment required' });
  if (Number(block) === 5 && row.plan?.upsell_paid !== true) return res.status(402).json({ error: 'Payment required' });

  // Return cached block from DB if available (saves Claude API tokens)
  if (row.plan?.blocks?.[block]) {
    return res.json({ block, data: row.plan.blocks[block], cached: true });
  }

  // Prompt inputs come from the stored row, not the request body. The client may
  // have switched to one of the row's other_ideas, so accept those names only.
  const quizData = row.quiz_data || {};
  const knownIdeas = [row.plan?.top_idea?.name, ...(row.plan?.other_ideas || []).map(o => o?.name)].filter(Boolean);
  const ideaName = knownIdeas.includes(requestedIdea) ? requestedIdea : (knownIdeas[0] || '');

  try {
    const data = await generateBlockData(claude, block, ideaName, quizData);
    if (!data) return res.status(400).json({ error: 'Invalid block' });

    // Persist block into plan.blocks[N] so future visits skip Claude
    try {
      const supabase = getSupabase();
      const { data: fresh } = await supabase.from('results').select('plan').eq('id', rid).single();
      const basePlan = fresh?.plan || row.plan;
      const updatedPlan = { ...basePlan, blocks: { ...(basePlan?.blocks || {}), [block]: data } };
      await supabase.from('results').update({ plan: updatedPlan }).eq('id', rid);
    } catch (e) { console.error('Block cache save error:', e.message); }

    res.json({ block, data });
  } catch (err) {
    console.error('Block', block, err.message);
    res.status(500).json({ error: err.message });
  }
}
