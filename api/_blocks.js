// Paid plan blocks: prompts, model call and post-processing. Used by api/generate-block.js
// and by evals/plan-quality, so the eval measures exactly what buyers get.
import { researchCompetitors, dropDeadLinks } from './_research.js';
import { incomeRule, capProjection } from './_income.js';

// Extract first complete balanced JSON object from text (ignores trailing garbage)
function extractFirstJson(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

export function buildBlockPrompts(quizData, ideaName) {
  // FORCE English output for all blocks — language buttons removed
  const formal = 'CRITICAL: Every single word MUST be in English (US). ZERO Czech/Slovak/German/non-English words allowed — not even one. If the business name or context appears in another language, translate it and continue in English. No exceptions. ';
  // The reader is usually a beginner, so anything they send has to be true on day one
  const truth = 'The reader is starting from zero: no clients, results or testimonials yet. Scripts must never claim past clients, results, case studies or experience they may not have; offer something they can really do instead, such as a free sample or a small first project. Do not state statistics, market figures or response rates as facts. Mark any number you estimate as an estimate. ';
  const ctx = `Business: "${ideaName}", Type: ${quizData.btype}, Person: age ${quizData.age}, location type ${quizData.location}, ${quizData.time}/week, budget ${quizData.budget}, strengths: ${quizData.strengths}, interests: ${quizData.interests}, timeline to first income: ${quizData.income}, main obstacle to overcome: ${quizData.risk}, people already ask them for help with: ${quizData.asked_for || 'not answered'}. The goal of this plan is the first paying customer, so anything that does not lead there comes later.`;

  const blocks = {
    1: {
      system: `Premium business consultant. ALL output MUST be in English. ${formal}${truth}NEVER mention specific cities. Return ONLY valid JSON.`,
      prompt: `${ctx}\n\nReturn JSON for income projection. ${incomeRule(quizData.time)} hero_statement describes the working life they are building, with no amounts:\n{"hero_statement":"","income_projection":{"month_1":0,"month_2":0,"month_3":0,"month_6":0,"month_9":0,"month_12":0,"month_12_math":"X clients x Y€ = Z€","year_2_potential":0,"income_sources":[{"source":"","monthly_amount":0,"percentage":0},{"source":"","monthly_amount":0,"percentage":0},{"source":"","monthly_amount":0,"percentage":0}]}}\n\nREMEMBER: English only. Every word.`,
      tokens: 2500
    },
    2: {
      system: `Premium business consultant. ALL output MUST be in English. ${formal}${truth}Scripts must be copy-paste ready. NEVER mention specific cities. Return ONLY valid JSON.`,
      prompt: `${ctx}\n\nReturn JSON for pricing and first customer scripts:\n{"pricing":{"starter":{"name":"","price":"","price_number":0,"what_included":"","pitch":""},"main":{"name":"","price":"","price_number":0,"what_included":"","pitch":""},"premium":{"name":"","price":"","price_number":0,"what_included":"","pitch":""},"psychology":"","when_to_raise":""},"first_customer":{"platform":"","where_to_find":"","subject_line":"","outreach_message":"","followup_day3":"","closing_script":"","expected_response_rate":"","daily_target":20},"scripts":{"upsell":"","referral_ask":"","objection_price":"","objection_experience":""}}\n\nREMEMBER: English only. Every word.`,
      tokens: 3000
    },
    3: {
      system: `Premium business consultant. ALL output MUST be in English. ${formal}${truth}Be very specific and actionable. NEVER mention specific cities. Return ONLY valid JSON.`,
      prompt: `${ctx}\n\nReturn JSON for action checklist:\n{"checklist":{"day1":[{"task":"","time_minutes":0,"tool":"","tool_url":"","why":""},{"task":"","time_minutes":0,"tool":"","tool_url":"","why":""},{"task":"","time_minutes":0,"tool":"","tool_url":"","why":""},{"task":"","time_minutes":0,"tool":"","tool_url":"","why":""}],"day2_7":[{"task":"","daily_time_minutes":0,"goal":"","milestone":""},{"task":"","daily_time_minutes":0,"goal":"","milestone":""},{"task":"","daily_time_minutes":0,"goal":"","milestone":""}],"week2_4":[{"task":"","time_hours":0,"expected_result":"","revenue_milestone":""},{"task":"","time_hours":0,"expected_result":"","revenue_milestone":""},{"task":"","time_hours":0,"expected_result":"","revenue_milestone":""}],"month2_3":[{"task":"","expected_result":"","revenue_milestone":""},{"task":"","expected_result":"","revenue_milestone":""}]}}\n\nREMEMBER: English only. Every word.`,
      tokens: 3000
    },
    4: {
      system: `Premium business consultant. ALL output MUST be in English. ${formal}${truth}Name real tools with URLs. NEVER mention specific cities. Return ONLY valid JSON.`,
      prompt: `${ctx}\n\nReturn JSON for tools, mistakes, scaling:\n{"tools":[{"name":"","url":"","purpose":"","cost":"","how_to_start":"","time_to_setup_minutes":0},{"name":"","url":"","purpose":"","cost":"","how_to_start":"","time_to_setup_minutes":0},{"name":"","url":"","purpose":"","cost":"","how_to_start":"","time_to_setup_minutes":0},{"name":"","url":"","purpose":"","cost":"","how_to_start":"","time_to_setup_minutes":0}],"mistakes":[{"mistake":"","why_fatal":"","how_to_avoid":""},{"mistake":"","why_fatal":"","how_to_avoid":""},{"mistake":"","why_fatal":"","how_to_avoid":""}],"scaling_roadmap":[{"phase":"M1-3","focus":"","revenue_target":"","key_action":"","milestone":""},{"phase":"M4-6","focus":"","revenue_target":"","key_action":"","milestone":""},{"phase":"M7-12","focus":"","revenue_target":"","key_action":"","milestone":""},{"phase":"Year 2","focus":"","revenue_target":"","key_action":"","milestone":""}],"passive_income":[{"product":"","platform":"","price":"","monthly_potential":"","time_to_create":""},{"product":"","platform":"","price":"","monthly_potential":"","time_to_create":""}]}\n\nREMEMBER: English only. Every word.`,
      tokens: 3500
    },
    5: {
      system: `Premium business coach. ALL output MUST be in English. ${formal}${truth}Be hyper-specific — name exact platforms, exact copy-paste scripts, real actions. NEVER mention specific cities. Return ONLY valid JSON.`,
      prompt: `${ctx}\n\nCreate a 30-day personalized daily coaching plan for this business. Each day: one task, one copy-paste script/message, one win metric. Days 1-7 focus on setup & first outreach. Days 8-14 on follow-up & first client. Days 15-21 on delivering & getting referrals. Days 22-30 on scaling to 3+ clients. Keep it tight: theme max 6 words, task max 30 words, script max 50 words, win max 12 words.\n\nReturn JSON:\n{"plan_title":"30-Day Launch Coach","business":"","days":[{"day":1,"theme":"","task":"","script":"","win":"","time_minutes":45},{"day":2,"theme":"","task":"","script":"","win":"","time_minutes":30},{"day":3,"theme":"","task":"","script":"","win":"","time_minutes":45},{"day":4,"theme":"","task":"","script":"","win":"","time_minutes":30},{"day":5,"theme":"","task":"","script":"","win":"","time_minutes":45},{"day":6,"theme":"","task":"","script":"","win":"","time_minutes":20},{"day":7,"theme":"","task":"","script":"","win":"","time_minutes":30},{"day":8,"theme":"","task":"","script":"","win":"","time_minutes":45},{"day":9,"theme":"","task":"","script":"","win":"","time_minutes":30},{"day":10,"theme":"","task":"","script":"","win":"","time_minutes":45},{"day":11,"theme":"","task":"","script":"","win":"","time_minutes":30},{"day":12,"theme":"","task":"","script":"","win":"","time_minutes":45},{"day":13,"theme":"","task":"","script":"","win":"","time_minutes":20},{"day":14,"theme":"","task":"","script":"","win":"","time_minutes":60},{"day":15,"theme":"","task":"","script":"","win":"","time_minutes":30},{"day":16,"theme":"","task":"","script":"","win":"","time_minutes":45},{"day":17,"theme":"","task":"","script":"","win":"","time_minutes":30},{"day":18,"theme":"","task":"","script":"","win":"","time_minutes":45},{"day":19,"theme":"","task":"","script":"","win":"","time_minutes":20},{"day":20,"theme":"","task":"","script":"","win":"","time_minutes":30},{"day":21,"theme":"","task":"","script":"","win":"","time_minutes":45},{"day":22,"theme":"","task":"","script":"","win":"","time_minutes":30},{"day":23,"theme":"","task":"","script":"","win":"","time_minutes":45},{"day":24,"theme":"","task":"","script":"","win":"","time_minutes":30},{"day":25,"theme":"","task":"","script":"","win":"","time_minutes":20},{"day":26,"theme":"","task":"","script":"","win":"","time_minutes":45},{"day":27,"theme":"","task":"","script":"","win":"","time_minutes":30},{"day":28,"theme":"","task":"","script":"","win":"","time_minutes":45},{"day":29,"theme":"","task":"","script":"","win":"","time_minutes":20},{"day":30,"theme":"","task":"","script":"","win":"","time_minutes":60}]}\n\nREMEMBER: English only. Scripts = REAL messages to send, not templates.`,
      tokens: 8000
    }
  };

  return blocks;
}

// Returns null for an unknown block number
export async function generateBlockData(claude, block, ideaName, quizData) {
  const b = buildBlockPrompts(quizData, ideaName)[block];
  if (!b) return null;

  const [msg, competitors] = await Promise.all([
    claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: b.tokens,
      system: b.system,
      messages: [{ role: 'user', content: b.prompt }]
    }),
    Number(block) === 1 ? researchCompetitors(claude, ideaName, quizData) : null
  ]);

  const textBlock = msg.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('No text block in response');
  if (msg.stop_reason === 'max_tokens') console.error('Block', block, 'hit max_tokens');
  const raw = textBlock.text.replace(/```json|```/g, '').trim();
  const jsonStr = extractFirstJson(raw);
  if (!jsonStr) throw new Error('Incomplete JSON from model' + (msg.stop_reason === 'max_tokens' ? ' (max_tokens)' : ''));
  const data = JSON.parse(jsonStr);
  if (competitors) data.competitors = competitors;
  if (data.income_projection) capProjection(data.income_projection, quizData.time);
  if (Number(block) === 3) await dropDeadLinks(data.checklist?.day1, 'tool_url');
  if (Number(block) === 4) await dropDeadLinks(data.tools, 'url');
  return data;
}
