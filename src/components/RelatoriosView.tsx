import React, { useState } from 'react';
import {
  FileBarChart,
  Search,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Package,
  ArrowLeftRight,
  ClipboardList,
  RotateCcw,
  Printer,
  Download,
  FileText,
  X,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ConsumoMensalChart } from './ConsumoMensalChart.tsx';
import type { CentroCusto, Produto, Movimentacao, EmpresaUnidade, Usuario } from '../types/index.ts';

interface RelatoriosViewProps {
  centrosCusto: CentroCusto[];
  produtos: Produto[];
  movimentacoes?: Movimentacao[];
  activeUnidade?: EmpresaUnidade | null;
  currentUser?: Usuario | null;
  onVoltar: () => void;
}

// Utilitário para carregar o logo em Base64 para inclusão no cabeçalho do PDF
async function loadLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch('/logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export const RelatoriosView: React.FC<RelatoriosViewProps> = ({
  centrosCusto,
  produtos,
  movimentacoes = [],
  activeUnidade,
  currentUser,
  onVoltar,
}) => {
  const [activeTab, setActiveTab] = useState<'padrao' | 'personalizados'>('padrao');
  const [searchTerm, setSearchTerm] = useState('');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    Estoque: true,
    Movimentações: true,
    Requisições: true,
    Empréstimos: true,
  });

  // Modal de Execução de Relatório
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedReportTitle, setSelectedReportTitle] = useState<string>('');
  const [reportResult, setReportResult] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null);
  const [exportingExecutivePdf, setExportingExecutivePdf] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedbackBanner({ type, message });
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  // Filtros do Modal
  const [filtroCcId, setFiltroCcId] = useState<string>('');
  const [filtroProdutoId, setFiltroProdutoId] = useState<string>('');
  const [filtroTipoProduto, setFiltroTipoProduto] = useState<string>('');

  // Categorias de Relatórios Operacionais
  const categorias = [
    {
      nome: 'Estoque',
      icone: Package,
      cor: 'text-teal-700 bg-teal-100',
      relatorios: [
        {
          id: 'posicao_atual_estoque',
          titulo: '1. Posição Atual de Estoque Físico e Financeiro',
          descricao: 'Demonstrativo completo de produtos ativos, saldo físico, localização de prateleira e valorização contábil.',
          badge: 'Físico / Financeiro',
        },
        {
          id: 'estoque_critico',
          titulo: '2. Produtos com Estoque Crítico / Abaixo do Mínimo',
          descricao: 'Alerta gerencial de itens com saldo em nível de risco para reposição urgente de compras.',
          badge: 'Ponto de Pedido',
        },
        {
          id: 'consumivel_vs_equipamentos',
          titulo: '3. Relação de Materiais Consumíveis vs Equipamentos',
          descricao: 'Classificação analítica por tipo de insumo e distribuição patrimonial no almoxarifado.',
          badge: 'Patrimonial',
        },
      ],
    },
    {
      nome: 'Movimentações',
      icone: ArrowLeftRight,
      cor: 'text-blue-700 bg-blue-100',
      relatorios: [
        {
          id: 'extrato_entradas_nf',
          titulo: '4. Extrato de Entradas por Fornecedor / Nota Fiscal',
          descricao: 'Recebimentos efetuados com número de documento, número de lote, validade e almoxarife conferente.',
          badge: 'Fiscal / NF',
        },
        {
          id: 'razao_saidas_centro_custo',
          titulo: '5. Livro Razão de Saídas por Centro de Custo',
          descricao: 'Consumo por departamento assistencial hospitalar com quantidades dispensadas.',
          badge: 'Consumo / Saídas',
        },
        {
          id: 'auditoria_estornos',
          titulo: '6. Registro de Estornos e Auditoria',
          descricao: 'Histórico de lançamentos compensatórios com justificativas técnicas exigidas por lei.',
          badge: 'Auditoria Externa',
        },
      ],
    },
    {
      nome: 'Requisições',
      icone: ClipboardList,
      cor: 'text-emerald-700 bg-emerald-100',
      relatorios: [
        {
          id: 'requisicoes_atendidas',
          titulo: '7. Requisições Atendidas por Período',
          descricao: 'Relatório consolidado de pedidos assistenciais deferidos e baixados no estoque.',
          badge: 'Atendimento',
        },
        {
          id: 'requisicoes_rejeitadas',
          titulo: '8. Requisições Rejeitadas e Motivos',
          descricao: 'Levantamento dos pedidos não autorizados com parecer obrigatório do almoxarife.',
          badge: 'Pareceres',
        },
        {
          id: 'tempo_atendimento',
          titulo: '9. Indicadores de Atendimento e Eficiência',
          descricao: 'Estatísticas de produtividade, taxa de eficiência no atendimento e pendências.',
          badge: 'KPIs Hospitalares',
        },
      ],
    },
    {
      nome: 'Empréstimos',
      icone: RotateCcw,
      cor: 'text-amber-700 bg-amber-100',
      relatorios: [
        {
          id: 'equipamentos_abertos_atrasados',
          titulo: '10. Equipamentos em Aberto e Empréstimos Atrasados',
          descricao: 'Controle de ferramentas e equipamentos cirúrgicos fora do almoxarifado e atrasos.',
          badge: 'Cautela Ativa',
        },
        {
          id: 'historico_devolucoes',
          titulo: '11. Histórico Geral de Devoluções e Conservação',
          descricao: 'Termos de retorno e conferência de integridade física dos equipamentos devolvidos.',
          badge: 'Retornos / Baixas',
        },
      ],
    },
  ];

  const toggleCategory = (nome: string) => {
    setOpenCategories((prev) => ({ ...prev, [nome]: !prev[nome] }));
  };

  const handleOpenReport = async (reportId: string, title: string) => {
    setSelectedReportId(reportId);
    setSelectedReportTitle(title);
    setReportResult(null);
    executeReport(reportId, filtroCcId, filtroProdutoId, filtroTipoProduto);
  };

  const executeReport = async (reportId: string, ccId: string, prodId: string, tipoProd: string) => {
    setLoadingReport(true);
    try {
      const res = await fetch('/api/relatorios/executar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_relatorio: reportId,
          centro_custo_id: ccId ? Number(ccId) : undefined,
          produto_id: prodId ? Number(prodId) : undefined,
          tipo_produto: tipoProd || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setReportResult(data);
      } else {
        showFeedback('error', data.error || 'Erro ao gerar relatório');
      }
    } catch (err: any) {
      showFeedback('error', 'Falha ao comunicar com o servidor: ' + err.message);
    } finally {
      setLoadingReport(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!reportResult || !reportResult.dados || reportResult.dados.length === 0) return;

    const headers = reportResult.colunas.map((c: any) => `"${c.rotulo}"`).join(';');
    const rows = reportResult.dados.map((row: any) =>
      reportResult.colunas.map((c: any) => `"${row[c.chave] ?? ''}"`).join(';')
    );
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedReportId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // =========================================================================
  // 1. EXPORTAÇÃO EM PDF DE QUALQUER RELATÓRIO INDIVIDUAL
  // =========================================================================
  const generateReportPDF = async (dataToExport: any, reportIdSlug: string) => {
    if (!dataToExport || !dataToExport.colunas) return;

    const isWide = dataToExport.colunas.length > 6;
    const doc = new jsPDF({
      orientation: isWide ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const logoBase64 = await loadLogoBase64();

    // Cabeçalho Timbrado Institucional
    doc.setFillColor(0, 35, 125); // #00237D
    doc.rect(0, 0, pageWidth, 4, 'F');

    let textStartX = 14;
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 14, 8, 16, 16);
        textStartX = 33;
      } catch {
        textStartX = 14;
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('ALMOXCONTROL', textStartX, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Controle Integrado de Almoxarifado e Farmácia Central', textStartX, 18);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 35, 125);
    doc.text('SANTA CASA DE MISERICÓRDIA DE SÃO BERNARDO DO CAMPO', textStartX, 23);

    // Metadados à direita
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const unidadeNome = activeUnidade ? `${activeUnidade.codigo} - ${activeUnidade.nome}` : 'Almoxarifado Central';
    doc.text(`Emissão: ${dataToExport.data_emissao || new Date().toLocaleString('pt-BR')}`, pageWidth - 14, 12, { align: 'right' });
    doc.text(`Unidade: ${unidadeNome}`, pageWidth - 14, 17, { align: 'right' });
    doc.text(`Total de Registros: ${dataToExport.total_registros ?? dataToExport.dados?.length ?? 0}`, pageWidth - 14, 22, { align: 'right' });

    // Linha divisória
    doc.setDrawColor(0, 35, 125);
    doc.setLineWidth(0.5);
    doc.line(14, 27, pageWidth - 14, 27);

    // Bloco de Título do Relatório
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 30, pageWidth - 28, dataToExport.resumo ? 20 : 14, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(String(dataToExport.titulo || 'Relatório Gerencial').toUpperCase(), 17, 36);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(String(dataToExport.subtitulo || ''), 17, 41);

    if (dataToExport.resumo) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 35, 125);
      const resumoLines = doc.splitTextToSize(`Parecer Consolidado: ${dataToExport.resumo}`, pageWidth - 34);
      doc.text(resumoLines[0] || '', 17, 47);
    }

    // Tabela de Dados
    const tableHeaders = [dataToExport.colunas.map((c: any) => c.rotulo)];
    const tableBody = (dataToExport.dados || []).map((row: any) =>
      dataToExport.colunas.map((c: any) => String(row[c.chave] ?? '-'))
    );

    const columnStyles: Record<number, any> = {};
    dataToExport.colunas.forEach((col: any, index: number) => {
      if (col.alinhamento === 'right') {
        columnStyles[index] = { halign: 'right' };
      } else if (col.alinhamento === 'center') {
        columnStyles[index] = { halign: 'center' };
      }
    });

    autoTable(doc, {
      startY: dataToExport.resumo ? 54 : 48,
      head: tableHeaders,
      body: tableBody.length > 0 ? tableBody : [['Nenhum registro encontrado para os filtros selecionados.']],
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: 2.2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [0, 35, 125],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles,
      margin: { left: 14, right: 14, bottom: 24 },
    });

    // Bloco de Assinaturas no final
    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    if (finalY + 28 < pageHeight - 15) {
      const sigY = finalY + 18;
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.3);
      doc.line(25, sigY, pageWidth / 2 - 15, sigY);
      doc.line(pageWidth / 2 + 15, sigY, pageWidth - 25, sigY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text('Responsável pelo Almoxarifado', (25 + (pageWidth / 2 - 15)) / 2, sigY + 4, { align: 'center' });
      doc.text('Diretoria Administrativa / Auditoria', ((pageWidth / 2 + 15) + (pageWidth - 25)) / 2, sigY + 4, { align: 'center' });
    }

    // Numeração de páginas e rodapé
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `AlmoxControl — Desenvolvido por Bruno Rocha | Emitido por: ${currentUser?.nome || 'Gestor'}`,
        14,
        pageHeight - 8
      );
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
    }

    doc.save(`${reportIdSlug}_${new Date().toISOString().slice(0, 10)}.pdf`);
    showFeedback('success', `Relatório "${dataToExport.titulo || reportIdSlug}" exportado em PDF com sucesso.`);
  };

  // Botão rápido de exportar PDF diretamente na linha do relatório
  const handleQuickExportPDF = async (reportId: string) => {
    setExportingPdfId(reportId);
    try {
      const res = await fetch('/api/relatorios/executar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_relatorio: reportId,
          centro_custo_id: filtroCcId ? Number(filtroCcId) : undefined,
          produto_id: filtroProdutoId ? Number(filtroProdutoId) : undefined,
          tipo_produto: filtroTipoProduto || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await generateReportPDF(data, reportId);
      } else {
        showFeedback('error', data.error || 'Não foi possível exportar o PDF.');
      }
    } catch (err: any) {
      showFeedback('error', 'Erro ao exportar PDF: ' + err.message);
    } finally {
      setExportingPdfId(null);
    }
  };

  // =========================================================================
  // 2. EXPORTAÇÃO EXECUTIVA CONSOLIDADA: RESUMO DO INVENTÁRIO & MOVIMENTAÇÕES
  // =========================================================================
  const handleDownloadResumoInventarioMovimentacoesPDF = async () => {
    setExportingExecutivePdf(true);
    try {
      const storedUserId = localStorage.getItem('multi_almox_user_id');
      const effectiveUserId = currentUser?.id || (storedUserId ? Number(storedUserId) : 1);
      const authHeader: Record<string, string> = { Authorization: `user:${effectiveUserId}` };

      // Busca dados atualizados em tempo real (com fallback seguro para as props)
      const [prodRes, movRes] = await Promise.all([
        fetch('/api/produtos?apenas_ativos=false', { headers: authHeader }).catch(() => null),
        fetch('/api/movimentacoes?limite=250', { headers: authHeader }).catch(() => null),
      ]);

      const listaProdutos: Produto[] = prodRes && prodRes.ok ? await prodRes.json() : produtos;
      const listaMovimentacoes: Movimentacao[] = movRes && movRes.ok ? await movRes.json() : movimentacoes;

      const produtosAtivos = listaProdutos.filter((p) => p.ativo !== 0);
      const produtosCriticos = produtosAtivos.filter((p) => p.quantidade_atual <= p.estoque_minimo);
      const valorTotalInventario = produtosAtivos.reduce(
        (acc, p) => acc + Number(p.quantidade_atual || 0) * Number(p.valor_unitario ?? 0),
        0
      );

      const totalEntradas = listaMovimentacoes.filter((m) => m.tipo === 'entrada').length;
      const totalSaidas = listaMovimentacoes.filter((m) => m.tipo === 'saida').length;
      const totalEstornos = listaMovimentacoes.filter(
        (m) => m.tipo === 'estorno_entrada' || m.tipo === 'estorno_saida'
      ).length;

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const logoBase64 = await loadLogoBase64();

      // Barra Institucional Superior
      doc.setFillColor(0, 35, 125); // #00237D
      doc.rect(0, 0, pageWidth, 4, 'F');

      let textStartX = 14;
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, 'PNG', 14, 8, 16, 16);
          textStartX = 33;
        } catch {
          textStartX = 14;
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('ALMOXCONTROL — RELATÓRIO EXECUTIVO DE GESTÃO', textStartX, 13);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('Resumo Consolidado do Inventário Físico/Financeiro e Histórico de Movimentações', textStartX, 18);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 35, 125);
      doc.text('SANTA CASA DE MISERICÓRDIA DE SÃO BERNARDO DO CAMPO', textStartX, 23);

      // Metadados à direita
      const dataHoraAtual = new Date().toLocaleString('pt-BR');
      const unidadeNome = activeUnidade ? `${activeUnidade.codigo} - ${activeUnidade.nome}` : 'Almoxarifado Central';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Data/Hora de Emissão: ${dataHoraAtual}`, pageWidth - 14, 12, { align: 'right' });
      doc.text(`Unidade: ${unidadeNome}`, pageWidth - 14, 17, { align: 'right' });
      doc.text(`Emitido por: ${currentUser?.nome || 'Gestor do Almoxarifado'}`, pageWidth - 14, 22, { align: 'right' });

      doc.setDrawColor(0, 35, 125);
      doc.setLineWidth(0.5);
      doc.line(14, 27, pageWidth - 14, 27);

      // Quadro de Indicadores Executivos (4 KPIs)
      const boxY = 30;
      const boxWidth = (pageWidth - 28 - 9) / 4;

      const kpiCards = [
        {
          label: 'ITENS ATIVOS NO INVENTÁRIO',
          value: `${produtosAtivos.length} produto(s)`,
          sub: `${produtosCriticos.length} em nível crítico/baixo`,
        },
        {
          label: 'VALOR TOTAL DO INVENTÁRIO',
          value: valorTotalInventario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          sub: 'Custo contábil em estoque',
        },
        {
          label: 'MOVIMENTAÇÕES (ENTRADAS / SAÍDAS)',
          value: `${totalEntradas} Entradas | ${totalSaidas} Saídas`,
          sub: `${listaMovimentacoes.length} registros auditados`,
        },
        {
          label: 'ESTORNOS / AJUSTES AUDITADOS',
          value: `${totalEstornos} lançamento(s)`,
          sub: 'Rastreabilidade integral ativa',
        },
      ];

      kpiCards.forEach((kpi, idx) => {
        const x = 14 + idx * (boxWidth + 3);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(x, boxY, boxWidth, 16, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.label, x + 3, boxY + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(0, 35, 125);
        doc.text(kpi.value, x + 3, boxY + 10.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.sub, x + 3, boxY + 14.2);
      });

      // SEÇÃO 1: RESUMO DO INVENTÁRIO FÍSICO E FINANCEIRO
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('1. RESUMO DO INVENTÁRIO DE ESTOQUE (POSIÇÃO ATUAL)', 14, 52);

      const inventarioRows = produtosAtivos.map((p) => {
        const vUnit = Number(p.valor_unitario ?? 0);
        const subtotal = Number(p.quantidade_atual || 0) * vUnit;
        const status =
          p.quantidade_atual <= 0
            ? 'ESGOTADO'
            : p.quantidade_atual <= p.estoque_minimo
            ? 'ESTOQUE BAIXO'
            : 'REGULAR';

        return [
          p.codigo,
          p.nome,
          p.tipo === 'consumivel' ? 'Consumível' : 'Equipamento',
          p.localizacao || '-',
          `${p.quantidade_atual} ${p.unidade_medida}`,
          `${p.estoque_minimo} ${p.unidade_medida}`,
          vUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          status,
        ];
      });

      autoTable(doc, {
        startY: 55,
        head: [[
          'Código',
          'Produto / Material',
          'Categoria',
          'Localização',
          'Saldo Atual',
          'Est. Mínimo',
          'Vlr. Unitário',
          'Subtotal Contábil',
          'Situação',
        ]],
        body:
          inventarioRows.length > 0
            ? inventarioRows
            : [['-', 'Nenhum produto cadastrado no inventário.', '-', '-', '0', '0', 'R$ 0,00', 'R$ 0,00', '-']],
        styles: {
          font: 'helvetica',
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [0, 35, 125],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'center', fontStyle: 'bold' },
        },
        didParseCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 8) {
            const val = String(hookData.cell.raw || '');
            if (val === 'ESGOTADO') {
              hookData.cell.styles.textColor = [194, 54, 58]; // #C2363A
            } else if (val === 'ESTOQUE BAIXO') {
              hookData.cell.styles.textColor = [180, 83, 9];
            } else {
              hookData.cell.styles.textColor = [5, 150, 105];
            }
          }
        },
        margin: { left: 14, right: 14, bottom: 20 },
      });

      // SEÇÃO 2: HISTÓRICO DE MOVIMENTAÇÕES REALIZADAS
      let nextSectionY = ((doc as any).lastAutoTable?.finalY || 110) + 10;
      if (nextSectionY > pageHeight - 45) {
        doc.addPage();
        nextSectionY = 18;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text('2. EXTRATO DAS MOVIMENTAÇÕES REALIZADAS (ENTRADAS, SAÍDAS E ESTORNOS)', 14, nextSectionY);

      const formatTipoMov = (tipo: string) => {
        switch (tipo) {
          case 'entrada':
            return 'ENTRADA (NF)';
          case 'saida':
            return 'SAÍDA / DISP.';
          case 'estorno_entrada':
            return 'ESTORNO ENTRADA';
          case 'estorno_saida':
            return 'ESTORNO SAÍDA';
          default:
            return tipo.toUpperCase();
        }
      };

      const movimentacoesRows = listaMovimentacoes.map((m) => [
        m.data_movimentacao ? new Date(m.data_movimentacao).toLocaleString('pt-BR') : '-',
        formatTipoMov(m.tipo),
        m.produto_codigo || '-',
        m.produto_nome || '-',
        `${m.quantidade} ${m.unidade_medida || ''}`.trim(),
        m.centro_custo_nome ? `${m.centro_custo_codigo || ''} - ${m.centro_custo_nome}`.trim() : 'Estoque Central',
        m.documento_referencia || m.numero_lote || '-',
        m.usuario_nome || '-',
      ]);

      autoTable(doc, {
        startY: nextSectionY + 3,
        head: [[
          'Data / Hora',
          'Tipo Operação',
          'Código',
          'Material / Insumo',
          'Quantidade',
          'Centro de Custo / Setor',
          'Doc. / NF / Lote',
          'Operador Responsável',
        ]],
        body:
          movimentacoesRows.length > 0
            ? movimentacoesRows
            : [['-', '-', '-', 'Nenhuma movimentação registrada até o momento.', '0', '-', '-', '-']],
        styles: {
          font: 'helvetica',
          fontSize: 7.2,
          cellPadding: 2,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [25, 38, 65], // #192641 (Navy Santa Casa)
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          1: { fontStyle: 'bold' },
          4: { halign: 'right', fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14, bottom: 24 },
      });

      // Assinaturas no final do documento executivo
      const finalY = (doc as any).lastAutoTable?.finalY || 140;
      if (finalY + 26 < pageHeight - 14) {
        const sigY = finalY + 16;
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.3);
        doc.line(30, sigY, pageWidth / 2 - 20, sigY);
        doc.line(pageWidth / 2 + 20, sigY, pageWidth - 30, sigY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text('Coordenação de Almoxarifado e Suprimentos', (30 + (pageWidth / 2 - 20)) / 2, sigY + 4, { align: 'center' });
        doc.text('Diretoria Administrativa / Controle Interno', ((pageWidth / 2 + 20) + (pageWidth - 30)) / 2, sigY + 4, { align: 'center' });
      }

      // Rodapé e numeração de páginas
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `AlmoxControl — Resumo Executivo de Inventário e Movimentações | Desenvolvido por Bruno Rocha`,
          14,
          pageHeight - 8
        );
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
      }

      doc.save(`Resumo_Inventario_e_Movimentacoes_${new Date().toISOString().slice(0, 10)}.pdf`);
      showFeedback('success', 'Resumo executivo do inventário e das movimentações exportado em PDF com sucesso.');
    } catch (err: any) {
      showFeedback('error', 'Falha ao gerar o PDF consolidado: ' + err.message);
    } finally {
      setExportingExecutivePdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedbackBanner && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 shadow-xs transition-all ${
            feedbackBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                feedbackBanner.type === 'success' ? 'text-emerald-600' : 'text-red-600'
              }`}
            />
            <span>{feedbackBanner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="p-1 rounded hover:bg-black/5 text-current cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* =========================================================================
          BARRA DE FERRAMENTAS SUPERIOR: Título, Busca, Exportação PDF e VOLTAR
         ========================================================================= */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="p-2.5 bg-teal-100 text-teal-800 rounded-lg">
            <FileBarChart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Relatórios Gerenciais</h1>
            <p className="text-xs text-slate-500">
              Demonstrativos contábeis, extratos de movimentações e exportação oficial em PDF
            </p>
          </div>
        </div>

        {/* Busca, Botão de PDF Consolidado e Botão VOLTAR */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
          <div className="relative w-full sm:w-60">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar relatório..."
              className="w-full pl-9 pr-3 py-2 bg-[#f1f3f5] border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white transition-all shadow-inner"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <button
            type="button"
            onClick={handleDownloadResumoInventarioMovimentacoesPDF}
            disabled={exportingExecutivePdf}
            title="Baixar PDF completo com o resumo do inventário físico/financeiro e histórico de movimentações"
            className="bg-[#C2363A] hover:bg-[#a62b2f] disabled:opacity-60 text-white font-semibold px-3.5 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>
              {exportingExecutivePdf
                ? 'GERANDO PDF...'
                : 'BAIXAR PDF: INVENTÁRIO & MOVIMENTAÇÕES'}
            </span>
          </button>

          <button
            type="button"
            onClick={onVoltar}
            className="bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>VOLTAR</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          PAINEL DE EXPORTAÇÃO RÁPIDA EM PDF PARA GESTORES
         ========================================================================= */}
      <div className="bg-gradient-to-r from-[#00237D] via-[#102456] to-[#192641] rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6EC1E4]">
            <FileText className="w-4 h-4" />
            <span>Exportação Direta para Gestores e Auditoria</span>
          </div>
          <h2 className="text-base font-bold text-white">
            Resumo Consolidado do Inventário e Movimentações em PDF
          </h2>
          <p className="text-xs text-blue-100/80 max-w-2xl">
            Gera instantaneamente um documento oficial timbrado em PDF contendo os indicadores de estoque, a posição física/financeira completa de todos os itens e o extrato auditado das movimentações realizadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleQuickExportPDF('posicao_atual_estoque')}
            disabled={exportingPdfId === 'posicao_atual_estoque'}
            className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#6EC1E4]" />
            <span>
              {exportingPdfId === 'posicao_atual_estoque' ? 'Exportando...' : 'PDF Só Inventário'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDownloadResumoInventarioMovimentacoesPDF}
            disabled={exportingExecutivePdf}
            className="px-4 py-2 rounded-lg bg-white text-[#00237D] hover:bg-blue-50 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#C2363A]" />
            <span>
              {exportingExecutivePdf ? 'Gerando Arquivo PDF...' : 'Baixar Resumo Completo (PDF)'}
            </span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          GRÁFICO DE LINHAS (RECHARTS): HISTÓRICO DE CONSUMO MENSAL POR CENTRO DE CUSTO
         ========================================================================= */}
      <ConsumoMensalChart
        centrosCusto={centrosCusto}
        produtos={produtos}
        movimentacoes={movimentacoes}
      />

      {/* =========================================================================
          ABAS DE SELEÇÃO: Relatórios Padrão / Personalizados
         ========================================================================= */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('padrao')}
          className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'padrao'
              ? 'border-teal-600 text-teal-700 bg-teal-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Relatórios Padrão (11 Modelos)
        </button>
        <button
          onClick={() => setActiveTab('personalizados')}
          className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'personalizados'
              ? 'border-teal-600 text-teal-700 bg-teal-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Relatórios Personalizados & Filtros Avançados
        </button>
      </div>

      {/* =========================================================================
          LISTA EM ACORDEÃO AGRUPADA POR CATEGORIAS (ESTOQUE, MOVIMENTAÇÕES, ETC.)
         ========================================================================= */}
      {activeTab === 'padrao' ? (
        <div className="space-y-4">
          {categorias.map((cat) => {
            const Icon = cat.icone;
            const isOpen = openCategories[cat.nome] ?? true;

            // Filtro por termo de busca
            const relatoriosFiltrados = cat.relatorios.filter((r) =>
              r.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
              r.descricao.toLowerCase().includes(searchTerm.toLowerCase())
            );

            if (relatoriosFiltrados.length === 0 && searchTerm) return null;

            return (
              <div key={cat.nome} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Cabeçalho do Acordeão */}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.nome)}
                  className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between border-b border-slate-200 transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${cat.cor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 tracking-wide">{cat.nome}</h3>
                      <p className="text-[11px] text-slate-500">Módulo de {cat.nome.toLowerCase()} hospitalar</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600">
                      {relatoriosFiltrados.length} relatório(s)
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </button>

                {/* Lista de Relatórios da Categoria */}
                {isOpen && (
                  <div className="divide-y divide-slate-100">
                    {relatoriosFiltrados.map((rel) => (
                      <div
                        key={rel.id}
                        className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-teal-50/40 transition-colors group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 group-hover:text-teal-800 transition-colors">
                              {rel.titulo}
                            </span>
                            <span className="text-slate-300" aria-hidden="true">·</span>
                            <span className="text-[11px] font-medium text-slate-500">
                              {rel.badge}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                            {rel.descricao}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleQuickExportPDF(rel.id)}
                            disabled={exportingPdfId === rel.id}
                            title="Baixar este relatório diretamente em PDF"
                            className="px-3 py-2 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-[#00237D] font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5 text-[#C2363A]" />
                            <span>{exportingPdfId === rel.id ? 'PDF...' : 'BAIXAR PDF'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenReport(rel.id, rel.titulo)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer"
                          >
                            <span>EMITIR RELATÓRIO</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Aba de Relatórios Personalizados */
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-800">Construtor de Relatório Customizado</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Selecione os parâmetros e cruzamentos de dados desejados para visualização ou download em PDF.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#f8f9fa] border border-slate-200 rounded-lg">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Tipo de Relatório Base
              </label>
              <select
                value={selectedReportId || 'posicao_atual_estoque'}
                onChange={(e) => {
                  setSelectedReportId(e.target.value);
                  const found = categorias.flatMap((c) => c.relatorios).find((r) => r.id === e.target.value);
                  if (found) setSelectedReportTitle(found.titulo);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-teal-500"
              >
                {categorias.flatMap((c) => c.relatorios).map((r) => (
                  <option key={r.id} value={r.id}>{r.titulo}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Centro de Custo
              </label>
              <select
                value={filtroCcId}
                onChange={(e) => setFiltroCcId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-teal-500"
              >
                <option value="">(Todos os Centros de Custo)</option>
                {centrosCusto.map((cc) => (
                  <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Categoria de Produto
              </label>
              <select
                value={filtroTipoProduto}
                onChange={(e) => setFiltroTipoProduto(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-teal-500"
              >
                <option value="">(Todos os Tipos)</option>
                <option value="consumivel">Apenas Consumíveis (Medicamentos / Insumos)</option>
                <option value="nao_consumivel">Apenas Equipamentos / Ferramentas</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => handleQuickExportPDF(selectedReportId || 'posicao_atual_estoque')}
              disabled={exportingPdfId !== null}
              className="px-4 py-2.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#C2363A]" />
              <span>BAIXAR RELATÓRIO FILTRADO (PDF)</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenReport(selectedReportId || 'posicao_atual_estoque', selectedReportTitle || 'Posição de Estoque')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-2.5 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer"
            >
              <FileBarChart className="w-4 h-4" />
              <span>VISUALIZAR RELATÓRIO PERSONALIZADO</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL DE VISUALIZAÇÃO / IMPRESSÃO / EXPORTAÇÃO DE RELATÓRIO
         ========================================================================= */}
      {selectedReportId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Cabeçalho do Modal */}
            <div className="px-6 py-4 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                  Emissão Oficial · AlmoxControl
                </span>
                <h2 className="text-base font-bold text-slate-800 mt-0.5">{selectedReportTitle}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => reportResult && generateReportPDF(reportResult, selectedReportId)}
                  disabled={!reportResult || loadingReport}
                  className="px-3.5 py-1.5 bg-[#00237D] hover:bg-[#001c66] disabled:opacity-50 text-white text-xs font-semibold rounded flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  title="Baixar este relatório em formato PDF"
                >
                  <Download className="w-4 h-4 text-[#6EC1E4]" />
                  <span>BAIXAR PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Imprimir documento"
                >
                  <Printer className="w-4 h-4 text-teal-700" />
                  <span>IMPRIMIR</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Exportar dados para Excel / CSV"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span>EXPORTAR CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedReportId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conteúdo do Relatório em Papel Timbrado AlmoxControl */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
              {loadingReport ? (
                <div className="py-20 text-center">
                  <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-xs text-slate-600 font-medium">Processando dados e saldos em tempo real...</p>
                </div>
              ) : reportResult ? (
                <div className="bg-white p-8 rounded-lg border border-slate-200 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
                  {/* Cabeçalho Timbrado */}
                  <div className="border-b-2 border-[#00237D] pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 p-1 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <img src="/logo.png" alt="Logo Santa Casa SBC" className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">ALMOXCONTROL</h3>
                        <p className="text-xs text-slate-500 font-medium">Controle Integrado de Almoxarifado e Farmácia Central</p>
                        <p className="text-[11px] text-[#00237D] font-bold uppercase tracking-wider mt-0.5">
                          Santa Casa de Misericórdia de São Bernardo do Campo
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-500 space-y-0.5">
                      <div><strong>Data de Emissão:</strong> {reportResult.data_emissao}</div>
                      <div><strong>Unidade:</strong> {activeUnidade ? `${activeUnidade.codigo} - ${activeUnidade.nome}` : 'Almoxarifado Central'}</div>
                      <div><strong>Total de Registros:</strong> {reportResult.total_registros}</div>
                    </div>
                  </div>

                  {/* Título do Relatório */}
                  <div className="bg-slate-100 p-3 rounded border border-slate-200">
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{reportResult.titulo}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{reportResult.subtitulo}</p>
                    {reportResult.resumo && (
                      <p className="text-xs text-teal-800 font-medium mt-2 pt-2 border-t border-slate-200">
                        <strong>Parecer Consolidado:</strong> {reportResult.resumo}
                      </p>
                    )}
                  </div>

                  {/* Tabela Zebrada */}
                  <div className="overflow-x-auto border border-slate-200 rounded">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          {reportResult.colunas.map((col: any) => (
                            <th
                              key={col.chave}
                              className={`py-2.5 px-3 ${
                                col.alinhamento === 'right'
                                  ? 'text-right'
                                  : col.alinhamento === 'center'
                                  ? 'text-center'
                                  : 'text-left'
                              }`}
                            >
                              {col.rotulo}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {reportResult.dados.map((row: any, idx: number) => (
                          <tr key={idx} className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/40">
                            {reportResult.colunas.map((col: any) => (
                              <td
                                key={col.chave}
                                className={`py-2 px-3 ${
                                  col.alinhamento === 'right'
                                    ? 'text-right font-mono'
                                    : col.alinhamento === 'center'
                                    ? 'text-center'
                                    : 'text-left'
                                }`}
                              >
                                {row[col.chave] ?? '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Rodapé de Assinaturas e Autenticação */}
                  <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
                    <div className="border-t border-slate-400 pt-2">
                      <p className="font-semibold text-slate-700">Responsável pelo Almoxarifado</p>
                      <p className="text-[10px]">Conferente / Farmacêutico</p>
                    </div>
                    <div className="border-t border-slate-400 pt-2">
                      <p className="font-semibold text-slate-700">Diretoria Administrativa / Auditoria</p>
                      <p className="text-[10px]">Controle Interno e Conformidade</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Rodapé do Modal com Botão VOLTAR */}
            <div className="px-6 py-3 bg-white border-t border-slate-200 flex justify-between items-center">
              <button
                type="button"
                onClick={() => reportResult && generateReportPDF(reportResult, selectedReportId)}
                disabled={!reportResult || loadingReport}
                className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-50 text-[#00237D] font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-[#C2363A]" />
                <span>BAIXAR ARQUIVO PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedReportId(null)}
                className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-5 py-2 rounded text-xs flex items-center gap-1.5 transition-all shadow uppercase tracking-wide cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>FECHAR E VOLTAR</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
