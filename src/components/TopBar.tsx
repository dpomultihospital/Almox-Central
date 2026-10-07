import React from 'react';
import { 
  Plus, 
  RefreshCw, 
  PackagePlus, 
  Repeat, 
  LayoutGrid, 
  Hospital, 
  LogOut, 
  UserCheck,
  Building2,
  HardDriveDownload
} from 'lucide-react';
import type { Usuario, EmpresaUnidade, Produto, Requisicao } from '../types/index.ts';
import { NotificationsDropdown } from './NotificationsDropdown.tsx';

interface TopBarProps {
  currentTab: string;
  currentUser: Usuario | null;
  activeUnidade?: EmpresaUnidade | null;
  produtos?: Produto[];
  requisicoes?: Requisicao[];
  onSelectTab?: (tab: string) => void;
  onOpenNovaRequisicao: () => void;
  onOpenNovaEntrada: () => void;
  onOpenNovoEmprestimo: () => void;
  onResetDb: () => void;
  onGoToGrid: () => void;
  onLogout: () => void;
  onOpenBackupModal?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  currentUser,
  activeUnidade,
  produtos = [],
  requisicoes = [],
  onSelectTab,
  onOpenNovaRequisicao,
  onOpenNovaEntrada,
  onOpenNovoEmprestimo,
  onResetDb,
  onGoToGrid,
  onLogout,
  onOpenBackupModal,
}) => {
  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Dashboard & Indicadores';
      case 'requisicoes': return 'Requisições de Insumos';
      case 'aprovacao-requisicoes': return 'Aprovação de Requisições';
      case 'emprestimos': return 'Empréstimos de Equipamentos';
      case 'entradas': return 'Entrada de Estoque / NF';
      case 'produtos': return 'Consulta de Produtos / Materiais';
      case 'movimentacoes': return 'Livro Razão & Movimentações';
      case 'centros-custo': return 'Consulta de Centro de Custo';
      case 'usuarios': return 'Consulta de Usuário';
      case 'relatorios': return 'Relatórios Gerenciais';
      case 'perfil': return 'Perfil do Operador';
      case 'backup': return 'Backup & Exportação do Banco';
      case 'documentacao': return 'Documentação Técnica & DDL';
      default: return 'Almoxarifado Hospitalar';
    }
  };

  const isAlmoxarifeOrAdmin = currentUser?.perfil === 'admin' || currentUser?.perfil === 'almoxarife';

  return (
    <header className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs z-20">
      {/* Zona 1: Trilha de Navegação (Breadcrumb) */}
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={onGoToGrid}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold uppercase tracking-wider text-[11px] border border-teal-200 transition-all cursor-pointer"
          title="Retornar ao Painel de Módulos"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Menu de Módulos</span>
        </button>

        <span className="text-slate-300">/</span>
        <div className="flex items-center gap-1.5">
          <img src="/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
          <span className="text-[#00237D] font-bold">AlmoxControl</span>
        </div>
        <span className="text-slate-300">/</span>
        <span className="font-bold text-slate-800 text-sm tracking-tight">{getTabTitle(currentTab)}</span>
      </div>

      {/* Zona 2: Unidade Hospitalar Ativa */}
      <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
        <Hospital className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        <span>Unidade: <strong className="text-slate-800">{activeUnidade ? `${activeUnidade.codigo} - ${activeUnidade.nome}` : 'Almoxarifado Central'}</strong></span>
        <span className="text-slate-300">·</span>
        <span className="text-emerald-700 font-semibold flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          SQLite Ativo
        </span>
      </div>

      {/* Zona 3: Ações Rápidas & Sessão */}
      <div className="flex items-center gap-2.5">
        {currentUser?.perfil === 'admin' && (
          <>
            {onOpenBackupModal && (
              <button
                type="button"
                onClick={onOpenBackupModal}
                title="Exportar backup completo do banco de dados (exclusivo admin)"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded transition-all cursor-pointer whitespace-nowrap"
              >
                <HardDriveDownload className="w-3.5 h-3.5 text-teal-600" />
                <span className="hidden sm:inline">Backup .DB</span>
              </button>
            )}

            <button
              type="button"
              onClick={onResetDb}
              title="Restaura o banco de dados para o estado inicial limpo"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Limpar Base</span>
            </button>
          </>
        )}

        {/* Botão de Nova Requisição */}
        <button
          type="button"
          onClick={onOpenNovaRequisicao}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#00237D] hover:bg-[#001c66] rounded text-xs uppercase tracking-wide transition-all shadow cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Requisição</span>
        </button>

        {isAlmoxarifeOrAdmin && (
          <button
            type="button"
            onClick={onOpenNovaEntrada}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded transition-all cursor-pointer whitespace-nowrap"
          >
            <PackagePlus className="w-3.5 h-3.5 text-teal-600" />
            <span>+ Entrada NF</span>
          </button>
        )}

        {/* Sistema de Notificações (Alertas de Estoque Baixo e Requisições Pendentes) */}
        <NotificationsDropdown
          produtos={produtos}
          requisicoes={requisicoes}
          currentUser={currentUser}
          onNavigate={(tab) => onSelectTab && onSelectTab(tab)}
          variant="light"
        />

        {/* Informações do Usuário & Sair */}
        <div className="pl-2 border-l border-slate-200 flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-slate-800 leading-tight">{currentUser?.nome}</div>
            <div className="text-[10px] text-teal-700 font-semibold uppercase">{currentUser?.perfil}</div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            title="Encerrar sessão"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
