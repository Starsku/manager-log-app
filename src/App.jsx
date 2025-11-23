import React, { useState, useEffect } from 'react';
import { 
  Users, BookOpen, Plus, Save, Trash2, Sparkles, Menu, X, UserPlus, FileText, 
  ChevronRight, Briefcase, Loader2, AlertCircle, CheckCircle2, LogOut, Bot, 
  Settings, History, RefreshCw, Clock, Edit, Check, AlertTriangle, GraduationCap, 
  ExternalLink, Search, Book, Library, Target, Wand2, ArrowRight, PenTool,
  Wifi, Database, ShieldCheck, LogIn, Mail, Lock, Mic, MicOff, Pencil, Calendar,
  HelpCircle, Linkedin, Lightbulb, MousePointerClick
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
const DEFAULT_REPORT_PROMPT = `Tu es un expert RH et un manager bienveillant mais rigoureux.\nVoici les notes brutes prises au cours de l'année pour mon collaborateur : {{NOM}} (Poste : {{ROLE}}).\n\nNOTES BRUTES :\n{{NOTES}}\n\nTA MISSION :\nRédige une évaluation annuelle formelle en Français, structurée et professionnelle.\nNe mentionne pas "d'après les notes", fais comme si tu avais tout observé toi-même.\nSois précis. Cite des exemples concrets tirés des notes pour justifier tes propos.\n\nSTRUCTURE REQUISE :\n# Synthèse globale de l'année\n(Ton général)\n\n# Points Forts et Réussites\n(Basé sur les notes positives)\n\n# Axes d'amélioration et Points de vigilance\n(Basé sur les notes "À améliorer", sois constructif)\n\n# Plan d'action suggéré\n(Pour l'année prochaine)\n\n# Conclusion motivante\n\nIMPORTANT : Ne mentionne pas être une IA. Signe "Le Manager". Utilise le format Markdown standard (tableaux acceptés).`;

const DEFAULT_TRAINING_PROMPT = `Tu es un expert en Learning & Development chez LinkedIn Learning.\nAnalyse les notes suivantes concernant un collaborateur ({{NOM}}, {{ROLE}}) pour identifier ses lacunes techniques ou comportementales.\n\nNOTES BRUTES :\n{{NOTES}}\n\nTA MISSION :\nSuggère 3 à 5 cours précis et existants sur LinkedIn Learning.\nSois très spécifique sur les titres de cours.\nPour chaque recommandation, explique quel problème observé dans les notes cela va résoudre.\n\nFORMAT DE RÉPONSE ATTENDU (JSON UNIQUEMENT, sans markdown) :\n[\n  {\n    "topic": "Titre exact ou très proche du cours suggéré",\n    "reason": "Explication basée sur un fait précis des notes (ex: Pour améliorer la gestion des conflits notée en juin)",\n    "keywords": "Mots clés optimisés pour la barre de recherche LinkedIn Learning"\n  }\n]`;

const DEFAULT_READING_PROMPT = `Tu es un bibliothécaire expert en développement professionnel et management.\nAnalyse les notes suivantes concernant un collaborateur ({{NOM}}, {{ROLE}}).\n\nNOTES BRUTES :\n{{NOTES}}\n\nTA MISSION :\nSuggère exactement 3 livres (essais, business, psycho, tech) pertinents.\n- Si les notes sont positives : des livres pour aller plus loin, inspirer, ou sur le leadership.\n- Si les notes sont mitigées : des livres pour résoudre les problèmes identifiés (gestion du temps, communication, code clean...).\n\nFORMAT DE RÉPONSE ATTENDU (JSON UNIQUEMENT, sans markdown) :\n[\n  {\n    "title": "Titre du livre",\n    "author": "Auteur",\n    "reason": "Pourquoi ce livre ? (Basé sur un fait noté)",\n    "keywords": "Mots clés pour recherche Amazon (Titre + Auteur)"\n  }\n]`;

const DEFAULT_OKR_PROMPT = `Tu es un coach expert en performance et management par objectifs (OKRs).\nAnalyse l'historique des notes de {{NOM}} ({{ROLE}}) ci-dessous pour comprendre ses défis et ses forces actuels.\n\nNOTES BRUTES :\n{{NOTES}}\n\nTA MISSION :\nPropose 3 Objectifs (Objectives) trimestriels pertinents, accompagnés pour chacun de 2 Résultats Clés (Key Results) mesurables.\nCes objectifs doivent aider le collaborateur à franchir un cap l'année prochaine.\n\nFORMAT DE RÉPONSE ATTENDU (JSON UNIQUEMENT, sans markdown) :\n[\n  {\n    "objective": "L'objectif inspirant (ex: Devenir un référent technique sur le projet X)",\n    "keyResults": ["KR1 mesurable", "KR2 mesurable"],\n    "rationale": "Pourquoi cet objectif ? (basé sur les notes)"\n  }\n]`;

const DEFAULT_REWRITE_PROMPT = `Tu es un expert en communication managériale. \nAnalyse la note brute ci-dessous.\n\nTA MISSION :\n1. Reformule le texte pour qu'il soit factuel, professionnel et constructif.\n2. Détermine si c'est un "Succès" (positif) ou "Amélioration" (négatif/constructif).\n3. Détermine la catégorie : "Technique", "Management" ou "Soft Skills".\n\nNOTE BRUTE : "{{CONTENT}}"\n\nRÉPONSE ATTENDUE (JSON UNIQUEMENT) :\n{\n  "rewritten": "Le texte reformulé ici",\n  "tag": "Succès" ou "Amélioration",\n  "category": "Technique" ou "Management" ou "Soft Skills"\n}`;

// ==================================================================================
// COMPOSANTS UI & FORMATAGE AVANCÉ
// ==================================================================================

/**
 * Lecteur Markdown Amélioré
 */
const SimpleMarkdown = ({ content }) => {
  if (!content) return null;

  const formatLine = (text) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const lines = content.split('\n');
  const elements = [];
  let tableBuffer = []; 

  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    if (tableBuffer.length >= 2) {
        const headerRow = tableBuffer[0];
        const bodyRows = tableBuffer.slice(2); 
        const parseRow = (row) => row.split('|').map(c => c.trim()).filter(c => c !== '');
        const headers = parseRow(headerRow);
        const body = bodyRows.map(parseRow);

        elements.push(
            <div key={`table-${elements.length}`} className="overflow-x-auto my-6 border rounded-lg shadow-sm">
                <table className="min-w-full text-sm text-left text-gray-600">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                        <tr>{headers.map((h, i) => <th key={i} className="px-6 py-3 font-bold">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                        {body.map((row, i) => (
                            <tr key={i} className="bg-white border-b last:border-0 hover:bg-gray-50">
                                {row.map((cell, j) => <td key={j} className="px-6 py-4">{formatLine(cell)}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        tableBuffer.push(trimmed);
        continue; 
    } else {
        flushTable(); 
    }

    if (line.startsWith('# ')) elements.push(<h1 key={i} className="text-2xl font-bold text-indigo-900 mt-8 mb-4 pb-2 border-b-2 border-indigo-50">{formatLine(line.slice(2))}</h1>);
    else if (line.startsWith('## ')) elements.push(<h2 key={i} className="text-xl font-bold text-indigo-800 mt-6 mb-3">{formatLine(line.slice(3))}</h2>);
    else if (line.startsWith('### ')) elements.push(<h3 key={i} className="text-lg font-semibold text-indigo-700 mt-4 mb-2">{formatLine(line.slice(4))}</h3>);
    else if (line.startsWith('#### ')) elements.push(<h4 key={i} className="text-base font-bold text-indigo-900 mt-4 mb-2 uppercase tracking-wide flex items-center gap-2"><span className="w-2 h-2 bg-indigo-400 rounded-full"></span>{formatLine(line.slice(5))}</h4>);
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) elements.push(<div key={i} className="flex items-start gap-3 ml-2 mb-2"><span className="mt-2 w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0"></span><span className="text-gray-700 leading-relaxed">{formatLine(trimmed.slice(2))}</span></div>);
    else if (trimmed === '') elements.push(<div key={i} className="h-2"></div>);
    else elements.push(<p key={i} className="mb-2 leading-relaxed">{formatLine(line)}</p>);
  }
  flushTable(); 

  return <div className="space-y-1 font-sans">{elements}</div>;
};

const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon, disabled = false, isLoading = false, type = 'button', size = 'md' }) => {
  const baseStyle = "flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-2 py-1 text-xs", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
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
  const styles = { 'Succès': 'bg-green-100 text-green-800 border-green-200', 'Amélioration': 'bg-orange-100 text-orange-800 border-orange-200', 'Neutre': 'bg-gray-100 text-gray-800 border-gray-200', 'Soft Skills': 'bg-purple-100 text-purple-800 border-purple-200', 'Technique': 'bg-blue-100 text-blue-800 border-blue-200', 'Management': 'bg-yellow-100 text-yellow-800 border-yellow-200' };
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-slate-800">
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

  const generateRealAIReport = async () => {
    if (!selectedEmployee || notes.length === 0) {
        alert("Ajoutez des notes avant de générer un rapport.");
        return;
    }
    setIsGenerating(true);
    setGeneratedReport(null);
    
    const notesList = notes.map(n => `- ${new Date(n.date).toLocaleDateString()} [${n.tag}]: "${n.content}"`).join('\n');
    let finalPrompt = prompts.report; 
    finalPrompt = finalPrompt.replace(/{{NOM}}/g, selectedEmployee.name);
    finalPrompt = finalPrompt.replace(/{{ROLE}}/g, selectedEmployee.role);
    finalPrompt = finalPrompt.replace(/{{NOTES}}/g, notesList);

    try {
        const aiResponse = await callGemini(finalPrompt);
        
        const reportData = {
            employeeId: selectedEmployee.id,
            content: aiResponse,
            promptUsed: finalPrompt,
            createdAt: serverTimestamp(),
            date: new Date().toISOString()
        };

        if (db) {
          await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'reports'), reportData);
        }
        
        setGeneratedReport({ 
            response: aiResponse,
            date: new Date() 
        });
        
        setEmployeeTab('history'); 
    } catch (error) {
        console.error(error);
        alert("Erreur lors de la génération du bilan.");
    } finally {
        setIsGenerating(false);
    }
  };

  const generateOkrs = async () => {
     if (!selectedEmployee || notes.length === 0) { alert("Il faut des notes pour analyser les objectifs."); return; }
     setIsGeneratingOkrs(true);
     
     const notesList = notes.map(n => `- ${n.tag}: "${n.content}"`).join('\n');
     let finalPrompt = prompts.okr; 
     finalPrompt = finalPrompt.replace(/{{NOM}}/g, selectedEmployee.name);
     finalPrompt = finalPrompt.replace(/{{ROLE}}/g, selectedEmployee.role);
     finalPrompt = finalPrompt.replace(/{{NOTES}}/g, notesList);

     try {
        const aiResponseRaw = await callGemini(finalPrompt);
        let cleanJson = aiResponseRaw.replace(/```json/g, '').replace(/```/g, '').trim();
        const generatedOkrs = JSON.parse(cleanJson);

        if(Array.isArray(generatedOkrs) && db) {
           const batchPromises = generatedOkrs.map(okr => 
              addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'okrs'), {
                 employeeId: selectedEmployee.id,
                 objective: okr.objective,
                 keyResults: okr.keyResults,
                 rationale: okr.rationale,
                 createdAt: serverTimestamp()
              })
           );
           await Promise.all(batchPromises);
        }
     } catch (error) {
        console.error(error);
        alert("Erreur de génération (Format JSON invalide).");
     } finally {
        setIsGeneratingOkrs(false);
     }
  };

  const generateTrainingRecommendations = async () => {
     if (!selectedEmployee || notes.length === 0) { alert("Il faut des notes pour analyser les besoins."); return; }
     setIsGeneratingTraining(true);
     
     const notesList = notes.map(n => `- ${n.tag}: "${n.content}"`).join('\n');
     let finalPrompt = prompts.training; 
     finalPrompt = finalPrompt.replace(/{{NOM}}/g, selectedEmployee.name);
     finalPrompt = finalPrompt.replace(/{{ROLE}}/g, selectedEmployee.role);
     finalPrompt = finalPrompt.replace(/{{NOTES}}/g, notesList);

     try {
        const aiResponseRaw = await callGemini(finalPrompt);
        let cleanJson = aiResponseRaw.replace(/```json/g, '').replace(/```/g, '').trim();
        const recommendations = JSON.parse(cleanJson);

        if(Array.isArray(recommendations) && db) {
           const topRecs = recommendations.slice(0, 5);
           const batchPromises = topRecs.map(rec => 
              addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'trainings'), {
                 employeeId: selectedEmployee.id,
                 topic: rec.topic,
                 reason: rec.reason,
                 keywords: rec.keywords,
                 createdAt: serverTimestamp()
              })
           );
           await Promise.all(batchPromises);
        }
     } catch (error) {
        console.error(error);
        alert("Erreur d'analyse.");
     } finally {
        setIsGeneratingTraining(false);
     }
  };

  const generateReadingRecommendations = async () => {
    if (!selectedEmployee || notes.length === 0) { alert("Il faut des notes pour analyser les besoins."); return; }
    setIsGeneratingReading(true);
    
    const notesList = notes.map(n => `- ${n.tag}: "${n.content}"`).join('\n');
    let finalPrompt = prompts.reading; 
    finalPrompt = finalPrompt.replace(/{{NOM}}/g, selectedEmployee.name);
    finalPrompt = finalPrompt.replace(/{{ROLE}}/g, selectedEmployee.role);
    finalPrompt = finalPrompt.replace(/{{NOTES}}/g, notesList);

    try {
       const aiResponseRaw = await callGemini(finalPrompt);
       let cleanJson = aiResponseRaw.replace(/```json/g, '').replace(/```/g, '').trim();
       const recommendations = JSON.parse(cleanJson);

       if(Array.isArray(recommendations) && db) {
          const batchPromises = recommendations.map(rec => 
             addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'readings'), {
                employeeId: selectedEmployee.id,
                title: rec.title,
                author: rec.author,
                reason: rec.reason,
                keywords: rec.keywords,
                createdAt: serverTimestamp()
             })
          );
          await Promise.all(batchPromises);
       }
    } catch (error) {
       console.error(error);
       alert("Erreur d'analyse.");
    } finally {
       setIsGeneratingReading(false);
    }
  };


  // ==================================================================================
  // RENDU DE L'INTERFACE
  // ==================================================================================

  if (loading) {
    return (
        <div className="h-screen flex items-center justify-center text-blue-600 bg-gray-50">
            <Loader2 className="animate-spin mr-2" /> Chargement...
        </div>
    );
  }

  // --- ÉCRAN DE CONNEXION (Si non connecté) ---
  if (!user) {
      return <LoginScreen onGoogleLogin={handleGoogleLogin} onEmailLogin={handleEmailLogin} onEmailSignUp={handleEmailSignUp} error={authError || configError} />;
  }

  // --- APPLICATION (Si connecté) ---
  return (
    <div className="flex h-screen bg-gray-50 text-slate-800 font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
             {/* Logo avec fallback si le fichier n'est pas trouvé */}
             <img 
                src="/logo.png" 
                alt="Reviewiz.ai" 
                className="h-8 w-auto object-contain" 
                onError={(e) => {
                    e.target.onerror = null; 
                    e.target.src='https://placehold.co/150x40?text=Reviewiz.ai'
                }}
            />
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-gray-400">
            <X size={24} />
          </button>
        </div>

        {/* Menu Items */}
        <div className="p-4 flex flex-col h-full overflow-y-auto">
          
          <div className="mb-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Général</h3>
            <button
              onClick={() => { setSelectedEmployee(null); setView('dashboard'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 mb-1
                ${view === 'dashboard' && !selectedEmployee ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Users size={18} /> Vue d'ensemble
            </button>
            <button
              onClick={() => { setView('settings'); setSelectedEmployee(null); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3
                ${view === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Settings size={18} /> Configuration IA
            </button>
            {/* SECTION AIDE */}
             <button
              onClick={() => { setView('help'); setSelectedEmployee(null); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3
                ${view === 'help' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <HelpCircle size={18} /> Aide
            </button>
          </div>

          {/* SECTION SUPPORT */}
          <div className="mb-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Support</h3>
            <a
              href="https://www.linkedin.com/in/stéphane-carlier-977a636"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 text-gray-600 hover:bg-gray-50 hover:text-blue-600"
            >
              <Linkedin size={18} /> Contact
            </a>
          </div>

          <div className="flex justify-between items-center mb-2 px-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mon Équipe</h3>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-md transition-colors"
              title="Ajouter un collaborateur"
            >
              <UserPlus size={16} />
            </button>
          </div>

          <div className="space-y-1">
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => { 
                    setSelectedEmployee(emp); 
                    setView('employee'); 
                    setGeneratedReport(null); 
                    setMobileMenuOpen(false); 
                    setEmployeeTab('journal'); 
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3
                    ${selectedEmployee?.id === emp.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <img src={emp.avatar} alt={emp.name} className="w-8 h-8 rounded-full border border-gray-100 bg-white" />
                <div className="truncate flex-1 text-left">
                  <div className="truncate font-semibold">{emp.name}</div>
                  <div className="text-xs text-gray-400 truncate font-normal">{emp.role}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center gap-3 mb-3 p-2 rounded-lg bg-white border border-gray-100 shadow-sm">
                {user.photoURL ? (
                    <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="Profile"/>
                ) : (
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                        {user.email?.[0].toUpperCase()}
                    </div>
                )}
                <div className="overflow-hidden">
                    <div className="text-sm font-bold truncate text-gray-800">{user.displayName || "Utilisateur"}</div>
                    <div className="text-xs text-gray-400 truncate">{user.email}</div>
                </div>
            </div>
            <button 
                onClick={handleLogout} 
                className="flex items-center gap-2 text-xs text-red-500 hover:bg-red-50 w-full px-3 py-2 rounded-lg transition-colors font-medium justify-center"
            >
                <LogOut size={14} /> <span>Se déconnecter</span>
            </button>
            <div className="text-center mt-4 text-[10px] text-gray-300 font-medium uppercase tracking-widest">
                © {new Date().getFullYear()} Reviewiz.ai
            </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
        
        {/* HEADER MOBILE */}
        <div className="md:hidden bg-white border-b p-4 flex items-center gap-3 shrink-0 shadow-sm z-20">
          <button onClick={() => setMobileMenuOpen(true)} className="text-gray-600 p-2 hover:bg-gray-100 rounded-lg">
            <Menu size={24}/>
          </button>
          <span className="font-bold text-gray-800 truncate">
            {view === 'settings' ? 'Configuration' : selectedEmployee ? selectedEmployee.name : 'Tableau de Bord'}
          </span>
        </div>

        {/* --- VUE AIDE --- */}
        {view === 'help' && (
            <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-gray-50">
                <div className="max-w-4xl mx-auto">
                    <header className="mb-10 text-center">
                        <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <HelpCircle size={32} className="text-indigo-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Comment utiliser Reviewiz.ai ?</h1>
                        <p className="text-gray-500">Guide rapide pour maîtriser votre assistant RH en 4 étapes.</p>
                    </header>

                    <div className="grid gap-8 md:grid-cols-2">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="bg-blue-100 text-blue-600 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg">1</div>
                                <h3 className="font-bold text-lg text-gray-800">Créez votre équipe</h3>
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Cliquez sur <span className="font-medium text-gray-800">+ Ajouter un collaborateur</span> dans le tableau de bord. Renseignez le nom et le poste de chaque membre.
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="bg-green-100 text-green-600 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg">2</div>
                                <h3 className="font-bold text-lg text-gray-800">Alimentez le journal</h3>
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Au fil de l'eau, ajoutez des notes. Vous pouvez écrire ou utiliser le micro 🎙️. 
                                Utilisez le bouton <span className="font-medium text-indigo-600"><Wand2 size={12} className="inline"/> Analyser</span> pour que l'IA reformule et classe vos notes.
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="bg-purple-100 text-purple-600 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg">3</div>
                                <h3 className="font-bold text-lg text-gray-800">Générez des Bilans</h3>
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Lors des entretiens, cliquez sur <span className="font-medium text-indigo-600">Générer Bilan IA</span>. L'IA analyse l'historique pour rédiger une synthèse structurée et professionnelle.
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="bg-orange-100 text-orange-600 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg">4</div>
                                <h3 className="font-bold text-lg text-gray-800">Développez les talents</h3>
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Utilisez les onglets <strong>Formations</strong>, <strong>Lectures</strong> et <strong>Objectifs</strong> pour obtenir des suggestions personnalisées par l'IA.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- VIEW: SETTINGS --- */}
        {view === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
            <div className="max-w-5xl mx-auto h-full flex flex-col">
              <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <Sparkles className="text-indigo-600" /> Configuration de l'IA
                </h1>
                <p className="text-gray-500 mt-2">
                  Personnalisez les instructions (Prompts) données à l'IA pour chaque module.
                </p>
              </header>

              <div className="flex-1 flex flex-col md:flex-row gap-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Settings Sidebar */}
                <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 flex flex-row md:flex-col overflow-x-auto md:overflow-visible">
                    {[
                        { id: 'report', label: 'Bilan Annuel', icon: FileText },
                        { id: 'training', label: 'Formations', icon: GraduationCap },
                        { id: 'reading', label: 'Lectures', icon: Book },
                        { id: 'okr', label: 'OKRs', icon: Target },
                        { id: 'rewrite', label: 'Reformulation', icon: PenTool }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSettingsTab(tab.id)}
                            className={`p-4 text-sm font-medium flex items-center gap-3 transition-colors border-b md:border-b-0 whitespace-nowrap md:whitespace-normal
                                ${settingsTab === tab.id ? 'bg-white text-indigo-600 border-indigo-500 md:border-l-4 md:border-r-0 border-b-2 md:border-b-0' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-transparent md:border-l-4'}`}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Settings Content */}
                <div className="flex-1 p-6 flex flex-col h-[500px] md:h-auto">
                    <div className="flex-1 mb-4 relative">
                         <textarea
                            value={prompts[settingsTab]}
                            onChange={(e) => setPrompts(prev => ({ ...prev, [settingsTab]: e.target.value }))}
                            className="w-full h-full p-4 font-mono text-sm bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                            placeholder="Entrez votre prompt ici..."
                        />
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                        <Button variant="ghost" onClick={handleResetPrompt} icon={RefreshCw}>Restaurer défaut</Button>
                        <div className="flex items-center gap-3">
                            {successMsg && <span className="text-green-600 text-sm font-medium flex items-center gap-1"><CheckCircle2 size={16}/> {successMsg}</span>}
                            <Button onClick={handleSaveSettings} icon={Save} isLoading={isSavingSettings}>Sauvegarder tout</Button>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: DASHBOARD --- */}
        {view === 'dashboard' && !selectedEmployee && (
          <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-gray-50">
             <header className="mb-10 max-w-4xl mx-auto">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Tableau de Bord</h1>
              <p className="text-gray-500">Gérez vos notes et préparez vos évaluations sans stress.</p>
            </header>
            
            <div className="max-w-4xl mx-auto">
              {employees.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center shadow-sm">
                   <div className="bg-indigo-50 p-4 rounded-full mb-4"><Users className="h-8 w-8 text-indigo-500" /></div>
                   <h3 className="text-xl font-bold text-gray-900 mb-2">Votre équipe est vide</h3>
                   <p className="text-gray-500 mb-6">Commencez par ajouter votre premier collaborateur.</p>
                   <Button onClick={() => setIsAddModalOpen(true)} icon={Plus}>Ajouter un collaborateur</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <button 
                    onClick={() => setIsAddModalOpen(true)} 
                    className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group h-full min-h-[160px]"
                  >
                    <Plus size={32} className="text-gray-400 group-hover:text-indigo-600 mb-3 transition-colors" />
                    <span className="font-medium text-gray-500 group-hover:text-indigo-700">Ajouter un membre</span>
                  </button>
                  
                  {employees.map(emp => (
                    <div 
                        key={emp.id} 
                        onClick={() => { setSelectedEmployee(emp); setView('employee'); }} 
                        className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-indigo-100 transition-all cursor-pointer relative group flex flex-col items-center text-center"
                    >
                        <img src={emp.avatar} alt={emp.name} className="w-20 h-20 rounded-full border-4 border-indigo-50 shadow-sm mb-4" />
                        <h3 className="font-bold text-gray-900 text-lg">{emp.name}</h3>
                        <p className="text-sm text-gray-500 mb-4">{emp.role}</p>
                        <div className="mt-auto w-full pt-4 border-t border-gray-50">
                            <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Voir le dossier</span>
                        </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- VIEW: EMPLOYEE --- */}
        {selectedEmployee && view === 'employee' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50">
            
            {/* HEADER EMPLOYÉ */}
            <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex justify-between items-center shadow-sm z-10 shrink-0">
              <div className="flex items-center gap-4">
                <img src={selectedEmployee.avatar} className="w-12 h-12 rounded-full hidden md:block border border-gray-100" />
                <div>
                  {isEditingName ? (
                      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                          <input 
                            autoFocus
                            className="text-lg font-bold border border-indigo-300 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateEmployeeName()}
                          />
                          <button onClick={handleUpdateEmployeeName} className="text-green-600 hover:bg-green-50 p-1 rounded"><Check size={20}/></button>
                          <button onClick={() => setIsEditingName(false)} className="text-red-500 hover:bg-red-50 p-1 rounded"><X size={20}/></button>
                      </div>
                  ) : (
                      <div className="flex items-center gap-2 group">
                        <h2 className="font-bold text-gray-900 text-xl leading-tight">{selectedEmployee.name}</h2>
                        <button 
                            onClick={() => { setIsEditingName(true); setEditNameValue(selectedEmployee.name); }} 
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-all transform hover:scale-110"
                            title="Modifier le nom"
                        >
                            <Pencil size={16} />
                        </button>
                      </div>
                  )}
                  <p className="text-sm text-gray-500">{selectedEmployee.role}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                  <Button 
                    onClick={() => { setView('report'); generateRealAIReport(); }} 
                    icon={Sparkles}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
                  >
                    <span className="hidden md:inline">Générer Bilan IA</span>
                    <span className="md:hidden">Bilan</span>
                  </Button>
                  <button 
                     onClick={() => setEmployeeToDelete(selectedEmployee)}
                     className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" 
                     title="Supprimer ce collaborateur"
                  >
                     <Trash2 size={20} />
                  </button>
              </div>
            </div>

            {/* TABS NAVIGATION */}
            <div className="bg-white border-b border-gray-200 px-4 md:px-8 flex gap-8 overflow-x-auto hide-scrollbar">
              {[
                  {id:'journal', label:'Journal', icon:FileText, count:notes.length}, 
                  {id:'okrs', label:'Objectifs', icon:Target, count:okrs.length}, 
                  {id:'history', label:'Bilans', icon:History, count:reportsHistory.length}, 
                  {id:'training', label:'Formations', icon:GraduationCap, count:trainings.length}, 
                  {id:'reading', label:'Lectures', icon:Library, count:readings.length}
              ].map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => setEmployeeTab(t.id)} 
                    className={`py-4 text-sm font-medium border-b-2 transition-all flex items-center gap-2 shrink-0
                        ${employeeTab === t.id 
                            ? 'border-indigo-600 text-indigo-600' 
                            : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}
                  >
                    <t.icon size={18} className={employeeTab === t.id ? 'text-indigo-600' : 'text-gray-400'}/> 
                    {t.label} 
                    <span className={`text-xs px-2 py-0.5 rounded-full ${employeeTab === t.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>{t.count}</span>
                  </button>
              ))}
            </div>

            {/* TAB CONTENT AREA */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50">
                <div className="max-w-5xl mx-auto w-full p-6 md:p-10">
                
                {/* === TAB: JOURNAL === */}
                {employeeTab === 'journal' && (
                  <>
                    {/* INPUT BOX */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8 transition-all hover:shadow-md">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                              <PenTool size={16}/> Nouvelle Note
                          </h3>
                          {successMsg && (
                              <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full flex items-center gap-1 font-bold animate-in fade-in">
                                  <CheckCircle2 size={12} /> {successMsg}
                              </span>
                          )}
                      </div>
                      
                      <div className="relative group">
                        <textarea
                            className="w-full p-4 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none resize-none text-sm mb-4 pr-24 min-h-[100px]"
                            rows="3"
                            placeholder="Qu'a fait ce collaborateur aujourd'hui ? (ex: 'Excellente présentation client...')"
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter' && e.ctrlKey) handleAddNote(); }}
                        ></textarea>
                        
                        {/* Magic Buttons */}
                        <div className="absolute right-3 bottom-7 flex gap-2">
                             <button 
                                onClick={startListening}
                                className={`p-2 rounded-lg border transition-all shadow-sm flex items-center gap-2 text-xs font-medium
                                    ${isListening 
                                        ? 'bg-red-50 text-red-600 border-red-200 animate-pulse ring-2 ring-red-100' 
                                        : 'bg-white text-gray-500 border-gray-200 hover:text-indigo-600 hover:border-indigo-200'}`}
                                title="Dicter une note"
                            >
                                {isListening ? <><MicOff size={16} /> Stop</> : <Mic size={16} />}
                            </button>
                            
                            <button 
                                onClick={handleRewriteNote}
                                disabled={!noteContent.trim() || isRewriting}
                                className="p-2 bg-white border border-indigo-100 rounded-lg text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 text-xs font-medium"
                                title="L'IA reformule et catégorise automatiquement"
                            >
                                {isRewriting ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                                <span className="hidden sm:inline">Analyser & Reformuler</span>
                            </button>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2 border-t border-gray-50">
                        <div className="flex gap-3 w-full sm:w-auto">
                          <select 
                            value={noteTag} 
                            onChange={(e) => setNoteTag(e.target.value)} 
                            className="text-sm p-2.5 pr-8 rounded-lg bg-white border border-gray-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 outline-none cursor-pointer hover:bg-gray-50"
                          >
                            <option value="Succès">👍 Succès</option>
                            <option value="Amélioration">⚠️ À Améliorer</option>
                          </select>
                          
                          <select 
                            value={noteCategory} 
                            onChange={(e) => setNoteCategory(e.target.value)} 
                            className="text-sm p-2.5 pr-8 rounded-lg bg-white border border-gray-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 outline-none cursor-pointer hover:bg-gray-50"
                          >
                            <option value="Technique">🛠 Technique</option>
                            <option value="Soft Skills">🤝 Soft Skills</option>
                            <option value="Management">📊 Management</option>
                          </select>
                        </div>
                        
                        <Button onClick={handleAddNote} icon={Save} disabled={!noteContent.trim()} isLoading={isSubmittingNote} className="w-full sm:w-auto">
                            Enregistrer la note
                        </Button>
                      </div>
                    </div>

                    {/* NOTES TIMELINE */}
                    <div className="space-y-8 pl-4 pb-20">
                      {notes.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                            <div className="bg-gray-50 p-4 rounded-full mb-4 text-gray-300"><FileText size={32}/></div>
                            <p className="text-gray-400 font-medium">Aucune note pour le moment.</p>
                            <p className="text-gray-400 text-sm mt-1">Commencez à écrire ou dictez votre première observation.</p>
                        </div>
                      ) : (
                        notes.map((note) => (
                          <div key={note.id} className="relative pl-8 group animate-in slide-in-from-bottom-4 duration-500">
                             {/* Timeline Line */}
                             <div className="absolute left-[11px] top-8 bottom-[-32px] w-0.5 bg-gray-200 group-last:hidden"></div>
                             
                             {/* Timeline Dot */}
                             <div className={`absolute left-0 top-3 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10
                                ${note.tag === 'Succès' ? 'bg-green-500' : 'bg-orange-500'}`}>
                             </div>
                             
                             {/* Note Card */}
                             <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all hover:border-indigo-100">
                                {editingNoteId === note.id ? (
                                  <div className="space-y-4">
                                    <textarea 
                                        className="w-full p-3 bg-gray-50 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-100" 
                                        rows="4" 
                                        value={editContent} 
                                        onChange={(e) => setEditContent(e.target.value)}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <select value={editTag} onChange={(e) => setEditTag(e.target.value)} className="text-xs p-2 rounded border bg-white"><option value="Succès">Succès</option><option value="Amélioration">Amélioration</option></select>
                                        <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="text-xs p-2 rounded border bg-white"><option value="Technique">Technique</option><option value="Soft Skills">Soft Skills</option><option value="Management">Management</option></select>
                                    </div>
                                    <div className="flex gap-3 justify-end pt-2 border-t border-gray-50">
                                        <Button size="sm" variant="ghost" onClick={cancelEditing}>Annuler</Button>
                                        <Button size="sm" variant="success" icon={Check} onClick={handleUpdateNote} isLoading={isUpdatingNote}>Valider</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex justify-between items-start mb-3">
                                      <div className="flex flex-wrap gap-3 items-center">
                                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                                            {new Date(note.date).toLocaleDateString()} 
                                            <span className="font-normal text-gray-400">| {new Date(note.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </span>
                                        <Badge type={note.tag} />
                                        <Badge type={note.category} />
                                      </div>
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => startEditing(note)} className="text-gray-300 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded transition-colors"><Edit size={14} /></button>
                                          <button onClick={() => setNoteToDelete(note)} className="text-gray-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
                                      </div>
                                    </div>
                                    <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>
                                  </>
                                )}
                             </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}

                {/* === TAB: OKRS === */}
                {employeeTab === 'okrs' && (
                  <div className="space-y-8">
                    <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 flex items-start gap-4 shadow-sm">
                        <div className="bg-white p-3 rounded-full text-indigo-600 shadow-sm mt-1"><Target size={24}/></div>
                        <div>
                           <h4 className="font-bold text-indigo-900 text-lg">Objectifs Intelligents (OKRs)</h4>
                           <p className="text-sm text-indigo-700 mt-1 leading-relaxed">
                               L'IA analyse l'historique des notes pour suggérer 3 objectifs majeurs et des résultats clés mesurables pour le prochain trimestre.
                           </p>
                        </div>
                    </div>
                    
                    {okrs.length === 0 ? (
                       <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                         <Target className="h-16 w-16 text-gray-200 mb-4" />
                         <p className="text-gray-500 mb-6 font-medium">Aucun objectif défini pour le moment.</p>
                         <Button onClick={generateOkrs} icon={Sparkles} isLoading={isGeneratingOkrs} variant="magic" size="lg">Générer des OKRs avec l'IA ✨</Button>
                       </div>
                    ) : (
                       <>
                        <div className="flex justify-end">
                            <Button variant="ghost" size="sm" onClick={generateOkrs} isLoading={isGeneratingOkrs} icon={RefreshCw}>Régénérer les OKRs ✨</Button>
                        </div>
                        <div className="grid gap-6">
                          {okrs.map(item => (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all">
                               <div className="flex justify-between items-start mb-4">
                                  <h3 className="font-bold text-gray-900 text-lg flex items-center gap-3">
                                    <span className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg"><Target size={20} /></span>
                                    {item.objective}
                                  </h3>
                                  <button onClick={() => handleDeleteItem('okrs', item.id)} className="text-gray-300 hover:text-red-500 p-1 hover:bg-red-50 rounded"><X size={18}/></button>
                               </div>
                               
                               <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">Résultats Clés (Key Results)</h4>
                                    <ul className="space-y-3">
                                        {item.keyResults && item.keyResults.map((kr, idx) => (
                                            <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                                                <ArrowRight size={16} className="mt-0.5 text-indigo-500 shrink-0" />
                                                <span>{kr}</span>
                                            </li>
                                        ))}
                                    </ul>
                               </div>
                               {item.rationale && <p className="text-xs text-gray-400 mt-4 italic flex gap-1 items-center"><Sparkles size={10}/> Basé sur : {item.rationale}</p>}
                            </div>
                          ))}
                        </div>
                       </>
                    )}
                  </div>
                )}

                {/* === TAB: BILANS (HISTORY) === */}
                {employeeTab === 'history' && (
                  <div className="space-y-6">
                    {reportsHistory.length === 0 ? (
                       <div className="text-center py-20 text-gray-400 italic bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                           <History size={48} className="text-gray-200 mb-4"/>
                           <p>Aucun bilan généré pour le moment.</p>
                           <p className="text-xs mt-2 text-gray-300">Cliquez sur "Générer Bilan IA" en haut à droite pour commencer.</p>
                       </div>
                    ) : (
                      reportsHistory.map(r => (
                        <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm hover:shadow-md transition-all">
                          <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-2 text-gray-500 font-medium">
                              <div className="bg-green-100 text-green-600 p-2 rounded-lg"><Clock size={18} /></div>
                              <span>Généré le {new Date(r.date).toLocaleDateString()} à {new Date(r.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" icon={FileText} onClick={() => navigator.clipboard.writeText(r.content)}>Copier le texte</Button>
                                <button onClick={() => handleDeleteItem('reports', r.id)} className="text-gray-300 hover:text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 size={18}/></button>
                            </div>
                          </div>
                          
                          {/* UTILISATION DU NOUVEAU LECTEUR MARKDOWN */}
                          <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                             <SimpleMarkdown content={r.content} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* === TAB: TRAINING === */}
                {employeeTab === 'training' && (
                  <div className="space-y-8">
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex items-start gap-4">
                       <div className="bg-white p-3 rounded-full text-blue-600 mt-1 shadow-sm"><GraduationCap size={24}/></div>
                       <div>
                          <h4 className="font-bold text-blue-900 text-lg">Formations LinkedIn Learning</h4>
                          <p className="text-sm text-blue-700 mt-1 leading-relaxed">
                              L'IA analyse vos notes pour identifier les lacunes (soft skills ou techniques) et propose des sujets pertinents sur LinkedIn Learning.
                          </p>
                       </div>
                    </div>
                    
                    {trainings.length === 0 ? (
                       <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                         <Search className="h-16 w-16 text-gray-200 mb-4" />
                         <p className="text-gray-500 mb-6 font-medium">Aucune recommandation pour le moment.</p>
                         <Button onClick={generateTrainingRecommendations} icon={Search} isLoading={isGeneratingTraining} size="lg">Analyser les besoins de formation</Button>
                       </div>
                    ) : (
                       <>
                        <div className="flex justify-end">
                            <Button variant="ghost" size="sm" onClick={generateTrainingRecommendations} isLoading={isGeneratingTraining} icon={RefreshCw}>Relancer l'analyse</Button>
                        </div>
                        <div className="grid gap-5">
                          {trainings.map(item => (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group">
                               <div className="flex justify-between items-start mb-3">
                                  <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                      <span className="bg-blue-100 text-blue-600 p-1 rounded"><GraduationCap size={18}/></span>
                                      {item.topic}
                                  </h3>
                                  <button onClick={() => handleDeleteItem('trainings', item.id)} className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50"><X size={18}/></button>
                               </div>
                               <p className="text-sm text-gray-600 mb-5 italic bg-gray-50 p-3 rounded border border-gray-100">
                                   <span className="font-semibold not-italic text-gray-400 block mb-1 text-xs uppercase">Pourquoi :</span>
                                   "{item.reason}"
                               </p>
                               <div className="flex justify-start">
                                  <a 
                                    href={`https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(item.keywords)}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 bg-[#0a66c2] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#004182] transition-colors shadow-sm hover:shadow"
                                  >
                                    <ExternalLink size={16}/> Voir les cours sur LinkedIn
                                  </a>
                               </div>
                            </div>
                          ))}
                        </div>
                       </>
                    )}
                  </div>
                )}

                {/* === TAB: READINGS === */}
                {employeeTab === 'reading' && (
                  <div className="space-y-8">
                    <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 flex items-start gap-4">
                       <div className="bg-white p-3 rounded-full text-orange-600 mt-1 shadow-sm"><Book size={24}/></div>
                       <div>
                          <h4 className="font-bold text-orange-900 text-lg">Lectures Inspirantes</h4>
                          <p className="text-sm text-orange-700 mt-1 leading-relaxed">
                              Des livres sélectionnés pour inspirer ce collaborateur ou l'aider à surmonter ses défis spécifiques.
                          </p>
                       </div>
                    </div>
                    
                    {readings.length === 0 ? (
                       <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                         <Library className="mx-auto h-16 w-16 text-gray-200 mb-4" />
                         <p className="text-gray-500 mb-6 font-medium">Aucune lecture suggérée.</p>
                         <Button onClick={generateReadingRecommendations} icon={Search} isLoading={isGeneratingReading} variant="secondary" size="lg">Suggérer des livres</Button>
                       </div>
                    ) : (
                       <>
                        <div className="flex justify-end">
                            <Button variant="ghost" size="sm" onClick={generateReadingRecommendations} isLoading={isGeneratingReading} icon={RefreshCw}>Nouvelles suggestions</Button>
                        </div>
                        <div className="grid gap-5">
                          {readings.map(item => (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:border-orange-300 hover:shadow-md transition-all group">
                               <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                        <Book size={18} className="text-orange-500"/> {item.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 font-medium ml-6">de {item.author}</p>
                                  </div>
                                  <button onClick={() => handleDeleteItem('readings', item.id)} className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50"><X size={18}/></button>
                                </div>
                               <p className="text-sm text-gray-600 mb-5 italic bg-gray-50 p-3 rounded border border-gray-100">"{item.reason}"</p>
                               <div className="flex justify-start">
                                  <a 
                                    href={`https://www.amazon.fr/s?k=${encodeURIComponent(item.keywords)}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 bg-[#FF9900] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#e68a00] shadow-sm transition-colors"
                                  >
                                    <ExternalLink size={16}/> Voir sur Amazon
                                  </a>
                               </div>
                            </div>
                          ))}
                        </div>
                       </>
                    )}
                  </div>
                )}

            </div></div>
          </div>
        )}

        {/* --- OVERLAY: REPORT GENERATION --- */}
        {view === 'report' && selectedEmployee && (
          <div className="absolute inset-0 bg-gray-900/50 z-50 backdrop-blur-sm flex justify-end">
            <div className="w-full md:w-2/3 lg:w-1/2 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h2 className="font-bold text-xl text-gray-800 flex items-center gap-2"><Bot className="text-indigo-600" /> Bilan Assistant IA</h2>
                <button onClick={() => { setView('employee'); setEmployeeTab('history'); }} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
                {isGenerating ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                    <div className="relative">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600"></div>
                        <div className="absolute inset-0 flex items-center justify-center"><Sparkles size={20} className="text-indigo-600 animate-pulse"/></div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">L'IA rédige l'évaluation...</h3>
                        <p className="text-gray-500">Analyse de {notes.length} notes et structuration du bilan.</p>
                    </div>
                  </div>
                ) : generatedReport ? (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-8">
                        {/* Utilisation du lecteur Markdown ici aussi pour la prévisualisation */}
                        <SimpleMarkdown content={generatedReport.response} />
                    </div>
                    <div className="flex items-center justify-center gap-2 bg-green-50 text-green-800 p-4 rounded-xl text-sm font-medium border border-green-200">
                      <CheckCircle2 size={18}/> Bilan sauvegardé automatiquement dans l'onglet "Bilans"
                    </div>
                    <Button variant="secondary" icon={FileText} className="w-full py-4 shadow-sm border-gray-300" onClick={() => navigator.clipboard.writeText(generatedReport.response)}>
                        Copier le texte du bilan
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ADD EMPLOYEE MODAL */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Nouveau Collaborateur">
        <form onSubmit={handleAddEmployee}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom Complet</label>
            <input 
                type="text" 
                placeholder="Ex: Julie Dupont" 
                className="w-full p-3 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                value={newEmployeeName} 
                onChange={(e) => setNewEmployeeName(e.target.value)} 
                autoFocus 
            />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Poste / Rôle</label>
            <input 
                type="text" 
                placeholder="Ex: Développeur Senior" 
                className="w-full p-3 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                value={newEmployeeRole} 
                onChange={(e) => setNewEmployeeRole(e.target.value)} 
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={!newEmployeeName.trim()} isLoading={isAddingEmployee}>Créer la fiche</Button>
          </div>
        </form>
      </Modal>
      
      {/* DELETE CONFIRM MODAL */}
      <Modal isOpen={!!noteToDelete} onClose={() => setNoteToDelete(null)} title="Confirmation de suppression">
        <div className="text-center space-y-4">
            <div className="mx-auto bg-red-50 w-16 h-16 rounded-full flex items-center justify-center border-4 border-red-100">
                <AlertTriangle className="text-red-600" size={32} />
            </div>
            <p className="text-gray-600">Êtes-vous sûr de vouloir supprimer cette note définitivement ? <br/> Cette action est irréversible.</p>
            <div className="flex gap-3 justify-center mt-6">
                <Button variant="secondary" onClick={() => setNoteToDelete(null)}>Annuler</Button>
                <Button variant="danger" onClick={confirmDeleteNote} isLoading={isDeletingNote}>Oui, supprimer</Button>
            </div>
        </div>
      </Modal>

      {/* DELETE EMPLOYEE CONFIRM MODAL */}
      <Modal isOpen={!!employeeToDelete} onClose={() => setEmployeeToDelete(null)} title="Supprimer le collaborateur ?">
        <div className="text-center space-y-4">
            <div className="mx-auto bg-red-100 w-12 h-12 rounded-full flex items-center justify-center border-4 border-red-100">
                <AlertTriangle className="text-red-600" size={32} />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">Attention, action irréversible !</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Vous êtes sur le point de supprimer <strong>{employeeToDelete?.name}</strong>.
              <br/>
              Cela effacera <strong>définitivement</strong> tout son historique : notes, bilans, formations et lectures recommandées.
            </p>
            <div className="flex gap-3 justify-center mt-6">
                <Button variant="secondary" onClick={() => setEmployeeToDelete(null)}>Annuler</Button>
                <Button variant="danger" onClick={handleDeleteEmployeeFull} isLoading={isDeletingEmployee}>Tout supprimer</Button>
            </div>
        </div>
      </Modal>

    </div>
  );
}