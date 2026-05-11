// EpicPrints — Stripe Checkout Session endpoint stub
//
// Deploy this on any Node serverless platform (Vercel, Netlify Functions,
// Cloudflare Workers with the Stripe Node SDK, AWS Lambda, etc.).
//
//   npm install stripe
//
// Then set STRIPE_SECRET_KEY in the platform env (starts with sk_test_...).
//
// The frontend POSTs JSON: { items: [{ title, material, size, finish,
// orient, frame, matting, price }], currency }
//
// We return { url } pointing to the hosted Stripe Checkout page.

const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    res.status(500).json({ error: 'STRIPE_SECRET_KEY is not configured' });
    return;
  }
  const stripe = Stripe(secret);

  const { items = [], currency = 'usd' } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'No items in cart' });
    return;
  }

  const line_items = items.map((i) => ({
    price_data: {
      currency,
      unit_amount: Math.round(Number(i.price) * 100),
      product_data: {
        name: i.title || 'EpicPrints Custom Print',
        description: [
          i.material && `Material: ${i.material}`,
          i.size && `Size: ${i.size}`,
          i.orient && `Orientation: ${i.orient}`,
          i.finish && `Finish: ${i.finish}`,
          i.frame && i.frame !== 'none' && `Frame: ${i.frame}`,
          i.matting && i.matting !== 'none' && `Matting: ${i.matting}`,
        ].filter(Boolean).join(' · '),
      },
    },
    quantity: 1,
  }));

  const origin = req.headers.origin || `https://${req.headers.host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel#customizer`,
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'] },
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
