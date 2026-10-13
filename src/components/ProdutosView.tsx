import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Eye,
  Save,
  ArrowLeft,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Tag,
  Boxes,
  MapPin,
  TrendingDown,
  DollarSign,
  Trash2,
  Truck,
  PackagePlus
} from 'lucide-react';
import type { Produto, Fornecedor, ProdutoFornecedor, Usuario, UnidadeMedida, TipoProduto } from '../types/index.ts';
import { useToast } from '../context/ToastContext.tsx';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';
import { HelpFloatingModal } from './HelpFloatingModal.tsx';

interface ProdutosViewProps {
  produtos: Produto[];
  fornecedores?: Fornecedor[];
  currentUser: Usuario | null;
  onRefresh: () => void;
  onVoltar?: () => void;
  onNavigate?: (tab: string) => void;
}

export const ProdutosView: React.FC<ProdutosViewProps> = ({
  produtos,
  fornecedores = [],
  currentUser,
  onRefresh,
  onVoltar,
  onNavigate,
}) => {
  // Filtros de busca
  const [filtroCodigo, setFiltroCodigo] = useState('');
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'consumivel' | 'nao_consumivel'>('todos');
  const [filtroStatusEstoque, setFiltroStatusEstoque] = useState<'todos' | 'critico' | 'normal'>('todos');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | '1' | '0'>('todos');

  // Controle de Formulário em Abas
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [activeFormTab, setActiveFormTab] = useState<'dados_principais' | 'controle_estoque' | 'lotes_validade' | 'fornecedores_marcas' | 'historico'>('dados_principais');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Campos de vínculo de Fornecedor/Marca no mesmo código de produto
  const [vincFornecedorId, setVincFornecedorId] = useState<number>(0);
  const [vincMarca, setVincMarca] = useState('');
  const [vincNomenclatura, setVincNomenclatura] = useState('');
  const [vincCodigoRef, setVincCodigoRef] = useState('');
  const [isLinkingForn, setIsLinkingForn] = useState(false);

  // Campos do Formulário
  const [formCodigo, setFormCodigo] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formUnidadeMedida, setFormUnidadeMedida] = useState<UnidadeMedida>('UN');
  const [formTipo, setFormTipo] = useState<TipoProduto>('consumivel');
  const [formControlaValidade, setFormControlaValidade] = useState<number>(1);
  const [formEstoqueMinimo, setFormEstoqueMinimo] = useState<number>(10);
  const [formEstoqueMaximo, setFormEstoqueMaximo] = useState<number>(100);
  const [formQuantidadeAtual, setFormQuantidadeAtual] = useState<number>(0);
  const [formValorUnitario, setFormValorUnitario] = useState<number>(0);
  const [formLocalizacao, setFormLocalizacao] = useState<string>('PRAT-01');
  const [formAtivo, setFormAtivo] = useState<number>(1);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingProduto, setDeletingProduto] = useState<Produto | null>(null);

  const { toast } = useToast();
  const canEdit = currentUser && (currentUser.perfil === 'admin' || currentUser.perfil === 'almoxarife');

  // Filtragem dos produtos
  const filteredProdutos = useMemo(() => {
    return produtos.filter((p) => {
      if (filtroCodigo && !p.codigo.toLowerCase().includes(filtroCodigo.toLowerCase())) return false;
      if (filtroNome && !p.nome.toLowerCase().includes(filtroNome.toLowerCase())) return false;
      if (filtroTipo !== 'todos' && p.tipo !== filtroTipo) return false;
      if (filtroStatusEstoque === 'critico' && p.quantidade_atual > p.estoque_minimo) return false;
      if (filtroStatusEstoque === 'normal' && p.quantidade_atual <= p.estoque_minimo) return false;
      if (filtroAtivo !== 'todos') {
        const val = filtroAtivo === '1' ? 1 : 0;
        if (p.ativo !== val) return false;
      }
      return true;
    });
  }, [produtos, filtroCodigo, filtroNome, filtroTipo, filtroStatusEstoque, filtroAtivo]);

  const totalPages = Math.ceil(filteredProdutos.length / pageSize) || 1;
  const paginatedProdutos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProdutos.slice(start, start + pageSize);
  }, [filteredProdutos, currentPage, pageSize]);

  const handleNovo = () => {
    setFormMode('create');
    setEditingId(null);
    setFormCodigo(`MAT-00${produtos.length + 1}`);
    setFormNome('');
    setFormDescricao('');
    setFormUnidadeMedida('UN');
    setFormTipo('consumivel');
    setFormControlaValidade(1);
    setFormEstoqueMinimo(20);
    setFormEstoqueMaximo(200);
    setFormQuantidadeAtual(0);
    setFormValorUnitario(0);
    setFormLocalizacao('PRAT-A1');
    setFormAtivo(1);
    setActiveFormTab('dados_principais');
    setErrorMsg(null);
    setIsFormOpen(true);
  };

  const handleEditar = (p: Produto) => {
    setFormMode('edit');
    setEditingId(p.id);
    setFormCodigo(p.codigo);
    setFormNome(p.nome);
    setFormDescricao(p.descricao || '');
    setFormUnidadeMedida(p.unidade_medida);
    setFormTipo(p.tipo);
    setFormControlaValidade(p.controla_validade === undefined ? (p.tipo === 'consumivel' ? 1 : 0) : p.controla_validade);
    setFormEstoqueMinimo(p.estoque_minimo);
    setFormEstoqueMaximo(p.estoque_maximo);
    setFormQuantidadeAtual(p.quantidade_atual);
    setFormValorUnitario(p.valor_unitario || 0);
    setFormLocalizacao(p.localizacao || 'Almox. Central');
    setFormAtivo(p.ativo);
    setActiveFormTab('dados_principais');
    setErrorMsg(null);
    setIsFormOpen(true);
  };

  const handleVisualizar = (p: Produto) => {
    handleEditar(p);
    setFormMode('view');
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === 'view') {
      setIsFormOpen(false);
      return;
    }

    if (!formCodigo || !formNome || !formUnidadeMedida || !formTipo) {
      const msg = 'Código Único Interno, Descrição Padrão, Unidade de Medida e Tipo são obrigatórios.';
      setErrorMsg(msg);
      toast.error('Campos Obrigatórios', msg);
      setActiveFormTab('dados_principais');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const payload = {
        codigo: formCodigo.trim().toUpperCase(),
        nome: formNome.trim(),
        descricao: formDescricao ? formDescricao.trim() : null,
        unidade_medida: formUnidadeMedida,
        tipo: formTipo,
        controla_validade: Number(formControlaValidade),
        estoque_minimo: Number(formEstoqueMinimo) || 0,
        estoque_maximo: Number(formEstoqueMaximo) || 0,
        valor_unitario: Number(formValorUnitario) || 0,
        localizacao: formLocalizacao ? formLocalizacao.trim().toUpperCase() : null,
        ativo: formAtivo,
      };

      const url = formMode === 'create' ? '/api/produtos' : `/api/produtos/${editingId}`;
      const method = formMode === 'create' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `user:${currentUser?.id}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar produto.');
      }

      if (formMode === 'create') {
        toast.success(
          'Produto Cadastrado com Sucesso',
          `O item "${payload.codigo} - ${payload.nome}" foi adicionado ao catálogo.`
        );
      } else {
        toast.success(
          'Produto Atualizado com Sucesso',
          `As alterações no item "${payload.codigo} - ${payload.nome}" foram salvas.`
        );
      }

      setIsFormOpen(false);
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Erro ao processar catálogo.';
      setErrorMsg(msg);
      toast.error(
        formMode === 'create' ? 'Erro ao Cadastrar Produto' : 'Erro ao Editar Produto',
        msg
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduto) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/produtos/${deletingProduto.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `user:${currentUser?.id}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir produto.');
      }

      toast.success(
        'Produto Excluído',
        data.message || `O item "${deletingProduto.codigo} - ${deletingProduto.nome}" foi removido do catálogo.`
      );
      if (editingId === deletingProduto.id) {
        setIsFormOpen(false);
      }
      setDeletingProduto(null);
      onRefresh();
    } catch (err: any) {
      toast.error('Erro ao Excluir Produto', err.message || 'Não foi possível excluir o produto.');
    } finally {
      setIsProcessing(false);
    }
  };

  const editingProdutoObj = useMemo(
    () => (editingId ? produtos.find((item) => item.id === editingId) || null : null),
    [produtos, editingId]
  );

  const handleVincularFornecedor = async () => {
    if (!editingId || !vincFornecedorId) {
      toast.error('Fornecedor Obrigatório', 'Selecione um fornecedor cadastrado para vincular a este código de produto.');
      return;
    }
    setIsLinkingForn(true);
    try {
      const res = await fetch(`/api/produtos/${editingId}/fornecedores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `user:${currentUser?.id}`,
        },
        body: JSON.stringify({
          fornecedor_id: vincFornecedorId,
          marca: vincMarca.trim() || null,
          nomenclatura_fornecedor: vincNomenclatura.trim() || null,
          codigo_referencia_fornecedor: vincCodigoRef.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao vincular fornecedor.');
      }
      toast.success('Fornecedor / Marca Vinculado', data.message || 'Fornecedor vinculado ao mesmo código de produto.');
      setVincFornecedorId(0);
      setVincMarca('');
      setVincNomenclatura('');
      setVincCodigoRef('');
      onRefresh();
    } catch (err: any) {
      toast.error('Erro ao Vincular', err.message || 'Não foi possível vincular o fornecedor.');
    } finally {
      setIsLinkingForn(false);
    }
  };

  const handleRemoverVinculoFornecedor = async (vinculoId: number) => {
    if (!editingId) return;
    setIsLinkingForn(true);
    try {
      const res = await fetch(`/api/produtos/${editingId}/fornecedores/${vinculoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `user:${currentUser?.id}` },
      });
      if (res.ok) {
        toast.info('Vínculo Removido', 'O vínculo de fornecedor/marca foi removido deste produto.');
        onRefresh();
      }
    } finally {
      setIsLinkingForn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho Compacto */}
      <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 text-teal-800 rounded-lg">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              Catálogo de Produtos (Código Interno Unificado)
            </h1>
            <p className="text-xs text-slate-500">
              Gestão do catálogo padronizado, controle de lotes/validade e vínculo multifornecedor
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <HelpFloatingModal
            title="Ajuda & Regras — Catálogo de Produtos (Código Único)"
            subtitle="Passo 2 do Cadastro • Regras de Unificação Multifornecedor e Validade de Lotes"
            currentStep={2}
            onNavigate={onNavigate}
            sections={[
              {
                title: 'Regra de Código Único de Produto (Multifornecedor)',
                badge: 'Código Unificado',
                tone: 'blue',
                description:
                  'Independentemente de fornecedores diferentes venderem com marcas ou nomenclaturas distintas (ex: "Papel A4 Chamex" vs "Papel A4 Report"), vincule todas as entradas ao mesmo Código de Produto Interno (ex: PROD-0045 - Papel A4 75g). O nome/marca comercial da NF é salvo apenas no histórico da entrada, mantendo o saldo unificado.',
              },
              {
                title: 'Controle de Lote e Alertas de Validade (90 / 60 / 30 dias)',
                badge: 'Monitoramento FEFO',
                tone: 'amber',
                description:
                  'O sistema monitora automaticamente o vencimento dos lotes em estoque: Atenção em 90 dias (Amarelo), Alerta em 60 dias (Laranja) e Crítico em 30 dias (Vermelho).',
              },
              {
                title: 'Bloqueio Automático por Vencimento',
                badge: 'Segurança Assistencial',
                tone: 'rose',
                description:
                  'Lotes cuja data de validade já expirou são bloqueados sumariamente para requisições de consumo ou transferências. A única movimentação permitida para lotes vencidos é a "Saída por Vencimento/Descarte".',
              },
            ]}
          />

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
      </div>

      {/* Formulário em Abas */}
      {isFormOpen && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden animate-fadeIn">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                {formMode === 'create' ? 'Novo Produto' : formMode === 'edit' ? 'Alteração de Cadastro' : 'Visualização'}
              </span>
              <h2 className="text-base font-bold text-slate-800 mt-1">
                {formMode === 'create' ? 'Cadastrar Novo Item no Catálogo' : `Material: ${formNome} (${formCodigo})`}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
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
          <div className="flex flex-wrap border-b border-slate-200 px-6 pt-2 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setActiveFormTab('dados_principais')}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'dados_principais'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              1. Código Único & Dados Padrão
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('controle_estoque')}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'controle_estoque'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              2. Estoque Mínimo / Máximo
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('lotes_validade')}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFormTab === 'lotes_validade'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>3. Lotes & Validade</span>
              {editingProdutoObj?.lotes && (
                <span className="bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded-full text-[10px]">
                  {editingProdutoObj.lotes.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('fornecedores_marcas')}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFormTab === 'fornecedores_marcas'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>4. Fornecedores & Marcas (Mesmo Código)</span>
              {editingProdutoObj?.fornecedores_vinculados && (
                <span className="bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded-full text-[10px]">
                  {editingProdutoObj.fornecedores_vinculados.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('historico')}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'historico'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              5. Rastreabilidade
            </button>
          </div>

          <form onSubmit={handleSalvar} className="p-6 space-y-6">
            {/* ABA 1: DADOS PRINCIPAIS */}
            {activeFormTab === 'dados_principais' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Código Único Interno *
                  </label>
                  <input
                    type="text"
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="ex: MAT-001 ou PROD-0045"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Descrição Padrão no Catálogo *
                  </label>
                  <input
                    type="text"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="ex: Papel A4 75g / Seringa Descartável 10ml"
                    required
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Especificação Técnica Detalhada
                  </label>
                  <textarea
                    value={formDescricao}
                    onChange={(e) => setFormDescricao(e.target.value)}
                    disabled={formMode === 'view'}
                    rows={2}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="Especificações clínicas, fabricante padrão, registro ANVISA..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Unidade de Medida *
                  </label>
                  <select
                    value={formUnidadeMedida}
                    onChange={(e) => setFormUnidadeMedida(e.target.value as UnidadeMedida)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  >
                    <option value="UN">UN - Unidade</option>
                    <option value="CX">CX - Caixa</option>
                    <option value="PCT">PCT - Pacote</option>
                    <option value="L">L - Litro</option>
                    <option value="KG">KG - Quilograma</option>
                    <option value="FR">FR - Frasco</option>
                    <option value="AMP">AMP - Ampola</option>
                    <option value="ROLO">ROLO - Rolo</option>
                    <option value="KIT">KIT - Kit Cirúrgico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Classificação / Tipo *
                  </label>
                  <select
                    value={formTipo}
                    onChange={(e) => {
                      const novoTipo = e.target.value as TipoProduto;
                      setFormTipo(novoTipo);
                      setFormControlaValidade(novoTipo === 'consumivel' ? 1 : 0);
                    }}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  >
                    <option value="consumivel">Consumível (Baixa definitiva por Requisição)</option>
                    <option value="nao_consumivel">Não Consumível (Aparelho / Equipamento p/ Empréstimo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Controle de Lote e Validade *
                  </label>
                  <select
                    value={formControlaValidade}
                    onChange={(e) => setFormControlaValidade(Number(e.target.value))}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  >
                    <option value={1}>Sim - Obrigatório Lote e Validade na Entrada</option>
                    <option value={0}>Opcional - Item não perecível</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Localização no Almoxarifado
                  </label>
                  <input
                    type="text"
                    value={formLocalizacao}
                    onChange={(e) => setFormLocalizacao(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="ex: Prateleira B-04"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Situação do Produto
                  </label>
                  <select
                    value={formAtivo}
                    onChange={(e) => setFormAtivo(Number(e.target.value))}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  >
                    <option value={1}>Ativo no Catálogo</option>
                    <option value={0}>Inativo</option>
                  </select>
                </div>
              </div>
            )}

            {/* ABA 2: CONTROLE DE ESTOQUE */}
            {activeFormTab === 'controle_estoque' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Estoque Mínimo (Ponto de Reposição) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formEstoqueMinimo}
                    onChange={(e) => setFormEstoqueMinimo(Number(e.target.value))}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Dispara alerta no painel se o saldo for menor ou igual.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Estoque Máximo (Capacidade Física)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formEstoqueMaximo}
                    onChange={(e) => setFormEstoqueMaximo(Number(e.target.value))}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Valor Unitário Médio (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formValorUnitario}
                    onChange={(e) => setFormValorUnitario(Number(e.target.value))}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
                  />
                </div>

                <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-lg md:col-span-3 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wider">Saldo Físico Atual no Almoxarifado</span>
                    <p className="text-xs text-teal-700">Calculado rigorosamente por entradas fiscais e saídas/baixas atendidas.</p>
                  </div>
                  <div className="text-2xl font-black text-teal-900 font-mono">
                    {formQuantidadeAtual} {formUnidadeMedida}
                  </div>
                </div>
              </div>
            )}

            {/* ABA 3: LOTES EM ESTOQUE & CONTROLE DE VALIDADE (90 / 60 / 30 DIAS E BLOQUEIO) */}
            {activeFormTab === 'lotes_validade' && (
              <div className="space-y-3">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Nº Lote</th>
                        <th className="py-2 px-3 text-center">Validade</th>
                        <th className="py-2 px-3 text-center">Status / Alerta</th>
                        <th className="py-2 px-3">Fornecedor / Marca NF</th>
                        <th className="py-2 px-3 text-right">Saldo do Lote</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {(editingProdutoObj?.lotes || []).length > 0 ? (
                        (editingProdutoObj?.lotes || []).map((lt) => {
                          const st = lt.status_validade;
                          return (
                            <tr key={lt.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-slate-800">{lt.numero_lote}</td>
                              <td className="py-2 px-3 text-center font-mono text-slate-700">
                                {lt.data_validade ? lt.data_validade.split('-').reverse().join('/') : 'Indeterminada'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {st === 'vencido' ? (
                                  <span className="px-2 py-0.5 rounded bg-red-900 text-white font-bold text-[10px] uppercase">
                                    BLOQUEADO • VENCIDO ({Math.abs(lt.dias_para_vencer || 0)}d)
                                  </span>
                                ) : st === 'critico_30d' ? (
                                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[10px] uppercase">
                                    CRÍTICO ≤ 30d ({lt.dias_para_vencer}d)
                                  </span>
                                ) : st === 'alerta_60d' ? (
                                  <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-300 font-bold text-[10px] uppercase">
                                    ALERTA ≤ 60d ({lt.dias_para_vencer}d)
                                  </span>
                                ) : st === 'atencao_90d' ? (
                                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px] uppercase">
                                    ATENÇÃO ≤ 90d ({lt.dias_para_vencer}d)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] uppercase">
                                    REGULAR {lt.dias_para_vencer != null ? `(${lt.dias_para_vencer}d)` : ''}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-600">
                                {lt.fornecedor_nome || 'Estoque Inicial'}
                                {lt.marca ? ` • Marca: ${lt.marca}` : ''}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                {lt.quantidade_atual} {formUnidadeMedida}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">
                            Nenhum lote ativo registrado para este item. Os lotes são gerados nas Entradas por Nota Fiscal ou Entradas Diversas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 3: FORNECEDORES & MARCAS EQUIVALENTES (MESMO CÓDIGO NO ESTOQUE) */}
            {activeFormTab === 'fornecedores_marcas' && (
              <div className="space-y-3">
                {formMode === 'create' ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                    Salve o cadastro inicial deste produto primeiro para habilitar o vínculo direto de fornecedores e marcas,
                    ou vincule automaticamente no momento da <strong>Entrada de Estoque por Nota Fiscal</strong>.
                  </div>
                ) : (
                  <>
                    {formMode === 'edit' && canEdit && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                        <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                          Vincular Fornecedor / Marca Homologada ao Código {formCodigo}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                          <div className="md:col-span-4">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Fornecedor Cadastrado *
                            </label>
                            <select
                              value={vincFornecedorId}
                              onChange={(e) => setVincFornecedorId(Number(e.target.value))}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:border-teal-500 cursor-pointer"
                            >
                              <option value={0}>Selecione o fornecedor...</option>
                              {fornecedores
                                .filter((f) => f.ativo === 1)
                                .map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.codigo} - {f.nome_fantasia || f.razao_social}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Marca Comercial
                            </label>
                            <input
                              type="text"
                              value={vincMarca}
                              onChange={(e) => setVincMarca(e.target.value)}
                              placeholder="ex: BD / Descarpack"
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:border-teal-500"
                            />
                          </div>

                          <div className="md:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                              Nomenclatura na NF do Fornecedor
                            </label>
                            <input
                              type="text"
                              value={vincNomenclatura}
                              onChange={(e) => setVincNomenclatura(e.target.value)}
                              placeholder="Descrição usada na NF..."
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:border-teal-500"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <button
                              type="button"
                              disabled={isLinkingForn || !vincFornecedorId}
                              onClick={handleVincularFornecedor}
                              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-3 rounded text-xs flex items-center justify-center gap-1 uppercase tracking-wide transition-all shadow cursor-pointer disabled:opacity-50"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>VINCULAR</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Fornecedor</th>
                            <th className="py-2 px-3">Marca</th>
                            <th className="py-2 px-3">Nomenclatura na NF</th>
                            <th className="py-2 px-3 text-right">Último Valor (R$)</th>
                            {formMode === 'edit' && canEdit && <th className="py-2 px-3 text-right">Ação</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {(editingProdutoObj?.fornecedores_vinculados || []).length > 0 ? (
                            (editingProdutoObj?.fornecedores_vinculados || []).map((vf: ProdutoFornecedor) => (
                              <tr key={vf.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-medium text-slate-800">
                                  <span className="font-mono font-bold text-teal-800">{vf.fornecedor_codigo}</span> —{' '}
                                  {vf.fornecedor_nome_fantasia || vf.fornecedor_razao_social}
                                </td>
                                <td className="py-2 px-3 text-slate-700 font-semibold">{vf.marca || 'Padrão'}</td>
                                <td className="py-2 px-3 text-slate-600">{vf.nomenclatura_fornecedor || formNome}</td>
                                <td className="py-2 px-3 text-right font-mono text-slate-700">
                                  {vf.ultimo_valor_unitario
                                    ? `R$ ${Number(vf.ultimo_valor_unitario).toFixed(2)}`
                                    : '—'}
                                </td>
                                {formMode === 'edit' && canEdit && (
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoverVinculoFornecedor(vf.id)}
                                      className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                                      title="Remover vínculo"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="py-6 text-center text-slate-400">
                                Nenhum fornecedor/marca vinculado ainda. Os vínculos também são criados automaticamente ao lançar uma Nota Fiscal.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ABA 4: HISTÓRICO */}
            {activeFormTab === 'historico' && (
              <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-2 max-w-xl">
                <div className="text-xs font-bold text-slate-700">Rastreabilidade no Livro Razão</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Para auditar todas as entradas por nota fiscal, saídas dispensadas para Centros de Custo e eventuais estornos
                  deste produto, utilize o módulo <strong>&ldquo;Livro Razão / Movimentações&rdquo;</strong> ou emita o relatório de posição física.
                </p>
              </div>
            )}

            {/* Rodapé: SALVAR e VOLTAR */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <div>
                {formMode === 'edit' && canEdit && editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = produtos.find((item) => item.id === editingId);
                      if (target) setDeletingProduto(target);
                    }}
                    disabled={isProcessing}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all uppercase tracking-wide cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>EXCLUIR ITEM</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>VOLTAR</span>
                </button>

                {formMode !== 'view' && (
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium px-5 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isProcessing ? 'SALVANDO...' : 'SALVAR'}</span>
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Linha de Filtros */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Código
            </label>
            <input
              type="text"
              value={filtroCodigo}
              onChange={(e) => { setFiltroCodigo(e.target.value); setCurrentPage(1); }}
              placeholder="ex: MAT-001"
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Descrição / Nome
            </label>
            <input
              type="text"
              value={filtroNome}
              onChange={(e) => { setFiltroNome(e.target.value); setCurrentPage(1); }}
              placeholder="Pesquisar por material..."
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Tipo de Item
            </label>
            <select
              value={filtroTipo}
              onChange={(e) => { setFiltroTipo(e.target.value as any); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
            >
              <option value="todos">TODOS OS TIPOS</option>
              <option value="consumivel">Consumível (Insumos / Fármacos)</option>
              <option value="nao_consumivel">Não Consumível (Equipamentos)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Status Estoque
            </label>
            <select
              value={filtroStatusEstoque}
              onChange={(e) => { setFiltroStatusEstoque(e.target.value as any); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
            >
              <option value="todos">TODOS</option>
              <option value="critico">CRÍTICO (Abaixo ou igual ao Mínimo)</option>
              <option value="normal">NORMAL (Saldo Adequado)</option>
            </select>
          </div>
        </div>

        {/* Botões: + NOVO e PESQUISAR */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
          {canEdit && (
            <button
              type="button"
              onClick={handleNovo}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ NOVO</span>
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

      {/* Grid de Resultados Zebrada */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Descrição / Material</th>
                <th className="py-2.5 px-3 text-center">UN</th>
                <th className="py-2.5 px-3 text-center">Tipo</th>
                <th className="py-2.5 px-3 text-right">Qtd Atual</th>
                <th className="py-2.5 px-3 text-right">Mínimo</th>
                <th className="py-2.5 px-3 text-right">Máximo</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedProdutos.length > 0 ? (
                paginatedProdutos.map((p) => {
                  const isCritico = p.quantidade_atual <= p.estoque_minimo;
                  return (
                    <tr key={p.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/40 transition-colors">
                      <td className="py-2 px-3 font-mono font-semibold text-slate-700">{p.codigo}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">
                        <div>{p.nome}</div>
                        {p.fornecedores_vinculados && p.fornecedores_vinculados.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            <span className="text-[10px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded">
                              {p.fornecedores_vinculados.length} forn./marca(s) neste código
                            </span>
                            {p.fornecedores_vinculados.slice(0, 2).map((vf) => (
                              <span
                                key={vf.id}
                                className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded"
                                title={`Fornecedor: ${vf.fornecedor_razao_social} | Marca: ${vf.marca || 'Padrão'} | Nomenclatura NF: ${vf.nomenclatura_fornecedor || p.nome}`}
                              >
                                {vf.fornecedor_nome_fantasia || vf.fornecedor_razao_social}
                                {vf.marca ? ` (${vf.marca})` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                        {p.lotes && p.lotes.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {p.lotes.some((l) => l.status_validade === 'vencido') && (
                              <span className="text-[9px] font-bold uppercase bg-red-900 text-white px-1.5 py-0.5 rounded">
                                Lote Vencido (Bloqueado)
                              </span>
                            )}
                            {p.lotes.some((l) => l.status_validade === 'critico_30d') && (
                              <span className="text-[9px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-300 px-1.5 py-0.5 rounded">
                                Vence ≤ 30 dias (Crítico)
                              </span>
                            )}
                            {p.lotes.some((l) => l.status_validade === 'alerta_60d') && (
                              <span className="text-[9px] font-bold uppercase bg-orange-100 text-orange-800 border border-orange-300 px-1.5 py-0.5 rounded">
                                Vence ≤ 60 dias (Alerta)
                              </span>
                            )}
                            {p.lotes.some((l) => l.status_validade === 'atencao_90d') && (
                              <span className="text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded">
                                Vence ≤ 90 dias (Atenção)
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-600">{p.unidade_medida}</td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            p.tipo === 'consumivel'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {p.tipo === 'consumivel' ? 'Consumível' : 'Equipamento'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                        {p.quantidade_atual}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">{p.estoque_minimo}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">{p.estoque_maximo}</td>
                      <td className="py-2 px-3 text-center">
                        {isCritico ? (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded text-[10px] border border-rose-200 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            <span>CRÍTICO</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>NORMAL</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleVisualizar(p)}
                            className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEditar(p)}
                                className="p-1.5 rounded hover:bg-teal-100 text-teal-700 transition-colors cursor-pointer"
                                title="Editar produto"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingProduto(p)}
                                className="p-1.5 rounded hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                                title="Excluir produto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Nenhum produto localizado para os filtros informados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da Consulta */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            <strong>{filteredProdutos.length}</strong> registro(s) encontrado(s)
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

      <ConfirmDeleteModal
        isOpen={!!deletingProduto}
        title="Excluir Produto do Catálogo"
        entityCode={deletingProduto?.codigo}
        entityName={deletingProduto?.nome || ''}
        description="Esta ação removerá o produto do catálogo e os registros de movimentação vinculados, desde que não existam empréstimos ativos pendentes."
        isProcessing={isProcessing}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingProduto(null)}
      />
    </div>
  );
};
