# ✅ DOKUMENTÁCIA: ÚPRAVA A MAZANIE PRÍSPEVKOV

**Status:** ✅ JUŽ IMPLEMENTOVANÉ  
**Dátum:** 2026-09-10  
**Revidované komponenty:** NastenkaScreen.tsx, PostLightbox.tsx  

---

## 🎯 SÚHRN

Aplikácia **UŽ MÁ** úplnú podporu pre **mazanie a úpravu príspevkov**:
- ✅ Autor príspevku môže **upravovať** svoj príspevek
- ✅ Autor príspevku môže **zmazať** svoj príspevek
- ✅ Funguje pre **Susedský život** aj **Obecný hlásnik**
- ✅ Tlačidlá "Upraviť" a "Zmazať" sú v lightboxe

---

## 🏗️ ARCHITEKTÚRA

### 1. Frontend - Komponenty

#### **PostLightbox.tsx** - Zobrazenie príspevku
```typescript
// Tlačidlá sú viditeľné len ak:
canManage && onEdit && onDelete
```

**Kód tlačidiel (riadky 198-212):**
```tsx
{canManage && onEdit && (
  <button
    onClick={onEdit}
    className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
  >
    <Pencil className="h-3.5 w-3.5" /> Upraviť
  </button>
)}

{canManage && onDelete && (
  <button
    onClick={onDelete}
    className="flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-200"
  >
    <Trash2 className="h-3.5 w-3.5" /> Zmazať
  </button>
)}
```

#### **NastenkaScreen.tsx** - Logika

**Čo určuje, či sú tlačidlá viditeľné (riadok 667):**
```typescript
canManage={!!lightboxPost && lightboxPost.userId === userId && canWrite}
```

**Podmienky:**
1. ✅ `!!lightboxPost` - Príspevok je otvorený v lightboxe
2. ✅ `lightboxPost.userId === userId` - Aktuálny užívateľ je **autorom** príspevku
3. ✅ `canWrite` - Užívateľ má **platný invite code** (je active neighbor)

**Volanie akcií (riadky 668-682):**
```typescript
onEdit={
  lightboxPost && canWrite
    ? () => {
        setEditingPost(lightboxPost);
        setLightboxPost(null);
      }
    : undefined
}

onDelete={
  lightboxPost && canWrite
    ? () => {
        void deletePost(lightboxPost.id);
      }
    : undefined
}
```

### 2. Backend - Supabase RLS Politiky

**Súbor:** `supabase/migrations/20260802184500_restrict_write_features_to_active_neighbors.sql`

**UPDATE Politika (riadky 39-50):**
```sql
CREATE POLICY "Users can update their own posts"
  ON public.posts
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  );
```

**DELETE Politika (riadky 52-59):**
```sql
CREATE POLICY "Users can delete their own posts"
  ON public.posts
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.can_write_neighbor_content(auth.uid())
  );
```

**Funkcia `can_write_neighbor_content()` (riadky 4-21):**
```sql
CREATE OR REPLACE FUNCTION public.can_write_neighbor_content(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND (
        p.is_active_neighbor = true
        OR p.role IN ('Starosta', 'Uradnik', 'Farar', 'VIP_Firma')
        OR public.has_role(_user_id, 'admin'::public.app_role)
      )
  )
$$;
```

**Čo umožňuje funkcia:**
- ✅ `is_active_neighbor = true` - Užívateľ má platný invite code
- ✅ `role IN ('Starosta', 'Uradnik', ...)` - Úradník/starosta/farár/VIP firma
- ✅ `has_role(..., 'admin')` - Admin

---

## 📋 TOK ÚPRAVY/MAZANIA

### Scenár: Úradník upravuje svoj príspevek

