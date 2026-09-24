'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { type Vehicle, type Invoice } from '@/lib/types/database';
import { Car, Plus, Loader2, FileText, Calendar, HelpCircle, ChevronsUpDown, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { OrPhotosSection } from '@/components/or-photos';
import type { RepairOrder } from '@/lib/types/database';

const CAR_BRANDS_MODELS: Record<string, string[]> = {
  'Alfa Romeo': ['Giulia', 'Stelvio', 'Giulietta', 'MiTo', '159', 'Brera', 'Spider'],
  'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron', 'TT', 'R8'],
  'BMW': ['Série 1', 'Série 2', 'Série 3', 'Série 4', 'Série 5', 'Série 6', 'Série 7', 'Série 8', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'i3', 'i4', 'iX', 'Z4', 'M2', 'M3', 'M4', 'M5'],
  'Chevrolet': ['Camaro', 'Corvette', 'Cruze', 'Spark', 'Malibu', 'Trax', 'Equinox'],
  'Citroën': ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C3 Aircross', 'C4 Cactus', 'C5 Aircross', 'Berlingo', 'Jumper', 'SpaceTourer', 'Grand C4 Picasso'],
  'Dacia': ['Sandero', 'Duster', 'Logan', 'Lodgy', 'Dokker', 'Spring', 'Jogger'],
  'DS': ['DS 3', 'DS 4', 'DS 7', 'DS 9'],
  'Fiat': ['500', '500e', 'Panda', 'Tipo', '500X', '500L', 'Doblo', 'Ducato', 'Punto', 'Bravo'],
  'Ford': ['Fiesta', 'Focus', 'Mondeo', 'Kuga', 'Puma', 'EcoSport', 'Explorer', 'Mustang', 'S-Max', 'Galaxy', 'Transit', 'Ranger', 'Edge'],
  'Honda': ['Civic', 'Accord', 'CR-V', 'HR-V', 'Jazz', 'HR-V e:HEV', 'e', 'Type R'],
  'Hyundai': ['i10', 'i20', 'i30', 'i40', 'Kona', 'Tucson', 'Santa Fe', 'Ioniq', 'Ioniq 5', 'Ioniq 6', 'Bayon', 'Staria'],
  'Jaguar': ['XE', 'XF', 'XJ', 'F-Pace', 'E-Pace', 'I-Pace', 'F-Type', 'XE R-Dynamic'],
  'Jeep': ['Renegade', 'Compass', 'Cherokee', 'Grand Cherokee', 'Wrangler', 'Gladiator', 'Commander', 'Avenger'],
  'Kia': ['Picanto', 'Rio', 'Ceed', 'Ceed GT', 'Carnival', 'Sportage', 'Sorento', 'Niro', 'EV6', 'Soul', 'Stonic', 'XCeed', 'ProCeed'],
  'Lancia': ['Ypsilon', 'Delta', 'Thema', 'Voyager'],
  'Land Rover': ['Range Rover', 'Range Rover Sport', 'Range Rover Velar', 'Range Rover Evoque', 'Discovery', 'Discovery Sport', 'Defender', 'Freelander'],
  'Lexus': ['IS', 'ES', 'GS', 'LS', 'UX', 'NX', 'RX', 'RX L', 'GX', 'LX', 'LC', 'RC'],
  'Mazda': ['Mazda2', 'Mazda3', 'Mazda6', 'CX-3', 'CX-5', 'CX-30', 'CX-7', 'CX-9', 'MX-5', 'MX-30'],
  'Mercedes-Benz': ['Classe A', 'Classe B', 'Classe C', 'Classe CLA', 'Classe CLS', 'Classe E', 'Classe G', 'Classe GLA', 'Classe GLB', 'Classe GLC', 'Classe GLE', 'Classe GLS', 'Classe S', 'Classe SL', 'Classe V', 'EQA', 'EQB', 'EQC', 'EQE', 'EQS', 'EQV', 'AMG GT', 'X-Class'],
  'Mini': ['Cooper', 'Cooper S', 'Cooper D', 'Cooper SE', 'Countryman', 'Clubman', 'Paceman', 'Coupe', 'Roadster'],
  'Mitsubishi': ['Space Star', 'ASX', 'Outlander', 'Eclipse Cross', 'L200', 'Pajero', 'i-MiEV', 'Mirage'],
  'Nissan': ['Micra', 'Note', 'Leaf', 'Juke', 'Qashqai', 'X-Trail', 'Pathfinder', 'Navara', 'Ariya', 'GT-R', '370Z'],
  'Opel': ['Corsa', 'Astra', 'Insignia', 'Mokka', 'Grandland', 'Crossland', 'Combo', 'Vivaro', 'Movano', 'Zafira', 'Karl', 'Adam'],
  'Peugeot': ['108', '208', '308', '408', '508', '2008', '3008', '5008', 'Rifter', 'Traveller', 'Partner', 'Expert', 'Boxer', 'iOn', 'e-208', 'e-2008'],
  'Porsche': ['911', '718 Cayman', '718 Boxster', 'Panamera', 'Macan', 'Cayenne', 'Taycan', '918 Spyder'],
  'Renault': ['Twingo', 'Zoe', 'Clio', 'Captur', 'Megane', 'Austral', 'Arkana', 'Kadjar', 'Talisman', 'Espace', 'Scenic', 'Kangoo', 'Trafic', 'Master', 'Express', 'Arkana E-Tech', 'Megane E-Tech'],
  'Seat': ['Ibiza', 'Leon', 'Ateca', 'Arona', 'Tarraco', 'Alhambra', 'Mii', 'Toledo', 'Exeo', 'Altea'],
  'Skoda': ['Fabia', 'Scala', 'Octavia', 'Superb', 'Kamiq', 'Kodiaq', 'Karoq', 'Enyaq', 'Citigo', 'Roomster', 'Yeti'],
  'Subaru': ['Impreza', 'WRX', 'XV', 'Forester', 'Outback', 'Levorg', 'BRZ', 'Solterra'],
  'Suzuki': ['Swift', 'Ignis', 'Celerio', 'Baleno', 'Vitara', 'S-Cross', 'Jimny', 'Swace', 'Across', 'iV4'],
  'Tesla': ['Model 3', 'Model S', 'Model X', 'Model Y', 'Cybertruck', 'Roadster'],
  'Toyota': ['Aygo', 'Yaris', 'Corolla', 'Auris', 'Camry', 'Avensis', 'C-HR', 'RAV4', 'Highlander', 'Land Cruiser', 'Hilux', 'Prius', 'Mirai', 'bZ4X', 'GT86', 'GR Supra', 'GR Yaris', 'Proace'],
  'Volkswagen': ['Polo', 'Golf', 'Golf 8', 'Arteon', 'Passat', 'T-Roc', 'T-Cross', 'Tiguan', 'Touareg', 'Touran', 'Sharan', 'Caddy', 'Transporter', 'Crafter', 'ID.3', 'ID.4', 'ID.5', 'ID.7', 'ID. Buzz', 'up!'],
  'Volvo': ['XC40', 'XC60', 'XC90', 'EX30', 'EX90', 'V40', 'V50', 'V60', 'V70', 'V90', 'S40', 'S60', 'S90', 'C30', 'C70', 'XC60 Recharge', 'XC90 Recharge'],
};

