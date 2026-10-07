export type PerfilUsuario = 'admin' | 'almoxarife' | 'requisitante';
export type TipoProduto = 'consumivel' | 'nao_consumivel';
export type UnidadeMedida = 'UN' | 'CX' | 'PCT' | 'L' | 'KG' | 'FR' | 'AMP' | 'ROLO' | 'KIT';
export type StatusRequisicao = 'pendente' | 'aprovada_atendida' | 'rejeitada' | 'cancelada';
export type PrioridadeRequisicao = 'normal' | 'urgente';
export type StatusEmprestimo = 'emprestado' | 'devolvido' | 'atrasado';
export type TipoMovimentacao = 'entrada' | 'saida' | 'estorno_entrada' | 'estorno_saida';

export interface EmpresaUnidade {
  id: number;
  codigo: string;
  nome: string;
  cnpj?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  ativo: number;
  criado_em: string;
}

export interface CentroCusto {
  id: number;
  codigo: string;
  nome: string;
  departamento: string;
  responsavel: string;
  empresa_id?: number | null;
  empresa_nome?: string;
  ativo: number;
  criado_em: string;
}

export interface Usuario {
  id: number;
  codigo?: string | null;
  nome: string;
  login: string;
  cpf?: string | null;
  email?: string | null;
  perfil: PerfilUsuario;
  centro_custo_id: number | null;
  centro_custo_nome?: string;
  centro_custo_codigo?: string;
  empresa_id?: number | null;
  empresa_nome?: string;
  ativo: number;
  criado_em: string;
  ultimo_acesso?: string | null;
  permissoes?: string[];
  usando_senha_padrao?: boolean;
}

export interface Produto {
  id: number;
  codigo: string;
  nome: string;
  descricao?: string | null;
  unidade_medida: UnidadeMedida;
  tipo: TipoProduto;
  estoque_minimo: number;
  estoque_maximo: number;
  quantidade_atual: number;
  valor_unitario?: number | null;
  localizacao?: string | null;
  ativo: number;
  criado_em: string;
}

export type StatusItemRequisicao = 'pendente' | 'aprovado' | 'negado';

export type AcaoHistoricoRequisicao =
  | 'criacao_requisicao'
  | 'inclusao_item'
  | 'aprovacao_item'
  | 'negacao_item'
  | 'aprovacao_total'
  | 'aprovacao_parcial'
  | 'rejeicao_total'
  | 'cancelamento';

export interface ItemRequisicao {
  id: number;
  requisicao_id: number;
  produto_id: number;
  quantidade_solicitada: number;
  quantidade_atendida: number;
  status_item?: StatusItemRequisicao;
  analisado_por_id?: number | null;
  analisado_por_nome?: string | null;
  analisado_por_login?: string | null;
  analisado_por_perfil?: PerfilUsuario | null;
  data_analise?: string | null;
  motivo_decisao?: string | null;
  produto_codigo?: string;
  produto_nome?: string;
  unidade_medida?: string;
  tipo?: string;
  saldo_atual_estoque?: number;
  valor_unitario?: number;
}

export interface HistoricoRequisicao {
  id: number;
  requisicao_id: number;
  item_requisicao_id?: number | null;
  produto_id?: number | null;
  produto_codigo?: string | null;
  produto_nome?: string | null;
  unidade_medida?: string | null;
  usuario_id: number;
  usuario_nome: string;
  usuario_login: string;
  usuario_perfil: PerfilUsuario;
  acao: AcaoHistoricoRequisicao;
  status_anterior?: string | null;
  status_novo?: string | null;
  quantidade_solicitada?: number | null;
  quantidade_atendida?: number | null;
  detalhes: string;
  justificativa?: string | null;
  data_registro: string;
}

export interface Requisicao {
  id: number;
  numero_requisicao: string;
  centro_custo_id: number;
  solicitante_id: number;
  almoxarife_id: number | null;
  data_solicitacao: string;
  data_atendimento: string | null;
  status: StatusRequisicao;
  prioridade?: PrioridadeRequisicao;
  motivo_rejeicao: string | null;
  observacao: string | null;
  centro_custo_codigo?: string;
  centro_custo_nome?: string;
  centro_custo_depto?: string;
  solicitante_nome?: string;
  solicitante_login?: string;
  almoxarife_nome?: string | null;
  total_itens?: number;
  itens_aprovados?: number;
  itens_negados?: number;
  total_eventos_historico?: number;
  itens?: ItemRequisicao[];
  historico?: HistoricoRequisicao[];
}

export interface Emprestimo {
  id: number;
  codigo_emprestimo?: string;
  produto_id: number;
  quantidade: number;
  centro_custo_id: number;
  solicitante_id: number;
  almoxarife_liberacao_id: number;
  almoxarife_recebimento_id?: number | null;
  data_emprestimo: string;
  data_prevista_devolucao: string;
  data_devolucao?: string | null;
  status: StatusEmprestimo;
  condicao_saida?: string | null;
  condicao_devolucao?: string | null;
  observacao: string | null;
  produto_codigo?: string;
  produto_nome?: string;
  unidade_medida?: string;
  centro_custo_codigo?: string;
  centro_custo_nome?: string;
  solicitante_nome?: string;
  almoxarife_liberacao_nome?: string;
  almoxarife_recebimento_nome?: string | null;
}

export interface Movimentacao {
  id: number;
  tipo: TipoMovimentacao;
  produto_id: number;
  quantidade: number;
  centro_custo_id: number | null;
  usuario_id: number;
  documento_referencia: string | null;
  numero_lote?: string | null;
  data_validade?: string | null;
  valor_unitario?: number | null;
  observacao: string | null;
  data_movimentacao: string;
  produto_codigo?: string;
  produto_nome?: string;
  unidade_medida?: string;
  produto_tipo?: string;
  centro_custo_codigo?: string;
  centro_custo_nome?: string;
  usuario_nome?: string;
  usuario_perfil?: string;
}

export interface DashboardStats {
  kpis: {
    itens_estoque_baixo: number;
    requisicoes_pendentes: number;
    emprestimos_ativos: number;
    emprestimos_atrasados: number;
    total_produtos: number;
    total_requisicoes_mes?: number;
    total_valor_estoque?: number;
  };
  consumo_centros_custo: Array<{
    id: number;
    codigo: string;
    nome: string;
    total_movimentacoes: number;
    total_unidades: number;
  }>;
  produtos_criticos: Produto[];
  ultimas_movimentacoes: Movimentacao[];
}

export interface RelatorioFiltros {
  tipo_relatorio: string;
  data_inicio?: string;
  data_fim?: string;
  centro_custo_id?: number;
  produto_id?: number;
  status?: string;
  tipo_produto?: string;
}
