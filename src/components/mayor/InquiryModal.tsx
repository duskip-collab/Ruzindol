import React, { useState, useRef, useEffect } from 'react';
import { Image, Lock, Globe, AlertCircle, MapPin, Camera, Loader2, X, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { triggerHaptic } from '@/lib/haptics';
import { compressImage } from '@/lib/compress-image';
import { cn } from '@/lib/utils';

// Rovnaké pravidlo ako RLS politika v databáze: pridávať podnet smie iba
// overený sused s aktivovaným invite kódom, alebo úradník / starosta / admin.
const OFFICIAL_ROLES = ['Starosta', 'Uradnik'] as const;

function canSubmitInquiry(profile: {
  is_active_neighbor?: boolean;
  invite_code?: string | null;
  role?: string;
  is_admin?: boolean;
  is_official?: boolean;
} | null): boolean {
  if (!profile) return false;

  // Kontrola, či ide o manažéra / úradníka / admina
  const isManager = 
    profile.is_admin === true || 
    profile.is_official === true || 
    (!!profile.role && (OFFICIAL_ROLES as readonly string[]).includes(profile.role));

  // Kontrola, či ide o aktívneho suseda alebo suseda s invite kódom
  const isVerifiedNeighbor = 
    profile.is_active_neighbor === true ||
    (typeof profile.invite_code === 'string' && profile.invite_code.trim() !== '');

  return isManager || isVerifiedNeighbor;
}

export interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORIES = [
  { id: 'odpad', label: 'Odpad' },
  { id: 'cesty_chodniky', label: 'Cesty' },
  { id: 'zelen', label: 'Zeleň' },
  { id: 'osvetlenie', label: 'Osvetlenie' },
  { id: 'urad_sluzby', label: 'Úrad' },
  { id: 'ine', label: 'Iné' },
] as const;

export const InquiryModal: React.FC<InquiryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { profile, loading: profileLoading } = useCurrentUser();
  const isEligible = canSubmitInquiry(profile);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('odpad');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [isAnonymousPublic, setIsAnonymousPublic] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Lock body overflow when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB for original)
    if (file.size > 5 * 1024 * 1024) {
      triggerHaptic('error');
      setErrorMessage('Fotka nesmie byť väčšia ako 5 MB.');
      return;
    }

    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setImageFile(compressed.file);
      setImagePreview(compressed.previewUrl);
      setImageUrl('');
      setErrorMessage(null);
      triggerHaptic('success');
    } catch (err) {
      triggerHaptic('error');
      setErrorMessage(err instanceof Error ? err.message : 'Kompresia fotky zlyhala.');
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGetLocation = async () => {
    triggerHaptic('light');
    setLocationLoading(true);
    
    if (!navigator.geolocation) {
      triggerHaptic('error');
      setErrorMessage('Geolokácia nie je podporovaná v tomto prehliadači.');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        triggerHaptic('success');
        setErrorMessage(null);
        setLocationLoading(false);
      },
      (error) => {
        triggerHaptic('error');
        const message = 
          error.code === error.PERMISSION_DENIED
            ? 'Povolenie na geolokáciu bolo zamietnuté.'
            : error.code === error.POSITION_UNAVAILABLE
            ? 'Poloha nie je dostupná.'
            : 'Chyba pri získavaní polohy.';
        setErrorMessage(message);
        setLocationLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const uploadImageToStorage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `inquiry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = fileName;

    const { data, error } = await supabase.storage
      .from('inquiry-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;
    if (!data) throw new Error('Chyba pri nahrávaní fotky.');

    const { data: publicUrl } = supabase.storage
      .from('inquiry-images')
      .getPublicUrl(data.path);

    return publicUrl.publicUrl;
  };

  const handleSubmit = async () => {
    if (!isEligible) {
      triggerHaptic('error');
      setErrorMessage('Podnet môže odoslať iba overený sused s aktivovaným invite kódom.');
      return;
    }

    if (!title.trim() || !body.trim()) {
      triggerHaptic('error');
      setErrorMessage('Vyplňte prosím názov a text.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) throw new Error('Musíte byť prihlásený.');

      // Check if inquiries are enabled in app settings (with fallback)
      let inquiriesEnabled = true;
      try {
        const { data: settings, error: settingsError } = await supabase
          .from('app_settings')
          .select('inquiries_enabled')
          .maybeSingle();

        if (settingsError && settingsError.code !== 'PGRST116') {
          console.warn('Warning fetching app_settings:', settingsError);
        }

        inquiriesEnabled = settings?.inquiries_enabled !== false;
      } catch (err) {
        console.warn('Error checking inquiries_enabled, using fallback (true):', err);
        inquiriesEnabled = true;
      }

      if (!inquiriesEnabled) {
        throw new Error('Podnety sú v tejto chvíli vypnuté.');
      }

      // Upload image if provided
      let uploadedImageUrl: string | null = null;
      if (imageFile) {
        setUploading(true);
        uploadedImageUrl = await uploadImageToStorage(imageFile);
        setUploading(false);
      }

      const { error } = await supabase.from('mayor_inquiries').insert({
        user_id: userData.user.id,
        category,
        title: title.trim(),
        body: body.trim(),
        image_url: uploadedImageUrl || (imageUrl.trim() || null),
        is_public: isPublic,
        is_anonymous_public: isAnonymousPublic && isPublic,
        latitude,
        longitude,
        status: 'pending',
      });

      if (error) throw error;

      triggerHaptic('success');
      setTitle('');
      setBody('');
      setImageFile(null);
      setImagePreview(null);
      setImageUrl('');
      setIsPublic(true);
      setIsAnonymousPublic(false);
      setLatitude(null);
      setLongitude(null);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      triggerHaptic('error');
      setErrorMessage(err instanceof Error ? err.message : 'Chyba odoslania.');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[99] bg-black/40 backdrop-blur-sm dark:bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Fullscreen Modal Container */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="inquiry-modal-title"
            className="fixed inset-0 z-[100] flex flex-col h-full w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          >
            {/* HEADER - Fixed */}
            <div className="shrink-0 flex items-center justify-between gap-4 p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <h3 id="inquiry-modal-title" className="text-lg font-semibold">
                Podnet starostovi
              </h3>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting || uploading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors focus:outline-none disabled:opacity-50"
                aria-label="Zatvoriť"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
              {!profileLoading && !isEligible && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    Podnety môže odoslať iba overený sused s aktivovaným invite kódom. Aktivujte si
                    kód v profile alebo počkajte na schválenie.
                  </span>
                </div>
              )}

              {errorMessage && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-900 dark:text-slate-100">Kategória</label>
                <div className="grid grid-cols-3 gap-1">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setCategory(cat.id); }}
                      disabled={submitting || uploading}
                      className={cn(
                        'rounded-lg border p-2 text-[11px] font-medium text-center transition-colors disabled:opacity-50',
                        category === cat.id
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200'
                          : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="inquiry-title" className="block text-xs font-semibold mb-1 text-slate-900 dark:text-slate-100">Názov *</label>
                <input 
                  id="inquiry-title" 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="Názov podnetu" 
                  disabled={submitting || uploading}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="inquiry-body" className="block text-xs font-semibold mb-1 text-slate-900 dark:text-slate-100">Popis *</label>
                <textarea 
                  id="inquiry-body" 
                  rows={3} 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)} 
                  placeholder="Popíšte situáciu..." 
                  disabled={submitting || uploading}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 resize-none disabled:opacity-50"
                />
              </div>

              {/* Image Upload / Preview Section */}
              <div>
                <label className="block text-xs font-semibold mb-2 text-slate-900 dark:text-slate-100">Fotografia (voliteľne)</label>
                
                {imagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border-2 border-blue-300 dark:border-blue-700 bg-slate-100 dark:bg-slate-800">
                    <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover" />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={submitting || uploading || compressing}
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-white text-[10px]">
                      Fotka pripravená k odoslaniu (komprimovaná)
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {/* Gallery Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={submitting || uploading || compressing}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-colors disabled:opacity-50"
                    >
                      {compressing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Komprimám…
                        </>
                      ) : (
                        <>
                          <Image className="h-4 w-4" />
                          Galéria
                        </>
                      )}
                    </button>

                    {/* Camera Button */}
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={submitting || uploading || compressing}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-colors disabled:opacity-50"
                    >
                      {compressing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Komprimám…
                        </>
                      ) : (
                        <>
                          <Camera className="h-4 w-4" />
                          Fotit
                        </>
                      )}
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  disabled={submitting || uploading || compressing}
                  className="hidden"
                />

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  disabled={submitting || uploading || compressing}
                  className="hidden"
                />

                {/* Legacy URL input (fallback) */}
                <div className="mt-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Alebo vložte URL fotky..."
                    disabled={submitting || uploading || compressing || !!imagePreview}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Geolocation Section */}
              <div>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={submitting || uploading || locationLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 p-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors disabled:opacity-50"
                >
                  {locationLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Získavam polohu...
                    </>
                  ) : latitude && longitude ? (
                    <>
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Poloha: {latitude.toFixed(4)}, {longitude.toFixed(4)}
                    </>
                  ) : (
                    <>
                      <MapPin className="h-3.5 w-3.5" />
                      Pridať moju polohu (GPS)
                    </>
                  )}
                </button>
              </div>

              {/* Public/Anonymous and Private Section */}
              <div className="space-y-2 pt-2">
                {/* Public Toggle */}
                <div className="flex items-center justify-between p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    {isPublic ? (
                      <Globe className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Lock className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {isPublic ? 'Verejný podnet' : 'Súkromný podnet'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setIsPublic(!isPublic);
                      if (!isPublic) setIsAnonymousPublic(false);
                    }}
                    disabled={submitting || uploading}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50',
                      isPublic ? 'bg-emerald-600 dark:bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                    )}
                  >
                    <span
                      className={cn(
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200',
                        isPublic ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>

                {/* Anonymous Public Checkbox (only visible when public) */}
                {isPublic && (
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={isAnonymousPublic}
                      onChange={(e) => {
                        triggerHaptic('light');
                        setIsAnonymousPublic(e.target.checked);
                      }}
                      disabled={submitting || uploading}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                      Anonymný podnet pre verejnosť
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      (Úrad vidí tvoje meno)
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* FOOTER - Fixed Action Buttons */}
            <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-end gap-3 pb-safe">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting || uploading}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors active:scale-95 disabled:opacity-50"
              >
                Zrušiť
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || uploading || !isEligible}
                className="rounded-xl px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 transition-colors active:scale-95 disabled:opacity-50"
              >
                {submitting || uploading ? (uploading ? 'Nahrávam fotku...' : 'Odosielam...') : 'Odoslať'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default InquiryModal;