export default function ClientVehiclesPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [vehicles, setVehicles] = useState<(Vehicle & { invoices?: Invoice[] })[]>([]);
  const [repairOrders, setRepairOrders] = useState<Record<string, RepairOrder[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);

  const [form, setForm] = useState({
    brand: '',
    model: '',
    license_plate: '',
    vin: '',
    type_approval_number: '',
    year: '',
    mileage: '',
  });

  const [useManualModel, setUseManualModel] = useState(false);

  useEffect(() => {
    if (!profile?.client_id) return;
    fetchData();
  }, [profile]);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase
      .from('vehicles')
      .select('*, invoices(*)')
      .eq('client_id', profile!.client_id)
      .order('created_at', { ascending: false });
    const allVehicles = data as any ?? [];
    setVehicles(allVehicles);

    const vehicleIds = allVehicles.map((v: any) => v.id);
    if (vehicleIds.length > 0) {
      const { data: roData } = await supabase
        .from('repair_orders')
        .select('*')
        .in('vehicle_id', vehicleIds)
        .order('created_at', { ascending: false });
      const roMap: Record<string, RepairOrder[]> = {};
      for (const ro of (roData as RepairOrder[] ?? [])) {
        if (ro.vehicle_id) {
          if (!roMap[ro.vehicle_id]) roMap[ro.vehicle_id] = [];
          roMap[ro.vehicle_id].push(ro);
        }
      }
      setRepairOrders(roMap);
    }

    setLoading(false);
  }

  function handleBrandChange(brand: string) {
    setForm({ ...form, brand, model: '' });
    setUseManualModel(false);
  }

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.client_id) return;
    setSubmitting(true);
    const { error } = await supabase.from('vehicles').insert({
      client_id: profile.client_id,
      brand: form.brand,
      model: form.model,
      license_plate: form.license_plate,
      vin: form.vin || null,
      type_approval_number: form.type_approval_number || null,
      year: form.year ? parseInt(form.year) : null,
      mileage: form.mileage ? parseInt(form.mileage) : null,
    });
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('toast.vehicleAdded'));
      setDialogOpen(false);
      setForm({ brand: '', model: '', license_plate: '', vin: '', type_approval_number: '', year: '', mileage: '' });
      setUseManualModel(false);
      fetchData();
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const availableModels = form.brand ? (CAR_BRANDS_MODELS[form.brand] ?? []) : [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('vehicles.title')} description={t('vehicles.desc')}>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('vehicles.add')}
        </Button>
      </PageHeader>

      {vehicles.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Car className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">{t('vehicles.none')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {vehicles.map((vehicle) => (
            <Card key={vehicle.id} className="border-border/60 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <Car className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{vehicle.brand} {vehicle.model}</p>
                      <Badge variant="outline" className="text-xs mt-1">{vehicle.license_plate}</Badge>
                    </div>
                  </div>
                  {vehicle.year && <span className="text-sm text-muted-foreground">{vehicle.year}</span>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  {vehicle.mileage != null && (
                    <div>
                      <span className="text-muted-foreground">{t('vehicles.mileage')}: </span>
                      <span className="font-medium">{vehicle.mileage.toLocaleString('fr-CH')} km</span>
                    </div>
                  )}
                  {vehicle.type_approval_number && (
                    <div className="truncate">
                      <span className="text-muted-foreground">{t('vehicles.reception')}: </span>
                      <span className="font-mono text-xs">{vehicle.type_approval_number}</span>
                    </div>
                  )}
                  {vehicle.vin && (
                    <div className="truncate">
                      <span className="text-muted-foreground">{t('vehicles.vin')}: </span>
                      <span className="font-mono text-xs">{vehicle.vin}</span>
                    </div>
                  )}
                </div>

                {vehicle.invoices && vehicle.invoices.length > 0 && (
                  <div className="pt-3 border-t">
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => setExpandedVehicle(expandedVehicle === vehicle.id ? null : vehicle.id)}>
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      {vehicle.invoices.length} {t('vehicles.maintenanceHistory')}
                    </Button>
                    {expandedVehicle === vehicle.id && (
                      <div className="mt-2 space-y-1.5 animate-fade-in">
                        {vehicle.invoices.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{new Date(inv.issue_date).toLocaleDateString('fr-CH')}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{inv.invoice_number}</span>
                          </div>
                        ))}
                        {(repairOrders[vehicle.id] ?? []).length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                              <Camera className="h-3.5 w-3.5" />
                              {t('orPhotos.title')}
                            </p>
                            <div className="space-y-3">
                              {(repairOrders[vehicle.id] ?? []).map((ro) => (
                                <div key={ro.id}>
                                  <p className="text-xs text-muted-foreground mb-1">{ro.or_number}</p>
                                  <OrPhotosSection
                                    repairOrderId={ro.id}
                                    garageId={ro.garage_id ?? ''}
                                    readOnly
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('vehicles.add')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddVehicle} className="space-y-4">
            {/* Marque / Modèle cascading dropdowns */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="v-brand">{t('vehicles.brand')} *</Label>
                <Select value={form.brand || 'none'} onValueChange={handleBrandChange}>
                  <SelectTrigger id="v-brand">
                    <SelectValue placeholder={t('vehicles.selectBrand')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(CAR_BRANDS_MODELS).sort().map((brand) => (
                      <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="v-model">{t('vehicles.model')} *</Label>
                  {form.brand && (
                    <button
                      type="button"
                      onClick={() => { setUseManualModel(!useManualModel); setForm({ ...form, model: '' }); }}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <ChevronsUpDown className="h-3 w-3" />
                      {useManualModel ? t('vehicles.list') : t('vehicles.manualEntry')}
                    </button>
                  )}
                </div>
                {form.brand && !useManualModel && availableModels.length > 0 ? (
                  <Select value={form.model || 'none'} onValueChange={(v) => setForm({ ...form, model: v })}>
                    <SelectTrigger id="v-model">
                      <SelectValue placeholder={t('vehicles.selectModel')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((model) => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="v-model"
                    required
                    placeholder={form.brand ? "Saisir le modèle" : "Sélectionner d'abord une marque"}
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    disabled={!form.brand}
                  />
                )}
              </div>
            </div>

            {/* Numéro de réception par type */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="v-reception">{t('vehicles.typeApproval')}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground hover:text-foreground">
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs text-xs">{t('vehicles.typeApprovalHelp')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="v-reception"
                placeholder="ex: 1T51 03"
                value={form.type_approval_number}
                onChange={(e) => setForm({ ...form, type_approval_number: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t('vehicles.typeApprovalHint')}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="v-plate">{t('vehicles.plate')} *</Label>
                <Input id="v-plate" required placeholder="VD 123 456" value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-vin">{t('vehicles.vin')}</Label>
                <Input id="v-vin" placeholder="WVWZZZ..." value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="v-year">{t('vehicles.year')}</Label>
                <Input id="v-year" type="number" placeholder="2023" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-mileage">{t('vehicles.mileage')}</Label>
                <Input id="v-mileage" type="number" placeholder="45000" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t('vehicles.addBtn')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
