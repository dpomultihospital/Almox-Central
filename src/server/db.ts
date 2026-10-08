import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const FALLBACK_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS empresas_unidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    cnpj TEXT,
    endereco TEXT,
    cidade TEXT,
    uf TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_empresas_codigo ON empresas_unidades (codigo);

CREATE TABLE IF NOT EXISTS centros_custo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    departamento TEXT NOT NULL,
    responsavel TEXT NOT NULL,
    empresa_id INTEGER REFERENCES empresas_unidades(id) ON DELETE SET NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_centros_custo_codigo ON centros_custo (codigo);
CREATE INDEX IF NOT EXISTS idx_centros_custo_ativo ON centros_custo (ativo);

CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT,
    nome TEXT NOT NULL,
    login TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    cpf TEXT,
    email TEXT,
    perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'almoxarife', 'requisitante')),
    centro_custo_id INTEGER REFERENCES centros_custo(id) ON DELETE SET NULL,
    empresa_id INTEGER REFERENCES empresas_unidades(id) ON DELETE SET NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_acesso DATETIME
);
CREATE INDEX IF NOT EXISTS idx_usuarios_login ON usuarios (login);
CREATE INDEX IF NOT EXISTS idx_usuarios_perfil ON usuarios (perfil);
CREATE INDEX IF NOT EXISTS idx_usuarios_centro_custo ON usuarios (centro_custo_id);

CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    unidade_medida TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('consumivel', 'nao_consumivel')),
    estoque_minimo REAL NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
    estoque_maximo REAL NOT NULL DEFAULT 0 CHECK (estoque_maximo >= 0),
    quantidade_atual REAL NOT NULL DEFAULT 0 CHECK (quantidade_atual >= 0),
    valor_unitario REAL NOT NULL DEFAULT 0,
    localizacao TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos (codigo);
CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON produtos (tipo);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos (ativo);

