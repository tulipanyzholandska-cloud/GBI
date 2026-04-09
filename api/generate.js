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

  const systemPrompt = `You are a highly specific business idea advisor. Generate a deeply personalized business plan. Be concrete, real numbers, specific actions, no vague advice. Address the user as "you". Write entirely in ${lang}. Respond ONLY with valid JSON, no markdown, no extra text.`;

  const userPrompt = `User profile:
AGE: ${quizData.age}
LOCATION: ${quizData.location}
LIFESTYLE: ${quizData.lifestyle}
TIME/WEEK: ${quizData.time}
BUDGET: ${quizData.budget}
STRENGTHS: ${quizData.strengths}
INTERESTS: ${quizData.interests}
BUSINESS TYPE: ${quizData.btype}
INCOME GOAL: ${quizData.income}
RISK TOLERANCE: ${quizData.risk}

Return ONLY this JSON:
{"top_idea":{"name":"","tagline":"","fit_reasons":["","",""],"income_forecast":{"month_3_low":0,"month_3_high":0,"month_6_low":0,"month_6_high":0,"month_12_low":0,"month_12_high":0,"explanation":""},"difficulty":3,"difficulty_reason":""},"full_plan":{"first_customer":"","pricing":{"recommended_price":"","reasoning":"","when_to_raise":""},"action_plan":{"days_1_7":["","",""],"days_8_30":["","",""],"days_31_90":["",""]},"tools":[{"name":"","purpose":"","cost":""}],"top_mistakes":[{"mistake":"","how_to_avoid":""}],"main_objection":{"objection":"","reframe":""}},"other_ideas":[{"name":"","tagline":"","fit_score":0},{"name":"","tagline":"","fit_score":0}]}`;

  try {
    const msg = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const plan = JSON.parse(msg.content[0].text.replace(/```json|```/g, '').trim());

    let resultId = null;
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { data } = await supabase.from('results').insert({ quiz_data: quizData, plan, language: quizData.language || 'en' }).select('id').single();
      resultId = data?.id;
    } catch (e) { console.error('DB:', e.message); }

    res.json({ resultId, plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
