import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatNumber } from './constants';

// Types
interface TakeoffItem {
  id: string;
  category: string;
  description: string;
  spec: string | null;
  unit: string;
  quantity: number;
  waste_percent: number | null;
  adjusted_qty: number | null;
  unit_cost: number | null;
  extended_cost: number | null;
  draft: boolean | null;
}

interface LaborLineItem {
  id: string;
  task_name: string;
  quantity: number;
  unit: string;
  base_rate: number;
  modifier_multiplier: number;
  final_rate: number | null;
  extended: number | null;
}

interface LaborEstimate {
  id: string;
  subcontractor_name: string | null;
  total: number | null;
  labor_line_items: LaborLineItem[];
}

interface RFI {
  id: string;
  question: string;
  answer: string | null;
  status: string | null;
  trade: string | null;
}

interface Assumption {
  id: string;
  statement: string;
  is_exclusion: boolean | null;
  trade: string | null;
}

interface ChecklistItem {
  id: string;
  item: string;
  status: string | null;
  trade: string;
}

interface Project {
  name: string;
  address: string | null;
  tax_percent: number | null;
  labor_burden_percent: number | null;
  markup_percent: number | null;
}

interface ExportData {
  project: Project;
  takeoffItems: TakeoffItem[];
  laborEstimates: LaborEstimate[];
  rfis: RFI[];
  assumptions: Assumption[];
  checklistItems: ChecklistItem[];
  includeDrafts?: boolean;
}

