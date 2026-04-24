const SUPABASE_URL = 'https://xeroztmtgwcfsnxjbvnz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0lOYgHY250KjDSE45BKiVA_t3GiUIBE';

function generateSlug(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { original_url, slug, name, campaign, platform, user_id } = req.body;

  if (!original_url) {
    return res.status(400).json({ error: 'URL de destino é obrigatória' });
  }

  // Valida URL
  try { new URL(original_url); }
  catch { return res.status(400).json({ error: 'URL inválida' }); }

  const finalSlug = slug?.trim() || generateSlug();

  // Verifica se slug já existe
  if (slug?.trim()) {
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/links?slug=eq.${encodeURIComponent(finalSlug)}&select=id`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const existing = await checkRes.json();
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Esse slug já está em uso. Escolha outro.' });
    }
  }

  // Insere no Supabase
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/links`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      slug: finalSlug,
      original_url,
      name: name || 'Sem nome',
      campaign: campaign || null,
      platform: platform || null,
      user_id: user_id || 'anonymous',
      active: true,
    }),
  });

  if (!insertRes.ok) {
    const err = await insertRes.json();
    return res.status(500).json({ error: 'Erro ao salvar link', detail: err });
  }

  const [link] = await insertRes.json();

  return res.status(201).json({
    id: link.id,
    slug: link.slug,
    short_url: `https://linkafi.vercel.app/${link.slug}`,
    original_url: link.original_url,
    created_at: link.created_at,
  });
}
