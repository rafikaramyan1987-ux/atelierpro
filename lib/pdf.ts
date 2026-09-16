import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  formatCHF,
  type Invoice,
  type InvoiceItem,
  type Client,
  type Vehicle,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from './types/database';

const ATELIER_INFO = {
  name: 'AtelierPro',
  address: 'Route de l\'Atelier 12',
  city: '1000 Lausanne',
  phone: '+41 21 555 12 34',
  email: 'contact@atelierpro.ch',
  vatNumber: 'CHE-123.456.789 TVA',
  iban: 'CH93 0076 2011 6238 5295 7',
};

export function generateInvoicePDF(invoice: Invoice, client: Client | null, vehicle: Vehicle | null, items: InvoiceItem[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(13, 14, 20);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(ATELIER_INFO.name, 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(ATELIER_INFO.address, 14, 25);
  doc.text(`${ATELIER_INFO.city} — Tél: ${ATELIER_INFO.phone}`, 14, 30);
  doc.text(ATELIER_INFO.email, 14, 35);

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

  const qrY = totalsY + 55;
  if (invoice.payment_method === 'qr_bill' || !invoice.payment_method) {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, qrY, 46, 46, 1, 1, 'S');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('QR-facture', 16, qrY + 5);
    doc.text('(à scanner dans', 16, qrY + 12);
    doc.text('votre app bancaire)', 16, qrY + 17);

    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('IBAN:', 66, qrY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(ATELIER_INFO.iban, 66, qrY + 12);
    doc.setFont('helvetica', 'bold');
    doc.text('Bénéficiaire:', 66, qrY + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(ATELIER_INFO.name, 66, qrY + 27);
    doc.text(ATELIER_INFO.address, 66, qrY + 33);
    doc.text(ATELIER_INFO.city, 66, qrY + 39);

    doc.setFont('helvetica', 'bold');
    doc.text('Montant:', 130, qrY + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCHF(invoice.total), 130, qrY + 12);
    doc.setFont('helvetica', 'bold');
    doc.text('N° facture:', 130, qrY + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.invoice_number, 130, qrY + 27);
  }

  const footerY = 280;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`${ATELIER_INFO.name} — ${ATELIER_INFO.address}, ${ATELIER_INFO.city}`, 14, footerY);
  doc.text(`${ATELIER_INFO.email} — Tél: ${ATELIER_INFO.phone} — ${ATELIER_INFO.vatNumber}`, 14, footerY + 5);
  doc.text('Merci de votre confiance!', pageWidth / 2, footerY + 10, { align: 'center' });

  doc.save(`facture-${invoice.invoice_number}.pdf`);
}
