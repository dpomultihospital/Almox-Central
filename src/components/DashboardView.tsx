import React from 'react';
import { 
  AlertTriangle, 
  Clock, 
  Repeat, 
  Boxes, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Building2, 
  CheckCircle2, 
  PackagePlus,
  FileText
} from 'lucide-react';
import type { DashboardStats, Usuario } from '../types/index.ts';

interface DashboardViewProps {
  stats: DashboardStats | null;
  onNavigate: (tab: string) => void;
  currentUser: Usuario | null;
  onOpenNovaEntrada: () => void;
  onOpenNovaRequisicao: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  onNavigate,
  currentUser,
  onOpenNovaEntrada,
  onOpenNovaRequisicao
}) => {
  if (!stats) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm">Carregando indicadores do almoxarifado...</p>
      </div>
    );
  }

  const { kpis, consumo_centros_custo, produtos_criticos, ultimas_movimentacoes } = stats;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Mensagem de Boas-Vindas Contextualizada */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-white p-1 border border-slate-200 shadow-xs flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Logo Santa Casa SBC" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              <span>Painel Central do AlmoxControl</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#00237D] px-2 py-0.5 rounded-full border border-blue-200">
                Santa Casa SBC
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoramento em tempo real de saldos, atendimento de pedidos de suprimentos e custódia de equipamentos.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenNovaRequisicao}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#00237D] hover:bg-[#001c66] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Criar Requisição</span>
          </button>
          {(currentUser?.perfil === 'admin' || currentUser?.perfil === 'almoxarife') && (
            <button
              onClick={onOpenNovaEntrada}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <PackagePlus className="w-3.5 h-3.5 text-slate-600" />
              <span>Dar Entrada NF</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Cards de Indicadores Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Estoque Baixo */}
        <div 
          onClick={() => onNavigate('produtos')}
          className="bg-white border border-slate-200 rounded-xl p-4.5 cursor-pointer hover:border-amber-400 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Itens em Estoque Baixo
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              kpis.itens_estoque_baixo > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
              {kpis.itens_estoque_baixo}
            </span>
            <span className="text-xs text-slate-500">
              de {kpis.total_produtos} cadastrados
            </span>
          </div>
          <p className="text-[11px] text-amber-700 font-medium mt-2 group-hover:underline">
            {kpis.itens_estoque_baixo > 0 ? 'Exige emissão de reposição →' : 'Todos os saldos regulares'}
          </p>
        </div>

        {/* Card 2: Requisições Pendentes */}
        <div 
          onClick={() => onNavigate('requisicoes')}
          className="bg-white border border-slate-200 rounded-xl p-4.5 cursor-pointer hover:border-teal-400 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Requisições Pendentes
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              kpis.requisicoes_pendentes > 0 ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'
            }`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
              {kpis.requisicoes_pendentes}
            </span>
            <span className="text-xs text-slate-500">
              pedidos aguardando
            </span>
          </div>
          <p className="text-[11px] text-teal-700 font-medium mt-2 group-hover:underline">
            {kpis.requisicoes_pendentes > 0 ? 'Aguardando parecer do almoxarife →' : 'Fila de pedidos zerada'}
          </p>
        </div>

        {/* Card 3: Empréstimos Ativos */}
        <div 
          onClick={() => onNavigate('emprestimos')}
          className="bg-white border border-slate-200 rounded-xl p-4.5 cursor-pointer hover:border-blue-400 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Empréstimos Ativos
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Repeat className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
              {kpis.emprestimos_ativos}
            </span>
            <span className="text-xs text-slate-500">
              equipamentos em campo
            </span>
          </div>
          <p className="text-[11px] text-blue-700 font-medium mt-2 group-hover:underline">
            Custódia temporária em setores →
          </p>
        </div>

        {/* Card 4: Empréstimos Atrasados */}
        <div 
          onClick={() => onNavigate('emprestimos')}
          className="bg-white border border-slate-200 rounded-xl p-4.5 cursor-pointer hover:border-red-400 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Empréstimos Vencidos
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              kpis.emprestimos_atrasados > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
              {kpis.emprestimos_atrasados}
            </span>
            <span className="text-xs text-slate-500">
              fora do prazo previsto
            </span>
          </div>
          <p className={`text-[11px] font-medium mt-2 group-hover:underline ${
            kpis.emprestimos_atrasados > 0 ? 'text-red-700 font-semibold' : 'text-slate-500'
          }`}>
            {kpis.emprestimos_atrasados > 0 ? 'Cobrança de devolução imediata →' : 'Nenhum item em atraso'}
          </p>
        </div>
      </div>

      {/* Bloco Central: 2 Colunas (Consumo por Centro de Custo + Produtos Críticos) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consumo por Centro de Custo no Mês Atual */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-600" />
                Consumo por Centro de Custo (Mês Atual)
              </h3>
              <p className="text-xs text-slate-500">Volume de saídas atendidas e baixadas</p>
            </div>
            <button
              onClick={() => onNavigate('centros_custo')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800"
            >
              Ver Centros →
            </button>
          </div>

          <div className="space-y-3">
            {consumo_centros_custo.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Nenhuma saída registrada este mês</p>
            ) : (
              consumo_centros_custo.map((cc) => {
                const maxUnidades = Math.max(...consumo_centros_custo.map(c => c.total_unidades), 1);
                const percent = Math.round((cc.total_unidades / maxUnidades) * 100);

                return (
                  <div key={cc.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">
                        <span className="font-mono text-slate-500 mr-1.5">{cc.codigo}</span>
                        {cc.nome}
                      </span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {cc.total_unidades} un.
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-teal-600 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.max(percent, cc.total_unidades > 0 ? 5 : 0)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Produtos em Nível Crítico (Abaixo ou no limite do mínimo) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Itens Críticos & Abaixo do Mínimo
              </h3>
              <p className="text-xs text-slate-500">Produtos que necessitam reabastecimento urgente</p>
            </div>
            <button
              onClick={() => onNavigate('produtos')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800"
            >
              Ver Estoque Completo →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-2 font-medium">Código & Produto</th>
                  <th className="pb-2 font-medium text-right">Est. Atual</th>
                  <th className="pb-2 font-medium text-right">Mínimo</th>
                  <th className="pb-2 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {produtos_criticos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      Nenhum item com estoque abaixo do mínimo.
                    </td>
                  </tr>
                ) : (
                  produtos_criticos.map((prod) => {
                    const ratio = prod.quantidade_atual / (prod.estoque_minimo || 1);
                    const isVeryLow = ratio < 0.5;

                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-2">
                          <span className="font-mono text-[11px] text-slate-500 block leading-tight">{prod.codigo}</span>
                          <span className="font-medium text-slate-800 truncate block max-w-xs">{prod.nome}</span>
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-slate-900">
                          {prod.quantidade_atual} {prod.unidade_medida}
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-500 tabular-nums">
                          {prod.estoque_minimo} {prod.unidade_medida}
                        </td>
                        <td className="py-2.5 text-center">
                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${
                            isVeryLow 
                              ? 'bg-red-100 text-red-700' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isVeryLow ? 'CRÍTICO' : 'REPOR'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Livro-Caixa Recente (Últimas 6 Movimentações Auditáveis) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Últimos Registros no Livro-Caixa de Estoque
            </h3>
            <p className="text-xs text-slate-500">Rastreabilidade imutável de entradas, saídas e estornos</p>
          </div>
          <button
            onClick={() => onNavigate('movimentacoes')}
            className="text-xs font-medium text-teal-700 hover:text-teal-800"
          >
            Ver Histórico Completo de Auditoria →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="pb-2 font-medium">Data / Hora</th>
                <th className="pb-2 font-medium">Tipo</th>
                <th className="pb-2 font-medium">Produto</th>
                <th className="pb-2 font-medium text-right">Qtd</th>
                <th className="pb-2 font-medium">Destino / Centro de Custo</th>
                <th className="pb-2 font-medium">Doc. Referência</th>
                <th className="pb-2 font-medium">Operador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ultimas_movimentacoes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nenhuma movimentação de estoque registrada. Cadastre produtos e registre entradas ou requisições para movimentar o almoxarifado.
                  </td>
                </tr>
              ) : (
                ultimas_movimentacoes.map((mov) => {
                  const isEntrada = mov.tipo === 'entrada';
                  const isSaida = mov.tipo === 'saida';

                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {mov.data_movimentacao}
                      </td>
                      <td className="py-2.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                          isEntrada 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : isSaida 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {isEntrada ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {mov.tipo.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 font-medium text-slate-800">
                        <span className="font-mono text-slate-500 mr-1.5">{mov.produto_codigo}</span>
                        {mov.produto_nome}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                        {mov.quantidade} {mov.unidade_medida}
                      </td>
                      <td className="py-2.5 text-slate-600">
                        {mov.centro_custo_nome || <span className="text-slate-400 italic">Almoxarifado Central</span>}
                      </td>
                      <td className="py-2.5 font-mono text-slate-700">
                        {mov.documento_referencia || '—'}
                      </td>
                      <td className="py-2.5 text-slate-600 truncate max-w-xs">
                        {mov.usuario_nome}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rodapé e Créditos */}
      <footer className="pt-4 pb-2 text-center border-t border-slate-200">
        <p className="text-xs text-slate-400 font-medium">
          Desenvolvido por Bruno Rocha
        </p>
      </footer>
    </div>
  );
};
