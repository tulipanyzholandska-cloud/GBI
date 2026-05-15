import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const LANG_MAP = { en: 'English', cs: 'Czech', sk: 'Slovak', de: 'German' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { quizData } = req.body;
  const lang = LANG_MAP[quizData?.language] || 'English';
  const isCzSk = ['cs','sk'].includes(quizData?.language);
  const formal = isCzSk ? 'Use formal Czech/Slovak (vykání). ' : '';

  const systemPrompt = `Expert business coach. ${formal}Never mention specific cities. difficulty = integer 1-5 only. Respond ONLY with valid JSON.`;

  const userPrompt = `Create personalized business plan. Person: age ${quizData.age}, ${quizData.location}, ${quizData.lifestyle}, ${quizData.time}/week, budget ${quizData.budget}, strengths: ${quizData.strengths}, interests: ${quizData.interests}, wants: ${quizData.btype}, goal: ${quizData.income}, risk: ${quizData.risk}. Language: ${lang}.

JSON (be specific, concise):
{"top_idea":{"name":"","tagline":"","market_size":"","why_now":"","fit_reasons":["","",""],"income_forecast":{"month_3_low":0,"month_3_high":0,"month_6_low":0,"month_6_high":0,"month_12_low":0,"month_12_high":0,"month_12_math":"","explanation":""},"difficulty":3,"difficulty_reason":"","your_advantage":""},"full_plan":{"first_customer":{"platform":"","subject":"","message":"","followup_message":"","expected_response_rate":"","daily_outreach_target":20},"pricing":{"starter":{"name":"","price":"","price_number":0,"what_included":""},"main":{"name":"","price":"","price_number":0,"what_included":""},"premium":{"name":"","price":"","price_number":0,"what_included":""},"reasoning":"","when_to_raise":""},"action_plan":{"days_1_7":["","",""],"days_8_30":["","",""],"days_31_90":["",""]},"scripts":{"cold_outreach":"","follow_up":"","closing":"","upsell":""},"tools":[{"name":"","url":"","purpose":"","cost":""},{"name":"","url":"","purpose":"","cost":""},{"name":"","url":"","purpose":"","cost":""}],"top_mistakes":[{"mistake":"","how_to_avoid":""},{"mistake":"","how_to_avoid":""}],"main_objection":{"objection":"","reframe":""}},"other_ideas":[{"name":"","tagline":"","fit_score":0,"monthly_potential":""},{"name":"","tagline":"","fit_score":0,"monthly_potential":""}]}`;

  try {
    const msg = await claude.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const raw = msg.content[0].text.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(raw);

    let resultId = null;
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { data } = await supabase.from('results').insert({
        quiz_data: quizData, plan, language: quizData.language || 'en'
      }).select('id').single();
      resultId = data?.id;
    } catch (e) { console.error('DB:', e.message); }

    res.json({ resultId, plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
