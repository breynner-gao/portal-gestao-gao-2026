import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// UUID compatível com IDs legados já existentes no PostgreSQL.
// O z.string().uuid() do Zod 4 exige bits RFC de versão/variant e rejeita,
// por exemplo, 00000000-0000-0000-0000-000000000001, embora o PostgreSQL
// aceite esse valor normalmente na coluna uuid.
const dbUuid = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  'UUID inválido',
)

const createSchema = z.object({
  action: z.literal('create'),
  input: z.object({
    username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/, 'Usuário inválido'),
    password: z.string().min(8).max(128),
    email: z.string().email(),
    fullName: z.string().trim().min(2).max(120),
    organizationId: dbUuid,

    // NOVO
    allUnits: z.boolean().optional().default(false),
    unitIds: z.array(dbUuid).optional().default([]),

    // Compatibilidade temporária com frontend antigo
    unitId: z.string().nullable().optional(),

    roleName: z.string().trim().min(2).max(80),
    roleId: dbUuid.optional(),

    // Pode ser enviado agora ou posteriormente
    permissions: z.array(
      z.object({
        code: z.string().min(1),
        allowed: z.boolean(),
      })
    ).optional().default([]),
  }).strict(),
}).strict()

const listSchema = z.object({
  action: z.literal('list'),
}).strict()

const updateMembershipSchema = z.object({
  action: z.literal('update-membership'),
  input: z.object({
    membershipId: dbUuid,
    organizationId: dbUuid,

    allUnits: z.boolean().optional().default(false),
    unitIds: z.array(dbUuid).optional().default([]),

    // Compatibilidade temporária
    unitId: z.string().nullable().optional(),

    roleName: z.string().trim().min(2).max(80),
    roleId: dbUuid.optional(),
    active: z.boolean(),

    permissions: z.array(
      z.object({
        code: z.string().min(1),
        allowed: z.boolean(),
      })
    ).optional(),
  }).strict(),
}).strict()

const deleteUserSchema = z.object({
  action: z.literal('delete-user'),
  input: z.object({
    membershipId: dbUuid,
  }).strict(),
}).strict()

const savePermissionsSchema = z.object({
  action: z.literal('save-permissions'),
  input: z.object({
    membershipId: dbUuid,
    permissions: z.array(
      z.object({
        code: z.string().min(1),
        allowed: z.boolean(),
      }).strict()
    ).max(300),
  }).strict(),
}).strict()

const requestSchema = z.discriminatedUnion('action', [
  createSchema,
  listSchema,
  updateMembershipSchema,
  savePermissionsSchema,
  deleteUserSchema,
])

type AdminClient = ReturnType<typeof createClient>

async function resolveRole(admin: AdminClient, actor: string, input: any) {
  if (!input.roleId) {
    if (input.roleName === 'Administrador Geral') throw new Error('Selecione um papel protegido válido.');
    throw new Error('Selecione um papel cadastrado na matriz de permissões.');
  }
  const {data: role, error} = await admin.from('access_roles').select('id,name,protected,organization_id,access_role_permissions(permission_code)').eq('id',input.roleId).eq('organization_id',input.organizationId).single();
  if (error || !role) throw new Error('Papel não localizado nesta organização.');
  if (role.protected) {
    const memberships = await actorMemberships(admin,actor);
    if (!memberships.some((m:any)=>m.organization_id===input.organizationId && m.active && m.role_name==='Administrador Geral')) throw new Error('Acesso não autorizado ao papel de administrador.');
  }
  const permissions=(role.access_role_permissions ?? []).map((p:any)=>({code:p.permission_code,allowed:true}));
  await validateActorCanGrantPermissions(admin,actor,input.organizationId,permissions);
  input.roleName=role.name;
  input.permissions=permissions;
}


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    return String((error as any).message)
  }

  return 'Erro inesperado.'
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return error
}

/* =========================================================
   USUÁRIO LOGADO
========================================================= */

async function callerId(req: Request, admin: AdminClient) {
  const authorization = req.headers.get('Authorization')

  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Sessão não informada.')
  }

  const token = authorization.substring(7)

  const { data, error } =
    await admin.auth.getUser(token)

  if (error || !data.user) {
    throw new Error('Sessão inválida.')
  }

  return data.user.id
}

