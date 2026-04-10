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

  const systemPrompt = `You are a brutally specific business coach who has helped 10,000 people start businesses. You NEVER give generic advice. Every single recommendation must be tailored to THIS specific person's age, location, budget, time, and strengths.

RULES you must follow:
- Name real tools, platforms, and websites (e.g. "post on Facebook Marketplace", not "use social media")
- Give real price ranges based on their location and market (e.g. "charge 800–1200 CZK/session in Prague", not "charge a competitive rate")
- Income forecasts must be realistic and based on their specific time availability and budget
- Action steps must be so specific that the person can do them TODAY without asking any follow-up questions
- first_customer field must describe EXACTLY how to get the first paying customer: which platform, what message to send, what to offer
- If their budget is low, suggest zero-cost or near-zero-cost approaches
- If their time is limited (e.g. 5h/week), all suggestions must be realistic within that constraint
- Write entirely in ${lang}
- Respond ONLY with valid JSON, no markdown, no extra text`;

  const userPrompt = `Create a hyper-personalized business plan for this exact person:

AGE: ${quizData.age}
LOCATION: ${quizData.location}
LIFESTYLE: ${quizData.lifestyle}
AVAILABLE TIME: ${quizData.time} hours/week
STARTING BUDGET: ${quizData.budget}
STRENGTHS: ${quizData.strengths}
INTERESTS: ${quizData.interests}
PREFERRED BUSINESS TYPE: ${quizData.btype}
INCOME GOAL: ${quizData.income}
RISK TOLERANCE: ${quizData.risk}

Think step by step:
1. What can this SPECIFIC person realistically start given their time, budget, and location?
2. What is their most marketable strength?
3. Who would pay them, and how much, in their specific location?
4. What is the single fastest path to their first €/$/CZK earned?

Return ONLY this JSON (fill every field with specific, actionable content — no placeholders, no vague advice):
{"top_idea":{"name":"","tagline":"","fit_reasons":["","",""],"income_forecast":{"month_3_low":0,"month_3_high":0,"month_6_low":0,"month_6_high":0,"month_12_low":0,"month_12_high":0,"explanation":""},"difficulty":3,"difficulty_reason":""},"full_plan":{"first_customer":"","pricing":{"recommended_price":"","reasoning":"","when_to_raise":""},"action_plan":{"days_1_7":["","",""],"days_8_30":["","",""],"days_31_90":["",""]},"tools":[{"name":"","purpose":"","cost":""}],"top_mistakes":[{"mistake":"","how_to_avoid":""}],"main_objection":{"objection":"","reframe":""}},"other_ideas":[{"name":"","tagline":"","fit_score":0},{"name":"","tagline":"","fit_score":0}]}`;

  try {
    const msg = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
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