// CSV Export Functions
function arrayToCSV(data: Record<string, unknown>[], headers: string[]): string {
  const headerRow = headers.join(',');
  const rows = data.map(row => 
    headers.map(header => {
      const val = row[header];
      // Escape quotes and wrap in quotes if contains comma or quote
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  return [headerRow, ...rows].join('\n');
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportTakeoffCSV(items: TakeoffItem[], projectName: string, includeDrafts: boolean) {
  const filtered = includeDrafts ? items : items.filter(i => !i.draft);
  const data = filtered.map(item => ({
    Category: item.category,
    Description: item.description,
    Spec: item.spec || '',
    Unit: item.unit,
    Quantity: item.quantity,
    'Waste %': item.waste_percent || 0,
    'Adjusted Qty': item.adjusted_qty || item.quantity,
    'Unit Cost': item.unit_cost || 0,
    'Extended Cost': item.extended_cost || 0,
    Draft: item.draft ? 'Yes' : 'No',
  }));
  
  const csv = arrayToCSV(data, Object.keys(data[0] || {}));
  downloadCSV(csv, `${projectName.replace(/\s+/g, '_')}_takeoff.csv`);
}

export function exportLaborCSV(estimates: LaborEstimate[], projectName: string) {
  const allItems = estimates.flatMap(est => 
    (est.labor_line_items || []).map(item => ({
      Task: item.task_name,
      Quantity: item.quantity,
      Unit: item.unit,
      'Base Rate': item.base_rate,
      Modifier: item.modifier_multiplier,
      'Final Rate': item.final_rate || 0,
      Extended: item.extended || 0,
    }))
  );
  
  if (allItems.length === 0) return;
  
  const csv = arrayToCSV(allItems, Object.keys(allItems[0]));
  downloadCSV(csv, `${projectName.replace(/\s+/g, '_')}_labor.csv`);
}

export function exportRFIsCSV(rfis: RFI[], projectName: string) {
  const data = rfis.map(rfi => ({
    Question: rfi.question,
    Answer: rfi.answer || '',
    Status: rfi.status || 'open',
    Trade: rfi.trade || '',
  }));
  
  if (data.length === 0) return;
  
  const csv = arrayToCSV(data, Object.keys(data[0]));
  downloadCSV(csv, `${projectName.replace(/\s+/g, '_')}_rfis.csv`);
}

export function exportAssumptionsCSV(assumptions: Assumption[], projectName: string) {
  const data = assumptions.map(a => ({
    Statement: a.statement,
    Type: a.is_exclusion ? 'Exclusion' : 'Assumption',
    Trade: a.trade || '',
  }));
  
  if (data.length === 0) return;
  
  const csv = arrayToCSV(data, Object.keys(data[0]));
  downloadCSV(csv, `${projectName.replace(/\s+/g, '_')}_assumptions.csv`);
}

export function exportChecklistCSV(items: ChecklistItem[], projectName: string) {
  const data = items.map(item => ({
    Item: item.item,
    Status: item.status || 'pending',
    Trade: item.trade,
  }));
  
  if (data.length === 0) return;
  
  const csv = arrayToCSV(data, Object.keys(data[0]));
  downloadCSV(csv, `${projectName.replace(/\s+/g, '_')}_checklist.csv`);
}

// PDF Export Function
export function exportProjectPDF(data: ExportData) {
  const { project, takeoffItems, laborEstimates, rfis, assumptions, checklistItems, includeDrafts } = data;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let yPos = 20;
  
  // Filter items
  const filteredTakeoff = includeDrafts ? takeoffItems : takeoffItems.filter(i => !i.draft);
  
  // Calculate totals
  const materialSubtotal = filteredTakeoff.reduce((sum, item) => sum + (Number(item.extended_cost) || 0), 0);
  const materialTax = materialSubtotal * ((project.tax_percent || 0) / 100);
  const materialsTotal = materialSubtotal + materialTax;
  
  const laborSubtotal = laborEstimates.reduce((sum, est) => sum + (Number(est.total) || 0), 0);
  const laborBurden = laborSubtotal * ((project.labor_burden_percent || 0) / 100);
  const laborTotal = laborSubtotal + laborBurden;
  
  const projectSubtotal = materialsTotal + laborTotal;
  const markupAmount = projectSubtotal * ((project.markup_percent || 0) / 100);
  const totalWithMarkup = projectSubtotal + markupAmount;
  const finalBidPrice = Math.round(totalWithMarkup / 100) * 100;
  
  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(project.name, pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;
  
  if (project.address) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(project.address, pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
  }
  
  doc.setFontSize(10);
  doc.text(`Estimate Date: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;
  
  // Cost Summary Box
  doc.setFillColor(240, 240, 240);
  doc.rect(14, yPos - 4, pageWidth - 28, 40, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.rect(14, yPos - 4, pageWidth - 28, 40, 'S');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('COST SUMMARY', 20, yPos + 4);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryData = [
    ['Materials Total:', formatCurrency(materialsTotal)],
    ['Labor Total:', formatCurrency(laborTotal)],
    ['Project Subtotal:', formatCurrency(projectSubtotal)],
    [`Markup (${project.markup_percent || 0}%):`, formatCurrency(markupAmount)],
  ];
  
  let summaryY = yPos + 12;
  summaryData.forEach(([label, value]) => {
    doc.text(label, 20, summaryY);
    doc.text(value, 100, summaryY);
    summaryY += 6;
  });
  
  // Final Bid (prominent)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('FINAL BID:', 140, yPos + 15);
  doc.setFontSize(16);
  doc.text(formatCurrency(finalBidPrice), 140, yPos + 25);
  
  yPos += 50;
  
  // Materials Table (grouped by category)
  if (filteredTakeoff.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('MATERIAL TAKEOFF', 14, yPos);
    yPos += 5;
    
    const itemsByCategory = filteredTakeoff.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, TakeoffItem[]>);
    
    const tableData: (string | number)[][] = [];
    Object.entries(itemsByCategory)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([category, items]) => {
        // Category header row
        tableData.push([{ content: category, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } } as unknown as string]);
        
        items.forEach(item => {
          tableData.push([
            item.description,
            formatNumber(item.quantity),
            item.unit,
            formatCurrency(item.unit_cost || 0),
            formatCurrency(item.extended_cost || 0),
          ]);
        });
        
        const categoryTotal = items.reduce((sum, item) => sum + (Number(item.extended_cost) || 0), 0);
        tableData.push([
          { content: `${category} Subtotal`, colSpan: 4, styles: { fontStyle: 'italic', halign: 'right' } } as unknown as string,
          formatCurrency(categoryTotal),
        ]);
      });
    
    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Qty', 'Unit', 'Unit Cost', 'Extended']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [60, 60, 60] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { halign: 'right', cellWidth: 20 },
        2: { halign: 'center', cellWidth: 15 },
        3: { halign: 'right', cellWidth: 25 },
        4: { halign: 'right', cellWidth: 30 },
      },
    });
    
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }
  
  // Labor Table
  const allLaborItems = laborEstimates.flatMap(est => est.labor_line_items || []);
  if (allLaborItems.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('LABOR PAY SHEET', 14, yPos);
    yPos += 5;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Task', 'Qty', 'Unit', 'Base Rate', 'Modifier', 'Adj Rate', 'Extended']],
      body: allLaborItems.map(item => [
        item.task_name,
        formatNumber(item.quantity),
        item.unit,
        formatCurrency(item.base_rate),
        `x${item.modifier_multiplier.toFixed(2)}`,
        formatCurrency(item.final_rate || 0),
        formatCurrency(item.extended || 0),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [60, 60, 60] },
      styles: { fontSize: 8 },
    });
    
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }
  
  // RFIs
  const openRfis = rfis.filter(r => r.status === 'open');
  if (openRfis.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('OPEN REQUESTS FOR INFORMATION (RFIs)', 14, yPos);
    yPos += 5;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Question', 'Trade', 'Status']],
      body: openRfis.map(rfi => [rfi.question, rfi.trade || '-', rfi.status || 'open']),
      theme: 'striped',
      headStyles: { fillColor: [60, 60, 60] },
      styles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 120 } },
    });
    
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }
  
  // Assumptions & Exclusions
  if (assumptions.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    const assumptionsList = assumptions.filter(a => !a.is_exclusion);
    const exclusionsList = assumptions.filter(a => a.is_exclusion);
    
    if (assumptionsList.length > 0) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('ASSUMPTIONS', 14, yPos);
      yPos += 5;
      
      autoTable(doc, {
        startY: yPos,
        head: [['Assumption', 'Trade']],
        body: assumptionsList.map(a => [a.statement, a.trade || '-']),
        theme: 'striped',
        headStyles: { fillColor: [60, 60, 60] },
        styles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 140 } },
      });
      
      yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    }
    
    if (exclusionsList.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('EXCLUSIONS', 14, yPos);
      yPos += 5;
      
      autoTable(doc, {
        startY: yPos,
        head: [['Exclusion', 'Trade']],
        body: exclusionsList.map(a => [a.statement, a.trade || '-']),
        theme: 'striped',
        headStyles: { fillColor: [60, 60, 60] },
        styles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 140 } },
      });
    }
  }
  
  // Save PDF
  doc.save(`${project.name.replace(/\s+/g, '_')}_Estimate.pdf`);
}
