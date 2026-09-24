'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Camera, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';
import type { OrPhoto } from '@/lib/types/database';

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface OrPhotosSectionProps {
  repairOrderId: string;
  garageId: string;
  readOnly?: boolean;
}

export function OrPhotosSection({ repairOrderId, garageId, readOnly = false }: OrPhotosSectionProps) {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [photos, setPhotos] = useState<OrPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPhotos();
  }, [repairOrderId]);

  async function fetchPhotos() {
    setLoading(true);
    const { data, error } = await supabase
      .from('or_photos')
      .select('*')
      .eq('repair_order_id', repairOrderId)
      .order('created_at', { ascending: true });
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
      setPhotos([]);
      setLoading(false);
      return;
    }
    const photoList = data as OrPhoto[] ?? [];
    setPhotos(photoList);

    const urls: Record<string, string> = {};
    for (const photo of photoList) {
      const { data: signed } = await supabase
        .storage
        .from('or-photos')
        .createSignedUrl(photo.storage_path, 3600);
      if (signed?.signedUrl) {
        urls[photo.id] = signed.signedUrl;
      }
    }
    setSignedUrls(urls);
    setLoading(false);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (photos.length + files.length > MAX_PHOTOS) {
      toast.error(t('orPhotos.maxPhotos', { max: MAX_PHOTOS }));
      e.target.value = '';
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('orPhotos.onlyImages'));
        e.target.value = '';
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t('orPhotos.fileTooLarge', { max: '5 MB' }));
        e.target.value = '';
        return;
      }
    }

    setUploading(true);
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const fileName = `${garageId}/${repairOrderId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('or-photos')
        .upload(fileName, file, { contentType: file.type });
      if (uploadError) {
        toast.error(t('orPhotos.uploadError'), { description: uploadError.message });
        continue;
      }
      const { error: insertError } = await supabase.from('or_photos').insert({
        repair_order_id: repairOrderId,
        garage_id: garageId,
        storage_path: fileName,
        uploaded_by: profile?.id ?? null,
      });
      if (insertError) {
        toast.error(t('orPhotos.uploadError'), { description: insertError.message });
      }
    }
    e.target.value = '';
    setUploading(false);
    fetchPhotos();
  }

  async function handleDelete(photo: OrPhoto) {
    const { error: storageError } = await supabase.storage
      .from('or-photos')
      .remove([photo.storage_path]);
    if (storageError) {
      toast.error(t('orPhotos.deleteError'), { description: storageError.message });
      return;
    }
    const { error: dbError } = await supabase
      .from('or_photos')
      .delete()
      .eq('id', photo.id);
    if (dbError) {
      toast.error(t('orPhotos.deleteError'), { description: dbError.message });
      return;
    }
    toast.success(t('orPhotos.deleted'));
    fetchPhotos();
  }

  const canDelete = (photo: OrPhoto) => {
    if (readOnly) return false;
    if (profile?.role === 'admin') return true;
    if (profile?.role === 'super_admin') return true;
    return photo.uploaded_by === profile?.id;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold">{t('orPhotos.title')}</p>
        <span className="text-xs text-muted-foreground">{photos.length}/{MAX_PHOTOS}</span>
      </div>

      {!readOnly && photos.length < MAX_PHOTOS && (
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
            {t('orPhotos.takePhoto')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => galleryInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
            {t('orPhotos.choosePhotos')}
          </Button>
        </div>
      )}

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('orPhotos.none')}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group rounded-lg overflow-hidden border border-border/40">
              {signedUrls[photo.id] && (
                <img
                  src={signedUrls[photo.id]}
                  alt={photo.caption ?? ''}
                  className="w-full h-24 object-cover cursor-pointer"
                  onClick={() => setLightboxUrl(signedUrls[photo.id])}
                />
              )}
              {canDelete(photo) && (
                <button
                  onClick={() => handleDelete(photo)}
                  className="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button className="absolute top-4 right-4 text-white p-2" onClick={() => setLightboxUrl(null)}>
            <X className="h-6 w-6" />
          </button>
          <img src={lightboxUrl} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg" />
        </div>
      )}
    </div>
  );
}
