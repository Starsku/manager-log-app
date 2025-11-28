import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, BookOpen, Plus, Save, Trash2, Sparkles, Menu, X, UserPlus, FileText, 
  ChevronRight, Briefcase, Loader2, AlertCircle, CheckCircle2, LogOut, Bot, 
  Settings, History, RefreshCw, Clock, Edit, Check, AlertTriangle, GraduationCap, 
  ExternalLink, Search, Book, Library, Target, Wand2, ArrowRight, PenTool,
  Wifi, Database, ShieldCheck, LogIn, Mail, Lock, Mic, MicOff, Pencil, Calendar,
  HelpCircle, Linkedin, Lightbulb, MousePointerClick, Globe, Filter, CheckSquare, Square,
  Download, ListChecks, Crown // Ajout des icônes pour l'administration et premium
} from 'lucide-react';
// On utilise le composant interne SEOMetaTags défini plus bas.
// Note: jsPDF est chargé via CDN dans useEffect pour éviter les erreurs de build.

import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
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
  getDocs,
  orderBy,
  collectionGroup
} from 'firebase/firestore';

// Configuration Firebase
import { app, auth, db, configError, GEMINI_URL } from './config/firebase';
import { appId } from './config/constants';
import { TRANSLATIONS, PROMPT_TEMPLATES } from './config/translations';
import AdminPage from './pages/AdminPage';

// --- COMPOSANT SEO PERSONNALISÉ ---
const SEOMetaTags = ({ title, description }) => {
  useEffect(() => {
    document.title = title;
    let metaDesc = document.querySelector("meta[name='description']");
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;

    const setMeta = (prop, content) => {
        let m = document.querySelector(`meta[property='${prop}']`);
        if (!m) {
            m = document.createElement('meta');
            m.setAttribute('property', prop);
            document.head.appendChild(m);
        }
        m.setAttribute('content', content);
    };

    const origin = window.location.origin;
    const imageUrl = origin.includes('localhost') ? '/og-image.png' : `${origin}/og-image.png`;

    setMeta('og:title', title);
    setMeta('og:description', description);
    setMeta('og:image', imageUrl);
    setMeta('og:url', window.location.href);

  }, [title, description]);

  return null;
};

