# Implementácia Mazania Podnetov (Mayor Inquiries)

## Prehľad
Bola implementovaná kompletná logika mazania podnetov s troma komponentami:
1. **Autori** môžu zmazať svoje vlastné podnety
2. **Starosta/Admin** môžu zmazať akýkoľvek podnet
3. Automatické **notifikácie** pre autorov keď ich podnet vymažeme

---

## SQL Migrácia
**Súbor:** `supabase/migrations/20260904131000_mayor_inquiries_delete_policy.sql`

### DELETE RLS Politika
```sql
CREATE POLICY "podnety_delete_author_or_manager" ON public.mayor_inquiries
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_inquiry_manager(auth.uid())
  );
```

**Pravidlá:**
- Autori (`user_id = auth.uid()`) môžu zmazať svoje podnety
- Starosta/Admin (`is_inquiry_manager(auth.uid())`) môžu zmazať ľubovoľné podnety

### Trigger na Notifikácie
Keď **admin/úradník** (nie autor) zmaže podnet, automaticky sa vytvorí notifikácia:

```sql
CREATE OR REPLACE FUNCTION public.handle_inquiry_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if deleter is an official (not the author)
  SELECT public.is_inquiry_manager(auth.uid()) INTO deleter_is_manager;

  IF deleter_is_manager AND OLD.user_id != auth.uid() THEN
    -- Get deleter's name for notification
    SELECT name INTO deleter_name FROM public.profiles WHERE id = auth.uid();

    -- Create notification for inquiry author
    INSERT INTO public.notifications (
      user_id, type, title, body, ref_id, priority, is_critical
    ) VALUES (
      OLD.user_id,
      'inquiry_deleted',
      'Váš podnet bol vymazaný',
      'Podnet "' || LEFT(OLD.title, 50) || '..." bol vymazaný. Dôvod: ' || COALESCE(deleter_name, 'Správca obce'),
      OLD.id,
      'high',
      true
    );
  END IF;
  RETURN OLD;
END;
$$;
```

**Ako funguje:**
- Spustí sa pred zmazaním podnetu (BEFORE DELETE)
- Kontroluje či mazačom je admin/úradník a či nie je autorom
- Vytvorí notifikáciu len keď admin zmaže cudzi podnet
- Autorov mazanie sama seba nemá notifikáciu

---

## React Komponenty

### 1. InquiryCard.tsx (Zmeny)

**Nové importy:**
- `useState` pre state mazania
- `Trash2`, `Loader2` ikony
- `supabase` klient
- `useCurrentUser` hook
- `triggerHaptic` haptic feedback

**Nové props:**
```typescript
export interface InquiryCardProps {
  inquiry: MayorInquiry;
  className?: string;
  onDeleted?: () => void;  // Callback na refresh
}
```

**Nová logika:**
```typescript
const { userId } = useCurrentUser();
const [isDeleting, setIsDeleting] = useState(false);
const isAuthor = userId === inquiry.user_id;

const handleDelete = async () => {
  if (!confirm('Naozaj chceš zmazať tento podnet? Túto akciu sa nedá vrátiť.')) return;

  setIsDeleting(true);
  try {
    const { error } = await supabase
      .from('mayor_inquiries')
      .delete()
      .eq('id', inquiry.id);

    if (error) throw error;
    onDeleted?.();  // Refresh parent list
  } catch (err) {
    alert('Nepodarilo sa zmazať podnet: ' + err.message);
  } finally {
    setIsDeleting(false);
  }
};
```

**Nový Footer s Delete Tlačidlom:**
```jsx
{/* Delete button for author */}
{isAuthor && (
  <button
    onClick={handleDelete}
    disabled={isDeleting}
    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-medium transition-colors disabled:opacity-50"
  >
    {isDeleting ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : (
      <Trash2 className="h-3.5 w-3.5" />
    )}
    {isDeleting ? 'Mazanie...' : 'Zmazať podnet'}
  </button>
)}
```

---

### 2. InquiriesScreen.tsx (Zmeny)

**Callback na delete:**
```jsx
{filteredInquiries.map((inq) => (
  <InquiryCard 
    key={inq.id} 
    inquiry={inq} 
    onDeleted={loadInquiries}  // Refresh list
  />
))}
```

---

### 3. MayorInquiriesDashboard.tsx (Zmeny)

**Zmena tlačidla "Vyriešené":**
Keď admin zmení stav podnetu na `status = 'resolved'`, podnet sa **automaticky zmaže** namiesto uloženia:

```typescript
const handleSubmitAnswers = async () => {
  // ... validation

  for (const inquiryId of selectedInquiries) {
    const status = statuses[inquiryId] || 'pending';

    // If status is "resolved", delete the inquiry
    if (status === 'resolved') {
      const { error } = await supabase
        .from('mayor_inquiries')
        .delete()
        .eq('id', inquiryId);

      if (error) throw error;
    } else {
      // Otherwise update normally
      const { error } = await supabase
        .from('mayor_inquiries')
        .update({
          answer: answer || null,
          status,
          answered_at: answer ? new Date().toISOString() : null,
          answered_by: userId,
        })
        .eq('id', inquiryId);

      if (error) throw error;
    }
  }
};
```

