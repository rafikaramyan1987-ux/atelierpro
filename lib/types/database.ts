export type UserRole = 'admin' | 'mecanicien' | 'secretaire' | 'client';

export type InvoiceStatus = 'brouillon' | 'envoyee' | 'payee' | 'en_retard' | 'en_attente_validation';
export type PaymentMethod = 'twint' | 'especes' | 'carte' | 'virement' | 'qr_bill';
export type TwintPaymentStatus = 'en_attente' | 'confirmee' | 'echouee' | 'remboursee';

export type AppointmentStatus = 'en_attente' | 'confirme' | 'refuse' | 'termine' | 'annule';
export type ServiceRequestType = 'demande_devis';
export type DevisStatus = 'en_attente' | 'devis_recu' | 'devis_accepte' | 'devis_refuse' | 'en_attente_validation';
export type ServiceRequestStatus = DevisStatus;

export const GARAGE_ROLES: UserRole[] = ['admin', 'mecanicien', 'secretaire'];
export const isGarageStaff = (role: UserRole | null | undefined): boolean =>
  !!role && GARAGE_ROLES.includes(role);

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    'dashboard', 'mes-interventions', 'rendez-vous', 'ordres-reparation', 'planning',
    'factures', 'paiements', 'clients', 'stock', 'commandes-pieces',
    'vehicules-courtoisie', 'taches-types', 'rappels', 'rapports',
    'mon-garage', 'equipe',
  ],
  mecanicien: [
    'mes-interventions', 'ordres-reparation', 'planning', 'stock',
    'commandes-pieces', 'clients', 'taches-types', 'rappels',
    'vehicules-courtoisie',
  ],
  secretaire: [
    'factures', 'paiements', 'rendez-vous', 'rapports', 'clients',
    'stock', 'commandes-pieces', 'vehicules-courtoisie',
  ],
  client: [],
};

export function canAccess(role: UserRole | null | undefined, path: string): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role] ?? [];
  const basePath = path.replace(/^\//, '').split('/')[0];
  return perms.includes(basePath);
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  active: boolean;
  client_id: string | null;
  garage_id: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  company_name: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  notes: string | null;
  auth_user_id: string | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  client_id: string;
  brand: string;
  model: string;
  license_plate: string;
  vin: string | null;
  type_approval_number: string | null;
  year: number | null;
  mileage: number | null;
  notes: string | null;
  tyres_stored: boolean;
  stored_tyre_set: 'summer' | 'winter' | null;
  created_at: string;
}

