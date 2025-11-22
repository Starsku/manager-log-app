import React, { useState, useEffect } from 'react';
import { 
  Users, BookOpen, Plus, Save, Trash2, Sparkles, Menu, X, UserPlus, FileText, 
  ChevronRight, Briefcase, Loader2, AlertCircle, CheckCircle2, LogOut, Bot, 
  Settings, History, RefreshCw, Clock, Edit, Check, AlertTriangle, GraduationCap, 
  ExternalLink, Search, Book, Library, Target, Wand2, ArrowRight, PenTool,
  Wifi, Database, ShieldCheck, LogIn
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc, 
  query, 
  onSnapshot, 
  serverTimestamp, 
  where, 
  setDoc, 
  getDoc, 
  getDocs 
} from 'firebase/firestore';

// ==================================================================================
// 🔒 CONFIGURATION SÉCURISÉE 🔒
// ==================================================================================

// Utilitaire pour lire les variables d'environnement
const getEnv = (key) => {
  try {
    // @ts-ignore
    return import.meta.env[key];
  } catch (e) {
    return "";
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

const GEMINI_API_KEY = getEnv("VITE_GEMINI_API_KEY");
const appId = 'manager-log-prod';

// Initialisation Firebase
let app, auth, db;
let configError = null;

try {
    if (firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        // FIX CRITIQUE : Force le mode "Long Polling" pour éviter les blocages réseaux
        db = initializeFirestore(app, {
            experimentalForceLongPolling: true, 
            useFetchStreams: false,
        });
    } else {
        configError = "Clés API manquantes. Vérifiez votre fichier .env";
    }
} catch (e) {
    configError = "Erreur init Firebase: " + e.message;
    console.error(e);
}

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

// ==================================================================================
// CONSTANTES DE PROMPT PAR DÉFAUT
// ==================================================================================

const DEFAULT_REPORT_PROMPT = `Tu es un expert RH et un manager bienveillant mais rigoureux.
Voici les notes brutes prises au cours de l'année pour mon collaborateur : {{NOM}} (Poste : {{ROLE}}).

NOTES BRUTES :
{{NOTES}}

TA MISSION :
Rédige une évaluation annuelle formelle en Français, structurée et professionnelle.
Ne mentionne pas "d'après les notes", fais comme si tu avais tout observé toi-même.
Sois précis. Cite des exemples concrets tirés des notes pour justifier tes propos.

STRUCTURE REQUISE :
1. Synthèse globale de l'année (Ton général).
2. Points Forts et Réussites (Basé sur les notes positives).
3. Axes d'amélioration et Points de vigilance (Basé sur les notes "À améliorer", sois constructif).
4. Plan d'action suggéré pour l'année prochaine.
5. Conclusion motivante.`;

const DEFAULT_TRAINING_PROMPT = `Tu es un expert en Learning & Development.
Analyse les notes suivantes concernant un collaborateur ({{NOM}}, {{ROLE}}) pour identifier ses lacunes ou axes de progrès.

NOTES BRUTES :
{{NOTES}}

TA MISSION :
Suggère 3 à 5 thématiques de formation (LinkedIn Learning) pertinentes pour l'aider à progresser.
Pour chaque recommandation, explique brièvement pourquoi en te basant sur un fait noté.

FORMAT DE RÉPONSE ATTENDU (JSON UNIQUEMENT, sans markdown) :
[
  {
    "topic": "Titre court du sujet (ex: Gestion du temps)",
    "reason": "Explication basée sur les notes (ex: Retards fréquents notés en mai)",
    "keywords": "Mots clés pour la recherche (ex: Time management productivity)"
  }
]`;

const DEFAULT_READING_PROMPT = `Tu es un bibliothécaire expert en développement professionnel et management.
Analyse les notes suivantes concernant un collaborateur ({{NOM}}, {{ROLE}}).

NOTES BRUTES :
{{NOTES}}

TA MISSION :
Suggère exactement 3 livres (essais, business, psycho, tech) pertinents.
- Si les notes sont positives : des livres pour aller plus loin, inspirer, ou sur le leadership.
- Si les notes sont mitigées : des livres pour résoudre les problèmes identifiés (gestion du temps, communication, code clean...).

FORMAT DE RÉPONSE ATTENDU (JSON UNIQUEMENT, sans markdown) :
[
  {
    "title": "Titre du livre",
    "author": "Auteur",
    "reason": "Pourquoi ce livre ? (Basé sur un fait noté)",
    "keywords": "Mots clés pour recherche Amazon (Titre + Auteur)"
  }
]`;

const DEFAULT_OKR_PROMPT = `Tu es un coach expert en performance et management par objectifs (OKRs).
Analyse l'historique des notes de {{NOM}} ({{ROLE}}) ci-dessous pour comprendre ses défis et ses forces actuels.

NOTES BRUTES :
{{NOTES}}

TA MISSION :
Propose 3 Objectifs (Objectives) trimestriels pertinents, accompagnés pour chacun de 2 Résultats Clés (Key Results) mesurables.
Ces objectifs doivent aider le collaborateur à franchir un cap l'année prochaine.

FORMAT DE RÉPONSE ATTENDU (JSON UNIQUEMENT, sans markdown) :
[
  {
    "objective": "L'objectif inspirant (ex: Devenir un référent technique sur le projet X)",
    "keyResults": ["KR1 mesurable", "KR2 mesurable"],
    "rationale": "Pourquoi cet objectif ? (basé sur les notes)"
  }
]`;

const DEFAULT_REWRITE_PROMPT = `Tu es un expert en communication managériale. 
Reformule la note brute ci-dessous pour qu'elle soit factuelle, professionnelle, objective et constructive.
Elle doit pouvoir être lue par les RH ou le salarié sans causer d'offense, tout en gardant le fond du message intact.
Supprime l'argot, l'émotion excessive ou le jugement de valeur.

NOTE BRUTE : "{{CONTENT}}"

RÉPONSE (Le texte reformulé uniquement, sans guillemets) :`;

// ==================================================================================
// COMPOSANTS UI
// ==================================================================================

const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon, disabled = false, isLoading = false, type = 'button', size = 'md' }) => {
  const baseStyle = "flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-2 py-1 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-200",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
    magic: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-sm", 
    google: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-200 shadow-sm",
    linkedin: "bg-[#0a66c2] text-white hover:bg-[#004182] focus:ring-blue-800",
    amazon: "bg-[#FF9900] text-white hover:bg-[#e68a00] focus:ring-yellow-500 text-shadow-sm"
  };

  return (
    <button type={type} onClick={onClick} className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled || isLoading}>
      {isLoading ? <Loader2 size={size === 'sm' ? 14 : 18} className="mr-2 animate-spin" /> : Icon ? <Icon size={size === 'sm' ? 14 : 18} className="mr-2" /> : null}
      {children}
    </button>
  );
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 transform transition-all">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

