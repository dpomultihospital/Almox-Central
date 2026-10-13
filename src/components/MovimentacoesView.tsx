import React, { useState, useMemo } from 'react';
import {
  History,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  AlertTriangle,
  Search,
  ShieldCheck,
  Printer,
  Download,
  FileText,
  CheckCircle2,
  Plus,
  ArrowLeft,
  Save,
  Trash2,
  Package,
  UserCheck,
  X,
} from 'lucide-react';
import type { Movimentacao, Produto, Fornecedor, Usuario, EmpresaUnidade } from '../types/index.ts';
import {
  generateComprovanteMovimentacaoPDF,
  generateRelatorioMovimentacoesTelaPDF,
  type PdfGeneratedDocument,
} from '../utils/pdfGenerator.ts';
import { PdfPrintModal } from './PdfPrintModal.tsx';
import { HelpFloatingModal } from './HelpFloatingModal.tsx';
import { useToast } from '../context/ToastContext.tsx';

interface MovimentacoesViewProps {
  movimentacoes: Movimentacao[];
  produtos?: Produto[];
  fornecedores?: Fornecedor[];
  currentUser: Usuario | null;
  activeUnidade?: EmpresaUnidade | null;
  onRefresh: () => void;
  onVoltar?: () => void;
}

const MOTIVOS_SAIDA_DIVERSA = [
  'Saída por Vencimento/Descarte',
  'Avaria/Quebra',
  'Perda/Extravio',
  'Ajuste de Inventário (-)',
  'Doação/Empréstimo Concedido',
] as const;

const MOTIVOS_ENTRADA_DIVERSA = [
  'Ajuste de Inventário (+)',
  'Doação Recebida',
  'Devolução de Empréstimo entre Entidades',
] as const;

