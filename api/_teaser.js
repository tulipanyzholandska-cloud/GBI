// Free-preview subset of plan.full_plan, safe to send to unpaid clients.
// quiz.html's preview (level-2 reveal, locked-card teaser) only reads these fields.
export function teaserFullPlan(fp) {
  if (!fp) return { first_customer: {}, action_plan: { days_1_7: [], days_8_30: [] }, pricing: {} };
  const fc = fp.first_customer || {};
  const ap = fp.action_plan || {};
  return {
    first_customer: typeof fc === 'object'
      ? { platform: fc.platform || '', subject: fc.subject || '', message: fc.message || '' }
      : fc,
    action_plan: {
      days_1_7: ap.days_1_7 || [],
      days_8_30: (ap.days_8_30 || []).slice(0, 2)
    },
    pricing: {}
  };
}

// Strip premium content (full_plan details, generated blocks) from an unpaid plan.
export function freePlan(plan) {
  if (!plan) return plan;
  const { full_plan, blocks, ...rest } = plan;
  return { ...rest, full_plan: teaserFullPlan(full_plan) };
}
