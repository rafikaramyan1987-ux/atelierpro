'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { type Garage, type Vehicle, type GarageReview } from '@/lib/types/database';
import { MapPin, Phone, Mail, Search, Loader2, Wrench, CalendarClock, Star, Navigation, Info, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function renderStars(rating: number) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const isFull = i < full;
        const isHalf = i === full && half;
        return (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${
              isFull
                ? 'fill-amber-400 text-amber-400'
                : isHalf
                ? 'fill-amber-400/50 text-amber-400'
                : 'fill-muted text-muted-foreground/30'
            }`}
          />
        );
      })}
    </div>
  );
}

export default function GaragesPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { t } = useI18n();
  const [garages, setGarages] = useState<Garage[]>([]);
  const [reviewsByGarage, setReviewsByGarage] = useState<Record<string, GarageReview[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookingGarage, setBookingGarage] = useState<Garage | null>(null);
  const [bookingVehicle, setBookingVehicle] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('09:00');
  const [bookingService, setBookingService] = useState('');
  const [bookingDesc, setBookingDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const timeSlots = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];
  const serviceTypes = [t('service.vidange'), t('service.freinage'), t('service.pneus'), t('service.diagnostic'), t('service.revision'), t('service.suspension'), t('service.electricite'), t('service.carrosserie'), t('service.autre')];

  useEffect(() => {
    async function fetchGarages() {
      const { data } = await supabase.from('garages_public').select('*').order('name');
      const garageList = (data as Garage[]) ?? [];
      setGarages(garageList);

      // Fetch all reviews for these garages
      if (garageList.length > 0) {
        const garageIds = garageList.map((g) => g.id);
        const { data: reviewData } = await supabase
          .from('garage_reviews_public')
          .select('*')
          .in('garage_id', garageIds)
          .order('created_at', { ascending: false });
        const reviewMap: Record<string, GarageReview[]> = {};
        (reviewData as GarageReview[] ?? []).forEach((r) => {
          if (!reviewMap[r.garage_id]) reviewMap[r.garage_id] = [];
          reviewMap[r.garage_id].push(r);
        });
        setReviewsByGarage(reviewMap);
      }

      setLoading(false);
    }
    fetchGarages();

    if (profile?.client_id) {
      supabase.from('vehicles').select('*').eq('client_id', profile.client_id).then(({ data }) => {
        setVehicles(data as Vehicle[] ?? []);
      });
    }
  }, [profile]);

  // Compute real rating from reviews, fall back to seeded values
  function computeRating(garage: Garage): { rating: number; count: number } {
    const reviews = reviewsByGarage[garage.id] ?? [];
    if (reviews.length === 0) {
      return { rating: garage.rating, count: garage.review_count };
    }
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return { rating: Math.round(avg * 10) / 10, count: reviews.length };
  }

  // Swiss postal code to approximate lat/lon mapping for major regions
  const postalCodeCoords: { prefix: string; lat: number; lon: number; label: string }[] = [
    { prefix: '10', lat: 46.52, lon: 6.63, label: 'Lausanne' },
    { prefix: '11', lat: 46.55, lon: 6.68, label: 'La Côte' },
    { prefix: '12', lat: 46.20, lon: 6.14, label: 'Genève' },
    { prefix: '13', lat: 46.70, lon: 6.35, label: 'Jura Vaudois' },
    { prefix: '14', lat: 46.45, lon: 6.90, label: 'Chablais' },
    { prefix: '15', lat: 46.82, lon: 6.94, label: 'Broye' },
    { prefix: '16', lat: 46.62, lon: 7.06, label: 'Bulle' },
    { prefix: '17', lat: 46.81, lon: 7.16, label: 'Fribourg' },
    { prefix: '18', lat: 46.32, lon: 6.97, label: 'Aigle' },
    { prefix: '19', lat: 46.23, lon: 7.36, label: 'Sion' },
    { prefix: '20', lat: 47.01, lon: 6.97, label: 'Neuchâtel' },
    { prefix: '21', lat: 47.09, lon: 7.00, label: 'Bienne' },
    { prefix: '22', lat: 47.15, lon: 7.25, label: 'Biel' },
    { prefix: '23', lat: 47.10, lon: 7.30, label: 'Berner Jura' },
    { prefix: '24', lat: 47.25, lon: 7.50, label: 'Moutier' },
    { prefix: '25', lat: 47.14, lon: 7.25, label: 'Bienne' },
    { prefix: '26', lat: 47.05, lon: 6.80, label: 'Jura' },
    { prefix: '27', lat: 47.20, lon: 6.90, label: 'Delémont' },
    { prefix: '28', lat: 47.30, lon: 7.40, label: 'Porrentruy' },
    { prefix: '29', lat: 47.40, lon: 7.50, label: 'Thielle' },
    { prefix: '30', lat: 46.94, lon: 7.44, label: 'Bern' },
    { prefix: '31', lat: 46.95, lon: 7.40, label: 'Bern' },
    { prefix: '32', lat: 46.90, lon: 7.50, label: 'Berner Oberland' },
    { prefix: '33', lat: 46.85, lon: 7.55, label: 'Thun' },
    { prefix: '34', lat: 46.75, lon: 7.65, label: 'Brienz' },
    { prefix: '35', lat: 46.70, lon: 7.70, label: 'Interlaken' },
    { prefix: '36', lat: 46.76, lon: 7.63, label: 'Thun' },
    { prefix: '37', lat: 46.80, lon: 7.80, label: 'Meiringen' },
    { prefix: '38', lat: 46.65, lon: 7.90, label: 'Frutigen' },
    { prefix: '39', lat: 46.60, lon: 8.00, label: 'Brig' },
    { prefix: '40', lat: 47.56, lon: 7.59, label: 'Bâle' },
    { prefix: '41', lat: 47.55, lon: 7.60, label: 'Bâle' },
    { prefix: '42', lat: 47.50, lon: 7.70, label: 'Liestal' },
    { prefix: '43', lat: 47.55, lon: 7.75, label: 'Waldenburg' },
    { prefix: '44', lat: 47.45, lon: 7.80, label: 'Laufen' },
    { prefix: '45', lat: 47.50, lon: 7.85, label: 'Dorneck' },
    { prefix: '46', lat: 47.45, lon: 7.85, label: 'Thierstein' },
    { prefix: '47', lat: 47.40, lon: 7.90, label: 'Bezirk Thal' },
    { prefix: '48', lat: 47.55, lon: 8.00, label: 'Zurzach' },
    { prefix: '49', lat: 47.50, lon: 8.10, label: 'Rheinfelden' },
    { prefix: '50', lat: 47.39, lon: 8.04, label: 'Aarau' },
    { prefix: '51', lat: 47.40, lon: 8.05, label: 'Aarau' },
    { prefix: '52', lat: 47.35, lon: 8.10, label: 'Lenzburg' },
    { prefix: '53', lat: 47.30, lon: 8.15, label: 'Wohlen' },
    { prefix: '54', lat: 47.45, lon: 8.20, label: 'Brugg' },
    { prefix: '55', lat: 47.50, lon: 8.25, label: 'Baden' },
    { prefix: '56', lat: 47.48, lon: 8.30, label: 'Bremgarten' },
    { prefix: '57', lat: 47.55, lon: 8.35, label: 'Muri' },
    { prefix: '58', lat: 47.45, lon: 8.40, label: 'Kulm' },
    { prefix: '59', lat: 47.35, lon: 8.35, label: 'Bezirk Muri' },
    { prefix: '60', lat: 47.05, lon: 8.31, label: 'Lucerne' },
    { prefix: '61', lat: 47.10, lon: 8.35, label: 'Lucerne' },
    { prefix: '62', lat: 47.15, lon: 8.40, label: 'Willisau' },
    { prefix: '63', lat: 47.05, lon: 8.45, label: 'Sursee' },
    { prefix: '64', lat: 46.95, lon: 8.25, label: 'Entlebuch' },
    { prefix: '65', lat: 46.85, lon: 8.20, label: 'Horw' },
    { prefix: '66', lat: 46.80, lon: 8.15, label: 'Sarnen' },
    { prefix: '67', lat: 46.75, lon: 8.10, label: 'Obwalden' },
    { prefix: '68', lat: 46.90, lon: 8.60, label: 'Nidwalden' },
    { prefix: '69', lat: 46.95, lon: 8.70, label: 'Uri' },
    { prefix: '70', lat: 46.85, lon: 9.53, label: 'Chur' },
    { prefix: '71', lat: 46.80, lon: 9.60, label: 'Prättigau' },
    { prefix: '72', lat: 46.75, lon: 9.70, label: 'Landquart' },
    { prefix: '73', lat: 46.70, lon: 9.80, label: 'Engadin' },
    { prefix: '74', lat: 46.65, lon: 9.90, label: 'Oberengadin' },
    { prefix: '75', lat: 46.60, lon: 10.00, label: 'Münstertal' },
    { prefix: '76', lat: 46.55, lon: 9.50, label: 'Heinzenberg' },
    { prefix: '77', lat: 46.50, lon: 9.40, label: 'Mittelbünden' },
    { prefix: '78', lat: 46.45, lon: 9.30, label: 'Surselva' },
    { prefix: '79', lat: 46.40, lon: 9.20, label: 'Surselva' },
    { prefix: '80', lat: 47.38, lon: 8.54, label: 'Zürich' },
    { prefix: '81', lat: 47.40, lon: 8.55, label: 'Zürich' },
    { prefix: '82', lat: 47.35, lon: 8.60, label: 'Meilen' },
    { prefix: '83', lat: 47.30, lon: 8.65, label: 'Wädenswil' },
    { prefix: '84', lat: 47.45, lon: 8.70, label: 'Winterthur' },
    { prefix: '85', lat: 47.50, lon: 8.73, label: 'Winterthur' },
    { prefix: '86', lat: 47.55, lon: 8.80, label: 'Andelfingen' },
    { prefix: '87', lat: 47.40, lon: 8.85, label: 'Tösstal' },
    { prefix: '88', lat: 47.20, lon: 8.90, label: 'Einsiedeln' },
    { prefix: '89', lat: 47.25, lon: 8.75, label: 'Horgen' },
    { prefix: '90', lat: 47.42, lon: 9.38, label: 'St. Gallen' },
    { prefix: '91', lat: 47.45, lon: 9.45, label: 'Rorschach' },
    { prefix: '92', lat: 47.35, lon: 9.50, label: 'Werdenberg' },
    { prefix: '93', lat: 47.30, lon: 9.60, label: 'Rheintal' },
    { prefix: '94', lat: 47.25, lon: 9.70, label: 'Unterrheintal' },
    { prefix: '95', lat: 47.48, lon: 8.90, label: 'Thurgau' },
    { prefix: '96', lat: 47.55, lon: 9.00, label: 'Frauenfeld' },
    { prefix: '97', lat: 47.60, lon: 9.10, label: 'Kreuzlingen' },
    { prefix: '98', lat: 47.65, lon: 9.20, label: 'Steckborn' },
    { prefix: '99', lat: 47.70, lon: 9.30, label: 'Mammern' },
    { prefix: '65', lat: 46.80, lon: 8.15, label: 'Obwalden' },
    { prefix: '64', lat: 46.95, lon: 8.25, label: 'Entlebuch' },
  ];

  function getSearchCoords(query: string): { lat: number; lon: number } | null {
    const trimmed = query.trim().toLowerCase();
    const digits = trimmed.match(/^\d{1,4}/);
    if (digits) {
      const prefix = digits[0].substring(0, 2);
      const match = postalCodeCoords.find((c) => c.prefix === prefix);
      if (match) return { lat: match.lat, lon: match.lon };
    }
    const cityMatch = postalCodeCoords.find((c) => c.label.toLowerCase().includes(trimmed));
    if (cityMatch) return { lat: cityMatch.lat, lon: cityMatch.lon };
    return null;
  }

  const { sortedGarages, isNearbyFallback, searchCoords } = useMemo(() => {
    if (!searchQuery.trim()) {
      return { sortedGarages: garages, isNearbyFallback: false, searchCoords: null };
    }

    const q = searchQuery.trim().toLowerCase();
    const coords = getSearchCoords(searchQuery);

    const exactMatches = garages.filter(
      (g) =>
        g.city.toLowerCase().includes(q) ||
        g.name.toLowerCase().includes(q) ||
        g.postal_code.startsWith(q) ||
        (coords && g.latitude != null && g.longitude != null)
    );

    if (exactMatches.length > 0) {
      if (coords) {
        const withDistance = exactMatches
          .filter((g) => g.latitude != null && g.longitude != null)
          .map((g) => ({
            ...g,
            _distance: haversineKm(coords.lat, coords.lon, g.latitude!, g.longitude!),
          }))
          .sort((a, b) => (a._distance ?? 9999) - (b._distance ?? 9999));
        const withoutCoords = exactMatches.filter((g) => g.latitude == null || g.longitude == null);
        return {
          sortedGarages: [...withDistance, ...withoutCoords] as Garage[],
          isNearbyFallback: false,
          searchCoords: coords,
        };
      }
      return { sortedGarages: exactMatches, isNearbyFallback: false, searchCoords: null };
    }

    if (coords) {
      const withDistance = garages
        .filter((g) => g.latitude != null && g.longitude != null)
        .map((g) => ({
          ...g,
          _distance: haversineKm(coords.lat, coords.lon, g.latitude!, g.longitude!),
        }))
        .sort((a, b) => (a._distance ?? 9999) - (b._distance ?? 9999));
      const withoutCoords = garages.filter((g) => g.latitude == null || g.longitude == null);
      return {
        sortedGarages: [...withDistance, ...withoutCoords] as Garage[],
        isNearbyFallback: true,
        searchCoords: coords,
      };
    }

    return { sortedGarages: garages, isNearbyFallback: true, searchCoords: null };
  }, [garages, searchQuery]);

  async function handleBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.client_id || !bookingGarage) return;
    setSubmitting(true);

    const { error } = await supabase.from('appointments').insert({
      client_id: profile.client_id,
      vehicle_id: bookingVehicle || null,
      requested_date: bookingDate,
      requested_time: bookingTime,
      service_type: bookingService,
      description: bookingDesc || null,
      garage_id: bookingGarage.id,
      status: 'en_attente',
    });

    if (error) {
      toast.error('Erreur', { description: error.message });
    } else {
      toast.success(t('garages.toast.booked'), { description: t('garages.toast.bookedDesc', { name: bookingGarage.name }) });
      setBookingGarage(null);
      setBookingVehicle('');
      setBookingDate('');
      setBookingTime('09:00');
      setBookingService('');
      setBookingDesc('');
      router.push('/portal/rendez-vous');
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

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('garages.title')} description={t('garages.desc')} />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('garages.searchPlaceholder')}
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isNearbyFallback && searchQuery.trim() && (
        <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            {t('garages.noExactMatch', { query: searchQuery })}
          </p>
        </div>
      )}

      {sortedGarages.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MapPin className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">{t('garages.none')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sortedGarages.map((garage: any) => {
            const distance = garage._distance;
            const { rating, count } = computeRating(garage);
            const garageReviews = reviewsByGarage[garage.id] ?? [];
            const recentReviews = garageReviews.slice(0, 2);
            return (
              <Card key={garage.id} className="border-border/60 hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        {garage.logo_url ? (
                          <img src={garage.logo_url} alt={garage.name} className="h-12 w-12 rounded-xl object-cover" />
                        ) : (
                          <Wrench className="h-6 w-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{garage.name}</p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {garage.address}, {garage.postal_code} {garage.city}
                        </div>
                      </div>
                    </div>
                    {distance != null && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        <Navigation className="h-3 w-3 mr-1" />
                        {distance < 1 ? '<1 km' : `${Math.round(distance)} km`}
                      </Badge>
                    )}
                  </div>

                  {/* Rating */}
                  {rating > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      {renderStars(rating)}
                      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">({count} {t('garages.reviews')})</span>
                    </div>
                  )}

                  {garage.description && (
                    <p className="text-sm text-muted-foreground mb-3 leading-relaxed line-clamp-3">{garage.description}</p>
                  )}

                  {garage.services_offered.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {garage.services_offered.map((s: string) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Recent reviews */}
                  {recentReviews.length > 0 && (
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {t('garages.recentReviews')}
                      </div>
                      {recentReviews.map((review) => (
                        <div key={review.id} className="rounded-lg border border-border/40 bg-secondary/20 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{review.reviewer_name.split(' ')[0]}</span>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    'h-3 w-3',
                                    i < review.rating ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted-foreground/30'
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                          {review.comment && <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {garage.phone}
                    </div>
                    {garage.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {garage.email}
                      </div>
                    )}
                  </div>

                  <Button className="w-full" onClick={() => setBookingGarage(garage)}>
                    <CalendarClock className="h-4 w-4 mr-2" />
                    {t('garages.book')}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Booking dialog */}
      {bookingGarage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setBookingGarage(null)}>
          <div className="absolute inset-0" />
          <Card className="relative z-10 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display text-lg font-bold">{t('garages.bookingTitle')}</h3>
                  <p className="text-sm text-muted-foreground">{bookingGarage.name}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setBookingGarage(null)}>
                  <span className="text-xl">×</span>
                </Button>
              </div>

              <form onSubmit={handleBooking} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('garages.vehicle')}</label>
                  <select
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={bookingVehicle}
                    onChange={(e) => setBookingVehicle(e.target.value)}
                  >
                    <option value="">{t('garages.noVehicle')}</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>{v.brand} {v.model} — {v.license_plate}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('garages.date')} *</label>
                    <Input type="date" required value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('garages.time')} *</label>
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={bookingTime}
                      onChange={(e) => setBookingTime(e.target.value)}
                    >
                      {timeSlots.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('garages.service')} *</label>
                  <select
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    required
                    value={bookingService}
                    onChange={(e) => setBookingService(e.target.value)}
                  >
                    <option value="">{t('garages.selectService')}</option>
                    {serviceTypes.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('garages.description')}</label>
                  <textarea
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    rows={3}
                    placeholder={t('ph.problemPortal')}
                    value={bookingDesc}
                    onChange={(e) => setBookingDesc(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setBookingGarage(null)}>{t('common.cancel')}</Button>
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {t('garages.confirm')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
