import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  pro: process.env.STRIPE_PRICE_PRO,
  agencia: process.env.STRIPE_PRICE_AGENCIA,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { plan, user_id, email } = req.body;

  if (!plan || !PLANS[plan]) {
    return res.status(400).json({ error: 'Plano inválido. Use "pro" ou "agencia".' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PLANS[plan], quantity: 1 }],
      customer_email: email || undefined,
      metadata: { user_id: user_id || 'anonymous', plan },
      success_url: `${process.env.BASE_URL}/dashboard.html?upgrade=success&plan=${plan}`,
      cancel_url: `${process.env.BASE_URL}/dashboard.html?upgrade=cancelled`,
      locale: 'pt-BR',
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: 'Erro ao criar sessão de pagamento', detail: err.message });
  }
}
