import React, { useState, useEffect } from 'react';
import { 
  Users, BookOpen, Plus, Save, Trash2, Sparkles, Menu, X, UserPlus, FileText, 
  ChevronRight, Briefcase, Loader2, AlertCircle, CheckCircle2, LogOut, Bot, 
  Settings, History, RefreshCw, Clock, Edit, Check, AlertTriangle, GraduationCap, 
  ExternalLink, Search, Book, Library, Target, Wand2, ArrowRight, PenTool,
  Wifi, Database, ShieldCheck, LogIn, Mail, Lock, Mic, MicOff, Pencil
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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

let app, auth, db;
let configError = null;

try {
    if (firebaseConfig.apiKey) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        // Fix connexion pour environnements restreints
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

// --- PROMPTS ---
const DEFAULT_REPORT_PROMPT = `Tu es un expert RH et un manager bienveillant mais rigoureux.\nVoici les notes brutes prises au cours de l'année pour mon collaborateur : {{NOM}} (Poste : {{ROLE}}).\n\nNOTES BRUTES :\n{{NOTES}}\n\nTA MISSION :\nRédige une évaluation annuelle formelle en Français, structurée et professionnelle.\nNe mentionne pas "d'après les notes", fais comme si tu avais tout observé toi-même.\nSois précis. Cite des exemples concrets tirés des notes pour justifier tes propos.\n\nSTRUCTURE REQUISE :\n1. Synthèse globale de l'année (Ton général).\n2. Points Forts et Réussites (Basé sur les notes positives).\n3. Axes d'amélioration et Points de vigilance (Basé sur les notes "À améliorer", sois constructif).\n4. Plan d'action suggéré pour l'année prochaine.\n5. Conclusion motivante.\n\nIMPORTANT : Ne mentionne pas être une IA. Signe "Le Manager".`;
const DEFAULT_TRAINING_PROMPT = `Tu es un expert en Learning & Development chez LinkedIn Learning.\nAnalyse les notes suivantes concernant un collaborateur ({{NOM}}, {{ROLE}}) pour identifier ses lacunes techniques ou comportementales.\n\nNOTES BRUTES :\n{{NOTES}}\n\nTA MISSION :\nSuggère 3 à 5 cours précis et existants sur LinkedIn Learning.\nSois très spécifique sur les titres de cours.\nPour chaque recommandation, explique quel problème observé dans les notes cela va résoudre.\n\nFORMAT DE RÉPONSE ATTENDU (JSON UNIQUEMENT, sans markdown) :\n[\n  {\n    "topic": "Titre exact ou très proche du cours suggéré",\n    "reason": "Explication basée sur un fait précis des notes (ex: Pour améliorer la gestion des conflits notée en juin)",\n    "keywords": "Mots clés optimisés pour la barre de recherche LinkedIn Learning"\n  }\n]`;
const DEFAULT_READING_PROMPT = `Tu es un bibliothécaire expert en développement professionnel et management.\nAnalyse les notes suivantes concernant un collaborateur ({{NOM}}, {{ROLE}}).\n\nNOTES BRUTES :\n{{NOTES}}\n\nTA MISSION :\nSuggère exactement 3 livres (essais, business, psycho, tech) pertinents.\n- Si les notes sont positives : des livres pour aller plus loin, inspirer, ou sur le leadership.\n- Si les notes sont mitigées : des livres pour résoudre les problèmes identifiés (gestion du temps, communication, code clean...).\n\nFORMAT DE RÉPONSE ATTENDU (JSON UNIQUEMENT, sans markdown) :\n[\n  {\n    "title": "Titre du livre",\n    "author": "Auteur",\n    "reason": "Pourquoi ce livre ? (Basé sur un fait noté)",\n    "keywords": "Mots clés pour recherche Amazon (Titre + Auteur)"\n  }\n]`;
const DEFAULT_OKR_PROMPT = `Tu es un coach expert en performance et management par objectifs (OKRs).\nAnalyse l'historique des notes de {{NOM}} ({{ROLE}}) ci-dessous pour comprendre ses défis et ses forces actuels.\n\nNOTES BRUTES :\n{{NOTES}}\n\nTA MISSION :\nPropose 3 Objectifs (Objectives) trimestriels pertinents, accompagnés pour chacun de 2 Résultats Clés (Key Results) mesurables.\nCes objectifs doivent aider le collaborateur à franchir un cap l'année prochaine.\n\nFORMAT DE RÉPONSE ATTENDU (JSON UNIQUEMENT, sans markdown) :\n[\n  {\n    "objective": "L'objectif inspirant (ex: Devenir un référent technique sur le projet X)",\n    "keyResults": ["KR1 mesurable", "KR2 mesurable"],\n    "rationale": "Pourquoi cet objectif ? (basé sur les notes)"\n  }\n]`;
const DEFAULT_REWRITE_PROMPT = `Tu es un expert en communication managériale. \nAnalyse la note brute ci-dessous.\n\nTA MISSION :\n1. Reformule le texte pour qu'il soit factuel, professionnel et constructif.\n2. Détermine si c'est un "Succès" (positif) ou "Amélioration" (négatif/constructif).\n3. Détermine la catégorie : "Technique", "Management" ou "Soft Skills".\n\nNOTE BRUTE : "{{CONTENT}}"\n\nRÉPONSE ATTENDUE (JSON UNIQUEMENT) :\n{\n  "rewritten": "Le texte reformulé ici",\n  "tag": "Succès" ou "Amélioration",\n  "category": "Technique" ou "Management" ou "Soft Skills"\n}`;

// --- COMPONENTS ---
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
  return <button type={type} onClick={onClick} className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled || isLoading}>{isLoading ? <Loader2 size={size === 'sm' ? 14 : 18} className="mr-2 animate-spin" /> : Icon ? <Icon size={size === 'sm' ? 14 : 18} className="mr-2" /> : null}{children}</button>;
};

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"><div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 transform transition-all"><div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-800">{title}</h3><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button></div><div className="p-6">{children}</div></div></div>;
};

