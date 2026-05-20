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

  // Basic origin check to prevent external abuse of Claude API
  const origin = req.headers.origin || req.headers.referer || '';
  const allowed = ['getbizidea.com', 'localhost', '127.0.0.1', 'vercel.app'];
  if (origin && !allowed.some(h => origin.includes(h))) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { quizData } = req.body;
  // FORCE English output for all users — language buttons removed
  const lang = 'English';
  const systemPrompt = `You are a world-class business coach. CRITICAL LANGUAGE RULE: Every single word in your entire response MUST be in English (US). Do NOT use Czech, Slovak, German, or any non-English words — not even a single one. If you find yourself writing a non-English word, translate it immediately. The user's location does not change this: output is ALWAYS English. NEVER mention specific cities. Give exact copy-paste scripts. difficulty must be integer 1-5 ONLY. Respond ONLY with valid JSON, no markdown, no extra text. FINAL REMINDER: English only. No exceptions.`;

  const userPrompt = `Business plan for: AGE:${quizData.age}, LOCATION:${quizData.location}, TIME:${quizData.time}/week, BUDGET:${quizData.budget}, STRENGTHS:${quizData.strengths}, INTERESTS:${quizData.interests}, TYPE:${quizData.btype}, TIMELINE_TO_FIRST_INCOME:${quizData.income}, MAIN_OBSTACLE:${quizData.risk}, LANG:${lang}

JSON (fill ALL fields, be specific and concrete):
{"top_idea":{"name":"","tagline":"","market_size":"","why_now":"","fit_reasons":["","",""],"income_forecast":{"month_3_low":0,"month_3_high":0,"month_6_low":0,"month_6_high":0,"month_12_low":0,"month_12_high":0,"month_12_math":"X clients x Y€ = Z€","explanation":""},"difficulty":3,"difficulty_reason":"","your_advantage":""},"full_plan":{"first_customer":{"platform":"","subject":"","message":"","followup_message":"","expected_response_rate":"","daily_outreach_target":20},"pricing":{"starter":{"name":"","price":"","price_number":0,"what_included":""},"main":{"name":"","price":"","price_number":0,"what_included":""},"premium":{"name":"","price":"","price_number":0,"what_included":""},"reasoning":"","when_to_raise":"","psychology":""},"action_plan":{"days_1_7":["","",""],"days_8_30":["","",""],"days_31_90":["",""]},"scripts":{"cold_outreach":"","follow_up":"","closing":"","upsell":""},"tools":[{"name":"","url":"","purpose":"","cost":""},{"name":"","url":"","purpose":"","cost":""},{"name":"","url":"","purpose":"","cost":""},{"name":"","url":"","purpose":"","cost":""}],"top_mistakes":[{"mistake":"","how_to_avoid":""},{"mistake":"","how_to_avoid":""},{"mistake":"","how_to_avoid":""}],"main_objection":{"objection":"","reframe":""}},"other_ideas":[{"name":"","tagline":"","fit_score":0,"monthly_potential":""},{"name":"","tagline":"","fit_score":0,"monthly_potential":""}]}`;

  try {
    const msg = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const raw = msg.content[0].text.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(raw);

    let resultId = null;
    let dbError = null;
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { data, error } = await supabase.from('results').insert({
        quiz_data: quizData, plan, language: quizData.language || 'en'
      }).select('id').single();
      if (error) { dbError = error.message || JSON.stringify(error); console.error('DB error:', error); }
      resultId = data?.id;
    } catch (e) {
      dbError = e.message;
      console.error('DB exception:', e.message);
    }

    res.json({ resultId, plan, dbError });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