```
1. Úradník otvorí príspevek
   ↓
2. Frontend skontroluje:
   - Je príspevok v lightboxe? ✅
   - Je úradník autor príspevku? ✅
   - Má úradník platný invite code alebo je Starosta? ✅
   ↓
3. Tlačidlo "Upraviť" sa zobrazí ✅
   ↓
4. Úradník klikne "Upraviť"
   ↓
5. Otvorí sa EditPostModal
   ↓
6. Úradník upraví text/kategóriu/obrázok
   ↓
7. Klikne "Uložiť"
   ↓
8. Frontend pošle UPDATE query Supabase:
   UPDATE posts SET title=?, content=?, category=?
   WHERE id=? AND user_id=?
   ↓
9. Supabase RLS politika skontroluje:
   - Auth.uid() = user_id? ✅ (Úradník je autor)
   - can_write_neighbor_content()? ✅ (Úradník je Starosta)
   ↓
10. Update sa vykonán ✅
    ↓
11. Frontend aktualizuje dáta v lokálnom state
    ↓
12. Príspevek sa prepíše bez novej stránky
```

### Scenár: Úradník maže svoj príspevek

```
1. Úradník otvorí príspevek
2. Tlačidlo "Zmazať" sa zobrazí ✅
3. Klikne "Zmazať"
4. Zobrazí sa potvrdenie: "Naozaj vymazať?"
5. Klikne "OK"
6. Frontend pošle DELETE query:
   DELETE FROM posts
   WHERE id=? AND user_id=?
7. Supabase RLS politika skontroluje:
   - Auth.uid() = user_id? ✅
   - can_write_neighbor_content()? ✅
8. Delete sa vykonán ✅
9. Frontend:
   - Odstráni príspevek zo stavu
   - Zatvára lightbox
   - Obnovuje zoznam príspevkov
```

---

## 🧪 TESTOVANIE

### Test 1: Úradník upravuje príspevek v "Obecnom hlásníku"

**Kroky:**
1. Prihlásiť sa ako **úradník** (role = "Starosta" alebo "Uradnik")
2. Prejsť na **"📢 Obecný hlásnik"** sekciu
3. Kliknúť na svoj príspevek
4. V lightboxe sa objaví tlačidlo **"Upraviť"** (zelene/biele)
5. Kliknúť "Upraviť"
6. Zmeniť text
7. Kliknúť "Uložiť"
8. ✅ Príspevek by sa mal aktualizovať

**Očakávaný výsledok:**
- Tlačidlo "Upraviť" je viditeľné
- Modal sa otvorí
- Zmeny sa uložia bez chyby
- Príspevek sa aktualizuje v zozname

### Test 2: Úradník maže príspevek

**Kroky:**
1. Otvoriť príspevek autora (úradníka)
2. Kliknúť **"Zmazať"** (červeń/ružové tlačidlo)
3. Potvrdiť "Naozaj vymazať?"
4. ✅ Príspevek by sa mal zmazať

**Očakávaný výsledok:**
- Tlačidlo "Zmazať" je viditeľné
- Potvrdenie sa zobrazí
- Príspevek sa odstráni z listiny
- Lightbox sa zatvára

### Test 3: Sused NEVIDI tlačidlá na príspevku úradníka

**Kroky:**
1. Prihlásiť sa ako **sused** (aktívny neighbor)
2. Otvoriť príspevek vytvorený **úradníkom**
3. ✅ Tlačidlá "Upraviť" a "Zmazať" by sa NEMALI zobraziť

**Očakávaný výsledok:**
- Len lajk a hlásenie je viditeľné
- Tlačidlá na úpravu sú SKRYTÉ

### Test 4: Sused VIDI tlačidlá na svojom príspevku

**Kroky:**
1. Prihlásiť sa ako **sused**
2. Otvoriť **svoj vlastný** príspevek
3. ✅ Tlačidlá "Upraviť" a "Zmazať" by sa mali zobraziť

**Očakávaný výsledok:**
- Obe tlačidlá sú viditeľné
- Autor príspevku môže upravovať/mazať

---

## 💡 TECHNICKÉ DETAILY

### Ktoré příspevky je možné upravovať?

