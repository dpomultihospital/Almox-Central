import React, { useState } from 'react';
import { History, ArrowDownLeft, ArrowUpRight, RotateCcw, AlertTriangle, Search, Filter, ShieldCheck } from 'lucide-react';
import type { Movimentacao, Usuario } from '../types/index.ts';

interface MovimentacoesViewProps {
  movimentacoes: Movimentacao[];
  currentUser: Usuario | null;
  onRefresh: () => void;
}

export const MovimentacoesView: React.FC<MovimentacoesViewProps> = ({
  movimentacoes,
  currentUser,
  onRefresh,
}) => {
  const [filterTipo, setFilterTipo] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal de Estorno
  const [estornoItem, setEstornoItem] = useState<Movimentacao | null>(null);
  const [justificativa, setJustificativa] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAdmin = currentUser?.perfil === 'admin';

  const handleConfirmarEstorno = async () => {
    if (!estornoItem) return;
    if (!justificativa.trim()) {
      setErrorMsg('A justificativa é obrigatória para executar um estorno auditável');
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

      setEstornoItem(null);
      setJustificativa('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filtered = movimentacoes.filter((m) => {
    const matchesTipo = filterTipo === 'todos' || m.tipo === filterTipo;
    const matchesSearch = !searchTerm.trim() ||
      m.produto_codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.produto_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.documento_referencia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.centro_custo_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.usuario_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.observacao?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesTipo && matchesSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-teal-600" />
            Livro-Caixa de Estoque & Auditoria Imutável
          </h2>
          <p className="text-xs text-slate-500">
            Registro transacional rigoroso: linhas históricas protegidas contra deleção; estornos geram lançamentos compensatórios
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Auditoria Estrita Habilitada</span>
        </div>
      </div>

      {/* Controles de Filtro e Busca */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Segmented controls para tipo de movimentação */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto w-full md:w-auto">
          {[
            { id: 'todos', label: 'Todas as Operações' },
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
            placeholder="Buscar por lote, produto, doc ou operador..."
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
                <th className="py-3 px-4"># Lançamento</th>
                <th className="py-3 px-4">Data / Hora</th>
                <th className="py-3 px-4">Tipo de Movimento</th>
                <th className="py-3 px-4">Produto</th>
                <th className="py-3 px-4 text-right">Qtd</th>
                <th className="py-3 px-4">Centro de Custo</th>
                <th className="py-3 px-4">Doc. Referência</th>
                <th className="py-3 px-4">Operador</th>
                <th className="py-3 px-4">Observações</th>
                {isAdmin && <th className="py-3 px-4 text-right">Ação</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
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
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-500 text-[11px] block">{mov.produto_codigo}</span>
                        <span className="font-medium text-slate-900">{mov.produto_nome}</span>
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
                        ) : (
                          <span className="text-slate-400 italic">Almoxarifado Central</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-800">
                        {mov.documento_referencia || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {mov.usuario_nome}
                      </td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-xs">
                        {mov.observacao || '—'}
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          {!isEstorno && (
                            <button
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
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
