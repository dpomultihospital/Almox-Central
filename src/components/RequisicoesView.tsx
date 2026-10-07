import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Plus,
  Eye,
  Trash2,
  Building2,
  Search,
  Check,
  X,
  Printer,
  ArrowLeft,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Send,
  Sparkles,
  CheckSquare,
  Flame,
  History,
  ShieldCheck,
  UserCheck,
  FileText
} from 'lucide-react';
import type {
  Requisicao,
  Produto,
  CentroCusto,
  Usuario,
  ItemRequisicao,
  PrioridadeRequisicao,
  HistoricoRequisicao,
} from '../types/index.ts';

interface RequisicoesViewProps {
  requisicoes: Requisicao[];
  produtos: Produto[];
  centrosCusto: CentroCusto[];
  currentUser: Usuario | null;
  onRefresh: () => void;
  isCreateModalOpen?: boolean;
  setIsCreateModalOpen?: (open: boolean) => void;
  onVoltar?: () => void;
}

export const RequisicoesView: React.FC<RequisicoesViewProps> = ({
  requisicoes,
  produtos,
  centrosCusto,
  currentUser,
  onRefresh,
  isCreateModalOpen = false,
  setIsCreateModalOpen,
  onVoltar,
}) => {
  // Filtros de busca
  const [filtroNumero, setFiltroNumero] = useState('');
  const [filtroCcId, setFiltroCcId] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todas');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas');
  const [filtroSolicitante, setFiltroSolicitante] = useState<string>('');

  // Abertura de Nova Requisição em Abas
  const [isFormOpen, setIsFormOpen] = useState(isCreateModalOpen);
  const [activeFormTab, setActiveFormTab] = useState<'cabecalho' | 'itens'>('cabecalho');

  // Campos do Cabeçalho da Requisição
  const [formCcId, setFormCcId] = useState<number>(
    currentUser?.centro_custo_id || centrosCusto[0]?.id || 1
  );
  const [formPrioridade, setFormPrioridade] = useState<PrioridadeRequisicao>('normal');
  const [formObservacao, setFormObservacao] = useState('');

  // Itens da Requisição
  const [selectedProdutoId, setSelectedProdutoId] = useState<number>(0);
  const [selectedQtd, setSelectedQtd] = useState<number>(1);
  const [itensAdicionados, setItensAdicionados] = useState<Array<{
    produto_id: number;
    produto_codigo: string;
    produto_nome: string;
    unidade_medida: string;
    saldo_atual: number;
    quantidade_solicitada: number;
  }>>([]);

  // Análise / Atendimento pelo Almoxarife e Auditoria
  const [selectedReq, setSelectedReq] = useState<Requisicao | null>(null);
  const [reqDetails, setReqDetails] = useState<{
    requisicao: Requisicao;
    itens: ItemRequisicao[];
    historico?: HistoricoRequisicao[];
  } | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'conferencia' | 'historico'>('conferencia');
  const [historicoFiltro, setHistoricoFiltro] = useState<'todos' | 'itens' | 'fluxo'>('todos');
  const [itemDecisoes, setItemDecisoes] = useState<
    Record<
      number,
      {
        decisao: 'aprovado' | 'negado';
        quantidade_atendida: number;
        motivo_decisao: string;
      }
    >
  >({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const isAlmoxarifeOrAdmin = currentUser && (currentUser.perfil === 'admin' || currentUser.perfil === 'almoxarife');

  // Produtos apenas consumíveis para a requisição
  const produtosConsumiveis = useMemo(() => {
    return produtos.filter((p) => p.tipo === 'consumivel' && p.ativo === 1);
  }, [produtos]);

  // Filtragem das Requisições
  const filteredRequisicoes = useMemo(() => {
    return requisicoes.filter((r) => {
      if (filtroNumero && !r.numero_requisicao.toLowerCase().includes(filtroNumero.toLowerCase())) return false;
      if (filtroCcId && String(r.centro_custo_id) !== filtroCcId) return false;
      if (filtroStatus !== 'todas' && r.status !== filtroStatus) return false;
      if (filtroPrioridade !== 'todas' && (r.prioridade || 'normal') !== filtroPrioridade) return false;
      if (filtroSolicitante && !r.solicitante_nome?.toLowerCase().includes(filtroSolicitante.toLowerCase())) return false;
      return true;
    });
  }, [requisicoes, filtroNumero, filtroCcId, filtroStatus, filtroPrioridade, filtroSolicitante]);

  const totalPages = Math.ceil(filteredRequisicoes.length / pageSize) || 1;
  const paginatedRequisicoes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequisicoes.slice(start, start + pageSize);
  }, [filteredRequisicoes, currentPage, pageSize]);

  // Abre criação de nova requisição
  const handleAbrirCriacao = () => {
    setFormCcId(currentUser?.centro_custo_id || centrosCusto[0]?.id || 1);
    setFormPrioridade('normal');
    setFormObservacao('');
    setItensAdicionados([]);
    setSelectedProdutoId(produtosConsumiveis[0]?.id || 0);
    setSelectedQtd(1);
    setActiveFormTab('cabecalho');
    setActionError(null);
    setIsFormOpen(true);
    if (setIsCreateModalOpen) setIsCreateModalOpen(true);
  };

  // Adicionar item à cesta da requisição
  const handleAddItem = () => {
    if (!selectedProdutoId || selectedQtd <= 0) return;
    const prod = produtosConsumiveis.find((p) => p.id === selectedProdutoId);
    if (!prod) return;

    // Se já estiver na lista, apenas soma a quantidade
    const existingIndex = itensAdicionados.findIndex((it) => it.produto_id === selectedProdutoId);
    if (existingIndex >= 0) {
      const updated = [...itensAdicionados];
      updated[existingIndex].quantidade_solicitada += selectedQtd;
      setItensAdicionados(updated);
    } else {
      setItensAdicionados([
        ...itensAdicionados,
        {
          produto_id: prod.id,
          produto_codigo: prod.codigo,
          produto_nome: prod.nome,
          unidade_medida: prod.unidade_medida,
          saldo_atual: prod.quantidade_atual,
          quantidade_solicitada: selectedQtd,
        },
      ]);
    }

    setSelectedQtd(1);
  };

  const handleRemoveItem = (index: number) => {
    setItensAdicionados(itensAdicionados.filter((_, i) => i !== index));
  };

  // Enviar requisição para o almoxarifado
  const handleSubmitRequisicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itensAdicionados.length === 0) {
      setActionError('A requisição deve conter pelo menos 1 item consumível adicionado.');
      setActiveFormTab('itens');
      return;
    }

    setIsProcessing(true);
    setActionError(null);

    try {
      const res = await fetch('/api/requisicoes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `user:${currentUser?.id}`,
        },
        body: JSON.stringify({
          centro_custo_id: formCcId,
          prioridade: formPrioridade,
          observacao: formObservacao ? formObservacao.trim() : null,
          itens: itensAdicionados.map((it) => ({
            produto_id: it.produto_id,
            quantidade_solicitada: it.quantidade_solicitada,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar requisição.');
      }

      setIsFormOpen(false);
      if (setIsCreateModalOpen) setIsCreateModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Falha ao processar solicitação.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Carregar detalhes de requisição existente (Análise ou Histórico de Auditoria)
  const handleAbrirAnalise = async (req: Requisicao, initialTab: 'conferencia' | 'historico' = 'conferencia') => {
    setSelectedReq(req);
    setActiveDetailTab(initialTab);
    setHistoricoFiltro('todos');
    setIsLoadingDetails(true);
    setActionError(null);
    setReqDetails(null);
    setItemDecisoes({});

    try {
      const res = await fetch(`/api/requisicoes/${req.id}`, {
        headers: { 'Authorization': `user:${currentUser?.id}` },
      });
      const data = await res.json();
      if (res.ok) {
        setReqDetails(data);
        // Inicializa decisões de itens para requisições pendentes
        if (data.itens && Array.isArray(data.itens)) {
          const initMap: Record<
            number,
            { decisao: 'aprovado' | 'negado'; quantidade_atendida: number; motivo_decisao: string }
          > = {};
          for (const it of data.itens as ItemRequisicao[]) {
            const saldo = it.saldo_atual_estoque ?? 0;
            const temSaldo = saldo >= it.quantidade_solicitada;
            initMap[it.id] = {
              decisao: temSaldo ? 'aprovado' : 'negado',
              quantidade_atendida: temSaldo ? it.quantidade_solicitada : 0,
              motivo_decisao: temSaldo
                ? 'Item conferido, aprovado e dispensado pelo almoxarifado.'
                : `Saldo físico insuficiente em estoque (Disponível: ${saldo} ${it.unidade_medida || ''}).`,
            };
          }
          setItemDecisoes(initMap);
        }
      } else {
        setActionError(data.error || 'Erro ao obter dados da requisição');
      }
    } catch (err: any) {
      setActionError('Erro de conexão: ' + err.message);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Ação Almoxarife: Efetivar decisões por item (Aprovação Total, Parcial ou Negação por Item)
  const handleAprovar = async () => {
    if (!selectedReq || !reqDetails) return;

    // Verifica se algum item marcado como negado está sem justificativa
    const decisoesPayload = reqDetails.itens.map((it) => {
      const dec = itemDecisoes[it.id] || {
        decisao: 'aprovado' as const,
        quantidade_atendida: it.quantidade_solicitada,
        motivo_decisao: 'Item conferido, aprovado e dispensado.',
      };
      return {
        item_id: it.id,
        produto_nome: it.produto_nome,
        decisao: dec.decisao,
        quantidade_atendida: dec.decisao === 'aprovado' ? dec.quantidade_atendida : 0,
        motivo_decisao: dec.motivo_decisao.trim(),
      };
    });

    const itemSemMotivo = decisoesPayload.find((d) => d.decisao === 'negado' && !d.motivo_decisao);
    if (itemSemMotivo) {
      setActionError(`Informe a justificativa técnica para negar o item "${itemSemMotivo.produto_nome}".`);
      return;
    }

    setIsProcessing(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/requisicoes/${selectedReq.id}/aprovar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `user:${currentUser?.id}`,
        },
        body: JSON.stringify({
          decisoes_itens: decisoesPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar análise da requisição.');
      }

      setSelectedReq(null);
      setReqDetails(null);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Falha ao aprovar.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Ação Almoxarife: Rejeitar com parecer
  const handleRejeitar = async () => {
    if (!selectedReq || !motivoRejeicao.trim()) {
      setActionError('A justificativa de rejeição é obrigatória.');
      return;
    }

    setIsProcessing(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/requisicoes/${selectedReq.id}/rejeitar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `user:${currentUser?.id}`,
        },
        body: JSON.stringify({ motivo_rejeicao: motivoRejeicao.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao rejeitar requisição.');
      }

      setIsRejectModalOpen(false);
      setSelectedReq(null);
      setReqDetails(null);
      setMotivoRejeicao('');
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Falha ao rejeitar.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return (
          <span className="inline-flex items-center gap-1 text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded text-[10px] border border-amber-300">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>PENDENTE</span>
          </span>
        );
      case 'aprovada_atendida':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>ATENDIDA</span>
          </span>
        );
      case 'rejeitada':
        return (
          <span className="inline-flex items-center gap-1 text-rose-800 font-bold bg-rose-50 px-2 py-0.5 rounded text-[10px] border border-rose-300">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>REJEITADA</span>
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-100 text-teal-800 rounded-lg">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Requisições de Materiais</h1>
            <p className="text-xs text-slate-500">Fluxo de solicitação de materiais, conferência de saldo e atendimento</p>
          </div>
        </div>

        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>VOLTAR AO PAINEL</span>
          </button>
        )}
      </div>

      {/* =========================================================================
          NOVA REQUISIÇÃO EM ABAS / ETAPAS
         ========================================================================= */}
      {isFormOpen && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden animate-fadeIn">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                Fluxo Assistencial de Saída
              </span>
              <h2 className="text-base font-bold text-slate-800 mt-1">Abertura de Requisição de Insumos</h2>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                if (setIsCreateModalOpen) setIsCreateModalOpen(false);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para Listagem</span>
            </button>
          </div>

          {actionError && (
            <div className="mx-6 mt-4 p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {actionError}
            </div>
          )}

          {/* Abas */}
          <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setActiveFormTab('cabecalho')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'cabecalho'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              1. Cabeçalho da Requisição
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('itens')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFormTab === 'itens'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>2. Itens Solicitados</span>
              <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full text-[10px]">
                {itensAdicionados.length}
              </span>
            </button>
          </div>

          <form onSubmit={handleSubmitRequisicao} className="p-6 space-y-6">
            {/* ABA 1: CABEÇALHO */}
            {activeFormTab === 'cabecalho' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Centro de Custo Solicitante *
                  </label>
                  <select
                    value={formCcId}
                    onChange={(e) => setFormCcId(Number(e.target.value))}
                    disabled={currentUser?.perfil === 'requisitante'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  >
                    {centrosCusto.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.codigo} - {cc.nome} ({cc.departamento})
                      </option>
                    ))}
                  </select>
                  {currentUser?.perfil === 'requisitante' && (
                    <p className="text-[10px] text-slate-500 mt-1">Vinculado automaticamente ao seu setor hospitalar.</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Prioridade da Requisição
                  </label>
                  <div className="flex gap-3 mt-1">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer p-2 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 flex-1">
                      <input
                        type="radio"
                        name="prioridade"
                        value="normal"
                        checked={formPrioridade === 'normal'}
                        onChange={() => setFormPrioridade('normal')}
                        className="text-teal-600"
                      />
                      <span>Normal (Rotina Assistencial)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-rose-700 cursor-pointer p-2 rounded border border-rose-200 bg-rose-50/50 hover:bg-rose-100/50 flex-1">
                      <input
                        type="radio"
                        name="prioridade"
                        value="urgente"
                        checked={formPrioridade === 'urgente'}
                        onChange={() => setFormPrioridade('urgente')}
                        className="text-rose-600"
                      />
                      <Flame className="w-3.5 h-3.5 text-rose-600" />
                      <span>Urgente (UTI / Centro Cirúrgico)</span>
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Justificativa Clínica / Observações
                  </label>
                  <textarea
                    rows={3}
                    value={formObservacao}
                    onChange={(e) => setFormObservacao(e.target.value)}
                    placeholder="Informe a necessidade clínica, procedimento ou paciente atendido (opcional)..."
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                  />
                </div>
              </div>
            )}

            {/* ABA 2: ITENS DA REQUISIÇÃO */}
            {activeFormTab === 'itens' && (
              <div className="space-y-6">
                {/* Linha de Adição de Item */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Adicionar Insumo Consumível
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-7">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Produto Consumível (com saldo em estoque visível)
                      </label>
                      <select
                        value={selectedProdutoId}
                        onChange={(e) => setSelectedProdutoId(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:border-teal-500 cursor-pointer"
                      >
                        <option value={0}>Selecione um produto...</option>
                        {produtosConsumiveis.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.codigo} - {p.nome} ({p.unidade_medida}) | Saldo Atual: {p.quantidade_atual}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Quantidade Desejada
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={selectedQtd}
                        onChange={(e) => setSelectedQtd(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 font-mono focus:border-teal-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-3 rounded text-xs flex items-center justify-center gap-1.5 uppercase tracking-wide transition-all shadow cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>ADICIONAR</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tabela de Itens Adicionados */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Lista de Insumos da Requisição ({itensAdicionados.length} itens)
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Código</th>
                        <th className="py-2 px-3">Produto / Material</th>
                        <th className="py-2 px-3 text-center">UN</th>
                        <th className="py-2 px-3 text-right">Saldo Almox.</th>
                        <th className="py-2 px-3 text-right">Qtd Solicitada</th>
                        <th className="py-2 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {itensAdicionados.length > 0 ? (
                        itensAdicionados.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono text-slate-700 font-semibold">{it.produto_codigo}</td>
                            <td className="py-2 px-3 text-slate-800">{it.produto_nome}</td>
                            <td className="py-2 px-3 text-center font-bold text-slate-600">{it.unidade_medida}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">{it.saldo_atual}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-teal-800">
                              {it.quantidade_solicitada}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded"
                                title="Remover item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            Nenhum item adicionado à requisição ainda.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Rodapé: ENVIAR REQUISIÇÃO (verde) e VOLTAR (teal) */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  if (setIsCreateModalOpen) setIsCreateModalOpen(false);
                }}
                className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>VOLTAR</span>
              </button>

              <button
                type="submit"
                disabled={isProcessing || itensAdicionados.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium px-5 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isProcessing ? 'ENVIANDO...' : 'ENVIAR REQUISIÇÃO AO ALMOXARIFADO'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          CONSULTA DE REQUISIÇÕES: FILTROS + TABELA
         ========================================================================= */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        {/* Linha 1 de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Número da Requisição
            </label>
            <input
              type="text"
              value={filtroNumero}
              onChange={(e) => { setFiltroNumero(e.target.value); setCurrentPage(1); }}
              placeholder="ex: REQ-2026-0001"
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Centro de Custo
            </label>
            <select
              value={filtroCcId}
              onChange={(e) => { setFiltroCcId(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
            >
              <option value="">(Todos os Centros de Custo)</option>
              {centrosCusto.map((cc) => (
                <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Status da Requisição
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => { setFiltroStatus(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
            >
              <option value="todas">TODAS</option>
              <option value="pendente">Pendente (Em Análise)</option>
              <option value="aprovada_atendida">Aprovada e Atendida (Baixa Efetuada)</option>
              <option value="rejeitada">Rejeitada (Com Parecer)</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
        </div>

        {/* Linha 2 de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Prioridade
            </label>
            <select
              value={filtroPrioridade}
              onChange={(e) => { setFiltroPrioridade(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
            >
              <option value="todas">TODAS AS PRIORIDADES</option>
              <option value="normal">Normal (Rotina)</option>
              <option value="urgente">Urgente (Alta Prioridade)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Solicitante
            </label>
            <input
              type="text"
              value={filtroSolicitante}
              onChange={(e) => { setFiltroSolicitante(e.target.value); setCurrentPage(1); }}
              placeholder="Pesquisar por nome do solicitante..."
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>
        </div>

        {/* Botões: + NOVA REQUISIÇÃO e PESQUISAR */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleAbrirCriacao}
            className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ NOVA REQUISIÇÃO</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            className="border border-teal-600 text-teal-700 hover:bg-teal-50 font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all uppercase tracking-wide cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>PESQUISAR</span>
          </button>
        </div>
      </div>

      {/* Grid de Resultados Zebrada */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Nº Requisição</th>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Centro de Custo</th>
                <th className="py-2.5 px-3">Solicitante</th>
                <th className="py-2.5 px-3 text-center">Prioridade</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Itens</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedRequisicoes.length > 0 ? (
                paginatedRequisicoes.map((r) => (
                  <tr key={r.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{r.numero_requisicao}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {new Date(r.data_solicitacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{r.centro_custo_nome}</td>
                    <td className="py-2.5 px-3 text-slate-600">{r.solicitante_nome}</td>
                    <td className="py-2.5 px-3 text-center">
                      {r.prioridade === 'urgente' ? (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded text-[10px] border border-rose-200">
                          <Flame className="w-3 h-3 text-rose-600" />
                          <span>URGENTE</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">{getStatusBadge(r.status)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-bold text-slate-700">{r.total_itens || 1} item(ns)</span>
                        {r.status !== 'pendente' && ((r.itens_aprovados ?? 0) > 0 || (r.itens_negados ?? 0) > 0) && (
                          <div className="flex items-center gap-1 text-[10px]">
                            {(r.itens_aprovados ?? 0) > 0 && (
                              <span className="text-emerald-700 font-semibold">{r.itens_aprovados} aprov.</span>
                            )}
                            {(r.itens_aprovados ?? 0) > 0 && (r.itens_negados ?? 0) > 0 && (
                              <span className="text-slate-300">·</span>
                            )}
                            {(r.itens_negados ?? 0) > 0 && (
                              <span className="text-rose-700 font-semibold">{r.itens_negados} neg.</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAbrirAnalise(r, 'conferencia')}
                          className="px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isAlmoxarifeOrAdmin && r.status === 'pendente' ? 'ANALISAR' : 'VER'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAbrirAnalise(r, 'historico')}
                          title="Visualizar log detalhado de histórico de alterações e auditoria de aprovação/negação por item"
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-[#00237D]" />
                          <span>HISTÓRICO</span>
                          {(r.total_eventos_historico ?? 0) > 0 && (
                            <span className="bg-white text-slate-600 border border-slate-300 px-1 rounded text-[10px] font-mono">
                              {r.total_eventos_historico}
                            </span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Nenhuma requisição encontrada para os critérios selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Consulta */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            <strong>{filteredRequisicoes.length}</strong> registro(s) encontrado(s)
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-semibold text-slate-700">
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL DE ANÁLISE / ATENDIMENTO DO ALMOXARIFE E LOG DE AUDITORIA POR ITEM
         ========================================================================= */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                  Conferência de Dispensação e Trilha de Auditoria Hospitalar
                </span>
                <h2 className="text-base font-bold text-slate-800 mt-1">
                  Requisição: {selectedReq.numero_requisicao}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReq(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas do Modal: 1. Conferência e Decisão por Item | 2. Log de Auditoria e Histórico */}
            <div className="flex border-b border-slate-200 px-6 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveDetailTab('conferencia')}
                className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                  activeDetailTab === 'conferencia'
                    ? 'border-[#00237D] text-[#00237D] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>1. Conferência e Decisão por Item</span>
                <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                  {reqDetails?.itens?.length ?? selectedReq.total_itens ?? 0}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDetailTab('historico')}
                className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                  activeDetailTab === 'historico'
                    ? 'border-[#00237D] text-[#00237D] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <History className="w-4 h-4" />
                <span>2. Log de Histórico e Auditoria de Alterações</span>
                <span className="bg-[#00237D]/10 text-[#00237D] px-1.5 py-0.5 rounded text-[10px] font-mono">
                  {reqDetails?.historico?.length ?? selectedReq.total_eventos_historico ?? 0}
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {actionError && (
                <div className="p-3.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Informações Gerais da Requisição */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold uppercase text-[10px] block">Centro de Custo</span>
                  <span className="font-bold text-slate-800">{selectedReq.centro_custo_nome}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold uppercase text-[10px] block">Solicitante</span>
                  <span className="font-bold text-slate-800">{selectedReq.solicitante_nome}</span>
                  <span className="text-[10px] text-slate-500 block">
                    {new Date(selectedReq.data_solicitacao).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold uppercase text-[10px] block">Prioridade</span>
                  <span className={`font-bold ${selectedReq.prioridade === 'urgente' ? 'text-rose-700' : 'text-slate-700'}`}>
                    {selectedReq.prioridade === 'urgente' ? 'URGENTE' : 'Normal'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold uppercase text-[10px] block">Status Atual</span>
                  <div className="mt-0.5">{getStatusBadge(selectedReq.status)}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold uppercase text-[10px] block">Responsável Análise</span>
                  <span className="font-bold text-slate-800">
                    {reqDetails?.requisicao?.almoxarife_nome || selectedReq.almoxarife_nome || 'Aguardando Análise'}
                  </span>
                  {(reqDetails?.requisicao?.data_atendimento || selectedReq.data_atendimento) && (
                    <span className="text-[10px] text-slate-500 block">
                      {new Date(
                        (reqDetails?.requisicao?.data_atendimento || selectedReq.data_atendimento) as string
                      ).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>

              {selectedReq.observacao && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
                  <strong>Observação / Justificativa Clínica da Solicitação:</strong> {selectedReq.observacao}
                </div>
              )}

              {(reqDetails?.requisicao?.motivo_rejeicao || selectedReq.motivo_rejeicao) && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
                  <strong>Parecer / Registro de Recusa ou Atendimento Parcial:</strong>{' '}
                  {reqDetails?.requisicao?.motivo_rejeicao || selectedReq.motivo_rejeicao}
                </div>
              )}

              {isLoadingDetails ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Carregando itens e trilha de auditoria da requisição...
                </div>
              ) : activeDetailTab === 'conferencia' ? (
                /* =================================================================
                   ABA 1: CONFERÊNCIA DE SALDOS E APROVAÇÃO / NEGAÇÃO POR ITEM
                   ================================================================= */
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        Itens da Requisição — Conferência de Saldo e Decisão Individual por Item
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {isAlmoxarifeOrAdmin && selectedReq.status === 'pendente'
                          ? 'Aprove ou negue cada item individualmente. Toda decisão fica registrada com seu usuário e data/hora no log de auditoria.'
                          : 'Demonstrativo auditado de cada item solicitado, decisão tomada e responsável pela análise.'}
                      </p>
                    </div>

                    {isAlmoxarifeOrAdmin && selectedReq.status === 'pendente' && reqDetails?.itens && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const next: typeof itemDecisoes = {};
                            for (const it of reqDetails.itens) {
                              next[it.id] = {
                                decisao: 'aprovado',
                                quantidade_atendida: it.quantidade_solicitada,
                                motivo_decisao: 'Item conferido, aprovado e dispensado pelo almoxarifado.',
                              };
                            }
                            setItemDecisoes(next);
                          }}
                          className="px-2.5 py-1 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold cursor-pointer"
                        >
                          Marcar Todos Aprovados
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Código / Produto</th>
                          <th className="py-2.5 px-3 text-center">UN</th>
                          <th className="py-2.5 px-3 text-right">Saldo Físico</th>
                          <th className="py-2.5 px-3 text-right">Solicitado</th>
                          <th className="py-2.5 px-3 text-right">Atendido</th>
                          <th className="py-2.5 px-3 text-center">Decisão do Item</th>
                          <th className="py-2.5 px-3">Auditoria / Justificativa do Item</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {reqDetails?.itens.map((it) => {
                          const saldo = it.saldo_atual_estoque ?? 0;
                          const dec = itemDecisoes[it.id] || {
                            decisao: 'aprovado' as const,
                            quantidade_atendida: it.quantidade_solicitada,
                            motivo_decisao: '',
                          };
                          const suficiente = saldo >= (selectedReq.status === 'pendente' ? dec.quantidade_atendida : it.quantidade_solicitada);
                          const statusAuditado = it.status_item || (
                            selectedReq.status === 'aprovada_atendida'
                              ? 'aprovado'
                              : selectedReq.status === 'rejeitada'
                              ? 'negado'
                              : 'pendente'
                          );

                          return (
                            <tr
                              key={it.id}
                              className={
                                selectedReq.status === 'pendente' && isAlmoxarifeOrAdmin
                                  ? dec.decisao === 'negado'
                                    ? 'bg-rose-50/40'
                                    : 'bg-emerald-50/20'
                                  : 'hover:bg-slate-50'
                              }
                            >
                              <td className="py-2.5 px-3">
                                <div className="font-mono font-bold text-slate-800">{it.produto_codigo}</div>
                                <div className="text-slate-700 font-medium">{it.produto_nome}</div>
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-slate-600">{it.unidade_medida}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                                <div>{saldo}</div>
                                {selectedReq.status === 'pendente' && (
                                  <span
                                    className={`text-[10px] font-semibold ${
                                      suficiente ? 'text-emerald-700' : 'text-rose-700'
                                    }`}
                                  >
                                    {suficiente ? 'Disponível' : 'Insuficiente'}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-800">
                                {it.quantidade_solicitada}
                              </td>

                              {/* Coluna Qtd Atendida */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                {isAlmoxarifeOrAdmin && selectedReq.status === 'pendente' ? (
                                  dec.decisao === 'aprovado' ? (
                                    <input
                                      type="number"
                                      min={1}
                                      max={Math.max(1, it.quantidade_solicitada)}
                                      value={dec.quantidade_atendida}
                                      onChange={(e) =>
                                        setItemDecisoes((prev) => ({
                                          ...prev,
                                          [it.id]: {
                                            ...dec,
                                            quantidade_atendida: Math.max(1, Number(e.target.value)),
                                          },
                                        }))
                                      }
                                      className="w-16 px-2 py-1 text-right bg-white border border-slate-300 rounded text-xs font-mono"
                                    />
                                  ) : (
                                    <span className="text-rose-600">0</span>
                                  )
                                ) : (
                                  <span className={statusAuditado === 'negado' ? 'text-rose-600' : 'text-emerald-700'}>
                                    {it.quantidade_atendida ?? 0}
                                  </span>
                                )}
                              </td>

                              {/* Coluna Decisão do Item */}
                              <td className="py-2.5 px-3 text-center">
                                {isAlmoxarifeOrAdmin && selectedReq.status === 'pendente' ? (
                                  <div className="inline-flex rounded border border-slate-300 overflow-hidden">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setItemDecisoes((prev) => ({
                                          ...prev,
                                          [it.id]: {
                                            decisao: 'aprovado',
                                            quantidade_atendida: it.quantidade_solicitada,
                                            motivo_decisao: 'Item conferido, aprovado e dispensado pelo almoxarifado.',
                                          },
                                        }))
                                      }
                                      className={`px-2.5 py-1 text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors ${
                                        dec.decisao === 'aprovado'
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-white text-slate-600 hover:bg-slate-100'
                                      }`}
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>Aprovar</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setItemDecisoes((prev) => ({
                                          ...prev,
                                          [it.id]: {
                                            decisao: 'negado',
                                            quantidade_atendida: 0,
                                            motivo_decisao:
                                              dec.decisao === 'negado' && dec.motivo_decisao
                                                ? dec.motivo_decisao
                                                : '',
                                          },
                                        }))
                                      }
                                      className={`px-2.5 py-1 text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors ${
                                        dec.decisao === 'negado'
                                          ? 'bg-rose-600 text-white'
                                          : 'bg-white text-slate-600 hover:bg-slate-100'
                                      }`}
                                    >
                                      <X className="w-3 h-3" />
                                      <span>Negar</span>
                                    </button>
                                  </div>
                                ) : statusAuditado === 'aprovado' ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>APROVADO</span>
                                  </span>
                                ) : statusAuditado === 'negado' ? (
                                  <span className="inline-flex items-center gap-1 text-rose-800 font-bold bg-rose-50 px-2 py-0.5 rounded text-[10px] border border-rose-300">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    <span>NEGADO</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded text-[10px] border border-amber-300">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    <span>PENDENTE</span>
                                  </span>
                                )}
                              </td>

                              {/* Coluna Auditoria / Justificativa do Item */}
                              <td className="py-2.5 px-3">
                                {isAlmoxarifeOrAdmin && selectedReq.status === 'pendente' ? (
                                  <input
                                    type="text"
                                    value={dec.motivo_decisao}
                                    onChange={(e) =>
                                      setItemDecisoes((prev) => ({
                                        ...prev,
                                        [it.id]: {
                                          ...dec,
                                          motivo_decisao: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder={
                                      dec.decisao === 'negado'
                                        ? 'Justificativa obrigatória para negar o item...'
                                        : 'Parecer de aprovação (opcional)...'
                                    }
                                    className={`w-full px-2.5 py-1 rounded text-xs border ${
                                      dec.decisao === 'negado'
                                        ? 'bg-white border-rose-300 text-rose-900 placeholder:text-rose-400 focus:border-rose-500'
                                        : 'bg-white border-slate-300 text-slate-700 focus:border-teal-500'
                                    }`}
                                  />
                                ) : (
                                  <div className="space-y-0.5">
                                    {it.analisado_por_nome ? (
                                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-800">
                                        <UserCheck className="w-3.5 h-3.5 text-[#00237D] shrink-0" />
                                        <span>{it.analisado_por_nome}</span>
                                        {it.analisado_por_perfil && (
                                          <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-slate-200 text-slate-700">
                                            {it.analisado_por_perfil}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[11px] text-slate-400">Aguardando decisão do almoxarife</span>
                                    )}
                                    {it.data_analise && (
                                      <div className="text-[10px] text-slate-500">
                                        Em {new Date(it.data_analise).toLocaleString('pt-BR')}
                                      </div>
                                    )}
                                    {it.motivo_decisao && (
                                      <div className="text-[11px] text-slate-600 italic">
                                        “{it.motivo_decisao}”
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* =================================================================
                   ABA 2: LOG DETALHADO DE HISTÓRICO DE ALTERAÇÕES E AUDITORIA
                   ================================================================= */
                <div className="space-y-6">
                  {/* Quadro Resumo de Responsabilidade por Item (Quem Aprovou ou Negou cada item) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-[#00237D]" />
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Auditoria Direta por Item — Quem Aprovou ou Negou Cada Material
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Rastreabilidade Nominal Obrigatória
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Item / Material</th>
                            <th className="py-2 px-3 text-right">Solicitado</th>
                            <th className="py-2 px-3 text-right">Atendido</th>
                            <th className="py-2 px-3 text-center">Decisão</th>
                            <th className="py-2 px-3">Quem Aprovou / Negou</th>
                            <th className="py-2 px-3">Data / Hora da Decisão</th>
                            <th className="py-2 px-3">Parecer / Justificativa Auditada</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {reqDetails?.itens.map((it) => {
                            const statusItem =
                              it.status_item ||
                              (selectedReq.status === 'aprovada_atendida'
                                ? 'aprovado'
                                : selectedReq.status === 'rejeitada'
                                ? 'negado'
                                : 'pendente');

                            return (
                              <tr key={it.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3">
                                  <span className="font-mono font-bold text-slate-800">{it.produto_codigo}</span>{' '}
                                  <span className="text-slate-700">— {it.produto_nome}</span>
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">
                                  {it.quantidade_solicitada} {it.unidade_medida}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                  {it.quantidade_atendida} {it.unidade_medida}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  {statusItem === 'aprovado' ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-300">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>APROVADO</span>
                                    </span>
                                  ) : statusItem === 'negado' ? (
                                    <span className="inline-flex items-center gap-1 text-rose-800 font-bold bg-rose-50 px-2 py-0.5 rounded text-[10px] border border-rose-300">
                                      <XCircle className="w-3 h-3 text-rose-600" />
                                      <span>NEGADO</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded text-[10px] border border-amber-300">
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      <span>PENDENTE</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3">
                                  {it.analisado_por_nome ? (
                                    <div>
                                      <div className="font-bold text-slate-800">{it.analisado_por_nome}</div>
                                      <div className="text-[10px] text-slate-500">
                                        @{it.analisado_por_login || 'operador'} ·{' '}
                                        <span className="uppercase font-semibold">{it.analisado_por_perfil || 'almoxarife'}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">Não analisado</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                                  {it.data_analise ? new Date(it.data_analise).toLocaleString('pt-BR') : '-'}
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  {it.motivo_decisao || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Linha do Tempo Completa de Eventos da Requisição */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-teal-700" />
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Linha do Tempo Cronológica de Alterações (Log Imutável)
                        </h4>
                      </div>

                      {/* Filtro de eventos do histórico */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setHistoricoFiltro('todos')}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                            historicoFiltro === 'todos'
                              ? 'bg-[#00237D] text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Todos ({reqDetails?.historico?.length ?? 0})
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoricoFiltro('itens')}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                            historicoFiltro === 'itens'
                              ? 'bg-[#00237D] text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Aprovações / Negações de Itens
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoricoFiltro('fluxo')}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                            historicoFiltro === 'fluxo'
                              ? 'bg-[#00237D] text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Eventos da Requisição
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {(reqDetails?.historico || [])
                        .filter((ev) => {
                          if (historicoFiltro === 'itens') {
                            return ev.acao === 'aprovacao_item' || ev.acao === 'negacao_item' || ev.acao === 'inclusao_item';
                          }
                          if (historicoFiltro === 'fluxo') {
                            return (
                              ev.acao === 'criacao_requisicao' ||
                              ev.acao === 'aprovacao_total' ||
                              ev.acao === 'aprovacao_parcial' ||
                              ev.acao === 'rejeicao_total' ||
                              ev.acao === 'cancelamento'
                            );
                          }
                          return true;
                        })
                        .map((ev) => {
                          const isApprove = ev.acao === 'aprovacao_item' || ev.acao === 'aprovacao_total';
                          const isDeny = ev.acao === 'negacao_item' || ev.acao === 'rejeicao_total' || ev.acao === 'cancelamento';
                          const isPartial = ev.acao === 'aprovacao_parcial';

                          const badgeLabel: Record<string, string> = {
                            criacao_requisicao: 'ABERTURA DE REQUISIÇÃO',
                            inclusao_item: 'ITEM SOLICITADO',
                            aprovacao_item: 'ITEM APROVADO',
                            negacao_item: 'ITEM NEGADO',
                            aprovacao_total: 'APROVAÇÃO INTEGRAL E BAIXA',
                            aprovacao_parcial: 'ATENDIMENTO PARCIAL',
                            rejeicao_total: 'REJEIÇÃO DA REQUISIÇÃO',
                            cancelamento: 'CANCELAMENTO',
                          };

                          return (
                            <div
                              key={ev.id}
                              className={`p-3.5 rounded-lg border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                isApprove
                                  ? 'bg-emerald-50/40 border-emerald-200'
                                  : isDeny
                                  ? 'bg-rose-50/40 border-rose-200'
                                  : isPartial
                                  ? 'bg-amber-50/40 border-amber-200'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                      isApprove
                                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                        : isDeny
                                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                                        : isPartial
                                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                                        : 'bg-slate-100 text-slate-700 border-slate-300'
                                    }`}
                                  >
                                    {badgeLabel[ev.acao] || ev.acao}
                                  </span>

                                  {ev.produto_codigo && (
                                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-mono font-bold text-slate-800">
                                      {ev.produto_codigo} — {ev.produto_nome}
                                    </span>
                                  )}

                                  {ev.status_anterior && ev.status_novo && (
                                    <span className="text-[10px] font-mono text-slate-500">
                                      [{ev.status_anterior.toUpperCase()} → {ev.status_novo.toUpperCase()}]
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-slate-800 font-medium">{ev.detalhes}</p>

                                {ev.justificativa && (
                                  <div className="text-[11px] text-slate-600 bg-white/80 px-2.5 py-1.5 rounded border border-slate-200/80">
                                    <strong>Parecer / Justificativa:</strong> {ev.justificativa}
                                  </div>
                                )}
                              </div>

                              <div className="md:text-right shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-200/60">
                                <div className="text-xs font-bold text-slate-800">
                                  {ev.usuario_nome}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  @{ev.usuario_login} ·{' '}
                                  <span className="uppercase font-semibold text-[#00237D]">
                                    {ev.usuario_perfil}
                                  </span>
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                  {new Date(ev.data_registro).toLocaleString('pt-BR')}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                      {(!reqDetails?.historico || reqDetails.historico.length === 0) && (
                        <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                          Nenhum evento de histórico registrado para esta requisição.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Ações do Almoxarife no Rodapé */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-teal-700" />
                <span>IMPRIMIR GUIA E AUDITORIA</span>
              </button>

              <div className="flex items-center gap-3">
                {isAlmoxarifeOrAdmin && selectedReq.status === 'pendente' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRejectModalOpen(true)}
                      disabled={isProcessing}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>REJEITAR TUDO</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAprovar}
                      disabled={isProcessing}
                      className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium px-5 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {isProcessing
                          ? 'REGISTRANDO AUDITORIA...'
                          : (() => {
                              const vals = Object.values(itemDecisoes);
                              const aprov = vals.filter((v) => v.decisao === 'aprovado').length;
                              const neg = vals.filter((v) => v.decisao === 'negado').length;
                              if (vals.length > 0 && neg > 0 && aprov > 0) {
                                return `CONCLUIR (${aprov} APROV. / ${neg} NEG.)`;
                              }
                              if (vals.length > 0 && aprov === 0 && neg > 0) {
                                return `CONFIRMAR NEGAÇÃO DOS ITENS (${neg})`;
                              }
                              return 'APROVAR E ATENDER (BAIXA)';
                            })()}
                      </span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedReq(null)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>FECHAR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Rejeição de Requisição com parecer obrigatório */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-base">
              <AlertTriangle className="w-5 h-5" />
              <span>Justificativa Obrigatória de Rejeição</span>
            </div>

            <p className="text-xs text-slate-600">
              Conforme as diretrizes hospitalares de auditoria, toda requisição indeferida pelo almoxarife 
              deve conter parecer técnico detalhado para ciência do Centro de Custo solicitante.
            </p>

            <textarea
              rows={4}
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              placeholder="Descreva o motivo da recusa (ex: Insumo suspenso pela CCIH, saldo reservado para emergência cirúrgica)..."
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-rose-500 shadow-inner"
              required
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-semibold cursor-pointer"
              >
                CANCELAR
              </button>

              <button
                type="button"
                onClick={handleRejeitar}
                disabled={!motivoRejeicao.trim() || isProcessing}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? 'CONFIRMANDO...' : 'CONFIRMAR REJEIÇÃO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
