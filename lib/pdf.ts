import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SwissQRBill } from 'swissqrbill/svg';
import {
  formatCHF,
  type Invoice,
  type InvoiceItem,
  type Client,
  type Vehicle,
  type Garage,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from './types/database';

export interface GaragePdfInfo {
  name: string;
  address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string | null;
  vat_number: string | null;
  iban: string | null;
  logo_url: string | null;
}

function isValidIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  return /^(CH|LI)\d{19}$/.test(cleaned);
}

function isQRIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '');
  const iid = cleaned.substring(4, 9);
  const n = Number(iid);
  return n >= 30000 && n <= 31999;
}

export function generateInvoicePDF(
  invoice: Invoice,
  client: Client | null,
  vehicle: Vehicle | null,
  items: InvoiceItem[],
  garage: GaragePdfInfo | null,
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(13, 14, 20);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(garage?.name || 'FACTURE', 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let addrY = 25;
  if (garage?.address) {
    doc.text(garage.address, 14, addrY);
    addrY += 5;
  }
  if (garage?.postal_code && garage?.city) {
    doc.text(`${garage.postal_code} ${garage.city}`, 14, addrY);
    addrY += 5;
  }
  if (garage?.phone) {
    doc.text(`Tél: ${garage.phone}`, 14, addrY);
    addrY += 5;
  }
  if (garage?.email) {
    doc.text(garage.email, 14, addrY);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', pageWidth - 14, 18, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number, pageWidth - 14, 25, { align: 'right' });
  doc.text(`Date: ${new Date(invoice.issue_date).toLocaleDateString('fr-CH')}`, pageWidth - 14, 30, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Facturé à:', 14, 50);

  doc.setFont('helvetica', 'normal');
  if (client) {
    let y = 57;
    if (client.company_name) {
      doc.setFont('helvetica', 'bold');
      doc.text(client.company_name, 14, y);
      y += 6;
    }
    doc.setFont('helvetica', 'normal');
    doc.text(`${client.first_name} ${client.last_name}`, 14, y);
    y += 6;
    if (client.address) {
      doc.text(client.address, 14, y);
      y += 6;
    }
    if (client.postal_code && client.city) {
      doc.text(`${client.postal_code} ${client.city}`, 14, y);
      y += 6;
    }
    if (client.phone) {
      doc.text(`Tél: ${client.phone}`, 14, y);
    }
  }

  if (vehicle) {
    doc.setFont('helvetica', 'bold');
    doc.text('Véhicule:', pageWidth - 90, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(`${vehicle.brand} ${vehicle.model}`, pageWidth - 90, 57);
    doc.text(`Immatriculation: ${vehicle.license_plate}`, pageWidth - 90, 63);
    if (vehicle.vin) {
      doc.text(`VIN: ${vehicle.vin}`, pageWidth - 90, 69);
    }
    if (vehicle.mileage) {
      doc.text(`Kilométrage: ${vehicle.mileage.toLocaleString('fr-CH')} km`, pageWidth - 90, 75);
    }
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Échéance: ${new Date(invoice.due_date).toLocaleDateString('fr-CH')}`, 14, 85);
  doc.text(`Statut: ${INVOICE_STATUS_LABELS[invoice.status]}`, 14, 91);
  if (invoice.payment_method) {
    doc.text(`Paiement: ${PAYMENT_METHOD_LABELS[invoice.payment_method]}`, 14, 97);
  }

  autoTable(doc, {
    startY: 105,
    head: [['Description', 'Qté', 'Prix unitaire', 'Total']],
    body: items.map((item) => [
      item.description,
      item.quantity.toString(),
      formatCHF(item.unit_price),
      formatCHF(item.line_total),
    ]),
    theme: 'striped',
    headStyles: {
      fillColor: [13, 14, 20],
      fontSize: 10,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 10,
    },
    columnStyles: {
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 },
    },
    margin: { left: 14, right: 14 },
  });

  const afterTableY = (doc as any).lastAutoTable?.finalY ?? 120;
  const totalsY = afterTableY + 10;
  const totalsX = pageWidth - 80;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Sous-total:', totalsX, totalsY);
  doc.text(formatCHF(invoice.subtotal), pageWidth - 14, totalsY, { align: 'right' });

  doc.text(`TVA (${invoice.vat_rate}%):`, totalsX, totalsY + 7);
  doc.text(formatCHF(invoice.vat_amount), pageWidth - 14, totalsY + 7, { align: 'right' });

  doc.setFillColor(13, 14, 20);
  doc.roundedRect(totalsX - 4, totalsY + 10, 66, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Total CHF:', totalsX, totalsY + 18);
  doc.text(formatCHF(invoice.total), pageWidth - 14, totalsY + 18, { align: 'right' });

  if (invoice.notes) {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notes:', 14, totalsY + 35);
    const splitNotes = doc.splitTextToSize(invoice.notes, pageWidth - 28);
    doc.text(splitNotes, 14, totalsY + 41);
  }

  const hasValidIBAN = garage?.iban && isValidIBAN(garage.iban);

  if (hasValidIBAN) {
    const qrData: any = {
      creditor: {
        account: garage!.iban!.replace(/\s/g, '').toUpperCase(),
        name: garage!.name,
        address: garage!.address || '',
        city: garage!.city || '',
        country: 'CH',
        zip: garage!.postal_code || '',
      },
      currency: 'CHF',
      amount: Number(invoice.total),
    };

    if (isQRIBAN(garage!.iban!)) {
      qrData.reference = '';
    } else {
      qrData.message = invoice.invoice_number;
    }

    if (client && client.address && client.postal_code && client.city) {
      qrData.debtor = {
        name: client.company_name || `${client.first_name} ${client.last_name}`,
        address: client.address,
        city: client.city,
        country: 'CH',
        zip: client.postal_code,
      };
    }

    try {
      const qrBill = new SwissQRBill(qrData, { language: 'FR', scissors: false });
      const svgString = qrBill.toString();
      const svgY = totalsY + 55;

      if (svgY + 105 * 2.83465 > pageHeight - 10) {
        doc.addPage();
      }

      const yStart = (doc as any).lastAutoTable ? Math.min(svgY, pageHeight - 120) : svgY;
      addSVGtoPDF(doc, svgString, 0, yStart, pageWidth, 105 * 2.83465);
    } catch {
      // If QR bill generation fails, skip it
    }
  }

  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const footerParts: string[] = [];
  if (garage?.name) footerParts.push(garage.name);
  if (garage?.address) footerParts.push(garage.address);
  if (garage?.postal_code && garage?.city) footerParts.push(`${garage.postal_code} ${garage.city}`);
  if (footerParts.length > 0) {
    doc.text(footerParts.join(' — '), 14, footerY);
  }
  const footerParts2: string[] = [];
  if (garage?.email) footerParts2.push(garage.email);
  if (garage?.phone) footerParts2.push(`Tél: ${garage.phone}`);
  if (garage?.vat_number) footerParts2.push(garage.vat_number);
  if (footerParts2.length > 0) {
    doc.text(footerParts2.join(' — '), 14, footerY + 5);
  }
  doc.text('Merci de votre confiance!', pageWidth / 2, footerY + 10, { align: 'center' });

  doc.save(`facture-${invoice.invoice_number}.pdf`);
}

function addSVGtoPDF(doc: jsPDF, svgString: string, x: number, y: number, width: number, height: number) {
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = svgDoc.documentElement;

  const svgWidth = 210;
  const svgHeight = 105;
  const scale = width / svgWidth;
  const actualHeight = svgHeight * scale;

  const rects = svgEl.querySelectorAll('rect');
  const lines = svgEl.querySelectorAll('line');
  const texts = svgEl.querySelectorAll('text');
  const paths = svgEl.querySelectorAll('path');

  function mmToPt(mm: number): number {
    return mm * 2.83465;
  }

  function parseMm(val: string): number {
    const m = val.match(/^([\d.]+)mm$/);
    if (m) return parseFloat(m[1]);
    const pt = val.match(/^([\d.]+)pt$/);
    if (pt) return parseFloat(pt[1]) / 2.83465;
    return parseFloat(val) || 0;
  }

  function parsePx(val: string): number {
    const m = val.match(/^([\d.]+)px$/);
    if (m) return parseFloat(m[1]) / 2.83465;
    return parseMm(val);
  }

  const offsetX = x;
  const offsetY = y;

  for (const rect of Array.from(rects)) {
    const rx = parseFloat(rect.getAttribute('x') || '0');
    const ry = parseFloat(rect.getAttribute('y') || '0');
    const rw = parseFloat(rect.getAttribute('width') || '0');
    const rh = parseFloat(rect.getAttribute('height') || '0');
    const fill = rect.getAttribute('fill') || 'black';

    if (fill === 'none') continue;

    const px = offsetX + (rx / svgWidth) * width;
    const py = offsetY + (ry / svgHeight) * actualHeight;
    const pw = (rw / svgWidth) * width;
    const ph = (rh / svgHeight) * actualHeight;

    if (fill === 'white' || fill === '#fff' || fill === '#ffffff') {
      doc.setFillColor(255, 255, 255);
    } else if (fill === 'black' || fill === '#000' || fill === '#000000') {
      doc.setFillColor(0, 0, 0);
    } else {
      const hex = fill.replace('#', '');
      doc.setFillColor(parseInt(hex.substring(0, 2), 16), parseInt(hex.substring(2, 4), 16), parseInt(hex.substring(4, 6), 16));
    }
    doc.rect(px, py, pw, ph, 'F');
  }

  for (const line of Array.from(lines)) {
    const x1 = parseMm(line.getAttribute('x1') || '0');
    const y1 = parseMm(line.getAttribute('y1') || '0');
    const x2 = parseMm(line.getAttribute('x2') || '0');
    const y2 = parseMm(line.getAttribute('y2') || '0');
    const sw = parseFloat(line.getAttribute('stroke-width') || '1') / 2.83465;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(sw);
    const px1 = offsetX + (x1 / svgWidth) * width;
    const py1 = offsetY + (y1 / svgHeight) * actualHeight;
    const px2 = offsetX + (x2 / svgWidth) * width;
    const py2 = offsetY + (y2 / svgHeight) * actualHeight;
    doc.line(px1, py1, px2, py2);
  }

  for (const textEl of Array.from(texts)) {
    const tspans = textEl.querySelectorAll('tspan');
    let parentX = parseMm(textEl.getAttribute('x') || '0');
    let parentY = parseMm(textEl.getAttribute('y') || '0');

    let currentX = parentX;
    let currentY = parentY;

    for (const tspan of Array.from(tspans)) {
      const tsX = tspan.getAttribute('x');
      const tsY = tspan.getAttribute('y');
      const dy = tspan.getAttribute('dy');
      const fontSize = tspan.getAttribute('font-size') || '8pt';
      const fontWeight = tspan.getAttribute('font-weight') || 'normal';
      const textAnchor = tspan.getAttribute('text-anchor') || 'start';

      if (tsX !== null) currentX = parseMm(tsX);
      if (tsY !== null) currentY = parseMm(tsY);
      if (dy !== null) currentY += parseFloat(dy) / 2.83465;

      const sizePt = parseFloat(fontSize.replace('pt', '')) || 8;
      const text = tspan.textContent || '';

      const px = offsetX + (currentX / svgWidth) * width;
      const py = offsetY + (currentY / svgHeight) * actualHeight;

      doc.setFontSize(sizePt);
      doc.setFont('helvetica', fontWeight === 'bold' ? 'bold' : 'normal');
      doc.setTextColor(0, 0, 0);

      const align = textAnchor === 'end' ? 'right' : textAnchor === 'middle' ? 'center' : 'left';
      doc.text(text, px, py, { align });
    }
  }
}

export function garageToPdfInfo(garage: Garage | null): GaragePdfInfo | null {
  if (!garage) return null;
  return {
    name: garage.name,
    address: garage.address || '',
    postal_code: garage.postal_code || '',
    city: garage.city || '',
    phone: garage.phone || '',
    email: garage.email,
    vat_number: garage.vat_number,
    iban: garage.iban,
    logo_url: garage.logo_url,
  };
}
