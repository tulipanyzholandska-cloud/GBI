import Anthropic from '@anthropic-ai/sdk';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const LANG_MAP = { en: 'English', cs: 'Czech', sk: 'Slovak', de: 'German' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { block, quizData, ideaName, language } = req.body;
  const lang = LANG_MAP[language] || 'English';
  const isCzSk = ['cs','sk'].includes(language);
  const formal = isCzSk ? 'Use formal Czech/Slovak (vykání). ' : '';
  const ctx = `Business: "${ideaName}", Person: age ${quizData.age}, location type ${quizData.location}, ${quizData.time}/week, budget ${quizData.budget}, strengths: ${quizData.strengths}, interests: ${quizData.interests}, goal: ${quizData.income}`;

  const blocks = {
    1: {
      system: `Premium business consultant. ALL output MUST be in English. ${formal}NEVER mention specific cities. Return ONLY valid JSON.`,
      prompt: `${ctx}\n\nReturn JSON for income projection and competitors:\n{"hero_statement":"","income_projection":{"month_1":0,"month_2":0,"month_3":0,"month_6":0,"month_9":0,"month_12":0,"month_12_math":"X clients x Y€ = Z€","year_2_potential":0,"income_sources":[{"source":"","monthly_amount":0,"percentage":0},{"source":"","monthly_amount":0,"percentage":0},{"source":"","monthly_amount":0,"percentage":0}]},"competitors":[{"name":"","price":"","weakness":"","how_you_beat_them":""},{"name":"","price":"","weakness":"","how_you_beat_them":""},{"name":"","price":"","weakness":"","how_you_beat_them":""}]}`,
      tokens: 1200
    },
    2: {
      system: `Premium business consultant. ALL output MUST be in English. ${formal}Scripts must be copy-paste ready. NEVER mention specific cities. Return ONLY valid JSON.`,
      prompt: `${ctx}\n\nReturn JSON for pricing and first customer scripts:\n{"pricing":{"starter":{"name":"","price":"","price_number":0,"what_included":"","pitch":""},"main":{"name":"","price":"","price_number":0,"what_included":"","pitch":""},"premium":{"name":"","price":"","price_number":0,"what_included":"","pitch":""},"psychology":"","when_to_raise":""},"first_customer":{"platform":"","where_to_find":"","subject_line":"","outreach_message":"","followup_day3":"","closing_script":"","expected_response_rate":"","daily_target":20},"scripts":{"upsell":"","referral_ask":"","objection_price":"","objection_experience":""}}`,
      tokens: 1500
    },
    3: {
      system: `Premium business consultant. ALL output MUST be in English. ${formal}Be very specific and actionable. NEVER mention specific cities. Return ONLY valid JSON.`,
      prompt: `${ctx}\n\nReturn JSON for action checklist:\n{"checklist":{"day1":[{"task":"","time_minutes":0,"tool":"","tool_url":"","why":""},{"task":"","time_minutes":0,"tool":"","tool_url":"","why":""},{"task":"","time_minutes":0,"tool":"","tool_url":"","why":""},{"task":"","time_minutes":0,"tool":"","tool_url":"","why":""}],"day2_7":[{"task":"","daily_time_minutes":0,"goal":"","milestone":""},{"task":"","daily_time_minutes":0,"goal":"","milestone":""},{"task":"","daily_time_minutes":0,"goal":"","milestone":""}],"week2_4":[{"task":"","time_hours":0,"expected_result":"","revenue_milestone":""},{"task":"","time_hours":0,"expected_result":"","revenue_milestone":""},{"task":"","time_hours":0,"expected_result":"","revenue_milestone":""}],"month2_3":[{"task":"","expected_result":"","revenue_milestone":""},{"task":"","expected_result":"","revenue_milestone":""}]}}`,
      tokens: 1500
    },
    4: {
      system: `Premium business consultant. ALL output MUST be in English. ${formal}Name real tools with URLs. NEVER mention specific cities. Return ONLY valid JSON.`,
      prompt: `${ctx}\n\nReturn JSON for tools, mistakes, scaling:\n{"tools":[{"name":"","url":"","purpose":"","cost":"","how_to_start":"","time_to_setup_minutes":0},{"name":"","url":"","purpose":"","cost":"","how_to_start":"","time_to_setup_minutes":0},{"name":"","url":"","purpose":"","cost":"","how_to_start":"","time_to_setup_minutes":0},{"name":"","url":"","purpose":"","cost":"","how_to_start":"","time_to_setup_minutes":0}],"mistakes":[{"mistake":"","why_fatal":"","how_to_avoid":""},{"mistake":"","why_fatal":"","how_to_avoid":""},{"mistake":"","why_fatal":"","how_to_avoid":""}],"scaling_roadmap":[{"phase":"M1-3","focus":"","revenue_target":"","key_action":"","milestone":""},{"phase":"M4-6","focus":"","revenue_target":"","key_action":"","milestone":""},{"phase":"M7-12","focus":"","revenue_target":"","key_action":"","milestone":""},{"phase":"Year 2","focus":"","revenue_target":"","key_action":"","milestone":""}],"passive_income":[{"product":"","platform":"","price":"","monthly_potential":"","time_to_create":""},{"product":"","platform":"","price":"","monthly_potential":"","time_to_create":""}]}`,
      tokens: 1500
    }
  };

  const b = blocks[block];
  if (!b) return res.status(400).json({ error: 'Invalid block' });

  try {
    const msg = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: b.tokens,
      system: b.system,
      messages: [{ role: 'user', content: b.prompt }]
    });

    const raw = msg.content[0].text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(raw);
    res.json({ block, data });
  } catch (err) {
    console.error('Block', block, err.message);
    res.status(500).json({ error: err.message });
  }
}
