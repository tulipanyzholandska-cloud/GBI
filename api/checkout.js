import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { resultId, email, product, planId, planName, planPrice } = req.body;
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://getbizidea.com';

  try {
    let session;

    if (product === 'plan') {
      // Ready-made plan purchase
      const amount = Math.round((planPrice || 17) * 100);
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        locale: 'en',
        line_items: [{ price_data: { currency: 'eur', product_data: { name: planName || 'Ready-Made Business Plan', description: 'Complete 90-day business launch plan — instant download after purchase' }, unit_amount: amount }, quantity: 1 }],
        mode: 'payment',
        metadata: { planId: planId || '', email: email || '', type: 'ready-made-plan' },
        customer_email: email || undefined,
        success_url: `${baseUrl}/plans.html?purchased=${planId}&email=${encodeURIComponent(email || '')}`,
        cancel_url: `${baseUrl}/plans.html`,
      });
    } else if (product === 'upsell') {
      // €27 Launch Week upsell
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        locale: 'en',
        line_items: [{ price_data: { currency: 'eur', product_data: { name: 'Launch Week — 7-Day Fast-Start Kit', description: 'Personalized daily schedule for Week 1: what to do each morning, afternoon & evening to land your first client' }, unit_amount: 2700 }, quantity: 1 }],
        mode: 'payment',
        metadata: { resultId: resultId || '', email: email || '', type: 'upsell' },
        customer_email: email || undefined,
        success_url: `${baseUrl}/quiz.html?unlocked=true&rid=${resultId}&upsell=1`,
        cancel_url: `${baseUrl}/quiz.html?unlocked=true&rid=${resultId}`,
      });
    } else {
      // €17 main plan
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        locale: 'en',
        line_items: [{ price_data: { currency: 'eur', product_data: { name: 'Full Business Plan · 90-day roadmap', description: 'First client strategy + pricing + tools + day-by-day action plan + mistakes to avoid' }, unit_amount: 1700 }, quantity: 1 }],
        mode: 'payment',
        metadata: { resultId: resultId || '', email: email || '' },
        customer_email: email || undefined,
        success_url: `${baseUrl}/quiz.html?unlocked=true&rid=${resultId}`,
        cancel_url: `${baseUrl}/quiz.html?rid=${resultId}`,
      });
    }

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
