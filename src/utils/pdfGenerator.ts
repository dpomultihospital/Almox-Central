import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  Movimentacao,
  Requisicao,
  ItemRequisicao,
  HistoricoRequisicao,
  Emprestimo,
  Usuario,
  EmpresaUnidade,
} from '../types/index.ts';

export type PdfOutputMode = 'download' | 'print';

export interface PdfGeneratedDocument {
  blobUrl: string;
  filename: string;
  title: string;
  doc: jsPDF;
}

// Carrega o logotipo institucional em Base64 para inclusão no cabeçalho do PDF
export async function loadLogoBase64(): Promise<string | null> {
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

// Aciona impressão direta de um documento jsPDF via iframe oculto ou download
export function finalizeJsPDF(
  doc: jsPDF,
  filename: string,
  title: string,
  mode: PdfOutputMode
): PdfGeneratedDocument {
  if (mode === 'print') {
    doc.autoPrint();
  }

  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  if (mode === 'download') {
    doc.save(filename);
  } else {
    triggerDirectIframePrint(blobUrl);
  }

  return {
    blobUrl,
    filename,
    title,
    doc,
  };
}

export function triggerDirectIframePrint(blobUrl: string) {
  try {
    const existing = document.getElementById('jspdf-direct-print-frame') as HTMLIFrameElement | null;
    if (existing) {
      existing.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'jspdf-direct-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = '0';
    iframe.style.opacity = '0.01';
    iframe.src = blobUrl;

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          // Caso o navegador exija interação no preview modal, o modal já estará visível
        }
      }, 250);
    };

    document.body.appendChild(iframe);
  } catch (err) {
    console.error('Erro ao acionar impressão direta via iframe:', err);
  }
}

// Desenha cabeçalho institucional padrão Salutem / Santa Casa no documento jsPDF
async function drawInstitutionalHeader(
  doc: jsPDF,
  options: {
    titulo: string;
    subtitulo: string;
    protocolo?: string;
    activeUnidade?: EmpresaUnidade | null;
    currentUser?: Usuario | null;
  }
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const logoBase64 = await loadLogoBase64();

  // Faixa superior azul institucional
  doc.setFillColor(0, 35, 125);
  doc.rect(12, 10, pageWidth - 24, 24, 'F');

  let textStartX = 16;
  if (logoBase64) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(15, 12.5, 19, 19, 2, 2, 'F');
      doc.addImage(logoBase64, 'PNG', 16, 13.5, 17, 17);
      textStartX = 38;
    } catch {
      textStartX = 16;
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('IRMANDADE DA SANTA CASA DE MISERICÓRDIA DE BIRIGUI', textStartX, 17.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const nomeUnidade = options.activeUnidade
    ? `${options.activeUnidade.codigo} - ${options.activeUnidade.nome}`
    : '001 - Hospital Central - Almoxarifado Central';
  doc.text(`Unidade Operacional: ${nomeUnidade}`, textStartX, 23);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(options.titulo.toUpperCase(), textStartX, 29.5);

  // Metadados à direita no cabeçalho
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const dataEmissao = new Date().toLocaleString('pt-BR');
  doc.text(`Emissão: ${dataEmissao}`, pageWidth - 15, 17.5, { align: 'right' });
  doc.text(`Operador: ${options.currentUser?.nome || 'Administrador'}`, pageWidth - 15, 23, {
    align: 'right',
  });
  if (options.protocolo) {
    doc.setFont('helvetica', 'bold');
    doc.text(options.protocolo, pageWidth - 15, 29.5, { align: 'right' });
  }

  // Subtítulo abaixo da faixa
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.text(options.subtitulo, 12, 40);

  return 44;
}

// Desenha numeração de páginas e rodapé institucional em todas as páginas
function drawInstitutionalFooters(doc: jsPDF, codigoAutenticacao?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(12, pageHeight - 12, pageWidth - 12, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    const leftFooter = codigoAutenticacao
      ? `AlmoxControl Salutem • Autenticação: ${codigoAutenticacao} • Desenvolvido por Bruno Rocha`
      : 'AlmoxControl Salutem • Controle de Almoxarifado & Rastreabilidade Hospitalar • Desenvolvido por Bruno Rocha';
    doc.text(leftFooter, 12, pageHeight - 7.5);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 12, pageHeight - 7.5, {
      align: 'right',
    });
  }
}

