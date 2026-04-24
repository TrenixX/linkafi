const SUPABASE_URL = 'https://xeroztmtgwcfsnxjbvnz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0lOYgHY250KjDSE45BKiVA_t3GiUIBE';

function detectDevice(ua) {
  if (!ua) return 'desconhecido';
  if (/mobile|android|iphone|ipad/i.test(ua)) return 'mobile';
  if (/tablet/i.test(ua)) return 'tablet';
  return 'desktop';
}

function detectReferrer(ref) {
  if (!ref) return 'direto';
  if (/instagram/i.test(ref)) return 'Instagram';
  if (/whatsapp/i.test(ref)) return 'WhatsApp';
  if (/youtube|youtu\.be/i.test(ref)) return 'YouTube';
  if (/facebook/i.test(ref)) return 'Facebook';
  if (/google/i.test(ref)) return 'Google';
  if (/twitter|t\.co/i.test(ref)) return 'Twitter';
  if (/tiktok/i.test(ref)) return 'TikTok';
  try { return new URL(ref).hostname; }
  catch { return 'outro'; }
}

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) return res.status(400).send('Slug não informado');

  // Busca o link no Supabase
  const linkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/links?slug=eq.${encodeURIComponent(slug)}&active=eq.true&select=id,original_url&limit=1`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );

  const links = await linkRes.json();

  if (!links || links.length === 0) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8"/>
        <title>LinkAfi — Link não encontrado</title>
        <style>
          body { font-family: sans-serif; background: #0a0d14; color: #e2e8f0;
                 display: flex; align-items: center; justify-content: center;
                 min-height: 100vh; flex-direction: column; gap: 1rem; }
          h1 { font-size: 2rem; }
          p { color: #64748b; }
          a { color: #00e5ff; }
        </style>
      </head>
      <body>
        <h1>🔗 Link não encontrado</h1>
        <p>Este link não existe ou foi desativado.</p>
        <a href="https://linkafi.vercel.app">← Voltar ao LinkAfi</a>
      </body>
      </html>
    `);
  }

  const { id: link_id, original_url } = links[0];

  // Registra o clique de forma assíncrona (não bloqueia o redirecionamento)
  const ua = req.headers['user-agent'] || '';
  const referrer = req.headers['referer'] || req.headers['referrer'] || '';

  fetch(`${SUPABASE_URL}/rest/v1/clicks`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      link_id,
      device: detectDevice(ua),
      referrer: detectReferrer(referrer),
      country: req.headers['x-vercel-ip-country'] || null,
    }),
  }).catch(() => {}); // silencia erros de registro

  // Redireciona imediatamente
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, original_url);
}
