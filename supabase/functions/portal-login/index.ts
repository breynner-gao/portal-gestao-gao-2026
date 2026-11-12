const allowedOrigin = 'https://portal-sgq-gao.pages.dev';
const api = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const headers = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
  Vary: 'Origin',
};
function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers });
}
const invalid = () => reply(401, { message: 'Usuário ou senha inválidos.' });

Deno.serve(async request => {
  if (request.headers.get('origin') !== allowedOrigin) return reply(403, { message: 'Origem inválida.' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { message: 'Método inválido.' });
  try {
    const raw = await request.text();
    if (raw.length > 4096) return invalid();
    const { username, password } = JSON.parse(raw);
    if (typeof username !== 'string' || typeof password !== 'string' || !password || password.length > 1024) return invalid();
    const login = username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(login)) return invalid();

    // Only the backend resolves the username. The password grant still goes through Supabase Auth.
    const query = new URLSearchParams({ select: 'id', username: 'ilike.' + login.replaceAll('_', '\\_'), active: 'eq.true', limit: '2' });
    const lookup = await fetch(api + '/rest/v1/profiles?' + query, {
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey },
    });
    if (!lookup.ok) return reply(503, { message: 'Login indisponível no momento.' });
    const profiles = await lookup.json();
    if (profiles.length !== 1) return invalid();

    const account = await fetch(api + '/auth/v1/admin/users/' + profiles[0].id, {
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey },
    });
    if (account.status === 404) return invalid();
    if (!account.ok) return reply(503, { message: 'Login indisponível no momento.' });
    const { email } = await account.json();
    if (!email) return invalid();

    const auth = await fetch(api + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: publicKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (auth.status === 429) return reply(429, { message: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
    if (auth.status >= 500) return reply(503, { message: 'Login indisponível no momento.' });
    return auth.ok ? reply(200, await auth.json()) : invalid();
  } catch {
    return invalid();
  }
});