// Traductions et prompts déplacés dans src/config/translations.js

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
                <table className="min-w-full divide-y divide-gray-200 text-sm text-left text-gray-600">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                        <tr>{headers.map((h, i) => <th key={i} className="px-6 py-3 font-bold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {body.map((row, i) => (
                            <tr key={i} className="bg-white hover:bg-gray-50">
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

// ==================================================================================
// COMPOSANTS UTILITAIRES (BOUTONS, CARTES, etc.)
// ==================================================================================

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

const Badge = ({ type, lang }) => {
  const styles = { 'Succès': 'bg-green-100 text-green-800 border-green-200', 'Amélioration': 'bg-orange-100 text-orange-800 border-orange-200', 'Neutre': 'bg-gray-100 text-gray-800 border-gray-200', 'Soft Skills': 'bg-purple-100 text-purple-800 border-purple-200', 'Technique': 'bg-blue-100 text-blue-800 border-blue-200', 'Management': 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  
  // Fonction locale pour afficher la traduction tout en gardant la clé DB
  const displayLabel = () => {
    if (lang === 'fr') return type;
    const map = { 
        'Succès': lang === 'de' ? 'Erfolg' : 'Success', 
        'Amélioration': lang === 'de' ? 'Verbesserung' : 'Improvement', 
        'Neutre': lang === 'de' ? 'Neutral' : 'Neutral', 
        'Soft Skills': lang === 'de' ? 'Soft Skills' : 'Soft Skills', 
        'Technique': lang === 'de' ? 'Technisch' : 'Technical', 
        'Management': lang === 'de' ? 'Management' : 'Management' 
    };
    return map[type] || type;
  };

  return <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${styles[type] || 'bg-gray-100 text-gray-800'}`}>{displayLabel()}</span>;
};

// --- LOGIN SCREEN ---
const LoginScreen = ({ onGoogleLogin, onEmailLogin, onEmailSignUp, error, lang, setLang, t }) => {
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
        <SEOMetaTags 
            title="Reviewiz.ai - Login" 
            description="Accédez à votre assistant de management IA." 
        />
        <div className="absolute top-4 right-4 flex gap-4 text-sm font-medium text-gray-400 items-center">
             <Globe size={14} />
             <button onClick={() => setLang('en')} className={`transition-all hover:text-indigo-600 ${lang === 'en' ? 'text-indigo-600 font-bold underline underline-offset-4' : ''}`}>EN</button>
             <span className="text-gray-300">|</span>
             <button onClick={() => setLang('fr')} className={`transition-all hover:text-indigo-600 ${lang === 'fr' ? 'text-indigo-600 font-bold underline underline-offset-4' : ''}`}>FR</button>
             <span className="text-gray-300">|</span>
             <button onClick={() => setLang('de')} className={`transition-all hover:text-indigo-600 ${lang === 'de' ? 'text-indigo-600 font-bold underline underline-offset-4' : ''}`}>DE</button>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-gray-100">
            <div className="text-center mb-8">
                <div className="mx-auto mb-4 flex justify-center">
                     {/* J'ai aussi amélioré la balise img du logo principal pour éviter les erreurs */}
                     <img src="/logo.png" alt="Reviewiz.ai" className="h-20 w-auto object-contain" onError={(e) => {e.target.style.display='none';}}/>
                </div>
                <p className="text-gray-500 text-sm font-medium">{t('auth', 'subtitle')}</p>
            </div>

            {/* BOUTON GOOGLE CORRIGÉ */}
            <Button 
                onClick={onGoogleLogin} 
                variant="google" 
                className="w-full py-3 flex justify-center items-center gap-3 text-sm font-medium mb-6 shadow-sm border border-gray-200 hover:bg-gray-50 transition-all"
            >
                {/* Utilisation d'une URL officielle Google stable pour le logo */}
                <img 
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                    className="w-5 h-5" 
                    alt="Google" 
                    onError={(e) => {
                        // Si l'image ne charge pas, on affiche une icône de secours (ou rien)
                        e.target.style.display = 'none'; 
                    }}
                />
                {t('auth', 'google_btn')}
            </Button>

            <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">{t('auth', 'or_email')}</span></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                <div>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder={t('auth', 'email_placeholder')} required />
                    </div>
                </div>
                <div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder={t('auth', 'password_placeholder')} required minLength={6} />
                    </div>
                </div>
                <Button type="submit" className="w-full py-2.5" isLoading={loading}>
                    {isSignUp ? t('auth', 'signup_btn') : t('auth', 'login_btn')}
                </Button>
            </form>

            <div className="text-center">
                <button onClick={() => { setIsSignUp(!isSignUp); }} className="text-sm text-blue-600 hover:underline font-medium">
                    {isSignUp ? t('auth', 'toggle_login') : t('auth', 'toggle_signup')}
                </button>
            </div>
            {error && <div className="mt-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg text-left animate-in fade-in slide-in-from-top-2">⚠️ {error}</div>}
            
            <p className="mt-8 pt-6 border-t border-gray-100 text-xs text-center text-gray-400">
                {t('auth', 'copyright')}
            </p>
        </div>
    </div>
    );
};


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
  // NOTE IMPORTANTE: loading est à true par défaut. Le chargement des données utilisateur doit le passer à false.
  const [loading, setLoading] = useState(true); 
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [employeeTab, setEmployeeTab] = useState('journal'); 
  const [isGeneratingModalOpen, setIsGeneratingModalOpen] = useState(false); // New state for centered modal
  
  // Settings & Prompts
  const [settingsTab, setSettingsTab] = useState('report'); 

  // --- LANGUAGE STATE ---
  // Derive initial language once: user choice (localStorage) > fallback fr
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem('reviewiz_lang');
      if (saved) return saved;
      // Par défaut: français (plus besoin de détection navigateur)
      return 'fr';
    } catch (e) {
      return 'fr';
    }
  }); // 'fr' ou 'en' ou 'de'

  // Flag to know if user explicitly selected a language (prevents any future auto override scenarios)
  const userSelectedLanguageRef = useRef(!!(() => { try { return localStorage.getItem('reviewiz_lang'); } catch(e) { return null; } })());
  
  // --- USER PROFILE & ADMIN STATE ---
  // Initialisation avec uid: null pour forcer l'attente du chargement de Firestore
  const [userProfile, setUserProfile] = useState({uid: null, isAdmin: false, isPaid: false});

  // Auto-detect supprimé pour ne jamais écraser le choix utilisateur.

  // Wrapper that persists the user's language choice
  const setLanguage = (l) => {
    setLang(l);
    userSelectedLanguageRef.current = true;
    try { localStorage.setItem('reviewiz_lang', l); } catch (e) { /* ignore */ }
    // Update prompts to match selected language
    setPrompts({
      report: PROMPT_TEMPLATES[l]?.report || PROMPT_TEMPLATES.en.report,
      training: PROMPT_TEMPLATES[l]?.training || PROMPT_TEMPLATES.en.training,
      reading: PROMPT_TEMPLATES[l]?.reading || PROMPT_TEMPLATES.en.reading,
      okr: PROMPT_TEMPLATES[l]?.okr || PROMPT_TEMPLATES.en.okr,
      rewrite: PROMPT_TEMPLATES[l]?.rewrite || PROMPT_TEMPLATES.en.rewrite
    });
  };

  const t = (section, key) => {
      try {
          // Utilise le dictionnaire, sinon retourne la clé (pour le débug)
          return TRANSLATIONS[lang][section][key] || key;
      } catch (e) {
          return key;
      }
  };

  // --- FILTERS STATE ---
  const [filterTag, setFilterTag] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  // Computed Notes based on filters
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
        const matchesTag = filterTag === 'all' || note.tag === filterTag;
        const matchesCat = filterCategory === 'all' || note.category === filterCategory;
        return matchesTag && matchesCat;
    });
  }, [notes, filterTag, filterCategory]);

  // Initialisation des prompts avec la langue par défaut
  const [prompts, setPrompts] = useState(() => ({
      report: PROMPT_TEMPLATES[lang]?.report || PROMPT_TEMPLATES.en.report,
      training: PROMPT_TEMPLATES[lang]?.training || PROMPT_TEMPLATES.en.training,
      reading: PROMPT_TEMPLATES[lang]?.reading || PROMPT_TEMPLATES.en.reading,
      okr: PROMPT_TEMPLATES[lang]?.okr || PROMPT_TEMPLATES.en.okr,
      rewrite: PROMPT_TEMPLATES[lang]?.rewrite || PROMPT_TEMPLATES.en.rewrite
  }));

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

  // Language update is now handled in setLanguage function, no useEffect needed


  // --- AUTHENTICATION ---
  useEffect(() => {
    let unsubscribeAuth;
    let unsubscribeProfile;

    if (!auth) { 
      setLoading(false); 
      return; 
    }
    
    unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
          // On s'assure d'avoir l'UID avant d'essayer de synchroniser le profil
          unsubscribeProfile = syncUserProfile(currentUser.uid);
      } else {
          // Utilisateur déconnecté
          setUserProfile({uid: null, isAdmin: false, isPaid: false});
          setLoading(false); 
      }
    });

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // --- HANDLERS D'ADMINISTRATION ---
  const syncUserProfile = (uid) => {
      if (!db || !uid) return;
      const docRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'account');
      const adminDocRef = doc(db, 'systems', 'admins', 'users', uid);
      
      // Charger le profil utilisateur ET vérifier le statut admin dans system/admins
      Promise.all([
          getDoc(docRef),
          getDoc(adminDocRef)
      ]).then(([profileSnap, adminSnap]) => {
          const isAdmin = adminSnap.exists() && adminSnap.data()?.isAdmin === true;
          
          if (profileSnap.exists()) {
              // Mettre à jour la date de dernière connexion
              updateDoc(docRef, { lastLoginAt: serverTimestamp() }).catch(err => {
                  console.error("Erreur mise à jour lastLoginAt:", err);
              });
              setUserProfile({uid: uid, ...profileSnap.data(), isAdmin: isAdmin});
              setLoading(false);
          } else {
              // Profil n'existe pas : on le crée
              const initialData = { 
                  uid: uid,
                  email: auth.currentUser?.email || 'N/A', 
                  isPaid: false,
                  createdAt: serverTimestamp(),
                  lastLoginAt: serverTimestamp()
              };
              setDoc(docRef, initialData, { merge: true }).then(() => {
                 setUserProfile({...initialData, isAdmin: isAdmin}); 
                 setLoading(false);
              }).catch(error => {
                  console.error("Erreur de création de profil initial:", error);
                  setLoading(false);
              });
          }
      }).catch(error => {
          console.error("Erreur de lecture de profil initial:", error);
          setLoading(false);
      });
      
      // Listeners temps réel pour le profil ET le statut admin
      const unsubProfile = onSnapshot(docRef, async (s) => {
          if (s.exists()) {
              const adminSnap = await getDoc(adminDocRef);
              const isAdmin = adminSnap.exists() && adminSnap.data()?.isAdmin === true;
              setUserProfile({uid: uid, ...s.data(), isAdmin: isAdmin});
          }
      });
      
      const unsubAdmin = onSnapshot(adminDocRef, (s) => {
          const isAdmin = s.exists() && s.data()?.isAdmin === true;
          setUserProfile(prev => ({...prev, isAdmin: isAdmin}));
      });
      
      return () => {
          unsubProfile();
          unsubAdmin();
      };
  };

  // --- AUTH HANDLERS (Moved Here) ---
  const handleGoogleLogin = async () => { if (!auth) return; setAuthError(null); const provider = new GoogleAuthProvider(); try { await signInWithPopup(auth, provider); } catch (error) { console.error("Erreur Login:", error); setAuthError("Impossible de se connecter avec Google."); } };
  const handleEmailLogin = async (email, password) => { if (!auth) return; setAuthError(null); try { await signInWithEmailAndPassword(auth, email, password); } catch (error) { console.error("Erreur Login Email:", error); let msg = t('auth', 'login_error'); if(error.code === 'auth/invalid-credential') msg = "Email ou mot de passe incorrect."; setAuthError(msg); } };
  const handleEmailSignUp = async (email, password) => { if (!auth) return; setAuthError(null); try { await createUserWithEmailAndPassword(auth, email, password); } catch (error) { console.error("Erreur Inscription:", error); let msg = t('auth', 'signup_error'); if(error.code === 'auth/email-already-in-use') msg = "Email déjà utilisé."; if(error.code === 'auth/weak-password') msg = "Mot de passe trop faible."; setAuthError(msg); } };
  const handleLogout = async () => { try { await signOut(auth); setSelectedEmployee(null); setView('dashboard'); } catch (error) { console.error("Erreur déconnexion:", error); } };


  // --- DATA SYNC (Le reste des synchronisations) ---
  useEffect(() => {
    if (!user || !db) return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'employees');
    const unsubscribe = onSnapshot(q, (s) => {
      setEmployees(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedEmployee || !db) { setNotes([]); setReportsHistory([]); setTrainings([]); setReadings([]); setOkrs([]); setEditingNoteId(null); return; }
    const getQ = (c) => query(collection(db, 'artifacts', appId, 'users', user.uid, c), where('employeeId', '==', selectedEmployee.id));
    const unsubs = [
        onSnapshot(getQ('notes'), s => setNotes(s.docs.map(d => ({id:d.id,...d.data()})).sort((a,b)=>new Date(b.date)-new Date(a.date)))),
        onSnapshot(getQ('reports'), s => setReportsHistory(s.docs.map(d => ({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)))),
        onSnapshot(getQ('trainings'), s => setTrainings(s.docs.map(d => ({id:d.id,...d.data()})).sort((a,b)=> (a.status === 'done' ? 1 : -1) - (b.status === 'done' ? 1 : -1)))),
        onSnapshot(getQ('readings'), s => setReadings(s.docs.map(d => ({id:d.id,...d.data()})).sort((a,b)=> (a.status === 'done' ? 1 : -1) - (b.status === 'done' ? 1 : -1)))),
        onSnapshot(getQ('okrs'), s => setOkrs(s.docs.map(d => ({id:d.id,...d.data()})))),
    ];
    return () => unsubs.forEach(u => u());
  }, [user, selectedEmployee]);

  // --- ACTIONS ---

  const handleUpdateEmployeeName = async () => {
    if (!user || !selectedEmployee || !editNameValue.trim()) return;
    try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'employees', selectedEmployee.id), { name: editNameValue });
        setSelectedEmployee(prev => ({...prev, name: editNameValue}));
        setIsEditingName(false);
    } catch (error) { console.error("Error updating name:", error); }
  };

  const toggleItemStatus = async (collectionName, item) => {
      if(!user || !db) return;
      try {
          const newStatus = item.status === 'done' ? 'todo' : 'done';
          await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, collectionName, item.id), { status: newStatus });
      } catch (e) {
          console.error("Error updating status", e);
      }
  };

  // --- VOICE INPUT FUNCTION ---
  const startListening = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        // MISE A JOUR: Support de l'allemand
        recognition.lang = lang === 'fr' ? 'fr-FR' : (lang === 'de' ? 'de-DE' : 'en-US'); 
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

  // --- SAVE SETTINGS (CORRECTION 1.c) ---
  const handleSaveSettings = async () => { 
    if(!user) return; 
    setIsSavingSettings(true); 
    try { 
        // Sauvegarder les prompts actuels dans Firestore
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'promptConfig'), { ...prompts, updatedAt: serverTimestamp() }); 
        setSuccessMsg(t('settings', 'saved')); 
        setTimeout(()=>setSuccessMsg(null),3000); 
    } catch(e){
        console.error(e); 
        setErrorMsg("Erreur sauvegarde");
    } finally {
        setIsSavingSettings(false);
    } 
  };
  
  const handleResetPrompt = () => { 
    setPrompts({
      report: PROMPT_TEMPLATES[lang]?.report || PROMPT_TEMPLATES.en.report,
      training: PROMPT_TEMPLATES[lang]?.training || PROMPT_TEMPLATES.en.training,
      reading: PROMPT_TEMPLATES[lang]?.reading || PROMPT_TEMPLATES.en.reading,
      okr: PROMPT_TEMPLATES[lang]?.okr || PROMPT_TEMPLATES.en.okr,
      rewrite: PROMPT_TEMPLATES[lang]?.rewrite || PROMPT_TEMPLATES.en.rewrite
    });
  }; 
  const handleAddEmployee = async (e) => { if(e) e.preventDefault(); if(!newEmployeeName.trim()||!user||!db) return; setIsAddingEmployee(true); try { await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'employees'), { name: newEmployeeName, role: newEmployeeRole||'Collaborateur', createdAt: serverTimestamp(), avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newEmployeeName)}&background=random&color=fff` }); setNewEmployeeName(''); setNewEmployeeRole(''); setIsAddModalOpen(false); } catch(err){alert("Erreur: " + err.message);} finally{setIsAddingEmployee(false);} };
  const handleDeleteEmployeeFull = async () => { if(!user||!employeeToDelete||!db) return; setIsDeletingEmployee(true); try { const empId = employeeToDelete.id; const delCol = async (n) => { const q=query(collection(db,'artifacts',appId,'users',user.uid,n),where('employeeId','==',empId)); const s=await getDocs(q); await Promise.all(s.docs.map(d=>deleteDoc(d.ref))); }; await Promise.all(['notes','reports','trainings','readings','okrs'].map(delCol)); await deleteDoc(doc(db,'artifacts',appId,'users',user.uid,'employees',empId)); setEmployeeToDelete(null); if(selectedEmployee?.id===empId){setSelectedEmployee(null); setView('dashboard');} } catch(e){alert("Erreur");} finally{setIsDeletingEmployee(false);} };
  const handleAddNote = async () => { if(!noteContent.trim()||!user||!db) return; setIsSubmittingNote(true); try { await addDoc(collection(db,'artifacts',appId,'users',user.uid,'notes'), { employeeId: selectedEmployee.id, content: noteContent, tag: noteTag, category: noteCategory, date: new Date().toISOString(), createdAt: serverTimestamp() }); setNoteContent(''); setSuccessMsg(t('employee', 'copy_success') || "Sauvegardé !"); setTimeout(()=>setSuccessMsg(null),3000); } catch(e){setErrorMsg("Échec.");} finally{setIsSubmittingNote(false);} };
  
  const startEditing = (note) => { 
      setEditingNoteId(note.id); 
      setEditContent(note.content); 
      setEditTag(note.tag); 
      setEditCategory(note.category); 
  };
  const cancelEditing = () => { setEditingNoteId(null); setEditContent(''); };
  const handleUpdateNote = async () => { 
      if(!user||!editingNoteId||!db) return; 
      setIsUpdatingNote(true); 
      try { 
          await updateDoc(doc(db,'artifacts',appId,'users',user.uid,'notes',editingNoteId),{ content:editContent, tag:editTag, category:editCategory, updatedAt:serverTimestamp() }); 
          setEditingNoteId(null); 
      } catch(e){
          alert("Impossible de modifier.");
      } finally {
          setIsUpdatingNote(false);
      }
  };
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
        let cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        
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
    setIsGeneratingModalOpen(true); // Ouvre la modale de chargement
    
    // Formater les notes pour l'IA
    const notesList = notes.map(n => `- ${new Date(n.date).toLocaleDateString()} [${n.tag}]: "${n.content}"`).join('\n');
    let finalPrompt = prompts.report.replace(/{{NOM}}/g, selectedEmployee.name).replace(/{{ROLE}}/g, selectedEmployee.role).replace(/{{NOTES}}/g, notesList);
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
        setIsGeneratingModalOpen(false); // Ferme la modale de chargement
    }
  };

  const generateOkrs = async () => {
     if (!selectedEmployee || notes.length === 0) { alert("Il faut des notes pour analyser les objectifs."); return; }
     setIsGeneratingOkrs(true);
     
     const notesList = notes.map(n => `- ${n.tag}: "${n.content}"`).join('\n');
     let finalPrompt = prompts.okr.replace(/{{NOM}}/g, selectedEmployee.name).replace(/{{ROLE}}/g, selectedEmployee.role).replace(/{{NOTES}}/g, notesList);
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
     let finalPrompt = prompts.training.replace(/{{NOM}}/g, selectedEmployee.name).replace(/{{ROLE}}/g, selectedEmployee.role).replace(/{{NOTES}}/g, notesList);
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
    let finalPrompt = prompts.reading.replace(/{{NOM}}/g, selectedEmployee.name).replace(/{{ROLE}}/g, selectedEmployee.role).replace(/{{NOTES}}/g, notesList);
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

  // Use Effect to load jsPDF from CDN
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    }
  }, []);

  const downloadReportPDF = (report) => {
    if (!window.jspdf) {
        alert("Library loading..."); 
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // --- CONFIGURATION PDF ---
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxLineWidth = pageWidth - (margin * 2);
    const lineHeight = 7;
    let y = 20;

    // Couleurs (Charte Reviewiz)
    const colorPrimary = [79, 70, 229]; // Indigo 600
    const colorText = [30, 41, 59]; // Slate 800
    const colorLight = [243, 244, 246]; // Gray 100

    // Helper: Gestion saut de page
    const checkPageBreak = (heightToAdd) => {
        if (y + heightToAdd > 280) {
            doc.addPage();
            y = 20;
        }
    };

    // --- HEADER ---
    doc.setTextColor(...colorPrimary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Reviewiz.ai", margin, y);
    y += 10;
    
    doc.setTextColor(...colorText);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Bilan pour : ${selectedEmployee.name}`, margin, y);
    y += 6;
    // Affichage de l'heure
    doc.text(`Généré le : ${new Date(report.date).toLocaleDateString()} à ${new Date(report.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`, margin, y);
    y += 15;

    // --- PARSER ---
    const lines = report.content.split('\n');
    let inTable = false;
    let tableBuffer = [];

    // Fonction pour rendre un tableau proprement (CORRECTION TRONCATION)
    const renderTable = () => {
        if (tableBuffer.length < 2) return;
        
        // Nettoyage des lignes du tableau Markdown
        const headers = tableBuffer[0].split('|').map(c => c.trim()).filter(c => c);
        // On saute la ligne de séparation |---|
        const rows = tableBuffer.slice(2).map(row => row.split('|').map(c => c.trim()).filter(c => c));
        
        // Calcul des largeurs de colonnes (égalité simple)
        const colWidth = maxLineWidth / headers.length;
        
        // --- Étape 1 : Calculer la hauteur réelle de chaque ligne ---
        const renderedRows = rows.map(row => {
            let rowLines = [];
            let maxLines = 1;
            
            row.forEach((cellContent, cellIndex) => {
                const cleanCell = cellContent.replace(/\*\*/g, '');
                const cellTextLines = doc.splitTextToSize(cleanCell, colWidth - 4);
                
                rowLines[cellIndex] = cellTextLines;
                if (cellTextLines.length > maxLines) {
                    maxLines = cellTextLines.length;
                }
            });
            
            const currentRowHeight = maxLines * lineHeight + 4; // +4 pour le padding visuel
            return { lines: rowLines, height: currentRowHeight, maxLines };
        });


        // Vérif espace page avant de commencer le tableau
        checkPageBreak(lineHeight + 5); // Hauteur du titre + marge

        // Dessin Header Tableau
        doc.setFillColor(...colorPrimary);
        doc.rect(margin, y, maxLineWidth, lineHeight + 2, 'F'); // +2 pour le padding
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        
        headers.forEach((h, i) => {
            doc.text(h, margin + (i * colWidth) + 2, y + 5);
        });
        y += lineHeight + 2; // Avance après l'en-tête

        // Dessin Lignes Tableau
        doc.setTextColor(...colorText);
        doc.setFont("helvetica", "normal");
        
        renderedRows.forEach((renderedRow, rowIndex) => {
            const currentRowHeight = renderedRow.height;
            checkPageBreak(currentRowHeight); // Vérifie le saut de page avec la hauteur MAX de la ligne
            
            // Couleur alternée (Zebra striping)
            if (rowIndex % 2 === 1) {
                doc.setFillColor(...colorLight);
                doc.rect(margin, y, maxLineWidth, currentRowHeight, 'F');
            }
            
            renderedRow.lines.forEach((cellTextLines, cellIndex) => {
                // Dessiner chaque ligne du texte de la cellule
                cellTextLines.forEach((textSegment, lineIndex) => {
                    // Calcul du décalage pour le centre vertical
                    const verticalOffset = (currentRowHeight - (renderedRow.maxLines * lineHeight)) / 2;
                    doc.text(textSegment, margin + (cellIndex * colWidth) + 2, y + 2 + verticalOffset + (lineIndex * lineHeight));
                });
            });

            // Avancer Y de la hauteur maximale de la ligne
            y += currentRowHeight;
        });
        
        y += 10; // Marge après tableau
        tableBuffer = [];
        inTable = false;
    };

    // Boucle principale sur les lignes
    lines.forEach(line => {
        const trimmed = line.trim();
        
        // Détection Tableaux
        if (trimmed.startsWith('|')) {
            inTable = true;
            tableBuffer.push(trimmed);
            return; // On stocke et on passe à la suite
        } else if (inTable) {
            // Fin du tableau détectée (ligne ne commençant pas par |)
            renderTable();
        }

        checkPageBreak(lineHeight);

        // Styles Markdown
        if (trimmed.startsWith('# ')) {
            // H1
            y += 5;
            checkPageBreak(15);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(...colorPrimary);
            doc.text(trimmed.replace('# ', ''), margin, y);
            y += lineHeight * 1.5;
        } 
        else if (trimmed.startsWith('## ')) {
            // H2
            y += 3;
            checkPageBreak(12);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(13);
            doc.setTextColor(...colorPrimary);
            doc.text(trimmed.replace('## ', ''), margin, y);
            y += lineHeight * 1.2;
        }
        else if (trimmed.startsWith('### ')) {
            // H3
            checkPageBreak(10);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(70, 70, 70); // Gris foncé
            doc.text(trimmed.replace('### ', ''), margin, y);
            y += lineHeight;
        }
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            // Liste à puces
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(...colorText);
            
            const bulletText = trimmed.substring(2).replace(/\*\*/g, ''); // Nettoie le gras
            const wrapped = doc.splitTextToSize(bulletText, maxLineWidth - 5);
            
            doc.text("•", margin, y);
            doc.text(wrapped, margin + 5, y);
            y += (wrapped.length * lineHeight);
        }
        else {
            // Paragraphe standard
            if (!trimmed) { y += lineHeight / 2; return; } // Ligne vide
            
            doc.setFontSize(10);
            doc.setTextColor(...colorText);
            
            // GESTION DU GRAS (**texte**)
            // On découpe la ligne par segments de gras
            const parts = trimmed.split(/(\*\*.*?\*\*)/g); 
            let currentX = margin;
            
            // On vérifie d'abord si la ligne entière tient (simplification pour éviter complexité word-wrap mixte)
            // Si c'est long, on utilise le mode bloc standard (sans gras) pour éviter bugs d'overlap
            if (doc.getTextWidth(trimmed.replace(/\*\*/g, '')) > maxLineWidth) {
                 doc.setFont("helvetica", "normal");
                 const cleanText = trimmed.replace(/\*\*/g, '');
                 const wrapped = doc.splitTextToSize(cleanText, maxLineWidth);
                 doc.text(wrapped, margin, y);
                 y += (wrapped.length * lineHeight);
            } else {
                // Si la ligne est courte (ex: label), on rend le gras proprement
                parts.forEach(part => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        doc.setFont("helvetica", "bold");
                        const text = part.slice(2, -2);
                        doc.text(text, currentX, y);
                        currentX += doc.getTextWidth(text);
                    } else {
                        doc.setFont("helvetica", "normal");
                        const text = part;
                        doc.text(text, currentX, y);
                        currentX += doc.getTextWidth(text);
                    }
                });
                y += lineHeight;
            }
        }
    });
    
    // Si le fichier finit par un tableau
    if (inTable) renderTable();

    doc.save(`Bilan_${selectedEmployee.name}.pdf`);
  };


  // ==================================================================================
  // RENDER CONTENT HELPER
  // ==================================================================================
  
  const renderContent = () => {
      // --- NOUVEAU LOGIC POUR ÉCRAN BLANC ---
      // On affiche l'écran de chargement jusqu'à ce que user soit défini ET que userProfile soit chargé (userProfile.uid)
      if (loading || (user && userProfile.uid === null)) {
        return (
            <div className="h-screen flex items-center justify-center text-blue-600 bg-gray-50">
                <Loader2 className="animate-spin mr-2" /> Chargement des données utilisateur...
            </div>
        );
      }

      if (!user) {
          return <LoginScreen onGoogleLogin={handleGoogleLogin} onEmailLogin={handleEmailLogin} onEmailSignUp={handleEmailSignUp} error={authError || configError} lang={lang} setLang={setLanguage} t={t} />;
      }

      return (
        <div className="flex h-screen bg-gray-50 text-slate-800 font-sans overflow-hidden">
          {/* SIDEBAR NAVIGATION */}
          <aside className={`
            fixed md:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}>
            {/* Logo Header & Flags */}
            <div className="p-6 border-b border-gray-100 flex flex-col justify-center gap-4">
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
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
            </div>

            {/* Menu Items */}
            <div className="p-4 flex flex-col h-full overflow-y-auto">
              
              <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">{t('sidebar', 'general')}</h3>
                <button
                  onClick={() => { setSelectedEmployee(null); setView('dashboard'); setMobileMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 mb-1
                    ${view === 'dashboard' && !selectedEmployee ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Users size={18} /> {t('sidebar', 'overview')}
                </button>
                <button
                  onClick={() => {
                    if (userProfile.isPaid) {
                      setView('settings');
                      setSelectedEmployee(null);
                      setMobileMenuOpen(false);
                    } else {
                      setView('premium-settings');
                      setSelectedEmployee(null);
                      setMobileMenuOpen(false);
                    }
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 relative
                    ${view === 'settings' || view === 'premium-settings' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}
                    ${!userProfile.isPaid ? 'opacity-75' : ''}`}
                >
                  <Settings size={18} /> 
                  <span className="flex-1">{t('sidebar', 'settings')}</span>
                  {!userProfile.isPaid && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm">
                      <Crown size={12} />
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setView('help'); setSelectedEmployee(null); setMobileMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3
                    ${view === 'help' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <HelpCircle size={18} /> {t('sidebar', 'help')}
                </button>

                {/* BOUTON ADMIN - Visible uniquement si isAdmin */}
                {userProfile.isAdmin && (
                  <button
                    onClick={() => { setView('admin'); setSelectedEmployee(null); setMobileMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-3 mt-4
                      ${view === 'admin' ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    <ListChecks size={18} /> Administration
                  </button>
                )}

              </div>

              <div className="mb-6">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">{t('sidebar', 'support')}</h3>
                <a
                  href="https://www.linkedin.com/in/stéphane-carlier-977a636"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                >
                  <Linkedin size={18} /> {t('sidebar', 'contact')}
                </a>
              </div>

              <div className="flex justify-between items-center mb-2 px-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('sidebar', 'team')}</h3>
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-md transition-colors"
                  title={t('dashboard', 'add_btn')}
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
                {/* SÉLECTEUR DE LANGUE MINIMALISTE */}
                <div className="flex gap-3 text-xs font-medium text-gray-400 mb-4 px-2 items-center">
                   <Globe size={14} />
                   <button onClick={() => setLanguage('en')} className={`transition-all hover:text-indigo-600 ${lang === 'en' ? 'text-indigo-600 font-bold underline underline-offset-4' : ''}`}>EN</button>
                   <span className="text-gray-300">|</span>
                   <button onClick={() => setLanguage('fr')} className={`transition-all hover:text-indigo-600 ${lang === 'fr' ? 'text-indigo-600 font-bold underline underline-offset-4' : ''}`}>FR</button>
                   <span className="text-gray-300">|</span>
                   <button onClick={() => setLanguage('de')} className={`transition-all hover:text-indigo-600 ${lang === 'de' ? 'text-indigo-600 font-bold underline underline-offset-4' : ''}`}>DE</button>
                </div>

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
                    <LogOut size={14} /> <span>{t('sidebar', 'logout')}</span>
                </button>
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
                {view === 'settings' || view === 'premium-settings' ? t('settings', 'title') : selectedEmployee ? selectedEmployee.name : t('dashboard', 'title')}
              </span>
            </div>

            {/* --- VUE ADMIN --- */}
            {view === 'admin' && <AdminPage db={db} t={t} userProfile={userProfile} appId={appId} />}

            {/* --- VUE AIDE --- */}
            {view === 'help' && (
                <div className="flex-1 overflow-y-auto p-6 md:p-12 bg-gray-50">
                    <div className="max-w-4xl mx-auto">
                        <header className="mb-10 text-center">
                            <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <HelpCircle size={32} className="text-indigo-600" />
                            </div>
                            <h1 className="3xl font-bold text-gray-900 mb-2">{t('help', 'title')}</h1>
                            <p className="text-gray-500">{t('help', 'subtitle')}</p>
                        </header>

                        <div className="grid gap-8 md:grid-cols-2">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="bg-blue-100 text-blue-600 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg">1</div>
                                    <h3 className="font-bold text-lg text-gray-800">{t('help', 'step1_title')}</h3>
                                </div>
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    {t('help', 'step1_text_1')} <span className="font-medium text-gray-800">{t('help', 'step1_span')}</span> {t('help', 'step1_text_2')}
                                </p>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="bg-green-100 text-green-600 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg">2</div>
                                    <h3 className="font-bold text-lg text-gray-800">{t('help', 'step2_title')}</h3>
                                </div>
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    {t('help', 'step2_text_1')} <span className="font-medium text-indigo-600"><Wand2 size={12} className="inline"/> {t('help', 'step2_span')}</span> {t('help', 'step2_text_2')}
                                </p>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="bg-purple-100 text-purple-600 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg">3</div>
                                    <h3 className="font-bold text-lg text-gray-800">{t('help', 'step3_title')}</h3>
                                </div>
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    {t('help', 'step3_text_1')} <span className="font-medium text-indigo-600">{t('help', 'step3_span')}</span> {t('help', 'step3_text_2')}
                                </p>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="bg-orange-100 text-orange-600 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg">4</div>
                                    <h3 className="font-bold text-lg text-gray-800">{t('help', 'step4_title')}</h3>
                                </div>
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    {t('help', 'step4_text_1')} <strong>{t('help', 'step4_span')}</strong> {t('help', 'step4_text_2')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- VIEW: PREMIUM SETTINGS (Non-Payant) --- */}
            {view === 'premium-settings' && (
              <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
                <div className="max-w-2xl mx-auto">
                  <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl shadow-xl border border-indigo-100 overflow-hidden">
                    {/* Header avec gradient */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-center text-white">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4 backdrop-blur-sm">
                        <Crown size={32} className="text-amber-300" />
                      </div>
                      <h2 className="text-3xl font-bold mb-2">Configuration IA Premium</h2>
                      <p className="text-indigo-100 text-lg">Personnalisez vos prompts IA selon vos besoins</p>
                    </div>

                    {/* Contenu */}
                    <div className="p-8">
                      <div className="space-y-6">
                        {/* Fonctionnalités */}
                        <div className="space-y-4">
                          <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                            <Sparkles className="text-indigo-600" size={24} />
                            Fonctionnalités Premium
                          </h3>
                          <div className="grid gap-3">
                            {[
                              { icon: FileText, title: 'Génération de bilans personnalisés', desc: 'Adaptez le style et le ton de vos rapports' },
                              { icon: GraduationCap, title: 'Plans de formation sur mesure', desc: 'Créez des programmes adaptés à votre équipe' },
                              { icon: Book, title: 'Recommandations de lecture ciblées', desc: 'Suggestions alignées avec vos objectifs' },
                              { icon: Target, title: 'OKRs personnalisés', desc: 'Définissez des objectifs avec votre méthodologie' },
                              { icon: PenTool, title: 'Reformulation intelligente', desc: 'Réécrivez vos notes selon vos préférences' }
                            ].map((feature, idx) => (
                              <div key={idx} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-200 transition-colors">
                                <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                  <feature.icon size={20} className="text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-gray-900 text-sm mb-1">{feature.title}</h4>
                                  <p className="text-gray-600 text-sm">{feature.desc}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* CTA */}
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-center text-white">
                          <h3 className="text-xl font-bold mb-2">Passez à Premium dès aujourd'hui</h3>
                          <p className="text-indigo-100 mb-4">Débloquez toutes les fonctionnalités avancées de configuration IA</p>
                          <button
                            onClick={() => window.open('mailto:contact@votre-domaine.com?subject=Upgrade Premium', '_blank')}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                          >
                            <Crown size={20} />
                            Contactez-nous pour upgrader
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- VIEW: SETTINGS --- */}
            {view === 'settings' && userProfile.isPaid && (
              <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
                <div className="max-w-5xl mx-auto h-full flex flex-col">
                  <header className="mb-6">
                    <h1 className="2xl font-bold text-gray-900 flex items-center gap-3">
                      <Sparkles className="text-indigo-600" /> {t('settings', 'title')}
                    </h1>
                    <p className="text-gray-500 mt-2">
                      {t('settings', 'subtitle')}
                    </p>
                  </header>

                  <div className="flex-1 flex flex-col md:flex-row gap-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Settings Sidebar */}
                    <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 flex flex-row md:flex-col overflow-x-auto md:overflow-visible">
                        {[
                            { id: 'report', label: t('employee', 'generate_short'), icon: FileText },
                            { id: 'training', label: t('tabs', 'training'), icon: GraduationCap },
                            { id: 'reading', label: t('tabs', 'reading'), icon: Book },
                            { id: 'okr', label: t('tabs', 'okrs'), icon: Target },
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
                                placeholder="Prompt..."
                            />
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                            <Button variant="ghost" onClick={handleResetPrompt} icon={RefreshCw}>{t('settings', 'restore')}</Button>
                            <div className="flex items-center gap-3">
                                {successMsg && <span className="text-green-600 text-sm font-medium flex items-center gap-1"><CheckCircle2 size={16}/> {successMsg}</span>}
                                <Button onClick={handleSaveSettings} icon={Save} isLoading={isSavingSettings}>{t('settings', 'save')}</Button>
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
                  <h1 className="3xl font-bold text-gray-900 mb-2">{t('dashboard', 'title')}</h1>
                  <p className="text-gray-500">{t('dashboard', 'subtitle')}</p>
                </header>
                
                <div className="max-w-4xl mx-auto">
                  {employees.length === 0 ? (
                    <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center shadow-sm">
                      <div className="bg-indigo-50 p-4 rounded-full mb-4"><Users className="h-8 w-8 text-indigo-500" /></div>
                      <h3 className="xl font-bold text-gray-900 mb-2">{t('dashboard', 'empty_title')}</h3>
                      <p className="text-gray-500 mb-6">{t('dashboard', 'empty_desc')}</p>
                      <Button onClick={() => setIsAddModalOpen(true)} icon={Plus}>{t('dashboard', 'add_btn')}</Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <button 
                        onClick={() => setIsAddModalOpen(true)} 
                        className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group h-full min-h-[160px]"
                      >
                        <Plus size={32} className="text-gray-400 group-hover:text-indigo-600 mb-3 transition-colors" />
                        <span className="font-medium text-gray-500 group-hover:text-indigo-700">{t('dashboard', 'add_card')}</span>
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
                                <span className="text-xs font-medium text-indigo-600 uppercase tracking-wide">{t('dashboard', 'view_file')}</span>
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
                                title={t('employee', 'edit_name')}
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
                        onClick={() => { generateRealAIReport(); }} 
                        icon={Sparkles}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
                      >
                        <span className="hidden md:inline">{t('employee', 'generate_btn')}</span>
                        <span className="md:hidden">{t('employee', 'generate_short')}</span>
                      </Button>
                      <button 
                        onClick={() => setEmployeeToDelete(selectedEmployee)}
                        className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" 
                        title={t('employee', 'delete_tooltip')}
                      >
                        <Trash2 size={20} />
                      </button>
                  </div>
                </div>

                {/* TABS NAVIGATION */}
                <div className="bg-white border-b border-gray-200 px-4 md:px-8 flex gap-8 overflow-x-auto hide-scrollbar">
                  {[
                      {id:'journal', label: t('tabs', 'journal'), icon:FileText, count:notes.length}, 
                      {id:'okrs', label: t('tabs', 'okrs'), icon:Target, count:okrs.length}, 
                      {id:'history', label: t('tabs', 'history'), icon:History, count:reportsHistory.length}, 
                      {id:'training', label: t('tabs', 'training'), icon:GraduationCap, count:trainings.length}, 
                      {id:'reading', label: t('tabs', 'reading'), icon:Library, count:readings.length}
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
                        {/* ... (Input Box) ... */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-8 transition-all hover:shadow-md">
                          <div className="flex justify-between items-center mb-4">
                              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                  <PenTool size={16}/> {t('employee', 'new_note_title')}
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
                                placeholder={t('employee', 'new_note_placeholder')}
                                value={noteContent}
                                onChange={(e) => setNoteContent(e.target.value)}
                                onKeyDown={(e) => { if(e.key === 'Enter' && e.ctrlKey) handleAddNote(); }}
                            ></textarea>
                            
                            <div className="absolute right-3 bottom-7 flex gap-2">
                                <button 
                                    onClick={startListening}
                                    className={`p-2 rounded-lg border transition-all shadow-sm flex items-center gap-2 text-xs font-medium
                                        ${isListening 
                                            ? 'bg-red-50 text-red-600 border-red-200 animate-pulse ring-2 ring-red-100' 
                                            : 'bg-white text-gray-500 border-gray-200 hover:text-indigo-600 hover:border-indigo-200'}`}
                                    title="Dicter une note"
                                >
                                    {isListening ? <><MicOff size={16} /> {t('employee', 'stop_listening')}</> : <Mic size={16} />}
                                </button>
                                
                                <button 
                                    onClick={handleRewriteNote}
                                    disabled={!noteContent.trim() || isRewriting}
                                    className="p-2 bg-white border border-indigo-100 rounded-lg text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 text-xs font-medium"
                                    title="L'IA reformule et catégorise automatiquement"
                                >
                                    {isRewriting ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                                    <span className="hidden sm:inline">{t('employee', 'analyzing')}</span>
                                </button>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2 border-t border-gray-50">
                            <div className="flex gap-3 w-full sm:w-auto">
                              <select 
                                value={noteTag} 
                                onChange={(e) => setNoteTag(e.target.value)} 
                                className="flex-1 w-1/2 text-sm p-2.5 pr-8 rounded-lg bg-white border border-gray-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 outline-none cursor-pointer hover:bg-gray-50"
                              >
                                <option value="Succès">👍 {t('categories', 'success')}</option>
                                <option value="Amélioration">⚠️ {t('categories', 'improvement')}</option>
                              </select>
                              
                              <select 
                                value={noteCategory} 
                                onChange={(e) => setNoteCategory(e.target.value)} 
                                className="flex-1 w-1/2 text-sm p-2.5 pr-8 rounded-lg bg-white border border-gray-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 outline-none cursor-pointer hover:bg-gray-50"
                              >
                                <option value="Technique">🛠 {t('categories', 'technical')}</option>
                                <option value="Soft Skills">🤝 {t('categories', 'soft_skills')}</option>
                                <option value="Management">📊 {t('categories', 'management')}</option>
                              </select>
                            </div>
                            
                            <Button onClick={handleAddNote} icon={Save} disabled={!noteContent.trim()} isLoading={isSubmittingNote} className="w-full sm:w-auto">
                                {t('employee', 'save_note')}
                            </Button>
                          </div>
                        </div>

                        {/* FILTRES DES NOTES */}
                        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-6 px-1">
                            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                <Filter size={16} /> {t('filters', 'filter_title')} ({filteredNotes.length})
                            </div>
                            <div className="flex gap-2">
                                <select 
                                    value={filterTag} 
                                    onChange={(e) => setFilterTag(e.target.value)} 
                                    className="text-xs p-2 rounded-full border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer hover:border-indigo-300 transition-colors"
                                >
                                    <option value="all">{t('filters', 'all')} ({t('filters', 'type')})</option>
                                    <option value="Succès">👍 {t('categories', 'success')}</option>
                                    <option value="Amélioration">⚠️ {t('categories', 'improvement')}</option>
                                </select>
                                <select 
                                    value={filterCategory} 
                                    onChange={(e) => setFilterCategory(e.target.value)} 
                                    className="text-xs p-2 rounded-full border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer hover:border-indigo-300 transition-colors"
                                >
                                    <option value="all">{t('filters', 'all')} ({t('filters', 'category')})</option>
                                    <option value="Technique">🛠 {t('categories', 'technical')}</option>
                                    <option value="Soft Skills">🤝 {t('categories', 'soft_skills')}</option>
                                    <option value="Management">📊 {t('categories', 'management')}</option>
                                </select>
                            </div>
                        </div>

                        {/* NOTES TIMELINE */}
                        <div className="space-y-8 pl-4 pb-20">
                          {filteredNotes.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                                <div className="bg-gray-50 p-4 rounded-full mb-4 text-gray-300"><FileText size={32}/></div>
                                <p className="text-gray-400 font-medium">{t('empty', 'notes_title')}</p>
                                <p className="text-gray-400 text-sm mt-1">{t('empty', 'notes_desc')}</p>
                            </div>
                          ) : (
                            filteredNotes.map((note) => (
                              /* Note rendering logic */
                              <div key={note.id} className="relative pl-8 group animate-in slide-in-from-bottom-4 duration-500">
                                <div className="absolute left-[11px] top-8 bottom-[-32px] w-0.5 bg-gray-200 group-last:hidden"></div>
                                <div className={`absolute left-0 top-3 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10
                                    ${note.tag === 'Succès' ? 'bg-green-500' : 'bg-orange-500'}`}>
                                </div>
                                
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
                                            <Button size="sm" variant="ghost" onClick={cancelEditing}>{t('modals', 'cancel')}</Button>
                                            <Button size="sm" variant="success" icon={Check} onClick={handleUpdateNote} isLoading={isUpdatingNote}>OK</Button>
                                        </div>
                                    </div>
                                    ) : (
                                    <>
                                        <div className="flex justify-between items-start mb-3">
                                        <div className="flex flex-wrap gap-3 items-center">
                                            <span className="text-xs font-bold text-gray-500 flex items-center gap-1 bg-gray-50 px-2 py-1 rounded">
                                                {new Date(note.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : (lang === 'de' ? 'de-DE' : 'en-US'))} 
                                                <span className="font-normal text-gray-400">| {new Date(note.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </span>
                                            <Badge type={note.tag} lang={lang} />
                                            <Badge type={note.category} lang={lang} />
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
                    {/* ... (OKRs section identical to previous) ... */}
                    {/* (Copier le bloc OKRs précédent ici) */}
                    {employeeTab === 'okrs' && (
                      <div className="space-y-8">
                        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 flex items-start gap-4 shadow-sm">
                            <div className="bg-white p-3 rounded-full text-indigo-600 shadow-sm mt-1"><Target size={24}/></div>
                            <div>
                            <h4 className="font-bold text-indigo-900 text-lg">Objectifs Intelligents (OKRs)</h4>
                            <p className="text-sm text-indigo-700 mt-1 leading-relaxed">
                                {lang === 'fr' 
                                    ? "L'IA analyse l'historique des notes pour suggérer 3 objectifs majeurs et des résultats clés mesurables."
                                    : (lang === 'de' ? "Die KI analysiert den Notizverlauf, um 3 wichtige Ziele und messbare Schlüsselergebnisse vorzuschlagen." : "AI analyzes note history to suggest 3 major objectives and measurable key results.")}
                            </p>
                            </div>
                        </div>
                        
                        {okrs.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                            <Target className="h-16 w-16 text-gray-200 mb-4" />
                            <p className="text-gray-500 mb-6 font-medium">{t('empty', 'okr_title')}</p>
                            <Button onClick={generateOkrs} icon={Sparkles} isLoading={isGeneratingOkrs} variant="magic" size="lg">{t('empty', 'okr_btn')}</Button>
                        </div>
                        ) : (
                        <>
                            <div className="flex justify-end">
                                <Button variant="ghost" size="sm" onClick={generateOkrs} isLoading={isGeneratingOkrs} icon={RefreshCw}>{t('ai', 'regen')}</Button>
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
                                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 tracking-wider">{t('ai', 'key_results')}</h4>
                                        <ul className="space-y-3">
                                            {item.keyResults && item.keyResults.map((kr, idx) => (
                                                <li key={idx} className="flex items-start gap-3 text-sm text-gray-700">
                                                    <ArrowRight size={16} className="mt-0.5 text-indigo-500 shrink-0" />
                                                    <span>{kr}</span>
                                                </li>
                                            ))}
                                        </ul>
                                </div>
                                {item.rationale && <p className="text-xs text-gray-400 mt-4 italic flex gap-1 items-center"><Sparkles size={10}/> {t('ai', 'why')}: {item.rationale}</p>}
                                </div>
                            ))}
                            </div>
                        </>
                        )}
                      </div>
                    )}

                    {/* === TAB: BILANS (HISTORY) === */}
                    {/* ... (History section identical to previous) ... */}
                    {employeeTab === 'history' && (
                      <div className="space-y-6">
                        {reportsHistory.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 italic bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                            <History size={48} className="text-gray-200 mb-4"/>
                            <p>{t('empty', 'report_title')}</p>
                            <p className="text-xs mt-2 text-gray-300">{t('empty', 'report_desc')}</p>
                        </div>
                        ) : (
                        reportsHistory.map(r => (
                            /* Carte principale : Padding réduit sur mobile (p-4) vs desktop (p-8) */
                            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 md:p-8 shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-center mb-4 md:mb-6 border-b border-gray-100 pb-4 flex-wrap gap-2">
                                <div className="flex items-center gap-2 text-gray-500 font-medium text-sm md:text-base">
                                <div className="bg-green-100 text-green-600 p-1.5 md:p-2 rounded-lg"><Clock size={16} md={18} /></div>
                                <span>{t('employee', 'generated_on')} {new Date(r.date).toLocaleDateString(lang === 'fr' ? 'fr-FR' : (lang === 'de' ? 'de-DE' : 'en-US'))} à {new Date(r.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" icon={Download} size="sm" onClick={() => downloadReportPDF(r)}>{t('employee', 'download_pdf')}</Button>
                                    <Button variant="ghost" icon={FileText} size="sm" onClick={() => {navigator.clipboard.writeText(r.content); alert(t('employee', 'copy_success'));}}>{t('employee', 'copy_text')}</Button>
                                    <button onClick={() => handleDeleteItem('reports', r.id)} className="text-gray-300 hover:text-red-500 p-2 hover:bg-red-50 rounded"><Trash2 size={18}/></button>
                                </div>
                            </div>
                            
                            {/* Conteneur gris du texte : Padding réduit sur mobile (p-3) vs desktop (p-6) */}
                            <div className="bg-gray-50 p-3 md:p-6 rounded-xl border border-gray-100 text-sm md:text-base">
                                <SimpleMarkdown content={r.content} />
                            </div>
                            </div>
                        ))
                        )}
                      </div>
                    )}

                    {/* === TAB: TRAINING === */}
                    {/* ... (Training section identical to previous) ... */}
                    {employeeTab === 'training' && (
                      <div className="space-y-8">
                        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex items-start gap-4">
                        <div className="bg-white p-3 rounded-full text-blue-600 mt-1 shadow-sm"><GraduationCap size={24}/></div>
                        <div>
                            <h4 className="font-bold text-blue-900 text-lg">LinkedIn Learning</h4>
                            <p className="text-sm text-blue-700 mt-1 leading-relaxed">
                                {lang === 'fr' ? "L'IA analyse vos notes pour identifier les lacunes et propose des sujets pertinents." : (lang === 'de' ? "Die KI analysiert Ihre Notizen, um Lücken zu identifizieren und schlägt relevante Themen vor." : "AI analyzes gaps and suggests relevant courses.")}
                            </p>
                        </div>
                        </div>
                        
                        {trainings.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                            <Search className="h-16 w-16 text-gray-200 mb-4" />
                            <p className="text-gray-500 mb-6 font-medium">{t('empty', 'training_title')}</p>
                            <Button onClick={generateTrainingRecommendations} icon={Search} isLoading={isGeneratingTraining} size="lg">{t('empty', 'training_btn')}</Button>
                        </div>
                        ) : (
                        <>
                            <div className="flex justify-end">
                                <Button variant="ghost" size="sm" onClick={generateTrainingRecommendations} isLoading={isGeneratingTraining} icon={RefreshCw}>{t('ai', 'regen')}</Button>
                            </div>
                            <div className="grid gap-5">
                            {trainings.map(item => (
                                <div key={item.id} className={`bg-white border border-gray-200 rounded-xl p-6 shadow-sm transition-all group ${item.status === 'done' ? 'opacity-60 bg-gray-50' : 'hover:border-blue-300 hover:shadow-md'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            {item.status === 'done' && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><CheckCircle2 size={10}/> {t('actions', 'completed')}</span>}
                                        </div>
                                        <h3 className={`font-bold text-gray-800 text-lg flex items-center gap-2 ${item.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                                            <span className={`p-1 rounded ${item.status === 'done' ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-600'}`}><GraduationCap size={18}/></span>
                                            {item.topic}
                                        </h3>
                                    </div>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => toggleItemStatus('trainings', item)} 
                                            className={`p-2 rounded-lg transition-colors ${item.status === 'done' ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100'}`}
                                            title={item.status === 'done' ? t('actions', 'mark_todo') : t('actions', 'mark_done')}
                                        >
                                            {item.status === 'done' ? <CheckSquare size={20}/> : <Square size={20}/>}
                                        </button>
                                        <button onClick={() => handleDeleteItem('trainings', item.id)} className="text-gray-300 hover:text-red-500 p-2 rounded hover:bg-red-50"><X size={20}/></button>
                                    </div>
                                </div>
                                <p className={`text-sm text-gray-600 mb-5 italic bg-gray-50 p-3 rounded border border-gray-100 ${item.status==='done'?'line-through opacity-50':''}`}>
                                    <span className="font-semibold not-italic text-gray-400 block mb-1 text-xs uppercase">{t('ai', 'why')} :</span>
                                    "{item.reason}"
                                </p>
                                <div className="flex justify-start">
                                    <a 
                                        href={`https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(item.keywords)}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${item.status==='done' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[#0a66c2] text-white hover:bg-[#004182] hover:shadow'}`}
                                    >
                                        <ExternalLink size={16}/> {t('ai', 'see_linkedin')}
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
                    {/* ... (Readings section identical to previous) ... */}
                    {employeeTab === 'reading' && (
                      <div className="space-y-8">
                        <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 flex items-start gap-4">
                        <div className="bg-white p-3 rounded-full text-orange-600 mt-1 shadow-sm"><Book size={24}/></div>
                        <div>
                            <h4 className="font-bold text-orange-900 text-lg">{t('tabs', 'reading')}</h4>
                            <p className="text-sm text-orange-700 mt-1 leading-relaxed">
                                {lang === 'fr' ? "Des livres sélectionnés pour inspirer ce collaborateur ou l'aider à surmonter ses défis." : (lang === 'de' ? "Ausgewählte Bücher, um diesen Mitarbeiter zu inspirieren oder ihm zu helfen, seine Herausforderungen zu meistern." : "Books selected to inspire or solve specific challenges.")}
                            </p>
                        </div>
                        </div>
                        
                        {readings.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                            <Library className="mx-auto h-16 w-16 text-gray-200 mb-4" />
                            <p className="text-gray-500 mb-6 font-medium">{t('empty', 'reading_title')}</p>
                            <Button onClick={generateReadingRecommendations} icon={Search} isLoading={isGeneratingReading} variant="secondary" size="lg">{t('empty', 'reading_btn')}</Button>
                        </div>
                        ) : (
                        <>
                            <div className="flex justify-end">
                                <Button variant="ghost" size="sm" onClick={generateReadingRecommendations} isLoading={isGeneratingReading} icon={RefreshCw}>{t('ai', 'regen')}</Button>
                            </div>
                            <div className="grid gap-5">
                            {readings.map(item => (
                                <div key={item.id} className={`bg-white border border-gray-200 rounded-xl p-6 shadow-sm transition-all group ${item.status === 'done' ? 'opacity-60 bg-gray-50' : 'hover:border-orange-300 hover:shadow-md'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            {item.status === 'done' && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><CheckCircle2 size={10}/> {t('actions', 'completed')}</span>}
                                        </div>
                                        <h3 className={`font-bold text-gray-900 text-lg flex items-center gap-2 ${item.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                                            <Book size={18} className={item.status === 'done' ? 'text-gray-400' : 'text-orange-500'}/> {item.title}
                                        </h3>
                                        <p className="text-sm text-gray-500 font-medium ml-6">{item.author}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => toggleItemStatus('readings', item)} 
                                            className={`p-2 rounded-lg transition-colors ${item.status === 'done' ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-gray-400 hover:text-indigo-600 hover:bg-gray-100'}`}
                                            title={item.status === 'done' ? t('actions', 'mark_todo') : t('actions', 'mark_done')}
                                        >
                                            {item.status === 'done' ? <CheckSquare size={20}/> : <Square size={20}/>}
                                        </button>
                                        <button onClick={() => handleDeleteItem('readings', item.id)} className="text-gray-300 hover:text-red-500 p-2 rounded hover:bg-red-50"><X size={20}/></button>
                                    </div>
                                </div>
                                <p className={`text-sm text-gray-600 mb-5 italic bg-gray-50 p-3 rounded border border-gray-100 ${item.status==='done'?'line-through opacity-50':''}`}>"{item.reason}"</p>
                                <div className="flex justify-start">
                                    <a 
                                      href={`https://www.amazon.fr/s?k=${encodeURIComponent((item.title || '') + ' ' + (item.author || ''))}`} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${item.status==='done' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-[#FF9900] text-white hover:bg-[#e68a00]'}`}
                                    >
                                        <ExternalLink size={16}/> {t('ai', 'see_amazon')}
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

            {/* --- OVERLAY: REPORT GENERATION MODAL --- */}
            <Modal 
                isOpen={isGeneratingModalOpen} 
                onClose={() => setIsGeneratingModalOpen(false)} 
                title={t('employee', 'generate_btn')}
            >
                <div className="text-center p-6">
                    <div className="relative mx-auto mb-6">
                        <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
                        <div className="absolute inset-0 flex items-center justify-center"><Sparkles size={24} className="text-indigo-600 animate-pulse"/></div>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">{t('ai', 'generating')}</h3>
                    <p className="text-gray-500">{t('ai', 'generating_sub')}</p>
                </div>
            </Modal>
          </main>

          {/* ADD EMPLOYEE MODAL */}
          <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title={t('modals', 'add_title')}>
            <form onSubmit={handleAddEmployee}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals', 'name_label')}</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('modals', 'role_label')}</label>
                <input 
                    type="text" 
                    placeholder="Ex: Senior Developer" 
                    className="w-full p-3 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" 
                    value={newEmployeeRole} 
                    onChange={(e) => setNewEmployeeRole(e.target.value)} 
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>{t('modals', 'cancel')}</Button>
                <Button type="submit" disabled={!newEmployeeName.trim()} isLoading={isAddingEmployee}>{t('modals', 'create')}</Button>
              </div>
            </form>
          </Modal>
          
          {/* DELETE CONFIRM MODAL */}
          <Modal isOpen={!!noteToDelete} onClose={() => setNoteToDelete(null)} title={t('modals', 'delete_note_title')}>
            <div className="text-center space-y-4">
                <div className="mx-auto bg-red-50 w-16 h-16 rounded-full flex items-center justify-center border-4 border-red-100">
                    <AlertTriangle className="text-red-600" size={32} />
                </div>
                <p className="text-gray-600">{t('modals', 'delete_note_desc')}</p>
                <div className="flex gap-3 justify-center mt-6">
                    <Button variant="secondary" onClick={() => setNoteToDelete(null)}>{t('modals', 'cancel')}</Button>
                    <Button variant="danger" onClick={confirmDeleteNote} isLoading={isDeletingNote}>{t('modals', 'delete_btn')}</Button>
                </div>
            </div>
          </Modal>

          {/* DELETE EMPLOYEE CONFIRM MODAL */}
          <Modal isOpen={!!employeeToDelete} onClose={() => setEmployeeToDelete(null)} title={t('modals', 'delete_emp_title')}>
            <div className="text-center space-y-4">
                <div className="mx-auto bg-red-100 w-12 h-12 rounded-full flex items-center justify-center border-4 border-red-100">
                    <AlertTriangle className="text-red-600" size={32} />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">{t('modals', 'warning_irreversible')}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  <strong>{employeeToDelete?.name}</strong>.
                  <br/>
                  {t('modals', 'delete_emp_desc')}
                </p>
                <div className="flex gap-3 justify-center mt-6">
                    <Button variant="secondary" onClick={() => setEmployeeToDelete(null)}>{t('modals', 'cancel')}</Button>
                    <Button variant="danger" onClick={handleDeleteEmployeeFull} isLoading={isDeletingEmployee}>{t('modals', 'delete_all_btn')}</Button>
                </div>
            </div>
          </Modal>
        </div>
      );
  };
  
  return (
    <>
      <SEOMetaTags 
        title="Reviewiz.ai - L'Assistant IA pour vos Évaluations Annuelles" 
        description="Ne redoutez plus les entretiens annuels. Reviewiz.ai aide les managers à transformer leurs notes quotidiennes en bilans structurés et bienveillants grâce à l'IA."
      />
      {renderContent()}
    </>
  );
}