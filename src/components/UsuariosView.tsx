import React, { useState, useMemo } from 'react';
import {
  Users,
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
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  KeyRound,
  Building2,
  Mail,
  CreditCard,
  UserCheck,
  Trash2
} from 'lucide-react';
import type { Usuario, CentroCusto, PerfilUsuario, EmpresaUnidade } from '../types/index.ts';
import { useToast } from '../context/ToastContext.tsx';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';
import { CentroCustoAlertBanner } from './CentroCustoAlertBanner.tsx';

interface UsuariosViewProps {
  usuarios: Usuario[];
  centrosCusto: CentroCusto[];
  unidades?: EmpresaUnidade[];
  currentUser: Usuario | null;
  onRefresh: () => void;
  onVoltar?: () => void;
  onNavigate?: (tab: string) => void;
}

export const UsuariosView: React.FC<UsuariosViewProps> = ({
  usuarios,
  centrosCusto,
  unidades = [],
  currentUser,
  onRefresh,
  onVoltar,
  onNavigate,
}) => {
  // Filtros de busca em duas linhas
  const [filtroCodigo, setFiltroCodigo] = useState('');
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroLogin, setFiltroLogin] = useState('');
  const [filtroCpf, setFiltroCpf] = useState('');
  const [filtroEmail, setFiltroEmail] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | '1' | '0'>('todos');

  // Controle de Visualização / Edição / Cadastro
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [activeFormTab, setActiveFormTab] = useState<'identificacao' | 'permissoes' | 'historico'>('identificacao');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  // Campos do Formulário em Abas
  const [formCodigo, setFormCodigo] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formLogin, setFormLogin] = useState('');
  const [formSenha, setFormSenha] = useState('');
  const [formCpf, setFormCpf] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPerfil, setFormPerfil] = useState<PerfilUsuario>('requisitante');
  const [formCcId, setFormCcId] = useState<number | ''>('');
  const [formEmpresaId, setFormEmpresaId] = useState<number>(1);
  const [formAtivo, setFormAtivo] = useState<number>(1);
  const [formHistoricoCriacao, setFormHistoricoCriacao] = useState('');
  const [formHistoricoAcesso, setFormHistoricoAcesso] = useState('');

  // Checkboxes de Permissões (Aba 2)
  const [permissoes, setPermissoes] = useState({
    cadastrar_produtos: false,
    analisar_requisicoes: false,
    liberar_emprestimos: false,
    emitir_relatorios: true,
    estornar_movimentacoes: false,
  });

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<Usuario | null>(null);

  const { toast } = useToast();
  const isAdmin = currentUser?.perfil === 'admin';

  // Filtragem dos usuários
  const filteredUsers = useMemo(() => {
    return usuarios.filter((u) => {
      if (filtroCodigo && !u.codigo?.toLowerCase().includes(filtroCodigo.toLowerCase()) && !String(u.id).includes(filtroCodigo)) {
        return false;
      }
      if (filtroNome && !u.nome.toLowerCase().includes(filtroNome.toLowerCase())) {
        return false;
      }
      if (filtroLogin && !u.login.toLowerCase().includes(filtroLogin.toLowerCase())) {
        return false;
      }
      if (filtroCpf && !u.cpf?.toLowerCase().includes(filtroCpf.toLowerCase())) {
        return false;
      }
      if (filtroEmail && !u.email?.toLowerCase().includes(filtroEmail.toLowerCase())) {
        return false;
      }
      if (filtroAtivo !== 'todos') {
        const ativoVal = filtroAtivo === '1' ? 1 : 0;
        if (u.ativo !== ativoVal) return false;
      }
      return true;
    });
  }, [usuarios, filtroCodigo, filtroNome, filtroLogin, filtroCpf, filtroEmail, filtroAtivo]);

  // Paginação calculada
  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Abertura do formulário de novo usuário
  const handleNovo = () => {
    setFormMode('create');
    setEditingUserId(null);
    setFormCodigo(`USR-00${usuarios.length + 1}`);
    setFormNome('');
    setFormLogin('');
    setFormSenha('123456');
    setFormCpf('');
    setFormEmail('');
    setFormPerfil('requisitante');
    setFormCcId(centrosCusto[0]?.id || '');
    setFormEmpresaId(unidades[0]?.id || 1);
    setFormAtivo(1);
    setFormHistoricoCriacao(new Date().toLocaleString('pt-BR'));
    setFormHistoricoAcesso('Primeiro acesso pendente');
    setPermissoes({
      cadastrar_produtos: false,
      analisar_requisicoes: false,
      liberar_emprestimos: false,
      emitir_relatorios: true,
      estornar_movimentacoes: false,
    });
    setActiveFormTab('identificacao');
    setErrorMsg(null);
    setIsFormOpen(true);
  };

  // Abertura para edição
  const handleEditar = (u: Usuario) => {
    setFormMode('edit');
    setEditingUserId(u.id);
    setFormCodigo(u.codigo || `USR-${String(u.id).padStart(4, '0')}`);
    setFormNome(u.nome);
    setFormLogin(u.login);
    setFormSenha('');
    setFormCpf(u.cpf || '');
    setFormEmail(u.email || '');
    setFormPerfil(u.perfil);
    setFormCcId(u.centro_custo_id || '');
    setFormEmpresaId(u.empresa_id || 1);
    setFormAtivo(u.ativo);
    setFormHistoricoCriacao(u.criado_em ? new Date(u.criado_em).toLocaleString('pt-BR') : '29/09/2026');
    setFormHistoricoAcesso(u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') : 'Sem registros recentes');
    setPermissoes({
      cadastrar_produtos: ['admin', 'almoxarife'].includes(u.perfil),
      analisar_requisicoes: ['admin', 'almoxarife'].includes(u.perfil),
      liberar_emprestimos: ['admin', 'almoxarife'].includes(u.perfil),
      emitir_relatorios: true,
      estornar_movimentacoes: u.perfil === 'admin',
    });
    setActiveFormTab('identificacao');
    setErrorMsg(null);
    setIsFormOpen(true);
  };

  // Visualizar apenas
  const handleVisualizar = (u: Usuario) => {
    handleEditar(u);
    setFormMode('view');
  };

  // Salvar formulário
  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === 'view') {
      setIsFormOpen(false);
      return;
    }

    if (!formNome || !formLogin || !formPerfil) {
      const msg = 'Nome, login e perfil são campos obrigatórios.';
      setErrorMsg(msg);
      toast.error('Campos Obrigatórios', msg);
      setActiveFormTab('identificacao');
      return;
    }

    if (formPerfil === 'requisitante' && !formCcId) {
      const msg = 'Centro de Custo é obrigatório para usuários Requisitantes.';
      setErrorMsg(msg);
      toast.error('Centro de Custo Obrigatório', msg);
      setActiveFormTab('identificacao');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        codigo: formCodigo,
        nome: formNome.trim(),
        login: formLogin.trim(),
        cpf: formCpf ? formCpf.trim() : null,
        email: formEmail ? formEmail.trim() : null,
        perfil: formPerfil,
        centro_custo_id: formCcId || null,
        empresa_id: formEmpresaId || 1,
        ativo: formAtivo,
      };

      if (formSenha && formSenha.trim()) {
        payload.senha = formSenha.trim();
      }

      const url = formMode === 'create' ? '/api/usuarios' : `/api/usuarios/${editingUserId}`;
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
        throw new Error(data.error || 'Erro ao salvar usuário.');
      }

      if (formMode === 'create') {
        toast.success(
          'Usuário Cadastrado',
          `O operador "${payload.nome}" (@${payload.login}) foi adicionado ao sistema.`
        );
      } else {
        toast.success(
          'Usuário Atualizado',
          `O cadastro do operador "${payload.nome}" (@${payload.login}) foi atualizado.`
        );
      }

      setIsFormOpen(false);
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Erro ao processar solicitação.';
      setErrorMsg(msg);
      toast.error(
        formMode === 'create' ? 'Erro ao Cadastrar Usuário' : 'Erro ao Editar Usuário',
        msg
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/usuarios/${deletingUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `user:${currentUser?.id}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir usuário.');
      }

      toast.success(
        'Usuário Excluído',
        data.message || `O operador "${deletingUser.nome}" (@${deletingUser.login}) foi excluído.`
      );
      if (editingUserId === deletingUser.id) {
        setIsFormOpen(false);
      }
      setDeletingUser(null);
      onRefresh();
    } catch (err: any) {
      toast.error('Erro ao Excluir Usuário', err.message || 'Falha ao excluir usuário.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPerfilBadge = (p: string) => {
    switch (p) {
      case 'admin':
        return <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold uppercase tracking-wider border border-purple-200">Administrador</span>;
      case 'almoxarife':
        return <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-800 text-[10px] font-bold uppercase tracking-wider border border-teal-200">Almoxarife</span>;
      case 'requisitante':
        return <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold uppercase tracking-wider border border-blue-200">Requisitante</span>;
      default:
        return <span>{p}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          CABEÇALHO DA TELA DE CONSULTA DE USUÁRIO
         ========================================================================= */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-100 text-teal-800 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Consulta de Usuário</h1>
            <p className="text-xs text-slate-500">Gestão e controle de operadores de almoxarifado e solicitantes</p>
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

      {/* Aviso de Centro de Custo Vazio */}
      {centrosCusto.length === 0 && (
        <CentroCustoAlertBanner
          isAdmin={isAdmin}
          onCadastrarCentroCusto={onNavigate ? () => onNavigate('centros-custo') : undefined}
          mensagemPersonalizada="Cadastre ao menos um Centro de Custo para começar a vincular usuários e setores da instituição."
        />
      )}

      {/* =========================================================================
          SEÇÃO 1: FORMULÁRIO DE CADASTRO / EDIÇÃO EM ABAS (SE ABERTO)
         ========================================================================= */}
      {isFormOpen ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden animate-fadeIn">
          {/* Cabeçalho do Formulário */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                {formMode === 'create' ? 'Novo Cadastro' : formMode === 'edit' ? 'Alteração de Registro' : 'Visualização'}
              </span>
              <h2 className="text-base font-bold text-slate-800 mt-1">
                {formMode === 'create' ? 'Cadastrar Novo Usuário' : `Usuário: ${formNome} (${formLogin})`}
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

          {/* Abas do Formulário */}
          <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setActiveFormTab('identificacao')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'identificacao'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              1. Identificação
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('permissoes')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'permissoes'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              2. Permissões / Acesso
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
              3. Histórico & Auditoria
            </button>
          </div>

          <form onSubmit={handleSalvar} className="p-6 space-y-6">
            {/* ABA 1: IDENTIFICAÇÃO */}
            {activeFormTab === 'identificacao' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Código do Usuário
                  </label>
                  <input
                    type="text"
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="ex: USR-001"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="Nome completo do colaborador"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Usuário Login *
                  </label>
                  <input
                    type="text"
                    value={formLogin}
                    onChange={(e) => setFormLogin(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="login.acesso"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Senha de Acesso {formMode === 'edit' && '(deixe em branco p/ manter)'}
                  </label>
                  <input
                    type="password"
                    value={formSenha}
                    onChange={(e) => setFormSenha(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder={formMode === 'edit' ? '••••••••' : 'Mínimo 6 dígitos'}
                    required={formMode === 'create'}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    CPF
                  </label>
                  <input
                    type="text"
                    value={formCpf}
                    onChange={(e) => setFormCpf(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="000.000.000-00"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    E-mail Institucional
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="usuario@hospital.gov.br"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Perfil de Acesso *
                  </label>
                  <select
                    value={formPerfil}
                    onChange={(e) => setFormPerfil(e.target.value as PerfilUsuario)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  >
                    <option value="requisitante">Requisitante (Pedidos para seu Centro de Custo)</option>
                    <option value="almoxarife">Almoxarife (Análise, Baixas e Empréstimos)</option>
                    <option value="admin">Administrador (Controle Irrestrito e Cadastros)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Centro de Custo Solicitante {formPerfil === 'requisitante' && '*'}
                    </label>
                    {isAdmin && onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('centros-custo')}
                        className="text-[10px] font-bold text-teal-700 hover:text-teal-900 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Cadastrar novo centro de custo</span>
                      </button>
                    )}
                  </div>
                  {centrosCusto.length > 0 ? (
                    <select
                      value={formCcId}
                      onChange={(e) => setFormCcId(e.target.value ? Number(e.target.value) : '')}
                      disabled={formMode === 'view'}
                      className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                    >
                      <option value="">(Selecione o Centro de Custo)</option>
                      {centrosCusto.map((cc) => (
                        <option key={cc.id} value={cc.id}>
                          {cc.codigo} - {cc.nome}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2.5 rounded bg-amber-50 border border-amber-300 text-amber-900 text-xs">
                      <span>Nenhum Centro de Custo cadastrado. </span>
                      {isAdmin && onNavigate ? (
                        <button
                          type="button"
                          onClick={() => onNavigate('centros-custo')}
                          className="font-bold underline text-teal-800 hover:text-teal-950 cursor-pointer ml-1"
                        >
                          Cadastre ao menos um Centro de Custo para começar
                        </button>
                      ) : (
                        <span>Cadastre ao menos um Centro de Custo para começar.</span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Unidade / Almoxarifado
                  </label>
                  <select
                    value={formEmpresaId}
                    onChange={(e) => setFormEmpresaId(Number(e.target.value))}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  >
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.codigo} - {u.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Status do Usuário
                  </label>
                  <select
                    value={formAtivo}
                    onChange={(e) => setFormAtivo(Number(e.target.value))}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  >
                    <option value={1}>Ativo (Liberado)</option>
                    <option value={0}>Inativo (Bloqueado)</option>
                  </select>
                </div>
              </div>
            )}

            {/* ABA 2: PERMISSÕES / ACESSO */}
            {activeFormTab === 'permissoes' && (
              <div className="space-y-4 max-w-2xl">
                <div className="p-3 bg-teal-50 rounded border border-teal-200 text-xs text-teal-800 font-medium">
                  As permissões abaixo refletem as capacidades operacionais do perfil selecionado ({formPerfil.toUpperCase()}).
                </div>

                <div className="space-y-2.5">
                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={permissoes.cadastrar_produtos || ['admin', 'almoxarife'].includes(formPerfil)}
                      disabled={formMode === 'view' || formPerfil !== 'admin'}
                      onChange={(e) => setPermissoes({ ...permissoes, cadastrar_produtos: e.target.checked })}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Cadastro e Manutenção de Produtos / Insumos</div>
                      <div className="text-[11px] text-slate-500">Permite criar e alterar descrições, estoques mínimos e unidades de medida.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={permissoes.analisar_requisicoes || ['admin', 'almoxarife'].includes(formPerfil)}
                      disabled={formMode === 'view' || formPerfil !== 'admin'}
                      onChange={(e) => setPermissoes({ ...permissoes, analisar_requisicoes: e.target.checked })}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Aprovação e Atendimento de Requisições</div>
                      <div className="text-[11px] text-slate-500">Permite conferir saldo em estoque, aprovar baixas e rejeitar pedidos com parecer.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={permissoes.liberar_emprestimos || ['admin', 'almoxarife'].includes(formPerfil)}
                      disabled={formMode === 'view' || formPerfil !== 'admin'}
                      onChange={(e) => setPermissoes({ ...permissoes, liberar_emprestimos: e.target.checked })}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Liberação de Empréstimos e Registro de Devoluções</div>
                      <div className="text-[11px] text-slate-500">Permite assinar cautelas de ferramentas e receber devoluções recompondo o saldo.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={permissoes.emitir_relatorios}
                      disabled={formMode === 'view'}
                      onChange={(e) => setPermissoes({ ...permissoes, emitir_relatorios: e.target.checked })}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Emissão e Exportação de Relatórios Gerenciais</div>
                      <div className="text-[11px] text-slate-500">Permite visualizar posição de estoque, consumo de centro de custo e imprimir demonstrativos.</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded cursor-pointer hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={permissoes.estornar_movimentacoes || formPerfil === 'admin'}
                      disabled={formMode === 'view' || formPerfil !== 'admin'}
                      onChange={(e) => setPermissoes({ ...permissoes, estornar_movimentacoes: e.target.checked })}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Autorização de Estornos e Ajustes Compensatórios (Auditoria)</div>
                      <div className="text-[11px] text-slate-500">Ação restrita a administradores gerais para reversão auditada de lançamentos fiscais.</div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* ABA 3: HISTÓRICO & AUDITORIA */}
            {activeFormTab === 'historico' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>Data de Criação do Usuário</span>
                  </div>
                  <div className="text-xs text-slate-600 font-mono">{formHistoricoCriacao}</div>
                  <p className="text-[11px] text-slate-400">Gravado automaticamente no SQLite na inserção do registro.</p>
                </div>

                <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <UserCheck className="w-4 h-4 text-slate-500" />
                    <span>Último Acesso Registrado</span>
                  </div>
                  <div className="text-xs text-slate-600 font-mono">{formHistoricoAcesso}</div>
                  <p className="text-[11px] text-slate-400">Atualizado dinamicamente em cada autenticação bem-sucedida.</p>
                </div>
              </div>
            )}

            {/* Rodapé do Formulário: Botões SALVAR e VOLTAR */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <div>
                {formMode === 'edit' && isAdmin && editingUserId && editingUserId !== currentUser?.id && formLogin !== 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = usuarios.find((usr) => usr.id === editingUserId);
                      if (target) setDeletingUser(target);
                    }}
                    disabled={isProcessing}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all uppercase tracking-wide cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>EXCLUIR USUÁRIO</span>
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
      ) : null}

      {/* =========================================================================
          SEÇÃO 2: TELA DE CONSULTA DE USUÁRIO (FILTROS + BOTÕES)
         ========================================================================= */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        {/* Linha 1 de Filtros: Código | Nome | Usuário Login */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Código
            </label>
            <input
              type="text"
              value={filtroCodigo}
              onChange={(e) => { setFiltroCodigo(e.target.value); setCurrentPage(1); }}
              placeholder="Pesquisar por código..."
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Nome
            </label>
            <input
              type="text"
              value={filtroNome}
              onChange={(e) => { setFiltroNome(e.target.value); setCurrentPage(1); }}
              placeholder="Pesquisar por nome do colaborador..."
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Usuário Login
            </label>
            <input
              type="text"
              value={filtroLogin}
              onChange={(e) => { setFiltroLogin(e.target.value); setCurrentPage(1); }}
              placeholder="Pesquisar por login..."
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>
        </div>

        {/* Linha 2 de Filtros: CPF | E-mail | Ativo (Dropdown SIM/NÃO/TODOS) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              CPF
            </label>
            <input
              type="text"
              value={filtroCpf}
              onChange={(e) => { setFiltroCpf(e.target.value); setCurrentPage(1); }}
              placeholder="Pesquisar por CPF..."
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              E-mail
            </label>
            <input
              type="text"
              value={filtroEmail}
              onChange={(e) => { setFiltroEmail(e.target.value); setCurrentPage(1); }}
              placeholder="Pesquisar por e-mail..."
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Ativo
            </label>
            <select
              value={filtroAtivo}
              onChange={(e) => { setFiltroAtivo(e.target.value as any); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
            >
              <option value="todos">TODOS</option>
              <option value="1">SIM (Ativo)</option>
              <option value="0">NÃO (Inativo)</option>
            </select>
          </div>
        </div>

        {/* Botões: + NOVO e PESQUISAR */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
          {isAdmin && (
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

      {/* =========================================================================
          SEÇÃO 3: GRID DE RESULTADOS (ZEBRADA) + PAGINAÇÃO
         ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Nome</th>
                <th className="py-2.5 px-3">Usuário Login</th>
                <th className="py-2.5 px-3">CPF</th>
                <th className="py-2.5 px-3">E-mail</th>
                <th className="py-2.5 px-3 text-center">Perfil</th>
                <th className="py-2.5 px-3">Centro de Custo</th>
                <th className="py-2.5 px-3 text-center">Ativo</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map((u) => (
                  <tr key={u.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/40 transition-colors">
                    <td className="py-2 px-3 font-mono font-semibold text-slate-700">
                      {u.codigo || `USR-${String(u.id).padStart(4, '0')}`}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-800">{u.nome}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{u.login}</td>
                    <td className="py-2 px-3 text-slate-600">{u.cpf || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{u.email || '-'}</td>
                    <td className="py-2 px-3 text-center">{getPerfilBadge(u.perfil)}</td>
                    <td className="py-2 px-3 text-slate-600">{u.centro_custo_nome || 'Geral / Almoxarifado'}</td>
                    <td className="py-2 px-3 text-center">
                      {u.ativo ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>SIM</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded text-[10px] border border-slate-200">
                          <XCircle className="w-3 h-3" />
                          <span>NÃO</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleVisualizar(u)}
                          className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                          title="Visualizar usuário"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEditar(u)}
                              className="p-1.5 rounded hover:bg-teal-100 text-teal-700 transition-colors cursor-pointer"
                              title="Editar usuário"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingUser(u)}
                              className="p-1.5 rounded hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                              title="Excluir usuário"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Nenhum usuário encontrado para os critérios pesquisados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé: Contador à esquerda e Paginação à direita */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            <strong>{filteredUsers.length}</strong> registro(s) encontrado(s)
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
              title="Primeira página"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
              title="Página anterior"
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
              title="Próxima página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
              title="Última página"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={!!deletingUser}
        title="Excluir Usuário do Sistema"
        entityCode={deletingUser?.codigo || (deletingUser ? `USR-${String(deletingUser.id).padStart(4, '0')}` : undefined)}
        entityName={deletingUser ? `${deletingUser.nome} (@${deletingUser.login})` : ''}
        description="Esta ação removerá o operador do sistema. O histórico contábil e de auditoria anterior será preservado."
        isProcessing={isProcessing}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingUser(null)}
      />
    </div>
  );
};
