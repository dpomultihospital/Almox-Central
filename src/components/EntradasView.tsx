import React, { useState, useMemo } from 'react';
import {
  PackagePlus,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Save,
  Building2,
  Calendar,
  DollarSign,
  Printer,
  Download
} from 'lucide-react';
import type { Produto, Usuario, Movimentacao, EmpresaUnidade } from '../types/index.ts';
import {
  generateComprovanteMovimentacaoPDF,
  generateRelatorioMovimentacoesTelaPDF,
  type PdfGeneratedDocument,
} from '../utils/pdfGenerator.ts';
import { PdfPrintModal } from './PdfPrintModal.tsx';
import { useToast } from '../context/ToastContext.tsx';

interface EntradasViewProps {
  produtos: Produto[];
  movimentacoes: Movimentacao[];
  currentUser: Usuario | null;
  activeUnidade?: EmpresaUnidade | null;
  onRefresh: () => void;
  isCreateModalOpen?: boolean;
  setIsCreateModalOpen?: (open: boolean) => void;
  onVoltar?: () => void;
}

export const EntradasView: React.FC<EntradasViewProps> = ({
  produtos,
  movimentacoes,
  currentUser,
  activeUnidade,
  onRefresh,
  isCreateModalOpen = false,
  setIsCreateModalOpen,
  onVoltar,
}) => {
  // Filtros de busca
  const [filtroDoc, setFiltroDoc] = useState('');
  const [filtroProduto, setFiltroProduto] = useState('');

  // Formulário em Abas
  const [isFormOpen, setIsFormOpen] = useState(isCreateModalOpen);
  const [activeFormTab, setActiveFormTab] = useState<'nf' | 'itens'>('nf');

  // Campos do Formulário
  const [formFornecedor, setFormFornecedor] = useState('Distribuidora Hospitalar MedFarma');
  const [formDocumento, setFormDocumento] = useState(`NF-${Math.floor(10000 + Math.random() * 90000)}`);
  const [formProdutoId, setFormProdutoId] = useState<number>(produtos[0]?.id || 0);
  const [formQuantidade, setFormQuantidade] = useState<number>(100);
  const [formNumeroLote, setFormNumeroLote] = useState('LT-2026A');
  const [formDataValidade, setFormDataValidade] = useState('2027-12-31');
  const [formValorUnitario, setFormValorUnitario] = useState<number>(12.5);
  const [formObservacao, setFormObservacao] = useState('Recebimento de compra regular');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pdfPreviewDoc, setPdfPreviewDoc] = useState<PdfGeneratedDocument | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const { toast } = useToast();
  const canManage = currentUser && (currentUser.perfil === 'admin' || currentUser.perfil === 'almoxarife');

  // Filtragem das movimentações do tipo 'entrada'
  const entradas = useMemo(() => {
    return movimentacoes.filter((m) => m.tipo === 'entrada');
  }, [movimentacoes]);

  const filteredEntradas = useMemo(() => {
    return entradas.filter((e) => {
      if (filtroDoc && !e.documento_referencia?.toLowerCase().includes(filtroDoc.toLowerCase())) return false;
      if (filtroProduto && !e.produto_nome?.toLowerCase().includes(filtroProduto.toLowerCase()) && !e.produto_codigo?.toLowerCase().includes(filtroProduto.toLowerCase())) return false;
      return true;
    });
  }, [entradas, filtroDoc, filtroProduto]);

  const totalPages = Math.ceil(filteredEntradas.length / pageSize) || 1;
  const paginatedEntradas = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntradas.slice(start, start + pageSize);
  }, [filteredEntradas, currentPage, pageSize]);

  const handleAbrirCriacao = () => {
    setFormFornecedor('Distribuidora Hospitalar MedFarma');
    setFormDocumento(`NF-${Math.floor(10000 + Math.random() * 90000)}`);
    setFormProdutoId(produtos[0]?.id || 0);
    setFormQuantidade(50);
    setFormNumeroLote(`LT-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormDataValidade('2027-12-31');
    setFormValorUnitario(15.0);
    setFormObservacao('Recebimento de compra e conferência física');
    setActiveFormTab('nf');
    setErrorMsg(null);
    setIsFormOpen(true);
    if (setIsCreateModalOpen) setIsCreateModalOpen(true);
  };

  const handleSalvarEntrada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProdutoId || formQuantidade <= 0 || !formDocumento.trim()) {
      const msg = 'Produto, quantidade válida e número de NF são obrigatórios.';
      setErrorMsg(msg);
      toast.error('Campos Obrigatórios', msg);
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/entradas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `user:${currentUser?.id}`,
        },
        body: JSON.stringify({
          produto_id: formProdutoId,
          quantidade: formQuantidade,
          documento_referencia: formDocumento.trim().toUpperCase(),
          fornecedor: formFornecedor ? formFornecedor.trim() : null,
          numero_lote: formNumeroLote ? formNumeroLote.trim() : null,
          data_validade: formDataValidade || null,
          valor_unitario: Number(formValorUnitario) || 0,
          observacao: formObservacao ? formObservacao.trim() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar entrada de estoque.');
      }

      const prodNome = produtos.find((p) => p.id === formProdutoId)?.nome || 'Produto';
      toast.success(
        'Entrada de Estoque Registrada',
        `Documento ${formDocumento.trim().toUpperCase()}: +${formQuantidade} un. de "${prodNome}" adicionadas ao saldo.`
      );

      setIsFormOpen(false);
      if (setIsCreateModalOpen) setIsCreateModalOpen(false);
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Falha ao processar entrada.';
      setErrorMsg(msg);
      toast.error('Erro ao Registrar Entrada', msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-100 text-teal-800 rounded-lg">
            <PackagePlus className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Entrada de Estoque por Nota Fiscal</h1>
            <p className="text-xs text-slate-500">
              Recebimento de mercadorias, conferência de lotes, validades e alimentação de saldo
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
                Recebimento Físico & Fiscal
              </span>
              <h2 className="text-base font-bold text-slate-800 mt-1">Registrar Entrada por Documento / NF</h2>
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
              onClick={() => setActiveFormTab('nf')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'nf'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              1. Documento Fiscal & Fornecedor
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('itens')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'itens'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              2. Insumo, Lote & Valores
            </button>
          </div>

          <form onSubmit={handleSalvarEntrada} className="p-6 space-y-6">
            {activeFormTab === 'nf' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Número do Documento / Nota Fiscal (NF) *
                  </label>
                  <input
                    type="text"
                    value={formDocumento}
                    onChange={(e) => setFormDocumento(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="ex: NF-48290"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Fornecedor / Razão Social
                  </label>
                  <input
                    type="text"
                    value={formFornecedor}
                    onChange={(e) => setFormFornecedor(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="Nome da distribuidora ou laboratório"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Observações de Recebimento
                  </label>
                  <textarea
                    rows={2}
                    value={formObservacao}
                    onChange={(e) => setFormObservacao(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="Condições de entrega, transporte térmico, laudo analítico..."
                  />
                </div>
              </div>
            )}

            {activeFormTab === 'itens' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Produto / Insumo *
                  </label>
                  <select
                    value={formProdutoId}
                    onChange={(e) => setFormProdutoId(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                    required
                  >
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.codigo} - {p.nome} ({p.unidade_medida}) | Saldo Atual: {p.quantidade_atual}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Quantidade Entrando *
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
                    Número do Lote
                  </label>
                  <input
                    type="text"
                    value={formNumeroLote}
                    onChange={(e) => setFormNumeroLote(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="ex: LT-9982"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Data de Validade
                  </label>
                  <input
                    type="date"
                    value={formDataValidade}
                    onChange={(e) => setFormDataValidade(e.target.value)}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Valor Unitário na NF (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formValorUnitario}
                    onChange={(e) => setFormValorUnitario(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
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
                <span>{isProcessing ? 'PROCESSANDO...' : 'CONFIRMAR ENTRADA NO ESTOQUE'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Nota Fiscal / Documento
            </label>
            <input
              type="text"
              value={filtroDoc}
              onChange={(e) => { setFiltroDoc(e.target.value); setCurrentPage(1); }}
              placeholder="ex: NF-48290"
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Produto / Descrição
            </label>
            <input
              type="text"
              value={filtroProduto}
              onChange={(e) => { setFiltroProduto(e.target.value); setCurrentPage(1); }}
              placeholder="Pesquisar por produto recebido..."
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>
        </div>

        {/* Botões */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isGeneratingPdf || filteredEntradas.length === 0}
              onClick={async () => {
                setIsGeneratingPdf(true);
                try {
                  const doc = await generateRelatorioMovimentacoesTelaPDF({
                    movimentacoes: filteredEntradas,
                    titulo: 'Relatório de Entradas de Estoque por Nota Fiscal',
                    subtitulo: 'Extrato de recebimentos físicos e fiscais filtrados na tela',
                    filtroDescricao:
                      filtroDoc || filtroProduto
                        ? `NF: "${filtroDoc || 'Todas'}" | Produto: "${filtroProduto || 'Todos'}"`
                        : 'Todas as Entradas Registradas',
                    currentUser,
                    activeUnidade,
                    mode: 'print',
                  });
                  setPdfPreviewDoc(doc);
                } finally {
                  setIsGeneratingPdf(false);
                }
              }}
              className="bg-[#00237D] hover:bg-[#001a5e] text-white font-medium px-3.5 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>IMPRIMIR DADOS DA TELA (PDF)</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingPdf || filteredEntradas.length === 0}
              onClick={async () => {
                setIsGeneratingPdf(true);
                try {
                  await generateRelatorioMovimentacoesTelaPDF({
                    movimentacoes: filteredEntradas,
                    titulo: 'Relatório de Entradas de Estoque por Nota Fiscal',
                    subtitulo: 'Extrato de recebimentos físicos e fiscais filtrados na tela',
                    filtroDescricao:
                      filtroDoc || filtroProduto
                        ? `NF: "${filtroDoc || 'Todas'}" | Produto: "${filtroProduto || 'Todos'}"`
                        : 'Todas as Entradas Registradas',
                    currentUser,
                    activeUnidade,
                    mode: 'download',
                  });
                } finally {
                  setIsGeneratingPdf(false);
                }
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-3.5 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>BAIXAR RELATÓRIO PDF</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {canManage && (
              <button
                type="button"
                onClick={handleAbrirCriacao}
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ NOVA ENTRADA</span>
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
      </div>

      {/* Grid de Entradas Zebrada */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Documento / NF</th>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Produto Recebido</th>
                <th className="py-2.5 px-3 text-center">UN</th>
                <th className="py-2.5 px-3 text-right">Qtd Adicionada</th>
                <th className="py-2.5 px-3">Responsável (Almoxarife)</th>
                <th className="py-2.5 px-3">Observações / Fornecedor</th>
                <th className="py-2.5 px-3 text-right">Comprovante PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedEntradas.length > 0 ? (
                paginatedEntradas.map((ent) => (
                  <tr key={ent.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/40 transition-colors">
                    <td className="py-2 px-3 text-slate-600">
                      {new Date(ent.data_movimentacao).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{ent.documento_referencia}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{ent.produto_codigo}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{ent.produto_nome}</td>
                    <td className="py-2 px-3 text-center font-bold text-slate-600">{ent.unidade_medida}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                      +{ent.quantidade}
                    </td>
                    <td className="py-2 px-3 text-slate-600">{ent.usuario_nome}</td>
                    <td className="py-2 px-3 text-slate-500 max-w-xs truncate">{ent.observacao}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            const doc = await generateComprovanteMovimentacaoPDF({
                              mov: ent,
                              currentUser,
                              activeUnidade,
                              mode: 'print',
                            });
                            setPdfPreviewDoc(doc);
                          }}
                          className="px-2 py-1 text-[11px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded border border-teal-200 inline-flex items-center gap-1 cursor-pointer"
                          title="Gerar e imprimir comprovante de entrada desta NF em PDF"
                        >
                          <Printer className="w-3 h-3 text-teal-700" />
                          <span>Comprovante</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            generateComprovanteMovimentacaoPDF({
                              mov: ent,
                              currentUser,
                              activeUnidade,
                              mode: 'download',
                            })
                          }
                          className="p-1 text-slate-600 hover:text-[#00237D] bg-slate-100 hover:bg-blue-50 rounded border border-slate-200 cursor-pointer"
                          title="Baixar comprovante de entrada em PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Nenhum recebimento por nota fiscal localizado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Consulta */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            <strong>{filteredEntradas.length}</strong> registro(s) encontrado(s)
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

      <PdfPrintModal
        pdfDoc={pdfPreviewDoc}
        onClose={() => setPdfPreviewDoc(null)}
      />
    </div>
  );
};