CREATE TABLE IF NOT EXISTS requisicoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_requisicao TEXT UNIQUE NOT NULL,
    centro_custo_id INTEGER NOT NULL REFERENCES centros_custo(id),
    solicitante_id INTEGER NOT NULL REFERENCES usuarios(id),
    almoxarife_id INTEGER REFERENCES usuarios(id),
    data_solicitacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_atendimento DATETIME,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada_atendida', 'rejeitada', 'cancelada')),
    prioridade TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('normal', 'urgente')),
    motivo_rejeicao TEXT,
    observacao TEXT
);
CREATE INDEX IF NOT EXISTS idx_requisicoes_numero ON requisicoes (numero_requisicao);
CREATE INDEX IF NOT EXISTS idx_requisicoes_status ON requisicoes (status);
CREATE INDEX IF NOT EXISTS idx_requisicoes_centro_custo ON requisicoes (centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_requisicoes_solicitante ON requisicoes (solicitante_id);

CREATE TABLE IF NOT EXISTS itens_requisicao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requisicao_id INTEGER NOT NULL REFERENCES requisicoes(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    quantidade_solicitada REAL NOT NULL CHECK (quantidade_solicitada > 0),
    quantidade_atendida REAL NOT NULL DEFAULT 0 CHECK (quantidade_atendida >= 0),
    status_item TEXT NOT NULL DEFAULT 'pendente' CHECK (status_item IN ('pendente', 'aprovado', 'negado')),
    analisado_por_id INTEGER REFERENCES usuarios(id),
    data_analise DATETIME,
    motivo_decisao TEXT
);
CREATE INDEX IF NOT EXISTS idx_itens_requisicao_req ON itens_requisicao (requisicao_id);
CREATE INDEX IF NOT EXISTS idx_itens_requisicao_prod ON itens_requisicao (produto_id);
CREATE INDEX IF NOT EXISTS idx_itens_requisicao_status ON itens_requisicao (status_item);

CREATE TABLE IF NOT EXISTS historico_requisicoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requisicao_id INTEGER NOT NULL REFERENCES requisicoes(id) ON DELETE CASCADE,
    item_requisicao_id INTEGER REFERENCES itens_requisicao(id) ON DELETE SET NULL,
    produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    acao TEXT NOT NULL CHECK (acao IN (
        'criacao_requisicao',
        'inclusao_item',
        'aprovacao_item',
        'negacao_item',
        'aprovacao_total',
        'aprovacao_parcial',
        'rejeicao_total',
        'cancelamento'
    )),
    status_anterior TEXT,
    status_novo TEXT,
    quantidade_solicitada REAL,
    quantidade_atendida REAL,
    detalhes TEXT NOT NULL,
    justificativa TEXT,
    data_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hist_req_requisicao ON historico_requisicoes (requisicao_id);
CREATE INDEX IF NOT EXISTS idx_hist_req_item ON historico_requisicoes (item_requisicao_id);
CREATE INDEX IF NOT EXISTS idx_hist_req_usuario ON historico_requisicoes (usuario_id);
CREATE INDEX IF NOT EXISTS idx_hist_req_data ON historico_requisicoes (data_registro);

CREATE TABLE IF NOT EXISTS movimentacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'estorno_entrada', 'estorno_saida')),
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    quantidade REAL NOT NULL CHECK (quantidade > 0),
    centro_custo_id INTEGER REFERENCES centros_custo(id),
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    documento_referencia TEXT,
    numero_lote TEXT,
    data_validade DATE,
    valor_unitario REAL,
    observacao TEXT,
    data_movimentacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto ON movimentacoes (produto_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo ON movimentacoes (tipo);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_centro_custo ON movimentacoes (centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON movimentacoes (data_movimentacao);

CREATE TABLE IF NOT EXISTS emprestimos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_emprestimo TEXT,
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    quantidade REAL NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    centro_custo_id INTEGER NOT NULL REFERENCES centros_custo(id),
    solicitante_id INTEGER NOT NULL REFERENCES usuarios(id),
    almoxarife_liberacao_id INTEGER NOT NULL REFERENCES usuarios(id),
    almoxarife_recebimento_id INTEGER REFERENCES usuarios(id),
    data_emprestimo DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_prevista_devolucao DATE NOT NULL,
    data_devolucao DATETIME,
    status TEXT NOT NULL DEFAULT 'emprestado' CHECK (status IN ('emprestado', 'devolvido', 'atrasado')),
    condicao_saida TEXT,
    condicao_devolucao TEXT,
    observacao TEXT
);
CREATE INDEX IF NOT EXISTS idx_emprestimos_produto ON emprestimos (produto_id);
CREATE INDEX IF NOT EXISTS idx_emprestimos_status ON emprestimos (status);
CREATE INDEX IF NOT EXISTS idx_emprestimos_solicitante ON emprestimos (solicitante_id);
`;

const FALLBACK_SEED_SQL = `
PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO empresas_unidades (id, codigo, nome, cnpj, endereco, cidade, uf, ativo) VALUES
(1, '001', 'Unidade Principal - Almoxarifado Central', NULL, NULL, NULL, NULL, 1);

INSERT OR IGNORE INTO usuarios (id, codigo, nome, login, senha_hash, cpf, email, perfil, centro_custo_id, empresa_id, ativo, ultimo_acesso) VALUES
(1, 'USR-0001', 'Administrador do Sistema', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', NULL, NULL, 'admin', NULL, 1, 1, CURRENT_TIMESTAMP);
`;

export function getSchemaSql(): string {
  const candidates = [
    path.resolve(process.cwd(), 'schema.sql'),
    path.resolve(PROJECT_ROOT, 'schema.sql'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
  }
  return FALLBACK_SCHEMA_SQL;
}

export function getSeedSql(): string {
  const candidates = [
    path.resolve(process.cwd(), 'seed.sql'),
    path.resolve(PROJECT_ROOT, 'seed.sql'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
  }
  return FALLBACK_SEED_SQL;
}

function resolveDatabasePath(): string {
  if (process.env.SQLITE_DB_PATH) {
    return path.resolve(process.env.SQLITE_DB_PATH);
  }

  const isVercel = Boolean(process.env.VERCEL);
  const localDbCandidates = [
    path.resolve(process.cwd(), 'almoxarifado.db'),
    path.resolve(PROJECT_ROOT, 'almoxarifado.db'),
  ];
  const bundledDbPath = localDbCandidates.find((p) => fs.existsSync(p)) || localDbCandidates[0];

  if (isVercel) {
    const tmpDbPath = path.join(os.tmpdir(), 'almoxarifado.db');
    if (!fs.existsSync(tmpDbPath) && fs.existsSync(bundledDbPath)) {
      try {
        fs.copyFileSync(bundledDbPath, tmpDbPath);
      } catch (err) {
        console.warn('Não foi possível copiar banco inicial para /tmp:', err);
      }
    }
    return tmpDbPath;
  }

  return bundledDbPath;
}

export const DB_PATH = resolveDatabasePath();

export const db = new DatabaseSync(DB_PATH);

// Configurações vitais de integridade e desempenho
db.exec('PRAGMA foreign_keys = ON;');
try {
  db.exec('PRAGMA journal_mode = WAL;');
} catch {
  // Fallback caso o sistema de arquivos não suporte WAL
}

/**
 * Inicializa o banco de dados executando schema.sql e seed.sql se necessário
 */
export function initDatabase() {
  const schemaSql = getSchemaSql();
  const seedSql = getSeedSql();

  if (schemaSql) {
    db.exec(schemaSql);
  }

  // Verifica se já existem centros de custo ou empresas cadastradas
  try {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='empresas_unidades'").get();
    if (!tableCheck) {
      if (schemaSql) {
        db.exec(schemaSql);
      }
      if (seedSql) {
        db.exec(seedSql);
      }
      return;
    }

    const countResult = db.prepare('SELECT COUNT(*) as count FROM usuarios').get() as { count: number };
    if (!countResult || countResult.count === 0) {
      if (seedSql) {
        db.exec(seedSql);
      }
    }
  } catch (err) {
    console.error('Erro ao verificar dados iniciais:', err);
  }

  // Garante migração de colunas de auditoria de itens e histórico de requisições
  ensureRequisicaoAuditSchema();

  // Atualiza status de empréstimos em atraso automaticamente
  updateOverdueLoans();
}

/**
 * Garante que bancos existentes possuam as colunas de auditoria por item
 * e a tabela historico_requisicoes devidamente populada para rastreabilidade
 */
export function ensureRequisicaoAuditSchema() {
  try {
    // 1. Verifica colunas em itens_requisicao
    const cols = db.prepare("PRAGMA table_info('itens_requisicao')").all() as Array<{ name: string }>;
    const colNames = new Set(cols.map((c) => c.name));

    if (!colNames.has('status_item')) {
      db.exec("ALTER TABLE itens_requisicao ADD COLUMN status_item TEXT NOT NULL DEFAULT 'pendente';");
    }
    if (!colNames.has('analisado_por_id')) {
      db.exec('ALTER TABLE itens_requisicao ADD COLUMN analisado_por_id INTEGER REFERENCES usuarios(id);');
    }
    if (!colNames.has('data_analise')) {
      db.exec('ALTER TABLE itens_requisicao ADD COLUMN data_analise DATETIME;');
    }
    if (!colNames.has('motivo_decisao')) {
      db.exec('ALTER TABLE itens_requisicao ADD COLUMN motivo_decisao TEXT;');
    }

    // 2. Garante a tabela historico_requisicoes
    db.exec(`
      CREATE TABLE IF NOT EXISTS historico_requisicoes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          requisicao_id INTEGER NOT NULL REFERENCES requisicoes(id) ON DELETE CASCADE,
          item_requisicao_id INTEGER REFERENCES itens_requisicao(id) ON DELETE SET NULL,
          produto_id INTEGER REFERENCES produtos(id) ON DELETE SET NULL,
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
          acao TEXT NOT NULL CHECK (acao IN (
              'criacao_requisicao',
              'inclusao_item',
              'aprovacao_item',
              'negacao_item',
              'aprovacao_total',
              'aprovacao_parcial',
              'rejeicao_total',
              'cancelamento'
          )),
          status_anterior TEXT,
          status_novo TEXT,
          quantidade_solicitada REAL,
          quantidade_atendida REAL,
          detalhes TEXT NOT NULL,
          justificativa TEXT,
          data_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_hist_req_requisicao ON historico_requisicoes (requisicao_id);
      CREATE INDEX IF NOT EXISTS idx_hist_req_item ON historico_requisicoes (item_requisicao_id);
      CREATE INDEX IF NOT EXISTS idx_hist_req_usuario ON historico_requisicoes (usuario_id);
      CREATE INDEX IF NOT EXISTS idx_hist_req_data ON historico_requisicoes (data_registro);
    `);

    // 3. Backfill de auditoria para requisições existentes que ainda não tenham histórico
    const reqsSemHistorico = db.prepare(`
      SELECT r.*
      FROM requisicoes r
      WHERE NOT EXISTS (
        SELECT 1 FROM historico_requisicoes hr WHERE hr.requisicao_id = r.id
      )
      ORDER BY r.id ASC
    `).all() as any[];

    if (reqsSemHistorico.length > 0) {
      const insertHist = db.prepare(`
        INSERT INTO historico_requisicoes (
          requisicao_id, item_requisicao_id, produto_id, usuario_id, acao,
          status_anterior, status_novo, quantidade_solicitada, quantidade_atendida,
          detalhes, justificativa, data_registro
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateItemAudit = db.prepare(`
        UPDATE itens_requisicao
        SET status_item = ?, analisado_por_id = ?, data_analise = ?, motivo_decisao = ?
        WHERE id = ?
      `);

      for (const req of reqsSemHistorico) {
        const itens = db.prepare(`
          SELECT ir.*, p.codigo as produto_codigo, p.nome as produto_nome, p.unidade_medida
          FROM itens_requisicao ir
          JOIN produtos p ON ir.produto_id = p.id
          WHERE ir.requisicao_id = ?
        `).all(req.id) as any[];

        // Log de abertura da requisição
        insertHist.run(
          req.id,
          null,
          null,
          req.solicitante_id,
          'criacao_requisicao',
          null,
          'pendente',
          null,
          null,
          `Requisição ${req.numero_requisicao} aberta com prioridade ${(req.prioridade || 'normal').toUpperCase()} contendo ${itens.length} item(ns).`,
          req.observacao || null,
          req.data_solicitacao
        );

        // Log de inclusão de cada item
        for (const it of itens) {
          insertHist.run(
            req.id,
            it.id,
            it.produto_id,
            req.solicitante_id,
            'inclusao_item',
            null,
            'pendente',
            it.quantidade_solicitada,
            0,
            `Item solicitado: ${it.produto_codigo} - ${it.produto_nome} (${it.quantidade_solicitada} ${it.unidade_medida}).`,
            null,
            req.data_solicitacao
          );
        }

        const responsavelAnaliseId = req.almoxarife_id || req.solicitante_id || 1;
        const dataDecisao = req.data_atendimento || req.data_solicitacao;

        if (req.status === 'aprovada_atendida') {
          for (const it of itens) {
            const qtdAtendida = it.quantidade_atendida > 0 ? it.quantidade_atendida : it.quantidade_solicitada;
            const parecerItem = 'Item conferido, aprovado e baixado no estoque.';
            updateItemAudit.run('aprovado', responsavelAnaliseId, dataDecisao, parecerItem, it.id);

            insertHist.run(
              req.id,
              it.id,
              it.produto_id,
              responsavelAnaliseId,
              'aprovacao_item',
              'pendente',
              'aprovado',
              it.quantidade_solicitada,
              qtdAtendida,
              `Item APROVADO: ${it.produto_codigo} - ${it.produto_nome}. Quantidade atendida: ${qtdAtendida} ${it.unidade_medida}.`,
              parecerItem,
              dataDecisao
            );
          }

          insertHist.run(
            req.id,
            null,
            null,
            responsavelAnaliseId,
            'aprovacao_total',
            'pendente',
            'aprovada_atendida',
            null,
            null,
            `Requisição ${req.numero_requisicao} aprovada integralmente e atendida com baixa automática de saldo.`,
            req.observacao || 'Atendimento concluído em conformidade.',
            dataDecisao
          );
        } else if (req.status === 'rejeitada') {
          const motivo = req.motivo_rejeicao || 'Indeferido na análise técnica do almoxarifado.';
          for (const it of itens) {
            updateItemAudit.run('negado', responsavelAnaliseId, dataDecisao, motivo, it.id);

            insertHist.run(
              req.id,
              it.id,
              it.produto_id,
              responsavelAnaliseId,
              'negacao_item',
              'pendente',
              'negado',
              it.quantidade_solicitada,
              0,
              `Item NEGADO: ${it.produto_codigo} - ${it.produto_nome} (${it.quantidade_solicitada} ${it.unidade_medida}).`,
              motivo,
              dataDecisao
            );
          }

          insertHist.run(
            req.id,
            null,
            null,
            responsavelAnaliseId,
            'rejeicao_total',
            'pendente',
            'rejeitada',
            null,
            null,
            `Requisição ${req.numero_requisicao} rejeitada após análise do almoxarifado.`,
            motivo,
            dataDecisao
          );
        } else if (req.status === 'cancelada') {
          insertHist.run(
            req.id,
            null,
            null,
            req.solicitante_id,
            'cancelamento',
            'pendente',
            'cancelada',
            null,
            null,
            `Requisição ${req.numero_requisicao} cancelada pelo solicitante.`,
            null,
            dataDecisao
          );
        }
      }
    }
  } catch (err) {
    console.error('Erro ao garantir schema de auditoria de requisições:', err);
  }
}