// ============================================================================
// 1. COMPROVANTE INDIVIDUAL DE MOVIMENTAÇÃO DE ESTOQUE (PDF / IMPRESSÃO DIRETA)
// ============================================================================
export async function generateComprovanteMovimentacaoPDF(params: {
  mov: Movimentacao;
  currentUser?: Usuario | null;
  activeUnidade?: EmpresaUnidade | null;
  mode: PdfOutputMode;
}): Promise<PdfGeneratedDocument> {
  const { mov, currentUser, activeUnidade, mode } = params;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const tipoLabels: Record<string, string> = {
    entrada: 'ENTRADA DE ESTOQUE (RECEBIMENTO)',
    saida: 'SAÍDA / DISPENSAÇÃO AO SETOR',
    estorno_entrada: 'ESTORNO COMPENSATÓRIO DE ENTRADA',
    estorno_saida: 'ESTORNO COMPENSATÓRIO DE SAÍDA',
  };

  const tipoLabel = tipoLabels[mov.tipo] || mov.tipo.toUpperCase();
  const protocolo = `LANC-#${String(mov.id).padStart(6, '0')}`;
  const hashAuditoria = `ALM-${mov.id}-${new Date(mov.data_movimentacao || Date.now()).getTime().toString(16).toUpperCase()}`;

  let currentY = await drawInstitutionalHeader(doc, {
    titulo: 'Comprovante Oficial de Movimentação de Estoque',
    subtitulo: 'Documento auditável de registro transacional imutável do livro-caixa hospitalar',
    protocolo,
    activeUnidade,
    currentUser,
  });

  // Faixa de Destaque do Tipo de Movimento
  const isPositive = mov.tipo === 'entrada' || mov.tipo === 'estorno_saida';
  if (mov.tipo.startsWith('estorno_')) {
    doc.setFillColor(243, 232, 255);
    doc.setDrawColor(192, 132, 252);
    doc.setTextColor(107, 33, 168);
  } else if (isPositive) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(110, 231, 183);
    doc.setTextColor(6, 95, 70);
  } else {
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(147, 197, 253);
    doc.setTextColor(30, 64, 175);
  }

  doc.roundedRect(12, currentY, pageWidth - 24, 14, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`NATUREZA DA OPERAÇÃO: ${tipoLabel}`, 16, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Lançamento Nº #${mov.id}   |   Data/Hora Registro: ${mov.data_movimentacao}   |   Documento Ref.: ${mov.documento_referencia || 'S/D'}`,
    16,
    currentY + 11.5
  );

  currentY += 20;

  // Bloco 1: Dados do Material / Produto Movimentado
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('1. IDENTIFICAÇÃO DO INSUMO / MATERIAL MOVIMENTADO', 12, currentY);
  currentY += 3;

  const valorUnitario = Number(mov.valor_unitario || 0);
  const valorTotal = valorUnitario * Number(mov.quantidade || 0);
  const sinal = isPositive ? '+' : '-';

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'Código',
        'Descrição do Material / Produto',
        'UN',
        'Qtd Movimentada',
        'Lote',
        'Validade',
        'Vlr. Unitário',
        'Vlr. Total',
      ],
    ],
    body: [
      [
        mov.produto_codigo || `ID-${mov.produto_id}`,
        mov.produto_nome || 'Material do Almoxarifado',
        mov.unidade_medida || 'UN',
        `${sinal}${mov.quantidade} ${mov.unidade_medida || ''}`.trim(),
        mov.numero_lote || 'N/A',
        mov.data_validade
          ? new Date(mov.data_validade).toLocaleDateString('pt-BR')
          : 'N/A',
        valorUnitario > 0
          ? valorUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : '—',
        valorTotal > 0
          ? valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : '—',
      ],
    ],
    margin: { left: 12, right: 12 },
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [13, 148, 136],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 24 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 24 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
    },
  });

  currentY = ((doc as any).lastAutoTable?.finalY || currentY + 25) + 8;

  // Bloco 2: Origem / Destino, Operador e Rastreabilidade
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('2. ORIGEM / DESTINO, RESPONSÁVEL E OBSERVAÇÕES DE AUDITORIA', 12, currentY);
  currentY += 3;

  const setorDestino = mov.centro_custo_nome
    ? `${mov.centro_custo_codigo ? mov.centro_custo_codigo + ' - ' : ''}${mov.centro_custo_nome}`
    : 'Almoxarifado Central (Estoque Geral)';

  autoTable(doc, {
    startY: currentY,
    body: [
      ['Centro de Custo / Setor Vinculado:', setorDestino],
      ['Documento de Referência (NF / Requisição / Termo):', mov.documento_referencia || 'Não informado'],
      ['Operador Responsável pelo Registro:', `${mov.usuario_nome || currentUser?.nome || 'Operador'} (${(mov.usuario_perfil || currentUser?.perfil || 'almoxarife').toUpperCase()})`],
      ['Data e Hora Exata do Lançamento:', String(mov.data_movimentacao)],
      ['Observações / Histórico / Justificativa:', mov.observacao || 'Lançamento regular conferido fisicamente no almoxarifado.'],
      ['Código Único de Verificação Contábil:', hashAuditoria],
    ],
    margin: { left: 12, right: 12 },
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: {
        fontStyle: 'bold',
        fillColor: [248, 250, 252],
        cellWidth: 68,
        textColor: [51, 65, 85],
      },
      1: {
        cellWidth: 'auto',
      },
    },
  });

  currentY = ((doc as any).lastAutoTable?.finalY || currentY + 45) + 10;

  // Termo de Declaração
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(12, currentY, pageWidth - 24, 16, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'DECLARAÇÃO DE CONFERÊNCIA: Declaramos para fins de controle interno e auditoria hospitalar que o(s) insumo(s) descritos neste comprovante foram conferidos fisicamente quanto à especificação, quantidade, integridade de embalagem, lote e validade.',
    15,
    currentY + 6,
    { maxWidth: pageWidth - 30 }
  );

  currentY += 34;

  // Linhas de Assinatura
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(22, currentY, 92, currentY);
  doc.line(pageWidth - 92, currentY, pageWidth - 22, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(mov.usuario_nome || currentUser?.nome || 'Operador do Almoxarifado', 57, currentY + 4.5, {
    align: 'center',
  });
  doc.text('Responsável do Setor / Recebedor', pageWidth - 57, currentY + 4.5, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Conferente / Almoxarifado Central', 57, currentY + 8.5, { align: 'center' });
  doc.text(setorDestino, pageWidth - 57, currentY + 8.5, { align: 'center' });

  drawInstitutionalFooters(doc, hashAuditoria);

  const filename = `comprovante_movimentacao_${mov.id}_${Date.now()}.pdf`;
  return finalizeJsPDF(doc, filename, `Comprovante de Movimentação #${mov.id}`, mode);
}

// ============================================================================
// 2. RELATÓRIO / EXTRATO DE MOVIMENTAÇÕES DA TELA (LIVRO-CAIXA OU ENTRADAS NF)
// ============================================================================
export async function generateRelatorioMovimentacoesTelaPDF(params: {
  movimentacoes: Movimentacao[];
  titulo?: string;
  subtitulo?: string;
  filtroDescricao?: string;
  currentUser?: Usuario | null;
  activeUnidade?: EmpresaUnidade | null;
  mode: PdfOutputMode;
}): Promise<PdfGeneratedDocument> {
  const {
    movimentacoes,
    titulo = 'Extrato do Livro-Caixa de Movimentações de Estoque',
    subtitulo = 'Relatório auditável gerado diretamente a partir dos dados filtrados em tela',
    filtroDescricao = 'Todos os lançamentos visíveis na tela',
    currentUser,
    activeUnidade,
    mode,
  } = params;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = await drawInstitutionalHeader(doc, {
    titulo,
    subtitulo: `${subtitulo}  •  Filtro ativo: ${filtroDescricao}`,
    protocolo: `REGISTROS: ${movimentacoes.length}`,
    activeUnidade,
    currentUser,
  });

  // Indicadores Rápidos (KPIs da listagem em tela)
  const totalEntradas = movimentacoes.filter((m) => m.tipo === 'entrada').length;
  const qtdEntradas = movimentacoes
    .filter((m) => m.tipo === 'entrada')
    .reduce((acc, m) => acc + Number(m.quantidade || 0), 0);
  const totalSaidas = movimentacoes.filter((m) => m.tipo === 'saida').length;
  const qtdSaidas = movimentacoes
    .filter((m) => m.tipo === 'saida')
    .reduce((acc, m) => acc + Number(m.quantidade || 0), 0);
  const totalEstornos = movimentacoes.filter((m) => m.tipo.startsWith('estorno_')).length;

  const kpiCards = [
    { label: 'TOTAL DE LANÇAMENTOS', value: `${movimentacoes.length} registro(s)` },
    { label: 'ENTRADAS NO PERÍODO', value: `${totalEntradas} op. (+${qtdEntradas} un)` },
    { label: 'SAÍDAS / DISPENSAÇÕES', value: `${totalSaidas} op. (-${qtdSaidas} un)` },
    { label: 'ESTORNOS AUDITADOS', value: `${totalEstornos} lançamento(s)` },
  ];

  const gap = 4;
  const cardWidth = (pageWidth - 24 - gap * 3) / 4;
  kpiCards.forEach((card, idx) => {
    const x = 12 + idx * (cardWidth + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x, currentY, cardWidth, 13, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + 3, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(card.value, x + 3, currentY + 10.5);
  });

  currentY += 17;

  const bodyRows = movimentacoes.map((m) => {
    const isPositive = m.tipo === 'entrada' || m.tipo === 'estorno_saida';
    const sinal = isPositive ? '+' : '-';
    return [
      `#${m.id}`,
      String(m.data_movimentacao || ''),
      m.tipo.replace('_', ' ').toUpperCase(),
      `${m.produto_codigo || ''} - ${m.produto_nome || ''}`,
      `${sinal}${m.quantidade} ${m.unidade_medida || ''}`.trim(),
      m.centro_custo_nome
        ? `${m.centro_custo_codigo ? m.centro_custo_codigo + ' - ' : ''}${m.centro_custo_nome}`
        : 'Almoxarifado Central',
      m.documento_referencia || '—',
      m.usuario_nome || '—',
      m.observacao || '—',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        '# ID',
        'Data / Hora',
        'Tipo',
        'Código / Produto',
        'Qtd',
        'Centro de Custo / Destino',
        'Doc. Ref.',
        'Operador',
        'Observações',
      ],
    ],
    body:
      bodyRows.length > 0
        ? bodyRows
        : [['—', '—', '—', 'Nenhuma movimentação encontrada para os filtros atuais', '0', '—', '—', '—', '—']],
    margin: { left: 12, right: 12, bottom: 18 },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [13, 148, 136],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 14, fontStyle: 'bold' },
      1: { cellWidth: 28 },
      2: { cellWidth: 26, fontStyle: 'bold' },
      3: { cellWidth: 55 },
      4: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 42 },
      6: { cellWidth: 24 },
      7: { cellWidth: 28 },
    },
  });

  drawInstitutionalFooters(doc);

  const filename = `relatorio_movimentacoes_${Date.now()}.pdf`;
  return finalizeJsPDF(doc, filename, titulo, mode);
}

