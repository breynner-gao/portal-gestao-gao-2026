import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const historyId = '2026-06-a-2026-11'
const bucket = 'waste-audit'
const snapshotHash = '8495d45e31eefe72971d08eab0474fda30d1cab57388b24943dfec6364cb3c01'
const keys = new Set(['workbook','indcom','june','july','october','indcomInvoice','bioInvoice','indcomFinance','bioFinance'])

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, {headers:cors})
  if (request.method !== 'POST') return new Response(null,{status:405,headers:cors})
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return new Response(null,{status:401,headers:cors})
  try {
    const {key} = await request.json()
    if (!keys.has(key)) return new Response(null,{status:404,headers:cors})
    const url = Deno.env.get('SUPABASE_URL')!
    const client = createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{
      global:{headers:{Authorization:authorization}},auth:{persistSession:false}
    })
    const {data: auth,error: authError} = await client.auth.getUser(authorization.slice(7))
    if (authError || !auth.user) return new Response(null,{status:401,headers:cors})
    const {data: history,error: historyError} = await client.from('waste_audit_history')
      .select('documents').eq('id',historyId).maybeSingle()
    if (historyError || !history?.documents?.[key]) return new Response(null,{status:403,headers:cors})

    const path = `historico/documentos/${historyId}/${key}`
    const storage = client.storage.from(bucket)
    const {data: saved} = await storage.download(path)
    if (saved) return new Response(saved,{headers:{...cors,'Content-Type':'application/octet-stream'}})

    // Migrate the requested attachment from the private legacy export only once.
    const {data: source,error: sourceError} = await storage.download(`historico/auditoria-${historyId}.html`)
    if (sourceError || !source) return new Response(null,{status:404,headers:cors})
    const bytes = await source.arrayBuffer()
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
    if (hash !== snapshotHash) return new Response(null,{status:409,headers:cors})
    const text = new TextDecoder().decode(bytes)
    const marker = `id="file-${key}">`
    const offset = text.indexOf(marker)
    const end = text.indexOf('</script>',offset+marker.length)
    if (offset < 0 || end < 0) return new Response(null,{status:404,headers:cors})
    const raw = atob(text.slice(offset+marker.length,end))
    const document = new Uint8Array(raw.length)
    for (let i=0;i<raw.length;i++) document[i]=raw.charCodeAt(i)
    const admin = createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
    const {error: uploadError} = await admin.storage.from(bucket).upload(path,document,{contentType:'application/octet-stream',upsert:false})
    if (uploadError && !/already exists/i.test(uploadError.message)) console.error('Falha ao migrar anexo:',key,uploadError.message)
    return new Response(document,{headers:{...cors,'Content-Type':'application/octet-stream'}})
  } catch (error) {
    console.error(error instanceof Error?error.message:'Falha ao baixar documento')
    return new Response(null,{status:500,headers:cors})
  }
})
