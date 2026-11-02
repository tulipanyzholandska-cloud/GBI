// The €7 tripwire is retired: it unlocked the same full plan as the €17 checkout.
export default function handler(req, res) {
  res.status(410).json({ error: 'This offer is no longer available' });
}
