import React, { useState, useMemo, useEffect } from 'react';
import {
  PackageCheck,
  Search,
  RotateCcw,
  Download,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  Building2,
  Layers,
  History,
  X,
  ShieldAlert,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';
import type { Produto, CentroCusto, Movimentacao, Usuario } from '../types/index.ts';
import { formatDateTimeBrasilia, formatDateBrasilia, formatCurrencyBRL } from '../utils/dateUtils.ts';
import { useToast } from '../context/ToastContext.tsx';

interface SaldoEstoqueViewProps {
  produtos: Produto[];
  centrosCusto: CentroCusto[];
  movimentacoes?: Movimentacao[];
  currentUser: Usuario | null;
  onRefresh: () => void;
  onVoltar?: () => void;
}

interface GrupoProduto {
  id: number;
  codigo?: string;
  nome: string;
}

export const SaldoEstoqueView: React.FC<SaldoEstoqueViewProps> = ({
  produtos,
  centrosCusto,
  movimentacoes = [],
  currentUser,
  onRefresh,
  onVoltar,
}) => {
  const { toast } = useToast();

  // Filtros de Pesquisa
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroGrupoId, setFiltroGrupoId] = useState<string>('todos');
  const [filtroCentroCustoId, setFiltroCentroCustoId] = useState<string>('todos');
  const [filtroSituacao, setFiltroSituacao] = useState<string>('todos');

  // Grupos de Produtos carregados do backend
  const [grupos, setGrupos] = useState<GrupoProduto[]>([]);

  // Linhas expandidas (IDs de produtos)
  const [expandedRowIds, setExpandedRowIds] = useState<Set<number>>(new Set());

  // Modal de "Ver Movimentações" (Extrato do Produto)
  const [extratoProduto, setExtratoProduto] = useState<Produto | null>(null);

  // Carrega grupos de produto
  useEffect(() => {
    fetch('/api/grupos-produtos', {
      headers: currentUser?.id ? { Authorization: `user:${currentUser.id}` } : {},
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setGrupos(data))
      .catch((err) => console.error('Erro ao buscar grupos de produtos:', err));
  }, [currentUser?.id]);

  // Função para alternar expansão de lotes
  const toggleRowExpansion = (prodId: number) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(prodId)) {
        next.delete(prodId);
      } else {
        next.add(prodId);
      }
      return next;
    });
  };

  // Cálculo da Situação e Lotes de cada produto
  const produtosComLotes = useMemo(() => {
    return produtos.map((p) => {
      // O saldo total é a soma dos lotes do produto
      const lotes = p.lotes || [];
      const somaLotes = lotes.reduce((acc, l) => acc + (Number(l.quantidade_atual) || 0), 0);
      const saldoTotal = lotes.length > 0 ? somaLotes : Number(p.quantidade_atual) || 0;
      const custoUnitario = Number(p.custo_unitario ?? p.valor_unitario ?? 0);
      const valorTotalEstoque = saldoTotal * custoUnitario;

      // Status de validade dos lotes com saldo > 0
      const lotesComSaldo = lotes.filter((l) => Number(l.quantidade_atual) > 0);
      const temVencido = lotesComSaldo.some((l) => l.status_validade === 'vencido');
      const temCritico30 = lotesComSaldo.some((l) => l.status_validade === 'critico_30d');
      const temAlerta60 = lotesComSaldo.some((l) => l.status_validade === 'alerta_60d');
      const temAtencao90 = lotesComSaldo.some((l) => l.status_validade === 'atencao_90d');

      let situacaoKey = 'ok';
      let situacaoLabel = 'OK / Regular';
      let situacaoBadge = 'bg-emerald-50 text-emerald-800 border-emerald-200';

      if (saldoTotal === 0) {
        situacaoKey = 'zerado';
        situacaoLabel = 'Zerado';
        situacaoBadge = 'bg-slate-100 text-slate-700 border-slate-300';
      } else if (temVencido) {
        situacaoKey = 'vencido';
        situacaoLabel = 'Lote Vencido (Bloqueado)';
        situacaoBadge = 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
      } else if (saldoTotal <= Number(p.estoque_minimo)) {
        situacaoKey = 'abaixo_minimo';
        situacaoLabel = 'Abaixo do Mínimo';
        situacaoBadge = 'bg-amber-100 text-amber-900 border-amber-300 font-semibold';
      } else if (temCritico30) {
        situacaoKey = '30d';
        situacaoLabel = 'A Vencer (30 dias)';
        situacaoBadge = 'bg-orange-100 text-orange-900 border-orange-300';
      } else if (temAlerta60) {
        situacaoKey = '60d';
        situacaoLabel = 'A Vencer (60 dias)';
        situacaoBadge = 'bg-yellow-100 text-yellow-900 border-yellow-300';
      } else if (temAtencao90) {
        situacaoKey = '90d';
        situacaoLabel = 'A Vencer (90 dias)';
        situacaoBadge = 'bg-blue-100 text-blue-900 border-blue-300';
      }

      // Ordenação FEFO (First Expired, First Out)
      const lotesOrdenadosFEFO = [...lotes].sort((a, b) => {
        if (!a.data_validade) return 1;
        if (!b.data_validade) return -1;
        return a.data_validade.localeCompare(b.data_validade);
      });

      return {
        ...p,
        saldoCalculado: saldoTotal,
        custoUnitarioCalculado: custoUnitario,
        valorTotalEstoque,
        temVencido,
        temCritico30,
        temAlerta60,
        temAtencao90,
        situacaoKey,
        situacaoLabel,
        situacaoBadge,
        lotesOrdenadosFEFO,
      };
    });
  }, [produtos]);

  // Aplicação dos Filtros solicitados:
  // - Código do produto e Descrição (busca parcial, sem diferenciar maiúsculas/minúsculas)
  // - Grupo de Produto
  // - Centro de Custo (local do estoque)
  // - Situação: Todos / Com saldo / Zerados / Abaixo do mínimo / Com lote vencido / A vencer (90, 60 e 30 dias)
  const produtosFiltrados = useMemo(() => {
    return produtosComLotes.filter((p) => {
      // 1. Código e Descrição
      if (filtroTexto.trim()) {
        const term = filtroTexto.trim().toLowerCase();
        const codMatch = String(p.codigo).toLowerCase().includes(term);
        const nomeMatch = String(p.nome).toLowerCase().includes(term);
        const descMatch = String(p.descricao || '').toLowerCase().includes(term);
        if (!codMatch && !nomeMatch && !descMatch) return false;
      }

      // 2. Grupo de Produto
      if (filtroGrupoId !== 'todos') {
        const gid = Number(filtroGrupoId);
        if (p.grupo_id !== gid) return false;
      }

      // 3. Centro de Custo (local do estoque)
      if (filtroCentroCustoId !== 'todos') {
        const ccId = Number(filtroCentroCustoId);
        // Verifica se algum lote do produto pertence a este centro de custo ou movimentação
        const temNoCentro = (p.lotes || []).some(
          (l: any) => l.centro_custo_id === ccId || (ccId === 1 && !l.centro_custo_id)
        );
        if (!temNoCentro) return false;
      }

      // 4. Situação
      if (filtroSituacao !== 'todos') {
        switch (filtroSituacao) {
          case 'com_saldo':
            if (p.saldoCalculado <= 0) return false;
            break;
          case 'zerados':
            if (p.saldoCalculado !== 0) return false;
            break;
          case 'abaixo_minimo':
            if (p.saldoCalculado > Number(p.estoque_minimo)) return false;
            break;
          case 'vencido':
            if (!p.temVencido) return false;
            break;
          case '30d':
            if (!p.temCritico30) return false;
            break;
          case '60d':
            if (!p.temCritico30 && !p.temAlerta60) return false;
            break;
          case '90d':
            if (!p.temCritico30 && !p.temAlerta60 && !p.temAtencao90) return false;
            break;
        }
      }

      return true;
    });
  }, [produtosComLotes, filtroTexto, filtroGrupoId, filtroCentroCustoId, filtroSituacao]);

  // Totais do rodapé
  const totalItens = produtosFiltrados.length;
  const totalSaldoGeral = produtosFiltrados.reduce((acc, p) => acc + p.saldoCalculado, 0);
  const totalValorEstoque = produtosFiltrados.reduce((acc, p) => acc + p.valorTotalEstoque, 0);

  const handleLimpar = () => {
    setFiltroTexto('');
    setFiltroGrupoId('todos');
    setFiltroCentroCustoId('todos');
    setFiltroSituacao('todos');
  };

  // Exportar CSV respeitando os filtros
  const handleExportarCSV = () => {
    if (produtosFiltrados.length === 0) {
      toast.error('Exportação Vazia', 'Nenhum registro encontrado para exportar.');
      return;
    }

    const header = [
      'Código',
      'Descrição',
      'Grupo',
      'UND',
      'Saldo Total',
      'Estoque Mínimo',
      'Custo Unitário (R$)',
      'Valor Total em Estoque (R$)',
      'Situação',
      'Lotes Detalhados (Lote; Validade; Saldo; Centro de Custo; Situação)',
    ];

    const rows = produtosFiltrados.map((p) => {
      const lotesStr = (p.lotesOrdenadosFEFO || [])
        .map(
          (l: any) =>
            `[${l.numero_lote} | Val: ${l.data_validade || 'S/ Val'} | Qtd: ${l.quantidade_atual} ${p.unidade_medida} | CC: ${l.centro_custo_nome || 'Almoxarifado Central'} | ${l.status_validade === 'vencido' ? 'VENCIDO BLOQUEADO' : 'OK'}]`
        )
        .join('; ');

      return [
        `"${p.codigo}"`,
        `"${(p.nome || '').replace(/"/g, '""')}"`,
        `"${(p.grupo_nome || 'Geral').replace(/"/g, '""')}"`,
        `"${p.unidade_medida}"`,
        p.saldoCalculado.toFixed(2).replace('.', ','),
        Number(p.estoque_minimo || 0).toFixed(2).replace('.', ','),
        p.custoUnitarioCalculado.toFixed(2).replace('.', ','),
        p.valorTotalEstoque.toFixed(2).replace('.', ','),
        `"${p.situacaoLabel}"`,
        `"${lotesStr.replace(/"/g, '""')}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [header.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `consulta_saldo_estoque_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Arquivo CSV Gerado', `${produtosFiltrados.length} itens exportados com sucesso.`);
  };

  // Movimentações filtradas para o modal de extrato do produto selecionado
  const movimentacoesDoProduto = useMemo(() => {
    if (!extratoProduto) return [];
    return movimentacoes.filter((m) => m.produto_id === extratoProduto.id);
  }, [extratoProduto, movimentacoes]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-100 text-teal-800 rounded-lg">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Estoque &gt; Consulta de Saldo em Estoque
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                FEFO &amp; Lotes Rastreáveis
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight mt-1">
              Consulta de Saldo em Estoque
            </h1>
            <p className="text-xs text-slate-500">
              Conferência unificada de saldo por produto, lotes FEFO, valores de inventário e bloqueio por validade
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportarCSV}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer uppercase tracking-wider"
          >
            <Download className="w-4 h-4" />
            <span>EXPORTAR CSV</span>
          </button>

          {onVoltar && (
            <button
              type="button"
              onClick={onVoltar}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all border border-slate-200 cursor-pointer uppercase tracking-wider"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>VOLTAR</span>
            </button>
          )}
        </div>
      </div>

      {/* Painel de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Código do produto e Descrição */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Código ou Descrição do Produto
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Busca por código ou descrição..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-teal-500"
              />
            </div>
          </div>

          {/* Grupo de Produto */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Grupo de Produto
            </label>
            <select
              value={filtroGrupoId}
              onChange={(e) => setFiltroGrupoId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-teal-500 cursor-pointer"
            >
              <option value="todos">Todos os Grupos</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Centro de Custo (local do estoque) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Centro de Custo (Local do Estoque)
            </label>
            <select
              value={filtroCentroCustoId}
              onChange={(e) => setFiltroCentroCustoId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-teal-500 cursor-pointer"
            >
              <option value="todos">Todos os Centros de Custo</option>
              {centrosCusto.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.codigo} - {cc.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Situação */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Situação do Produto / Lote
            </label>
            <select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-teal-500 cursor-pointer"
            >
              <option value="todos">Todos</option>
              <option value="com_saldo">Com saldo em estoque</option>
              <option value="zerados">Zerados (Sem saldo)</option>
              <option value="abaixo_minimo">Abaixo do estoque mínimo</option>
              <option value="vencido">Com lote VENCIDO (Bloqueado)</option>
              <option value="30d">A vencer em até 30 dias</option>
              <option value="60d">A vencer em até 60 dias</option>
              <option value="90d">A vencer em até 90 dias</option>
            </select>
          </div>
        </div>

        {/* Botões PESQUISAR e LIMPAR */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleLimpar}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer border border-slate-300 flex items-center gap-1.5 uppercase tracking-wider"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>LIMPAR</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow flex items-center gap-1.5 uppercase tracking-wider"
          >
            <Search className="w-3.5 h-3.5" />
            <span>PESQUISAR</span>
          </button>
        </div>
      </div>

      {/* Grade Principal (uma linha por produto, usando o código único interno) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 w-8"></th>
                <th className="py-3 px-3">Código</th>
                <th className="py-3 px-4">Descrição Padronizada</th>
                <th className="py-3 px-3">Grupo</th>
                <th className="py-3 px-2 text-center">UND</th>
                <th className="py-3 px-3 text-right">Saldo Total</th>
                <th className="py-3 px-3 text-right">Est. Mínimo</th>
                <th className="py-3 px-3 text-right">Custo Unitário</th>
                <th className="py-3 px-3 text-right">Valor em Estoque</th>
                <th className="py-3 px-4 text-center">Situação</th>
                <th className="py-3 px-3 text-center">Extrato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {produtosFiltrados.length > 0 ? (
                produtosFiltrados.map((p) => {
                  const isExpanded = expandedRowIds.has(p.id);
                  const lotes = p.lotesOrdenadosFEFO || [];

                  return (
                    <React.Fragment key={p.id}>
                      <tr
                        onClick={() => toggleRowExpansion(p.id)}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer select-none ${
                          isExpanded ? 'bg-teal-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-teal-700" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-teal-900 whitespace-nowrap">
                          {p.codigo}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{p.nome}</div>
                          {p.descricao && (
                            <div className="text-[11px] text-slate-400 line-clamp-1">{p.descricao}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {p.grupo_nome || <span className="text-slate-400 italic">Geral</span>}
                        </td>
                        <td className="py-3 px-2 text-center font-bold text-slate-600">
                          {p.unidade_medida}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {p.saldoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                          {Number(p.estoque_minimo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                          {formatCurrencyBRL(p.custoUnitarioCalculado)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrencyBRL(p.valorTotalEstoque)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] uppercase border ${p.situacaoBadge}`}
                          >
                            {p.temVencido ? (
                              <AlertTriangle className="w-3 h-3 text-rose-700 shrink-0" />
                            ) : p.situacaoKey === 'abaixo_minimo' ? (
                              <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                            ) : p.saldoCalculado > 0 ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                            ) : (
                              <XCircle className="w-3 h-3 text-slate-500 shrink-0" />
                            )}
                            <span>{p.situacaoLabel}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setExtratoProduto(p)}
                            title="Ver extrato e movimentações com data/hora em Brasília"
                            className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 transition-colors cursor-pointer text-[11px] font-semibold flex items-center gap-1 mx-auto"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>Extrato</span>
                          </button>
                        </td>
                      </tr>

                      {/* Linha Expandida com os Lotes Ordenados por FEFO */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-teal-100">
                          <td colSpan={11} className="p-4 pl-12">
                            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-inner space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-teal-700" />
                                  <span>Lotes Vinculados (Ordem de Validade Crescente - FEFO)</span>
                                </h4>
                                <span className="text-[11px] text-slate-500">
                                  {lotes.length} lote(s) registrado(s) • Total: <strong>{p.saldoCalculado} {p.unidade_medida}</strong>
                                </span>
                              </div>

                              {lotes.length > 0 ? (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs text-left border-collapse">
                                    <thead>
                                      <tr className="bg-slate-100/80 text-slate-600 font-semibold text-[10px] uppercase border-b border-slate-200">
                                        <th className="py-2 px-3">Lote</th>
                                        <th className="py-2 px-3">Validade</th>
                                        <th className="py-2 px-3 text-right">Saldo do Lote</th>
                                        <th className="py-2 px-3">Centro de Custo</th>
                                        <th className="py-2 px-3">Situação</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {lotes.map((l: any) => {
                                        const isVencido = l.status_validade === 'vencido';
                                        const isCritico = l.status_validade === 'critico_30d';
                                        const isAlerta = l.status_validade === 'alerta_60d';
                                        const isAtencao = l.status_validade === 'atencao_90d';

                                        return (
                                          <tr
                                            key={l.id}
                                            className={`${
                                              isVencido
                                                ? 'bg-rose-50/80 text-rose-950 font-medium'
                                                : isCritico
                                                ? 'bg-orange-50/40'
                                                : 'hover:bg-slate-50'
                                            }`}
                                          >
                                            <td className="py-2 px-3 font-mono font-bold">
                                              {l.numero_lote}
                                            </td>
                                            <td className="py-2 px-3 font-mono">
                                              {l.data_validade ? (
                                                formatDateBrasilia(l.data_validade)
                                              ) : (
                                                <span className="text-slate-400 italic">Sem Validade</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold">
                                              {Number(l.quantidade_atual || 0).toLocaleString('pt-BR')} {p.unidade_medida}
                                            </td>
                                            <td className="py-2 px-3 text-slate-700">
                                              {l.centro_custo_nome || (
                                                <span className="text-slate-500 italic">Almoxarifado Central</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3">
                                              {isVencido ? (
                                                <div className="flex items-center gap-1.5 text-rose-700 font-bold text-[11px]">
                                                  <ShieldAlert className="w-4 h-4 shrink-0" />
                                                  <span>
                                                    VENCIDO — BLOQUEADO PARA MOVIMENTAÇÃO (Permitida apenas saída por vencimento)
                                                  </span>
                                                </div>
                                              ) : isCritico ? (
                                                <span className="inline-flex items-center gap-1 text-orange-800 font-semibold text-[11px]">
                                                  <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                                                  <span>A vencer em até 30 dias (FEFO Prioritário)</span>
                                                </span>
                                              ) : isAlerta ? (
                                                <span className="inline-flex items-center gap-1 text-yellow-800 text-[11px]">
                                                  <Clock className="w-3.5 h-3.5 text-yellow-600" />
                                                  <span>A vencer em até 60 dias</span>
                                                </span>
                                              ) : isAtencao ? (
                                                <span className="inline-flex items-center gap-1 text-blue-800 text-[11px]">
                                                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                                                  <span>A vencer em até 90 dias</span>
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px]">
                                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                  <span>OK (Regular)</span>
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">
                                  Nenhum lote físico individual registrado para este produto. O saldo reflete lançamentos globais.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    Nenhum produto encontrado com os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé com total de itens e valor total em estoque */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-6">
            <span>
              Total de Itens: <strong>{totalItens}</strong> produto(s)
            </span>
            <span>
              Saldo Físico Geral: <strong>{totalSaldoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} un.</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 uppercase tracking-wider text-[11px]">Valor Total em Estoque:</span>
            <span className="text-sm font-mono font-bold text-teal-800 bg-teal-50 px-3 py-1 rounded border border-teal-200">
              {formatCurrencyBRL(totalValorEstoque)}
            </span>
          </div>
        </div>
      </div>

      {/* Modal de Extrato de Movimentações do Produto */}
      {extratoProduto && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleUp">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-teal-400" />
                <div>
                  <h3 className="text-sm font-bold">
                    Extrato de Movimentações • {extratoProduto.codigo} - {extratoProduto.nome}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Histórico imutável de entradas, saídas e estornos (Horário de Brasília)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setExtratoProduto(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Código do Produto</span>
                <div className="font-mono font-bold text-teal-800 text-sm">{extratoProduto.codigo}</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Saldo Atual em Estoque</span>
                <div className="font-mono font-bold text-slate-800 text-sm">
                  {extratoProduto.quantidade_atual} {extratoProduto.unidade_medida}
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Custo Unitário Oficial</span>
                <div className="font-mono font-bold text-slate-800 text-sm">
                  {formatCurrencyBRL(extratoProduto.custo_unitario ?? extratoProduto.valor_unitario)}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {movimentacoesDoProduto.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Data e Hora (Brasília)</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3 text-right">Qtd</th>
                      <th className="py-2.5 px-3">Lote</th>
                      <th className="py-2.5 px-3">Documento / NF</th>
                      <th className="py-2.5 px-3">Centro de Custo</th>
                      <th className="py-2.5 px-3">Responsável</th>
                      <th className="py-2.5 px-3">Observação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {movimentacoesDoProduto.map((m) => {
                      const isEntrada = m.tipo === 'entrada' || m.tipo === 'estorno_saida';
                      return (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono whitespace-nowrap text-slate-700">
                            {formatDateTimeBrasilia(m.data_movimentacao)}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isEntrada
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}
                            >
                              {m.tipo === 'entrada'
                                ? 'Entrada (NF)'
                                : m.tipo === 'saida'
                                ? 'Saída'
                                : m.tipo === 'estorno_entrada'
                                ? 'Estorno Entrada'
                                : 'Estorno Saída'}
                            </span>
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-mono font-bold whitespace-nowrap ${
                              isEntrada ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isEntrada ? '+' : '-'}
                            {Number(m.quantidade).toLocaleString('pt-BR')} {extratoProduto.unidade_medida}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700">
                            {m.numero_lote || '-'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700">
                            {m.documento_referencia || '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            {m.centro_custo_nome || (
                              <span className="text-slate-400 italic">Almoxarifado Central</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            {m.responsavel_nome || m.usuario_nome || 'Sistema'}
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                            {m.observacao || m.motivo_diverso || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  Nenhuma movimentação registrada no extrato deste produto até o momento.
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setExtratoProduto(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Fechar Extrato
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