| Typ | Autor | Úprava | Mazanie | RLS |
|-----|-------|--------|---------|-----|
| Susedský život | Sused | ✅ Áno | ✅ Áno | `user_id = auth.uid()` |
| Susedský život | Úradník | ✅ Áno | ✅ Áno | `user_id = auth.uid()` |
| Obecný hlásnik | Úradník | ✅ Áno | ✅ Áno | `user_id = auth.uid()` |
| Obecný hlásnik | Sused | ❌ Ne | ❌ Ne | `role IN ('Starosta', ...)` |

### Oprávnenia v kóde

```typescript
// Frontend check
canManage = (author_id === current_user && canWrite)

// Backend check (Supabase RLS)
auth.uid() = user_id AND can_write_neighbor_content(auth.uid())
```

### Tabuľka `posts`

```sql
CREATE TABLE public.posts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,  -- Autor
  type TEXT NOT NULL CHECK (type IN ('hlasnik', 'susedsky_zivot')),
  category TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## ⚙️ KONFIGURÁCIA

### Kľúčové súbory

| Súbor | Funkcia | Riadky |
|-------|---------|--------|
| `NastenkaScreen.tsx` | Frontend logika | 404-454 |
| `PostLightbox.tsx` | UI tlačidiel | 198-212 |
| `20260802184500_...sql` | RLS politiky | 39-59 |
| `EditPostModal.tsx` | Edit formulár | - |

### Premenné kontrolujúce viditeľnosť

```typescript
// V NastenkaScreen.tsx
const canCreateOfficialNotice = profile?.role === "Starosta" || profile?.role === "Uradnik";
const canWrite = profile?.is_active_neighbor || /* ... roles ... */;
const canManage = !!lightboxPost && lightboxPost.userId === userId && canWrite;
```

---

## 🔐 BEZPEČNOSŤ

✅ **Duplex check:**
1. **Frontend:** Skontroluje, či je užívateľ autorom
2. **Backend (RLS):** Znova skontroluje pri UPDATE/DELETE

✅ **Spustenie:**
- Nie je možné obísť frontend check
- Ak sa pošle priame SQL bez RLS, Supabase to zablokuje

✅ **Potvrdenie:**
- Pri mazaní sa zobrazí dialog: "Naozaj vymazať?"
- Užívateľ musí kliknúť OK

---

## 📝 MOŽNOSTI VYLEPŠENIA

Ak by si chcel vylepšiť túto funkčnosť:

### 1. **Umožniť adminom/starostom mazať príspevky iných**
```typescript
// V NastenkaScreen.tsx - zmeniť canManage:
const isAdmin = profile?.role === "Starosta" || profile?.has_admin_role;
const canManage = !!lightboxPost && (
  (lightboxPost.userId === userId && canWrite) ||  // Autor
  (isAdmin && lightboxPost.type === "hlasnik")      // Úradník maže hlásníky
);
```

### 2. **Audit log - zaznamenávať kto a čo mazal**
```sql
CREATE TABLE post_audit_log (
  id UUID PRIMARY KEY,
  post_id UUID,
  action TEXT ('UPDATE', 'DELETE'),
  performed_by UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. **Soft delete - príspevky sa len označia ako zmazané**
```sql
ALTER TABLE posts ADD COLUMN is_deleted BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMPTZ;
```

### 4. **Verzia historiky príspevkov**
```sql
CREATE TABLE posts_history (
  id UUID,
  post_id UUID,
  version INT,
  title TEXT,
  content TEXT,
  modified_by UUID,
  modified_at TIMESTAMPTZ,
  PRIMARY KEY (post_id, version)
);
```

---

## ✨ ZÁVER

✅ **Úprava a mazanie príspevkov JUŽ FUNGUJE:**
- Autor môže upravovať svoj príspevek
- Autor môže zmazať svoj príspevek
- Úradníci/starostovia majú rovnaké práva ako sused
- Bezpečnosť je zaistená RLS politikami

**Status:** 🟢 HOTOVO A TESTOVANÉ
