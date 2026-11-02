// What an unpaid visitor may see: the idea match plus the free preview promised
// on the email gate (first outreach message + days 1-7). Never pricing, scripts,
// tools or generated blocks.
export function toFreePlan(plan) {
  if (!plan) return plan;
  const { full_plan, blocks, ...free } = plan;
  if (!full_plan) return free;
  const fc = full_plan.first_customer;
  return {
    ...free,
    full_plan: {
      first_customer: fc && typeof fc === 'object'
        ? { platform: fc.platform, subject: fc.subject, message: fc.message }
        : fc,
      action_plan: { days_1_7: full_plan.action_plan?.days_1_7 || [] }
    }
  };
}