// ============================================================================
// 3. GUIA DE REQUISIÇÃO, COMPROVANTE DE DISPENSAÇÃO E LOG DE AUDITORIA (PDF)
// ============================================================================
export async function generateComprovanteRequisicaoPDF(params: {
  requisicao: Requisicao;
  itens?: ItemRequisicao[];
  historico?: HistoricoRequisicao[];
  currentUser?: Usuario | null;
  activeUnidade?: EmpresaUnidade | null;
  mode: PdfOutputMode;
}): Promise<PdfGeneratedDocument> {
  const { requisicao, itens = [], historico = [], currentUser, activeUnidade, mode } = params;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const statusMap: Record<string, string> = {
    pendente: 'PENDENTE (EM ANÁLISE)',
    aprovada_atendida: 'APROVADA E ATENDIDA (BAIXA EFETUADA)',
    rejeitada: 'REJEITADA COM PARECER TÉCNICO',
    cancelada: 'CANCELADA',
  };

  let currentY = await drawInstitutionalHeader(doc, {
    titulo: `Guia de Requisição & Auditoria — ${requisicao.numero_requisicao}`,
    subtitulo: 'Comprovante de solicitação, conferência individual de itens e trilha de auditoria',
    protocolo: requisicao.numero_requisicao,
    activeUnidade,
    currentUser,
  });

  // Quadro Resumo da Requisição
  autoTable(doc, {
    startY: currentY,
    body: [
      [
        'Nº da Requisição:',
        requisicao.numero_requisicao,
        'Prioridade:',
        requisicao.prioridade === 'urgente' ? 'URGENTE (ALTA PRIORIDADE)' : 'Normal (Rotina)',
      ],
      [
        'Centro de Custo:',
        `${requisicao.centro_custo_codigo ? requisicao.centro_custo_codigo + ' - ' : ''}${requisicao.centro_custo_nome || ''}`,
        'Status Atual:',
        statusMap[requisicao.status] || requisicao.status.toUpperCase(),
      ],
      [
        'Solicitante:',
        requisicao.solicitante_nome || '—',
        'Data Solicitação:',
        new Date(requisicao.data_solicitacao).toLocaleString('pt-BR'),
      ],
      [
        'Almoxarife Analista:',
        requisicao.almoxarife_nome || 'Aguardando Análise',
        'Data Atendimento:',
        requisicao.data_atendimento
          ? new Date(requisicao.data_atendimento).toLocaleString('pt-BR')
          : '—',
      ],
    ],
    margin: { left: 12, right: 12 },
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 34 },
      1: { cellWidth: 62 },
      2: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 34 },
      3: { fontStyle: 'bold', cellWidth: 56 },
    },
  });

  currentY = ((doc as any).lastAutoTable?.finalY || currentY + 30) + 6;

  if (requisicao.observacao || requisicao.motivo_rejeicao) {
    autoTable(doc, {
      startY: currentY,
      body: [
        ...(requisicao.observacao
          ? [['Observação da Solicitação:', requisicao.observacao]]
          : []),
        ...(requisicao.motivo_rejeicao
          ? [['Parecer / Justificativa Técnica:', requisicao.motivo_rejeicao]]
          : []),
      ],
      margin: { left: 12, right: 12 },
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 48 },
      },
    });
    currentY = ((doc as any).lastAutoTable?.finalY || currentY + 12) + 6;
  }

  // Tabela de Itens da Requisição
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('1. ITENS SOLICITADOS E DECISÃO DE AUDITORIA POR ITEM', 12, currentY);
  currentY += 2.5;

  const itemRows = itens.map((it) => {
    const statusItem = (
      it.status_item ||
      (requisicao.status === 'aprovada_atendida'
        ? 'aprovado'
        : requisicao.status === 'rejeitada'
        ? 'negado'
        : 'pendente')
    ).toUpperCase();

    return [
      `${it.produto_codigo || ''} - ${it.produto_nome || ''}`,
      it.unidade_medida || 'UN',
      String(it.quantidade_solicitada),
      String(it.quantidade_atendida ?? 0),
      statusItem,
      it.analisado_por_nome || requisicao.almoxarife_nome || '—',
      it.motivo_decisao || '—',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'Código / Produto',
        'UN',
        'Qtd Solic.',
        'Qtd Atend.',
        'Decisão',
        'Auditado Por',
        'Parecer / Justificativa do Item',
      ],
    ],
    body:
      itemRows.length > 0
        ? itemRows
        : [['Nenhum item carregado', '—', '0', '0', '—', '—', '—']],
    margin: { left: 12, right: 12 },
    styles: { fontSize: 7.5, cellPadding: 2.2 },
    headStyles: { fillColor: [13, 148, 136], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      1: { halign: 'center', cellWidth: 12 },
      2: { halign: 'right', cellWidth: 18 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 18 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      5: { cellWidth: 30 },
    },
  });

  currentY = ((doc as any).lastAutoTable?.finalY || currentY + 25) + 7;

  // Tabela do Log de Histórico se disponível
  if (historico.length > 0) {
    if (currentY > 220) {
      doc.addPage();
      currentY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('2. LOG CRONOLÓGICO DE HISTÓRICO E AUDITORIA DE ALTERAÇÕES', 12, currentY);
    currentY += 2.5;

    const histRows = historico.map((ev) => [
      new Date(ev.data_registro).toLocaleString('pt-BR'),
      ev.acao.replace(/_/g, ' ').toUpperCase(),
      `${ev.usuario_nome} (@${ev.usuario_login})`,
      ev.detalhes,
      ev.justificativa || '—',
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Data / Hora', 'Evento', 'Operador', 'Detalhes da Alteração', 'Parecer / Justificativa']],
      body: histRows,
      margin: { left: 12, right: 12, bottom: 25 },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [0, 35, 125], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 28, fontStyle: 'bold' },
        2: { cellWidth: 34 },
      },
    });

    currentY = ((doc as any).lastAutoTable?.finalY || currentY + 25) + 18;
  } else {
    currentY += 14;
  }

  // Assinaturas
  if (currentY > 265) {
    doc.addPage();
    currentY = 40;
  }

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(20, currentY, 90, currentY);
  doc.line(pageWidth - 90, currentY, pageWidth - 20, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(requisicao.solicitante_nome || 'Solicitante do Setor', 55, currentY + 4.5, { align: 'center' });
  doc.text(requisicao.almoxarife_nome || 'Almoxarifado Central', pageWidth - 55, currentY + 4.5, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Assinatura do Solicitante / Recebedor', 55, currentY + 8.5, { align: 'center' });
  doc.text('Conferência e Baixa — Almoxarifado', pageWidth - 55, currentY + 8.5, { align: 'center' });

  drawInstitutionalFooters(doc, requisicao.numero_requisicao);

  const filename = `comprovante_${requisicao.numero_requisicao.toLowerCase()}_${Date.now()}.pdf`;
  return finalizeJsPDF(doc, filename, `Guia ${requisicao.numero_requisicao}`, mode);
}

// ============================================================================
// 4. TERMO DE CAUTELA E COMPROVANTE DE EMPRÉSTIMO / DEVOLUÇÃO (PDF)
// ============================================================================
export async function generateComprovanteEmprestimoPDF(params: {
  emprestimo: Emprestimo;
  currentUser?: Usuario | null;
  activeUnidade?: EmpresaUnidade | null;
  mode: PdfOutputMode;
}): Promise<PdfGeneratedDocument> {
  const { emprestimo, currentUser, activeUnidade, mode } = params;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const codigoTermo = emprestimo.codigo_emprestimo || `EMP-${String(emprestimo.id).padStart(4, '0')}`;

  let currentY = await drawInstitutionalHeader(doc, {
    titulo: `Termo de Cautela e Empréstimo Patrimonial — ${codigoTermo}`,
    subtitulo: 'Comprovante de responsabilidade, retirada e devolução de equipamento não consumível',
    protocolo: codigoTermo,
    activeUnidade,
    currentUser,
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Dados do Termo de Cautela e Equipamento Patrimonial', 'Informação Registrada']],
    body: [
      ['Número do Termo de Cautela:', codigoTermo],
      ['Equipamento / Patrimônio:', `${emprestimo.produto_codigo || ''} - ${emprestimo.produto_nome || ''}`],
      ['Quantidade Cautelada:', `${emprestimo.quantidade} ${emprestimo.unidade_medida || 'UN'}`],
      ['Centro de Custo Destino:', `${emprestimo.centro_custo_codigo || ''} ${emprestimo.centro_custo_nome || ''}`.trim()],
      ['Profissional Responsável (Solicitante):', emprestimo.solicitante_nome || '—'],
      ['Almoxarife Responsável pela Liberação:', emprestimo.almoxarife_liberacao_nome || currentUser?.nome || 'Almoxarifado Central'],
      ['Data de Saída / Empréstimo:', new Date(emprestimo.data_emprestimo).toLocaleString('pt-BR')],
      ['Prazo Limite para Devolução:', new Date(emprestimo.data_prevista_devolucao).toLocaleDateString('pt-BR')],
      ['Situação Atual do Termo:', emprestimo.status.toUpperCase()],
      ['Estado de Conservação na Saída:', emprestimo.condicao_saida || 'Em perfeito estado de uso e funcionamento'],
      ['Data de Devolução Efetiva:', emprestimo.data_devolucao ? new Date(emprestimo.data_devolucao).toLocaleString('pt-BR') : 'Pendente (Equipamento em posse do setor)'],
      ['Estado de Conservação na Devolução:', emprestimo.condicao_devolucao || '—'],
      ['Observações Técnicas:', emprestimo.observacao || '—'],
    ],
    margin: { left: 12, right: 12 },
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 41, 59] },
    headStyles: { fillColor: [13, 148, 136], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 68 },
    },
  });

  currentY = ((doc as any).lastAutoTable?.finalY || currentY + 80) + 10;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(12, currentY, pageWidth - 24, 18, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'TERMO DE RESPONSABILIDADE: O profissional solicitante declara receber o equipamento acima identificado em perfeitas condições de uso, comprometendo-se a zelar pela sua integridade e efetuar a devolução ao Almoxarifado Central até a data prevista.',
    15,
    currentY + 6,
    { maxWidth: pageWidth - 30 }
  );

  currentY += 36;

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.line(20, currentY, 90, currentY);
  doc.line(pageWidth - 90, currentY, pageWidth - 20, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(emprestimo.solicitante_nome || 'Responsável pela Retirada', 55, currentY + 4.5, {
    align: 'center',
  });
  doc.text(
    emprestimo.almoxarife_liberacao_nome || currentUser?.nome || 'Almoxarifado Central',
    pageWidth - 55,
    currentY + 4.5,
    { align: 'center' }
  );

  drawInstitutionalFooters(doc, codigoTermo);

  const filename = `termo_cautela_${codigoTermo.toLowerCase()}_${Date.now()}.pdf`;
  return finalizeJsPDF(doc, filename, `Termo de Cautela ${codigoTermo}`, mode);
}
