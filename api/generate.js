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

  const systemPrompt = `You are a top-tier business consultant who creates detailed, data-rich business plans. Your plans feel like they cost €500+ from a real consultant. Every number must be specific and realistic for their location and situation.

RULES:
- Use REAL market data and specific numbers (e.g. "Czech Republic freelance market grew 23% in 2024")
- Every income projection must show the math (e.g. "3 clients × €250/session × 4 sessions/month = €3,000")
- Include competitor analysis with real named competitors and their pricing
- first_customer must be a complete ready-to-send message with subject line
- Each action step must be doable TODAY, under 2 hours, zero additional research needed
- Include exact copy-paste scripts for outreach, follow-up, and upsell
- difficulty must be integer 1-5 ONLY
- Write entirely in ${lang}
- Respond ONLY with valid JSON, no markdown`;

  const userPrompt = `Create a premium, data-rich business plan for this person:

AGE: ${quizData.age}
LOCATION: ${quizData.location}
LIFESTYLE: ${quizData.lifestyle}
TIME/WEEK: ${quizData.time}
BUDGET: ${quizData.budget}
STRENGTHS: ${quizData.strengths}
INTERESTS: ${quizData.interests}
BUSINESS TYPE: ${quizData.btype}
INCOME GOAL: ${quizData.income}
RISK: ${quizData.risk}

Return ONLY this JSON with ALL fields filled with specific, actionable, data-rich content:
{
  "top_idea": {
    "name": "",
    "tagline": "",
    "market_size": "",
    "market_growth": "",
    "why_now": "",
    "fit_reasons": ["","",""],
    "income_forecast": {
      "month_3_low": 0, "month_3_high": 0,
      "month_6_low": 0, "month_6_high": 0,
      "month_12_low": 0, "month_12_high": 0,
      "year_2_low": 0, "year_2_high": 0,
      "month_3_math": "",
      "month_6_math": "",
      "month_12_math": "",
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
      "followup": "",
      "expected_response_rate": ""
    },
    "pricing": {
      "starter": {"name": "", "price": "", "what_included": ""},
      "main": {"name": "", "price": "", "what_included": ""},
      "premium": {"name": "", "price": "", "what_included": ""},
      "reasoning": "",
      "when_to_raise": "",
      "annual_potential": ""
    },
    "action_plan": {
      "week_1": {
        "goal": "",
        "tasks": ["","",""],
        "milestone": "",
        "expected_revenue": ""
      },
      "week_2": {
        "goal": "",
        "tasks": ["","",""],
        "milestone": "",
        "expected_revenue": ""
      },
      "week_3_4": {
        "goal": "",
        "tasks": ["","",""],
        "milestone": "",
        "expected_revenue": ""
      },
      "month_2_3": {
        "goal": "",
        "tasks": ["","",""],
        "milestone": "",
        "expected_revenue": ""
      },
      "month_4_6": {
        "goal": "",
        "tasks": ["","",""],
        "milestone": "",
        "expected_revenue": ""
      },
      "month_7_12": {
        "goal": "",
        "tasks": ["","",""],
        "milestone": "",
        "expected_revenue": ""
      }
    },
    "scripts": {
      "cold_outreach": "",
      "follow_up": "",
      "upsell": "",
      "referral_ask": ""
    },
    "tools": [
      {"name": "", "url": "", "purpose": "", "cost": "", "how_to_use": ""},
      {"name": "", "url": "", "purpose": "", "cost": "", "how_to_use": ""},
      {"name": "", "url": "", "purpose": "", "cost": "", "how_to_use": ""},
      {"name": "", "url": "", "purpose": "", "cost": "", "how_to_use": ""}
    ],
    "top_mistakes": [
      {"mistake": "", "why_fatal": "", "how_to_avoid": ""},
      {"mistake": "", "why_fatal": "", "how_to_avoid": ""},
      {"mistake": "", "why_fatal": "", "how_to_avoid": ""}
    ],
    "main_objection": {"objection": "", "reframe": ""},
    "scaling_roadmap": {
      "phase1": {"months": "1-3", "focus": "", "revenue_target": "", "key_action": ""},
      "phase2": {"months": "4-6", "focus": "", "revenue_target": "", "key_action": ""},
      "phase3": {"months": "7-12", "focus": "", "revenue_target": "", "key_action": ""},
      "phase4": {"months": "13-24", "focus": "", "revenue_target": "", "key_action": ""}
    },
    "monthly_income_breakdown": [
      {"month": 1, "revenue": 0, "main_source": ""},
      {"month": 2, "revenue": 0, "main_source": ""},
      {"month": 3, "revenue": 0, "main_source": ""},
      {"month": 6, "revenue": 0, "main_source": ""},
      {"month": 9, "revenue": 0, "main_source": ""},
      {"month": 12, "revenue": 0, "main_source": ""}
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
      max_tokens: 6000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const plan = JSON.parse(msg.content[0].text.replace(/```json|```/g, '').trim());

    let resultId = null;
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      const { data } = await supabase.from('results').insert({
        quiz_data: quizData,
        plan,
        language: quizData.language || 'en'
      }).select('id').single();
      resultId = data?.id;
    } catch (e) { console.error('DB:', e.message); }

    res.json({ resultId, plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
