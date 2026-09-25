import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SwissQRBill } from 'swissqrbill/svg';
import {
  type Invoice,
  type InvoiceItem,
  type Client,
  type Vehicle,
  type Garage,
  type ServiceRequest,
  type DevisItem,
  type RepairOrderItem,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  calculateVAT,
  VAT_RATE,
} from './types/database';

type PdfItem = { description: string; quantity: number; unit_price: number; line_total: number; item_type?: string };

function drawGroupedTables(doc: any, items: PdfItem[], startY: number, laborLabel: string, partsLabel: string, laborHeaders: string[], partsHeaders: string[], totalLabel: string, subtotalLabel: string) {
  let y = startY;
  const laborItems = items.filter((i) => i.item_type === 'main_oeuvre');
  const partsItems = items.filter((i) => (i.item_type ?? 'piece') === 'piece');

  for (const group of [{ label: laborLabel, rows: laborItems, headers: laborHeaders }, { label: partsLabel, rows: partsItems, headers: partsHeaders }]) {
    if (group.rows.length === 0) continue;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 14, 20);
    doc.text(group.label, 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [group.headers],
      body: group.rows.map((item) => [
        item.description,
        pdfQty(item.quantity),
        pdfAmount(item.unit_price),
        pdfAmount(item.line_total),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [13, 14, 20], fontSize: 10, fontStyle: 'bold' },
      bodyStyles: { fontSize: 10 },
      columnStyles: {
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 35 },
        3: { halign: 'right', cellWidth: 35 },
      },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable?.finalY ?? y + 20;
    const groupSub = group.rows.reduce((s, i) => s + Number(i.line_total), 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`${subtotalLabel}: ${pdfAmount(groupSub)}`, doc.internal.pageSize.getWidth() - 14, y + 5, { align: 'right' });
    y += 12;
  }
  return y;
}

function pdfNumber(n: number, decimals = 0): string {
  const fixed = Math.abs(n).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return (n < 0 ? '-' : '') + (decPart ? `${withSep}.${decPart}` : withSep);
}

function pdfQty(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const str = rounded.toFixed(2).replace(/\.?0+$/, '');
  return pdfNumber(Number(str), 0);
}

function pdfAmount(n: number): string {
  return `${pdfNumber(Number(n), 2)} CHF`;
}

function pdfRate(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? pdfNumber(rounded) : pdfNumber(rounded, 1);
}

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

function generateQRReference(invoiceNumber: string): string {
  const digits = invoiceNumber.replace(/\D/g, '');
  const padded = digits.padStart(26, '0');
  const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  let carry = 0;
  for (let i = 0; i < padded.length; i++) {
    const digit = parseInt(padded[i], 10);
    carry = table[(carry + digit) % 10];
  }
  const checkDigit = (10 - carry) % 10;
  return padded + checkDigit;
}

