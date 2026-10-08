import React, { useState, useMemo } from 'react';
import {
  Building2,
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
  CheckCircle2,
  XCircle,
  Hospital,
  Activity,
  Calendar,
  Trash2
} from 'lucide-react';
import type { CentroCusto, Usuario, EmpresaUnidade } from '../types/index.ts';
import { useToast } from '../context/ToastContext.tsx';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';

interface CentrosCustoViewProps {
  centrosCusto: CentroCusto[];
  unidades?: EmpresaUnidade[];
  currentUser: Usuario | null;
  onRefresh: () => void;
  onVoltar?: () => void;
}

export const CentrosCustoView: React.FC<CentrosCustoViewProps> = ({
  centrosCusto,
  unidades = [],
  currentUser,
  onRefresh,
  onVoltar,
}) => {
  // Filtros de busca
  const [filtroCodigo, setFiltroCodigo] = useState('');
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroDepto, setFiltroDepto] = useState('');
  const [filtroResp, setFiltroResp] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | '1' | '0'>('todos');

  // Estado do Formulário em Abas
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [activeFormTab, setActiveFormTab] = useState<'geral' | 'unidade' | 'consumo'>('geral');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Campos do Formulário
  const [formCodigo, setFormCodigo] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formDepartamento, setFormDepartamento] = useState('');
  const [formResponsavel, setFormResponsavel] = useState('');
  const [formEmpresaId, setFormEmpresaId] = useState<number>(1);
  const [formAtivo, setFormAtivo] = useState<number>(1);
  const [formCriadoEm, setFormCriadoEm] = useState('');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingCentro, setDeletingCentro] = useState<CentroCusto | null>(null);

  const { toast } = useToast();
  const isAdmin = currentUser?.perfil === 'admin';

  // Filtragem dos registros
  const filteredCentros = useMemo(() => {
    return centrosCusto.filter((cc) => {
      if (filtroCodigo && !cc.codigo.toLowerCase().includes(filtroCodigo.toLowerCase())) return false;
      if (filtroNome && !cc.nome.toLowerCase().includes(filtroNome.toLowerCase())) return false;
      if (filtroDepto && !cc.departamento.toLowerCase().includes(filtroDepto.toLowerCase())) return false;
      if (filtroResp && !cc.responsavel.toLowerCase().includes(filtroResp.toLowerCase())) return false;
      if (filtroAtivo !== 'todos') {
        const val = filtroAtivo === '1' ? 1 : 0;
        if (cc.ativo !== val) return false;
      }
      return true;
    });
  }, [centrosCusto, filtroCodigo, filtroNome, filtroDepto, filtroResp, filtroAtivo]);

  const totalPages = Math.ceil(filteredCentros.length / pageSize) || 1;
  const paginatedCentros = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCentros.slice(start, start + pageSize);
  }, [filteredCentros, currentPage, pageSize]);

  const handleNovo = () => {
    setFormMode('create');
    setEditingId(null);
    setFormCodigo(`CC-SET-0${centrosCusto.length + 1}`);
    setFormNome('');
    setFormDepartamento('');
    setFormResponsavel('');
    setFormEmpresaId(unidades[0]?.id || 1);
    setFormAtivo(1);
    setFormCriadoEm(new Date().toLocaleString('pt-BR'));
    setActiveFormTab('geral');
    setErrorMsg(null);
    setIsFormOpen(true);
  };

  const handleEditar = (cc: CentroCusto) => {
    setFormMode('edit');
    setEditingId(cc.id);
    setFormCodigo(cc.codigo);
    setFormNome(cc.nome);
    setFormDepartamento(cc.departamento);
    setFormResponsavel(cc.responsavel);
    setFormEmpresaId(cc.empresa_id || 1);
    setFormAtivo(cc.ativo);
    setFormCriadoEm(cc.criado_em ? new Date(cc.criado_em).toLocaleString('pt-BR') : '29/09/2026');
    setActiveFormTab('geral');
    setErrorMsg(null);
    setIsFormOpen(true);
  };

  const handleVisualizar = (cc: CentroCusto) => {
    handleEditar(cc);
    setFormMode('view');
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formMode === 'view') {
      setIsFormOpen(false);
      return;
    }

    if (!formCodigo || !formNome || !formDepartamento || !formResponsavel) {
      const msg = 'Código, nome, departamento e responsável são obrigatórios.';
      setErrorMsg(msg);
      toast.error('Campos Obrigatórios', msg);
      setActiveFormTab('geral');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const payload = {
        codigo: formCodigo.trim().toUpperCase(),
        nome: formNome.trim(),
        departamento: formDepartamento.trim(),
        responsavel: formResponsavel.trim(),
        empresa_id: formEmpresaId || 1,
        ativo: formAtivo,
      };

      const url = formMode === 'create' ? '/api/centros-custo' : `/api/centros-custo/${editingId}`;
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
        throw new Error(data.error || 'Erro ao salvar Centro de Custo.');
      }

      if (formMode === 'create') {
        toast.success(
          'Centro de Custo Cadastrado',
          `O setor "${payload.codigo} - ${payload.nome}" foi criado com sucesso.`
        );
      } else {
        toast.success(
          'Centro de Custo Atualizado',
          `Os dados do setor "${payload.codigo} - ${payload.nome}" foram atualizados.`
        );
      }

      setIsFormOpen(false);
      onRefresh();
    } catch (err: any) {
      const msg = err.message || 'Erro ao processar requisição.';
      setErrorMsg(msg);
      toast.error(
        formMode === 'create' ? 'Erro ao Criar Centro de Custo' : 'Erro ao Editar Centro de Custo',
        msg
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCentro) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/centros-custo/${deletingCentro.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `user:${currentUser?.id}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao excluir Centro de Custo.');
      }

      toast.success(
        'Centro de Custo Excluído',
        data.message || `O setor "${deletingCentro.codigo} - ${deletingCentro.nome}" foi excluído.`
      );
      if (editingId === deletingCentro.id) {
        setIsFormOpen(false);
      }
      setDeletingCentro(null);
      onRefresh();
    } catch (err: any) {
      toast.error('Erro ao Excluir Centro de Custo', err.message || 'Falha ao excluir registro.');
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
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Consulta de Centro de Custo</h1>
            <p className="text-xs text-slate-500">Unidades solicitantes, enfermarias, centros cirúrgicos e UTIs</p>
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

      {/* Formulário em Abas (se aberto) */}
      {isFormOpen && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden animate-fadeIn">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 px-2 py-0.5 rounded">
                {formMode === 'create' ? 'Novo Cadastro' : formMode === 'edit' ? 'Alteração' : 'Visualização'}
              </span>
              <h2 className="text-base font-bold text-slate-800 mt-1">
                {formMode === 'create' ? 'Cadastrar Novo Centro de Custo' : `Centro de Custo: ${formNome} (${formCodigo})`}
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
              onClick={() => setActiveFormTab('geral')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'geral'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              1. Dados Gerais
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('unidade')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'unidade'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              2. Unidade Hospitalar
            </button>

            <button
              type="button"
              onClick={() => setActiveFormTab('consumo')}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeFormTab === 'consumo'
                  ? 'border-teal-600 text-teal-700 bg-white rounded-t'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              3. Consumo & Histórico
            </button>
          </div>

          <form onSubmit={handleSalvar} className="p-6 space-y-6">
            {activeFormTab === 'geral' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Código do Centro de Custo *
                  </label>
                  <input
                    type="text"
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 font-mono focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="ex: CC-UTI-01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Nome do Setor / Unidade *
                  </label>
                  <input
                    type="text"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="ex: UTI Geral Adulto"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Departamento Superior *
                  </label>
                  <input
                    type="text"
                    value={formDepartamento}
                    onChange={(e) => setFormDepartamento(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="ex: Terapia Intensiva"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Responsável Clínico / Chefe do Setor *
                  </label>
                  <input
                    type="text"
                    value={formResponsavel}
                    onChange={(e) => setFormResponsavel(e.target.value)}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
                    placeholder="ex: Dr. Fernando Peixoto"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Situação Cadastral
                  </label>
                  <select
                    value={formAtivo}
                    onChange={(e) => setFormAtivo(Number(e.target.value))}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  >
                    <option value={1}>Ativo (Apto para Requisições)</option>
                    <option value={0}>Inativo (Bloqueado)</option>
                  </select>
                </div>
              </div>
            )}

            {activeFormTab === 'unidade' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Unidade Hospitalar Vinculada
                  </label>
                  <select
                    value={formEmpresaId}
                    onChange={(e) => setFormEmpresaId(Number(e.target.value))}
                    disabled={formMode === 'view'}
                    className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner cursor-pointer"
                  >
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.codigo} - {u.nome} ({u.cidade} - {u.uf})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    As requisições e dispensações para este Centro de Custo serão debitadas do almoxarifado desta unidade.
                  </p>
                </div>
              </div>
            )}

            {activeFormTab === 'consumo' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Cadastro no Sistema</span>
                  </div>
                  <div className="text-xs font-mono text-slate-600">{formCriadoEm}</div>
                </div>

                <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-teal-600" />
                    <span>Perfil de Consumo</span>
                  </div>
                  <div className="text-xs text-slate-600">Apto a solicitar materiais de farmácia e cirúrgicos</div>
                </div>
              </div>
            )}

            {/* Rodapé: SALVAR e VOLTAR */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <div>
                {formMode === 'edit' && isAdmin && editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = centrosCusto.find((c) => c.id === editingId);
                      if (target) setDeletingCentro(target);
                    }}
                    disabled={isProcessing}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all uppercase tracking-wide cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>EXCLUIR SETOR</span>
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

      {/* Filtros e Tabela de Consulta */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Código
            </label>
            <input
              type="text"
              value={filtroCodigo}
              onChange={(e) => { setFiltroCodigo(e.target.value); setCurrentPage(1); }}
              placeholder="ex: CC-UTI-01"
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Nome do Setor
            </label>
            <input
              type="text"
              value={filtroNome}
              onChange={(e) => { setFiltroNome(e.target.value); setCurrentPage(1); }}
              placeholder="ex: UTI Geral"
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Departamento
            </label>
            <input
              type="text"
              value={filtroDepto}
              onChange={(e) => { setFiltroDepto(e.target.value); setCurrentPage(1); }}
              placeholder="ex: Terapia Intensiva"
              className="w-full px-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:bg-white focus:border-teal-500 shadow-inner"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Responsável
            </label>
            <input
              type="text"
              value={filtroResp}
              onChange={(e) => { setFiltroResp(e.target.value); setCurrentPage(1); }}
              placeholder="Pesquisar por responsável..."
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

      {/* Tabela de Resultados Zebrada */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Código</th>
                <th className="py-2.5 px-3">Nome do Centro de Custo</th>
                <th className="py-2.5 px-3">Departamento</th>
                <th className="py-2.5 px-3">Responsável</th>
                <th className="py-2.5 px-3">Unidade</th>
                <th className="py-2.5 px-3 text-center">Ativo</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedCentros.length > 0 ? (
                paginatedCentros.map((cc) => (
                  <tr key={cc.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/40 transition-colors">
                    <td className="py-2 px-3 font-mono font-semibold text-slate-700">{cc.codigo}</td>
                    <td className="py-2 px-3 font-medium text-slate-800">{cc.nome}</td>
                    <td className="py-2 px-3 text-slate-600">{cc.departamento}</td>
                    <td className="py-2 px-3 text-slate-600">{cc.responsavel}</td>
                    <td className="py-2 px-3 text-slate-600">{cc.empresa_nome || 'Almoxarifado Central'}</td>
                    <td className="py-2 px-3 text-center">
                      {cc.ativo ? (
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
                          onClick={() => handleVisualizar(cc)}
                          className="p-1.5 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEditar(cc)}
                              className="p-1.5 rounded hover:bg-teal-100 text-teal-700 transition-colors cursor-pointer"
                              title="Editar Centro de Custo"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingCentro(cc)}
                              className="p-1.5 rounded hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                              title="Excluir Centro de Custo"
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
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Nenhum Centro de Custo localizado para os filtros informados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé: Contador e Paginação */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            <strong>{filteredCentros.length}</strong> registro(s) encontrado(s)
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
        isOpen={!!deletingCentro}
        title="Excluir Centro de Custo"
        entityCode={deletingCentro?.codigo}
        entityName={deletingCentro?.nome || ''}
        description="Esta ação removerá o Centro de Custo do cadastro, desde que não existam requisições pendentes ou empréstimos ativos vinculados ao setor."
        isProcessing={isProcessing}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingCentro(null)}
      />
    </div>
  );
};
