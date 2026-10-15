import React, { useState } from 'react';
import { 
  Building2, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  LogIn, 
  ShieldCheck, 
  Package, 
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { EmpresaUnidade, Usuario } from '../types/index.ts';

interface LoginViewProps {
  unidades: EmpresaUnidade[];
  onLoginSuccess: (user: Usuario, unidadeId: number) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  unidades,
  onLoginSuccess,
}) => {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [unidadeId, setUnidadeId] = useState<number>(unidades[0]?.id || 1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login || !senha) {
      setErrorMsg('Por favor, informe seu usuário e senha.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: login.trim(),
          senha,
          empresa_id: unidadeId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao autenticar.');
      }

      onLoginSuccess(data.user, unidadeId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f8f9fa] font-sans text-slate-800">
      {/* =========================================================================
          COLUNA ESQUERDA: Boas-vindas com visual limpo e ondas estilizadas
         ========================================================================= */}
      <div className="lg:w-7/12 relative flex flex-col justify-between bg-white px-8 py-10 lg:px-16 lg:py-16 overflow-hidden border-r border-slate-200">
        {/* Topo: Logo & Identidade AlmoxControl */}
        <div className="z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-md border border-slate-200/80 flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="Logo Santa Casa SBC" className="w-full h-full object-contain filter drop-shadow-xs" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-[#00237D]">ALMOXCONTROL</span>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-red-50 text-[#C2363A] px-2 py-0.5 rounded-full border border-red-200">
                  Gestão & Estoque
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium tracking-wide">
                Sistema Integrado de Almoxarifado & Farmácia Central
              </p>
            </div>
          </div>
        </div>

        {/* Centro: Mensagem de Boas-vindas */}
        <div className="my-12 lg:my-auto z-10 max-w-xl">
          <h1 className="text-4xl lg:text-5xl font-black text-slate-800 tracking-tight leading-tight">
            Bem-vindo ao <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00237D] via-[#1e3f9a] to-[#C2363A]">
              AlmoxControl
            </span>
          </h1>
          <p className="mt-4 text-base text-slate-600 leading-relaxed font-normal">
            Sistema integrado e independente de controle de suprimentos com fluxo rigoroso de requisição, 
            aprovação operacional, baixa automática em tempo real e rastreabilidade de materiais e equipamentos.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-blue-50/70 border border-blue-100">
              <CheckCircle2 className="w-5 h-5 text-[#00237D] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-[#00237D] uppercase tracking-wide">Fluxo de Requisições</h4>
                <p className="text-xs text-slate-600 mt-0.5">Requisição de insumos por Centro de Custo com análise do almoxarife.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-red-50/60 border border-red-100">
              <ShieldCheck className="w-5 h-5 text-[#C2363A] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-[#C2363A] uppercase tracking-wide">Saldo Seguro (ACID)</h4>
                <p className="text-xs text-slate-600 mt-0.5">Integridade transacional no SQLite, proibindo saldo negativo.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé da coluna esquerda: Ondas decorativas em tons azul/navy (SVG) */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none opacity-90">
          <svg
            className="w-full h-32 lg:h-44 text-[#00237D]/8"
            viewBox="0 0 1440 320"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            <path
              fill="currentColor"
              d="M0,96L48,112C96,128,192,160,288,181.3C384,203,480,213,576,192C672,171,768,117,864,112C960,107,1056,149,1152,165.3C1248,181,1344,171,1392,165.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            />
          </svg>
          <svg
            className="w-full h-24 lg:h-36 -mt-20 text-[#00237D]/12"
            viewBox="0 0 1440 320"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            <path
              fill="currentColor"
              d="M0,192L48,186.7C96,181,192,171,288,144C384,117,480,75,576,85.3C672,96,768,160,864,181.3C960,203,1056,181,1152,154.7C1248,128,1344,96,1392,80L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            />
          </svg>
        </div>
      </div>

      {/* =========================================================================
          COLUNA DIREITA: Formulário de Login
         ========================================================================= */}
      <div className="lg:w-5/12 flex flex-col justify-center px-8 py-12 lg:px-14 bg-[#f8f9fa] z-10">
        <div className="max-w-md w-full mx-auto">
          {/* Cabeçalho do Card de Login */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
              Acesso ao Sistema
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Informe suas credenciais e a Unidade/Almoxarifado de atuação.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-3.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campo Usuário */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Usuário
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-10 pr-3 py-2.5 bg-[#f1f3f5] border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-inner"
                  required
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Sua senha de acesso"
                  className="w-full pl-10 pr-10 py-2.5 bg-[#f1f3f5] border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-inner"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Campo Empresa / Unidade / Almoxarifado */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Empresa / Unidade / Almoxarifado
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Building2 className="w-4 h-4" />
                </div>
                <select
                  value={unidadeId}
                  onChange={(e) => setUnidadeId(Number(e.target.value))}
                  className="w-full pl-10 pr-8 py-2.5 bg-[#f1f3f5] border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-inner appearance-none cursor-pointer"
                >
                  {unidades && unidades.length > 0 ? (
                    unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.codigo} - {u.nome} ({u.cidade || 'Central'})
                      </option>
                    ))
                  ) : (
                    <option value={1}>ALM-01 - Almoxarifado Central Hospitalar</option>
                  )}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                  <span className="text-xs">▼</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Permite operar com rastreabilidade na unidade selecionada.
              </p>
            </div>

            {/* Link Esqueci minha senha */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => alert('Para redefinição de senha, solicite ao administrador do sistema ou utilize o acesso rápido abaixo.')}
                className="text-xs text-teal-700 hover:text-teal-800 hover:underline font-medium"
              >
                Esqueci minha senha
              </button>
            </div>

            {/* Botão LOGAR */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-[#00237D] hover:bg-[#001c66] active:bg-[#00144d] text-white font-bold py-3 px-4 rounded-lg text-sm tracking-wider uppercase transition-all shadow-md shadow-blue-950/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Autenticando...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>LOGAR</span>
                </>
              )}
            </button>
          </form>

          {/* =========================================================================
              INFORMAÇÕES DE ACESSO INICIAL AO SISTEMA
             ========================================================================= */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Acesso Inicial do Administrador
              </span>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Administrador Inicial</div>
                  <div className="text-[11px] text-slate-500">Usuário: <code className="font-mono text-teal-800 font-bold bg-teal-50 px-1 rounded">admin</code> | Senha: <code className="font-mono text-teal-800 font-bold bg-teal-50 px-1 rounded">admin123</code></div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLogin('admin');
                    setSenha('admin123');
                  }}
                  className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded text-xs font-semibold transition-all cursor-pointer"
                >
                  Preencher
                </button>
              </div>
              <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-1.5">
                O sistema inicia sem dados fictícios. Após o primeiro acesso, você poderá cadastrar seus Centros de Custo, Operadores, Produtos e Movimentações.
              </p>
            </div>
          </div>

          {/* Rodapé Único */}
          <div className="mt-8 pt-4 text-center border-t border-slate-200">
            <p className="text-xs text-slate-400 font-normal">
              Desenvolvido por Bruno Rocha - DPO
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
