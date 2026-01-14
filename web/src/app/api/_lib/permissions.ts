import { getSupabaseAdmin } from './supabaseAdmin'
import { requireUser, AuthedUser } from './auth'

export type Permission = 'criar_prompts' | 'cadastrar_candidatos' | 'criar_editar_vagas'

export type UserPermissions = {
  criar_prompts: boolean
  cadastrar_candidatos: boolean
  criar_editar_vagas: boolean
}

export type UserWithPermissions = AuthedUser & {
  is_admin: boolean
  permissions: UserPermissions
}

/**
 * Busca as permissões do usuário autenticado
 */
export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  const admin = getSupabaseAdmin()
  
  const { data, error } = await admin
    .from('user_permissions')
    .select('criar_prompts, cadastrar_candidatos, criar_editar_vagas')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    // Se não tem registro de permissões, retorna tudo false
    return {
      criar_prompts: false,
      cadastrar_candidatos: false,
      criar_editar_vagas: false
    }
  }

  return {
    criar_prompts: data.criar_prompts ?? false,
    cadastrar_candidatos: data.cadastrar_candidatos ?? false,
    criar_editar_vagas: data.criar_editar_vagas ?? false
  }
}

/**
 * Verifica se o usuário é admin da empresa
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  
  try {
    // Primeiro tenta buscar com is_admin
    let query = admin
      .from('users')
      .select('is_admin, role')
      .eq('id', userId)
    
    const { data, error } = await query.maybeSingle()

    if (error) {
      // Se a coluna is_admin não existir, tenta apenas com role
      if (error.message?.includes('column') && error.message?.includes('is_admin')) {
        console.log('[isUserAdmin] Coluna is_admin não existe, verificando apenas role')
        const { data: userData, error: roleError } = await admin
          .from('users')
          .select('role')
          .eq('id', userId)
          .maybeSingle()
        
        if (roleError || !userData) {
          console.error('[isUserAdmin] Erro ao buscar role:', roleError)
          return false
        }
        
        const result = userData.role === 'admin'
        console.log('[isUserAdmin] Verificação (sem is_admin):', { userId, role: userData.role, result })
        return result
      }
      
      console.error('[isUserAdmin] Erro ao buscar usuário:', error)
      return false
    }

    if (!data) {
      console.log('[isUserAdmin] Usuário não encontrado:', userId)
      return false
    }

    // Considera admin se is_admin = true OU role = 'admin'
    const result = data.is_admin === true || data.role === 'admin'
    console.log('[isUserAdmin] Verificação:', { userId, is_admin: data.is_admin, role: data.role, result })
    return result
  } catch (err: any) {
    console.error('[isUserAdmin] Erro inesperado:', err)
    // Em caso de erro, tenta verificar apenas role como fallback
    try {
      const { data: userData } = await admin
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle()
      return userData?.role === 'admin' || false
    } catch {
      return false
    }
  }
}

/**
 * Retorna o usuário autenticado com suas permissões
 */
export async function requireUserWithPermissions(): Promise<UserWithPermissions> {
  const user = await requireUser()
  const isAdmin = await isUserAdmin(user.id)
  
  // Admins têm todas as permissões
  if (isAdmin) {
    return {
      ...user,
      is_admin: true,
      permissions: {
        criar_prompts: true,
        cadastrar_candidatos: true,
        criar_editar_vagas: true
      }
    }
  }

  const permissions = await getUserPermissions(user.id)
  
  return {
    ...user,
    is_admin: false,
    permissions
  }
}

/**
 * Verifica se o usuário tem uma permissão específica
 * Admins sempre têm permissão
 */
export async function requirePermission(permission: Permission): Promise<UserWithPermissions> {
  const user = await requireUserWithPermissions()
  
  if (user.is_admin) {
    return user
  }

  if (!user.permissions[permission]) {
    throw new Error(`permission_denied:${permission}`)
  }

  return user
}

/**
 * Verifica se o usuário tem ALGUMA das permissões listadas
 */
export async function requireAnyPermission(permissions: Permission[]): Promise<UserWithPermissions> {
  const user = await requireUserWithPermissions()
  
  if (user.is_admin) {
    return user
  }

  const hasAny = permissions.some(p => user.permissions[p])
  
  if (!hasAny) {
    throw new Error(`permission_denied:${permissions.join(',')}`)
  }

  return user
}

/**
 * Atualiza as permissões de um usuário
 * Apenas admins podem fazer isso
 */
export async function updateUserPermissions(
  targetUserId: string,
  permissions: Partial<UserPermissions>,
  requestingUserId: string
): Promise<void> {
  const admin = getSupabaseAdmin()

  // Verificar se quem está fazendo a request é admin
  const isAdmin = await isUserAdmin(requestingUserId)
  if (!isAdmin) {
    throw new Error('Apenas administradores podem alterar permissões')
  }

  // Verificar se o usuário alvo existe e é da mesma empresa
  const { data: requestingUser } = await admin
    .from('users')
    .select('company_id')
    .eq('id', requestingUserId)
    .single()

  const { data: targetUser } = await admin
    .from('users')
    .select('company_id')
    .eq('id', targetUserId)
    .single()

  if (!requestingUser || !targetUser) {
    throw new Error('Usuário não encontrado')
  }

  if (requestingUser.company_id !== targetUser.company_id) {
    throw new Error('Você só pode gerenciar usuários da sua empresa')
  }

  // Upsert das permissões
  const { error } = await admin
    .from('user_permissions')
    .upsert({
      user_id: targetUserId,
      ...permissions
    }, {
      onConflict: 'user_id'
    })

  if (error) {
    throw new Error(`Erro ao atualizar permissões: ${error.message}`)
  }
}

