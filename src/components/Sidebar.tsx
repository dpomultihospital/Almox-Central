import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Package, 
  PackagePlus, 
  ClipboardList, 
  CheckSquare, 
  RotateCcw, 
  ArrowLeftRight, 
  FileBarChart, 
  UserCheck, 
  BookOpen, 
  LogOut,
  Hospital,
  LayoutGrid,
  HardDriveDownload
} from 'lucide-react';
import type { Usuario, EmpresaUnidade } from '../types/index.ts';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentUser: Usuario | null;
  activeUnidade?: EmpresaUnidade | null;
  onGoToGrid: () => void;
  onLogout: () => void;
  pendingRequisitionsCount: number;
  overdueLoansCount: number;
  lowStockCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  activeUnidade,
  onGoToGrid,
  onLogout,
  pendingRequisitionsCount,
  overdueLoansCount,
  lowStockCount,
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'usuarios',
      label: 'Usuário',
      icon: Users,
      roles: ['admin', 'almoxarife'],
    },
    {
      id: 'centros-custo',
      label: 'Centro de Custo',
      icon: Building2,
      roles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'produtos',
      label: 'Produtos / Itens',
      icon: Package,
      badge: lowStockCount > 0 ? `${lowStockCount} baixo` : undefined,
      badgeType: 'amber',
      roles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'entradas',
      label: 'Entrada de Estoque',
      icon: PackagePlus,
      roles: ['admin', 'almoxarife'],
    },
    {
      id: 'requisicoes',
      label: 'Requisição',
      icon: ClipboardList,
      roles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'aprovacao-requisicoes',
      label: 'Aprovação de Requisições',
      icon: CheckSquare,
      badge: pendingRequisitionsCount > 0 ? `${pendingRequisitionsCount}` : undefined,
      badgeType: 'amber',
      roles: ['admin', 'almoxarife'],
    },
    {
      id: 'emprestimos',
      label: 'Empréstimos',
      icon: RotateCcw,
      badge: overdueLoansCount > 0 ? `${overdueLoansCount} atraso` : undefined,
      badgeType: 'red',
      roles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'movimentacoes',
      label: 'Livro Razão & Auditoria',
      icon: ArrowLeftRight,
      roles: ['admin', 'almoxarife'],
    },
    {
      id: 'relatorios',
      label: 'Relatórios',
      icon: FileBarChart,
      badge: '11',
      badgeType: 'teal',
      roles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'perfil',
      label: 'Perfil',
      icon: UserCheck,
      roles: ['admin', 'almoxarife', 'requisitante'],
    },
    {
      id: 'backup',
      label: 'Backup / Exportar',
      icon: HardDriveDownload,
      badge: 'Admin',
      badgeType: 'emerald',
      roles: ['admin'],
    },
    {
      id: 'documentacao',
      label: 'Arquitetura & DDL',
      icon: BookOpen,
      roles: ['admin', 'almoxarife', 'requisitante'],
    },
  ];

  const userRole = currentUser?.perfil || 'requisitante';
  const visibleNavItems = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <aside className="w-64 bg-[#0c1836] text-slate-200 flex flex-col h-full border-r border-[#1a2d59] shrink-0 select-none">
      {/* Topo: Logo AlmoxControl & Botão Menu de Módulos */}
      <div className="p-4 border-b border-[#1a2d59]">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white p-1 shadow-md border border-slate-200/50 flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="Logo Santa Casa SBC" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-white text-base tracking-tight">ALMOXCONTROL</span>
            </div>
            <p className="text-[10px] text-[#6EC1E4] font-semibold uppercase tracking-wider">Gestão de Almoxarifado</p>
          </div>
        </div>

        {/* Botão de Atalho para o Menu em Grade */}
        <button
          type="button"
          onClick={onGoToGrid}
          className="mt-3 w-full py-2 px-3 rounded-lg bg-[#00237D]/60 hover:bg-[#00237D] text-white border border-[#6EC1E4]/30 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
        >
          <LayoutGrid className="w-4 h-4 text-[#6EC1E4]" />
          <span>Painel em Grade</span>
        </button>
      </div>

      {/* Cartão do Operador e Unidade Ativa */}
      <div className="p-3 mx-3 my-2 rounded-lg bg-[#14234b]/80 border border-[#1e346d] text-xs">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Operador</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#6EC1E4]/20 text-[#6EC1E4] border border-[#6EC1E4]/30">
            {currentUser?.perfil}
          </span>
        </div>
        <div className="font-semibold text-white truncate">{currentUser?.nome}</div>
        <div className="text-[11px] text-slate-300 flex items-center gap-1 mt-1 truncate">
          <Hospital className="w-3 h-3 text-[#6EC1E4] shrink-0" />
          <span className="truncate">{activeUnidade ? activeUnidade.nome : 'Almoxarifado Central'}</span>
        </div>
      </div>

      {/* Menu de Navegação Vertical */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#00237D] text-white font-semibold shadow-md border-l-2 border-[#6EC1E4]'
                  : 'text-slate-300 hover:bg-[#14234b] hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    item.badgeType === 'amber'
                      ? 'bg-amber-500 text-slate-900'
                      : item.badgeType === 'red'
                      ? 'bg-rose-500 text-white'
                      : 'bg-teal-500/40 text-teal-200'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Rodapé: Encerrar Sessão para Trocar de Usuário */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <button
          type="button"
          onClick={onLogout}
          title="Deslogar da conta atual para acessar com outro usuário"
          className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-200 border border-slate-700/80 hover:border-rose-700/50 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Deslogar / Trocar Usuário</span>
        </button>
      </div>
    </aside>
  );
};
