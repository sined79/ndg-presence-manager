# Gestion des Présences - École Notre-Dame des Grâces

## Description

Cette application web permet de gérer les présences des enfants à l'école Notre-Dame des Grâces pour l'année scolaire 2025-2026. Elle offre une interface simple et intuitive pour enregistrer les présences quotidiennes, visualiser un tableau de bord des coûts, configurer les enfants, consulter l'historique des présences et exporter les données.

L'application fonctionne entièrement côté client, en utilisant le stockage local du navigateur pour sauvegarder les données.

---

## Fonctionnalités principales

- **Enregistrement des présences** : Sélection d'un enfant et d'une date pour enregistrer les présences selon différents créneaux horaires et tarifs.
- **Tableau de bord** : Visualisation des coûts journaliers et mensuels ainsi que l'état de présence des enfants.
- **Gestion des enfants** : Ajout, affichage et suppression des enfants avec leurs informations (nom, classe, niveau, QR code).
- **Historique et rapports** : Consultation du calendrier des présences par mois, calcul des coûts, saisie de la facture Dynamix et affichage des différences.
- **Export CSV** : Export des données de présence du mois sélectionné au format CSV.
- **Réinitialisation des données** : Suppression complète des enfants et des présences enregistrées.
- **Interface responsive** et support du mode clair/sombre.

---

## Structure des fichiers

- `index.html` : Structure HTML de l'application avec les différents onglets et éléments interactifs.
- `style.css` : Feuille de style CSS complète, incluant la gestion des thèmes clair et sombre, la mise en page responsive et le design des composants.
- `app.js` : Script JavaScript principal contenant la classe `SchoolAttendanceApp` qui gère la logique métier, les interactions utilisateur, le stockage local et le rendu dynamique.

---

## Installation et utilisation

1. Cloner ou télécharger le projet.
2. Ouvrir le fichier `index.html` dans un navigateur moderne (Chrome, Firefox, Edge, Safari).
3. L'application se charge et initialise les données depuis le stockage local.
4. Utiliser les onglets pour naviguer entre les fonctionnalités.
5. Ajouter des enfants dans l'onglet "Enfants".
6. Enregistrer les présences dans l'onglet "Présences".
7. Consulter les coûts et l'état des enfants dans le "Tableau de bord".
8. Visualiser l'historique, saisir la facture et exporter les données dans l'onglet "Historique".

---

## Technologies utilisées

- HTML5
- CSS3 (avec variables CSS, media queries, mode sombre)
- JavaScript ES6+ (classe, modules, DOM, localStorage)

---

## Notes

- L'application fonctionne entièrement côté client, sans serveur.
- Les données sont stockées localement dans le navigateur, donc non partagées entre différents appareils.
- Les tarifs et périodes sont configurés dans le script `app.js`.
- Le code est structuré pour faciliter les évolutions et maintenances futures.

---

## Auteur

Développé pour moi-même et les parents de l'École Notre-Dame des Grâces.

---

## Licence

Projet libre à usage éducatif et personnel.