export interface Part {
  id: string;
  reference: string;
  name: string;
  description: string | null;
  category: string | null;
  unit_price: number;
  stock_quantity: number;
  min_stock_threshold: number;
  supplier: string | null;
  location: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  vehicle_id: string | null;
  status: InvoiceStatus;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_by: string | null;
  commission_amount: number | null;
  payer_type: PayerType;
  secondary_payer_type: PayerType | null;
  secondary_payer_amount: number | null;
  created_at: string;
  client?: Client;
  vehicle?: Vehicle;
  invoice_items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  part_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface TwintPayment {
  id: string;
  invoice_id: string;
  amount: number;
  status: TwintPaymentStatus;
  twint_transaction_id: string | null;
  qr_code_url: string | null;
  created_at: string;
  completed_at: string | null;
  commission_amount: number | null;
}

export interface Appointment {
  id: string;
  client_id: string;
  vehicle_id: string | null;
  requested_date: string;
  requested_time: string;
  service_type: string;
  description: string | null;
  status: AppointmentStatus;
  assigned_to: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  garage_notes: string | null;
  client_notes: string | null;
  garage_id: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  vehicle?: Vehicle;
}

export interface ServiceRequest {
  id: string;
  client_id: string;
  vehicle_id: string | null;
  type: ServiceRequestType;
  part_reference: string | null;
  part_name: string | null;
  quantity: number | null;
  description: string;
  status: ServiceRequestStatus;
  quoted_price: number | null;
  garage_response: string | null;
  garage_id: string | null;
  signature_data: string | null;
  signature_date: string | null;
  expiry_date: string | null;
  valid_until_days: number | null;
  admin_comment: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  vehicle?: Vehicle;
  devis_items?: DevisItem[];
}

export interface DevisItem {
  id: string;
  devis_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface Garage {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string | null;
  description: string | null;
  logo_url: string | null;
  services_offered: string[];
  latitude: number | null;
  longitude: number | null;
  rating: number;
  review_count: number;
  commission_rate: number;
  gardiennage_enabled: boolean;
  created_at: string;
}

export type PartsOrderStatus = 'en_attente' | 'commandee' | 'recue';
export type PartsOrderUrgency = 'normal' | 'urgent' | 'critique';

export interface PartsOrder {
  id: string;
  garage_id: string | null;
  part_name: string;
  part_reference: string | null;
  quantity: number;
  urgency: PartsOrderUrgency;
  status: PartsOrderStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GarageReview {
  id: string;
  garage_id: string;
  client_id: string;
  appointment_id: string | null;
  rating: number;
  comment: string | null;
  reviewer_name: string;
  created_at: string;
}

export const VAT_RATE = 8.1;

export function formatCHF(amount: number): string {
  return new Intl.NumberFormat('fr-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function calculateVAT(subtotal: number, rate: number = VAT_RATE): { vat: number; total: number } {
  const vat = Math.round(subtotal * rate) / 100;
  const total = Math.round((subtotal + vat) * 100) / 100;
  return { vat, total };
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  brouillon: 'Brouillon',
  envoyee: 'Envoyée',
  payee: 'Payée',
  en_retard: 'En retard',
  en_attente_validation: 'En attente de validation',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  twint: 'Twint',
  especes: 'Espèces',
  carte: 'Carte bancaire',
  virement: 'Virement',
  qr_bill: 'QR-facture',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  mecanicien: 'Mécanicien',
  secretaire: 'Secrétaire',
  client: 'Client',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  en_attente: 'En attente',
  confirme: 'Confirmé',
  refuse: 'Refusé',
  termine: 'Terminé',
  annule: 'Annulé',
};

export const SERVICE_REQUEST_TYPE_LABELS: Record<ServiceRequestType, string> = {
  demande_devis: 'Demande de devis',
};

export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  en_attente: 'En attente',
  devis_recu: 'Devis reçu',
  devis_accepte: 'Accepté',
  devis_refuse: 'Refusé',
  en_attente_validation: 'En attente de validation',
};

export const DEVIS_STATUS_LABELS = SERVICE_REQUEST_STATUS_LABELS;

export const SERVICE_TYPES = [
  'Vidange',
  'Freinage',
  'Pneus',
  'Diagnostic',
  'Révision générale',
  'Suspension',
  'Électricité',
  'Carrosserie',
  'Autre',
];

export type RepairOrderStatus = 'en_cours' | 'termine' | 'facture';
export type LoanerVehicleStatus = 'available' | 'in_use' | 'maintenance';
export type PayerType = 'client' | 'assurance' | 'flotte';

export interface RepairOrder {
  id: string;
  or_number: string;
  service_request_id: string | null;
  client_id: string;
  vehicle_id: string | null;
  assigned_mechanic_id: string | null;
  status: RepairOrderStatus;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  workspace_name: string | null;
  invoice_id: string | null;
  garage_id: string | null;
  created_by: string | null;
  signature_data: string | null;
  signature_date: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  vehicle?: Vehicle;
  assigned_mechanic?: Profile;
  repair_order_items?: RepairOrderItem[];
  service_request?: ServiceRequest;
}

export interface RepairOrderItem {
  id: string;
  repair_order_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface LoanerVehicle {
  id: string;
  garage_id: string | null;
  make: string;
  model: string;
  license_plate: string;
  status: LoanerVehicleStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanerAssignment {
  id: string;
  loaner_vehicle_id: string;
  client_id: string | null;
  appointment_id: string | null;
  repair_order_id: string | null;
  start_date: string;
  end_date: string;
  status: 'active' | 'returned';
  notes: string | null;
  created_at: string;
  loaner_vehicle?: LoanerVehicle;
  client?: Client;
}

export const REPAIR_ORDER_STATUS_LABELS: Record<RepairOrderStatus, string> = {
  en_cours: 'En cours',
  termine: 'Terminé',
  facture: 'Facturé',
};

export const LOANER_VEHICLE_STATUS_LABELS: Record<LoanerVehicleStatus, string> = {
  available: 'Disponible',
  in_use: 'En utilisation',
  maintenance: 'En maintenance',
};

export const PAYER_TYPE_LABELS: Record<PayerType, string> = {
  client: 'Client',
  assurance: 'Assurance',
  flotte: 'Flotte',
};

export const TIME_SLOTS = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
];

export type ReminderType = 'none' | 'interval' | 'seasonal';

export interface CannedTask {
  id: string;
  garage_id: string | null;
  name: string;
  description: string | null;
  estimated_duration_minutes: number | null;
  default_price: number | null;
  reminder_type: ReminderType;
  interval_months: number | null;
  interval_km: number | null;
  seasonal_months: number[];
  service_group: string | null;
  created_at: string;
}