export async function generateInvoicePDF(
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
      doc.text(`Kilométrage: ${pdfNumber(vehicle.mileage)} km`, pageWidth - 90, 75);
    }
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Échéance: ${new Date(invoice.due_date).toLocaleDateString('fr-CH')}`, 14, 85);
  doc.text(`Statut: ${INVOICE_STATUS_LABELS[invoice.status]}`, 14, 91);
  if (invoice.payment_method) {
    doc.text(`Paiement: ${PAYMENT_METHOD_LABELS[invoice.payment_method]}`, 14, 97);
  }

  const afterTableY = drawGroupedTables(doc, items as PdfItem[], 105, 'Main d\'œuvre', 'Pièces', ['Description', 'Heures', 'Taux horaire', 'Total'], ['Description', 'Qté', 'Prix unitaire', 'Total'], 'Total', 'Sous-total');
  const totalsY = afterTableY + 10;
  const totalsX = pageWidth - 80;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Sous-total:', totalsX, totalsY);
  doc.text(pdfAmount(invoice.subtotal), pageWidth - 14, totalsY, { align: 'right' });

  doc.text(`TVA (${pdfRate(invoice.vat_rate)}%):`, totalsX, totalsY + 7);
  doc.text(pdfAmount(invoice.vat_amount), pageWidth - 14, totalsY + 7, { align: 'right' });

  doc.setFillColor(13, 14, 20);
  doc.roundedRect(pageWidth - 96, totalsY + 10, 86, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Total CHF:', totalsX, totalsY + 18);
  doc.text(pdfAmount(invoice.total), pageWidth - 14, totalsY + 18, { align: 'right' });

  const secondaryAmount = invoice.secondary_payer_amount != null ? Number(invoice.secondary_payer_amount) : 0;
  const clientOwes = Number(invoice.total) - secondaryAmount;
  let insuranceLabelY = totalsY + 28;

  if (secondaryAmount > 0) {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Part assurance:', totalsX, insuranceLabelY);
    doc.text(pdfAmount(secondaryAmount), pageWidth - 14, insuranceLabelY, { align: 'right' });
    insuranceLabelY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('À payer par le client:', totalsX, insuranceLabelY);
    doc.text(pdfAmount(clientOwes), pageWidth - 14, insuranceLabelY, { align: 'right' });
  }

  if (invoice.notes) {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notes:', 14, totalsY + 35);
    const splitNotes = doc.splitTextToSize(invoice.notes, pageWidth - 28);
    doc.text(splitNotes, 14, totalsY + 41);
  }

  const hasValidIBAN = garage?.iban && isValidIBAN(garage.iban);
  let qrDrawn = false;

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
      amount: clientOwes,
    };

    if (isQRIBAN(garage!.iban!)) {
      qrData.reference = generateQRReference(invoice.invoice_number);
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

      const qrY = 192;
      const contentEndY = totalsY + 55;

      if (contentEndY > qrY) {
        doc.addPage();
      }

      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
      const img = new Image();
      img.src = svgDataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load QR SVG image'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = 2480;
      canvas.height = 1240;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const png = canvas.toDataURL('image/png');
      doc.addImage(png, 'PNG', 0, qrY, 210, 105);
      qrDrawn = true;
    } catch (err) {
      console.error('QR bill generation failed, saving PDF without payment part:', err);
    }
  }

  const footerY = qrDrawn ? 176 : pageHeight - 15;
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

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `facture-${invoice.invoice_number}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

export async function generateDevisPDF(
  devis: ServiceRequest,
  client: Client | null,
  vehicle: Vehicle | null,
  items: DevisItem[],
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
  doc.text(garage?.name || 'DEVIS', 14, 18);

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
  doc.text('DEVIS', pageWidth - 14, 18, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(devis.devis_number || '', pageWidth - 14, 25, { align: 'right' });
  doc.text(`Date: ${new Date(devis.created_at).toLocaleDateString('fr-CH')}`, pageWidth - 14, 30, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Devis pour:', 14, 50);

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
      doc.text(`Kilométrage: ${pdfNumber(vehicle.mileage)} km`, pageWidth - 90, 75);
    }
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (devis.expiry_date) {
    doc.text(`Valable jusqu'au: ${new Date(devis.expiry_date).toLocaleDateString('fr-CH')}`, 14, 85);
  }

  const afterTableY = drawGroupedTables(doc, items as PdfItem[], 95, 'Main d\'œuvre', 'Pièces', ['Description', 'Heures', 'Taux horaire', 'Total'], ['Description', 'Qté', 'Prix unitaire', 'Total'], 'Total', 'Sous-total');
  const totalsY = afterTableY + 10;
  const totalsX = pageWidth - 80;

  const subtotal = items.reduce((sum, item) => sum + Number(item.line_total), 0);
  const { vat, total } = calculateVAT(subtotal);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Sous-total:', totalsX, totalsY);
  doc.text(pdfAmount(subtotal), pageWidth - 14, totalsY, { align: 'right' });

  doc.text(`TVA (${pdfRate(VAT_RATE)}%):`, totalsX, totalsY + 7);
  doc.text(pdfAmount(vat), pageWidth - 14, totalsY + 7, { align: 'right' });

  doc.setFillColor(13, 14, 20);
  doc.roundedRect(pageWidth - 96, totalsY + 10, 86, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Total CHF:', totalsX, totalsY + 18);
  doc.text(pdfAmount(total), pageWidth - 14, totalsY + 18, { align: 'right' });

  if (devis.description) {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Description:', 14, totalsY + 35);
    const splitDesc = doc.splitTextToSize(devis.description, pageWidth - 28);
    doc.text(splitDesc, 14, totalsY + 41);
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

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `devis-${devis.devis_number || devis.id}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
