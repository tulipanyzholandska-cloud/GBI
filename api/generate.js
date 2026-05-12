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

  const systemPrompt = `You are a world-class business coach creating a premium personalized business plan worth €500+. 

CRITICAL RULES:
- Be hyper-specific to THIS person's profile — their age, location type, budget, strengths
- NEVER mention specific cities unless the user explicitly stated one — use "your area" or "your region" instead
- Use ${isCzSk ? 'formal Czech/Slovak (vykání — Vy, Váš, Vám)' : lang} throughout — never informal
- Give EXACT copy-paste scripts that work without editing — no [placeholder] for location
- Every income number must include the math: "X clients × Y€ = Z€"
- difficulty must be integer 1-5 ONLY
- Scripts must work universally — not tied to specific geography
- Respond ONLY with valid JSON, no markdown`;

  const userPrompt = `Create a premium business plan for:
AGE: ${quizData.age}
LOCATION TYPE: ${quizData.location}
LIFESTYLE: ${quizData.lifestyle}
TIME/WEEK: ${quizData.time}
BUDGET: ${quizData.budget}
STRENGTHS: ${quizData.strengths}
INTERESTS: ${quizData.interests}
BUSINESS TYPE: ${quizData.btype}
INCOME GOAL: ${quizData.income}
RISK: ${quizData.risk}

Return ONLY this JSON with ALL fields filled with specific, actionable content:
{
  "top_idea": {
    "name": "",
    "tagline": "",
    "market_size": "",
    "why_now": "",
    "fit_reasons": ["","",""],
    "income_forecast": {
      "month_1": 0, "month_2": 0, "month_3": 0,
      "month_6": 0, "month_9": 0, "month_12": 0,
      "month_3_low": 0, "month_3_high": 0,
      "month_6_low": 0, "month_6_high": 0,
      "month_12_low": 0, "month_12_high": 0,
      "month_12_math": "",
      "income_sources": [
        {"source": "", "amount": 0, "percentage": 0},
        {"source": "", "amount": 0, "percentage": 0},
        {"source": "", "amount": 0, "percentage": 0}
      ],
      "explanation": ""
    },
    "difficulty": 3,
    "difficulty_reason": "",
    "competitors": [
      {"name": "", "price": "", "weakness": ""},
      {"name": "", "price": "", "weakness": ""},
      {"name": "", "price": "", "weakness": ""}
    ],
    "your_advantage": ""
  },
  "full_plan": {
    "first_customer": {
      "platform": "",
      "subject": "",
      "message": "",
      "followup_message": "",
      "expected_response_rate": "",
      "daily_outreach_target": 0
    },
    "pricing": {
      "starter": {"name": "", "price": "", "price_number": 0, "what_included": ""},
      "main": {"name": "", "price": "", "price_number": 0, "what_included": ""},
      "premium": {"name": "", "price": "", "price_number": 0, "what_included": ""},
      "reasoning": "",
      "when_to_raise": "",
      "psychology": ""
    },
    "checklist": {
      "day1": [
        {"task": "", "time_minutes": 0, "tool": "", "tool_url": ""},
        {"task": "", "time_minutes": 0, "tool": "", "tool_url": ""},
        {"task": "", "time_minutes": 0, "tool": "", "tool_url": ""}
      ],
      "week1": [
        {"task": "", "time_minutes": 0, "goal": ""},
        {"task": "", "time_minutes": 0, "goal": ""},
        {"task": "", "time_minutes": 0, "goal": ""}
      ],
      "month1": [
        {"task": "", "milestone": "", "expected_revenue": ""},
        {"task": "", "milestone": "", "expected_revenue": ""},
        {"task": "", "milestone": "", "expected_revenue": ""}
      ],
      "month2_3": [
        {"task": "", "milestone": "", "expected_revenue": ""},
        {"task": "", "milestone": "", "expected_revenue": ""}
      ]
    },
    "scripts": {
      "cold_outreach": "",
      "follow_up": "",
      "closing": "",
      "upsell": "",
      "referral": ""
    },
    "tools": [
      {"name": "", "url": "", "purpose": "", "cost": "", "how_to_start": ""},
      {"name": "", "url": "", "purpose": "", "cost": "", "how_to_start": ""},
      {"name": "", "url": "", "purpose": "", "cost": "", "how_to_start": ""},
      {"name": "", "url": "", "purpose": "", "cost": "", "how_to_start": ""}
    ],
    "top_mistakes": [
      {"mistake": "", "why_fatal": "", "how_to_avoid": ""},
      {"mistake": "", "why_fatal": "", "how_to_avoid": ""},
      {"mistake": "", "why_fatal": "", "how_to_avoid": ""}
    ],
    "main_objection": {"objection": "", "reframe": ""},
    "scaling_roadmap": [
      {"phase": "M1-3", "focus": "", "revenue_target": "", "key_action": ""},
      {"phase": "M4-6", "focus": "", "revenue_target": "", "key_action": ""},
      {"phase": "M7-12", "focus": "", "revenue_target": "", "key_action": ""},
      {"phase": "Rok 2", "focus": "", "revenue_target": "", "key_action": ""}
    ]
  },
  "other_ideas": [
    {"name": "", "tagline": "", "fit_score": 0, "monthly_potential": ""},
    {"name": "", "tagline": "", "fit_score": 0, "monthly_potential": ""}
  ]
}`;

  try {
    const msg = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
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
