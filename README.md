## Config Supabase

1. Copie le fichier `.env.example` en `.env` à la racine du projet puis renseigne :
   - `SUPABASE_URL` : l’URL de ton projet Supabase (ex. `https://xxx.supabase.co`)
   - `SUPABASE_ANON_KEY` : la clé Anon disponible dans les paramètres API.
2. Ces variables sont injectées dans Expo via `app.config.ts` et accessibles dans le code depuis `Constants.expoConfig?.extra`.
3. Dans le tableau de bord Supabase, active l’authentification par lien magique (Email OTP) et configure l’URL de redirection si nécessaire.
4. Aujourd’hui l’application démarre sans authentification : tout utilisateur peut accéder aux écrans directement. Tu peux malgré tout laisser ces variables configurées pour préparer une future intégration Supabase (auth, realtime, etc.).
5. Active Realtime sur la table `items` et cree les colonnes `id` (uuid, primary key), `user_id` (uuid), `name` (text), `barcode` (text), `quantity` (numeric), `unit` (text), `purchase_date` (date), `expiry_date` (date), `location` (text), `notes` (text) et `updated_at` (timestamp).
