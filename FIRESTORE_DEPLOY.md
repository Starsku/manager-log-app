# Déploiement des règles Firestore

## Problème identifié
Les nouveaux utilisateurs ne peuvent pas créer leur profil car les règles Firestore actuelles en production bloquent la création.

## Solution
Les règles ont été corrigées dans `firestore.rules` pour permettre aux utilisateurs de créer leur propre profil avec `isPaid: false`.

## Étapes pour déployer

### 1. Trouver votre Project ID
Allez dans Firebase Console → Paramètres du projet → ID du projet

### 2. Configurer Firebase CLI
```bash
# Installer Firebase CLI (si nécessaire)
npm install -g firebase-tools

# Se connecter
firebase login

# Configurer le projet (remplacer YOUR_PROJECT_ID)
# Éditer .firebaserc et remplacer YOUR_PROJECT_ID par votre vrai ID
```

### 3. Déployer les règles
```bash
firebase deploy --only firestore:rules
```

## Alternative : Déploiement manuel via Console
Si vous ne pouvez pas utiliser Firebase CLI :

1. Allez dans Firebase Console → Firestore Database → Règles
2. Copiez le contenu de `firestore.rules`
3. Collez-le dans l'éditeur
4. Cliquez sur "Publier"

## Changement important dans les règles

**Avant** :
```
function isNotModifyingSensitiveFields() {
  return (!('isPaid' in request.resource.data) || request.resource.data.isPaid == resource.data.isPaid)
      && (!('isAdmin' in request.resource.data));
}
```

**Après** :
```
function isNotModifyingSensitiveFields() {
  // Lors de la CREATION (resource == null), on autorise isPaid: false
  return resource == null 
    ? (request.resource.data.isPaid == false && !('isAdmin' in request.resource.data))
    : ((!('isPaid' in request.resource.data) || request.resource.data.isPaid == resource.data.isPaid)
       && (!('isAdmin' in request.resource.data)));
}
```

Cela permet la création de profil avec `isPaid: false` tout en empêchant les utilisateurs de se donner `isPaid: true`.