const Badge = ({ type }) => {
    const styles = { 
        'Succès': 'bg-green-100 text-green-800 border-green-200', 
        'Amélioration': 'bg-orange-100 text-orange-800 border-orange-200', 
        'Neutre': 'bg-gray-100 text-gray-800 border-gray-200', 
        'Soft Skills': 'bg-purple-100 text-purple-800 border-purple-200', 
        'Technique': 'bg-blue-100 text-blue-800 border-blue-200' 
    };
    return <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${styles[type] || styles['Neutre']}`}>{type}</span>;
};

const SafeText = ({ content }) => {
  if (typeof content === 'string') return <>{content}</>;
  if (typeof content === 'number') return <>{content}</>;
  return <span className="text-xs text-gray-400 italic">(Format non supporté)</span>;
};

// --- ECRAN DE CONNEXION ---
const LoginScreen = ({ onLogin, error }) => (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-100">
            <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <BookOpen size={32} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">ManagerLog</h1>
            <p className="text-gray-500 mb-8">Connectez-vous pour accéder à votre espace de gestion.</p>
            
            <Button onClick={onLogin} variant="google" className="w-full py-3 flex justify-center gap-3 text-base">
                <LogIn size={18} />
                Continuer avec Google
            </Button>
            
            {error && (
                <div className="mt-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg text-left">
                    <strong>Erreur :</strong> {error}
                </div>
            )}
            
            <p className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400">
                Vos données sont privées et sécurisées via Google Auth.
            </p>
        </div>
    </div>
);


// ==================================================================================
// APPLICATION PRINCIPALE
// ==================================================================================

export default function ManagerLogApp() {
  // User State
  const [user, setUser] = useState(null);
  
  // Data State
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [notes, setNotes] = useState([]);
  const [reportsHistory, setReportsHistory] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [readings, setReadings] = useState([]);
  const [okrs, setOkrs] = useState([]); 
  
  // UI State
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [employeeTab, setEmployeeTab] = useState('journal'); 
  
  // Settings State
  const [settingsTab, setSettingsTab] = useState('report'); 
  const [prompts, setPrompts] = useState({
    report: DEFAULT_REPORT_PROMPT,
    training: DEFAULT_TRAINING_PROMPT,
    reading: DEFAULT_READING_PROMPT,
    okr: DEFAULT_OKR_PROMPT,
    rewrite: DEFAULT_REWRITE_PROMPT
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [diagStatus, setDiagStatus] = useState(null);
  const [authError, setAuthError] = useState(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  
  // Edit/Delete States
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [isDeletingEmployee, setIsDeletingEmployee] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editTag, setEditTag] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);

  // Note Creation State
  const [noteContent, setNoteContent] = useState('');
  const [noteTag, setNoteTag] = useState('Succès');
  const [noteCategory, setNoteCategory] = useState('Technique');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false); 

  // Feedback State
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // AI State
  const [generatedReport, setGeneratedReport] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingTraining, setIsGeneratingTraining] = useState(false);
  const [isGeneratingReading, setIsGeneratingReading] = useState(false);
  const [isGeneratingOkrs, setIsGeneratingOkrs] = useState(false); 

  // --- AUTHENTICATION ---

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
      if (!auth) return;
      setAuthError(null);
      const provider = new GoogleAuthProvider();
      try {
          await signInWithPopup(auth, provider);
      } catch (error) {
          console.error("Erreur Login:", error);
          setAuthError("Impossible de se connecter. Vérifiez la console Firebase.");
      }
  };

  const handleLogout = async () => {
      try {
          await signOut(auth);
          setSelectedEmployee(null);
          setView('dashboard');
      } catch (error) {
          console.error("Erreur déconnexion:", error);
      }
  };

  // --- DATA SYNC LISTENERS ---

  // 1. Load Settings
  useEffect(() => {
    if(!user || !db) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'promptConfig'), (s) => { 
        if(s.exists()) setPrompts(s.data()); 
    });
    return () => unsub();
  }, [user]);

  // 2. Load Employees
  useEffect(() => {
    if (!user || !db) return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'employees');
    const unsubscribe = onSnapshot(q, (s) => {
      setEmployees(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Load Sub-collections (Notes, Reports, etc.)
  useEffect(() => {
    if (!user || !selectedEmployee || !db) { 
        setNotes([]); setReportsHistory([]); setTrainings([]); setReadings([]); setOkrs([]); 
        return; 
    }
    
    const getQ = (c) => query(collection(db, 'artifacts', appId, 'users', user.uid, c), where('employeeId', '==', selectedEmployee.id));
    
    const unsubs = [
        onSnapshot(getQ('notes'), s => setNotes(s.docs.map(d => ({id:d.id,...d.data()})).sort((a,b)=>new Date(b.date)-new Date(a.date)))),
        onSnapshot(getQ('reports'), s => setReportsHistory(s.docs.map(d => ({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))),
        onSnapshot(getQ('trainings'), s => setTrainings(s.docs.map(d => ({id:d.id,...d.data()})))),
        onSnapshot(getQ('readings'), s => setReadings(s.docs.map(d => ({id:d.id,...d.data()})))),
        onSnapshot(getQ('okrs'), s => setOkrs(s.docs.map(d => ({id:d.id,...d.data()})))),
    ];
    return () => unsubs.forEach(u => u());
  }, [user, selectedEmployee]);


  // --- HANDLERS ---

  const handleTestConnection = async () => {
    setDiagStatus("Test en cours...");
    try {
        if(!user) throw new Error("Non connecté");
        const req = addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'diagnostics'), { test: "Ping", date: new Date() });
        const timeout = new Promise((_, r) => setTimeout(()=>r(new Error("Timeout DB")), 5000));
        const res = await Promise.race([req, timeout]);
        setDiagStatus(`✅ SUCCÈS ! ID: ${res.id}`);
    } catch (e) { setDiagStatus(`❌ ÉCHEC : ${e.message}`); }
  };

  const handleSaveSettings = async () => { 
      if(!user) return; setIsSavingSettings(true); 
      try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'promptConfig'), { ...prompts, updatedAt: serverTimestamp() }); setSuccessMsg("Sauvegardé"); setTimeout(()=>setSuccessMsg(null),3000); } 
      catch(e){console.error(e); setErrorMsg("Erreur");} finally {setIsSavingSettings(false);} 
  };

  const handleResetPrompt = () => {
    const defaults = {
        report: DEFAULT_REPORT_PROMPT,
        training: DEFAULT_TRAINING_PROMPT,
        reading: DEFAULT_READING_PROMPT,
        okr: DEFAULT_OKR_PROMPT,
        rewrite: DEFAULT_REWRITE_PROMPT
    };
    setPrompts(prev => ({ ...prev, [settingsTab]: defaults[settingsTab] }));
  };

  const handleAddEmployee = async (e) => { 
      if(e) e.preventDefault(); 
      if(!newEmployeeName.trim()||!user||!db) return; 
      setIsAddingEmployee(true); 
      try { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'employees'), { name: newEmployeeName, role: newEmployeeRole||'Collaborateur', createdAt: serverTimestamp(), avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newEmployeeName)}&background=random&color=fff` }); setNewEmployeeName(''); setNewEmployeeRole(''); setIsAddModalOpen(false); } 
      catch(err){alert("Erreur: " + err.message);} finally{setIsAddingEmployee(false);} 
  };

  const handleDeleteEmployeeFull = async () => { 
      if(!user||!employeeToDelete||!db) return; 
      setIsDeletingEmployee(true); 
      try { const empId = employeeToDelete.id; const delCol = async (n) => { const q=query(collection(db,'artifacts',appId,'users',user.uid,n),where('employeeId','==',empId)); const s=await getDocs(q); await Promise.all(s.docs.map(d=>deleteDoc(d.ref))); }; await Promise.all(['notes','reports','trainings','readings','okrs'].map(delCol)); await deleteDoc(doc(db,'artifacts',appId,'users',user.uid,'employees',empId)); setEmployeeToDelete(null); if(selectedEmployee?.id===empId){setSelectedEmployee(null); setView('dashboard');} } 
      catch(e){alert("Erreur");} finally{setIsDeletingEmployee(false);} 
  };

  const handleAddNote = async () => { 
      if(!noteContent.trim()||!user||!db) return; 
      setIsSubmittingNote(true); 
      try { await addDoc(collection(db,'artifacts',appId,'users',user.uid,'notes'), { employeeId: selectedEmployee.id, content: noteContent, tag: noteTag, category: noteCategory, date: new Date().toISOString(), createdAt: serverTimestamp() }); setNoteContent(''); setSuccessMsg("Ajouté !"); setTimeout(()=>setSuccessMsg(null),3000); } 
      catch(e){setErrorMsg("Erreur");} finally{setIsSubmittingNote(false);} 
  };

  const startEditing = (note) => { setEditingNoteId(note.id); setEditContent(note.content); setEditTag(note.tag); setEditCategory(note.category); };
  const cancelEditing = () => { setEditingNoteId(null); setEditContent(''); };

  const handleUpdateNote = async () => { 
      if(!user||!editingNoteId||!db) return; 
      setIsUpdatingNote(true); 
      try { await updateDoc(doc(db,'artifacts',appId,'users',user.uid,'notes',editingNoteId),{ content:editContent, tag:editTag, category:editCategory, updatedAt:serverTimestamp() }); setEditingNoteId(null); } 
      catch(e){alert("Erreur");} finally{setIsUpdatingNote(false);} 
  };

  const confirmDeleteNote = async () => { 
      if(!user||!noteToDelete||!db) return; 
      setIsDeletingNote(true); 
      try { await deleteDoc(doc(db,'artifacts',appId,'users',user.uid,'notes',noteToDelete.id)); setNoteToDelete(null); } 
      catch(e){alert("Erreur");} finally{setIsDeletingNote(false);} 
  };

  const handleDeleteItem = async (c, id) => { 
      if(!window.confirm("Supprimer ?")) return; 
      if(!db) return; 
      try { await deleteDoc(doc(db,'artifacts',appId,'users',user.uid,c,id)); } catch(e){console.error(e);} 
  };

  // --- AI HANDLERS ---

  const callGemini = async (prompt, retry=0) => { 
      try { const r = await fetch(GEMINI_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({contents:[{parts:[{text:prompt}]}]}) }); if(!r.ok) throw new Error(r.status); const d=await r.json(); return d.candidates[0].content.parts[0].text; } 
      catch(e){ if(retry<3){ await new Promise(r=>setTimeout(r,1000)); return callGemini(prompt, retry+1); } throw e;} 
  };

  const handleRewriteNote = async () => { 
      if(!noteContent) return; setIsRewriting(true); 
      try { const r=await callGemini((prompts.rewrite||"Reformule: ")+noteContent); setNoteContent(r.trim()); } 
      catch(e){alert("Erreur IA");} finally{setIsRewriting(false);} 
  };

  const generateRealAIReport = async () => { 
      setIsGenerating(true); 
      try { let p=prompts.report; p=p.replace(/{{NOM}}/g,selectedEmployee.name).replace(/{{ROLE}}/g,selectedEmployee.role).replace(/{{NOTES}}/g, notes.map(n=>`- ${n.content}`).join('\n')); const r=await callGemini(p); setGeneratedReport({response:r}); if(db) await addDoc(collection(db,'artifacts',appId,'users',user.uid,'reports'),{employeeId:selectedEmployee.id, content:r, createdAt:serverTimestamp(), date:new Date().toISOString()}); setEmployeeTab('history'); } 
      catch(e){alert("Erreur IA");} finally{setIsGenerating(false);} 
  };

  const generateOkrs = async () => { 
      setIsGeneratingOkrs(true); 
      try { let p=prompts.okr; p=p.replace(/{{NOM}}/g,selectedEmployee.name).replace(/{{ROLE}}/g,selectedEmployee.role).replace(/{{NOTES}}/g, notes.map(n=>`- ${n.content}`).join('\n')); const r=await callGemini(p); 
      let cleanJson = r.replace(/```json/g, '').replace(/```/g, ''); 
      const j=JSON.parse(cleanJson.trim()); if(db) await Promise.all(j.map(o=>addDoc(collection(db,'artifacts',appId,'users',user.uid,'okrs'),{employeeId:selectedEmployee.id, ...o, createdAt:serverTimestamp()}))); } 
      catch(e){alert("Erreur IA/JSON");} finally{setIsGeneratingOkrs(false);} 
  };

  const generateTrainingRecommendations = async () => { 
      setIsGeneratingTraining(true); 
      try { let p=prompts.training; p=p.replace(/{{NOM}}/g,selectedEmployee.name).replace(/{{ROLE}}/g,selectedEmployee.role).replace(/{{NOTES}}/g, notes.map(n=>`- ${n.content}`).join('\n')); const r=await callGemini(p); 
      let cleanJson = r.replace(/```json/g, '').replace(/```/g, ''); 
      const j=JSON.parse(cleanJson.trim()); if(db) await Promise.all(j.slice(0,5).map(t=>addDoc(collection(db,'artifacts',appId,'users',user.uid,'trainings'),{employeeId:selectedEmployee.id, ...t, createdAt:serverTimestamp()}))); } 
      catch(e){alert("Erreur IA");} finally{setIsGeneratingTraining(false);} 
  };

  const generateReadingRecommendations = async () => { 
      setIsGeneratingReading(true); 
      try { let p=prompts.reading; p=p.replace(/{{NOM}}/g,selectedEmployee.name).replace(/{{ROLE}}/g,selectedEmployee.role).replace(/{{NOTES}}/g, notes.map(n=>`- ${n.content}`).join('\n')); const r=await callGemini(p); 
      let cleanJson = r.replace(/```json/g, '').replace(/```/g, ''); 
      const j=JSON.parse(cleanJson.trim()); if(db) await Promise.all(j.map(b=>addDoc(collection(db,'artifacts',appId,'users',user.uid,'readings'),{employeeId:selectedEmployee.id, ...b, createdAt:serverTimestamp()}))); } 
      catch(e){alert("Erreur IA");} finally{setIsGeneratingReading(false);} 
  };


  // --- RENDER ---

  if (loading) return <div className="h-screen flex items-center justify-center text-blue-600"><Loader2 className="animate-spin mr-2"/> Chargement...</div>;

  // Affichage conditionnel : Login ou App
  if (!user) {
      return <LoginScreen onLogin={handleGoogleLogin} error={authError || configError} />;
  }

  return (
    <div className="flex h-screen bg-gray-50 text-slate-800 font-sans overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
         <div className="p-6 border-b flex justify-between items-center"><div className="flex gap-2 text-blue-600 font-bold text-xl"><BookOpen/> ManagerLog</div><button onClick={()=>setMobileMenuOpen(false)} className="md:hidden"><X/></button></div>
         
         <div className="p-4 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
                <div className="mb-6"><h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Général</h3>
                    <button onClick={()=>{setView('dashboard');setSelectedEmployee(null);setMobileMenuOpen(false)}} className={`w-full text-left px-3 py-2 rounded flex gap-2 ${view==='dashboard'?'bg-blue-50 text-blue-600':''}`}><Users size={16}/> Dashboard</button>
                    <button onClick={()=>{setView('settings');setSelectedEmployee(null);setMobileMenuOpen(false)}} className={`w-full text-left px-3 py-2 rounded flex gap-2 ${view==='settings'?'bg-blue-50 text-blue-600':''}`}><Settings size={16}/> Config IA</button>
                </div>
                <div className="flex justify-between mb-2 px-2"><h3 className="text-xs font-bold text-gray-400 uppercase">Équipe</h3><button onClick={()=>setIsAddModalOpen(true)} className="text-blue-600"><UserPlus size={16}/></button></div>
                {employees.map(e=>(<button key={e.id} onClick={()=>{setSelectedEmployee(e);setView('employee');setMobileMenuOpen(false);setEmployeeTab('journal')}} className={`w-full text-left px-3 py-2 rounded flex gap-2 items-center ${selectedEmployee?.id===e.id?'bg-blue-50 text-blue-600':''}`}><img src={e.avatar} className="w-6 h-6 rounded-full"/><span className="truncate">{e.name}</span></button>))}
            </div>

            {/* USER INFO & LOGOUT */}
            <div className="mt-auto pt-4 border-t border-gray-100">
                <div className="flex items-center gap-3 px-2 mb-3">
                    {user.photoURL ? <img src={user.photoURL} className="w-8 h-8 rounded-full"/> : <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">{user.email?.[0].toUpperCase()}</div>}
                    <div className="overflow-hidden">
                        <div className="text-sm font-medium truncate">{user.displayName || "Utilisateur"}</div>
                        <div className="text-xs text-gray-400 truncate">{user.email}</div>
                    </div>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-red-500 hover:bg-red-50 w-full px-3 py-2 rounded transition-colors">
                    <LogOut size={14} /> <span>Se déconnecter</span>
                </button>
            </div>
         </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
         <div className="md:hidden bg-white border-b p-4 flex items-center gap-3"><button onClick={()=>setMobileMenuOpen(true)}><Menu/></button><span className="font-bold">{view==='settings'?'Config':selectedEmployee?.name||'Dashboard'}</span></div>
         
         {configError && <div className="bg-red-600 text-white p-3 text-center font-bold text-sm">⚠️ {configError}</div>}

         {view === 'settings' && (
            <div className="flex-1 overflow-y-auto p-8">
                <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Sparkles className="text-indigo-600"/> Configuration</h1>
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-8">
                    <h3 className="font-bold text-orange-800 mb-4 flex gap-2"><ShieldCheck/> Diagnostic Système</h3>
                    <div className="flex flex-col gap-2 mb-4 text-sm">
                        <div className="flex justify-between"><span>Clé Firebase:</span> <span className={firebaseConfig.apiKey ? "text-green-600 font-bold":"text-red-600 font-bold"}>{firebaseConfig.apiKey ? "CHARGÉE" : "MANQUANTE"}</span></div>
                        <div className="flex justify-between"><span>Statut Auth:</span> <span className={user?"text-green-600":"text-red-600"}>{user ? "Connecté" : "Déconnecté"}</span></div>
                    </div>
                    <div className="flex gap-4 items-center">
                        <Button onClick={handleTestConnection} icon={Database} variant="secondary" disabled={!user}>Tester Écriture DB</Button>
                    </div>
                    {diagStatus && <div className="mt-4 p-3 bg-white rounded border text-sm font-mono">{diagStatus}</div>}
                </div>
                
                {/* SETTINGS UI (PROMPTS) */}
                <div className="flex flex-col md:flex-row gap-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[600px]">
                    <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 p-2">
                        {[
                            {id:'report', label:'Bilan Annuel', icon:FileText},
                            {id:'training', label:'Formations', icon:GraduationCap},
                            {id:'reading', label:'Lectures', icon:Book},
                            {id:'okr', label:'OKRs', icon:Target},
                            {id:'rewrite', label:'Reformulation', icon:PenTool}
                        ].map(t=><button key={t.id} onClick={()=>setSettingsTab(t.id)} className={`w-full text-left p-3 rounded flex gap-2 mb-1 ${settingsTab===t.id?'bg-white shadow text-indigo-600':'text-gray-600 hover:bg-gray-100'}`}><t.icon size={18}/> {t.label}</button>)}
                    </div>
                    <div className="flex-1 p-4 flex flex-col">
                        <textarea className="flex-1 w-full p-4 bg-gray-50 border rounded font-mono text-sm resize-none focus:ring-2 focus:ring-indigo-500 outline-none" value={prompts[settingsTab]} onChange={e=>setPrompts({...prompts, [settingsTab]:e.target.value})}/>
                        <div className="flex justify-end mt-4"><Button onClick={handleSaveSettings} icon={Save} isLoading={isSavingSettings}>Sauvegarder</Button></div>
                    </div>
                </div>
            </div>
         )}
         
         {view==='dashboard' && !selectedEmployee && <div className="p-10"><h1 className="text-3xl font-bold mb-4">Tableau de Bord</h1>{employees.length===0 && <div className="text-center py-20 border-2 border-dashed rounded"><p className="mb-4">Aucun membre</p><Button onClick={()=>setIsAddModalOpen(true)}>Ajouter</Button></div>}</div>}
         
         {selectedEmployee && view==='employee' && (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="bg-white border-b p-4 flex justify-between"><div className="flex gap-4 items-center"><img src={selectedEmployee.avatar} className="w-10 h-10 rounded-full"/><h2 className="font-bold">{selectedEmployee.name}</h2></div><div className="flex gap-2"><Button onClick={()=>generateRealAIReport()} icon={Sparkles}>Bilan</Button></div></div>
                <div className="p-8 overflow-y-auto"><div className="bg-white p-4 rounded border mb-4"><textarea className="w-full border rounded p-2" rows="3" value={noteContent} onChange={e=>setNoteContent(e.target.value)} placeholder="Note..."></textarea><div className="flex justify-end mt-2"><Button onClick={handleAddNote}>Enregistrer</Button></div></div>
                <div className="space-y-4">{notes.map(n=><div key={n.id} className="bg-white p-4 rounded border"><div className="text-xs text-gray-400">{new Date(n.date).toLocaleDateString()}</div><p>{n.content}</p></div>)}</div>
                </div>
            </div>
         )}
      </main>
      
      <Modal isOpen={isAddModalOpen} onClose={()=>setIsAddModalOpen(false)} title="Nouveau"><form onSubmit={handleAddEmployee}><input className="w-full border p-2 rounded mb-4" placeholder="Nom" value={newEmployeeName} onChange={e=>setNewEmployeeName(e.target.value)} autoFocus/><div className="flex justify-end"><Button type="submit">Créer</Button></div></form></Modal>
    </div>
  );
}