/* =========================================================
   VÍNCULO
========================================================= */

async function getMembership(
  admin: AdminClient,
  membershipId: string,
) {
  const { data, error } = await admin
    .from('memberships')
    .select(`
      id,
      profile_id,
      organization_id,
      unit_id,
      role_name,
      access_role_id,
      active,
      all_units
    `)
    .eq('id', membershipId)
    .single()

  if (error || !data) {
    throw new Error('Vínculo não encontrado.')
  }

  return data
}

/* =========================================================
   PERMISSÕES DO USUÁRIO LOGADO
========================================================= */

async function actorMemberships(
  admin: AdminClient,
  profileId: string,
) {
  const { data, error } = await admin
    .from('memberships')
    .select(`
      id,
      organization_id,
      unit_id,
      role_name,
      active,
      all_units,
      member_permissions(
        permission_code,
        allowed
      ),
      membership_units(
        unit_id
      )
    `)
    .eq('profile_id', profileId)
    .eq('active', true)

  if (error) throw error

  return data ?? []
}

async function requirePermission(
  admin: AdminClient,
  actorProfileId: string,
  organizationId: string,
  permissionCode: string,
) {
  const memberships =
    await actorMemberships(admin, actorProfileId)

  const membership = memberships.find(
    (m: any) =>
      m.organization_id === organizationId &&
      m.active === true
  )

  if (!membership) {
    throw new Error('Acesso não autorizado à organização.')
  }

  // Administrador Geral continua sendo superperfil da organização.
  if (membership.role_name === 'Administrador Geral') {
    return membership
  }

  const allowed =
    (membership.member_permissions ?? []).some(
      (p: any) =>
        p.permission_code === permissionCode &&
        p.allowed === true
    )

  if (!allowed) {
    throw new Error('Acesso não autorizado.')
  }

  return membership
}

/* =========================================================
   UNIDADES
========================================================= */

function normalizeUnits(input: any) {
  let unitIds: string[] = Array.isArray(input.unitIds)
    ? input.unitIds.filter(Boolean)
    : []

  // Frontend antigo ainda pode mandar unitId.
  if (
    unitIds.length === 0 &&
    input.unitId
  ) {
    unitIds = [input.unitId]
  }

  unitIds = [...new Set(unitIds)]

  return {
    allUnits: Boolean(input.allUnits),
    unitIds,
  }
}

async function validateUnitsBelongToOrganization(
  admin: AdminClient,
  organizationId: string,
  unitIds: string[],
) {
  if (unitIds.length === 0) return

  const { data, error } = await admin
    .from('units')
    .select('id')
    .eq('organization_id', organizationId)
    .in('id', unitIds)

  if (error) throw error

  const found = new Set(
    (data ?? []).map((row: any) => row.id)
  )

  const invalid = unitIds.filter(
    id => !found.has(id)
  )

  if (invalid.length > 0) {
    throw new Error(
      'Uma ou mais unidades não pertencem à organização selecionada.'
    )
  }
}

async function validateActorCanGrantUnits(
  admin: AdminClient,
  actorProfileId: string,
  organizationId: string,
  targetAllUnits: boolean,
  targetUnitIds: string[],
) {
  const memberships =
    await actorMemberships(admin, actorProfileId)

  const actor = memberships.find(
    (m: any) =>
      m.organization_id === organizationId &&
      m.active === true
  )

  if (!actor) {
    throw new Error('Acesso não autorizado à organização.')
  }

  // Quem possui todas as unidades pode delegar qualquer unidade.
  if (actor.all_units === true) {
    return
  }

  // Quem não possui todas NÃO pode conceder "Todas".
  if (targetAllUnits) {
    throw new Error(
      'Você não possui alçada para conceder acesso a todas as unidades.'
    )
  }

  const actorUnits = new Set(
    (actor.membership_units ?? [])
      .map((row: any) => row.unit_id)
  )

  const unauthorized =
    targetUnitIds.filter(
      id => !actorUnits.has(id)
    )

  if (unauthorized.length > 0) {
    throw new Error(
      'Você tentou conceder acesso a uma unidade fora da sua alçada.'
    )
  }
}