const Badge = ({ type }) => {
  const styles = { 'Succès': 'bg-green-100 text-green-800 border-green-200', 'Amélioration': 'bg-orange-100 text-orange-800 border-orange-200', 'Soft Skills': 'bg-purple-100 text-purple-800 border-purple-200', 'Technique': 'bg-blue-100 text-blue-800 border-blue-200', 'Management': 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  return <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${styles[type] || 'bg-gray-100 text-gray-800'}`}>{type}</span>;
};

const SafeText = ({ content }) => {
  if (typeof content === 'string') return <>{content}</>;
  if (typeof content === 'number') return <>{content}</>;
  return <span className="text-xs text-gray-400 italic">(Format non supporté)</span>;
};

// --- LOGIN SCREEN ---
const LoginScreen = ({ onGoogleLogin, onEmailLogin, onEmailSignUp, error }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if(!email || !password) return;
        setLoading(true);
        if (isSignUp) {
            await onEmailSignUp(email, password);
        } else {
            await onEmailLogin(email, password);
        }
        setLoading(false);
    };

    return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
            <div className="text-center mb-8">
                <div className="mx-auto mb-4 flex justify-center">
                     <img src="/logo.png" alt="Reviewiz.ai" className="h-20 w-auto object-contain" onError={(e) => {e.target.onerror = null; e.target.src='https://placehold.co/200x80?text=Reviewiz.ai'}}/>
                </div>
                <p className="text-gray-500 text-sm font-medium">Smarter insights. Stronger teams.</p>
            </div>

            <Button onClick={onGoogleLogin} variant="google" className="w-full py-2.5 flex justify-center gap-3 text-sm font-medium mb-6">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                Continuer avec Google
            </Button>

            <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">Ou via Email</span></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                <div>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="Email" required />
                    </div>
                </div>
                <div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="Mot de passe" required minLength={6} />
                    </div>
                </div>
                <Button type="submit" className="w-full py-2.5" isLoading={loading}>
                    {isSignUp ? "Créer mon compte" : "Se connecter"}
                </Button>
            </form>

            <div className="text-center">
                <button onClick={() => { setIsSignUp(!isSignUp); }} className="text-sm text-blue-600 hover:underline font-medium">
                    {isSignUp ? "J'ai déjà un compte" : "Pas encore de compte ? S'inscrire"}
                </button>
            </div>
            {error && <div className="mt-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg text-left animate-in fade-in slide-in-from-top-2">⚠️ {error}</div>}
            
            <p className="mt-8 pt-6 border-t border-gray-100 text-xs text-center text-gray-400">
                © {new Date().getFullYear()} Reviewiz.ai
            </p>
        </div>
    </div>
    );
};

// ==================================================================================
// APPLICATION PRINCIPALE
// ==================================================================================

export default function ManagerLogApp() {
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [notes, setNotes] = useState([]);
  const [reportsHistory, setReportsHistory] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [readings, setReadings] = useState([]);
  const [okrs, setOkrs] = useState([]); 
  
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [employeeTab, setEmployeeTab] = useState('journal'); 
  
  // Settings & Prompts
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

  // UI States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false); 
  const [editNameValue, setEditNameValue] = useState(''); 
  
  // Voice Input State
  const [isListening, setIsListening] = useState(false);

  // CRUD States
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [isDeletingEmployee, setIsDeletingEmployee] = useState(false);

  const [noteContent, setNoteContent] = useState('');
  const [noteTag, setNoteTag] = useState('Succès');
  const [noteCategory, setNoteCategory] = useState('Technique');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false); 
  
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editTag, setEditTag] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);

  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // AI States
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
          setAuthError("Impossible de se connecter avec Google.");
      }
  };

  const handleEmailLogin = async (email, password) => {
      if (!auth) return;
      setAuthError(null);
      try { await signInWithEmailAndPassword(auth, email, password); } catch (error) { 
          console.error("Erreur Login Email:", error);
          let msg = "Erreur de connexion.";
          if(error.code === 'auth/invalid-credential') msg = "Email ou mot de passe incorrect.";
          setAuthError(msg);
      }
  };

  const handleEmailSignUp = async (email, password) => {
      if (!auth) return;
      setAuthError(null);
      try { await createUserWithEmailAndPassword(auth, email, password); } catch (error) {
          console.error("Erreur Inscription:", error);
          let msg = "Erreur inscription.";
          if(error.code === 'auth/email-already-in-use') msg = "Email déjà utilisé.";
          if(error.code === 'auth/weak-password') msg = "Mot de passe trop faible.";
          setAuthError(msg);
      }
  };

  const handleLogout = async () => { try { await signOut(auth); setSelectedEmployee(null); setView('dashboard'); } catch (error) { console.error("Erreur déconnexion:", error); } };

  // --- DATA SYNC ---
  useEffect(() => {
    if (!user || !db) return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'employees');
    const unsubscribe = onSnapshot(q, (s) => {
      setEmployees(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if(!user || !db) return;
    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'promptConfig'), (s) => { if(s.exists()) setPrompts(s.data()); });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedEmployee || !db) { setNotes([]); setReportsHistory([]); setTrainings([]); setReadings([]); setOkrs([]); setEditingNoteId(null); return; }
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

  // --- VOICE INPUT FUNCTION ---
  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'fr-FR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event) => { console.error("Erreur vocale", event.error); setIsListening(false); };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setNoteContent(prev => prev + (prev ? ' ' : '') + transcript);
        };

        recognition.start();
    } else {
        alert("Votre navigateur ne supporte pas la reconnaissance vocale.");
    }
  };

  // --- ACTIONS ---

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

  const handleUpdateEmployeeName = async () => {
    if (!user || !selectedEmployee || !editNameValue.trim()) return;
    try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'employees', selectedEmployee.id), { name: editNameValue });
        setSelectedEmployee(prev => ({...prev, name: editNameValue}));
        setIsEditingName(false);
    } catch (error) { console.error("Error updating name:", error); }
  };

  const handleSaveSettings = async () => { if(!user) return; setIsSavingSettings(true); try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'promptConfig'), { ...prompts, updatedAt: serverTimestamp() }); setSuccessMsg("Configuration sauvegardée"); setTimeout(()=>setSuccessMsg(null),3000); } catch(e){console.error(e); setErrorMsg("Erreur sauvegarde");} finally {setIsSavingSettings(false);} };
  const handleResetPrompt = () => { setPrompts({ report: DEFAULT_REPORT_PROMPT, training: DEFAULT_TRAINING_PROMPT, reading: DEFAULT_READING_PROMPT, okr: DEFAULT_OKR_PROMPT, rewrite: DEFAULT_REWRITE_PROMPT }); }; 
  const handleAddEmployee = async (e) => { if(e) e.preventDefault(); if(!newEmployeeName.trim()||!user||!db) return; setIsAddingEmployee(true); try { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'employees'), { name: newEmployeeName, role: newEmployeeRole||'Collaborateur', createdAt: serverTimestamp(), avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newEmployeeName)}&background=random&color=fff` }); setNewEmployeeName(''); setNewEmployeeRole(''); setIsAddModalOpen(false); } catch(err){alert("Erreur: " + err.message);} finally{setIsAddingEmployee(false);} };
  const handleDeleteEmployeeFull = async () => { if(!user||!employeeToDelete||!db) return; setIsDeletingEmployee(true); try { const empId = employeeToDelete.id; const delCol = async (n) => { const q=query(collection(db,'artifacts',appId,'users',user.uid,n),where('employeeId','==',empId)); const s=await getDocs(q); await Promise.all(s.docs.map(d=>deleteDoc(d.ref))); }; await Promise.all(['notes','reports','trainings','readings','okrs'].map(delCol)); await deleteDoc(doc(db,'artifacts',appId,'users',user.uid,'employees',empId)); setEmployeeToDelete(null); if(selectedEmployee?.id===empId){setSelectedEmployee(null); setView('dashboard');} } catch(e){alert("Erreur");} finally{setIsDeletingEmployee(false);} };
  const handleAddNote = async () => { if(!noteContent.trim()||!user||!db) return; setIsSubmittingNote(true); try { await addDoc(collection(db,'artifacts',appId,'users',user.uid,'notes'), { employeeId: selectedEmployee.id, content: noteContent, tag: noteTag, category: noteCategory, date: new Date().toISOString(), createdAt: serverTimestamp() }); setNoteContent(''); setSuccessMsg("Note enregistrée !"); setTimeout(()=>setSuccessMsg(null),3000); } catch(e){setErrorMsg("Échec.");} finally{setIsSubmittingNote(false);} };
  
  const startEditing = (note) => { 
      setEditingNoteId(note.id); 
      setEditContent(note.content); 
      setEditTag(note.tag); 
      setEditCategory(note.category); 
  };
  const cancelEditing = () => { setEditingNoteId(null); setEditContent(''); };
  const handleUpdateNote = async () => { if(!user||!editingNoteId||!db) return; setIsUpdatingNote(true); try { await updateDoc(doc(db,'artifacts',appId,'users',user.uid,'notes',editingNoteId),{ content:editContent, tag:editTag, category:editCategory, updatedAt:serverTimestamp() }); setEditingNoteId(null); } catch(e){alert("Impossible de modifier.");} finally{setIsUpdatingNote(false);} };
  const confirmDeleteNote = async () => { if(!user||!noteToDelete||!db) return; setIsDeletingNote(true); try { await deleteDoc(doc(db,'artifacts',appId,'users',user.uid,'notes',noteToDelete.id)); setNoteToDelete(null); } catch(e){alert("Erreur.");} finally{setIsDeletingNote(false);} };
  const handleDeleteItem = async (c, id) => { if(!window.confirm("Supprimer cet élément ?")) return; if(!db) return; try { await deleteDoc(doc(db,'artifacts',appId,'users',user.uid,c,id)); } catch(e){console.error(e);} };

  // --- AI HANDLERS ---

  const callGemini = async (prompt, retryCount = 0) => {
      try {
          const response = await fetch(GEMINI_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          });
          if (!response.ok) throw new Error(`API Error: ${response.status}`);
          const data = await response.json();
          if (!data.candidates || data.candidates.length === 0) throw new Error("No content");
          return data.candidates[0].content.parts[0].text;
      } catch (error) {
          if (retryCount < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              return callGemini(prompt, retryCount + 1);
          }
          throw error;
      }
  };

  const handleRewriteNote = async () => {
    if(!noteContent.trim()) return;
    setIsRewriting(true);
    try {
        let finalPrompt = prompts.rewrite; 
        finalPrompt = finalPrompt.replace(/{{CONTENT}}/g, noteContent);
        
        const rawResponse = await callGemini(finalPrompt);
        let cleanJson = rawResponse.replace(/```json/g, '')
                                     .replace(/```/g, '')
                                     .trim();
        
        try {
            const parsed = JSON.parse(cleanJson);
            if (parsed.rewritten) setNoteContent(parsed.rewritten);
            if (parsed.tag && (parsed.tag === 'Succès' || parsed.tag === 'Amélioration')) setNoteTag(parsed.tag);
            if (parsed.category && ['Technique', 'Management', 'Soft Skills'].includes(parsed.category)) setNoteCategory(parsed.category);
        } catch (jsonError) {
            setNoteContent(cleanJson);
        }
        
    } catch(e) {
        console.error(e);
        alert("L'IA n'a pas pu analyser la note. Essayez de reformuler.");
    } finally {
        setIsRewriting(false);
    }
  };

  const generateRealAIReport = async () => { setIsGenerating(true); try { let p=prompts.report; p=p.replace(/{{NOM}}/g,selectedEmployee.name).replace(/{{ROLE}}/g,selectedEmployee.role).replace(/{{NOTES}}/g, notes.map(n=>`- ${n.content}`).join('\n')); const r=await callGemini(p); setGeneratedReport({response:r}); if(db) await addDoc(collection(db,'artifacts',appId,'users',user.uid,'reports'),{employeeId:selectedEmployee.id, content:r, createdAt:serverTimestamp(), date:new Date().toISOString()}); setEmployeeTab('history'); } catch(e){alert("Erreur IA");} finally{setIsGenerating(false);} };
  
  const generateOkrs = async () => { 
    setIsGeneratingOkrs(true); 
    try { 
        let p=prompts.okr; 
        p=p.replace(/{{NOM}}/g,selectedEmployee.name).replace(/{{ROLE}}/g,selectedEmployee.role).replace(/{{NOTES}}/g, notes.map(n=>`- ${n.content}`).join('\n')); 
        const r=await callGemini(p); 
        let cleanJson = r.replace(/```json/g, '')
                           .replace(/```/g, '')
                           .trim(); 
        const j=JSON.parse(cleanJson); 
        if(db) await Promise.all(j.map(o=>addDoc(collection(db,'artifacts',appId,'users',user.uid,'okrs'),{employeeId:selectedEmployee.id, ...o, createdAt:serverTimestamp()}))); 
    } catch(e){
        alert("Erreur IA/JSON");
    } finally{
        setIsGeneratingOkrs(false);
    } 
  };

  const generateTrainingRecommendations = async () => { 
    setIsGeneratingTraining(true); 
    try { 
        let p=prompts.training; 
        p=p.replace(/{{NOM}}/g,selectedEmployee.name).replace(/{{ROLE}}/g,selectedEmployee.role).replace(/{{NOTES}}/g, notes.map(n=>`- ${n.content}`).join('\n')); 
        const r=await callGemini(p); 
        let cleanJson = r.replace(/```json/g, '')
                           .replace(/```/g, '')
                           .trim(); 
        const j=JSON.parse(cleanJson); 
        if(db) await Promise.all(j.slice(0,5).map(t=>addDoc(collection(db,'artifacts',appId,'users',user.uid,'trainings'),{employeeId:selectedEmployee.id, ...t, createdAt:serverTimestamp()}))); 
    } catch(e){
        alert("Erreur IA");
    } finally{
        setIsGeneratingTraining(false);
    } 
  };

  const generateReadingRecommendations = async () => { 
    setIsGeneratingReading(true); 
    try { 
        let p=prompts.reading; 
        p=p.replace(/{{NOM}}/g,selectedEmployee.name).replace(/{{ROLE}}/g,selectedEmployee.role).replace(/{{NOTES}}/g, notes.map(n=>`- ${n.content}`).join('\n')); 
        const r=await callGemini(p); 
        let cleanJson = r.replace(/```json/g, '')
                           .replace(/```/g, '')
                           .trim(); 
        const j=JSON.parse(cleanJson); 
        if(db) await Promise.all(j.map(b=>addDoc(collection(db,'artifacts',appId,'users',user.uid,'readings'),{employeeId:selectedEmployee.id, ...b, createdAt:serverTimestamp()}))); 
    } catch(e){
        alert("Erreur IA");
    } finally{
       setIsGeneratingReading(false);
    } 
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-blue-600"><Loader2 className="animate-spin mr-2"/> Chargement...</div>;
  if (!user) return <LoginScreen onGoogleLogin={handleGoogleLogin} onEmailLogin={handleEmailLogin} onEmailSignUp={handleEmailSignUp} error={authError || configError} />;

  return (
    <div className="flex h-screen bg-gray-50 text-slate-800 font-sans overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
         <div className="p-6 border-b flex justify-between items-center"><div className="flex gap-2 text-blue-600 font-bold text-xl"> <img src="/logo.png" alt="Reviewiz.ai" className="h-8 w-auto object-contain" onError={(e) => {e.target.onerror = null; e.target.src='https://placehold.co/150x40?text=Reviewiz.ai'}}/></div><button onClick={()=>setMobileMenuOpen(false)} className="md:hidden"><X/></button></div>
         <div className="p-4 flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
                <div className="mb-6"><h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Général</h3>
                    <button onClick={()=>{setView('dashboard');setSelectedEmployee(null);setMobileMenuOpen(false)}} className={`w-full text-left px-3 py-2 rounded flex gap-2 ${view==='dashboard'?'bg-blue-50 text-blue-600':''}`}><Users size={16}/> Vue d'ensemble</button>
                    <button onClick={()=>{setView('settings');setSelectedEmployee(null);setMobileMenuOpen(false)}} className={`w-full text-left px-3 py-2 rounded flex gap-2 ${view==='settings'?'bg-blue-50 text-blue-600':''}`}><Settings size={16}/> Configuration IA</button>
                </div>
                <div className="flex justify-between mb-2 px-2"><h3 className="text-xs font-bold text-gray-400 uppercase">Mon Équipe</h3><button onClick={()=>setIsAddModalOpen(true)} className="text-blue-600"><UserPlus size={16}/></button></div>
                {employees.map(e=>(<button key={e.id} onClick={()=>{setSelectedEmployee(e);setView('employee');setGeneratedReport(null);setMobileMenuOpen(false);setEmployeeTab('journal')}} className={`w-full text-left px-3 py-2 rounded flex gap-2 items-center ${selectedEmployee?.id===e.id?'bg-blue-50 text-blue-600':''}`}><img src={e.avatar} alt={e.name} className="w-6 h-6 rounded-full"/><span className="truncate">{e.name}</span></button>))}
            </div>
            <div className="mt-auto pt-4 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3 mb-3">{user.photoURL ? <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="Profile"/> : <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">{user.email?.[0].toUpperCase()}</div>}<div className="overflow-hidden"><div className="text-sm font-bold truncate text-gray-800">{user.displayName || "Utilisateur"}</div><div className="text-xs text-gray-400 truncate">{user.email}</div></div></div>
                <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-red-500 hover:bg-red-50 w-full px-3 py-2 rounded transition-colors font-medium"><LogOut size={14} /> <span>Se déconnecter</span></button>
                <div className="text-center mt-4 text-xs text-gray-300">© {new Date().getFullYear()} Reviewiz.ai</div>
            </div>
         </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
        <div className="md:hidden bg-white border-b p-4 flex items-center gap-3 shrink-0"><button onClick={() => setMobileMenuOpen(true)} className="text-gray-600 p-1 -ml-1 hover:bg-gray-100 rounded-lg"><Menu size={24}/></button><span className="font-bold text-gray-800 truncate">{view === 'settings' ? 'Configuration' : selectedEmployee ? selectedEmployee.name : 'Tableau de Bord'}</span></div>
        {view === 'settings' && (<div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50"><div className="max-w-5xl mx-auto h-full flex flex-col"><header className="mb-6"><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3"><Sparkles className="text-indigo-600" /> Configuration de l'IA</h1><p className="text-gray-500 mt-2">Personnalisez les instructions...</p></header><div className="flex-1 flex flex-col md:flex-row gap-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"><div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 flex flex-row md:flex-col overflow-x-auto md:overflow-visible">{[{ id: 'report', label: 'Bilan Annuel', icon: FileText }, { id: 'training', label: 'Formations', icon: GraduationCap }, { id: 'reading', label: 'Lectures', icon: Book }, { id: 'okr', label: 'OKRs', icon: Target }, { id: 'rewrite', label: 'Reformulation', icon: PenTool }].map(tab => (<button key={tab.id} onClick={() => setSettingsTab(tab.id)} className={`p-4 text-sm font-medium flex items-center gap-3 transition-colors border-b md:border-b-0 whitespace-nowrap md:whitespace-normal ${settingsTab === tab.id ? 'bg-white text-indigo-600 border-indigo-500 md:border-l-4' : 'text-gray-600 hover:bg-gray-100 border-transparent md:border-l-4'}`}><tab.icon size={18} />{tab.label}</button>))}</div><div className="flex-1 p-6 flex flex-col h-[600px] md:h-auto"><textarea value={prompts[settingsTab]} onChange={(e) => setPrompts(prev => ({ ...prev, [settingsTab]: e.target.value }))} className="flex-1 w-full p-4 font-mono text-sm bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"/><div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100"><Button variant="ghost" onClick={handleResetPrompt} icon={RefreshCw}>Restaurer défaut</Button><div className="flex items-center gap-3">{successMsg && <span className="text-green-600 text-sm font-medium flex items-center gap-1"><CheckCircle2 size={16}/> {successMsg}</span>}<Button onClick={handleSaveSettings} icon={Save} isLoading={isSavingSettings}>Sauvegarder tout</Button></div></div></div></div></div></div>)}
        {view === 'dashboard' && !selectedEmployee && (<div className="flex-1 overflow-y-auto p-6 md:p-10"><header className="mb-10 max-w-4xl mx-auto"><h1 className="text-3xl font-bold text-gray-900 mb-2">Tableau de Bord</h1><p className="text-gray-500">Gérez vos notes et préparez vos évaluations sans stress.</p></header><div className="max-w-4xl mx-auto">{employees.length === 0 ? <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed flex flex-col items-center"><div className="bg-blue-50 p-4 rounded-full mb-4"><Users className="h-8 w-8 text-blue-500" /></div><h3 className="text-xl font-bold text-gray-900 mb-2">Votre équipe est vide</h3><Button onClick={() => setIsAddModalOpen(true)} icon={Plus}>Ajouter un collaborateur</Button></div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"><button onClick={() => setIsAddModalOpen(true)} className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all group h-full min-h-[160px]"><Plus size={24} className="text-gray-400 group-hover:text-blue-600 mb-2" /><span className="font-medium text-gray-600 group-hover:text-blue-700">Ajouter un membre</span></button>{employees.map(emp => (<div key={emp.id} onClick={() => { setSelectedEmployee(emp); setView('employee'); }} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all cursor-pointer relative group"><div className="flex items-center gap-4"><img src={emp.avatar} alt={emp.name} className="w-14 h-14 rounded-full border-2 border-white shadow-md" /><div><h3 className="font-bold text-gray-900">{emp.name}</h3><p className="text-sm text-gray-500">{emp.role}</p></div></div></div>))}</div>}</div></div>)}
        {selectedEmployee && view === 'employee' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex justify-between items-center shadow-sm z-10 shrink-0">
              <div className="flex items-center gap-4"><img src={selectedEmployee.avatar} className="w-10 h-10 rounded-full hidden md:block" /><div>{isEditingName ? (<div className="flex items-center gap-2"><input autoFocus className="text-lg font-bold border rounded px-2 py-1" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUpdateEmployeeName()}/><button onClick={handleUpdateEmployeeName} className="text-green-600"><Check size={18}/></button><button onClick={() => setIsEditingName(false)} className="text-red-500"><X size={18}/></button></div>) : (<div className="flex items-center gap-2 group"><h2 className="font-bold text-gray-900 text-lg md:text-xl leading-tight">{selectedEmployee.name}</h2><button onClick={() => { setIsEditingName(true); setEditNameValue(selectedEmployee.name); }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"><Pencil size={14} /></button></div>)}<p className="text-xs md:text-sm text-gray-500">{selectedEmployee.role}</p></div></div>
              <div className="flex items-center gap-2"><Button onClick={() => { setView('report'); generateRealAIReport(); }} icon={Sparkles} className="bg-indigo-600 hover:bg-indigo-700 text-sm"><span className="hidden md:inline">Générer Bilan IA</span><span className="md:hidden">Bilan</span></Button><button onClick={() => setEmployeeToDelete(selectedEmployee)} className="p-2 text-red-200 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={20} /></button></div>
            </div>
            <div className="bg-white border-b border-gray-200 px-4 md:px-8 flex gap-6 overflow-x-auto">
              {[{id:'journal', label:'Journal', icon:FileText, count:notes.length}, {id:'okrs', label:'Objectifs', icon:Target, count:okrs.length}, {id:'history', label:'Bilans', icon:History, count:reportsHistory.length}, {id:'training', label:'Formations', icon:GraduationCap, count:trainings.length}, {id:'reading', label:'Lectures', icon:Library, count:readings.length}].map(t => (<button key={t.id} onClick={() => setEmployeeTab(t.id)} className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 shrink-0 ${employeeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><t.icon size={16}/> {t.label} ({t.count})</button>))}
            </div>
            <div className="flex-1 overflow-y-auto bg-white"><div className="max-w-4xl mx-auto w-full p-4 md:p-8">
                {employeeTab === 'journal' && (
                  <>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8 ring-1 ring-gray-100 focus-within:ring-blue-100 transition-all">
                      <div className="flex justify-between items-center mb-3"><h3 className="text-xs font-semibold text-gray-400 uppercase">Nouvelle Note</h3>{successMsg && <span className="text-xs text-green-600 flex items-center gap-1 font-bold"><CheckCircle2 size={12} /> {successMsg}</span>}</div>
                      <div className="relative">
                        <textarea className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none resize-none text-sm mb-3 pr-20" rows="3" placeholder="Qu'a fait ce collaborateur ?" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter' && e.ctrlKey) handleAddNote(); }}></textarea>
                        <div className="absolute right-2 bottom-5 flex gap-1">
                            <button onClick={startListening} className={`p-1.5 rounded-md border transition-colors shadow-sm ${isListening ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 'bg-white text-gray-500 border-gray-200 hover:text-blue-600'}`} title="Dicter"><Mic size={16}/></button>
                            <button onClick={handleRewriteNote} disabled={!noteContent.trim() || isRewriting} className="p-1.5 bg-white border border-indigo-100 rounded-md text-indigo-500 hover:bg-indigo-50 transition-colors shadow-sm disabled:opacity-50" title="Analyser & Reformuler"><Wand2 size={16}/></button>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-3"><div className="flex gap-2 w-full sm:w-auto"><select value={noteTag} onChange={(e) => setNoteTag(e.target.value)} className="text-sm p-2 rounded bg-gray-50 border border-gray-200"><option value="Succès">👍 Succès</option><option value="Amélioration">⚠️ À Améliorer</option></select><select value={noteCategory} onChange={(e) => setNoteCategory(e.target.value)} className="text-sm p-2 rounded bg-gray-50 border border-gray-200"><option value="Technique">🛠 Technique</option><option value="Soft Skills">🤝 Soft Skills</option><option value="Management">📊 Management</option></select></div><Button onClick={handleAddNote} icon={Save} disabled={!noteContent.trim()} isLoading={isSubmittingNote}>Enregistrer</Button></div>
                    </div>
                    <div className="space-y-6 pl-2 pb-10">
                      {notes.length === 0 ? <div className="text-center py-12 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed">Aucune note.</div> : notes.map((note) => (
                        <div key={note.id} className="relative pl-8 group">
                           <div className="absolute left-[11px] top-8 bottom-[-24px] w-px bg-gray-200 last:hidden"></div>
                           <div className={`absolute left-0 top-2 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${note.tag === 'Succès' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                           <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all">
                              {editingNoteId === note.id ? (
                                <div className="space-y-3">
                                  <textarea className="w-full p-2 bg-white border rounded-md text-sm outline-none" rows="3" value={editContent} onChange={(e) => setEditContent(e.target.value)}/>
                                  <div className="flex gap-2"><select value={editTag} onChange={(e) => setEditTag(e.target.value)} className="text-xs p-1.5 rounded border"><option value="Succès">Succès</option><option value="Amélioration">Amélioration</option></select><select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="text-xs p-1.5 rounded border"><option value="Technique">Technique</option><option value="Soft Skills">Soft Skills</option><option value="Management">Management</option></select></div>
                                  <div className="flex gap-2 justify-end"><Button size="sm" variant="ghost" onClick={cancelEditing}>Annuler</Button><Button size="sm" variant="success" icon={Check} onClick={handleUpdateNote} isLoading={isUpdatingNote}>Valider</Button></div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-wrap gap-2 items-center"><span className="text-xs font-bold text-gray-400">{new Date(note.date).toLocaleDateString()} <span className="font-normal text-gray-300 ml-1">à {new Date(note.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></span><Badge type={note.tag} /><Badge type={note.category} /></div>
                                    <div className="flex gap-1"><button onClick={() => startEditing(note)} className="text-gray-300 hover:text-blue-600 p-1"><Edit size={14} /></button><button onClick={() => setNoteToDelete(note)} className="text-gray-300 hover:text-red-500 p-1"><Trash2 size={14} /></button></div>
                                  </div>
                                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{note.content}</p>
                                </>
                              )}
                           </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {employeeTab === 'okrs' && (<div className="space-y-6"><div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-start gap-3"><div className="bg-white p-2 rounded-full text-indigo-600 mt-1"><Target size={18}/></div><div><h4 className="font-bold text-indigo-800 text-sm">Objectifs Intelligents (OKRs)</h4><p className="text-sm text-indigo-700 mt-1">L'IA analyse vos notes...</p></div></div>{okrs.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border border-dashed"><Button onClick={generateOkrs} icon={Sparkles} isLoading={isGeneratingOkrs} variant="magic">Générer des OKRs ✨</Button></div> : <div className="grid gap-4">{okrs.map(item => (<div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-indigo-200 transition-colors"><div className="flex justify-between items-start mb-2"><h3 className="font-bold text-gray-900 text-lg flex items-center gap-2"><Target size={20} className="text-indigo-500" /> {item.objective}</h3><button onClick={() => handleDeleteItem('okrs', item.id)} className="text-gray-300 hover:text-red-500"><X size={16}/></button></div><div className="mt-4 bg-gray-50 p-3 rounded-lg"><h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Résultats Clés</h4><ul className="space-y-2">{item.keyResults && item.keyResults.map((kr, idx) => (<li key={idx} className="flex items-start gap-2 text-sm text-gray-700"><ArrowRight size={14} className="mt-1 text-indigo-400 shrink-0" /><span>{kr}</span></li>))}</ul></div>{item.rationale && <p className="text-xs text-gray-400 mt-3 italic">Basé sur : {item.rationale}</p>}</div>))}</div>}</div>)}
                {employeeTab === 'history' && (<div className="space-y-4">{reportsHistory.length === 0 ? <div className="text-center py-12 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed">Aucun bilan.</div> : reportsHistory.map(r => (<div key={r.id} className="bg-white border rounded-xl p-6 shadow-sm"><div className="flex justify-between items-center mb-4 border-b pb-4"><div className="flex items-center gap-2 text-gray-500"><Clock size={16} /><span className="text-sm">Généré le {new Date(r.date).toLocaleDateString()}</span></div><Button variant="ghost" icon={FileText} onClick={() => navigator.clipboard.writeText(r.content)}>Copier</Button></div><div className="prose prose-indigo prose-sm max-w-none text-gray-700"><div className="whitespace-pre-wrap font-serif bg-gray-50 p-4 rounded-lg border max-h-96 overflow-y-auto">{r.content}</div></div></div>))}</div>)}
                {employeeTab === 'training' && (<div className="space-y-6"><div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3"><div className="bg-white p-2 rounded-full text-blue-600 mt-1"><Sparkles size={18}/></div><div><h4 className="font-bold text-blue-800 text-sm">Formations LinkedIn Learning</h4><p className="text-sm text-blue-700 mt-1">Suggestions ciblées.</p></div></div>{trainings.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border border-dashed"><Button onClick={generateTrainingRecommendations} icon={Search} isLoading={isGeneratingTraining}>Analyser les besoins</Button></div> : <div className="grid gap-4">{trainings.map(item => (<div key={item.id} className="bg-white border rounded-xl p-5 shadow-sm hover:border-blue-200"><div className="flex justify-between items-start mb-2"><h3 className="font-bold text-gray-800 text-lg">{item.topic}</h3><button onClick={() => handleDeleteItem('trainings', item.id)} className="text-gray-300 hover:text-red-500"><X size={16}/></button></div><p className="text-sm text-gray-600 mb-4 italic">"{item.reason}"</p><div className="flex justify-start"><a href={`https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(item.keywords)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#0a66c2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#004182]"><ExternalLink size={16}/> Voir sur LinkedIn</a></div></div>))}</div>}</div>)}
                {employeeTab === 'reading' && (<div className="space-y-6"><div className="bg-orange-50 p-4 rounded-lg border border-orange-100 flex items-start gap-3"><div className="bg-white p-2 rounded-full text-orange-600 mt-1"><Book size={18}/></div><div><h4 className="font-bold text-orange-800 text-sm">Lectures Inspirantes</h4></div></div>{readings.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border border-dashed"><Button onClick={generateReadingRecommendations} icon={Search} isLoading={isGeneratingReading} variant="secondary">Suggérer</Button></div> : <div className="grid gap-4">{readings.map(item => (<div key={item.id} className="bg-white border rounded-xl p-5 shadow-sm hover:border-orange-200 group"><div className="flex justify-between items-start mb-2"><div><h3 className="font-bold text-gray-900 text-lg">{item.title}</h3><p className="text-sm text-gray-500 font-medium">de {item.author}</p></div><button onClick={() => handleDeleteItem('readings', item.id)} className="text-gray-300 hover:text-red-500"><X size={16}/></button></div><p className="text-sm text-gray-600 mb-4 italic mt-2">"{item.reason}"</p><div className="flex justify-start"><a href={`https://www.amazon.fr/s?k=${encodeURIComponent(item.keywords)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#FF9900] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#e68a00] shadow-sm"><ExternalLink size={16}/> Voir sur Amazon</a></div></div>))}</div>}</div>)}
            </div></div>
          </div>
        )}
        {view === 'report' && selectedEmployee && (
          <div className="absolute inset-0 bg-gray-900/50 z-50 backdrop-blur-sm flex justify-end">
            <div className="w-full md:w-2/3 lg:w-1/2 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50"><h2 className="font-bold text-xl text-gray-800 flex items-center gap-2"><Bot className="text-indigo-600" /> Bilan Assistant IA</h2><button onClick={() => { setView('employee'); setEmployeeTab('history'); }} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={24} /></button></div>
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">{isGenerating ? <div className="h-full flex flex-col items-center justify-center text-center space-y-4"><div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div><p className="text-indigo-800 font-medium animate-pulse">L'IA rédige l'évaluation...</p></div> : generatedReport ? <div className="space-y-6"><div className="bg-white rounded-xl border border-gray-200 shadow-lg p-8 prose prose-indigo max-w-none"><div className="whitespace-pre-wrap text-gray-800 font-serif leading-relaxed">{generatedReport.response}</div></div><div className="bg-green-50 text-green-800 p-3 rounded-lg text-sm text-center font-medium border border-green-200">✓ Bilan sauvegardé automatiquement dans les Bilans</div><Button variant="secondary" icon={FileText} className="w-full" onClick={() => navigator.clipboard.writeText(generatedReport.response)}>Copier le Bilan</Button></div> : null}</div>
            </div>
          </div>
        )}
      </main>
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Nouveau Collaborateur"><form onSubmit={handleAddEmployee}><div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">Nom Complet</label><input type="text" placeholder="Ex: Julie Dupont" className="w-full p-2.5 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} autoFocus /></div><div className="mb-6"><label className="block text-sm font-medium text-gray-700 mb-1">Poste / Rôle</label><input type="text" placeholder="Ex: Développeur Senior" className="w-full p-2.5 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={newEmployeeRole} onChange={(e) => setNewEmployeeRole(e.target.value)} /></div><div className="flex gap-3 justify-end"><Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Annuler</Button><Button type="submit" disabled={!newEmployeeName.trim()} isLoading={isAddingEmployee}>Créer</Button></div></form></Modal>
      <Modal isOpen={!!noteToDelete} onClose={() => setNoteToDelete(null)} title="Confirmation de suppression"><div className="text-center space-y-4"><div className="mx-auto bg-red-100 w-12 h-12 rounded-full flex items-center justify-center"><AlertTriangle className="text-red-600" size={24} /></div><p className="text-gray-600">Êtes-vous sûr de vouloir supprimer cette note définitivement ? <br/> Cette action est irréversible.</p><div className="flex gap-3 justify-center mt-4"><Button variant="secondary" onClick={() => setNoteToDelete(null)}>Annuler</Button><Button variant="danger" onClick={confirmDeleteNote} isLoading={isDeletingNote}>Supprimer</Button></div></div></Modal>
      <Modal isOpen={!!employeeToDelete} onClose={() => setEmployeeToDelete(null)} title="Supprimer le collaborateur ?"><div className="text-center space-y-4"><div className="mx-auto bg-red-100 w-12 h-12 rounded-full flex items-center justify-center"><AlertTriangle className="text-red-600" size={24} /></div><h3 className="font-bold text-gray-900">Attention, action irréversible !</h3><p className="text-gray-600 text-sm">Vous êtes sur le point de supprimer <strong>{employeeToDelete?.name}</strong>.<br/>Cela effacera <strong>définitivement</strong> tout son historique : notes, bilans, formations et lectures recommandées.</p><div className="flex gap-3 justify-center mt-4"><Button variant="secondary" onClick={() => setEmployeeToDelete(null)}>Annuler</Button><Button variant="danger" onClick={handleDeleteEmployeeFull} isLoading={isDeletingEmployee}>Tout supprimer</Button></div></div></Modal>
    </div>
  );
}