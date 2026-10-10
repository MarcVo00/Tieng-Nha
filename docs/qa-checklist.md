# Checklist QA sur appareils réels et préparation du cadeau

À faire **après** `docs/deploy.md` (production en ligne et test de fumée réussi). Marc la déroule sur l'appareil le plus probable de la personne qui reçoit le cadeau, plus un autre appareil (idéalement le PC).

Dans chaque case : ✓ (OK), ✗ (problème, avec une note) ou n/a.

## Préparation du cadeau

- [ ] **Code d'invitation** choisi et déjà inséré dans la base de production (`select * from public.groups;` dans le SQL Editor de Supabase). Facile à dicter, sans caractères ambigus (0/O, 1/l).
- [ ] **Message d'accueil** : variable Netlify `VITE_WELCOME_MESSAGE` renseignée avec le message d'anniversaire, puis site redéployé (les variables `VITE_*` sont lues au build).
- [ ] **Groupe créé** et visible (une seule ligne « Famille » attendue).
- [ ] **Carte imprimée (facultatif)** : l'URL de production, un **QR code** pointant vers cette URL (n'importe quel générateur de QR gratuit) et le code d'invitation. Ajoute une phrase d'aide à l'installation (iPhone : Safari → Partager → Sur l'écran d'accueil ; Android : Chrome → menu ⋮ → Installer l'application).
- [ ] Les proches sont prévenus que l'e-mail de code peut atterrir dans les spams ; sans SMTP personnalisé, inscription par petits groupes.

## Tableau de tests

| # | Vérification | iPhone (Safari → installée) | Android (Chrome → installée) | PC (Chrome) |
|---|---|---|---|---|
| 1 | Installation depuis les instructions d'onboarding ; icône et nom corrects | | | |
| 2 | E-mail de code reçu en moins d'1 min ; le code fonctionne dans l'app installée | | | |
| 3 | Test d'appareil : voix vietnamienne présente (sinon suivre le texte d'aide, puis retester) | | | |
| 4 | Reconnaissance vocale : dire « Xin chào » → reconnu (ou enregistreur de secours proposé) | | | |
| 5 | Leçon 1 terminée ; XP, série et toast de badge affichés ; transitions fluides | | | |
| 6 | Mode avion : leçon 2 jouable ; retour en ligne → l'indicateur de synchronisation disparaît | | | |
| 7 | Second compte (un autre proche) visible au classement ; podium correct | | | |
| 8 | Dialogue d01 à la voix et au toucher | | | |
| 9 | Mode sombre (système) lisible ; diacritiques jamais coupés | | | |
| 10 | Nouveau déploiement → bannière « Nouvelle version disponible » → la mise à jour fonctionne | | | |
| 11 | Examen verrouillé avant 10 leçons (tester l'examen complet sur un compte de test en finissant les leçons, ou passer) | | | |
| 12 | Téléchargement du certificat PNG (si examen réussi) | | | |

Conseils :
- Ligne 6 : ouvre la leçon 2 une fois en ligne avant de couper le réseau, et note si le contenu était déjà en cache.
- Ligne 10 : fais un petit changement (par exemple modifie `VITE_WELCOME_MESSAGE`) et redéploie sur Netlify, puis rouvre l'app installée sans la désinstaller.
- Lignes 11 et 12 : utilise un **compte de test** (pas celui du cadeau) pour ne pas fausser le classement ; supprime-le ensuite avec la fonction de suppression de compte de l'app.

## Critère d'acceptation

Toutes les lignes ✓ sur **au moins un mobile (iPhone ou Android) + le PC**, ou bien des problèmes connus documentés ci-dessous et acceptés par Marc.

## Problèmes connus acceptés

| Ligne | Appareil | Description | Accepté par Marc (oui/non) |
|---|---|---|---|
| | | | |

## Signaler un problème à Claude

Pour chaque ✗, envoie à Claude un message avec :

1. le **numéro de ligne** et l'**appareil** (modèle, version d'iOS ou d'Android, navigateur) ;
2. ce que tu as fait, ce que tu attendais, ce qui s'est passé ;
3. une **capture d'écran** ou une courte vidéo, l'heure approximative et l'e-mail utilisé (pour retrouver les lignes côté Supabase) ;
4. si un message d'erreur s'affiche : son texte exact.

Chaque bug devient une petite tâche corrective : Claude écrit d'abord un test qui échoue, corrige, puis tu redéploies et refais la ligne concernée. Garde cette checklist à jour avec les résultats.
