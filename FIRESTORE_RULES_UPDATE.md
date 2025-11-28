# Mise à jour des règles Firestore pour la page Admin

## Problème
Les administrateurs ne peuvent pas voir les statistiques (employés, notes, bilans) des autres utilisateurs dans la page Administration, car les règles Firestore actuelles ne leur donnent pas accès aux sous-collections des autres utilisateurs.

## Solution
Mettre à jour les règles Firestore pour permettre aux administrateurs de **lire** toutes les données et de **modifier le statut isPaid** des utilisateurs.

## Instructions

### 1. Accéder à la console Firebase
1. Allez sur https://console.firebase.google.com/
2. Sélectionnez votre projet
3. Dans le menu de gauche, cliquez sur **Firestore Database**
4. Cliquez sur l'onglet **Règles**

### 2. Copier les nouvelles règles
Copiez le contenu du fichier `firestore.rules.suggestion` et remplacez vos règles actuelles.

### 3. Principales modifications

#### a) Lecture pour tous les admins
Les nouvelles règles ajoutent `|| isAdmin()` aux permissions de lecture :

```javascript
match /artifacts/{appId}/users/{userId}/employees/{employeeId} {
  allow read: if request.auth.uid == userId || isAdmin();
  allow write: if request.auth.uid == userId;
}
```

#### b) Modification du statut isPaid par les admins
Les admins peuvent modifier **uniquement** le champ `isPaid` dans les profils :

```javascript
match /artifacts/{appId}/users/{userId}/profile/{document} {
  allow read: if request.auth.uid == userId || isAdmin();
  allow write: if (request.auth.uid == userId && 
                  (!request.resource.data.keys().hasAny(['isAdmin']) || 
                   request.resource.data.isAdmin == resource.data.isAdmin)) ||
                  (isAdmin() && 
                   request.resource.data.diff(resource.data).affectedKeys().hasOnly(['isPaid', 'lastLoginAt', 'updatedAt']));
}
```

Cela s'applique à toutes les collections :
- `employees` (employés)
- `notes` (notes)
- `reports` (bilans)
- `trainings` (formations)
- `readings` (lectures)
- `okrs` (objectifs)
- `settings` (paramètres)

### 4. Publier les règles
1. Cliquez sur **Publier** en haut de l'éditeur
2. Attendez 30 secondes pour la propagation
3. Actualisez la page Admin dans votre application

## Sécurité
✅ Les admins peuvent **lire** toutes les données (nécessaire pour les statistiques)  
✅ Les admins peuvent **modifier uniquement isPaid** (case à cocher Payant)  
✅ Les admins ne peuvent **PAS modifier isAdmin** (protection contre l'auto-promotion)  
✅ Les utilisateurs normaux ne peuvent toujours voir que leurs propres données  
✅ Les utilisateurs ne peuvent PAS se donner le statut admin  
✅ Le statut admin est protégé dans `systems/admins/users/{uid}` (write: false)

## Vérification
Après la mise à jour :
1. Connectez-vous en tant qu'administrateur
2. Allez sur la page Administration
3. Cliquez sur "Actualiser"
4. Les comptages doivent maintenant s'afficher pour tous les utilisateurs
5. Vous pouvez cocher/décocher la case "Payant" pour chaque utilisateur
