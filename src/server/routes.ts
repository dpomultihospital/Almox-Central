import { Router } from 'express';
import { db, runInTransaction, resetDatabase, updateOverdueLoans } from './db.ts';
import { 
  authenticateRequest, 
  getUserById, 
  getUserByLogin, 
  hashPassword, 
  createSession 
} from './auth.ts';
import fs from 'node:fs';
import path from 'node:path';

export const apiRouter = Router();

// ============================================================================
// 1. EMPRESAS / UNIDADES DE ALMOXARIFADO (PADRÃO SALUTEM)
// ============================================================================

apiRouter.get('/empresas-unidades', (_req, res) => {
  try {
    const list = db.prepare('SELECT * FROM empresas_unidades ORDER BY codigo ASC').all();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao listar unidades: ' + err.message });
  }
});

apiRouter.post('/empresas-unidades', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || user.perfil !== 'admin') {
    res.status(403).json({ error: 'Apenas Administradores podem cadastrar unidades' });
    return;
  }

  const { codigo, nome, cnpj, endereco, cidade, uf } = req.body;
  if (!codigo || !nome) {
    res.status(400).json({ error: 'Código e nome da unidade são obrigatórios' });
    return;
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO empresas_unidades (codigo, nome, cnpj, endereco, cidade, uf, ativo)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    const info = stmt.run(
      codigo.trim().toUpperCase(),
      nome.trim(),
      cnpj ? cnpj.trim() : null,
      endereco ? endereco.trim() : null,
      cidade ? cidade.trim() : null,
      uf ? uf.trim().toUpperCase() : null
    );
    const novo = db.prepare('SELECT * FROM empresas_unidades WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(novo);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'Já existe uma unidade com este código' });
      return;
    }
    res.status(500).json({ error: 'Erro ao cadastrar unidade: ' + err.message });
  }
});

// ============================================================================
// 2. AUTENTICAÇÃO E SESSÃO
// ============================================================================

apiRouter.get('/auth/me', (req, res) => {
  const user = authenticateRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }
  const dbUser = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(user.id) as { senha_hash: string } | undefined;
  const usando_senha_padrao = dbUser ? (dbUser.senha_hash === hashPassword('admin123')) : false;
  res.json({ user: { ...user, usando_senha_padrao } });
});

apiRouter.post('/auth/login', (req, res) => {
  const { login, senha, empresa_id } = req.body;
  if (!login || !senha) {
    res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    return;
  }

  const user = getUserByLogin(login.trim());
  if (!user) {
    res.status(401).json({ error: 'Usuário ou senha inválidos' });
    return;
  }

  const hash = hashPassword(senha);
  if (user.senha_hash !== hash) {
    res.status(401).json({ error: 'Usuário ou senha inválidos' });
    return;
  }

  // Atualiza último acesso e empresa se fornecida
  try {
    if (empresa_id) {
      db.prepare("UPDATE usuarios SET ultimo_acesso = datetime('now'), empresa_id = ? WHERE id = ?")
        .run(Number(empresa_id), user.id);
    } else {
      db.prepare("UPDATE usuarios SET ultimo_acesso = datetime('now') WHERE id = ?")
        .run(user.id);
    }
  } catch (_e) {
    // ignora erro silencioso se coluna ainda não existir
  }

  const updatedUser = getUserById(user.id) || user;
  const token = createSession(user.id);
  const { senha_hash, ...safeUser } = updatedUser as any;
  safeUser.usando_senha_padrao = (hash === hashPassword('admin123'));

  res.json({ 
    message: 'Login realizado com sucesso',
    token, 
    user: safeUser 
  });
});

apiRouter.post('/auth/alterar-senha', (req, res) => {
  const user = authenticateRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  const { nova_senha, senha_atual } = req.body;
  if (!nova_senha || nova_senha.trim().length < 6) {
    res.status(400).json({ error: 'A nova senha deve possuir no mínimo 6 caracteres' });
    return;
  }

  const dbUser = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(user.id) as { senha_hash: string } | undefined;
  if (!dbUser) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }

  if (senha_atual && dbUser.senha_hash !== hashPassword(senha_atual)) {
    res.status(400).json({ error: 'Senha atual incorreta' });
    return;
  }

  const newHash = hashPassword(nova_senha.trim());
  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(newHash, user.id);

  res.json({ message: 'Senha alterada com sucesso! Recomendamos memorizar suas novas credenciais.' });
});

apiRouter.post('/auth/switch-user', (req, res) => {
  const { userId, empresaId } = req.body;
  if (!userId) {
    res.status(400).json({ error: 'ID do usuário é obrigatório' });
    return;
  }

  if (empresaId) {
    try {
      db.prepare('UPDATE usuarios SET empresa_id = ? WHERE id = ?').run(Number(empresaId), Number(userId));
    } catch (_e) {}
  }

  const user = getUserById(Number(userId));
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }

  const token = createSession(user.id);
  res.json({ 
    message: `Alternado para ${user.nome} (${user.perfil})`, 
    token, 
    user 
  });
});

// ============================================================================
// 3. DASHBOARD GERAL E INDICADORES
// ============================================================================

apiRouter.get('/dashboard/stats', (_req, res) => {
  updateOverdueLoans();

  // 1. Itens em Estoque Baixo
  const itensEstoqueBaixo = db.prepare(`
    SELECT COUNT(*) as count 
    FROM produtos 
    WHERE ativo = 1 AND quantidade_atual <= estoque_minimo
  `).get() as { count: number };

  // 2. Requisições Pendentes
  const requisicoesPendentes = db.prepare(`
    SELECT COUNT(*) as count 
    FROM requisicoes 
    WHERE status = 'pendente'
  `).get() as { count: number };

  // 3. Empréstimos Ativos
  const emprestimosAtivos = db.prepare(`
    SELECT COUNT(*) as count 
    FROM emprestimos 
    WHERE status = 'emprestado'
  `).get() as { count: number };

  // 4. Empréstimos Atrasados
  const emprestimosAtrasados = db.prepare(`
    SELECT COUNT(*) as count 
    FROM emprestimos 
    WHERE status = 'atrasado'
  `).get() as { count: number };

  // 5. Total de Produtos
  const totalProdutos = db.prepare(`
    SELECT COUNT(*) as count FROM produtos WHERE ativo = 1
  `).get() as { count: number };

  // Total de valor do estoque
  const valorEstoque = db.prepare(`
    SELECT COALESCE(SUM(quantidade_atual * COALESCE(valor_unitario, 1)), 0) as total
    FROM produtos WHERE ativo = 1
  `).get() as { total: number };

  // 6. Consumo por Centro de Custo no Mês Atual (Saídas)
  const consumoCentrosCusto = db.prepare(`
    SELECT 
      cc.id,
      cc.codigo,
      cc.nome,
      COUNT(m.id) as total_movimentacoes,
      COALESCE(SUM(m.quantidade), 0) as total_unidades
    FROM centros_custo cc
    LEFT JOIN movimentacoes m ON m.centro_custo_id = cc.id 
      AND m.tipo = 'saida'
      AND strftime('%Y-%m', m.data_movimentacao) = strftime('%Y-%m', 'now')
    WHERE cc.ativo = 1
    GROUP BY cc.id, cc.codigo, cc.nome
    ORDER BY total_unidades DESC
  `).all();

  // 7. Lista de Produtos em Nível Crítico
  const produtosCriticos = db.prepare(`
    SELECT id, codigo, nome, unidade_medida, tipo, estoque_minimo, quantidade_atual, valor_unitario, localizacao
    FROM produtos
    WHERE ativo = 1 AND quantidade_atual <= estoque_minimo
    ORDER BY (quantidade_atual / CASE WHEN estoque_minimo = 0 THEN 1 ELSE estoque_minimo END) ASC
    LIMIT 6
  `).all();

  // 8. Últimas Movimentações (Auditoria recente)
  const ultimasMovimentacoes = db.prepare(`
    SELECT 
      m.id, m.tipo, m.quantidade, m.documento_referencia, m.observacao, m.data_movimentacao,
      p.codigo as produto_codigo, p.nome as produto_nome, p.unidade_medida,
      cc.nome as centro_custo_nome,
      u.nome as usuario_nome
    FROM movimentacoes m
    JOIN produtos p ON m.produto_id = p.id
    LEFT JOIN centros_custo cc ON m.centro_custo_id = cc.id
    JOIN usuarios u ON m.usuario_id = u.id
    ORDER BY m.id DESC
    LIMIT 6
  `).all();

  res.json({
    kpis: {
      itens_estoque_baixo: itensEstoqueBaixo.count,
      requisicoes_pendentes: requisicoesPendentes.count,
      emprestimos_ativos: emprestimosAtivos.count,
      emprestimos_atrasados: emprestimosAtrasados.count,
      total_produtos: totalProdutos.count,
      total_valor_estoque: valorEstoque.total,
    },
    consumo_centros_custo: consumoCentrosCusto,
    produtos_criticos: produtosCriticos,
    ultimas_movimentacoes: ultimasMovimentacoes,
  });
});

// ============================================================================
// 4. GESTÃO DE CENTROS DE CUSTO
// ============================================================================

apiRouter.get('/centros-custo', (req, res) => {
  const { apenas_ativos, busca } = req.query;
  let sql = `
    SELECT cc.*, eu.nome as empresa_nome
    FROM centros_custo cc
    LEFT JOIN empresas_unidades eu ON cc.empresa_id = eu.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (apenas_ativos === 'true') {
    sql += ' AND cc.ativo = 1';
  }

  if (busca && typeof busca === 'string' && busca.trim()) {
    sql += ' AND (cc.codigo LIKE ? OR cc.nome LIKE ? OR cc.departamento LIKE ? OR cc.responsavel LIKE ?)';
    const term = `%${busca.trim()}%`;
    params.push(term, term, term, term);
  }

  sql += ' ORDER BY cc.codigo ASC';
  const list = db.prepare(sql).all(...params);
  res.json(list);
});

apiRouter.post('/centros-custo', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || user.perfil !== 'admin') {
    res.status(403).json({ error: 'Apenas Administradores podem cadastrar Centros de Custo' });
    return;
  }

  const { codigo, nome, departamento, responsavel, empresa_id } = req.body;
  if (!codigo || !nome || !departamento || !responsavel) {
    res.status(400).json({ error: 'Todos os campos (código, nome, departamento, responsável) são obrigatórios' });
    return;
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO centros_custo (codigo, nome, departamento, responsavel, empresa_id, ativo)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    const info = stmt.run(
      codigo.trim().toUpperCase(), 
      nome.trim(), 
      departamento.trim(), 
      responsavel.trim(),
      empresa_id ? Number(empresa_id) : 1
    );
    const novo = db.prepare(`
      SELECT cc.*, eu.nome as empresa_nome 
      FROM centros_custo cc 
      LEFT JOIN empresas_unidades eu ON cc.empresa_id = eu.id 
      WHERE cc.id = ?
    `).get(info.lastInsertRowid);
    res.status(201).json(novo);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'Já existe um Centro de Custo com este código' });
      return;
    }
    res.status(500).json({ error: 'Erro ao cadastrar Centro de Custo: ' + err.message });
  }
});

apiRouter.put('/centros-custo/:id', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || user.perfil !== 'admin') {
    res.status(403).json({ error: 'Apenas Administradores podem alterar Centros de Custo' });
    return;
  }

  const { id } = req.params;
  const { codigo, nome, departamento, responsavel, empresa_id, ativo } = req.body;

  try {
    db.prepare(`
      UPDATE centros_custo
      SET codigo = ?, nome = ?, departamento = ?, responsavel = ?, empresa_id = ?, ativo = ?
      WHERE id = ?
    `).run(
      codigo.trim().toUpperCase(),
      nome.trim(),
      departamento.trim(),
      responsavel.trim(),
      empresa_id ? Number(empresa_id) : 1,
      ativo === 0 || ativo === false ? 0 : 1,
      id
    );

    const atualizado = db.prepare(`
      SELECT cc.*, eu.nome as empresa_nome 
      FROM centros_custo cc 
      LEFT JOIN empresas_unidades eu ON cc.empresa_id = eu.id 
      WHERE cc.id = ?
    `).get(id);
    res.json(atualizado);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao atualizar Centro de Custo: ' + err.message });
  }
});

apiRouter.patch('/centros-custo/:id/toggle', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || user.perfil !== 'admin') {
    res.status(403).json({ error: 'Apenas Administradores podem ativar/inativar Centros de Custo' });
    return;
  }

  const { id } = req.params;
  const atual = db.prepare('SELECT ativo FROM centros_custo WHERE id = ?').get(id) as { ativo: number } | undefined;
  if (!atual) {
    res.status(404).json({ error: 'Centro de custo não encontrado' });
    return;
  }

  const novoAtivo = atual.ativo === 1 ? 0 : 1;
  db.prepare('UPDATE centros_custo SET ativo = ? WHERE id = ?').run(novoAtivo, id);
  res.json({ id, ativo: novoAtivo, message: novoAtivo ? 'Centro ativado' : 'Centro inativado' });
});

// ============================================================================
// 5. GESTÃO DE USUÁRIOS (PADRÃO SALUTEM COM ABAS E FILTROS COMPLETOS)
// ============================================================================

apiRouter.get('/usuarios', (req, res) => {
  const { busca, ativo, perfil, centro_custo_id } = req.query;

  let sql = `
    SELECT u.id, u.codigo, u.nome, u.login, u.cpf, u.email, u.perfil, 
           u.centro_custo_id, u.empresa_id, u.ativo, u.criado_em, u.ultimo_acesso,
           cc.nome as centro_custo_nome, cc.codigo as centro_custo_codigo,
           eu.nome as empresa_nome
    FROM usuarios u
    LEFT JOIN centros_custo cc ON u.centro_custo_id = cc.id
    LEFT JOIN empresas_unidades eu ON u.empresa_id = eu.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (ativo === '1' || ativo === 'true') {
    sql += ' AND u.ativo = 1';
  } else if (ativo === '0' || ativo === 'false') {
    sql += ' AND u.ativo = 0';
  }

  if (perfil && perfil !== 'todos') {
    sql += ' AND u.perfil = ?';
    params.push(perfil);
  }

  if (centro_custo_id) {
    sql += ' AND u.centro_custo_id = ?';
    params.push(centro_custo_id);
  }

  if (busca && typeof busca === 'string' && busca.trim()) {
    sql += ' AND (u.codigo LIKE ? OR u.nome LIKE ? OR u.login LIKE ? OR u.cpf LIKE ? OR u.email LIKE ?)';
    const term = `%${busca.trim()}%`;
    params.push(term, term, term, term, term);
  }

  sql += ' ORDER BY u.nome ASC';
  const list = db.prepare(sql).all(...params);
  res.json(list);
});

