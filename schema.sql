-- ============================================================================
-- MULTI ALMOX - SISTEMA DE CONTROLE DE ALMOXARIFADO (PADRÃO SALUTEM)
-- SCRIPT DDL COMPLETO PARA SQLITE (almoxarifado.db)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. TABELA DE EMPRESAS / UNIDADES (ALMOXARIFADOS DESCENTRALIZADOS)
CREATE TABLE IF NOT EXISTS empresas_unidades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,             -- Ex: '001', '002'
    nome TEXT NOT NULL,                      -- Ex: 'Hospital Central - Almoxarifado Central'
    cnpj TEXT,
    endereco TEXT,
    cidade TEXT,
    uf TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,        -- 0 = inativo, 1 = ativo
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_empresas_codigo ON empresas_unidades (codigo);

-- 2. TABELA DE CENTROS DE CUSTO
CREATE TABLE IF NOT EXISTS centros_custo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,             -- Ex: 'CC-UTI-01'
    nome TEXT NOT NULL,                      -- Ex: 'UTI Geral Adulto'
    departamento TEXT NOT NULL,              -- Ex: 'Terapia Intensiva'
    responsavel TEXT NOT NULL,               -- Ex: 'Dra. Camila Toledo'
    empresa_id INTEGER REFERENCES empresas_unidades(id) ON DELETE SET NULL,
    ativo INTEGER NOT NULL DEFAULT 1,        -- 0 = inativo, 1 = ativo
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_centros_custo_codigo ON centros_custo (codigo);
CREATE INDEX IF NOT EXISTS idx_centros_custo_ativo ON centros_custo (ativo);

-- 3. TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT,                             -- Ex: 'USR-001'
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

-- 4. TABELA DE FORNECEDORES E ENTIDADES PARCEIRAS
CREATE TABLE IF NOT EXISTS fornecedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,             -- Ex: 'FORN-0001', 'ENT-0001'
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

-- 5. TABELA DE PRODUTOS / ITENS DO CATÁLOGO (CÓDIGO ÚNICO DE ESTOQUE)
CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,             -- Ex: 'MAT-0012', 'PROD-0045' (Código Único no Estoque)
    nome TEXT NOT NULL,
    descricao TEXT,
    unidade_medida TEXT NOT NULL,            -- 'UN', 'CX', 'PCT', 'L', 'KG', 'FR', 'AMP'
    tipo TEXT NOT NULL CHECK (tipo IN ('consumivel', 'nao_consumivel')),
    controla_validade INTEGER NOT NULL DEFAULT 1,
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

-- 5.1 VÍNCULO PRODUTO X FORNECEDORES (MARCAS E NOMENCLATURAS NO MESMO CÓDIGO DE ESTOQUE)
CREATE TABLE IF NOT EXISTS produto_fornecedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
    marca TEXT,                              -- Marca comercial entregue pelo fornecedor
    nomenclatura_fornecedor TEXT,            -- Descrição/Nomenclatura na NF do fornecedor
    codigo_referencia_fornecedor TEXT,       -- Código do item na NF do fornecedor
    ultimo_valor_unitario REAL,
    ultima_compra DATETIME,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_prod_forn_produto ON produto_fornecedores (produto_id);
CREATE INDEX IF NOT EXISTS idx_prod_forn_fornecedor ON produto_fornecedores (fornecedor_id);

-- 5.2 TABELA DE LOTES DE ESTOQUE E VALIDADES (VINCULADA AO CÓDIGO ÚNICO DO PRODUTO)
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

-- 5. TABELA DE REQUISIÇÕES (WORKFLOW HOSPITALAR DE SAÍDA)
CREATE TABLE IF NOT EXISTS requisicoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_requisicao TEXT UNIQUE NOT NULL,   -- Ex: 'REQ-2026-0001'
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

-- 6. ITENS DA REQUISIÇÃO
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

-- 6.1 HISTÓRICO DE ALTERAÇÕES E AUDITORIA DE REQUISIÇÕES (LOG DETALHADO POR ITEM E FLUXO)
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

-- 7. TABELA DE MOVIMENTAÇÕES (LIVRO-CAIXA IMUTÁVEL DE AUDITORIA)
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

-- 8. TABELA DE EMPRÉSTIMOS (FERRAMENTAS E EQUIPAMENTOS NÃO CONSUMÍVEIS)
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

-- 9. TABELA DE EMPRÉSTIMOS INSTITUCIONAIS ENTRE ENTIDADES PARCEIRAS / HOSPITAIS
CREATE TABLE IF NOT EXISTS emprestimos_institucionais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_documento TEXT UNIQUE NOT NULL,   -- Ex: 'EMP-INST-2026-0001'
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

-- 9.1 ITENS DO EMPRÉSTIMO INSTITUCIONAL (SUPORTE A MÚLTIPLOS ITENS NO TERMO)
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
