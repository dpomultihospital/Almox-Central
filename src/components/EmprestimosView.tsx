import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  ArrowLeft,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Printer,
  Calendar,
  Building2,
  UserCheck,
  Package,
  Save,
  Check,
  Download,
  Trash2
} from 'lucide-react';
import type { Emprestimo, Produto, CentroCusto, Usuario, EmpresaUnidade } from '../types/index.ts';
import {
  generateComprovanteEmprestimoPDF,
  type PdfGeneratedDocument,
} from '../utils/pdfGenerator.ts';
import { PdfPrintModal } from './PdfPrintModal.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';

interface EmprestimosViewProps {
  emprestimos: Emprestimo[];
  produtos: Produto[];
  centrosCusto: CentroCusto[];
  currentUser: Usuario | null;
  activeUnidade?: EmpresaUnidade | null;
  onRefresh: () => void;
  isCreateModalOpen?: boolean;
  setIsCreateModalOpen?: (open: boolean) => void;
  onVoltar?: () => void;
}

export const EmprestimosView: React.FC<EmprestimosViewProps> = ({
  emprestimos,
  produtos,
  centrosCusto,
  currentUser,
  activeUnidade,
  onRefresh,
  isCreateModalOpen = false,
  setIsCreateModalOpen,
  onVoltar,
}) => {
  // Abas de Status
  const [activeTab, setActiveTab] = useState<'todos' | 'abertos' | 'atrasados' | 'devolvidos'>('abertos');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroCcId, setFiltroCcId] = useState('');

  // Formulário de Novo Empréstimo em Abas
  const [isFormOpen, setIsFormOpen] = useState(isCreateModalOpen);
  const [activeFormTab, setActiveFormTab] = useState<'dados' | 'condicoes'>('dados');

  // Campos do Empréstimo
  const [formProdutoId, setFormProdutoId] = useState<number>(0);
  const [formQuantidade, setFormQuantidade] = useState<number>(1);
  const [formCcId, setFormCcId] = useState<number>(centrosCusto[0]?.id || 1);
  const [formSolicitanteId, setFormSolicitanteId] = useState<number>(currentUser?.id || 1);
  const [formDataPrevista, setFormDataPrevista] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [formCondicaoSaida, setFormCondicaoSaida] = useState('Em bom estado, higienizado e calibrado');
  const [formObservacao, setFormObservacao] = useState('');

  // Modal de Devolução
  const [selectedEmp, setSelectedEmp] = useState<Emprestimo | null>(null);
  const [condicaoDevolucao, setCondicaoDevolucao] = useState('Em bom estado de conservação e funcionamento');
  const [obsDevolucao, setObsDevolucao] = useState('');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pdfPreviewDoc, setPdfPreviewDoc] = useState<PdfGeneratedDocument | null>(null);
  const [deletingEmp, setDeletingEmp] = useState<Emprestimo | null>(null);

  const { toast } = useToast();
  const canManage = currentUser && (currentUser.perfil === 'admin' || currentUser.perfil === 'almoxarife');

  // Apenas produtos não consumíveis para empréstimo
  const equipamentosNaoConsumiveis = useMemo(() => {
    return produtos.filter((p) => p.tipo === 'nao_consumivel' && p.ativo === 1);
  }, [produtos]);

  // Filtragem dos empréstimos
  const filteredEmprestimos = useMemo(() => {
    return emprestimos.filter((e) => {
      if (activeTab === 'abertos' && e.status !== 'emprestado') return false;
      if (activeTab === 'atrasados' && e.status !== 'atrasado') return false;
      if (activeTab === 'devolvidos' && e.status !== 'devolvido') return false;

      if (filtroCcId && String(e.centro_custo_id) !== filtroCcId) return false;

      if (filtroBusca) {
        const term = filtroBusca.toLowerCase();
        const matchCode = e.codigo_emprestimo?.toLowerCase().includes(term);
        const matchProd = e.produto_nome?.toLowerCase().includes(term);
        const matchReq = e.solicitante_nome?.toLowerCase().includes(term);
        if (!matchCode && !matchProd && !matchReq) return false;
      }

      return true;
    });
  }, [emprestimos, activeTab, filtroCcId, filtroBusca]);

  const totalPages = Math.ceil(filteredEmprestimos.length / pageSize) || 1;
  const paginatedEmprestimos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEmprestimos.slice(start, start + pageSize);
  }, [filteredEmprestimos, currentPage, pageSize]);

  const handleAbrirCriacao = () => {
    setFormProdutoId(equipamentosNaoConsumiveis[0]?.id || 0);
    setFormQuantidade(1);
    setFormCcId(centrosCusto[0]?.id || 1);
    setFormSolicitanteId(currentUser?.id || 1);
    setFormDataPrevista(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setFormCondicaoSaida('Em bom estado, higienizado e calibrado');
    setFormObservacao('');
    setActiveFormTab('dados');
    setErrorMsg(null);
    setIsFormOpen(true);
    if (setIsCreateModalOpen) setIsCreateModalOpen(true);
  };

  const handleSalvarEmprestimo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProdutoId || formQuantidade <= 0 || !formDataPrevista) {
      const msg = 'Equipamento, quantidade e data prevista são obrigatórios.';
      setErrorMsg(msg);
      toast.error('Campos Obrigatórios', msg);
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/emprestimos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `user:${currentUser?.id}`,
        },
        body: JSON.stringify({
          produto_id: formProdutoId,
          quantidade: formQuantidade,
          centro_custo_id: formCcId,
          solicitante_id: formSolicitanteId,
          requisitante_id: formSolicitanteId,
          data_prevista_devolucao: formDataPrevista,
          condicao_saida: formCondicaoSaida,
          observacao: formObservacao ? formObservacao.trim() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar empréstimo.');
      }

      toast.success(
        'Empréstimo Registrado com Sucesso',
        data.message || `Cautela ${data.data?.codigo_emprestimo || ''} liberada e saldo atualizado.`
      );

      setIsFormOpen(false);
      if (setIsCreateModalOpen) setIsCreateModalOpen(false);
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Falha ao processar empréstimo.';
      setErrorMsg(msg);
      toast.error('Erro ao Liberar Empréstimo', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmarDevolucao = async () => {
    if (!selectedEmp) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/emprestimos/${selectedEmp.id}/devolver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `user:${currentUser?.id}`,
        },
        body: JSON.stringify({
          condicao_devolucao: condicaoDevolucao,
          observacao: obsDevolucao ? obsDevolucao.trim() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao receber devolução.');
      }

      toast.success(
        'Devolução Registrada com Sucesso',
        data.message || `O equipamento "${selectedEmp.produto_nome}" retornou ao estoque.`
      );

      setSelectedEmp(null);
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Falha ao registrar devolução.';
      setErrorMsg(msg);
      toast.error('Erro ao Receber Devolução', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDeleteEmprestimo = async () => {
    if (!deletingEmp) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/emprestimos/${deletingEmp.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `user:${currentUser?.id}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir registro de empréstimo.');
      }

      toast.success(
        'Empréstimo Excluído',
        data.message || `O registro de empréstimo "${deletingEmp.codigo_emprestimo || '#' + deletingEmp.id}" foi excluído.`
      );
      setDeletingEmp(null);
      onRefresh();
    } catch (err: any) {
      toast.error('Erro ao Excluir Empréstimo', err.message || 'Não foi possível excluir o registro.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'emprestado':
        return (
          <span className="inline-flex items-center gap-1 text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded text-[10px] border border-teal-300">
            <Clock className="w-3 h-3 text-teal-600" />
            <span>EM ABERTO</span>
          </span>
        );
      case 'atrasado':
        return (
          <span className="inline-flex items-center gap-1 text-rose-800 font-bold bg-rose-50 px-2 py-0.5 rounded text-[10px] border border-rose-300 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>ATRASADO</span>
          </span>
        );
      case 'devolvido':
        return (
          <span className="inline-flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>DEVOLVIDO</span>
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
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Empréstimos de Equipamentos</h1>
            <p className="text-xs text-slate-500">
              Controle de ferramentas, aparelhos cirúrgicos, termos de cautela e devoluções
            </p>
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

      {/* Formulário em Abas */}
      {isFormOpen && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden animate-fadeIn">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                Termo de Responsabilidade & Cautela
              </span>
              <h2 className="text-base font-bold text-slate-800 mt-1">Liberação de Empréstimo de Equipamento</h2>
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

          {errorMsg && (
            <div className="mx-6 mt-4 p-3 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Abas */}
          <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setActiveFormTab('dados')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'dados'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              1. Equipamento & Destino
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('condicoes')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'condicoes'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              2. Prazos & Estado de Conservação
            </button>
          </div>

          <form onSubmit={handleSalvarEmprestimo} className="p-6 space-y-6">
            {activeFormTab === 'dados' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Equipamento / Ferramenta (Aparelhos Não Consumíveis) *
                  </label>
                  <select
                    value={formProdutoId}
                    onChange={(e) => setFormProdutoId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                    required
                  >
                    <option value={0}>Selecione o equipamento...</option>
                    {equipamentosNaoConsumiveis.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.codigo} - {eq.nome} | Saldo Disponível: {eq.quantidade_atual} {eq.unidade_medida}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Quantidade Solicitada *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formQuantidade}
                    onChange={(e) => setFormQuantidade(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Centro de Custo de Destino *
                  </label>
                  <select
                    value={formCcId}
                    onChange={(e) => setFormCcId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  >
                    {centrosCusto.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.codigo} - {cc.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {activeFormTab === 'condicoes' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Data Prevista de Retorno / Devolução *
                  </label>
                  <input
                    type="date"
                    value={formDataPrevista}
                    onChange={(e) => setFormDataPrevista(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">O sistema altera o status automaticamente para Atrasado após esta data.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Estado de Conservação na Liberação
                  </label>
                  <input
                    type="text"
                    value={formCondicaoSaida}
                    onChange={(e) => setFormCondicaoSaida(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="ex: Sem avarias, revisado e testado"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Observações Clínicas / Responsável
                  </label>
                  <textarea
                    rows={2}
                    value={formObservacao}
                    onChange={(e) => setFormObservacao(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="Procedimento cirúrgico, identificação da equipe..."
                  />
                </div>
              </div>
            )}

            {/* Rodapé: SALVAR e VOLTAR */}
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
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium px-5 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isProcessing ? 'REGISTRANDO...' : 'REGISTRAR EMPRÉSTIMO'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Abas e Filtros */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        {/* Abas de Status */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => { setActiveTab('abertos'); setCurrentPage(1); }}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'abertos'
                ? 'border-teal-600 text-teal-800 bg-teal-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Em Aberto (Ativos)
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('atrasados'); setCurrentPage(1); }}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'atrasados'
                ? 'border-rose-600 text-rose-800 bg-rose-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Atrasados (Prazo Vencido)
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('devolvidos'); setCurrentPage(1); }}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'devolvidos'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Devolvidos (Histórico)
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('todos'); setCurrentPage(1); }}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'todos'
                ? 'border-slate-600 text-slate-800 bg-slate-100'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Todos os Registros
          </button>
        </div>

        {/* Linha de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Pesquisar Equipamento / Termo / Solicitante
            </label>
            <input
              type="text"
              value={filtroBusca}
              onChange={(e) => { setFiltroBusca(e.target.value); setCurrentPage(1); }}
              placeholder="ex: Bomba de Infusão, EMP-2026..."
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
        </div>

        {/* Botões */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
          {canManage && (
            <button
              type="button"
              onClick={handleAbrirCriacao}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ NOVO EMPRÉSTIMO</span>
            </button>
          )}

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

      {/* Grid de Empréstimos Zebrada */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Termo Nº</th>
                <th className="py-2.5 px-3">Equipamento</th>
                <th className="py-2.5 px-3 text-center">Qtd</th>
                <th className="py-2.5 px-3">Centro de Custo</th>
                <th className="py-2.5 px-3">Solicitante</th>
                <th className="py-2.5 px-3">Data Saída</th>
                <th className="py-2.5 px-3">Prazo Retorno</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedEmprestimos.length > 0 ? (
                paginatedEmprestimos.map((e) => (
                  <tr key={e.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/40 transition-colors">
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">
                      {e.codigo_emprestimo || `EMP-${String(e.id).padStart(4, '0')}`}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">{e.produto_nome}</td>
                    <td className="py-2 px-3 text-center font-bold text-slate-700 font-mono">{e.quantidade}</td>
                    <td className="py-2 px-3 text-slate-600">{e.centro_custo_nome}</td>
                    <td className="py-2 px-3 text-slate-600">{e.solicitante_nome}</td>
                    <td className="py-2 px-3 text-slate-600">
                      {new Date(e.data_emprestimo).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">
                      {new Date(e.data_prevista_devolucao).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-2 px-3 text-center">{getStatusBadge(e.status)}</td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && e.status !== 'devolvido' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEmp(e);
                              setCondicaoDevolucao('Em perfeito estado de conservação');
                              setObsDevolucao('');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2.5 py-1 rounded text-xs flex items-center gap-1 transition-all uppercase tracking-wide cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>RECEBER DEVOLUÇÃO</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            const doc = await generateComprovanteEmprestimoPDF({
                              emprestimo: e,
                              currentUser,
                              activeUnidade,
                              mode: 'print',
                            });
                            setPdfPreviewDoc(doc);
                          }}
                          className="px-2 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          title="Gerar e imprimir Termo de Cautela / Comprovante em PDF"
                        >
                          <Printer className="w-3.5 h-3.5 text-teal-700" />
                          <span>Cautela PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            generateComprovanteEmprestimoPDF({
                              emprestimo: e,
                              currentUser,
                              activeUnidade,
                              mode: 'download',
                            })
                          }
                          className="p-1.5 rounded bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#00237D] border border-slate-200 cursor-pointer"
                          title="Baixar Termo de Cautela em PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setDeletingEmp(e)}
                            className="p-1.5 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 transition-colors cursor-pointer"
                            title="Excluir registro de empréstimo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Nenhum empréstimo encontrado nesta categoria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Consulta */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            <strong>{filteredEmprestimos.length}</strong> registro(s) encontrado(s)
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

      {/* Modal de Devolução de Equipamento com Recomposição de Saldo */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-2 text-teal-800 font-bold text-base">
              <RotateCcw className="w-5 h-5 text-teal-600" />
              <span>Conferência e Recebimento de Devolução</span>
            </div>

            <p className="text-xs text-slate-600">
              Confirme o retorno do equipamento <strong>{selectedEmp.produto_nome}</strong> ({selectedEmp.quantidade} unidade(s)) 
              ao almoxarifado. O saldo físico disponível será recomposto automaticamente no estoque.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Condição / Estado Físico no Recebimento *
                </label>
                <input
                  type="text"
                  value={condicaoDevolucao}
                  onChange={(e) => setCondicaoDevolucao(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Observações / Laudo da Conferência
                </label>
                <textarea
                  rows={2}
                  value={obsDevolucao}
                  onChange={(e) => setObsDevolucao(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                  placeholder="Informações sobre desinfecção, calibração..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedEmp(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded text-xs font-semibold cursor-pointer"
              >
                CANCELAR
              </button>

              <button
                type="button"
                onClick={handleConfirmarDevolucao}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 uppercase tracking-wide transition-all shadow cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isProcessing ? 'PROCESSANDO...' : 'CONFIRMAR DEVOLUÇÃO'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <PdfPrintModal
        pdfDoc={pdfPreviewDoc}
        onClose={() => setPdfPreviewDoc(null)}
      />

      <ConfirmDeleteModal
        isOpen={!!deletingEmp}
        title="Excluir Registro de Empréstimo"
        entityCode={deletingEmp?.codigo_emprestimo || (deletingEmp ? `EMP-${String(deletingEmp.id).padStart(4, '0')}` : undefined)}
        entityName={deletingEmp?.produto_nome || ''}
        description="Caso o empréstimo ainda conste como aberto, o saldo físico do equipamento será recomposto automaticamente ao almoxarifado."
        isProcessing={isProcessing}
        onConfirm={handleConfirmDeleteEmprestimo}
        onClose={() => setDeletingEmp(null)}
      />
    </div>
  );
};
