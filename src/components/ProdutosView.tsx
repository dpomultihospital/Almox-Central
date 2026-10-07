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
  DollarSign
} from 'lucide-react';
import type { Produto, Usuario, UnidadeMedida, TipoProduto } from '../types/index.ts';

interface ProdutosViewProps {
  produtos: Produto[];
  currentUser: Usuario | null;
  onRefresh: () => void;
  onVoltar?: () => void;
}

export const ProdutosView: React.FC<ProdutosViewProps> = ({
  produtos,
  currentUser,
  onRefresh,
  onVoltar,
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
  const [activeFormTab, setActiveFormTab] = useState<'dados_principais' | 'controle_estoque' | 'historico'>('dados_principais');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Campos do Formulário
  const [formCodigo, setFormCodigo] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formUnidadeMedida, setFormUnidadeMedida] = useState<UnidadeMedida>('UN');
  const [formTipo, setFormTipo] = useState<TipoProduto>('consumivel');
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
      setErrorMsg('Código, nome, unidade de medida e tipo são obrigatórios.');
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

      setIsFormOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar catálogo.');
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
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Consulta de Produtos / Materiais</h1>
            <p className="text-xs text-slate-500">Catálogo hospitalar, saldos físicos e pontos de ressuprimento</p>
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
          <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setActiveFormTab('dados_principais')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'dados_principais'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              1. Dados Principais
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('controle_estoque')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'controle_estoque'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              2. Controle de Estoque & Valores
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('historico')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'historico'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              3. Histórico de Movimentações
            </button>
          </div>

          <form onSubmit={handleSalvar} className="p-6 space-y-6">
            {/* ABA 1: DADOS PRINCIPAIS */}
            {activeFormTab === 'dados_principais' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Código do Catálogo *
                  </label>
                  <input
                    type="text"
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="ex: MAT-001"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Nome / Descrição Resumida *
                  </label>
                  <input
                    type="text"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="ex: Seringa Descartável 10ml"
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
                    onChange={(e) => setFormTipo(e.target.value as TipoProduto)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  >
                    <option value="consumivel">Consumível (Baixa definitiva por Requisição)</option>
                    <option value="nao_consumivel">Não Consumível (Aparelho / Equipamento p/ Empréstimo)</option>
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

            {/* ABA 3: HISTÓRICO */}
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
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
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
                      <td className="py-2 px-3 font-medium text-slate-800">{p.nome}</td>
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
                            <button
                              type="button"
                              onClick={() => handleEditar(p)}
                              className="p-1.5 rounded hover:bg-teal-100 text-teal-700 transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
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
    </div>
  );
};
