// Merged into checkout.js — forward requests there with product:'tripwire'
export default async function handler(req, res) {
  req.body = { ...req.body, product: 'tripwire' };
  const { default: checkout } = await import('./checkout.js');
  return checkout(req, res);
}