async function replaceMembershipUnits(
  admin: AdminClient,
  membershipId: string,
  allUnits: boolean,
  unitIds: string[],
) {
  const { error: deleteError } = await admin
    .from('membership_units')
    .delete()
    .eq('membership_id', membershipId)

  if (deleteError) throw deleteError

  if (allUnits || unitIds.length === 0) {
    return
  }

  const rows = unitIds.map(unitId => ({
    membership_id: membershipId,
    unit_id: unitId,
  }))

  const { error } = await admin
    .from('membership_units')
    .upsert(rows, {
      onConflict: 'membership_id,unit_id',
    })

  if (error) throw error
}

/* =========================================================
   PERMISSÕES
========================================================= */

async function actorPermissionCodes(
  admin: AdminClient,
  actorProfileId: string,
  organizationId: string,
) {
  const memberships =
    await actorMemberships(admin, actorProfileId)

  const actor = memberships.find(
    (m: any) =>
      m.organization_id === organizationId &&
      m.active === true
  )

  if (!actor) {
    throw new Error('Acesso não autorizado.')
  }

  if (actor.role_name === 'Administrador Geral') {
    return null
  }

  return new Set(
    (actor.member_permissions ?? [])
      .filter((p: any) => p.allowed === true)
      .map((p: any) => p.permission_code)
  )
}

async function validateActorCanGrantPermissions(
  admin: AdminClient,
  actorProfileId: string,
  organizationId: string,
  permissions: Array<{
    code: string
    allowed: boolean
  }>,
) {
  const actorPermissions =
    await actorPermissionCodes(
      admin,
      actorProfileId,
      organizationId,
    )

  // Administrador Geral
  if (actorPermissions === null) return

  const requested =
    permissions
      .filter(p => p.allowed)
      .map(p => p.code)

  const invalid =
    requested.filter(
      code => !actorPermissions.has(code)
    )

  if (invalid.length > 0) {
    throw new Error(
      'Você tentou conceder uma permissão fora da sua alçada.'
    )
  }
}

async function replacePermissions(
  admin: AdminClient,
  membershipId: string,
  permissions: Array<{
    code: string
    allowed: boolean
  }>,
) {
  // Normaliza e elimina duplicidades antes de tocar no banco.
  const normalized = new Map<string, boolean>()
  for (const permission of permissions) {
    const code = String(permission?.code ?? '').trim()
    if (!code) continue
    normalized.set(code, permission.allowed === true)
  }

  const activeCodes = [...normalized.entries()]
    .filter(([, allowed]) => allowed)
    .map(([code]) => code)

  const inactiveCodes = [...normalized.entries()]
    .filter(([, allowed]) => !allowed)
    .map(([code]) => code)

  // IMPORTANTE: grava primeiro as permissões ativas.
  // Assim, uma falha de INSERT/UPSERT nunca deixa o usuário sem todas as alçadas.
  if (activeCodes.length > 0) {
    const rows = activeCodes.map(code => ({
      membership_id: membershipId,
      permission_code: code,
      allowed: true,
    }))

    const { error: upsertError } = await admin
      .from('member_permissions')
      .upsert(rows, {
        onConflict: 'membership_id,permission_code',
      })

    if (upsertError) {
      throw new Error(
        `Falha ao gravar permissões: ${upsertError.message}`
      )
    }
  }

  // Remove somente o que veio explicitamente desmarcado.
  if (inactiveCodes.length > 0) {
    const { error: deleteInactiveError } = await admin
      .from('member_permissions')
      .delete()
      .eq('membership_id', membershipId)
      .in('permission_code', inactiveCodes)

    if (deleteInactiveError) {
      throw new Error(
        `Falha ao remover permissões desmarcadas: ${deleteInactiveError.message}`
      )
    }
  }

  // Confere o resultado efetivamente persistido.
  const { data: persisted, error: verifyError } = await admin
    .from('member_permissions')
    .select('permission_code, allowed')
    .eq('membership_id', membershipId)
    .eq('allowed', true)

  if (verifyError) {
    throw new Error(
      `Permissões gravadas, mas não foi possível confirmar: ${verifyError.message}`
    )
  }

  const persistedSet = new Set(
    (persisted ?? []).map((p: any) => p.permission_code)
  )
  const missing = activeCodes.filter(code => !persistedSet.has(code))

  if (missing.length > 0) {
    throw new Error(
      `Permissões não confirmadas no banco: ${missing.join(', ')}`
    )
  }
}

