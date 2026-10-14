import React, { useState } from 'react';
import {
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
  HardDriveDownload,
  Truck,
  ArrowLeftRight,
  Boxes
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

  // Lista de módulos com regras de visibilidade por perfil e separação estrutural de cadastros
  const allModules = [
    {
      id: 'fornecedores',
      label: 'Fornecedores / Entidades',
      descricao: 'Cadastro próprio de fornecedores comerciais e hospitais parceiros',
      icon: Truck,
      badge: 'Etapa 1',
      badgeColor: 'bg-teal-600 text-white',
      allowedRoles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'produtos',
      label: 'Produtos / Catálogo',
      descricao: 'Catálogo com código único interno, estoque mín/máx e lotes',
      icon: Package,
      badge: itensEstoqueBaixoCount > 0 ? `${itensEstoqueBaixoCount} crítico` : 'Etapa 2',
      badgeColor: itensEstoqueBaixoCount > 0 ? 'bg-rose-500 text-white' : 'bg-teal-600 text-white',
      allowedRoles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'entradas',
      label: 'Entrada por Nota Fiscal',
      descricao: 'Operação separada de entrada de NF vinculada ao código interno e lote',
      icon: PackagePlus,
      badge: 'Etapa 3',
      badgeColor: 'bg-blue-600 text-white',
      allowedRoles: ['admin', 'almoxarife'],
    },
    {
      id: 'movimentacoes',
      label: 'Movimentações Diversas',
      descricao: 'Saídas por vencimento/descarte, avaria, perda, doação e livro-caixa',
      icon: ArrowLeftRight,
      badge: null,
      allowedRoles: ['admin', 'almoxarife'],
    },
    {
      id: 'inventarios',
      label: 'Inventário do Estoque',
      descricao: 'Recontagem física, auditoria e ajuste de saldo por centro de custo e lote',
      icon: Boxes,
      badge: 'Contagem',
      badgeColor: 'bg-emerald-600 text-white',
      allowedRoles: ['admin', 'almoxarife'],
    },
    {
      id: 'emprestimos',
      label: 'Empréstimos entre Entidades',
      descricao: 'Empréstimo recebido/concedido entre hospitais e ficha com assinaturas',
      icon: RotateCcw,
      badge: emprestimosAtrasadosCount > 0 ? `${emprestimosAtrasadosCount} pendente(s)` : null,
      badgeColor: 'bg-rose-500 text-white',
      allowedRoles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'requisicoes',
      label: 'Requisição',
      descricao: 'Abertura e acompanhamento de pedidos de insumos dos setores',
      icon: ClipboardList,
      badge: null,
      allowedRoles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'aprovacao-requisicoes',
      label: 'Aprovação de Requisições',
      descricao: 'Análise pelo almoxarifado, bloqueio de lote vencido e baixa FEFO',
      icon: CheckSquare,
      badge: requisicoesPendentesCount > 0 ? `${requisicoesPendentesCount} pendente(s)` : null,
      badgeColor: 'bg-amber-400 text-slate-900',
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
      id: 'usuarios',
      label: 'Usuário',
      descricao: 'Consulta, cadastro e permissões de operadores',
      icon: Users,
      badge: null,
      allowedRoles: ['admin', 'almoxarife'],
    },
    {
      id: 'relatorios',
      label: 'Relatórios & Geral PDF',
      descricao: 'Relatório Geral Impresso/PDF, validade (30/60/90d) e posição de estoque',
      icon: FileBarChart,
      badge: 'Relatório Geral',
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
      <header className="w-full h-16 px-8 flex items-center justify-between gap-4 border-b border-white/10 bg-black/20 backdrop-blur-md">
        {/* Identificação do Sistema Minimalista */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-white p-1 shadow-xs flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Logo Santa Casa SBC" className="w-full h-full object-contain" />
          </div>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-sm font-bold tracking-wide text-white">ALMOXCONTROL</span>
            <span aria-hidden="true" className="text-white/25 hidden sm:inline">·</span>
            <span className="text-xs text-blue-200/70 hidden sm:inline truncate">
              {activeUnidade ? `${activeUnidade.codigo} — ${activeUnidade.nome}` : 'Almoxarifado Central'}
            </span>
          </div>
        </div>

        {/* Busca Minimalista no Centro */}
        <div className="w-56 md:w-72 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-200/50">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filtrar módulos..."
            className="w-full pl-8 pr-3 py-1.5 bg-white/8 border border-white/12 rounded-lg text-xs text-white placeholder-blue-200/45 focus:outline-none focus:bg-white/15 focus:border-white/30 transition-all"
          />
        </div>

        {/* Direita: Notificações, Operador e Sair */}
        <div className="flex items-center justify-end gap-2">
          <NotificationsDropdown
            produtos={produtos}
            requisicoes={requisicoes}
            currentUser={currentUser}
            onNavigate={(moduleId) => onSelectModule(moduleId)}
            variant="dark"
          />

          <div className="h-4 w-px bg-white/15 mx-1" />

          <div className="hidden sm:flex items-center gap-2 text-xs text-white/90 pr-1">
            <span className="font-medium">{currentUser.nome}</span>
            <span aria-hidden="true" className="text-white/30">·</span>
            <span className="text-blue-200/70">{getPerfilLabel(currentUser.perfil)}</span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            title="Encerrar sessão"
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-rose-500/25 transition-all cursor-pointer"
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
