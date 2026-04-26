import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers,
    },
  });
  return res.status === 204 ? null : res.json();
}

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => resolve(Buffer.from(data)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  // Pagamento confirmado — ativa o plano
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { user_id, plan } = session.metadata;

    const planLimits = { pro: 999999, agencia: 999999 };
    const limit = planLimits[plan] || 20;

    // Upsert na tabela de planos
    await sb('plans', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        user_id,
        plan,
        active: true,
        link_limit: limit,
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
        activated_at: new Date().toISOString(),
      }),
    });

    console.log(`Plano ${plan} ativado para user ${user_id}`);
  }

  // Assinatura cancelada — volta para free
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;

    await sb(`plans?stripe_subscription_id=eq.${subscription.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ plan: 'free', active: false, link_limit: 20 }),
    });

    console.log(`Assinatura cancelada: ${subscription.id}`);
  }

  return res.status(200).json({ received: true });
}