/**
 * Atualiza dinamicamente status dos empréstimos cuja data prevista já expirou
 */
export function updateOverdueLoans() {
  try {
    db.exec(`
      UPDATE emprestimos
      SET status = 'atrasado'
      WHERE status = 'emprestado' 
        AND date(data_prevista_devolucao) < date('now');
    `);
  } catch (err) {
    console.error('Erro ao atualizar empréstimos atrasados:', err);
  }
}

/**
 * Helper para executar operações atômicas ACID (transações)
 */
export function runInTransaction<T>(callback: () => T): T {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = callback();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch (rbError) {
      console.error('Erro ao efetuar rollback:', rbError);
    }
    throw error;
  }
}

/**
 * Reseta o banco de dados completamente para o estado do Seed
 */
export function resetDatabase() {
  const schemaSql = getSchemaSql();
  const seedSql = getSeedSql();

  runInTransaction(() => {
    // Desativa temporariamente chaves para limpar tabelas
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec(`
      DROP TABLE IF EXISTS emprestimos;
      DROP TABLE IF EXISTS movimentacoes;
      DROP TABLE IF EXISTS historico_requisicoes;
      DROP TABLE IF EXISTS itens_requisicao;
      DROP TABLE IF EXISTS requisicoes;
      DROP TABLE IF EXISTS produtos;
      DROP TABLE IF EXISTS usuarios;
      DROP TABLE IF EXISTS centros_custo;
      DROP TABLE IF EXISTS empresas_unidades;
    `);
    db.exec('PRAGMA foreign_keys = ON;');

    if (schemaSql) {
      db.exec(schemaSql);
    }
    if (seedSql) {
      db.exec(seedSql);
    }

    try {
      db.exec("DELETE FROM sqlite_sequence WHERE name IN ('centros_custo', 'produtos', 'requisicoes', 'itens_requisicao', 'historico_requisicoes', 'movimentacoes', 'emprestimos');");
    } catch {
      // Ignora se sqlite_sequence ainda não existir
    }
  });

  updateOverdueLoans();
}
