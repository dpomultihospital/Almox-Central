import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  PackagePlus,
  ClipboardList,
  CheckSquare,
  RotateCcw,
  FileBarChart,
  UserCheck,
  Search,
  LogOut,
  Hospital,
  Sparkles,
  ArrowRight,
  HardDriveDownload
} from 'lucide-react';
import type { Usuario, EmpresaUnidade, Produto, Requisicao } from '../types/index.ts';
import { NotificationsDropdown } from './NotificationsDropdown.tsx';

interface ModuleGridViewProps {
  currentUser: Usuario;
  activeUnidade?: EmpresaUnidade | null;
  produtos?: Produto[];
  requisicoes?: Requisicao[];
  requisicoesPendentesCount: number;
  emprestimosAtrasadosCount: number;
  itensEstoqueBaixoCount: number;
  onSelectModule: (moduleId: string) => void;
  onLogout: () => void;
}

export const ModuleGridView: React.FC<ModuleGridViewProps> = ({
  currentUser,
  activeUnidade,
  produtos = [],
  requisicoes = [],
  requisicoesPendentesCount,
  emprestimosAtrasadosCount,
  itensEstoqueBaixoCount,
  onSelectModule,
  onLogout,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Lista de módulos com regras de visibilidade por perfil
  const allModules = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      descricao: 'Indicadores gerais, gráficos de consumo e alertas',
      icon: LayoutDashboard,
      badge: itensEstoqueBaixoCount > 0 ? `${itensEstoqueBaixoCount} baixos` : null,
      badgeColor: 'bg-amber-500',
      allowedRoles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'usuarios',
      label: 'Usuário',
      descricao: 'Consulta, cadastro e permissões de operadores',
      icon: Users,
      badge: null,
      allowedRoles: ['admin', 'almoxarife'],
    },
    {
      id: 'centros-custo',
      label: 'Centro de Custo',
      descricao: 'Departamentos e setores assistenciais hospitalares',
      icon: Building2,
      badge: null,
      allowedRoles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'produtos',
      label: 'Produtos / Itens',
      descricao: 'Catálogo de materiais, medicamentos e equipamentos',
      icon: Package,
      badge: itensEstoqueBaixoCount > 0 ? `${itensEstoqueBaixoCount} crítico` : null,
      badgeColor: 'bg-rose-500',
      allowedRoles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'entradas',
      label: 'Entrada de Estoque',
      descricao: 'Recebimento de notas fiscais, fornecedores e lotes',
      icon: PackagePlus,
      badge: null,
      allowedRoles: ['admin', 'almoxarife'],
    },
    {
      id: 'requisicoes',
      label: 'Requisição',
      descricao: 'Abertura e acompanhamento de pedidos de insumos',
      icon: ClipboardList,
      badge: null,
      allowedRoles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'aprovacao-requisicoes',
      label: 'Aprovação de Requisições',
      descricao: 'Análise clínica, conferência de estoque e baixa automática',
      icon: CheckSquare,
      badge: requisicoesPendentesCount > 0 ? `${requisicoesPendentesCount} pendente(s)` : null,
      badgeColor: 'bg-amber-400 text-slate-900',
      allowedRoles: ['admin', 'almoxarife'],
    },
    {
      id: 'emprestimos',
      label: 'Empréstimos',
      descricao: 'Controle de ferramentas, aparelhos médicos e devoluções',
      icon: RotateCcw,
      badge: emprestimosAtrasadosCount > 0 ? `${emprestimosAtrasadosCount} atrasado(s)` : null,
      badgeColor: 'bg-rose-500 text-white',
      allowedRoles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      descricao: 'Posição de estoque, livro razão, auditoria e indicadores',
      icon: FileBarChart,
      badge: '11 relatórios',
      badgeColor: 'bg-teal-500/80 text-white',
      allowedRoles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'perfil',
      label: 'Perfil',
      descricao: 'Dados da conta, permissões e histórico de acessos',
      icon: UserCheck,
      badge: null,
      allowedRoles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'backup',
      label: 'Backup / Exportar Dados',
      descricao: 'Download seguro do SQLite (.db), script SQL (.sql) ou JSON',
      icon: HardDriveDownload,
      badge: 'Admin',
      badgeColor: 'bg-emerald-600 text-white',
      allowedRoles: ['admin'],
    },
  ];

  // Filtra por perfil do usuário
  const filteredModules = allModules
    .filter((mod) => mod.allowedRoles.includes(currentUser.perfil))
    .filter((mod) => 
      mod.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mod.descricao.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const getPerfilLabel = (p: string) => {
    switch (p) {
      case 'admin': return 'Administrador';
      case 'almoxarife': return 'Almoxarife';
      case 'requisitante': return 'Requisitante';
      default: return p;
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-[#091535] via-[#102456] to-[#070e24] text-white font-sans select-none">
      {/* =========================================================================
          CABEÇALHO SUPERIOR: Identificação, Unidade e Busca
         ========================================================================= */}
      <header className="w-full px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-white/10 bg-black/25 backdrop-blur-md">
        {/* Identificação do Sistema */}
        <div className="flex items-center gap-3.5 w-full md:w-auto">
          <div className="w-12 h-12 rounded-xl bg-white p-1 shadow-md border border-white/20 flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Logo Santa Casa SBC" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white">ALMOXCONTROL</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#00237D] text-[#6EC1E4] px-2 py-0.5 rounded-full border border-[#6EC1E4]/30">
                Gestão & Estoque
              </span>
            </div>
            <p className="text-xs text-blue-200/70 font-medium">Controle Integrado de Almoxarifado</p>
          </div>
        </div>

        {/* Barra de Busca "buscar módulo" no centro */}
        <div className="w-full md:w-80 relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-blue-300/60">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="buscar módulo..."
            className="w-full pl-9 pr-4 py-2 bg-white/10 border border-white/20 rounded-full text-xs text-white placeholder-blue-200/50 focus:outline-none focus:bg-white/20 focus:border-[#6EC1E4] transition-all backdrop-blur-sm"
          />
        </div>

        {/* Canto Superior Direito: Notificações, Usuário Logado e Unidade Ativa */}
        <div className="flex items-center justify-end gap-4 w-full md:w-auto">
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <span className="text-sm font-semibold text-white tracking-wide">{currentUser.nome}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#00237D] text-[#6EC1E4] border border-[#6EC1E4]/30">
                {getPerfilLabel(currentUser.perfil)}
              </span>
            </div>
            <div className="flex items-center justify-end gap-1.5 text-xs text-blue-200/80 mt-0.5">
              <Hospital className="w-3.5 h-3.5 text-[#6EC1E4]" />
              <span>{activeUnidade ? `${activeUnidade.codigo} - ${activeUnidade.nome}` : 'Almoxarifado Central'}</span>
            </div>
          </div>

          {/* Sino de Notificações e Painel de Avisos */}
          <NotificationsDropdown
            produtos={produtos}
            requisicoes={requisicoes}
            currentUser={currentUser}
            onNavigate={(moduleId) => onSelectModule(moduleId)}
            variant="dark"
          />

          {/* Botão Sair */}
          <button
            type="button"
            onClick={onLogout}
            title="Encerrar sessão"
            className="p-2 rounded-lg bg-white/10 hover:bg-rose-500/30 text-white/80 hover:text-white border border-white/15 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* =========================================================================
          CORPO PRINCIPAL: Grid de Ícones Translúcidos sobre o Gradiente Teal
         ========================================================================= */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12 flex flex-col justify-center">
        {/* Banner discreto com notificações/alertas */}
        {(requisicoesPendentesCount > 0 || emprestimosAtrasadosCount > 0 || itensEstoqueBaixoCount > 0) && (
          <div className="mb-8 p-4 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-300" />
              <span className="text-xs font-semibold text-teal-100">
                Resumo operacional ativo para {activeUnidade?.nome || 'sua unidade'}:
              </span>
            </div>

            <div className="flex items-center gap-3">
              {requisicoesPendentesCount > 0 && (
                <button
                  type="button"
                  onClick={() => onSelectModule('aprovacao-requisicoes')}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  <span>{requisicoesPendentesCount} requisição(ões) pendente(s)</span>
                </button>
              )}

              {emprestimosAtrasadosCount > 0 && (
                <button
                  type="button"
                  onClick={() => onSelectModule('emprestimos')}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                  <span>{emprestimosAtrasadosCount} empréstimo(s) em atraso</span>
                </button>
              )}

              {itensEstoqueBaixoCount > 0 && (
                <button
                  type="button"
                  onClick={() => onSelectModule('produtos')}
                  className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-400/30 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>{itensEstoqueBaixoCount} item(ns) abaixo do estoque mínimo</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Grid de Ícones em Quadrados Arredondados */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 sm:gap-8 justify-items-center">
          {filteredModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => onSelectModule(mod.id)}
                className="group relative flex flex-col items-center justify-center p-4 w-36 h-36 sm:w-40 sm:h-40 rounded-2xl bg-white/10 hover:bg-white/20 active:bg-white/25 border border-white/20 hover:border-[#6EC1E4]/50 shadow-lg hover:shadow-[#00237D]/40 backdrop-blur-md transition-all duration-200 transform hover:-translate-y-1.5 cursor-pointer text-center"
              >
                {/* Badge no canto superior direito do botão */}
                {mod.badge && (
                  <div className={`absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md uppercase tracking-wider ${mod.badgeColor || 'bg-[#C2363A] text-white'}`}>
                    {mod.badge}
                  </div>
                )}

                {/* Ícone branco de traço fino */}
                <div className="w-14 h-14 rounded-xl bg-white/15 group-hover:bg-white/25 flex items-center justify-center text-white transition-all group-hover:scale-110 mb-3 shadow-inner">
                  <Icon className="w-7 h-7 stroke-[1.6]" />
                </div>

                {/* Nome do Módulo abaixo do ícone */}
                <span className="text-xs sm:text-sm font-semibold text-white group-hover:text-[#6EC1E4] tracking-wide transition-colors leading-tight">
                  {mod.label}
                </span>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-1.5 text-[10px] text-[#6EC1E4] flex items-center gap-0.5">
                  <span>Acessar</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </div>
              </button>
            );
          })}
        </div>

        {filteredModules.length === 0 && (
          <div className="text-center py-12 text-blue-200/70">
            Nenhum módulo encontrado para a busca &ldquo;{searchTerm}&rdquo;.
          </div>
        )}
      </main>

      {/* =========================================================================
          RODAPÉ DO DASHBOARD: Informações do Sistema e Alternador de Operador
         ========================================================================= */}
      <footer className="w-full px-6 py-4 border-t border-white/10 bg-black/30 text-xs text-blue-200/70 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white">AlmoxControl v2.4</span>
          <span>•</span>
          <span className="text-[#6EC1E4] font-mono">SQLite WAL Ativo</span>
          <span>•</span>
          <span className="text-blue-100/90 font-medium">Desenvolvido por Bruno Rocha</span>
        </div>

        {/* Operador Ativo e Botão para Trocar de Usuário via Logout */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-blue-100/90">
            <span className="text-[11px] text-teal-200/70 uppercase tracking-wider font-bold">Operador Ativo:</span>
            <span className="font-bold text-white">{currentUser.nome}</span>
            <span className="text-blue-200/70">({getPerfilLabel(currentUser.perfil)})</span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-rose-500/30 text-white border border-white/20 hover:border-rose-400/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Deslogar da sessão atual para acessar com outro usuário"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Deslogar / Trocar Usuário</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
