import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = path.resolve(process.cwd(), 'almoxarifado.db');

export const db = new DatabaseSync(DB_PATH);

// Configurações vitais de integridade e desempenho
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

/**
 * Inicializa o banco de dados executando schema.sql e seed.sql se necessário
 */
export function initDatabase() {
  const schemaPath = path.resolve(process.cwd(), 'schema.sql');
  const seedPath = path.resolve(process.cwd(), 'seed.sql');

  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);
  }

  // Verifica se já existem centros de custo ou empresas cadastradas
  try {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='empresas_unidades'").get();
    if (!tableCheck) {
      if (fs.existsSync(schemaPath)) {
        db.exec(fs.readFileSync(schemaPath, 'utf-8'));
      }
      if (fs.existsSync(seedPath)) {
        db.exec(fs.readFileSync(seedPath, 'utf-8'));
      }
      return;
    }

    const countResult = db.prepare('SELECT COUNT(*) as count FROM usuarios').get() as { count: number };
    if (!countResult || countResult.count === 0) {
      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf-8');
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
  const schemaPath = path.resolve(process.cwd(), 'schema.sql');
  const seedPath = path.resolve(process.cwd(), 'seed.sql');

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

    if (fs.existsSync(schemaPath)) {
      db.exec(fs.readFileSync(schemaPath, 'utf-8'));
    }
    if (fs.existsSync(seedPath)) {
      db.exec(fs.readFileSync(seedPath, 'utf-8'));
    }

    try {
      db.exec("DELETE FROM sqlite_sequence WHERE name IN ('centros_custo', 'produtos', 'requisicoes', 'itens_requisicao', 'historico_requisicoes', 'movimentacoes', 'emprestimos');");
    } catch {
      // Ignora se sqlite_sequence ainda não existir
    }
  });

  updateOverdueLoans();
}