apiRouter.post('/usuarios', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || user.perfil !== 'admin') {
    res.status(403).json({ error: 'Apenas Administradores podem cadastrar novos usuários' });
    return;
  }

  const { codigo, nome, login, senha, cpf, email, perfil, centro_custo_id, empresa_id } = req.body;
  if (!nome || !login || !senha || !perfil) {
    res.status(400).json({ error: 'Nome, login, senha e perfil são obrigatórios' });
    return;
  }

  if (perfil === 'requisitante' && !centro_custo_id) {
    res.status(400).json({ error: 'Centro de Custo é obrigatório para usuários com perfil Requisitante' });
    return;
  }

  try {
    const senha_hash = hashPassword(senha);
    const codFinal = codigo && codigo.trim() ? codigo.trim().toUpperCase() : `USR-${Date.now().toString().slice(-4)}`;

    const stmt = db.prepare(`
      INSERT INTO usuarios (codigo, nome, login, senha_hash, cpf, email, perfil, centro_custo_id, empresa_id, ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const info = stmt.run(
      codFinal,
      nome.trim(), 
      login.trim().toLowerCase(), 
      senha_hash, 
      cpf ? cpf.trim() : null,
      email ? email.trim().toLowerCase() : null,
      perfil, 
      centro_custo_id ? Number(centro_custo_id) : null,
      empresa_id ? Number(empresa_id) : 1
    );
    const novo = getUserById(Number(info.lastInsertRowid));
    res.status(201).json(novo);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'Já existe um usuário cadastrado com este login ou código' });
      return;
    }
    res.status(500).json({ error: 'Erro ao cadastrar usuário: ' + err.message });
  }
});

apiRouter.put('/usuarios/:id', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || user.perfil !== 'admin') {
    res.status(403).json({ error: 'Apenas Administradores podem alterar usuários' });
    return;
  }

  const { id } = req.params;
  const { codigo, nome, login, senha, cpf, email, perfil, centro_custo_id, empresa_id, ativo } = req.body;

  try {
    if (senha && senha.trim()) {
      const senha_hash = hashPassword(senha);
      db.prepare(`
        UPDATE usuarios
        SET codigo = ?, nome = ?, login = ?, senha_hash = ?, cpf = ?, email = ?, 
            perfil = ?, centro_custo_id = ?, empresa_id = ?, ativo = ?
        WHERE id = ?
      `).run(
        codigo ? codigo.trim().toUpperCase() : null,
        nome.trim(), 
        login.trim().toLowerCase(), 
        senha_hash, 
        cpf ? cpf.trim() : null,
        email ? email.trim().toLowerCase() : null,
        perfil, 
        centro_custo_id ? Number(centro_custo_id) : null, 
        empresa_id ? Number(empresa_id) : 1,
        ativo ?? 1, 
        id
      );
    } else {
      db.prepare(`
        UPDATE usuarios
        SET codigo = ?, nome = ?, login = ?, cpf = ?, email = ?, 
            perfil = ?, centro_custo_id = ?, empresa_id = ?, ativo = ?
        WHERE id = ?
      `).run(
        codigo ? codigo.trim().toUpperCase() : null,
        nome.trim(), 
        login.trim().toLowerCase(), 
        cpf ? cpf.trim() : null,
        email ? email.trim().toLowerCase() : null,
        perfil, 
        centro_custo_id ? Number(centro_custo_id) : null, 
        empresa_id ? Number(empresa_id) : 1,
        ativo ?? 1, 
        id
      );
    }

    const atualizado = getUserById(Number(id));
    res.json(atualizado);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao atualizar usuário: ' + err.message });
  }
});

apiRouter.patch('/usuarios/:id/toggle', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || user.perfil !== 'admin') {
    res.status(403).json({ error: 'Apenas Administradores podem alterar status de usuários' });
    return;
  }

  const { id } = req.params;
  const atual = db.prepare('SELECT ativo FROM usuarios WHERE id = ?').get(id) as { ativo: number } | undefined;
  if (!atual) {
    res.status(404).json({ error: 'Usuário não encontrado' });
    return;
  }

  const novoAtivo = atual.ativo === 1 ? 0 : 1;
  db.prepare('UPDATE usuarios SET ativo = ? WHERE id = ?').run(novoAtivo, id);
  res.json({ id, ativo: novoAtivo, message: novoAtivo ? 'Usuário ativado' : 'Usuário inativado' });
});

// ============================================================================
// 6. CATÁLOGO DE PRODUTOS E ITENS
// ============================================================================

apiRouter.get('/produtos', (req, res) => {
  const { tipo, busca, estoque_baixo, apenas_ativos } = req.query;

  let query = 'SELECT * FROM produtos WHERE 1=1';
  const params: any[] = [];

  if (apenas_ativos !== 'false') {
    query += ' AND ativo = 1';
  }

  if (tipo && (tipo === 'consumivel' || tipo === 'nao_consumivel')) {
    query += ' AND tipo = ?';
    params.push(tipo);
  }

  if (estoque_baixo === 'true') {
    query += ' AND quantidade_atual <= estoque_minimo';
  }

  if (busca && typeof busca === 'string' && busca.trim()) {
    query += ' AND (codigo LIKE ? OR nome LIKE ? OR descricao LIKE ? OR localizacao LIKE ?)';
    const term = `%${busca.trim()}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY nome ASC';

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

apiRouter.post('/produtos', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || (user.perfil !== 'admin' && user.perfil !== 'almoxarife')) {
    res.status(403).json({ error: 'Apenas Administradores e Almoxarifes podem cadastrar produtos' });
    return;
  }

  const { codigo, nome, descricao, unidade_medida, tipo, estoque_minimo, estoque_maximo, valor_unitario, localizacao } = req.body;
  if (!codigo || !nome || !unidade_medida || !tipo) {
    res.status(400).json({ error: 'Código, nome, unidade de medida e tipo são obrigatórios' });
    return;
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO produtos (codigo, nome, descricao, unidade_medida, tipo, estoque_minimo, estoque_maximo, quantidade_atual, valor_unitario, localizacao, ativo)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1)
    `);
    const info = stmt.run(
      codigo.trim().toUpperCase(),
      nome.trim(),
      descricao ? descricao.trim() : null,
      unidade_medida.trim().toUpperCase(),
      tipo,
      Number(estoque_minimo) || 0,
      Number(estoque_maximo) || 0,
      valor_unitario ? Number(valor_unitario) : 0,
      localizacao ? localizacao.trim().toUpperCase() : null
    );
    const novo = db.prepare('SELECT * FROM produtos WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(novo);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'Já existe um produto com este código de catálogo' });
      return;
    }
    res.status(500).json({ error: 'Erro ao cadastrar produto: ' + err.message });
  }
});

apiRouter.put('/produtos/:id', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || (user.perfil !== 'admin' && user.perfil !== 'almoxarife')) {
    res.status(403).json({ error: 'Apenas Administradores e Almoxarifes podem editar produtos' });
    return;
  }

  const { id } = req.params;
  const { codigo, nome, descricao, unidade_medida, tipo, estoque_minimo, estoque_maximo, valor_unitario, localizacao, ativo } = req.body;

  try {
    db.prepare(`
      UPDATE produtos
      SET codigo = ?, nome = ?, descricao = ?, unidade_medida = ?, tipo = ?, 
          estoque_minimo = ?, estoque_maximo = ?, valor_unitario = ?, localizacao = ?, ativo = ?
      WHERE id = ?
    `).run(
      codigo.trim().toUpperCase(),
      nome.trim(),
      descricao ? descricao.trim() : null,
      unidade_medida.trim().toUpperCase(),
      tipo,
      Number(estoque_minimo) || 0,
      Number(estoque_maximo) || 0,
      valor_unitario !== undefined ? Number(valor_unitario) : 0,
      localizacao ? localizacao.trim().toUpperCase() : null,
      ativo ?? 1,
      id
    );

    const atualizado = db.prepare('SELECT * FROM produtos WHERE id = ?').get(id);
    res.json(atualizado);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao atualizar produto: ' + err.message });
  }
});

// ============================================================================
// 7. ENTRADA DE NOTA FISCAL / ESTOQUE
// ============================================================================

apiRouter.post('/entradas', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || (user.perfil !== 'admin' && user.perfil !== 'almoxarife')) {
    res.status(403).json({ error: 'Apenas Almoxarifes e Administradores podem registrar entradas de estoque' });
    return;
  }

  const { produto_id, quantidade, documento_referencia, numero_lote, data_validade, valor_unitario, observacao, fornecedor } = req.body;

  const qtd = Number(quantidade);
  if (!produto_id || !qtd || qtd <= 0) {
    res.status(400).json({ error: 'Produto e quantidade válida positiva são obrigatórios' });
    return;
  }

  if (!documento_referencia || !documento_referencia.trim()) {
    res.status(400).json({ error: 'O número do documento fiscal / NF de entrada é obrigatório para conformidade' });
    return;
  }

  try {
    const result = runInTransaction(() => {
      // 1. Verifica produto
      const prod = db.prepare('SELECT id, nome, quantidade_atual FROM produtos WHERE id = ? AND ativo = 1').get(produto_id) as any;
      if (!prod) {
        throw new Error('Produto não encontrado ou inativo');
      }

      // 2. Atualiza saldo de forma atômica
      db.prepare(`
        UPDATE produtos 
        SET quantidade_atual = quantidade_atual + ? 
        WHERE id = ?
      `).run(qtd, produto_id);

      // Atualiza também valor_unitario se fornecido
      if (valor_unitario && Number(valor_unitario) > 0) {
        db.prepare('UPDATE produtos SET valor_unitario = ? WHERE id = ?').run(Number(valor_unitario), produto_id);
      }

      // 3. Registra movimentação no livro-caixa auditável
      const obsFinal = fornecedor 
        ? `Fornecedor: ${fornecedor.trim()} | ${observacao ? observacao.trim() : 'Entrada de material por NF/Doc'}`
        : (observacao ? observacao.trim() : 'Entrada de material por NF/Doc');

      const movStmt = db.prepare(`
        INSERT INTO movimentacoes (tipo, produto_id, quantidade, centro_custo_id, usuario_id, documento_referencia, numero_lote, data_validade, valor_unitario, observacao)
        VALUES ('entrada', ?, ?, NULL, ?, ?, ?, ?, ?, ?)
      `);
      const movInfo = movStmt.run(
        produto_id,
        qtd,
        user.id,
        documento_referencia.trim().toUpperCase(),
        numero_lote ? numero_lote.trim().toUpperCase() : null,
        data_validade || null,
        valor_unitario ? Number(valor_unitario) : null,
        obsFinal
      );

      const produtoAtualizado = db.prepare('SELECT * FROM produtos WHERE id = ?').get(produto_id);
      return {
        movimentacao_id: movInfo.lastInsertRowid,
        produto: produtoAtualizado,
      };
    });

    res.status(201).json({
      message: 'Entrada registrada com sucesso no estoque',
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao registrar entrada' });
  }
});

// ============================================================================
// 8. WORKFLOW DE REQUISIÇÃO (PADRÃO SALUTEM COM PRIORIDADE E ABAS)
// ============================================================================

apiRouter.get('/requisicoes', (req, res) => {
  const user = authenticateRequest(req);
  const { status, centro_custo_id, busca, prioridade } = req.query;

  let query = `
    SELECT 
      r.id, r.numero_requisicao, r.centro_custo_id, r.solicitante_id, r.almoxarife_id,
      r.data_solicitacao, r.data_atendimento, r.status, r.prioridade, r.motivo_rejeicao, r.observacao,
      cc.codigo as centro_custo_codigo, cc.nome as centro_custo_nome,
      u_sol.nome as solicitante_nome, u_sol.login as solicitante_login,
      u_alm.nome as almoxarife_nome,
      (SELECT COUNT(*) FROM itens_requisicao ir WHERE ir.requisicao_id = r.id) as total_itens,
      (SELECT COUNT(*) FROM itens_requisicao ir WHERE ir.requisicao_id = r.id AND ir.status_item = 'aprovado') as itens_aprovados,
      (SELECT COUNT(*) FROM itens_requisicao ir WHERE ir.requisicao_id = r.id AND ir.status_item = 'negado') as itens_negados,
      (SELECT COUNT(*) FROM historico_requisicoes hr WHERE hr.requisicao_id = r.id) as total_eventos_historico
    FROM requisicoes r
    JOIN centros_custo cc ON r.centro_custo_id = cc.id
    JOIN usuarios u_sol ON r.solicitante_id = u_sol.id
    LEFT JOIN usuarios u_alm ON r.almoxarife_id = u_alm.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Se o usuário for requisitante, filtra pelo seu centro de custo
  if (user && user.perfil === 'requisitante') {
    if (user.centro_custo_id) {
      query += ' AND r.centro_custo_id = ?';
      params.push(user.centro_custo_id);
    }
  } else if (centro_custo_id) {
    query += ' AND r.centro_custo_id = ?';
    params.push(centro_custo_id);
  }

  if (status && status !== 'todas') {
    query += ' AND r.status = ?';
    params.push(status);
  }

  if (prioridade && prioridade !== 'todas') {
    query += ' AND r.prioridade = ?';
    params.push(prioridade);
  }

  if (busca && typeof busca === 'string' && busca.trim()) {
    query += ' AND (r.numero_requisicao LIKE ? OR cc.nome LIKE ? OR u_sol.nome LIKE ?)';
    const term = `%${busca.trim()}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY r.id DESC';

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

apiRouter.get('/requisicoes/:id', (req, res) => {
  const { id } = req.params;

  const reqRow = db.prepare(`
    SELECT 
      r.id, r.numero_requisicao, r.centro_custo_id, r.solicitante_id, r.almoxarife_id,
      r.data_solicitacao, r.data_atendimento, r.status, r.prioridade, r.motivo_rejeicao, r.observacao,
      cc.codigo as centro_custo_codigo, cc.nome as centro_custo_nome, cc.departamento as centro_custo_depto,
      u_sol.nome as solicitante_nome, u_sol.login as solicitante_login,
      u_alm.nome as almoxarife_nome
    FROM requisicoes r
    JOIN centros_custo cc ON r.centro_custo_id = cc.id
    JOIN usuarios u_sol ON r.solicitante_id = u_sol.id
    LEFT JOIN usuarios u_alm ON r.almoxarife_id = u_alm.id
    WHERE r.id = ?
  `).get(id) as any;

  if (!reqRow) {
    res.status(404).json({ error: 'Requisição não encontrada' });
    return;
  }

  const itens = db.prepare(`
    SELECT 
      ir.id, ir.requisicao_id, ir.produto_id, ir.quantidade_solicitada, ir.quantidade_atendida,
      ir.status_item, ir.analisado_por_id, ir.data_analise, ir.motivo_decisao,
      u_ana.nome as analisado_por_nome, u_ana.login as analisado_por_login, u_ana.perfil as analisado_por_perfil,
      p.codigo as produto_codigo, p.nome as produto_nome, p.unidade_medida, p.tipo,
      p.quantidade_atual as saldo_atual_estoque, p.valor_unitario
    FROM itens_requisicao ir
    JOIN produtos p ON ir.produto_id = p.id
    LEFT JOIN usuarios u_ana ON ir.analisado_por_id = u_ana.id
    WHERE ir.requisicao_id = ?
  `).all(id);

  const historico = db.prepare(`
    SELECT 
      hr.id, hr.requisicao_id, hr.item_requisicao_id, hr.produto_id, hr.usuario_id,
      hr.acao, hr.status_anterior, hr.status_novo, hr.quantidade_solicitada, hr.quantidade_atendida,
      hr.detalhes, hr.justificativa, hr.data_registro,
      u.nome as usuario_nome, u.login as usuario_login, u.perfil as usuario_perfil,
      p.codigo as produto_codigo, p.nome as produto_nome, p.unidade_medida
    FROM historico_requisicoes hr
    JOIN usuarios u ON hr.usuario_id = u.id
    LEFT JOIN produtos p ON hr.produto_id = p.id
    WHERE hr.requisicao_id = ?
    ORDER BY hr.id ASC
  `).all(id);

  res.json({
    requisicao: reqRow,
    itens,
    historico,
  });
});

apiRouter.get('/requisicoes/:id/historico', (req, res) => {
  const { id } = req.params;
  const historico = db.prepare(`
    SELECT 
      hr.id, hr.requisicao_id, hr.item_requisicao_id, hr.produto_id, hr.usuario_id,
      hr.acao, hr.status_anterior, hr.status_novo, hr.quantidade_solicitada, hr.quantidade_atendida,
      hr.detalhes, hr.justificativa, hr.data_registro,
      u.nome as usuario_nome, u.login as usuario_login, u.perfil as usuario_perfil,
      p.codigo as produto_codigo, p.nome as produto_nome, p.unidade_medida
    FROM historico_requisicoes hr
    JOIN usuarios u ON hr.usuario_id = u.id
    LEFT JOIN produtos p ON hr.produto_id = p.id
    WHERE hr.requisicao_id = ?
    ORDER BY hr.id ASC
  `).all(id);

  res.json(historico);
});

apiRouter.post('/requisicoes', (req, res) => {
  const user = authenticateRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Não autenticado' });
    return;
  }

  const { centro_custo_id, prioridade, observacao, itens } = req.body;

  const finalCcId = user.perfil === 'requisitante' ? (user.centro_custo_id || centro_custo_id) : centro_custo_id;

  if (!finalCcId) {
    res.status(400).json({ error: 'Centro de Custo solicitante é obrigatório' });
    return;
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    res.status(400).json({ error: 'A requisição deve conter pelo menos 1 item' });
    return;
  }

  // Gera número da requisição: REQ-YYYY-XXXX
  const year = new Date().getFullYear();
  const countRow = db.prepare(`
    SELECT COUNT(*) as count FROM requisicoes WHERE numero_requisicao LIKE ?
  `).get(`REQ-${year}-%`) as { count: number };
  const nextSeq = String(countRow.count + 1).padStart(4, '0');
  const numero_requisicao = `REQ-${year}-${nextSeq}`;

  try {
    const result = runInTransaction(() => {
      // 1. Cria cabeçalho da requisição (status = 'pendente')
      const reqStmt = db.prepare(`
        INSERT INTO requisicoes (numero_requisicao, centro_custo_id, solicitante_id, prioridade, status, observacao)
        VALUES (?, ?, ?, ?, 'pendente', ?)
      `);
      const reqInfo = reqStmt.run(
        numero_requisicao,
        finalCcId,
        user.id,
        prioridade === 'urgente' ? 'urgente' : 'normal',
        observacao ? observacao.trim() : null
      );
      const requisicaoId = reqInfo.lastInsertRowid;

      // Registra abertura no histórico de auditoria da requisição
      const histStmt = db.prepare(`
        INSERT INTO historico_requisicoes (
          requisicao_id, item_requisicao_id, produto_id, usuario_id, acao,
          status_anterior, status_novo, quantidade_solicitada, quantidade_atendida,
          detalhes, justificativa
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      histStmt.run(
        requisicaoId,
        null,
        null,
        user.id,
        'criacao_requisicao',
        null,
        'pendente',
        null,
        null,
        `Requisição ${numero_requisicao} aberta por ${user.nome} (${user.perfil.toUpperCase()}) com prioridade ${(prioridade === 'urgente' ? 'URGENTE' : 'NORMAL')} contendo ${itens.length} item(ns).`,
        observacao ? observacao.trim() : null
      );

      // 2. Insere itens
      const itemStmt = db.prepare(`
        INSERT INTO itens_requisicao (requisicao_id, produto_id, quantidade_solicitada, quantidade_atendida, status_item)
        VALUES (?, ?, ?, 0, 'pendente')
      `);

      for (const it of itens) {
        const qtd = Number(it.quantidade_solicitada);
        if (!it.produto_id || !qtd || qtd <= 0) {
          throw new Error('Cada item deve conter um produto válido e quantidade maior que zero');
        }

        // Valida se o produto existe e é consumível
        const prod = db.prepare('SELECT id, codigo, nome, unidade_medida, tipo, ativo FROM produtos WHERE id = ?').get(it.produto_id) as any;
        if (!prod || !prod.ativo) {
          throw new Error(`Produto #${it.produto_id} não encontrado ou inativo`);
        }
        if (prod.tipo !== 'consumivel') {
          throw new Error(`O produto "${prod.nome}" é um equipamento não consumível. Para ferramentas/equipamentos, utilize o módulo de Empréstimos.`);
        }

        const itemInfo = itemStmt.run(requisicaoId, it.produto_id, qtd);

        histStmt.run(
          requisicaoId,
          itemInfo.lastInsertRowid,
          it.produto_id,
          user.id,
          'inclusao_item',
          null,
          'pendente',
          qtd,
          0,
          `Item incluído na requisição: ${prod.codigo} - ${prod.nome} (${qtd} ${prod.unidade_medida}).`,
          null
        );
      }

      return {
        id: requisicaoId,
        numero_requisicao,
      };
    });

    res.status(201).json({
      message: 'Requisição cadastrada com sucesso com status Pendente',
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao criar requisição' });
  }
});

apiRouter.post('/requisicoes/:id/aprovar', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || (user.perfil !== 'admin' && user.perfil !== 'almoxarife')) {
    res.status(403).json({ error: 'Apenas Almoxarifes e Administradores podem analisar e atender requisições' });
    return;
  }

  const { id } = req.params;
  const { decisoes_itens, observacao_atendimento } = req.body || {};

  try {
    const result = runInTransaction(() => {
      const reqRow = db.prepare('SELECT * FROM requisicoes WHERE id = ?').get(id) as any;
      if (!reqRow) {
        throw new Error('Requisição não encontrada');
      }
      if (reqRow.status !== 'pendente') {
        throw new Error(`Esta requisição não pode ser analisada pois seu status atual é "${reqRow.status}"`);
      }

      const itens = db.prepare(`
        SELECT ir.*, p.codigo as produto_codigo, p.nome as produto_nome, p.quantidade_atual as saldo_atual, p.unidade_medida
        FROM itens_requisicao ir
        JOIN produtos p ON ir.produto_id = p.id
        WHERE ir.requisicao_id = ?
      `).all(id) as any[];

      if (itens.length === 0) {
        throw new Error('A requisição não possui itens para atender');
      }

      // Mapeia decisões por item (se não informadas no body, aprova todos os itens integralmente)
      const decisoesMap = new Map<number, {
        decisao: 'aprovado' | 'negado';
        quantidade_atendida: number;
        motivo_decisao: string;
      }>();

      if (Array.isArray(decisoes_itens) && decisoes_itens.length > 0) {
        for (const d of decisoes_itens) {
          const itemOriginal = itens.find((it) => it.id === Number(d.item_id));
          if (!itemOriginal) continue;
          const isNegado = d.decisao === 'negado';
          const qtdAtend = isNegado
            ? 0
            : d.quantidade_atendida !== undefined
            ? Number(d.quantidade_atendida)
            : Number(itemOriginal.quantidade_solicitada);

          const motivo = d.motivo_decisao ? String(d.motivo_decisao).trim() : '';
          if (isNegado && !motivo) {
            throw new Error(`Informe o motivo/parecer técnico para negar o item "${itemOriginal.produto_nome}".`);
          }
          if (!isNegado && qtdAtend <= 0) {
            throw new Error(`A quantidade atendida para o item aprovado "${itemOriginal.produto_nome}" deve ser maior que zero.`);
          }

          decisoesMap.set(itemOriginal.id, {
            decisao: isNegado ? 'negado' : 'aprovado',
            quantidade_atendida: qtdAtend,
            motivo_decisao: motivo || (isNegado ? 'Item negado na conferência do almoxarifado.' : 'Item conferido, aprovado e dispensado.'),
          });
        }
      }

      // Preenche padrão ('aprovado') para itens que não vieram no mapa
      for (const item of itens) {
        if (!decisoesMap.has(item.id)) {
          decisoesMap.set(item.id, {
            decisao: 'aprovado',
            quantidade_atendida: Number(item.quantidade_solicitada),
            motivo_decisao: 'Item conferido, aprovado e dispensado.',
          });
        }
      }

      // Valida saldo em estoque para todos os itens marcados como 'aprovado'
      let qtdItensAprovados = 0;
      let qtdItensNegados = 0;

      for (const item of itens) {
        const dec = decisoesMap.get(item.id)!;
        if (dec.decisao === 'aprovado') {
          qtdItensAprovados++;
          if (item.saldo_atual < dec.quantidade_atendida) {
            throw new Error(
              `Estoque insuficiente para aprovar o item "${item.produto_nome}". ` +
              `Quantidade para atender: ${dec.quantidade_atendida} ${item.unidade_medida}, ` +
              `Disponível em estoque: ${item.saldo_atual} ${item.unidade_medida}. ` +
              `Negue este item individualmente ou ajuste a quantidade antes de prosseguir.`
            );
          }
        } else {
          qtdItensNegados++;
        }
      }

      // Statements de atualização e auditoria
      const debitProdStmt = db.prepare(`
        UPDATE produtos 
        SET quantidade_atual = quantidade_atual - ? 
        WHERE id = ? AND quantidade_atual >= ?
      `);

      const updateItemStmt = db.prepare(`
        UPDATE itens_requisicao 
        SET quantidade_atendida = ?, status_item = ?, analisado_por_id = ?, data_analise = CURRENT_TIMESTAMP, motivo_decisao = ?
        WHERE id = ?
      `);

      const movStmt = db.prepare(`
        INSERT INTO movimentacoes (tipo, produto_id, quantidade, centro_custo_id, usuario_id, documento_referencia, observacao)
        VALUES ('saida', ?, ?, ?, ?, ?, ?)
      `);

      const histStmt = db.prepare(`
        INSERT INTO historico_requisicoes (
          requisicao_id, item_requisicao_id, produto_id, usuario_id, acao,
          status_anterior, status_novo, quantidade_solicitada, quantidade_atendida,
          detalhes, justificativa
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of itens) {
        const dec = decisoesMap.get(item.id)!;

        if (dec.decisao === 'aprovado') {
          const updateResult = debitProdStmt.run(dec.quantidade_atendida, item.produto_id, dec.quantidade_atendida);
          if (updateResult.changes === 0) {
            throw new Error(`Falha de concorrência ao debitar estoque de "${item.produto_nome}".`);
          }

          updateItemStmt.run(dec.quantidade_atendida, 'aprovado', user.id, dec.motivo_decisao, item.id);

          movStmt.run(
            item.produto_id,
            dec.quantidade_atendida,
            reqRow.centro_custo_id,
            user.id,
            reqRow.numero_requisicao,
            `Atendimento de Requisição (Item aprovado por ${user.nome})`
          );

          histStmt.run(
            id,
            item.id,
            item.produto_id,
            user.id,
            'aprovacao_item',
            item.status_item || 'pendente',
            'aprovado',
            item.quantidade_solicitada,
            dec.quantidade_atendida,
            `Item APROVADO por ${user.nome} (${user.perfil.toUpperCase()}): ${item.produto_codigo} - ${item.produto_nome}. Solicitado: ${item.quantidade_solicitada} ${item.unidade_medida} | Atendido: ${dec.quantidade_atendida} ${item.unidade_medida}.`,
            dec.motivo_decisao
          );
        } else {
          updateItemStmt.run(0, 'negado', user.id, dec.motivo_decisao, item.id);

          histStmt.run(
            id,
            item.id,
            item.produto_id,
            user.id,
            'negacao_item',
            item.status_item || 'pendente',
            'negado',
            item.quantidade_solicitada,
            0,
            `Item NEGADO por ${user.nome} (${user.perfil.toUpperCase()}): ${item.produto_codigo} - ${item.produto_nome} (${item.quantidade_solicitada} ${item.unidade_medida}).`,
            dec.motivo_decisao
          );
        }
      }

      // Define status final da requisição conforme decisões por item
      let statusFinal: 'aprovada_atendida' | 'rejeitada' = 'aprovada_atendida';
      let acaoConsolidada: 'aprovacao_total' | 'aprovacao_parcial' | 'rejeicao_total' = 'aprovacao_total';
      let resumoConsolidado = '';

      if (qtdItensAprovados === 0) {
        statusFinal = 'rejeitada';
        acaoConsolidada = 'rejeicao_total';
        const motivosConcatenados = itens
          .map((it) => `${it.produto_codigo}: ${decisoesMap.get(it.id)?.motivo_decisao}`)
          .join(' | ');
        resumoConsolidado = observacao_atendimento?.trim() || motivosConcatenados || 'Todos os itens foram negados na análise do almoxarifado.';

        db.prepare(`
          UPDATE requisicoes 
          SET status = 'rejeitada', almoxarife_id = ?, data_atendimento = CURRENT_TIMESTAMP, motivo_rejeicao = ?
          WHERE id = ?
        `).run(user.id, resumoConsolidado, id);
      } else if (qtdItensNegados > 0) {
        statusFinal = 'aprovada_atendida';
        acaoConsolidada = 'aprovacao_parcial';
        const negadosResumo = itens
          .filter((it) => decisoesMap.get(it.id)?.decisao === 'negado')
          .map((it) => `${it.produto_codigo} (${decisoesMap.get(it.id)?.motivo_decisao})`)
          .join('; ');
        resumoConsolidado = `Atendimento parcial: ${qtdItensAprovados} item(ns) aprovado(s) e ${qtdItensNegados} item(ns) negado(s). Itens negados: ${negadosResumo}`;

        db.prepare(`
          UPDATE requisicoes 
          SET status = 'aprovada_atendida', almoxarife_id = ?, data_atendimento = CURRENT_TIMESTAMP, motivo_rejeicao = ?
          WHERE id = ?
        `).run(user.id, resumoConsolidado, id);
      } else {
        statusFinal = 'aprovada_atendida';
        acaoConsolidada = 'aprovacao_total';
        resumoConsolidado = observacao_atendimento?.trim() || `Todos os ${qtdItensAprovados} item(ns) foram aprovados e dispensados por ${user.nome}.`;

        db.prepare(`
          UPDATE requisicoes 
          SET status = 'aprovada_atendida', almoxarife_id = ?, data_atendimento = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(user.id, id);
      }

      histStmt.run(
        id,
        null,
        null,
        user.id,
        acaoConsolidada,
        'pendente',
        statusFinal,
        null,
        null,
        acaoConsolidada === 'aprovacao_total'
          ? `Conferência concluída por ${user.nome}: Aprovação integral de ${qtdItensAprovados} item(ns) e baixa de estoque executada.`
          : acaoConsolidada === 'aprovacao_parcial'
          ? `Conferência concluída por ${user.nome}: Atendimento parcial (${qtdItensAprovados} aprovado(s), ${qtdItensNegados} negado(s)).`
          : `Conferência concluída por ${user.nome}: Todos os ${qtdItensNegados} item(ns) da requisição foram negados.`,
        resumoConsolidado
      );

      return {
        requisicao_id: id,
        numero_requisicao: reqRow.numero_requisicao,
        status: statusFinal,
        itens_aprovados: qtdItensAprovados,
        itens_negados: qtdItensNegados,
      };
    });

    res.json({
      message:
        result.status === 'rejeitada'
          ? `Requisição ${result.numero_requisicao} concluída com todos os itens negados.`
          : result.itens_negados > 0
          ? `Requisição ${result.numero_requisicao} atendida parcialmente (${result.itens_aprovados} aprovado(s) e ${result.itens_negados} negado(s)).`
          : `Requisição ${result.numero_requisicao} aprovada e atendida com sucesso! Baixa de estoque efetuada.`,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao aprovar requisição' });
  }
});

apiRouter.post('/requisicoes/:id/rejeitar', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || (user.perfil !== 'admin' && user.perfil !== 'almoxarife')) {
    res.status(403).json({ error: 'Apenas Almoxarifes e Administradores podem rejeitar requisições' });
    return;
  }

  const { id } = req.params;
  const { motivo_rejeicao } = req.body;

  if (!motivo_rejeicao || !motivo_rejeicao.trim()) {
    res.status(400).json({ error: 'A justificativa em "motivo_rejeicao" é OBRIGATÓRIA para rejeitar uma requisição' });
    return;
  }

  try {
    const reqRow = db.prepare('SELECT * FROM requisicoes WHERE id = ?').get(id) as any;
    if (!reqRow) {
      res.status(404).json({ error: 'Requisição não encontrada' });
      return;
    }
    if (reqRow.status !== 'pendente') {
      res.status(400).json({ error: `Esta requisição não pode ser rejeitada pois seu status atual é "${reqRow.status}"` });
      return;
    }

    runInTransaction(() => {
      const itens = db.prepare(`
        SELECT ir.*, p.codigo as produto_codigo, p.nome as produto_nome, p.unidade_medida
        FROM itens_requisicao ir
        JOIN produtos p ON ir.produto_id = p.id
        WHERE ir.requisicao_id = ?
      `).all(id) as any[];

      const updateItemStmt = db.prepare(`
        UPDATE itens_requisicao
        SET quantidade_atendida = 0, status_item = 'negado', analisado_por_id = ?, data_analise = CURRENT_TIMESTAMP, motivo_decisao = ?
        WHERE id = ?
      `);

      const histStmt = db.prepare(`
        INSERT INTO historico_requisicoes (
          requisicao_id, item_requisicao_id, produto_id, usuario_id, acao,
          status_anterior, status_novo, quantidade_solicitada, quantidade_atendida,
          detalhes, justificativa
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of itens) {
        updateItemStmt.run(user.id, motivo_rejeicao.trim(), item.id);

        histStmt.run(
          id,
          item.id,
          item.produto_id,
          user.id,
          'negacao_item',
          item.status_item || 'pendente',
          'negado',
          item.quantidade_solicitada,
          0,
          `Item NEGADO por ${user.nome} (${user.perfil.toUpperCase()}): ${item.produto_codigo} - ${item.produto_nome} (${item.quantidade_solicitada} ${item.unidade_medida}).`,
          motivo_rejeicao.trim()
        );
      }

      db.prepare(`
        UPDATE requisicoes 
        SET status = 'rejeitada', almoxarife_id = ?, data_atendimento = CURRENT_TIMESTAMP, motivo_rejeicao = ?
        WHERE id = ?
      `).run(user.id, motivo_rejeicao.trim(), id);

      histStmt.run(
        id,
        null,
        null,
        user.id,
        'rejeicao_total',
        'pendente',
        'rejeitada',
        null,
        null,
        `Requisição ${reqRow.numero_requisicao} rejeitada integralmente por ${user.nome} (${user.perfil.toUpperCase()}).`,
        motivo_rejeicao.trim()
      );
    });

    res.json({
      message: `Requisição ${reqRow.numero_requisicao} rejeitada. Saldo de estoque mantido intacto.`,
      id,
      status: 'rejeitada',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao rejeitar requisição: ' + err.message });
  }
});

apiRouter.post('/requisicoes/:id/cancelar', (req, res) => {
  const user = authenticateRequest(req);
  const { id } = req.params;

  const reqRow = db.prepare('SELECT * FROM requisicoes WHERE id = ?').get(id) as any;
  if (!reqRow) {
    res.status(404).json({ error: 'Requisição não encontrada' });
    return;
  }

  if (reqRow.status !== 'pendente') {
    res.status(400).json({ error: 'Apenas requisições com status "pendente" podem ser canceladas' });
    return;
  }

  if (user && user.perfil === 'requisitante' && reqRow.solicitante_id !== user.id) {
    res.status(403).json({ error: 'Você só pode cancelar requisições criadas por você mesmo' });
    return;
  }

  runInTransaction(() => {
    db.prepare(`
      UPDATE requisicoes SET status = 'cancelada' WHERE id = ?
    `).run(id);

    const actingUserId = user?.id || reqRow.solicitante_id;
    const actingUserName = user?.nome || 'Solicitante';
    db.prepare(`
      INSERT INTO historico_requisicoes (
        requisicao_id, item_requisicao_id, produto_id, usuario_id, acao,
        status_anterior, status_novo, quantidade_solicitada, quantidade_atendida,
        detalhes, justificativa
      ) VALUES (?, NULL, NULL, ?, 'cancelamento', 'pendente', 'cancelada', NULL, NULL, ?, NULL)
    `).run(
      id,
      actingUserId,
      `Requisição ${reqRow.numero_requisicao} cancelada por ${actingUserName}.`
    );
  });

  res.json({ message: 'Requisição cancelada com sucesso', id, status: 'cancelada' });
});

// ============================================================================
// 9. MÓDULO DE EMPRÉSTIMOS E DEVOLUÇÕES (FERRAMENTAS / NÃO CONSUMÍVEIS)
// ============================================================================

apiRouter.get('/emprestimos', (req, res) => {
  updateOverdueLoans();
  const { aba, busca } = req.query;

  let query = `
    SELECT 
      e.id, e.codigo_emprestimo, e.produto_id, e.quantidade, e.centro_custo_id, e.solicitante_id,
      e.almoxarife_liberacao_id, e.almoxarife_recebimento_id, e.data_emprestimo, e.data_prevista_devolucao,
      e.data_devolucao, e.status, e.condicao_saida, e.condicao_devolucao, e.observacao,
      p.codigo as produto_codigo, p.nome as produto_nome, p.unidade_medida,
      cc.codigo as centro_custo_codigo, cc.nome as centro_custo_nome,
      u_req.nome as solicitante_nome,
      u_alm.nome as almoxarife_liberacao_nome,
      u_rec.nome as almoxarife_recebimento_nome
    FROM emprestimos e
    JOIN produtos p ON e.produto_id = p.id
    JOIN centros_custo cc ON e.centro_custo_id = cc.id
    JOIN usuarios u_req ON e.solicitante_id = u_req.id
    JOIN usuarios u_alm ON e.almoxarife_liberacao_id = u_alm.id
    LEFT JOIN usuarios u_rec ON e.almoxarife_recebimento_id = u_rec.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (aba === 'abertos') {
    query += " AND e.status = 'emprestado'";
  } else if (aba === 'atrasados') {
    query += " AND e.status = 'atrasado'";
  } else if (aba === 'devolvidos') {
    query += " AND e.status = 'devolvido'";
  }

  if (busca && typeof busca === 'string' && busca.trim()) {
    query += ' AND (e.codigo_emprestimo LIKE ? OR p.nome LIKE ? OR cc.nome LIKE ? OR u_req.nome LIKE ?)';
    const term = `%${busca.trim()}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY e.id DESC';

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

apiRouter.post('/emprestimos', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || (user.perfil !== 'admin' && user.perfil !== 'almoxarife')) {
    res.status(403).json({ error: 'Apenas Almoxarifes e Administradores podem liberar empréstimos de equipamentos' });
    return;
  }

  const { produto_id, quantidade, centro_custo_id, solicitante_id, data_prevista_devolucao, condicao_saida, observacao } = req.body;

  const qtd = Number(quantidade) || 1;
  if (!produto_id || qtd <= 0) {
    res.status(400).json({ error: 'Produto e quantidade válida positiva são obrigatórios' });
    return;
  }

  if (!centro_custo_id) {
    res.status(400).json({ error: 'Centro de Custo de destino é obrigatório' });
    return;
  }

  if (!solicitante_id) {
    res.status(400).json({ error: 'Identificação do profissional solicitante é obrigatória' });
    return;
  }

  if (!data_prevista_devolucao) {
    res.status(400).json({ error: 'Data prevista de devolução é obrigatória' });
    return;
  }

  const year = new Date().getFullYear();
  const countRow = db.prepare(`SELECT COUNT(*) as count FROM emprestimos WHERE codigo_emprestimo LIKE ?`).get(`EMP-${year}-%`) as { count: number };
  const nextSeq = String(countRow.count + 1).padStart(4, '0');
  const codigo_emprestimo = `EMP-${year}-${nextSeq}`;

  try {
    const result = runInTransaction(() => {
      const prod = db.prepare('SELECT * FROM produtos WHERE id = ? AND ativo = 1').get(produto_id) as any;
      if (!prod) {
        throw new Error('Produto não encontrado ou inativo');
      }

      if (prod.tipo !== 'nao_consumivel') {
        throw new Error(`O produto "${prod.nome}" é classificado como CONSUMÍVEL. Empréstimos operam apenas com itens não consumíveis.`);
      }

      if (prod.quantidade_atual < qtd) {
        throw new Error(
          `Saldo insuficiente para liberação de "${prod.nome}". ` +
          `Solicitado: ${qtd}, Disponível: ${prod.quantidade_atual}.`
        );
      }

      // Baixa temporária do estoque
      db.prepare(`
        UPDATE produtos 
        SET quantidade_atual = quantidade_atual - ? 
        WHERE id = ? AND quantidade_atual >= ?
      `).run(qtd, produto_id, qtd);

      const empStmt = db.prepare(`
        INSERT INTO emprestimos (codigo_emprestimo, produto_id, quantidade, centro_custo_id, solicitante_id, almoxarife_liberacao_id, data_prevista_devolucao, condicao_saida, status, observacao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'emprestado', ?)
      `);
      const empInfo = empStmt.run(
        codigo_emprestimo,
        produto_id,
        qtd,
        centro_custo_id,
        solicitante_id,
        user.id,
        data_prevista_devolucao,
        condicao_saida ? condicao_saida.trim() : 'Em bom estado e calibrado',
        observacao ? observacao.trim() : 'Empréstimo de equipamento não consumível'
      );

      // Movimentação auditável
      db.prepare(`
        INSERT INTO movimentacoes (tipo, produto_id, quantidade, centro_custo_id, usuario_id, documento_referencia, observacao)
        VALUES ('saida', ?, ?, ?, ?, ?, ?)
      `).run(
        produto_id,
        qtd,
        centro_custo_id,
        user.id,
        codigo_emprestimo,
        `Liberação de empréstimo temporário de equipamento`
      );

      return {
        id: empInfo.lastInsertRowid,
        codigo_emprestimo,
        produto_nome: prod.nome,
        quantidade: qtd,
      };
    });

    res.status(201).json({
      message: 'Empréstimo registrado com sucesso e saldo temporário debitado',
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao registrar empréstimo' });
  }
});

apiRouter.post('/emprestimos/:id/devolver', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || (user.perfil !== 'admin' && user.perfil !== 'almoxarife')) {
    res.status(403).json({ error: 'Apenas Almoxarifes e Administradores podem registrar devoluções' });
    return;
  }

  const { id } = req.params;
  const { condicao_devolucao, observacao } = req.body;

  try {
    const result = runInTransaction(() => {
      const emp = db.prepare(`
        SELECT e.*, p.nome as produto_nome
        FROM emprestimos e
        JOIN produtos p ON e.produto_id = p.id
        WHERE e.id = ?
      `).get(id) as any;

      if (!emp) {
        throw new Error('Registro de empréstimo não encontrado');
      }

      if (emp.status === 'devolvido') {
        throw new Error('Este equipamento já foi previamente devolvido');
      }

      const obsFinal = observacao && observacao.trim() 
        ? `${emp.observacao || ''} | Devolução: ${observacao.trim()}`
        : emp.observacao;

      db.prepare(`
        UPDATE emprestimos
        SET status = 'devolvido', 
            data_devolucao = CURRENT_TIMESTAMP, 
            almoxarife_recebimento_id = ?,
            condicao_devolucao = ?,
            observacao = ?
        WHERE id = ?
      `).run(
        user.id,
        condicao_devolucao ? condicao_devolucao.trim() : 'Em bom estado',
        obsFinal, 
        id
      );

      // Repõe o saldo do produto no almoxarifado
      db.prepare(`
        UPDATE produtos
        SET quantidade_atual = quantidade_atual + ?
        WHERE id = ?
      `).run(emp.quantidade, emp.produto_id);

      // Registra retorno no livro-caixa
      db.prepare(`
        INSERT INTO movimentacoes (tipo, produto_id, quantidade, centro_custo_id, usuario_id, documento_referencia, observacao)
        VALUES ('entrada', ?, ?, ?, ?, ?, ?)
      `).run(
        emp.produto_id,
        emp.quantidade,
        emp.centro_custo_id,
        user.id,
        emp.codigo_emprestimo || `DEV-EMP-${id}`,
        `Retorno de devolução de equipamento. Condição: ${condicao_devolucao || 'OK'}`
      );

      return {
        id,
        produto_nome: emp.produto_nome,
        quantidade_devolvida: emp.quantidade,
      };
    });

    res.json({
      message: `Devolução do equipamento "${result.produto_nome}" recebida com sucesso! Saldo recomposto.`,
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao registrar devolução' });
  }
});

// ============================================================================
// 10. MOVIMENTAÇÕES DE ESTOQUE (LIVRO-CAIXA / AUDITORIA IMUTÁVEL)
// ============================================================================

apiRouter.get('/movimentacoes', (req, res) => {
  const { tipo, produto_id, centro_custo_id, limite, busca } = req.query;

  let query = `
    SELECT 
      m.id, m.tipo, m.quantidade, m.documento_referencia, m.numero_lote, m.data_validade,
      m.valor_unitario, m.observacao, m.data_movimentacao,
      p.id as produto_id, p.codigo as produto_codigo, p.nome as produto_nome, p.unidade_medida, p.tipo as produto_tipo,
      cc.id as centro_custo_id, cc.codigo as centro_custo_codigo, cc.nome as centro_custo_nome,
      u.id as usuario_id, u.nome as usuario_nome, u.perfil as usuario_perfil
    FROM movimentacoes m
    JOIN produtos p ON m.produto_id = p.id
    LEFT JOIN centros_custo cc ON m.centro_custo_id = cc.id
    JOIN usuarios u ON m.usuario_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (tipo && ['entrada', 'saida', 'estorno_entrada', 'estorno_saida'].includes(tipo as string)) {
    query += ' AND m.tipo = ?';
    params.push(tipo);
  }

  if (produto_id) {
    query += ' AND m.produto_id = ?';
    params.push(produto_id);
  }

  if (centro_custo_id) {
    query += ' AND m.centro_custo_id = ?';
    params.push(centro_custo_id);
  }

  if (busca && typeof busca === 'string' && busca.trim()) {
    query += ' AND (p.nome LIKE ? OR p.codigo LIKE ? OR m.documento_referencia LIKE ? OR cc.nome LIKE ?)';
    const term = `%${busca.trim()}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY m.id DESC';

  const maxRows = Math.min(Number(limite) || 100, 500);
  query += ` LIMIT ${maxRows}`;

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

apiRouter.post('/movimentacoes/:id/estornar', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || user.perfil !== 'admin') {
    res.status(403).json({ error: 'Apenas Administradores podem autorizar estornos no livro-caixa' });
    return;
  }

  const { id } = req.params;
  const { justificativa } = req.body;

  if (!justificativa || !justificativa.trim()) {
    res.status(400).json({ error: 'Justificativa técnica detalhada é obrigatória para efetuar estorno' });
    return;
  }

  try {
    const result = runInTransaction(() => {
      const mov = db.prepare('SELECT * FROM movimentacoes WHERE id = ?').get(id) as any;
      if (!mov) {
        throw new Error('Movimentação original não encontrada');
      }

      if (mov.tipo.startsWith('estorno_')) {
        throw new Error('Não é permitido estornar um lançamento que já é um estorno');
      }

      const prod = db.prepare('SELECT * FROM produtos WHERE id = ?').get(mov.produto_id) as any;
      if (!prod) {
        throw new Error('Produto associado não encontrado');
      }

      let novoTipo: string;
      if (mov.tipo === 'entrada') {
        if (prod.quantidade_atual < mov.quantidade) {
          throw new Error(
            `Não é possível estornar esta entrada pois o saldo atual (${prod.quantidade_atual}) ` +
            `é menor do que a quantidade a ser estornada (${mov.quantidade}). Geraria estoque negativo.`
          );
        }
        db.prepare('UPDATE produtos SET quantidade_atual = quantidade_atual - ? WHERE id = ?').run(mov.quantidade, mov.produto_id);
        novoTipo = 'estorno_entrada';
      } else if (mov.tipo === 'saida') {
        db.prepare('UPDATE produtos SET quantidade_atual = quantidade_atual + ? WHERE id = ?').run(mov.quantidade, mov.produto_id);
        novoTipo = 'estorno_saida';
      } else {
        throw new Error(`Tipo de movimentação "${mov.tipo}" não suporta estorno direto`);
      }

      const estornoStmt = db.prepare(`
        INSERT INTO movimentacoes (tipo, produto_id, quantidade, centro_custo_id, usuario_id, documento_referencia, observacao)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const estornoInfo = estornoStmt.run(
        novoTipo,
        mov.produto_id,
        mov.quantidade,
        mov.centro_custo_id,
        user.id,
        `ESTORNO-LANC-${mov.id}`,
        `Estorno do lançamento #${mov.id} (${mov.documento_referencia || 'S/D'}). Motivo: ${justificativa.trim()}`
      );

      return {
        estorno_id: estornoInfo.lastInsertRowid,
        tipo: novoTipo,
        quantidade: mov.quantidade,
      };
    });

    res.json({
      message: 'Estorno compensatório gerado com sucesso no livro-caixa',
      data: result,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Erro ao processar estorno' });
  }
});

// ============================================================================
// 11. MÓDULO DE RELATÓRIOS SALUTEM (11 RELATÓRIOS AGRUPADOS EM 4 CATEGORIAS)
// ============================================================================

apiRouter.get('/relatorios/catalogo', (_req, res) => {
  const catalogo = [
    {
      categoria: 'Estoque',
      icone: 'Package',
      descricao: 'Posição patrimonial, controle de saldos e ponto de ressuprimento',
      relatorios: [
        {
          id: 'posicao_atual_estoque',
          titulo: 'Posição Geral de Estoque Físico e Financeiro',
          descricao: 'Demonstrativo completo de saldos atuais, localização de prateleira, tipo e valorização do estoque.',
        },
        {
          id: 'estoque_critico',
          titulo: 'Itens em Nível Crítico / Abaixo do Ponto de Reposição',
          descricao: 'Alerta gerencial de materiais cujo saldo atual está igual ou abaixo do estoque mínimo de segurança.',
        },
        {
          id: 'consumivel_vs_equipamentos',
          titulo: 'Relação de Consumíveis vs Equipamentos Patrimoniais',
          descricao: 'Classificação analítica por tipo de insumo e distribuição patrimonial no almoxarifado.',
        },
      ],
    },
    {
      categoria: 'Movimentações',
      icone: 'ArrowLeftRight',
      descricao: 'Rastreabilidade fiscal, extrato de notas e livro razão',
      relatorios: [
        {
          id: 'extrato_entradas_nf',
          titulo: 'Extrato de Entradas por Documento / Fornecedor',
          descricao: 'Relatório cronológico de notas fiscais recebidas, lotes, validades e insumos adicionados.',
        },
        {
          id: 'razao_saidas_centro_custo',
          titulo: 'Livro Razão de Saídas por Centro de Custo',
          descricao: 'Consumo por departamento e unidade solicitante no período selecionado.',
        },
        {
          id: 'auditoria_estornos',
          titulo: 'Auditoria de Estornos e Ajustes Compensatórios',
          descricao: 'Rastreabilidade total das operações de correção e justificativas de estorno registradas no sistema.',
        },
      ],
    },
    {
      categoria: 'Requisições',
      icone: 'ClipboardList',
      descricao: 'Fluxo hospitalar de solicitações, atendimento e produtividade',
      relatorios: [
        {
          id: 'requisicoes_atendidas',
          titulo: 'Requisições Atendidas por Período e Centro de Custo',
          descricao: 'Volume de pedidos deferidos com total de itens dispensados pelo almoxarife.',
        },
        {
          id: 'requisicoes_rejeitadas',
          titulo: 'Requisições Rejeitadas e Pareceres de Recusa',
          descricao: 'Levantamento de pedidos recusados com auditoria dos motivos técnicos inseridos pelo almoxarife.',
        },
        {
          id: 'tempo_atendimento',
          titulo: 'Indicador de Atendimento e Eficiência do Almoxarifado',
          descricao: 'Métricas de atendimento com proporção de pedidos atendidos no mesmo dia versus pendências.',
        },
      ],
    },
    {
      categoria: 'Empréstimos',
      icone: 'RotateCcw',
      descricao: 'Guarda, devoluções e controle de ferramentas e equipamentos',
      relatorios: [
        {
          id: 'equipamentos_abertos_atrasados',
          titulo: 'Equipamentos em Aberto e Empréstimos Atrasados',
          descricao: 'Relação de ferramentas e aparelhos fora do almoxarifado com status de devolução e atrasos.',
        },
        {
          id: 'historico_devolucoes',
          titulo: 'Histórico de Devoluções e Conservação de Aparelhos',
          descricao: 'Registro das conferências de integridade e estado de conservação no recebimento de retorno.',
        },
      ],
    },
  ];

  res.json(catalogo);
});

apiRouter.get('/relatorios/consumo-mensal', (req, res) => {
  const { produto_id, centro_custo_id, meses } = req.query;
  const numMeses = Math.min(Math.max(Number(meses) || 6, 3), 24);

  try {
    // 1. Carrega Centros de Custo ativos (ou filtrados)
    let ccSql = 'SELECT id, codigo, nome, departamento FROM centros_custo WHERE ativo = 1';
    const ccParams: any[] = [];
    if (centro_custo_id) {
      ccSql += ' AND id = ?';
      ccParams.push(Number(centro_custo_id));
    }
    ccSql += ' ORDER BY nome ASC';
    const centros = db.prepare(ccSql).all(...ccParams) as Array<{
      id: number;
      codigo: string;
      nome: string;
      departamento: string;
    }>;

    // 2. Gera janela cronológica dos últimos N meses
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const now = new Date();
    const monthsList: Array<{ ano_mes: string; label: string }> = [];

    for (let i = numMeses - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(yyyy).slice(-2);
      monthsList.push({
        ano_mes: `${yyyy}-${mm}`,
        label: `${monthNames[d.getMonth()]}/${yy}`,
      });
    }

    // 3. Consulta movimentações de saída (e estornos de saída) agrupadas por mês e centro de custo
    let movSql = `
      SELECT 
        strftime('%Y-%m', m.data_movimentacao) as ano_mes,
        m.centro_custo_id,
        SUM(CASE WHEN m.tipo = 'saida' THEN m.quantidade ELSE -m.quantidade END) as qtd_liquida,
        SUM(
          (CASE WHEN m.tipo = 'saida' THEN m.quantidade ELSE -m.quantidade END) *
          COALESCE(m.valor_unitario, p.valor_unitario, 0)
        ) as valor_liquido
      FROM movimentacoes m
      JOIN produtos p ON m.produto_id = p.id
      WHERE m.tipo IN ('saida', 'estorno_saida')
        AND m.centro_custo_id IS NOT NULL
    `;
    const movParams: any[] = [];

    if (produto_id) {
      movSql += ' AND m.produto_id = ?';
      movParams.push(Number(produto_id));
    }
    if (centro_custo_id) {
      movSql += ' AND m.centro_custo_id = ?';
      movParams.push(Number(centro_custo_id));
    }

    movSql += ` GROUP BY strftime('%Y-%m', m.data_movimentacao), m.centro_custo_id`;

    const rawRows = db.prepare(movSql).all(...movParams) as Array<{
      ano_mes: string;
      centro_custo_id: number;
      qtd_liquida: number;
      valor_liquido: number;
    }>;

    // Mapa auxiliar: `${ano_mes}_${ccId}` -> { qtd, valor }
    const dataMap = new Map<string, { qtd: number; valor: number }>();
    for (const r of rawRows) {
      if (!r.ano_mes || !r.centro_custo_id) continue;
      dataMap.set(`${r.ano_mes}_${r.centro_custo_id}`, {
        qtd: Math.max(0, Number(r.qtd_liquida) || 0),
        valor: Math.max(0, Number(r.valor_liquido) || 0),
      });
    }

    // Totais acumulados por série (centro de custo)
    const seriesTotals = new Map<number, { qtd: number; valor: number }>();
    for (const cc of centros) {
      seriesTotals.set(cc.id, { qtd: 0, valor: 0 });
    }

    let totalQuantidadePeriodo = 0;
    let totalValorPeriodo = 0;
    let mesPicoLabel = monthsList[monthsList.length - 1]?.label || '-';
    let mesPicoQtd = 0;

    // 4. Monta dataset mensal estruturado para o Recharts LineChart
    const chartData = monthsList.map((m) => {
      const point: Record<string, any> = {
        ano_mes: m.ano_mes,
        mes_label: m.label,
        total_quantidade: 0,
        total_valor: 0,
      };

      for (const cc of centros) {
        const found = dataMap.get(`${m.ano_mes}_${cc.id}`);
        const qtd = found ? Number(found.qtd.toFixed(2)) : 0;
        const valor = found ? Number(found.valor.toFixed(2)) : 0;

        point[`cc_${cc.id}_qtd`] = qtd;
        point[`cc_${cc.id}_valor`] = valor;
        point.total_quantidade = Number((point.total_quantidade + qtd).toFixed(2));
        point.total_valor = Number((point.total_valor + valor).toFixed(2));

        const acc = seriesTotals.get(cc.id)!;
        acc.qtd = Number((acc.qtd + qtd).toFixed(2));
        acc.valor = Number((acc.valor + valor).toFixed(2));
      }

      totalQuantidadePeriodo = Number((totalQuantidadePeriodo + point.total_quantidade).toFixed(2));
      totalValorPeriodo = Number((totalValorPeriodo + point.total_valor).toFixed(2));

      if (point.total_quantidade >= mesPicoQtd && point.total_quantidade > 0) {
        mesPicoQtd = point.total_quantidade;
        mesPicoLabel = m.label;
      }

      return point;
    });

    const series = centros.map((cc) => {
      const totals = seriesTotals.get(cc.id) || { qtd: 0, valor: 0 };
      return {
        id: cc.id,
        codigo: cc.codigo,
        nome: cc.nome,
        departamento: cc.departamento,
        key_qtd: `cc_${cc.id}_qtd`,
        key_valor: `cc_${cc.id}_valor`,
        total_quantidade: totals.qtd,
        total_valor: totals.valor,
      };
    });

    res.json({
      dados_mensais: chartData,
      series,
      resumo: {
        total_quantidade_periodo: totalQuantidadePeriodo,
        total_valor_periodo: totalValorPeriodo,
        media_mensal_qtd: Number((totalQuantidadePeriodo / numMeses).toFixed(1)),
        media_mensal_valor: Number((totalValorPeriodo / numMeses).toFixed(2)),
        mes_pico_label: mesPicoLabel,
        mes_pico_qtd: mesPicoQtd,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao calcular consumo mensal: ' + err.message });
  }
});

apiRouter.post('/relatorios/executar', (req, res) => {
  const { tipo_relatorio, centro_custo_id, produto_id, tipo_produto } = req.body;

  try {
    let titulo = '';
    let subtitulo = '';
    let colunas: Array<{ chave: string; rotulo: string; alinhamento?: 'left' | 'center' | 'right' }> = [];
    let dados: any[] = [];
    let resumo = '';

    switch (tipo_relatorio) {
      case 'posicao_atual_estoque': {
        titulo = 'Posição Geral de Estoque Físico e Financeiro';
        subtitulo = 'Demonstrativo completo de produtos ativos, saldo físico e valor patrimonial';
        colunas = [
          { chave: 'codigo', rotulo: 'Código' },
          { chave: 'nome', rotulo: 'Descrição do Item' },
          { chave: 'tipo_desc', rotulo: 'Tipo' },
          { chave: 'localizacao', rotulo: 'Localização' },
          { chave: 'unidade_medida', rotulo: 'UN', alinhamento: 'center' },
          { chave: 'estoque_minimo', rotulo: 'Mínimo', alinhamento: 'right' },
          { chave: 'quantidade_atual', rotulo: 'Saldo Físico', alinhamento: 'right' },
          { chave: 'valor_unitario_formatado', rotulo: 'Valor Unit.', alinhamento: 'right' },
          { chave: 'total_valor_formatado', rotulo: 'Valor Total', alinhamento: 'right' },
          { chave: 'status_estoque', rotulo: 'Situação', alinhamento: 'center' },
        ];

        let sql = 'SELECT * FROM produtos WHERE ativo = 1';
        const params: any[] = [];
        if (tipo_produto) {
          sql += ' AND tipo = ?';
          params.push(tipo_produto);
        }
        sql += ' ORDER BY nome ASC';

        const rows = db.prepare(sql).all(...params) as any[];
        let totalValorGeral = 0;
        let totalItens = 0;

        dados = rows.map((p) => {
          const valUnit = Number(p.valor_unitario) || 0;
          const totalItem = p.quantidade_atual * valUnit;
          totalValorGeral += totalItem;
          totalItens += p.quantidade_atual;

          return {
            ...p,
            tipo_desc: p.tipo === 'consumivel' ? 'Consumível' : 'Equipamento',
            localizacao: p.localizacao || 'Almox. Geral',
            valor_unitario_formatado: `R$ ${valUnit.toFixed(2)}`,
            total_valor_formatado: `R$ ${totalItem.toFixed(2)}`,
            status_estoque: p.quantidade_atual <= p.estoque_minimo ? 'CRÍTICO' : 'NORMAL',
          };
        });

        resumo = `Total de ${dados.length} produtos cadastrados. Saldo físico total de ${totalItens} unidades, perfazendo um valor patrimonial avaliado em R$ ${totalValorGeral.toFixed(2)}.`;
        break;
      }

      case 'estoque_critico': {
        titulo = 'Materiais em Nível Crítico / Abaixo do Ponto de Reposição';
        subtitulo = 'Itens com estoque igual ou inferior ao estoque mínimo estipulado';
        colunas = [
          { chave: 'codigo', rotulo: 'Código' },
          { chave: 'nome', rotulo: 'Material' },
          { chave: 'tipo_desc', rotulo: 'Tipo' },
          { chave: 'unidade_medida', rotulo: 'UN', alinhamento: 'center' },
          { chave: 'estoque_minimo', rotulo: 'Est. Mínimo', alinhamento: 'right' },
          { chave: 'quantidade_atual', rotulo: 'Saldo Atual', alinhamento: 'right' },
          { chave: 'deficit', rotulo: 'Déficit p/ Reposição', alinhamento: 'right' },
          { chave: 'prioridade', rotulo: 'Urgência de Compra', alinhamento: 'center' },
        ];

        const rows = db.prepare(`
          SELECT * FROM produtos 
          WHERE ativo = 1 AND quantidade_atual <= estoque_minimo
          ORDER BY (quantidade_atual / CASE WHEN estoque_minimo = 0 THEN 1 ELSE estoque_minimo END) ASC
        `).all() as any[];

        dados = rows.map((p) => {
          const deficit = Math.max(0, p.estoque_minimo - p.quantidade_atual);
          const ratio = p.estoque_minimo > 0 ? p.quantidade_atual / p.estoque_minimo : 0;
          let urg = 'Moderada';
          if (p.quantidade_atual === 0) urg = 'EMERGENCIAL (ZERADO)';
          else if (ratio <= 0.5) urg = 'ALTA PRIORIDADE';

          return {
            ...p,
            tipo_desc: p.tipo === 'consumivel' ? 'Consumível' : 'Equipamento',
            deficit,
            prioridade: urg,
          };
        });

        resumo = `Identificado(s) ${dados.length} item(ns) com necessidade urgente de requisição de compras ou pedido de reposição aos fornecedores.`;
        break;
      }

      case 'consumivel_vs_equipamentos': {
        titulo = 'Relação de Consumíveis vs Equipamentos Patrimoniais';
        subtitulo = 'Classificação geral do catálogo de suprimentos por categoria de uso';
        colunas = [
          { chave: 'tipo_desc', rotulo: 'Categoria' },
          { chave: 'total_itens', rotulo: 'Qtd de Produtos', alinhamento: 'center' },
          { chave: 'saldo_fisico', rotulo: 'Saldo Físico Total', alinhamento: 'right' },
          { chave: 'valor_total_formatado', rotulo: 'Valor Patrimonial', alinhamento: 'right' },
        ];

        const stats = db.prepare(`
          SELECT 
            tipo, 
            COUNT(*) as total_itens, 
            SUM(quantidade_atual) as saldo_fisico, 
            SUM(quantidade_atual * COALESCE(valor_unitario, 0)) as valor_total
          FROM produtos 
          WHERE ativo = 1 
          GROUP BY tipo
        `).all() as any[];

        dados = stats.map((s) => ({
          tipo_desc: s.tipo === 'consumivel' ? 'Materiais Consumíveis (Insumos Médicos / Hospitalares)' : 'Equipamentos e Ferramentas (Não Consumíveis)',
          total_itens: s.total_itens,
          saldo_fisico: s.saldo_fisico,
          valor_total_formatado: `R$ ${(s.valor_total || 0).toFixed(2)}`,
        }));

        resumo = 'Divisão analítica entre insumos descartáveis de uso contínuo e ativos não consumíveis controlados via termo de empréstimo.';
        break;
      }

      case 'extrato_entradas_nf': {
        titulo = 'Extrato de Entradas por Documento Fiscal / Fornecedor';
        subtitulo = 'Registro analítico das notas de compra e recebimento de insumos';
        colunas = [
          { chave: 'data_formatada', rotulo: 'Data / Hora' },
          { chave: 'documento_referencia', rotulo: 'Nota Fiscal / Doc' },
          { chave: 'produto_nome', rotulo: 'Produto Recebido' },
          { chave: 'numero_lote', rotulo: 'Lote' },
          { chave: 'data_validade', rotulo: 'Validade' },
          { chave: 'quantidade', rotulo: 'Qtd', alinhamento: 'right' },
          { chave: 'unidade_medida', rotulo: 'UN', alinhamento: 'center' },
          { chave: 'usuario_nome', rotulo: 'Recebedor (Almoxarife)' },
        ];

        let sql = `
          SELECT m.*, p.nome as produto_nome, p.unidade_medida, u.nome as usuario_nome,
                 strftime('%d/%m/%Y %H:%M', m.data_movimentacao) as data_formatada
          FROM movimentacoes m
          JOIN produtos p ON m.produto_id = p.id
          JOIN usuarios u ON m.usuario_id = u.id
          WHERE m.tipo = 'entrada'
        `;
        const params: any[] = [];
        if (produto_id) {
          sql += ' AND m.produto_id = ?';
          params.push(produto_id);
        }
        sql += ' ORDER BY m.id DESC LIMIT 100';

        dados = db.prepare(sql).all(...params) as any[];
        resumo = `Listagem de ${dados.length} recebimentos de mercadoria conferidos e adicionados com rastreabilidade ao saldo.`;
        break;
      }

      case 'razao_saidas_centro_custo': {
        titulo = 'Livro Razão de Saídas por Centro de Custo';
        subtitulo = 'Consumo de materiais hospitalares debitados por unidade requisitante';
        colunas = [
          { chave: 'data_formatada', rotulo: 'Data / Hora' },
          { chave: 'centro_custo_nome', rotulo: 'Centro de Custo' },
          { chave: 'produto_nome', rotulo: 'Material' },
          { chave: 'quantidade', rotulo: 'Qtd Dispensada', alinhamento: 'right' },
          { chave: 'unidade_medida', rotulo: 'UN', alinhamento: 'center' },
          { chave: 'documento_referencia', rotulo: 'Ref / Requisição' },
          { chave: 'usuario_nome', rotulo: 'Responsável Atendimento' },
        ];

        let sql = `
          SELECT m.*, p.nome as produto_nome, p.unidade_medida, cc.nome as centro_custo_nome, u.nome as usuario_nome,
                 strftime('%d/%m/%Y %H:%M', m.data_movimentacao) as data_formatada
          FROM movimentacoes m
          JOIN produtos p ON m.produto_id = p.id
          LEFT JOIN centros_custo cc ON m.centro_custo_id = cc.id
          JOIN usuarios u ON m.usuario_id = u.id
          WHERE m.tipo = 'saida'
        `;
        const params: any[] = [];
        if (centro_custo_id) {
          sql += ' AND m.centro_custo_id = ?';
          params.push(centro_custo_id);
        }
        sql += ' ORDER BY m.id DESC LIMIT 100';

        dados = db.prepare(sql).all(...params) as any[];
        resumo = `Demonstrativo contábil de ${dados.length} saídas de suprimentos alocadas para os setores assistenciais.`;
        break;
      }

      case 'auditoria_estornos': {
        titulo = 'Auditoria de Estornos e Ajustes Compensatórios';
        subtitulo = 'Trilha de auditoria e justificativas técnicas de correções no livro-caixa';
        colunas = [
          { chave: 'data_formatada', rotulo: 'Data Estorno' },
          { chave: 'documento_referencia', rotulo: 'Doc Referência' },
          { chave: 'tipo_desc', rotulo: 'Natureza do Estorno' },
          { chave: 'produto_nome', rotulo: 'Material' },
          { chave: 'quantidade', rotulo: 'Qtd Compensada', alinhamento: 'right' },
          { chave: 'usuario_nome', rotulo: 'Administrador Autorizante' },
          { chave: 'observacao', rotulo: 'Justificativa / Parecer' },
        ];

        const rows = db.prepare(`
          SELECT m.*, p.nome as produto_nome, u.nome as usuario_nome,
                 strftime('%d/%m/%Y %H:%M', m.data_movimentacao) as data_formatada
          FROM movimentacoes m
          JOIN produtos p ON m.produto_id = p.id
          JOIN usuarios u ON m.usuario_id = u.id
          WHERE m.tipo LIKE 'estorno_%'
          ORDER BY m.id DESC
        `).all() as any[];

        dados = rows.map((r) => ({
          ...r,
          tipo_desc: r.tipo === 'estorno_entrada' ? 'Estorno de Entrada (+ Estoque -> - Estoque)' : 'Estorno de Saída (- Estoque -> + Estoque)',
        }));

        resumo = `Total de ${dados.length} operações compensatórias executadas com estrita auditoria conforme regras hospitalares.`;
        break;
      }

      case 'requisicoes_atendidas': {
        titulo = 'Requisições Atendidas por Período e Centro de Custo';
        subtitulo = 'Histórico consolidado de pedidos assistenciais deferidos';
        colunas = [
          { chave: 'numero_requisicao', rotulo: 'Nº Requisição' },
          { chave: 'data_solicitacao_formatada', rotulo: 'Data Solicitação' },
          { chave: 'data_atendimento_formatada', rotulo: 'Data Atendimento' },
          { chave: 'centro_custo_nome', rotulo: 'Centro de Custo' },
          { chave: 'solicitante_nome', rotulo: 'Solicitante' },
          { chave: 'almoxarife_nome', rotulo: 'Almoxarife Atendente' },
          { chave: 'total_itens', rotulo: 'Itens', alinhamento: 'center' },
          { chave: 'prioridade_desc', rotulo: 'Prioridade', alinhamento: 'center' },
        ];

        let sql = `
          SELECT r.*, cc.nome as centro_custo_nome, u_sol.nome as solicitante_nome, u_alm.nome as almoxarife_nome,
                 strftime('%d/%m/%Y %H:%M', r.data_solicitacao) as data_solicitacao_formatada,
                 strftime('%d/%m/%Y %H:%M', r.data_atendimento) as data_atendimento_formatada,
                 (SELECT COUNT(*) FROM itens_requisicao ir WHERE ir.requisicao_id = r.id) as total_itens
          FROM requisicoes r
          JOIN centros_custo cc ON r.centro_custo_id = cc.id
          JOIN usuarios u_sol ON r.solicitante_id = u_sol.id
          LEFT JOIN usuarios u_alm ON r.almoxarife_id = u_alm.id
          WHERE r.status = 'aprovada_atendida'
        `;
        const params: any[] = [];
        if (centro_custo_id) {
          sql += ' AND r.centro_custo_id = ?';
          params.push(centro_custo_id);
        }
        sql += ' ORDER BY r.id DESC';

        const rows = db.prepare(sql).all(...params) as any[];
        dados = rows.map((r) => ({
          ...r,
          prioridade_desc: r.prioridade === 'urgente' ? 'URGENTE' : 'Normal',
        }));

        resumo = `Localizadas ${dados.length} requisições de suprimentos atendidas e liberadas para os setores assistenciais.`;
        break;
      }

      case 'requisicoes_rejeitadas': {
        titulo = 'Requisições Rejeitadas e Pareceres de Recusa';
        subtitulo = 'Auditoria dos pedidos assistenciais indeferidos pelo almoxarifado';
        colunas = [
          { chave: 'numero_requisicao', rotulo: 'Nº Requisição' },
          { chave: 'data_solicitacao_formatada', rotulo: 'Data Solicitação' },
          { chave: 'centro_custo_nome', rotulo: 'Centro de Custo' },
          { chave: 'solicitante_nome', rotulo: 'Solicitante' },
          { chave: 'almoxarife_nome', rotulo: 'Almoxarife Responsável' },
          { chave: 'motivo_rejeicao', rotulo: 'Justificativa Obrigatória da Recusa' },
        ];

        const rows = db.prepare(`
          SELECT r.*, cc.nome as centro_custo_nome, u_sol.nome as solicitante_nome, u_alm.nome as almoxarife_nome,
                 strftime('%d/%m/%Y %H:%M', r.data_solicitacao) as data_solicitacao_formatada
          FROM requisicoes r
          JOIN centros_custo cc ON r.centro_custo_id = cc.id
          JOIN usuarios u_sol ON r.solicitante_id = u_sol.id
          LEFT JOIN usuarios u_alm ON r.almoxarife_id = u_alm.id
          WHERE r.status = 'rejeitada'
          ORDER BY r.id DESC
        `).all() as any[];

        dados = rows;
        resumo = `Constatadas ${dados.length} requisições indeferidas com parecer fundamentado no sistema.`;
        break;
      }

      case 'tempo_atendimento': {
        titulo = 'Indicador de Atendimento e Eficiência do Almoxarifado';
        subtitulo = 'Balanço da agilidade no fluxo de dispensação hospitalar';
        colunas = [
          { chave: 'metrica', rotulo: 'Indicador de Produtividade' },
          { chave: 'valor', rotulo: 'Resultado Consolidado', alinhamento: 'center' },
          { chave: 'status_qualidade', rotulo: 'Avaliação de Desempenho', alinhamento: 'center' },
        ];

        const totalReq = db.prepare('SELECT COUNT(*) as c FROM requisicoes').get() as { c: number };
        const atendidas = db.prepare("SELECT COUNT(*) as c FROM requisicoes WHERE status = 'aprovada_atendida'").get() as { c: number };
        const pendentes = db.prepare("SELECT COUNT(*) as c FROM requisicoes WHERE status = 'pendente'").get() as { c: number };
        const rejeitadas = db.prepare("SELECT COUNT(*) as c FROM requisicoes WHERE status = 'rejeitada'").get() as { c: number };

        const taxaAtendimento = totalReq.c > 0 ? ((atendidas.c / totalReq.c) * 100).toFixed(1) + '%' : '100%';

        dados = [
          { metrica: 'Total de Requisições Hospitalares Criadas', valor: String(totalReq.c), status_qualidade: 'Em conformidade' },
          { metrica: 'Requisições Atendidas e Baixadas com Sucesso', valor: String(atendidas.c), status_qualidade: 'Excelente' },
          { metrica: 'Requisições Pendentes em Fila de Separação', valor: String(pendentes.c), status_qualidade: pendentes.c > 5 ? 'Atenção' : 'Normal' },
          { metrica: 'Requisições Rejeitadas com Parecer Técnico', valor: String(rejeitadas.c), status_qualidade: 'Sob Auditoria' },
          { metrica: 'Taxa Global de Eficiência no Atendimento', valor: taxaAtendimento, status_qualidade: 'Acima da Meta' },
        ];

        resumo = 'Indicadores de performance hospitalar do setor de suprimentos e almoxarifado geral.';
        break;
      }

      case 'equipamentos_abertos_atrasados': {
        updateOverdueLoans();
        titulo = 'Equipamentos em Aberto e Empréstimos Atrasados';
        subtitulo = 'Controle patrimonial de aparelhos médicos e ferramentas em posse dos setores';
        colunas = [
          { chave: 'codigo_emprestimo', rotulo: 'Termo Nº' },
          { chave: 'produto_nome', rotulo: 'Equipamento' },
          { chave: 'quantidade', rotulo: 'Qtd', alinhamento: 'center' },
          { chave: 'centro_custo_nome', rotulo: 'Setor Alocado' },
          { chave: 'solicitante_nome', rotulo: 'Profissional Responsável' },
          { chave: 'data_emprestimo_formatada', rotulo: 'Data Saída' },
          { chave: 'data_prevista_formatada', rotulo: 'Prazo Devolução' },
          { chave: 'status_desc', rotulo: 'Situação', alinhamento: 'center' },
        ];

        const rows = db.prepare(`
          SELECT e.*, p.nome as produto_nome, cc.nome as centro_custo_nome, u_req.nome as solicitante_nome,
                 strftime('%d/%m/%Y', e.data_emprestimo) as data_emprestimo_formatada,
                 strftime('%d/%m/%Y', e.data_prevista_devolucao) as data_prevista_formatada
          FROM emprestimos e
          JOIN produtos p ON e.produto_id = p.id
          JOIN centros_custo cc ON e.centro_custo_id = cc.id
          JOIN usuarios u_req ON e.solicitante_id = u_req.id
          WHERE e.status IN ('emprestado', 'atrasado')
          ORDER BY e.status ASC, e.data_prevista_devolucao ASC
        `).all() as any[];

        dados = rows.map((r) => ({
          ...r,
          codigo_emprestimo: r.codigo_emprestimo || `EMP-${r.id}`,
          status_desc: r.status === 'atrasado' ? 'ATRASADO (VENCIDO)' : 'EM USO (NO PRAZO)',
        }));

        resumo = `Constatado(s) ${dados.length} equipamento(s) atualmente em circulação nos setores hospitalares.`;
        break;
      }

      case 'historico_devolucoes': {
        titulo = 'Histórico de Devoluções e Conservação de Aparelhos';
        subtitulo = 'Registro das inspeções físicas de retorno de equipamentos ao estoque';
        colunas = [
          { chave: 'codigo_emprestimo', rotulo: 'Termo' },
          { chave: 'produto_nome', rotulo: 'Equipamento' },
          { chave: 'quantidade', rotulo: 'Qtd', alinhamento: 'center' },
          { chave: 'solicitante_nome', rotulo: 'Quem Devolveu' },
          { chave: 'data_devolucao_formatada', rotulo: 'Data Retorno' },
          { chave: 'condicao_devolucao', rotulo: 'Condição / Estado' },
          { chave: 'almoxarife_recebimento_nome', rotulo: 'Conferente Almoxarifado' },
        ];

        const rows = db.prepare(`
          SELECT e.*, p.nome as produto_nome, u_req.nome as solicitante_nome, u_rec.nome as almoxarife_recebimento_nome,
                 strftime('%d/%m/%Y %H:%M', e.data_devolucao) as data_devolucao_formatada
          FROM emprestimos e
          JOIN produtos p ON e.produto_id = p.id
          JOIN usuarios u_req ON e.solicitante_id = u_req.id
          LEFT JOIN usuarios u_rec ON e.almoxarife_recebimento_id = u_rec.id
          WHERE e.status = 'devolvido'
          ORDER BY e.data_devolucao DESC
        `).all() as any[];

        dados = rows.map((r) => ({
          ...r,
          codigo_emprestimo: r.codigo_emprestimo || `EMP-${r.id}`,
          condicao_devolucao: r.condicao_devolucao || 'Em bom estado',
          almoxarife_recebimento_nome: r.almoxarife_recebimento_nome || 'Almoxarifado Central',
        }));

        resumo = `Total de ${dados.length} devoluções registradas com recomposição automática do saldo patrimonial.`;
        break;
      }

      default:
        res.status(400).json({ error: 'Tipo de relatório não reconhecido' });
        return;
    }

    res.json({
      tipo_relatorio,
      titulo,
      subtitulo,
      data_emissao: new Date().toLocaleString('pt-BR'),
      colunas,
      dados,
      resumo,
      total_registros: dados.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao processar relatório: ' + err.message });
  }
});

// ============================================================================
// 12. RECURSOS DO SISTEMA & DOCUMENTAÇÃO
// ============================================================================

apiRouter.post('/system/reset', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || user.perfil !== 'admin') {
    res.status(403).json({ error: 'Apenas Administradores podem reiniciar o banco de dados' });
    return;
  }

  try {
    resetDatabase();
    res.json({ message: 'Banco de dados restaurado para o estado inicial limpo com sucesso' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao reiniciar banco: ' + err.message });
  }
});

apiRouter.get('/system/scripts', (_req, res) => {
  try {
    const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'schema.sql'), 'utf-8');
    const seedSql = fs.readFileSync(path.resolve(process.cwd(), 'seed.sql'), 'utf-8');
    res.json({ schemaSql, seedSql });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao ler scripts: ' + err.message });
  }
});

// ============================================================================
// 13. BACKUP & EXPORTAÇÃO EXCLUSIVA DO ADMINISTRADOR
// ============================================================================

function getBackupTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${YYYY}${MM}${DD}_${HH}${mm}${ss}`;
}

// 13.1 Informações e Estatísticas do Banco
apiRouter.get('/backup/info', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || user.perfil !== 'admin') {
    res.status(403).json({ error: 'Acesso negado. Apenas Administradores podem consultar informações de backup.' });
    return;
  }

  try {
    const dbPath = path.resolve(process.cwd(), 'almoxarifado.db');
    let sizeBytes = 0;
    if (fs.existsSync(dbPath)) {
      sizeBytes = fs.statSync(dbPath).size;
    }

    const tables = [
      'empresas_unidades',
      'centros_custo',
      'usuarios',
      'produtos',
      'requisicoes',
      'itens_requisicao',
      'historico_requisicoes',
      'movimentacoes',
      'emprestimos'
    ];

    const contagens: Record<string, number> = {};
    let totalRegistros = 0;
    for (const t of tables) {
      try {
        const row = db.prepare(`SELECT COUNT(*) as count FROM ${t}`).get() as { count: number };
        contagens[t] = row ? row.count : 0;
        totalRegistros += contagens[t];
      } catch {
        contagens[t] = 0;
      }
    }

    const formatBytes = (bytes: number) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    res.json({
      sistema: 'Multi Almox',
      versao: '2.4',
      padrao: 'Salutem Hospitalar',
      database_file: 'almoxarifado.db',
      tamanho_bytes: sizeBytes,
      tamanho_formatado: formatBytes(sizeBytes),
      total_tabelas: tables.length,
      total_registros: totalRegistros,
      contagens,
      data_servidor: new Date().toISOString(),
      modo_wal: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao obter dados de backup: ' + err.message });
  }
});

// 13.2 Download do Arquivo SQLite Nativo (.db)
apiRouter.get('/backup/download-db', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || user.perfil !== 'admin') {
    res.status(403).json({ error: 'Acesso negado. A exportação do banco de dados é restrita a Administradores.' });
    return;
  }

  const timestamp = getBackupTimestamp();
  const filename = `backup_almoxarifado_${timestamp}.db`;
  const tempPath = path.resolve(process.cwd(), `temp_${Date.now()}_${filename}`);

  try {
    // 1. Executa checkpoint de WAL para garantir persistência de transações pendentes
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (_e) {
      // Ignora erro de checkpoint se não houver WAL ativo
    }

    // 2. VACUUM INTO cria um snapshot consistente, atômico e otimizado
    db.exec(`VACUUM INTO '${tempPath.replace(/\\/g, '/')}';`);

    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const stream = fs.createReadStream(tempPath);
    stream.pipe(res);

    const cleanup = () => {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (_e) {}
    };

    stream.on('close', cleanup);
    stream.on('error', (err) => {
      cleanup();
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao transmitir cópia do banco: ' + err.message });
      }
    });
  } catch (err: any) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (_e) {}
    res.status(500).json({ error: 'Erro ao gerar backup SQLite (.db): ' + err.message });
  }
});

// 13.3 Download do Script SQL Completo DDL + DML (.sql)
apiRouter.get('/backup/download-sql', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || user.perfil !== 'admin') {
    res.status(403).json({ error: 'Acesso negado. A exportação do banco de dados é restrita a Administradores.' });
    return;
  }

  try {
    const timestamp = getBackupTimestamp();
    const filename = `backup_almoxarifado_${timestamp}.sql`;

    const schemaPath = path.resolve(process.cwd(), 'schema.sql');
    const ddl = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf-8') : '';

    let sql = `-- ============================================================================\n`;
    sql += `-- MULTI ALMOX - BACKUP COMPLETO DO BANCO DE DADOS (SQL DUMP)\n`;
    sql += `-- Data de Geração: ${new Date().toLocaleString('pt-BR')}\n`;
    sql += `-- Sistema: Multi Almox (Padrão Salutem)\n`;
    sql += `-- Versão: 2.4 | Arquivo de Origem: almoxarifado.db\n`;
    sql += `-- ============================================================================\n\n`;

    sql += `-- ----------------------------------------------------------------------------\n`;
    sql += `-- 1. DEFINIÇÃO DA ESTRUTURA (DDL)\n`;
    sql += `-- ----------------------------------------------------------------------------\n\n`;
    sql += ddl + `\n\n`;

    sql += `-- ----------------------------------------------------------------------------\n`;
    sql += `-- 2. CARGA DE DADOS (DML / INSERTS)\n`;
    sql += `-- ----------------------------------------------------------------------------\n\n`;
    sql += `PRAGMA foreign_keys = OFF;\n\n`;

    const tables = [
      'empresas_unidades',
      'centros_custo',
      'usuarios',
      'produtos',
      'requisicoes',
      'itens_requisicao',
      'historico_requisicoes',
      'movimentacoes',
      'emprestimos'
    ];

    for (const table of tables) {
      try {
        const rows = db.prepare(`SELECT * FROM ${table}`).all() as any[];
        sql += `-- Tabela: ${table} (${rows.length} registros)\n`;
        if (rows.length > 0) {
          for (const row of rows) {
            const cols = Object.keys(row);
            const vals = cols.map((c) => {
              const val = row[c];
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'number') return String(val);
              return `'${String(val).replace(/'/g, "''")}'`;
            });
            sql += `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});\n`;
          }
        }
        sql += `\n`;
      } catch (tableErr: any) {
        sql += `-- Erro ao exportar tabela ${table}: ${tableErr.message}\n\n`;
      }
    }

    sql += `PRAGMA foreign_keys = ON;\n`;
    sql += `-- Fim do dump SQL gerado com sucesso\n`;

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(sql);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao gerar script SQL (.sql): ' + err.message });
  }
});