/* =========================================================
   AUDITORIA
========================================================= */

async function audit(
  admin: AdminClient,
  actorProfileId: string,
  organizationId: string,
  entity: string,
  entityId: string,
  action: string,
  afterData: unknown,
  correlationId: string,
) {
  const { error } = await admin
    .from('audit_events')
    .insert({
      actor_profile_id: actorProfileId,
      organization_id: organizationId,
      module: 'administracao',
      entity,
      entity_id: entityId,
      action,
      after_data: afterData,
      source: 'portal',
      correlation_id: correlationId,
    })

  // Auditoria não pode derrubar uma operação principal já concluída.
  // Se o registro de auditoria falhar, preservamos o usuário/vínculo criado
  // e registramos o problema apenas no log da Edge Function.
  if (error) {
    console.error(JSON.stringify({
      correlationId,
      stage: 'audit',
      auditError: error,
      entity,
      entityId,
      action,
    }))
  }
}

/* =========================================================
   EDGE FUNCTION
========================================================= */

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return json(
      { error: 'Método não permitido.' },
      405
    )
  }

  const correlationId =
    crypto.randomUUID()

  try {
    const supabaseUrl =
      Deno.env.get('SUPABASE_URL')

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Configuração do servidor indisponível.'
      )
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    const actorProfileId =
      await callerId(req, admin)

    let body: unknown

    try {
      body = await req.json()
    } catch {
      return json(
        {
          error: 'Corpo da solicitação inválido.',
          correlationId,
        },
        400
      )
    }

    const parsed =
      requestSchema.safeParse(body)

    if (!parsed.success) {
      console.error(JSON.stringify({
        correlationId,
        stage: 'validation',
        receivedBody: body,
        issues: parsed.error.issues,
        error: parsed.error.flatten(),
      }))

      return json(
        {
          error: 'Solicitação inválida.',
          details: parsed.error.flatten(),
          correlationId,
        },
        400
      )
    }

    /* =====================================================
       LIST
    ===================================================== */

    if (parsed.data.action === 'list') {
      const actor =
        await actorMemberships(
          admin,
          actorProfileId
        )

      const allowedOrganizations =
        actor
          .filter((m: any) => {
            if (m.role_name === 'Administrador Geral') {
              return true
            }

            return (
              m.member_permissions ?? []
            ).some(
              (p: any) =>
                (
                  p.permission_code === 'admin.users.view' ||
                  p.permission_code === 'admin.users.manage'
                ) &&
                p.allowed === true
            )
          })
          .map(
            (m: any) => m.organization_id
          )

      if (allowedOrganizations.length === 0) {
        throw new Error('Acesso não autorizado.')
      }

      const {
        data: memberships,
        error,
      } = await admin
        .from('memberships')
        .select(`
          id,
          profile_id,
          organization_id,
          unit_id,
          role_name,
          active,
          all_units,

          profiles(
            full_name,
            username,
            email,
            active
          ),

          organizations(
            name
          ),

          membership_units(
            unit_id,
            units(
              id,
              name
            )
          ),

          member_permissions(
            permission_code,
            allowed
          )
        `)
        .in(
          'organization_id',
          allowedOrganizations
        )
        .order(
          'created_at',
          { ascending: false }
        )

      if (error) throw error

      const {
        data: authUsers,
        error: authError,
      } =
        await admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        })

      if (authError) throw authError

      const emailMap = new Map(
        authUsers.users.map(user => [
          user.id,
          user.email ?? '',
        ])
      )

      const result =
        (memberships ?? []).map(
          (membership: any) => {
            const profile =
              Array.isArray(membership.profiles)
                ? membership.profiles[0]
                : membership.profiles

            const organization =
              Array.isArray(membership.organizations)
                ? membership.organizations[0]
                : membership.organizations

            const unitLinks =
              membership.membership_units ?? []

            const units =
              unitLinks.map((link: any) => {
                const unit =
                  Array.isArray(link.units)
                    ? link.units[0]
                    : link.units

                return {
                  id: link.unit_id,
                  name: unit?.name ?? '',
                }
              })

            const permissions =
              (
                membership.member_permissions ?? []
              )
                .filter(
                  (p: any) =>
                    p.allowed === true
                )
                .map(
                  (p: any) =>
                    p.permission_code
                )

            return {
              id: membership.profile_id,
              membershipId: membership.id,

              username:
                profile?.username ?? '',

              email:
                profile?.email ??
                emailMap.get(
                  membership.profile_id
                ) ?? '',

              fullName:
                profile?.full_name ?? '',

              active:
                Boolean(
                  profile?.active &&
                  membership.active
                ),

              organizationId:
                membership.organization_id,

              organizationName:
                organization?.name ?? '',

              roleName:
                membership.role_name,

              allUnits:
                membership.all_units === true,

              unitIds:
                units.map(
                  (u: any) => u.id
                ),

              units,

              permissions,
            }
          }
        )

      return json(result)
    }

    /* =====================================================
       CREATE
    ===================================================== */

    if (parsed.data.action === 'create') {
      const input = parsed.data.input
      await resolveRole(admin, actorProfileId, input)

      await requirePermission(
        admin,
        actorProfileId,
        input.organizationId,
        'admin.users.manage',
      )

      const {
        allUnits,
        unitIds,
      } = normalizeUnits(input)

      if (
        !allUnits &&
        unitIds.length === 0
      ) {
        throw new Error(
          'Selecione pelo menos uma unidade ou marque Todas as unidades.'
        )
      }

      await validateUnitsBelongToOrganization(
        admin,
        input.organizationId,
        unitIds,
      )

      await validateActorCanGrantUnits(
        admin,
        actorProfileId,
        input.organizationId,
        allUnits,
        unitIds,
      )

      await validateActorCanGrantPermissions(
        admin,
        actorProfileId,
        input.organizationId,
        input.permissions,
      )

      const email =
        input.email
          .trim()
          .toLowerCase()

      const username =
        input.username
          .trim()
          .toLowerCase()

      const authEmail =
        email

      const {
        data: existing,
        error: listError,
      } =
        await admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        })

      if (listError) throw listError

      if (
        existing.users.some(
          user =>
            user.email
              ?.trim()
              .toLowerCase() === email
        )
      ) {
        throw new Error(
          'Já existe um usuário cadastrado com este e-mail.'
        )
      }

      const { data: duplicateProfiles, error: duplicateProfileError } =
        await admin
          .from('profiles')
          .select('id, username, email')
          .or(`username.ilike.${username},email.ilike.${email}`)
          .limit(10)

      if (duplicateProfileError) throw duplicateProfileError

      if ((duplicateProfiles ?? []).some((p: any) =>
        String(p.username ?? '').toLowerCase() === username
      )) {
        throw new Error('Este nome de usuário já está em uso.')
      }

      if ((duplicateProfiles ?? []).some((p: any) =>
        String(p.email ?? '').toLowerCase() === email
      )) {
        throw new Error('Já existe um usuário cadastrado com este e-mail.')
      }

      const {
        data: created,
        error: createError,
      } =
        await admin.auth.admin.createUser({
          email: authEmail,
          password: input.password,
          email_confirm: true,
          user_metadata: {
            username,
            contact_email: email,
            full_name: input.fullName.trim(),
          },
        })

      if (
        createError ||
        !created.user
      ) {
        throw (
          createError ??
          new Error(
            'Não foi possível criar o usuário.'
          )
        )
      }

      const newUserId =
        created.user.id

      try {
        const {
          error: profileError,
        } = await admin
          .from('profiles')
          .upsert(
            {
              id: newUserId,
              full_name:
                input.fullName.trim(),
              username,
              email,
              active: true,
            },
            {
              onConflict: 'id',
            }
          )

        if (profileError) {
          throw profileError
        }

        /*
         * unit_id legado:
         * - todas = null
         * - unidades específicas = primeira unidade
         *
         * Isso mantém partes antigas do portal funcionando
         * enquanto migramos tudo para membership_units.
         */
        const legacyUnitId =
          allUnits
            ? null
            : unitIds[0] ?? null

        const {
          data: membership,
          error: membershipError,
        } = await admin
          .from('memberships')
          .insert({
            profile_id: newUserId,
            organization_id:
              input.organizationId,
            unit_id: legacyUnitId,
            role_name: input.roleName,
            access_role_id: input.roleId,
            active: true,
            all_units: allUnits,
          })
          .select('id')
          .single()

        if (
          membershipError ||
          !membership
        ) {
          throw (
            membershipError ??
            new Error(
              'Não foi possível criar o vínculo.'
            )
          )
        }

        await replaceMembershipUnits(
          admin,
          membership.id,
          allUnits,
          unitIds,
        )

        if (
          !input.roleId && input.permissions.length > 0
        ) {
          await replacePermissions(
            admin,
            membership.id,
            input.permissions,
          )
        }

        await audit(
          admin,
          actorProfileId,
          input.organizationId,
          'usuario',
          newUserId,
          'criar',
          {
            email,
            fullName: input.fullName,
            membershipId: membership.id,
            roleName: input.roleName,
            allUnits,
            unitIds,
            permissions:
              input.permissions
                .filter(p => p.allowed)
                .map(p => p.code),
          },
          correlationId,
        )
      } catch (error) {
        try {
          await admin.auth.admin.deleteUser(
            newUserId
          )
        } catch (rollbackError) {
          console.error(JSON.stringify({
            correlationId,
            stage: 'rollback',
            error:
              errorDetails(
                rollbackError
              ),
          }))
        }

        throw error
      }

      return json({
        success: true,
        id: newUserId,
        message:
          'Usuário criado com sucesso.',
        correlationId,
      }, 200)
    }

    /* =====================================================
       DELETE USER
    ===================================================== */

    if (parsed.data.action === 'delete-user') {
      const input = parsed.data.input
      const membership = await getMembership(admin, input.membershipId)

      await requirePermission(
        admin,
        actorProfileId,
        membership.organization_id,
        'admin.users.manage',
      )

      if (membership.profile_id === actorProfileId) {
        throw new Error('Você não pode excluir o próprio usuário enquanto está logado.')
      }

      const { data: profileMemberships, error: profileMembershipsError } = await admin
        .from('memberships')
        .select('id')
        .eq('profile_id', membership.profile_id)

      if (profileMembershipsError) throw profileMembershipsError

      // Remove somente o vínculo solicitado. As tabelas filhas usam ON DELETE CASCADE.
      const { error: membershipDeleteError } = await admin
        .from('memberships')
        .delete()
        .eq('id', input.membershipId)

      if (membershipDeleteError) throw membershipDeleteError

      // Se este era o último vínculo do perfil, remove também Auth + profile.
      if ((profileMemberships ?? []).length <= 1) {
        const { error: authDeleteError } =
          await admin.auth.admin.deleteUser(membership.profile_id)

        if (authDeleteError) {
          console.error(JSON.stringify({
            correlationId,
            stage: 'delete-auth-user',
            error: authDeleteError,
            profileId: membership.profile_id,
          }))
          throw authDeleteError
        }

        // Caso profiles não seja removido por cascade do Auth, tentamos limpar.
        const { error: profileDeleteError } = await admin
          .from('profiles')
          .delete()
          .eq('id', membership.profile_id)

        if (profileDeleteError) {
          console.error(JSON.stringify({
            correlationId,
            stage: 'delete-profile',
            error: profileDeleteError,
            profileId: membership.profile_id,
          }))
        }
      }

      return json({
        success: true,
        message: 'Usuário excluído com sucesso.',
        correlationId,
      }, 200)
    }

    /* =====================================================
       UPDATE MEMBERSHIP
    ===================================================== */

    if (
      parsed.data.action ===
      'update-membership'
    ) {
      const input = parsed.data.input
      await resolveRole(admin, actorProfileId, input)

      const current =
        await getMembership(
          admin,
          input.membershipId
        )

      await requirePermission(
        admin,
        actorProfileId,
        current.organization_id,
        'admin.users.manage',
      )

      await requirePermission(
        admin,
        actorProfileId,
        input.organizationId,
        'admin.users.manage',
      )

      const {
        allUnits,
        unitIds,
      } = normalizeUnits(input)

      if (
        !allUnits &&
        unitIds.length === 0
      ) {
        throw new Error(
          'Selecione pelo menos uma unidade ou marque Todas as unidades.'
        )
      }

      await validateUnitsBelongToOrganization(
        admin,
        input.organizationId,
        unitIds,
      )

      await validateActorCanGrantUnits(
        admin,
        actorProfileId,
        input.organizationId,
        allUnits,
        unitIds,
      )

      if (input.permissions) {
        await validateActorCanGrantPermissions(
          admin,
          actorProfileId,
          input.organizationId,
          input.permissions,
        )
      }

      const legacyUnitId =
        allUnits
          ? null
          : unitIds[0] ?? null

      const { error } = await admin
        .from('memberships')
        .update({
          organization_id:
            input.organizationId,
          unit_id: legacyUnitId,
          role_name:
            input.roleName,
          access_role_id: input.roleId,
          active:
            input.active,
          all_units:
            allUnits,
        })
        .eq(
          'id',
          input.membershipId
        )

      if (error) throw error

      await replaceMembershipUnits(
        admin,
        input.membershipId,
        allUnits,
        unitIds,
      )

      if (!input.roleId && input.permissions) {
        await replacePermissions(
          admin,
          input.membershipId,
          input.permissions,
        )
      }

      await audit(
        admin,
        actorProfileId,
        input.organizationId,
        'vinculo',
        input.membershipId,
        'atualizar',
        {
          roleName:
            input.roleName,
          active:
            input.active,
          allUnits,
          unitIds,
          permissions:
            input.permissions
              ?.filter(p => p.allowed)
              .map(p => p.code),
        },
        correlationId,
      )

      return json({
        success: true,
        message:
          'Usuário atualizado com sucesso.',
      })
    }

    /* =====================================================
       SAVE PERMISSIONS
    ===================================================== */

    if (
      parsed.data.action ===
      'save-permissions'
    ) {
      const input = parsed.data.input

      const membership =
        await getMembership(
          admin,
          input.membershipId
        )

      await requirePermission(
        admin,
        actorProfileId,
        membership.organization_id,
        'admin.permissions.manage',
      )

      await validateActorCanGrantPermissions(
        admin,
        actorProfileId,
        membership.organization_id,
        input.permissions,
      )

      if (membership.access_role_id || membership.role_name === 'Administrador Geral') throw new Error('Edite as permissões na matriz do papel.');
      await replacePermissions(
        admin,
        input.membershipId,
        input.permissions,
      )

      await audit(
        admin,
        actorProfileId,
        membership.organization_id,
        'permissoes',
        input.membershipId,
        'atualizar',
        {
          permissions:
            input.permissions
              .filter(p => p.allowed)
              .map(p => p.code),
        },
        correlationId,
      )

      return json({
        success: true,
        message:
          'Alçadas atualizadas com sucesso.',
      })
    }

    return json(
      {
        error: 'Ação inválida.',
        correlationId,
      },
      400
    )
  } catch (error) {
    const message =
      errorMessage(error)

    console.error(JSON.stringify({
      correlationId,
      error:
        errorDetails(error),
    }))

    let status = 500

    if (
      message.includes(
        'Acesso não autorizado'
      ) ||
      message.includes(
        'fora da sua alçada'
      ) ||
      message.includes('Sessão')
    ) {
      status = 403
    }

    if (
      message.includes(
        'Já existe um usuário'
      )
    ) {
      status = 409
    }

    return json(
      {
        success: false,
        error: message,
        correlationId,
      },
      status
    )
  }
})
