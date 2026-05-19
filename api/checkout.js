import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { resultId, email } = req.body;
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://getbizidea.com';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      locale: 'en',
      line_items: [{ price_data: { currency: 'eur', product_data: { name: 'Full Business Plan · 90-day roadmap', description: 'First client strategy + pricing + tools + day-by-day action plan + mistakes to avoid' }, unit_amount: 700 }, quantity: 1 }],
      mode: 'payment',
      metadata: { resultId: resultId || '', email: email || '' },
      customer_email: email || undefined,
      success_url: `${baseUrl}/quiz.html?unlocked=true&rid=${resultId}`,
      cancel_url: `${baseUrl}/quiz.html?rid=${resultId}`,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