// 13.4 Download dos Dados em Formato JSON (.json)
apiRouter.get('/backup/download-json', (req, res) => {
  const user = authenticateRequest(req);
  if (!user || user.perfil !== 'admin') {
    res.status(403).json({ error: 'Acesso negado. A exportação do banco de dados é restrita a Administradores.' });
    return;
  }

  try {
    const timestamp = getBackupTimestamp();
    const filename = `backup_almoxarifado_${timestamp}.json`;

    const tables = [
      'empresas_unidades',
      'centros_custo',
      'usuarios',
      'produtos',
      'requisicoes',
      'itens_requisicao',
      'historico_requisicoes',
      'movimentacoes',
      'emprestimos'
    ];

    const exportData: Record<string, any> = {
      metadata: {
        sistema: 'Multi Almox',
        versao: '2.4',
        padrao: 'Salutem Hospitalar',
        gerado_em: new Date().toISOString(),
        gerado_por: {
          id: user.id,
          nome: user.nome,
          login: user.login,
          perfil: user.perfil,
        },
      },
      tabelas: {}
    };

    for (const table of tables) {
      try {
        exportData.tabelas[table] = db.prepare(`SELECT * FROM ${table}`).all();
      } catch {
        exportData.tabelas[table] = [];
      }
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao gerar exportação JSON: ' + err.message });
  }
});