export const MovimentacoesView: React.FC<MovimentacoesViewProps> = ({
  movimentacoes,
  produtos = [],
  fornecedores = [],
  currentUser,
  activeUnidade,
  onRefresh,
  onVoltar,
}) => {
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Formulário de Movimentações Diversas (Saídas e Entradas Diversas)
  const [isDiversaOpen, setIsDiversaOpen] = useState<boolean>(false);
  const [naturezaDiversa, setNaturezaDiversa] = useState<'saida' | 'entrada'>('saida');
  const [motivoDiverso, setMotivoDiverso] = useState<string>('Saída por Vencimento/Descarte');
  const [divProdutoId, setDivProdutoId] = useState<number>(produtos[0]?.id || 0);
  const [divLoteId, setDivLoteId] = useState<number>(0);
  const [divNumeroLote, setDivNumeroLote] = useState<string>('');
  const [divDataValidade, setDivDataValidade] = useState<string>('');
  const [divQuantidade, setDivQuantidade] = useState<number>(1);
  const [divEntidadeId, setDivEntidadeId] = useState<number>(0);
  const [divResponsavel, setDivResponsavel] = useState<string>(currentUser?.nome || '');
  const [divDocumento, setDivDocumento] = useState<string>('');
  const [divJustificativa, setDivJustificativa] = useState<string>('');
  const [divError, setDivError] = useState<string | null>(null);
  const [isSavingDiversa, setIsSavingDiversa] = useState<boolean>(false);

  // Termo de Descarte / Baixa por Vencimento para Impressão
  const [termoDescarteModal, setTermoDescarteModal] = useState<any | null>(null);

  // Modal de Estorno
  const [estornoItem, setEstornoItem] = useState<Movimentacao | null>(null);
  const [justificativa, setJustificativa] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estado de geração/impressão de PDF (Relatório da Tela e Comprovante Individual)
  const [pdfPreviewDoc, setPdfPreviewDoc] = useState<PdfGeneratedDocument | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const { toast } = useToast();
  const isAdmin = currentUser?.perfil === 'admin';
  const canManage = currentUser && (currentUser.perfil === 'admin' || currentUser.perfil === 'almoxarife');

  const produtoDiversaSelecionado = useMemo(
    () => produtos.find((p) => p.id === Number(divProdutoId)) || null,
    [produtos, divProdutoId]
  );

  const lotesDoProdutoSelecionado = useMemo(
    () => (produtoDiversaSelecionado?.lotes || []).filter((l) => l.quantidade_atual > 0),
    [produtoDiversaSelecionado]
  );

  const loteSelecionadoObj = useMemo(
    () => lotesDoProdutoSelecionado.find((l) => l.id === Number(divLoteId)) || null,
    [lotesDoProdutoSelecionado, divLoteId]
  );

  const handleAbrirMovimentacaoDiversa = (nat: 'saida' | 'entrada', motivoPadrao?: string) => {
    setNaturezaDiversa(nat);
    const defaultMotivo =
      motivoPadrao || (nat === 'saida' ? MOTIVOS_SAIDA_DIVERSA[0] : MOTIVOS_ENTRADA_DIVERSA[0]);
    setMotivoDiverso(defaultMotivo);
    const firstProd = produtos[0];
    setDivProdutoId(firstProd?.id || 0);
    const firstLote = firstProd?.lotes?.[0];
    setDivLoteId(firstLote?.id || 0);
    setDivNumeroLote(nat === 'entrada' ? `LT-${new Date().getFullYear()}` : firstLote?.numero_lote || '');
    setDivDataValidade(nat === 'entrada' ? '2027-12-31' : firstLote?.data_validade || '');
    setDivQuantidade(1);
    setDivEntidadeId(0);
    setDivResponsavel(currentUser?.nome || '');
    setDivDocumento('');
    setDivJustificativa('');
    setDivError(null);
    setIsDiversaOpen(true);
  };

  const handleSalvarMovimentacaoDiversa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!divProdutoId || divQuantidade <= 0) {
      const msg = 'Selecione o produto e informe uma quantidade válida maior que zero.';
      setDivError(msg);
      toast.error('Campos Obrigatórios', msg);
      return;
    }

    if (!divResponsavel.trim()) {
      const msg = 'Informe o nome do responsável pela movimentação.';
      setDivError(msg);
      toast.error('Responsável Obrigatório', msg);
      return;
    }

    if (!divJustificativa.trim()) {
      const msg = 'A justificativa detalhada é obrigatória para registrar Entradas ou Saídas Diversas.';
      setDivError(msg);
      toast.error('Justificativa Obrigatória', msg);
      return;
    }

    // Validação preventiva no frontend: bloqueio de lote vencido para saídas normais
    if (
      naturezaDiversa === 'saida' &&
      motivoDiverso !== 'Saída por Vencimento/Descarte' &&
      loteSelecionadoObj?.status_validade === 'vencido'
    ) {
      const msg = `BLOQUEIO AUTOMÁTICO DE VENCIMENTO: O lote "${loteSelecionadoObj.numero_lote}" está VENCIDO (${loteSelecionadoObj.data_validade}). O único tipo de movimentação permitido para lotes vencidos é "Saída por Vencimento/Descarte".`;
      setDivError(msg);
      toast.error('Lote Vencido Bloqueado', msg);
      return;
    }

    setIsSavingDiversa(true);
    setDivError(null);

    try {
      const res = await fetch('/api/movimentacoes/diversas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `user:${currentUser?.id}`,
        },
        body: JSON.stringify({
          natureza: naturezaDiversa,
          motivo_diverso: motivoDiverso,
          produto_id: divProdutoId,
          lote_id: divLoteId || null,
          numero_lote: naturezaDiversa === 'entrada' ? divNumeroLote.trim() : loteSelecionadoObj?.numero_lote || divNumeroLote.trim(),
          data_validade: naturezaDiversa === 'entrada' ? divDataValidade : loteSelecionadoObj?.data_validade || divDataValidade,
          quantidade: divQuantidade,
          entidade_id: divEntidadeId || null,
          responsavel_nome: divResponsavel.trim(),
          documento_referencia: divDocumento.trim() || null,
          justificativa: divJustificativa.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar movimentação diversa.');
      }

      toast.success(
        naturezaDiversa === 'saida' ? 'Saída Diversa Registrada' : 'Entrada Diversa Registrada',
        data.message
      );

      setIsDiversaOpen(false);
      if (data.data?.termo_descarte) {
        setTermoDescarteModal(data.data.termo_descarte);
      }
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Erro ao salvar movimentação diversa.';
      setDivError(msg);
      toast.error('Operação Bloqueada / Erro', msg);
    } finally {
      setIsSavingDiversa(false);
    }
  };

  const showToast = (msg: string) => {
    setFeedbackMsg(msg);
    toast.success('Documento PDF Gerado', msg);
    setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleConfirmarEstorno = async () => {
    if (!estornoItem) return;
    if (!justificativa.trim()) {
      const msg = 'A justificativa é obrigatória para executar um estorno auditável';
      setErrorMsg(msg);
      toast.error('Justificativa Obrigatória', msg);
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/movimentacoes/${estornoItem.id}/estornar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `user:${currentUser?.id}`,
        },
        body: JSON.stringify({ justificativa: justificativa.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao estornar movimentação');

      toast.success(
        'Estorno Efetuado com Sucesso',
        data.message || `Lançamento #${estornoItem.id} estornado e saldo ajustado no livro-caixa.`
      );

      setEstornoItem(null);
      setJustificativa('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
      toast.error('Erro ao Estornar Movimentação', err.message || 'Falha ao processar estorno.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = movimentacoes.filter((m) => {
    const isDiversa =
      m.motivo_diverso &&
      m.motivo_diverso !== 'Entrada por Nota Fiscal' &&
      m.motivo_diverso !== 'Atendimento de Requisição';

    const matchesTipo =
      filterTipo === 'todos'
        ? true
        : filterTipo === 'diversas'
        ? Boolean(isDiversa)
        : m.tipo === filterTipo;

    const matchesSearch = !searchTerm.trim() ||
      m.produto_codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.produto_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.documento_referencia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.numero_lote?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.motivo_diverso?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.centro_custo_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.usuario_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.observacao?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesTipo && matchesSearch;
  });

  const handleExportarRelatorioTela = async (mode: 'download' | 'print') => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const tipoLabels: Record<string, string> = {
        todos: 'Todas as Operações',
        entrada: 'Apenas Entradas',
        saida: 'Apenas Saídas',
        estorno_entrada: 'Estornos de Entrada',
        estorno_saida: 'Estornos de Saída',
      };
      const filtroDesc = `${tipoLabels[filterTipo] || filterTipo}${
        searchTerm.trim() ? ` | Busca: "${searchTerm.trim()}"` : ''
      }`;

      const generated = await generateRelatorioMovimentacoesTelaPDF({
        movimentacoes: filtered,
        titulo: 'Extrato do Livro-Caixa de Movimentações de Estoque',
        subtitulo: 'Relatório oficial das movimentações exibidas em tela',
        filtroDescricao: filtroDesc,
        currentUser,
        activeUnidade,
        mode,
      });

      if (mode === 'print') {
        setPdfPreviewDoc(generated);
      } else {
        showToast(`Relatório PDF gerado com ${filtered.length} movimentação(ões).`);
      }
    } catch (err) {
      console.error('Erro ao gerar PDF de movimentações:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleEmitirComprovanteIndividual = async (
    mov: Movimentacao,
    mode: 'download' | 'print'
  ) => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const generated = await generateComprovanteMovimentacaoPDF({
        mov,
        currentUser,
        activeUnidade,
        mode,
      });

      if (mode === 'print') {
        setPdfPreviewDoc(generated);
      } else {
        showToast(`Comprovante da movimentação #${mov.id} baixado em PDF.`);
      }
    } catch (err) {
      console.error('Erro ao gerar comprovante de movimentação:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Compacto */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Movimentações Diversas & Livro-Caixa de Estoque
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Saídas e Entradas Diversas com justificativa e responsável obrigatórios
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => handleAbrirMovimentacaoDiversa('saida', 'Saída por Vencimento/Descarte')}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>+ Saída Diversa / Baixa Vencimento</span>
              </button>

              <button
                type="button"
                onClick={() => handleAbrirMovimentacaoDiversa('entrada', 'Ajuste de Inventário (+)')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>+ Entrada Diversa</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => handleExportarRelatorioTela('print')}
            disabled={isGeneratingPdf || filtered.length === 0}
            className="px-3.5 py-2 bg-[#00237D] hover:bg-[#001a5e] text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Gerar PDF com jsPDF e abrir impressão direta dos dados da tela"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir PDF</span>
          </button>

          <HelpFloatingModal
            title="Ajuda & Regras — Movimentações Diversas e Livro-Caixa"
            subtitle="Saídas Diversas, Entradas Diversas e Descarte de Lotes Vencidos"
            sections={[
              {
                title: 'Saídas Diversas (Com Justificativa e Responsável)',
                badge: 'Baixa de Saldo (-)',
                tone: 'rose',
                description:
                  'Motivos permitidos: Saída por Vencimento/Descarte, Avaria/Quebra, Perda/Extravio, Ajuste de Inventário (-), Doação/Empréstimo Concedido e Devolução de Empréstimo a Terceiros.',
              },
              {
                title: 'Bloqueio e Baixa de Lotes Vencidos',
                badge: 'Regra de Validade',
                tone: 'amber',
                description:
                  'Lotes vencidos são bloqueados para consumo normal. Para retirá-los do estoque físico, selecione "Saída por Vencimento/Descarte", escolha o lote vencido correspondente e emita o termo de descarte/baixa.',
              },
              {
                title: 'Entradas Diversas (+)',
                badge: 'Acréscimo de Saldo (+)',
                tone: 'teal',
                description:
                  'Motivos permitidos: Ajuste de Inventário (+), Doação Recebida, Entrada por Empréstimo Recebido e Recebimento de Devolução de Empréstimo.',
              },
            ]}
          />

          {onVoltar && (
            <button
              type="button"
              onClick={onVoltar}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Painel</span>
            </button>
          )}
        </div>
      </div>

      {/* Formulário de Movimentações Diversas (Saídas Diversas e Entradas Diversas) */}
      {isDiversaOpen && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden animate-fadeIn">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                  naturezaDiversa === 'saida'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {naturezaDiversa === 'saida' ? 'Saída Diversa de Estoque (-)' : 'Entrada Diversa de Estoque (+)'}
              </span>
              <h3 className="text-base font-bold text-slate-800 mt-1">
                Registrar {naturezaDiversa === 'saida' ? 'Saída Diversa / Descarte por Vencimento' : 'Entrada Diversa'} com Justificativa Obrigatória
              </h3>
            </div>

            <button
              type="button"
              onClick={() => setIsDiversaOpen(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Fechar</span>
            </button>
          </div>

          {divError && (
            <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>{divError}</div>
            </div>
          )}

          <form onSubmit={handleSalvarMovimentacaoDiversa} className="p-6 space-y-5">
            {/* Alternância rápida entre Saída Diversa e Entrada Diversa */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Natureza da Operação *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNaturezaDiversa('saida');
                      setMotivoDiverso(MOTIVOS_SAIDA_DIVERSA[0]);
                      setDivError(null);
                    }}
                    className={`py-2 px-3 rounded text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                      naturezaDiversa === 'saida'
                        ? 'bg-rose-600 text-white border-rose-700 shadow'
                        : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Saída Diversa (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNaturezaDiversa('entrada');
                      setMotivoDiverso(MOTIVOS_ENTRADA_DIVERSA[0]);
                      setDivError(null);
                    }}
                    className={`py-2 px-3 rounded text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                      naturezaDiversa === 'entrada'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow'
                        : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Entrada Diversa (+)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Motivo da Movimentação Diversa *
                </label>
                <select
                  value={motivoDiverso}
                  onChange={(e) => {
                    setMotivoDiverso(e.target.value);
                    setDivError(null);
                  }}
                  className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-semibold focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                >
                  {(naturezaDiversa === 'saida' ? MOTIVOS_SAIDA_DIVERSA : MOTIVOS_ENTRADA_DIVERSA).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Responsável pela Movimentação *
                </label>
                <input
                  type="text"
                  value={divResponsavel}
                  onChange={(e) => setDivResponsavel(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                  placeholder="Nome completo do responsável..."
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Produto (Código Único Interno) *
                </label>
                <select
                  value={divProdutoId}
                  onChange={(e) => {
                    const nextId = Number(e.target.value);
                    setDivProdutoId(nextId);
                    const pObj = produtos.find((p) => p.id === nextId);
                    const lotesAtivos = (pObj?.lotes || []).filter((l) => l.quantidade_atual > 0);
                    if (motivoDiverso === 'Saída por Vencimento/Descarte') {
                      const vencido = lotesAtivos.find((l) => l.status_validade === 'vencido');
                      setDivLoteId(vencido?.id || lotesAtivos[0]?.id || 0);
                    } else {
                      const valido = lotesAtivos.find((l) => l.status_validade !== 'vencido');
                      setDivLoteId(valido?.id || lotesAtivos[0]?.id || 0);
                    }
                  }}
                  className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  required
                >
                  <option value={0}>Selecione o produto...</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.codigo}] {p.nome} ({p.unidade_medida}) — Saldo Atual: {p.quantidade_atual}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Quantidade ({produtoDiversaSelecionado?.unidade_medida || 'UN'}) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={divQuantidade}
                  onChange={(e) => setDivQuantidade(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
                  required
                />
              </div>

              {naturezaDiversa === 'saida' ? (
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Lote de Estoque para Baixa {motivoDiverso === 'Saída por Vencimento/Descarte' ? '(Selecione o Lote Vencido) *' : '*'}
                  </label>
                  <select
                    value={divLoteId}
                    onChange={(e) => setDivLoteId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  >
                    <option value={0}>Seleção automática FEFO (Primeiro que vence)</option>
                    {lotesDoProdutoSelecionado.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        Lote: {lt.numero_lote} | Validade: {lt.data_validade ? lt.data_validade.split('-').reverse().join('/') : 'S/V'} | Saldo: {lt.quantidade_atual} |{' '}
                        {lt.status_validade === 'vencido'
                          ? 'VENCIDO (BLOQUEADO P/ CONSUMO - APENAS DESCARTE)'
                          : lt.status_validade === 'critico_30d'
                          ? 'CRÍTICO ≤ 30d'
                          : lt.status_validade === 'alerta_60d'
                          ? 'ALERTA ≤ 60d'
                          : lt.status_validade === 'atencao_90d'
                          ? 'ATENÇÃO ≤ 90d'
                          : 'VÁLIDO'}
                      </option>
                    ))}
                  </select>
                  {loteSelecionadoObj?.status_validade === 'vencido' && motivoDiverso !== 'Saída por Vencimento/Descarte' && (
                    <p className="text-[11px] text-rose-700 font-bold mt-1">
                      Bloqueio Automático: Este lote está vencido! Altere o motivo para &ldquo;Saída por Vencimento/Descarte&rdquo; para gerar o termo de baixa.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Número do Lote (Entrada Diversa) *
                    </label>
                    <input
                      type="text"
                      value={divNumeroLote}
                      onChange={(e) => setDivNumeroLote(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
                      placeholder="ex: LT-INV-01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Data de Validade *
                    </label>
                    <input
                      type="date"
                      value={divDataValidade}
                      onChange={(e) => setDivDataValidade(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Entidade Parceira / Fornecedor (Opcional)
                </label>
                <select
                  value={divEntidadeId}
                  onChange={(e) => setDivEntidadeId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                >
                  <option value={0}>Nenhuma entidade vinculada</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.codigo} - {f.nome_fantasia || f.razao_social} ({f.tipo_entidade === 'entidade_parceira' ? 'Hospital Parceiro' : 'Fornecedor'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Justificativa Obrigatória da Movimentação Diversa *
                </label>
                <textarea
                  rows={2}
                  value={divJustificativa}
                  onChange={(e) => setDivJustificativa(e.target.value)}
                  className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                  placeholder="Descreva detalhadamente o motivo técnico/administrativo desta movimentação (ex: Lote vencido recolhido para descarte sanitário / Ajuste após contagem física de inventário)..."
                  required
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsDiversaOpen(false)}
                className="px-4 py-2 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingDiversa}
                className={`px-5 py-2 rounded text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50 ${
                  naturezaDiversa === 'saida'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSavingDiversa
                    ? 'Registrando...'
                    : naturezaDiversa === 'saida' && motivoDiverso === 'Saída por Vencimento/Descarte'
                    ? 'Confirmar Baixa e Gerar Termo de Descarte'
                    : `Confirmar ${naturezaDiversa === 'saida' ? 'Saída Diversa' : 'Entrada Diversa'}`}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {feedbackMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Controles de Filtro e Busca */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Segmented controls para tipo de movimentação */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto w-full md:w-auto">
          {[
            { id: 'todos', label: 'Todas as Operações' },
            { id: 'diversas', label: 'Saídas & Entradas Diversas' },
            { id: 'entrada', label: 'Entradas' },
            { id: 'saida', label: 'Saídas' },
            { id: 'estorno_entrada', label: 'Estornos de Entrada' },
            { id: 'estorno_saida', label: 'Estornos de Saída' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTipo(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                filterTipo === tab.id ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Input de Busca */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por lote, motivo, produto, doc..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 text-slate-800"
          />
        </div>
      </div>

      {/* Tabela do Livro-Caixa */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Tipo / Motivo</th>
                <th className="py-3 px-4">Produto (Cód. Único)</th>
                <th className="py-3 px-4 text-center">Lote / Validade</th>
                <th className="py-3 px-4 text-right">Qtd</th>
                <th className="py-3 px-4">Destino / Entidade</th>
                <th className="py-3 px-4">Doc. Ref</th>
                <th className="py-3 px-4">Responsável</th>
                <th className="py-3 px-4">Justificativa / Obs</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    Nenhum registro encontrado no livro-caixa com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filtered.map((mov) => {
                  const isEntrada = mov.tipo === 'entrada';
                  const isSaida = mov.tipo === 'saida';
                  const isEstorno = mov.tipo.startsWith('estorno_');

                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-500">
                        #{mov.id}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {mov.data_movimentacao}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                          isEntrada 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : isSaida 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {isEntrada && <ArrowDownLeft className="w-3 h-3 text-emerald-600" />}
                          {isSaida && <ArrowUpRight className="w-3 h-3 text-blue-600" />}
                          {isEstorno && <RotateCcw className="w-3 h-3 text-purple-600" />}
                          {mov.tipo.replace('_', ' ')}
                        </span>
                        {mov.motivo_diverso && (
                          <div className="text-[10px] font-bold text-slate-700 mt-0.5">
                            {mov.motivo_diverso}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-teal-800 font-bold text-[11px] block">{mov.produto_codigo}</span>
                        <span className="font-medium text-slate-900">{mov.produto_nome}</span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-700">
                        <div>{mov.numero_lote || '—'}</div>
                        {mov.data_validade && (
                          <div className="text-[10px] text-slate-500">
                            Val: {mov.data_validade.split('-').reverse().join('/')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                        <span className={isEntrada || mov.tipo === 'estorno_saida' ? 'text-emerald-700' : 'text-blue-700'}>
                          {isEntrada || mov.tipo === 'estorno_saida' ? '+' : '-'}{mov.quantidade} {mov.unidade_medida}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {mov.centro_custo_nome ? (
                          <>
                            <span className="font-mono text-slate-500 text-[11px] block">{mov.centro_custo_codigo}</span>
                            <span className="text-slate-800">{mov.centro_custo_nome}</span>
                          </>
                        ) : mov.fornecedor_nome ? (
                          <>
                            <span className="font-mono text-indigo-700 text-[10px] font-bold block">{mov.fornecedor_codigo}</span>
                            <span className="text-slate-800">{mov.fornecedor_nome}</span>
                          </>
                        ) : (
                          <span className="text-slate-400 italic">Almoxarifado Central</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-800">
                        {mov.documento_referencia || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {mov.responsavel_nome || mov.usuario_nome}
                      </td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-xs" title={mov.observacao || ''}>
                        {mov.observacao || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEmitirComprovanteIndividual(mov, 'print')}
                            className="px-2 py-1 text-[11px] font-semibold text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Gerar e imprimir comprovante desta movimentação em PDF"
                          >
                            <Printer className="w-3 h-3 text-teal-700" />
                            <span>Termo / PDF</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEmitirComprovanteIndividual(mov, 'download')}
                            className="p-1 text-slate-600 hover:text-[#00237D] bg-slate-100 hover:bg-blue-50 rounded border border-slate-200 transition-colors cursor-pointer"
                            title="Baixar comprovante individual em PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {isAdmin && !isEstorno && (
                            <button
                              type="button"
                              onClick={() => {
                                setErrorMsg(null);
                                setJustificativa('');
                                setEstornoItem(mov);
                              }}
                              className="px-2 py-1 text-[11px] font-medium text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="Criar lançamento compensatório de estorno"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Estornar</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Termo de Descarte / Baixa por Vencimento */}
      {termoDescarteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-rose-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-rose-800 px-2 py-0.5 rounded">
                  Documento Oficial de Baixa Sanitária
                </span>
                <h3 className="text-base font-bold mt-1">
                  Termo de Descarte / Baixa por Vencimento ({termoDescarteModal.numero_termo})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTermoDescarteModal(null)}
                className="text-rose-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-slate-800" id="printable-termo-descarte">
              <div className="border-b border-slate-200 pb-3 flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm text-slate-900">
                    {activeUnidade?.nome || 'SISTEMA DE ALMOXARIFADO HOSPITALAR - MULTI ALMOX'}
                  </div>
                  <div className="text-slate-500">
                    Termo de Baixa de Lote Vencido e Encaminhamento para Descarte
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-bold text-rose-800">{termoDescarteModal.numero_termo}</div>
                  <div className="text-slate-500">{termoDescarteModal.data_emissao}</div>
                </div>
              </div>

              <table className="w-full border border-slate-300 text-left text-xs">
                <thead className="bg-slate-100 font-bold uppercase">
                  <tr>
                    <th className="p-2 border-b border-slate-300">Código</th>
                    <th className="p-2 border-b border-slate-300">Descrição do Produto</th>
                    <th className="p-2 border-b border-slate-300 text-center">Lote Vencido</th>
                    <th className="p-2 border-b border-slate-300 text-center">Validade</th>
                    <th className="p-2 border-b border-slate-300 text-right">Qtd Baixada</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 font-mono font-bold">{termoDescarteModal.produto_codigo}</td>
                    <td className="p-2 font-semibold">{termoDescarteModal.produto_nome}</td>
                    <td className="p-2 text-center font-mono font-bold text-rose-700">{termoDescarteModal.numero_lote}</td>
                    <td className="p-2 text-center font-mono">
                      {termoDescarteModal.data_validade ? termoDescarteModal.data_validade.split('-').reverse().join('/') : '—'}
                    </td>
                    <td className="p-2 text-right font-mono font-bold">
                      {termoDescarteModal.quantidade_descartada} {termoDescarteModal.unidade_medida}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="font-bold uppercase text-[10px] text-slate-500 mb-1">Justificativa / Parecer de Descarte:</div>
                <div>{termoDescarteModal.justificativa}</div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 text-center">
                <div>
                  <div className="border-t border-slate-800 pt-1.5 font-bold text-slate-800">
                    Responsável pelo Almoxarifado ({termoDescarteModal.responsavel_nome})
                  </div>
                  <div className="text-[10px] text-slate-500">Conferência e Baixa Física</div>
                </div>
                <div>
                  <div className="border-t border-slate-800 pt-1.5 font-bold text-slate-800">
                    Responsável Técnico / Comissão de Descarte
                  </div>
                  <div className="text-[10px] text-slate-500">Visto de Conformidade Sanitária</div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-[#00237D] hover:bg-blue-900 text-white rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Termo de Descarte</span>
              </button>
              <button
                type="button"
                onClick={() => setTermoDescarteModal(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização / Impressão Direta de PDF */}
      <PdfPrintModal
        pdfDoc={pdfPreviewDoc}
        onClose={() => setPdfPreviewDoc(null)}
      />

      {/* Modal de Estorno Auditável */}
      {estornoItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 text-purple-700">
              <RotateCcw className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900">Autorizar Estorno Compensatório</h3>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
              <div>
                <strong className="text-slate-900">Lançamento Original:</strong> #{estornoItem.id} ({estornoItem.tipo})
              </div>
              <div>
                <strong className="text-slate-900">Produto:</strong> {estornoItem.produto_codigo} — {estornoItem.produto_nome}
              </div>
              <div>
                <strong className="text-slate-900">Quantidade:</strong> {estornoItem.quantidade} {estornoItem.unidade_medida}
              </div>
              <div>
                <strong className="text-slate-900">Documento:</strong> {estornoItem.documento_referencia || 'S/D'}
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Por princípios de rastreabilidade contábil, o lançamento original <strong>não será apagado</strong>.
              Um novo registro de estorno com tipo oposto será gerado e o saldo do produto no almoxarifado será ajustado.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Justificativa Formal do Estorno <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="Ex: Lançamento duplicado por erro de digitação da NF 48290..."
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-purple-500 text-slate-800"
              />
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-lg text-xs flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>{errorMsg}</div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEstornoItem(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEstorno}
                disabled={isProcessing || !justificativa.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isProcessing ? 'Gravando...' : 'Confirmar Estorno'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
