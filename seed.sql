-- ============================================================================
-- ALMOXCONTROL - SISTEMA INTEGRADO DE GESTÃO DE ALMOXARIFADO
-- CARGA INICIAL DO SISTEMA - SEM DADOS DE DEMONSTRAÇÃO
-- ============================================================================

-- 1. Unidade / Almoxarifado Padrão Inicial
INSERT OR REPLACE INTO empresas_unidades (id, codigo, nome, cnpj, endereco, cidade, uf, ativo, criado_em) VALUES
(1, '001', 'Almoxarifado Central - Santa Casa SBC', NULL, NULL, 'São Bernardo do Campo', 'SP', 1, CURRENT_TIMESTAMP);

-- 2. Usuário Administrador Inicial
-- Usuário: 'admin'
-- Senha inicial: 'admin123'
-- SHA-256('admin123') = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
INSERT OR REPLACE INTO usuarios (id, codigo, nome, login, senha_hash, cpf, email, perfil, centro_custo_id, empresa_id, ativo, criado_em, ultimo_acesso) VALUES
(1, 'USR-001', 'Administrador do Sistema', 'admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', NULL, 'admin@almoxcontrol.local', 'admin', NULL, 1, 1, CURRENT_TIMESTAMP, NULL);

-- 3. Centro de Custo Base Inicial (Almoxarifado Central)
INSERT OR REPLACE INTO centros_custo (id, codigo, nome, departamento, responsavel, empresa_id, ativo, criado_em) VALUES
(7, '7 - 1.02', 'ALMOXARIFADO CENTRAL', 'ALMOXARIFADO', 'Gestor de Estoque', 1, 1, CURRENT_TIMESTAMP);
