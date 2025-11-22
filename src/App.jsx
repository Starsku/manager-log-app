import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs,
  initializeFirestore 
} from 'firebase/firestore';

// --- 1. RÉCUPÉRATION DES CLÉS ---
const getEnv = (key) => {
  try {
    // @ts-ignore
    return import.meta.env[key];
  } catch (e) {
    return "ERREUR_LECTURE_ENV";
  }
};

const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID"),
  measurementId: getEnv("VITE_FIREBASE_MEASUREMENT_ID")
};

export default function App() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('idle'); // idle, running, success, error

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { msg, type, time }]);
    console.log(`[${type.toUpperCase()}] ${msg}`);
  };

  const runTest = async () => {
    setLogs([]);
    setStatus('running');
    addLog("🚀 Démarrage du test complet...", "info");

    try {
      // ÉTAPE 1 : VÉRIFICATION CONFIG
      if (!firebaseConfig.apiKey) throw new Error("Clé API manquante. Vérifiez le fichier .env");
      if (!firebaseConfig.projectId) throw new Error("Project ID manquant. Vérifiez le fichier .env");
      addLog(`✅ Config chargée (Projet: ${firebaseConfig.projectId})`, "success");

      // ÉTAPE 2 : INITIALISATION
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      
      // Fix pour Codespaces / Réseaux restreints
      const db = initializeFirestore(app, {
          experimentalForceLongPolling: true,
          useFetchStreams: false, // Désactive les WebSockets
      });
      addLog("✅ Firebase initialisé (Mode LongPolling forcé)", "success");

      // ÉTAPE 3 : AUTHENTIFICATION
      addLog("⏳ Tentative de connexion anonyme...", "pending");
      const userCred = await signInAnonymously(auth);
      addLog(`✅ Connecté avec succès ! (UID: ${userCred.user.uid})`, "success");

      // ÉTAPE 4 : ÉCRITURE
      addLog("⏳ Tentative d'écriture dans Firestore (collection 'test_ping')...", "pending");
      const docRef = await addDoc(collection(db, "test_ping"), {
        message: "Ceci est un test",
        timestamp: new Date(),
        user: userCred.user.uid
      });
      addLog(`✅ Document écrit avec succès ! (ID: ${docRef.id})`, "success");

      // ÉTAPE 5 : LECTURE
      addLog("⏳ Tentative de relecture...", "pending");
      const querySnapshot = await getDocs(collection(db, "test_ping"));
      addLog(`✅ Lecture réussie ! ${querySnapshot.size} documents trouvés.`, "success");

      setStatus('success');
      addLog("🎉 TEST TERMINÉ AVEC SUCCÈS ! TOUT FONCTIONNE.", "success");

    } catch (error) {
      setStatus('error');
      addLog(`❌ ERREUR FATALE : ${error.message}`, "error");
      if (error.code) addLog(`Code erreur: ${error.code}`, "error");
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'monospace', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Testeur de Connexion Firebase</h1>
      
      <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <p>Ce script va tester chaque étape de la connexion.</p>
        <button 
          onClick={runTest} 
          disabled={status === 'running'}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: status === 'running' ? '#ccc' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: status === 'running' ? 'not-allowed' : 'pointer'
          }}
        >
          {status === 'running' ? 'Test en cours...' : 'Lancer le Diagnostic'}
        </button>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ backgroundColor: '#eee', padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>
          Journal d'exécution
        </div>
        <div style={{ padding: '20px', height: '400px', overflowY: 'auto', backgroundColor: '#1e1e1e', color: '#fff' }}>
          {logs.length === 0 && <span style={{ color: '#666' }}>En attente du lancement...</span>}
          {logs.map((log, index) => (
            <div key={index} style={{ marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
              <span style={{ color: '#888', marginRight: '10px' }}>[{log.time}]</span>
              <span style={{ 
                color: log.type === 'error' ? '#ff6b6b' : 
                       log.type === 'success' ? '#51cf66' : 
                       log.type === 'pending' ? '#fcc419' : '#fff' 
              }}>
                {log.msg}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}