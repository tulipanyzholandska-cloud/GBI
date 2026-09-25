// Free teaser of full_plan: only what the unpaid UI shows (level2-reveal in quiz.html).
// Everything else (pricing, scripts, tools, mistakes, days 31–90, blocks) stays server-side until paid.
export function toPreviewPlan(plan) {
  if (!plan) return plan;
  const { full_plan, blocks, ...rest } = plan;
  if (!full_plan) return rest;
  const fc = full_plan.first_customer;
  const ap = full_plan.action_plan || {};
  return {
    ...rest,
    full_plan: {
      first_customer: fc && typeof fc === 'object'
        ? { platform: fc.platform, subject: fc.subject, message: fc.message }
        : fc,
      action_plan: {
        days_1_7: ap.days_1_7 || [],
        days_8_30: (ap.days_8_30 || []).slice(0, 2)
      }
    }
  };
}
