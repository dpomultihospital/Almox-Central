import crypto from 'node:crypto';
import { db } from './db.ts';
import type { Request, Response, NextFunction } from 'express';

export interface UserSession {
  id: number;
  codigo?: string | null;
  nome: string;
  login: string;
  cpf?: string | null;
  email?: string | null;
  perfil: 'admin' | 'almoxarife' | 'requisitante';
  centro_custo_id: number | null;
  centro_custo_nome?: string;
  centro_custo_codigo?: string;
  empresa_id?: number | null;
  empresa_nome?: string;
  ativo: number;
  ultimo_acesso?: string | null;
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function getUserById(id: number): UserSession | null {
  try {
    const row = db.prepare(`
      SELECT u.id, u.codigo, u.nome, u.login, u.cpf, u.email, u.perfil, 
             u.centro_custo_id, u.empresa_id, u.ativo, u.ultimo_acesso,
             cc.nome as centro_custo_nome, cc.codigo as centro_custo_codigo,
             eu.nome as empresa_nome
      FROM usuarios u
      LEFT JOIN centros_custo cc ON u.centro_custo_id = cc.id
      LEFT JOIN empresas_unidades eu ON u.empresa_id = eu.id
      WHERE u.id = ? AND u.ativo = 1
    `).get(id) as any;

    return row || null;
  } catch (e) {
    // Fallback if empresas_unidades not yet present
    const row = db.prepare(`
      SELECT u.id, u.nome, u.login, u.perfil, u.centro_custo_id, u.ativo,
             cc.nome as centro_custo_nome, cc.codigo as centro_custo_codigo
      FROM usuarios u
      LEFT JOIN centros_custo cc ON u.centro_custo_id = cc.id
      WHERE u.id = ? AND u.ativo = 1
    `).get(id) as any;
    return row || null;
  }
}

export function getUserByLogin(login: string): (UserSession & { senha_hash: string }) | null {
  try {
    const row = db.prepare(`
      SELECT u.id, u.codigo, u.nome, u.login, u.senha_hash, u.cpf, u.email, u.perfil, 
             u.centro_custo_id, u.empresa_id, u.ativo, u.ultimo_acesso,
             cc.nome as centro_custo_nome, cc.codigo as centro_custo_codigo,
             eu.nome as empresa_nome
      FROM usuarios u
      LEFT JOIN centros_custo cc ON u.centro_custo_id = cc.id
      LEFT JOIN empresas_unidades eu ON u.empresa_id = eu.id
      WHERE u.login = ? AND u.ativo = 1
    `).get(login) as any;

    return row || null;
  } catch (e) {
    const row = db.prepare(`
      SELECT u.id, u.nome, u.login, u.senha_hash, u.perfil, u.centro_custo_id, u.ativo,
             cc.nome as centro_custo_nome, cc.codigo as centro_custo_codigo
      FROM usuarios u
      LEFT JOIN centros_custo cc ON u.centro_custo_id = cc.id
      WHERE u.login = ? AND u.ativo = 1
    `).get(login) as any;
    return row || null;
  }
}

// Map simples de sessões em memória + token assinado stateless para ambientes Serverless (Vercel)
const activeSessions = new Map<string, number>();
const SESSION_SECRET = process.env.SESSION_SECRET || 'almoxcontrol-salutem-session-secret-key';

function signUserToken(userId: number): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex').slice(0, 32);
  return `st.${payload}.${sig}`;
}

function verifySignedToken(token: string): number | null {
  if (!token.startsWith('st.')) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [, uidStr, tsStr, sig] = parts;
  const payload = `${uidStr}.${tsStr}`;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex').slice(0, 32);
  if (sig !== expectedSig) return null;
  const uid = parseInt(uidStr, 10);
  return Number.isNaN(uid) ? null : uid;
}

export function createSession(userId: number): string {
  const token = signUserToken(userId);
  activeSessions.set(token, userId);
  return token;
}

export function getSessionUser(token: string): UserSession | null {
  const mappedUserId = activeSessions.get(token);
  if (mappedUserId) return getUserById(mappedUserId);

  const statelessUserId = verifySignedToken(token);
  if (statelessUserId) return getUserById(statelessUserId);

  return null;
}

export function authenticateRequest(req: Request): UserSession | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const sessionUser = getSessionUser(token);
  if (sessionUser) return sessionUser;

  // Se o token for o próprio ID de usuário numérico (ex: "user:2")
  if (token.startsWith('user:')) {
    const uid = parseInt(token.replace('user:', ''), 10);
    return getUserById(uid);
  }

  return null;
}

export function requireRole(allowedRoles: Array<'admin' | 'almoxarife' | 'requisitante'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Não autenticado' });
      return;
    }

    if (!allowedRoles.includes(user.perfil)) {
      res.status(403).json({ 
        error: `Acesso negado. Ação restrita a perfis: ${allowedRoles.join(', ')}. Seu perfil: ${user.perfil}` 
      });
      return;
    }

    (req as any).user = user;
    next();
  };
}