---

## User Flow (Scenáre)

### Scenár 1: Autor maže svoj podnet
1. Autor otvorí InquiriesScreen
2. V karte svojho podnetu vidí tlačidlo **"Zmazať podnet"** (ružové)
3. Klikne na tlačidlo
4. Potvrdia vymazanie (`confirm` dialog)
5. Podnet sa vymaže
6. Zoznam sa obnoví (`onDeleted` callback)
7. **Bez notifikácie** (autor si to vymazal sám)

### Scenár 2: Admin zmaže podnet v MayorInquiriesDashboard
1. Admin otvorí MayorInquiriesDashboard (panel rolí)
2. Vyberie jeden/viacero podnetov
3. Zmení stav na **"Vyriešené"**
4. Klikne na **"Odoslať"**
5. Podnet sa zmaže (nie len update)
6. Autor podnetu dostane **notifikáciu**:
   - Typ: `inquiry_deleted`
   - Titulok: *"Váš podnet bol vymazaný"*
   - Správa: *"Podnet '...' bol vymazaný. Dôvod: [Meno Admina]"*
   - Priorita: `high`, `is_critical: true`

---

## Tabuľky a Funkcie

### Tabuľka: `notifications`
Už existujúca tabuľka s plnou RLS ochranou.

**Polia:**
- `user_id` - Komu ide notifikácia (author podnetu)
- `type` - `'inquiry_deleted'`
- `title` - Titulok notifikácie
- `body` - Dlhý text s opisom
- `ref_id` - ID vymazaného podnetu (pre referencu)
- `priority` - `'high'`
- `is_critical` - `true` (dôležitá notifikácia)

### Funkcia: `is_inquiry_manager(uuid)`
Už existuje v `20260910120000_fix_podnety_rls_visibility_and_insert.sql`

**Kontroluje či je používateľ:**
- `is_admin = true` v profiles
- `is_official = true` v profiles
- `role IN ('Starosta', 'Uradnik')` v profiles
- Má role `'admin'` v user_roles tabuľke

---

## Aplikovanie Migrácií

V Supabase Dashboard (SQL Editor):
```bash
1. Kopíruj obsah `20260904131000_mayor_inquiries_delete_policy.sql`
2. Vložte do SQL Editora
3. Klikните "Run"
```

Alebo cez CLI:
```bash
supabase migration up --project-ref <project-id>
```

---

## Testovanie

### Test 1: Autor maže svoj podnet
- [ ] Prihlás sa ako obvyklý užívateľ (nie admin)
- [ ] Vytvor nový podnet
- [ ] V InquiriesScreen by si mal vidieť "Zmazať podnet" tlačidlo
- [ ] Klikni naň → potvrď
- [ ] Podnet zmizne zo zoznamu

### Test 2: Admin zmaže podnet
- [ ] Prihlás sa ako Starosta/Admin
- [ ] Otvri panel rolí (RolePanels)
- [ ] Prejdi na "Správa Podnetov"
- [ ] Vyberte podnet a zmeniť stav na "Vyriešené"
- [ ] Klikni "Odoslať"
- [ ] Podnet sa vymaže
- [ ] Autor by mal dostať notifikáciu

### Test 3: Notifications
- [ ] Prihlás sa ako autor podnetu
- [ ] Otvri NotificationCenter
- [ ] Mali by si vidieť notifikáciu typu "inquiry_deleted" s červeným znakom (critical)

---

## Bezpečnosť

✅ **RLS Politika:** Iba autori a admin môžu mazať
✅ **Trigger je SECURITY DEFINER:** Spúšťa sa s full databázovými právami
✅ **Notifikácia nie pre autorov:** Len keď admin maže cudzi podnet
✅ **Konfirmačný dialog:** Pre autorský delete
✅ **Error handling:** Chyby sú zachytené a zobrazené

---

## Súbory Zmenené
1. ✅ `supabase/migrations/20260904131000_mayor_inquiries_delete_policy.sql` (nový)
2. ✅ `src/components/mayor/InquiryCard.tsx` (delete button + logika)
3. ✅ `src/components/mayor/MayorInquiriesDashboard.tsx` (auto-delete na "Vyriešené")
4. ✅ `src/screens/InquiriesScreen.tsx` (callback na refresh)

---

## Build Status
✅ **npm run build** — Bez chýb
✅ **TypeScript** — Všetky typy OK
✅ **Production bundle** — ~735KB gzip

---

## Poznámky

- Notifikácia sa vytvorí **vždy** keď admin zmaže, ale iba ak mazačom nie je autor
- Author si vie zmazať svoj podnet bez notifikácie (nie je to rušenie)
- Mazanie je **permanent** — nie je možné vrátiť
- RLS politika (`is_inquiry_manager`) už musí existovať v DB
- Trigger `handle_inquiry_deletion` je idempotentný (bezpečné re-apply)
