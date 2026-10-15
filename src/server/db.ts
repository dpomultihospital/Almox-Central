import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
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

CREATE TABLE IF NOT EXISTS fornecedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT UNIQUE,
    tipo_entidade TEXT NOT NULL DEFAULT 'fornecedor_comercial' CHECK (tipo_entidade IN ('fornecedor_comercial', 'entidade_parceira')),
    inscricao_estadual TEXT,
    telefone TEXT,
    email TEXT,
    contato_responsavel TEXT,
    endereco TEXT,
    cidade TEXT,
    uf TEXT,
    observacoes TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fornecedores_codigo ON fornecedores (codigo);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON fornecedores (cnpj);
CREATE INDEX IF NOT EXISTS idx_fornecedores_tipo ON fornecedores (tipo_entidade);
CREATE INDEX IF NOT EXISTS idx_fornecedores_ativo ON fornecedores (ativo);

CREATE TABLE IF NOT EXISTS fornecedores_entidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT,
    cnpj TEXT UNIQUE,
    tipo_entidade TEXT NOT NULL DEFAULT 'fornecedor_comercial' CHECK (tipo_entidade IN ('fornecedor_comercial', 'entidade_parceira')),
    inscricao_estadual TEXT,
    telefone TEXT,
    email TEXT,
    contato_responsavel TEXT,
    endereco TEXT,
    cidade TEXT,
    uf TEXT,
    observacoes TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grupos_produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE,
    nome TEXT NOT NULL,
    tipo_padrao TEXT NOT NULL DEFAULT 'consumivel' CHECK (tipo_padrao IN ('consumivel', 'nao_consumivel')),
    ativo INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_grupos_produtos_codigo ON grupos_produtos (codigo);
CREATE INDEX IF NOT EXISTS idx_grupos_produtos_ativo ON grupos_produtos (ativo);

CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    grupo_id INTEGER REFERENCES grupos_produtos(id),
    unidade_medida TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('consumivel', 'nao_consumivel')),
    controla_validade INTEGER NOT NULL DEFAULT 1,
    estoque_minimo REAL NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
    estoque_maximo REAL NOT NULL DEFAULT 0 CHECK (estoque_maximo >= 0),
    quantidade_atual REAL NOT NULL DEFAULT 0 CHECK (quantidade_atual >= 0),
    valor_unitario REAL NOT NULL DEFAULT 0,
    custo_unitario REAL NOT NULL DEFAULT 0,
    localizacao TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos (codigo);
CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON produtos (tipo);
CREATE INDEX IF NOT EXISTS idx_produtos_grupo ON produtos (grupo_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos (ativo);

CREATE TABLE IF NOT EXISTS produto_fornecedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
    marca TEXT,
    nomenclatura_fornecedor TEXT,
    codigo_referencia_fornecedor TEXT,
    ultimo_valor_unitario REAL,
    ultima_compra DATETIME,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_prod_forn_produto ON produto_fornecedores (produto_id);
CREATE INDEX IF NOT EXISTS idx_prod_forn_fornecedor ON produto_fornecedores (fornecedor_id);

CREATE TABLE IF NOT EXISTS lotes_estoque (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    numero_lote TEXT NOT NULL,
    data_validade DATE,
    quantidade_inicial REAL NOT NULL DEFAULT 0,
    quantidade_atual REAL NOT NULL DEFAULT 0 CHECK (quantidade_atual >= 0),
    fornecedor_id INTEGER REFERENCES fornecedores(id) ON DELETE SET NULL,
    documento_referencia TEXT,
    marca TEXT,
    nomenclatura_fornecedor TEXT,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lotes_produto ON lotes_estoque (produto_id);
CREATE INDEX IF NOT EXISTS idx_lotes_validade ON lotes_estoque (data_validade);
CREATE INDEX IF NOT EXISTS idx_lotes_numero ON lotes_estoque (numero_lote);

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
        'cancelamento',
        'alteracao_prioridade'
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
    motivo_diverso TEXT,
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    lote_id INTEGER REFERENCES lotes_estoque(id) ON DELETE SET NULL,
    quantidade REAL NOT NULL CHECK (quantidade > 0),
    centro_custo_id INTEGER REFERENCES centros_custo(id),
    fornecedor_id INTEGER REFERENCES fornecedores(id) ON DELETE SET NULL,
    emprestimo_institucional_id INTEGER,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    responsavel_nome TEXT,
    documento_referencia TEXT,
    numero_lote TEXT,
    data_validade DATE,
    valor_unitario REAL,
    marca TEXT,
    nomenclatura_fornecedor TEXT,
    observacao TEXT,
    data_movimentacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto ON movimentacoes (produto_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_lote ON movimentacoes (lote_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo ON movimentacoes (tipo);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_centro_custo ON movimentacoes (centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_fornecedor ON movimentacoes (fornecedor_id);
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

CREATE TABLE IF NOT EXISTS emprestimos_institucionais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_documento TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('recebido', 'concedido')),
    entidade_id INTEGER NOT NULL REFERENCES fornecedores(id),
    entidade_nome TEXT,
    data_operacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_prevista_devolucao DATE,
    data_quitacao DATETIME,
    status TEXT NOT NULL DEFAULT 'pendente_devolucao' CHECK (status IN ('pendente_devolucao', 'quitado')),
    responsavel_almoxarifado_id INTEGER NOT NULL REFERENCES usuarios(id),
    responsavel_almoxarifado_nome TEXT,
    responsavel_entidade_nome TEXT,
    observacao TEXT
);
CREATE INDEX IF NOT EXISTS idx_emp_inst_entidade ON emprestimos_institucionais (entidade_id);
CREATE INDEX IF NOT EXISTS idx_emp_inst_status ON emprestimos_institucionais (status);
CREATE INDEX IF NOT EXISTS idx_emp_inst_tipo ON emprestimos_institucionais (tipo);

CREATE TABLE IF NOT EXISTS itens_emprestimo_institucional (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emprestimo_id INTEGER NOT NULL REFERENCES emprestimos_institucionais(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    lote_id INTEGER REFERENCES lotes_estoque(id) ON DELETE SET NULL,
    numero_lote TEXT,
    data_validade DATE,
    quantidade REAL NOT NULL CHECK (quantidade > 0),
    quantidade_devolvida REAL NOT NULL DEFAULT 0 CHECK (quantidade_devolvida >= 0)
);
CREATE INDEX IF NOT EXISTS idx_itens_emp_inst_emp ON itens_emprestimo_institucional (emprestimo_id);
CREATE INDEX IF NOT EXISTS idx_itens_emp_inst_prod ON itens_emprestimo_institucional (produto_id);

CREATE TABLE IF NOT EXISTS inventarios_estoque (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    empresa_id INTEGER,
    centro_custo_id INTEGER NOT NULL REFERENCES centros_custo(id),
    zera_por_lote INTEGER DEFAULT 0,
    zera_nao_listados INTEGER DEFAULT 0,
    observacao TEXT,
    finalizado INTEGER DEFAULT 0,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inventarios_codigo ON inventarios_estoque (codigo);
CREATE INDEX IF NOT EXISTS idx_inventarios_data ON inventarios_estoque (data);
CREATE INDEX IF NOT EXISTS idx_inventarios_centro_custo ON inventarios_estoque (centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_inventarios_finalizado ON inventarios_estoque (finalizado);

CREATE TABLE IF NOT EXISTS itens_inventario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventario_id INTEGER NOT NULL REFERENCES inventarios_estoque(id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    lote_id INTEGER REFERENCES lotes_estoque(id),
    numero_lote TEXT,
    data_validade DATE,
    quantidade_sistema REAL NOT NULL,
    quantidade_fisica REAL NOT NULL,
    diferenca REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_itens_inv_inventario ON itens_inventario (inventario_id);
CREATE INDEX IF NOT EXISTS idx_itens_inv_produto ON itens_inventario (produto_id);
CREATE INDEX IF NOT EXISTS idx_itens_inv_lote ON itens_inventario (lote_id);
`;

const FALLBACK_SEED_SQL = `
PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO empresas_unidades (id, codigo, nome, cnpj, endereco, cidade, uf, ativo) VALUES
(1, '001', 'Unidade Principal - Almoxarifado Central', NULL, NULL, NULL, NULL, 1);

INSERT OR IGNORE INTO usuarios (id, codigo, nome, login, senha_hash, cpf, email, perfil, centro_custo_id, empresa_id, ativo, ultimo_acesso) VALUES
(1, 'USR-0001', 'Administrador do Sistema', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', NULL, NULL, 'admin', NULL, 1, 1, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO centros_custo (id, codigo, nome, departamento, responsavel, empresa_id, ativo, criado_em) VALUES
(7, '7 - 1.02', 'ALMOXARIFADO CENTRAL', 'ALMOXARIFADO', 'Gestor de Estoque', 1, 1, CURRENT_TIMESTAMP);
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
    const customPath = path.resolve(process.env.SQLITE_DB_PATH);
    const parentDir = path.dirname(customPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    return customPath;
  }

  const localDbCandidates = [
    path.resolve(process.cwd(), 'almoxarifado.db'),
    path.resolve(PROJECT_ROOT, 'almoxarifado.db'),
  ];
  return localDbCandidates.find((p) => fs.existsSync(p)) || localDbCandidates[0];
}

export const DB_PATH = resolveDatabasePath();

export const db = new DatabaseSync(DB_PATH);

// Configurações vitais de integridade e concorrência para servidor dedicado (Ubuntu Server)
db.exec('PRAGMA foreign_keys = ON;');
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
} catch {
  // Fallback caso o sistema de arquivos não suporte WAL
}

/**
 * Inicializa o banco de dados executando schema.sql e seed.sql se necessário
 */
export function initDatabase() {
  const schemaSql = getSchemaSql();
  const seedSql = getSeedSql();

  try {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='empresas_unidades'").get();
    if (!tableCheck) {
      // Banco novo: cria schema completo e executa seed inicial
      if (schemaSql) {
        db.exec(schemaSql);
      }
      if (seedSql) {
        db.exec(seedSql);
      }
    } else {
      // Banco existente: executa migrações primeiro para garantir novas colunas
      ensureFornecedoresSchema();
      ensureRequisicaoAuditSchema();
      ensureInventariosSchema();
      ensureGruposProdutosSchema();

      // Em seguida aplica o schema para criar quaisquer tabelas novas adicionais
      if (schemaSql) {
        try {
          db.exec(schemaSql);
        } catch (schemaErr) {
          console.warn('[DB] Algumas regras do schema já existiam ou foram tratadas:', (schemaErr as Error).message);
        }
      }
    }

    const countResult = db.prepare('SELECT COUNT(*) as count FROM usuarios').get() as { count: number } | undefined;
    if (!countResult || countResult.count === 0) {
      if (seedSql) {
        db.exec(seedSql);
      }
    }
  } catch (err) {
    console.error('Erro ao verificar dados iniciais:', err);
  }

  // Garante que todas as migrações e rotinas de integridade foram consolidadas
  ensureFornecedoresSchema();
  ensureRequisicaoAuditSchema();
  ensureInventariosSchema();
  ensureGruposProdutosSchema();

  // Atualiza status de empréstimos em atraso automaticamente
  updateOverdueLoans();
}

/**
 * Garante as tabelas fornecedores e produto_fornecedores, além das colunas
 * fornecedor_id, marca e nomenclatura_fornecedor em movimentacoes
 */
export function ensureFornecedoresSchema() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS fornecedores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo TEXT UNIQUE NOT NULL,
          razao_social TEXT NOT NULL,
          nome_fantasia TEXT,
          cnpj TEXT UNIQUE,
          tipo_entidade TEXT NOT NULL DEFAULT 'fornecedor_comercial' CHECK (tipo_entidade IN ('fornecedor_comercial', 'entidade_parceira')),
          inscricao_estadual TEXT,
          telefone TEXT,
          email TEXT,
          contato_responsavel TEXT,
          endereco TEXT,
          cidade TEXT,
          uf TEXT,
          observacoes TEXT,
          ativo INTEGER NOT NULL DEFAULT 1,
          criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_fornecedores_codigo ON fornecedores (codigo);
      CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON fornecedores (cnpj);
      CREATE INDEX IF NOT EXISTS idx_fornecedores_ativo ON fornecedores (ativo);

      CREATE TABLE IF NOT EXISTS fornecedores_entidades (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo TEXT UNIQUE NOT NULL,
          razao_social TEXT NOT NULL,
          nome_fantasia TEXT,
          cnpj TEXT UNIQUE,
          tipo_entidade TEXT NOT NULL DEFAULT 'fornecedor_comercial' CHECK (tipo_entidade IN ('fornecedor_comercial', 'entidade_parceira')),
          inscricao_estadual TEXT,
          telefone TEXT,
          email TEXT,
          contato_responsavel TEXT,
          endereco TEXT,
          cidade TEXT,
          uf TEXT,
          observacoes TEXT,
          ativo INTEGER NOT NULL DEFAULT 1,
          criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS produto_fornecedores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
          fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
          marca TEXT,
          nomenclatura_fornecedor TEXT,
          codigo_referencia_fornecedor TEXT,
          ultimo_valor_unitario REAL,
          ultima_compra DATETIME,
          criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_prod_forn_produto ON produto_fornecedores (produto_id);
      CREATE INDEX IF NOT EXISTS idx_prod_forn_fornecedor ON produto_fornecedores (fornecedor_id);

      CREATE TABLE IF NOT EXISTS lotes_estoque (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
          numero_lote TEXT NOT NULL,
          data_validade DATE,
          quantidade_inicial REAL NOT NULL DEFAULT 0,
          quantidade_atual REAL NOT NULL DEFAULT 0 CHECK (quantidade_atual >= 0),
          fornecedor_id INTEGER REFERENCES fornecedores(id) ON DELETE SET NULL,
          documento_referencia TEXT,
          marca TEXT,
          nomenclatura_fornecedor TEXT,
          criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_lotes_produto ON lotes_estoque (produto_id);
      CREATE INDEX IF NOT EXISTS idx_lotes_validade ON lotes_estoque (data_validade);
      CREATE INDEX IF NOT EXISTS idx_lotes_numero ON lotes_estoque (numero_lote);

      CREATE TABLE IF NOT EXISTS emprestimos_institucionais (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          numero_documento TEXT UNIQUE NOT NULL,
          tipo TEXT NOT NULL CHECK (tipo IN ('recebido', 'concedido')),
          entidade_id INTEGER NOT NULL REFERENCES fornecedores(id),
          entidade_nome TEXT,
          data_operacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          data_prevista_devolucao DATE,
          data_quitacao DATETIME,
          status TEXT NOT NULL DEFAULT 'pendente_devolucao' CHECK (status IN ('pendente_devolucao', 'quitado')),
          responsavel_almoxarifado_id INTEGER NOT NULL REFERENCES usuarios(id),
          responsavel_almoxarifado_nome TEXT,
          responsavel_entidade_nome TEXT,
          observacao TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_emp_inst_entidade ON emprestimos_institucionais (entidade_id);
      CREATE INDEX IF NOT EXISTS idx_emp_inst_status ON emprestimos_institucionais (status);
      CREATE INDEX IF NOT EXISTS idx_emp_inst_tipo ON emprestimos_institucionais (tipo);

      CREATE TABLE IF NOT EXISTS itens_emprestimo_institucional (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          emprestimo_id INTEGER NOT NULL REFERENCES emprestimos_institucionais(id) ON DELETE CASCADE,
          produto_id INTEGER NOT NULL REFERENCES produtos(id),
          lote_id INTEGER REFERENCES lotes_estoque(id) ON DELETE SET NULL,
          numero_lote TEXT,
          data_validade DATE,
          quantidade REAL NOT NULL CHECK (quantidade > 0),
          quantidade_devolvida REAL NOT NULL DEFAULT 0 CHECK (quantidade_devolvida >= 0)
      );
      CREATE INDEX IF NOT EXISTS idx_itens_emp_inst_emp ON itens_emprestimo_institucional (emprestimo_id);
      CREATE INDEX IF NOT EXISTS idx_itens_emp_inst_prod ON itens_emprestimo_institucional (produto_id);
    `);

    const fornCols = db.prepare("PRAGMA table_info('fornecedores')").all() as Array<{ name: string }>;
    const fornColNames = new Set(fornCols.map((c) => c.name));
    if (!fornColNames.has('tipo_entidade')) {
      db.exec("ALTER TABLE fornecedores ADD COLUMN tipo_entidade TEXT NOT NULL DEFAULT 'fornecedor_comercial';");
    }

    const prodCols = db.prepare("PRAGMA table_info('produtos')").all() as Array<{ name: string }>;
    const prodColNames = new Set(prodCols.map((c) => c.name));
    if (!prodColNames.has('controla_validade')) {
      db.exec('ALTER TABLE produtos ADD COLUMN controla_validade INTEGER NOT NULL DEFAULT 1;');
    }

    const movCols = db.prepare("PRAGMA table_info('movimentacoes')").all() as Array<{ name: string }>;
    const movColNames = new Set(movCols.map((c) => c.name));

    if (!movColNames.has('fornecedor_id')) {
      db.exec('ALTER TABLE movimentacoes ADD COLUMN fornecedor_id INTEGER REFERENCES fornecedores(id) ON DELETE SET NULL;');
    }
    if (!movColNames.has('marca')) {
      db.exec('ALTER TABLE movimentacoes ADD COLUMN marca TEXT;');
    }
    if (!movColNames.has('nomenclatura_fornecedor')) {
      db.exec('ALTER TABLE movimentacoes ADD COLUMN nomenclatura_fornecedor TEXT;');
    }
    if (!movColNames.has('motivo_diverso')) {
      db.exec('ALTER TABLE movimentacoes ADD COLUMN motivo_diverso TEXT;');
    }
    if (!movColNames.has('lote_id')) {
      db.exec('ALTER TABLE movimentacoes ADD COLUMN lote_id INTEGER REFERENCES lotes_estoque(id) ON DELETE SET NULL;');
    }
    if (!movColNames.has('responsavel_nome')) {
      db.exec('ALTER TABLE movimentacoes ADD COLUMN responsavel_nome TEXT;');
    }
    if (!movColNames.has('emprestimo_institucional_id')) {
      db.exec('ALTER TABLE movimentacoes ADD COLUMN emprestimo_institucional_id INTEGER;');
    }

    // Garante coluna centro_custo_id em lotes_estoque
    const lotesCols = db.prepare("PRAGMA table_info('lotes_estoque')").all() as Array<{ name: string }>;
    const lotesColNames = new Set(lotesCols.map((c) => c.name));
    if (!lotesColNames.has('centro_custo_id')) {
      db.exec('ALTER TABLE lotes_estoque ADD COLUMN centro_custo_id INTEGER REFERENCES centros_custo(id);');
    }
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_lotes_centro_custo ON lotes_estoque (centro_custo_id);');
    } catch {
      // index exists
    }

    // Backfill lotes_estoque para produtos existentes com saldo > 0 que ainda não possuam lotes registrados
    const prodsSemLote = db.prepare(`
      SELECT p.id, p.quantidade_atual
      FROM produtos p
      WHERE p.quantidade_atual > 0
        AND NOT EXISTS (SELECT 1 FROM lotes_estoque le WHERE le.produto_id = p.id)
    `).all() as Array<{ id: number; quantidade_atual: number }>;

    if (prodsSemLote.length > 0) {
      const insertLote = db.prepare(`
        INSERT INTO lotes_estoque (
          produto_id, numero_lote, data_validade, quantidade_inicial, quantidade_atual,
          fornecedor_id, documento_referencia, marca, nomenclatura_fornecedor
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const pr of prodsSemLote) {
        const lastMov = db.prepare(`
          SELECT numero_lote, data_validade, fornecedor_id, documento_referencia, marca, nomenclatura_fornecedor
          FROM movimentacoes
          WHERE produto_id = ? AND tipo = 'entrada'
          ORDER BY id DESC LIMIT 1
        `).get(pr.id) as any;

        insertLote.run(
          pr.id,
          lastMov?.numero_lote || `LT-INI-${String(pr.id).padStart(3, '0')}`,
          lastMov?.data_validade || '2027-12-31',
          pr.quantidade_atual,
          pr.quantidade_atual,
          lastMov?.fornecedor_id || null,
          lastMov?.documento_referencia || 'SALDO-INICIAL',
          lastMov?.marca || null,
          lastMov?.nomenclatura_fornecedor || null
        );
      }
    }
  } catch (err) {
    console.error('Erro ao garantir schema de fornecedores, lotes e empréstimos:', err);
  }
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
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_itens_requisicao_status ON itens_requisicao (status_item);');
    } catch {
      // Índice já existente ou não necessário
    }

    // 2. Garante a tabela historico_requisicoes (com suporte a alteracao_prioridade)
    const histTableMeta = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='historico_requisicoes'")
      .get() as { sql?: string } | undefined;

    if (histTableMeta?.sql && !histTableMeta.sql.includes('alteracao_prioridade')) {
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec(`
        ALTER TABLE historico_requisicoes RENAME TO historico_requisicoes_old;
        CREATE TABLE historico_requisicoes (
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
                'cancelamento',
                'alteracao_prioridade'
            )),
            status_anterior TEXT,
            status_novo TEXT,
            quantidade_solicitada REAL,
            quantidade_atendida REAL,
            detalhes TEXT NOT NULL,
            justificativa TEXT,
            data_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO historico_requisicoes SELECT * FROM historico_requisicoes_old;
        DROP TABLE historico_requisicoes_old;
      `);
      db.exec('PRAGMA foreign_keys = ON;');
    }

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
              'cancelamento',
              'alteracao_prioridade'
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
 * Garante as tabelas inventarios_estoque e itens_inventario para o módulo de inventário físico
 */
export function ensureInventariosSchema() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS inventarios_estoque (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo TEXT UNIQUE NOT NULL,
          data DATE NOT NULL,
          hora TIME NOT NULL,
          empresa_id INTEGER,
          centro_custo_id INTEGER NOT NULL REFERENCES centros_custo(id),
          zera_por_lote INTEGER DEFAULT 0,
          zera_nao_listados INTEGER DEFAULT 0,
          observacao TEXT,
          finalizado INTEGER DEFAULT 0,
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_inventarios_codigo ON inventarios_estoque (codigo);
      CREATE INDEX IF NOT EXISTS idx_inventarios_data ON inventarios_estoque (data);
      CREATE INDEX IF NOT EXISTS idx_inventarios_centro_custo ON inventarios_estoque (centro_custo_id);
      CREATE INDEX IF NOT EXISTS idx_inventarios_finalizado ON inventarios_estoque (finalizado);

      CREATE TABLE IF NOT EXISTS itens_inventario (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          inventario_id INTEGER NOT NULL REFERENCES inventarios_estoque(id) ON DELETE CASCADE,
          produto_id INTEGER NOT NULL REFERENCES produtos(id),
          lote_id INTEGER REFERENCES lotes_estoque(id),
          numero_lote TEXT,
          data_validade DATE,
          quantidade_sistema REAL NOT NULL,
          quantidade_fisica REAL NOT NULL,
          diferenca REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_itens_inv_inventario ON itens_inventario (inventario_id);
      CREATE INDEX IF NOT EXISTS idx_itens_inv_produto ON itens_inventario (produto_id);
      CREATE INDEX IF NOT EXISTS idx_itens_inv_lote ON itens_inventario (lote_id);
    `);
  } catch (err) {
    console.error('Erro ao garantir schema de inventários de estoque:', err);
  }
}

/**
 * Garante a tabela grupos_produtos, o seed dos 15 grupos oficiais e as colunas grupo_id e custo_unitario na tabela produtos
 */
export function ensureGruposProdutosSchema() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS grupos_produtos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo TEXT UNIQUE,
          nome TEXT NOT NULL,
          tipo_padrao TEXT NOT NULL DEFAULT 'consumivel' CHECK (tipo_padrao IN ('consumivel', 'nao_consumivel')),
          ativo INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_grupos_produtos_codigo ON grupos_produtos (codigo);
      CREATE INDEX IF NOT EXISTS idx_grupos_produtos_ativo ON grupos_produtos (ativo);
    `);

    // Migração de colunas na tabela produtos
    const prodCols = new Set(
      (db.prepare("PRAGMA table_info('produtos')").all() as Array<{ name: string }>).map((c) => c.name)
    );

    if (!prodCols.has('grupo_id')) {
      db.exec('ALTER TABLE produtos ADD COLUMN grupo_id INTEGER REFERENCES grupos_produtos(id);');
    }

    if (!prodCols.has('custo_unitario')) {
      db.exec('ALTER TABLE produtos ADD COLUMN custo_unitario REAL DEFAULT 0.0;');
      db.exec('UPDATE produtos SET custo_unitario = valor_unitario WHERE (custo_unitario IS NULL OR custo_unitario = 0) AND valor_unitario IS NOT NULL;');
    }

    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_produtos_grupo ON produtos (grupo_id);');
    } catch {
      // Ignora se índice já existir
    }

    // Preenche os 15 grupos oficiais
    const insertGrupo = db.prepare(`
      INSERT OR IGNORE INTO grupos_produtos (id, codigo, nome, tipo_padrao, ativo)
      VALUES (?, ?, ?, ?, 1)
    `);

    const gruposOficiais = [
      { id: 1, codigo: '01', nome: 'ALMOXARIFADO CENTRAL', tipo_padrao: 'consumivel' },
      { id: 2, codigo: '02', nome: 'EQUIPAMENTOS DIVERSOS', tipo_padrao: 'nao_consumivel' },
      { id: 3, codigo: '03', nome: 'EQUIPAMENTOS MEDICOS E CIRURGICOS', tipo_padrao: 'nao_consumivel' },
      { id: 4, codigo: '04', nome: 'ESCRITORIO E INFORMATICA', tipo_padrao: 'consumivel' },
      { id: 5, codigo: '05', nome: 'GRUPO PROVISORIO PARA AJUSTE', tipo_padrao: 'consumivel' },
      { id: 6, codigo: '06', nome: 'IMOBILIZADO ATIVO/FIXO', tipo_padrao: 'nao_consumivel' },
      { id: 7, codigo: '07', nome: 'INSTRUMENTAIS MEDICOS', tipo_padrao: 'nao_consumivel' },
      { id: 8, codigo: '08', nome: 'MATERIAIS', tipo_padrao: 'consumivel' },
      { id: 9, codigo: '09', nome: 'MATERIAIS DE LIMPEZA E DESCARTAVEIS', tipo_padrao: 'consumivel' },
      { id: 10, codigo: '10', nome: 'MATERIAIS MEDICOS HOSPITALAR', tipo_padrao: 'consumivel' },
      { id: 11, codigo: '11', nome: 'MATERIAIS ODONTOLOGICOS', tipo_padrao: 'consumivel' },
      { id: 12, codigo: '12', nome: 'MATERIAL DE ENGENHARIA CLINICA', tipo_padrao: 'nao_consumivel' },
      { id: 13, codigo: '13', nome: 'MATERIAL DE MANUTENCAO EM GERAL', tipo_padrao: 'consumivel' },
      { id: 14, codigo: '14', nome: 'ROUPARIA E TECIDOS', tipo_padrao: 'consumivel' },
      { id: 15, codigo: '15', nome: 'UNIFORMES', tipo_padrao: 'consumivel' },
    ];

    for (const g of gruposOficiais) {
      insertGrupo.run(g.id, g.codigo, g.nome, g.tipo_padrao);
    }
  } catch (err: any) {
    console.error('Erro ao garantir schema de grupos de produtos:', err.message);
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
      DROP TABLE IF EXISTS itens_inventario;
      DROP TABLE IF EXISTS inventarios_estoque;
      DROP TABLE IF EXISTS itens_emprestimo_institucional;
      DROP TABLE IF EXISTS emprestimos_institucionais;
      DROP TABLE IF EXISTS emprestimos;
      DROP TABLE IF EXISTS movimentacoes;
      DROP TABLE IF EXISTS lotes_estoque;
      DROP TABLE IF EXISTS historico_requisicoes;
      DROP TABLE IF EXISTS itens_requisicao;
      DROP TABLE IF EXISTS requisicoes;
      DROP TABLE IF EXISTS produto_fornecedores;
      DROP TABLE IF EXISTS produtos;
      DROP TABLE IF EXISTS grupos_produtos;
      DROP TABLE IF EXISTS fornecedores_entidades;
      DROP TABLE IF EXISTS fornecedores;
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
      db.exec("DELETE FROM sqlite_sequence WHERE name IN ('centros_custo', 'fornecedores', 'fornecedores_entidades', 'grupos_produtos', 'produtos', 'produto_fornecedores', 'lotes_estoque', 'requisicoes', 'itens_requisicao', 'historico_requisicoes', 'movimentacoes', 'emprestimos', 'emprestimos_institucionais', 'itens_emprestimo_institucional', 'inventarios_estoque', 'itens_inventario');");
    } catch {
      // Ignora se sqlite_sequence ainda não existir
    }
  });

  ensureFornecedoresSchema();
  ensureRequisicaoAuditSchema();
  ensureInventariosSchema();
  ensureGruposProdutosSchema();
  updateOverdueLoans();
}
