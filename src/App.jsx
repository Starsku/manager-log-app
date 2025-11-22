import React, { useState, useEffect } from 'react';
import { 
  Users, 
  BookOpen, 
  Plus, 
  Save, 
  Trash2, 
  Sparkles, 
  Menu, 
  X, 
  UserPlus, 
  FileText, 
  ChevronRight, 
  Briefcase, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  LogOut, 
  Bot, 
  Settings, 
  History, 
  RefreshCw, 
  Clock, 
  Edit, 
  Check, 
  AlertTriangle, 
  GraduationCap, 
  ExternalLink, 
  Search, 
  Book, 
  Library, 
  Target, 
  Wand2, 
  ArrowRight, 
  PenTool,
  Wifi,
  Database,
  ShieldCheck
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
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
// ⚠️ CONFIGURATION CORRIGÉE POUR L'ENVIRONNEMENT ACTUEL ⚠️
// ==================================================================================

// Note : Nous utilisons les clés en direct pour contourner l'erreur de compilation
// liée à "import.meta" dans cet environnement spécifique.

const firebaseConfig = {
  apiKey: "AIzaSyD7zatqOocXgbT37GHqep-cKKqBSDUC6RQ",
  authDomain: "manager-log-app.firebaseapp.com",
  projectId: "manager-log-app",
  storageBucket: "manager-log-app.firebasestorage.app",
  messagingSenderId: "990958334046",
  appId: "1:990958334046:web:6da5a074b0b81eefe5c4cf",
  measurementId: "G-JY8GMQML0E"
};

const GEMINI_API_KEY = "AIzaSyAz4jclCjv-Jk6yPdZfB8pHCo8_l1xgWns"; 

const appId = 'manager-log-prod';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// FIX CRITIQUE : Force le mode "Long Polling" pour éviter les blocages réseaux
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true, 
    useFetchStreams: false,
});

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

// ==================================================================================
// FIN DE LA CONFIGURATION
// ==================================================================================

// --- DEFAULT PROMPTS CONSTANTS ---
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

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon, disabled = false, isLoading = false, type = 'button', size = 'md' }) => {
  const baseStyle = "flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = {
    sm: "px-2 py-1 text-xs",
    md: "px-4 py-2 text-sm"
  };
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-gray-200",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm",
    success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
    magic: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-sm", 
    linkedin: "bg-[#0a66c2] text-white hover:bg-[#004182] focus:ring-blue-800",
    amazon: "bg-[#FF9900] text-white hover:bg-[#e68a00] focus:ring-yellow-500 text-shadow-sm"
  };

  return (
    <button 
      type={type} 
      onClick={onClick} 
      className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <Loader2 size={size === 'sm' ? 14 : 18} className="mr-2 animate-spin" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : 18} className="mr-2" />
      ) : null}
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
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
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${styles[type] || styles['Neutre']}`}>
      {type}
    </span>
  );
};

// --- Helper to safely render string content ---
const SafeText = ({ content }) => {
  if (typeof content === 'string') return <>{content}</>;
  if (typeof content === 'number') return <>{content}</>;
  return <span className="text-xs text-gray-400 italic">(Format non supporté)</span>;
};

// --- Main Application ---

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
  
  // --- Settings State ---
  const [settingsTab, setSettingsTab] = useState('report'); // report, training, reading, okr, rewrite
  const [prompts, setPrompts] = useState({
    report: DEFAULT_REPORT_PROMPT,
    training: DEFAULT_TRAINING_PROMPT,
    reading: DEFAULT_READING_PROMPT,
    okr: DEFAULT_OKR_PROMPT,
    rewrite: DEFAULT_REWRITE_PROMPT
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Diagnostic State
  const [diagStatus, setDiagStatus] = useState(null);

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  
  // Delete Note State
  const [noteToDelete, setNoteToDelete] = useState(null);
  const [isDeletingNote, setIsDeletingNote] = useState(false);

  // Delete Employee State
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [isDeletingEmployee, setIsDeletingEmployee] = useState(false);

  // Note Creation State
  const [noteContent, setNoteContent] = useState('');
  const [noteTag, setNoteTag] = useState('Succès');
  const [noteCategory, setNoteCategory] = useState('Technique');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false); 
  
  // Note Editing State
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editTag, setEditTag] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);

  // Feedback State
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // AI States
  const [generatedReport, setGeneratedReport] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingTraining, setIsGeneratingTraining] = useState(false);
  const [isGeneratingReading, setIsGeneratingReading] = useState(false);
  const [isGeneratingOkrs, setIsGeneratingOkrs] = useState(false); 

  // --- Authentication & Data Loading ---

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
        setDiagStatus("Erreur auth: " + error.message);
      }
    };
    
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false); // FIX: Force le chargement à finir
    });
    return () => unsubscribe();
  }, []);

  // Fetch Prompt Settings (Changed to onSnapshot for robustness)
  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'promptConfig');
    
    // Using onSnapshot instead of getDoc prevents "Client Offline" crashes on initial load
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPrompts({
            report: data.report || DEFAULT_REPORT_PROMPT,
            training: data.training || DEFAULT_TRAINING_PROMPT,
            reading: data.reading || DEFAULT_READING_PROMPT,
            okr: data.okr || DEFAULT_OKR_PROMPT,
            rewrite: data.rewrite || DEFAULT_REWRITE_PROMPT
          });
        }
    }, (error) => {
        console.log("Sync settings waiting...", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch Employees
  useEffect(() => {
    if (!user) return;
    const q = collection(db, 'artifacts', appId, 'users', user.uid, 'employees');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      emps.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setEmployees(emps);
      setLoading(false);
    }, (error) => {
      console.error("Error loading employees:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Sub-collections
  useEffect(() => {
    if (!user || !selectedEmployee) {
      setNotes([]); setReportsHistory([]); setTrainings([]); setReadings([]); setOkrs([]);
      setEditingNoteId(null);
      return;
    }

    const qNotes = query(collection(db, 'artifacts', appId, 'users', user.uid, 'notes'), where('employeeId', '==', selectedEmployee.id));
    const unsubNotes = onSnapshot(qNotes, (s) => {
      const d = s.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      d.sort((a, b) => new Date(b.date) - new Date(a.date));
      setNotes(d);
    });

    const qReports = query(collection(db, 'artifacts', appId, 'users', user.uid, 'reports'), where('employeeId', '==', selectedEmployee.id));
    const unsubReports = onSnapshot(qReports, (s) => {
      const d = s.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      d.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setReportsHistory(d);
    });
    
    const qTrainings = query(collection(db, 'artifacts', appId, 'users', user.uid, 'trainings'), where('employeeId', '==', selectedEmployee.id));
    const unsubTrainings = onSnapshot(qTrainings, (s) => {
      const d = s.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      d.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setTrainings(d);
    });

    const qReadings = query(collection(db, 'artifacts', appId, 'users', user.uid, 'readings'), where('employeeId', '==', selectedEmployee.id));
    const unsubReadings = onSnapshot(qReadings, (s) => {
      const d = s.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      d.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setReadings(d);
    });

    const qOkrs = query(collection(db, 'artifacts', appId, 'users', user.uid, 'okrs'), where('employeeId', '==', selectedEmployee.id));
    const unsubOkrs = onSnapshot(qOkrs, (s) => {
        const d = s.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        d.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setOkrs(d);
    });

    return () => { unsubNotes(); unsubReports(); unsubTrainings(); unsubReadings(); unsubOkrs(); };
  }, [user, selectedEmployee]);

  // --- Actions ---

  const handleTestConnection = async () => {
    setDiagStatus("Test en cours (Max 5s)...");
    try {
        if (!user) throw new Error("Utilisateur non connecté !");
        
        // On crée une course entre l'envoi et un chronomètre de 5 secondes
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout : La base de données ne répond pas (Pare-feu ou Règles)")), 5000)
        );

        const request = addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'diagnostics'), {
            test: "Ping !",
            createdAt: serverTimestamp()
        });

        const testRef = await Promise.race([request, timeout]);
        
        setDiagStatus(`✅ Succès ! La base de données répond (ID: ${testRef.id})`);
    } catch (e) {
        setDiagStatus(`❌ Échec : ${e.message}`);
        console.error("Erreur Diagnostic:", e);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'promptConfig'), {
        ...prompts,
        updatedAt: serverTimestamp()
      });
      setSuccessMsg("Configuration sauvegardée");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      console.error(e);
      setErrorMsg("Erreur sauvegarde");
    } finally {
      setIsSavingSettings(false);
    }
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
    if (e) e.preventDefault();
    if (!newEmployeeName.trim() || !user) return;

    setIsAddingEmployee(true);
    try {
      console.log("Tentative de création...");
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'employees'), {
        name: newEmployeeName,
        role: newEmployeeRole || 'Collaborateur',
        createdAt: serverTimestamp(),
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newEmployeeName)}&background=random&color=fff`
      });
      console.log("Création réussie !");
      setNewEmployeeName('');
      setNewEmployeeRole('');
      setIsAddModalOpen(false);
      setMobileMenuOpen(false);
    } catch (error) {
      console.error("Error adding employee", error);
      alert("Impossible de créer le collaborateur. Vérifiez votre connexion.");
    } finally {
      setIsAddingEmployee(false);
    }
  };

  // --- Employee Deletion Logic ---
  const handleDeleteEmployeeFull = async () => {
    if (!user || !employeeToDelete) return;
    setIsDeletingEmployee(true);
    try {
        const empId = employeeToDelete.id;
        
        const deleteCollectionByQuery = async (collectionName) => {
            const q = query(collection(db, 'artifacts', appId, 'users', user.uid, collectionName), where('employeeId', '==', empId));
            const snapshot = await getDocs(q);
            const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
            await Promise.all(deletePromises);
        };

        await Promise.all([
            deleteCollectionByQuery('notes'),
            deleteCollectionByQuery('reports'),
            deleteCollectionByQuery('trainings'),
            deleteCollectionByQuery('readings'),
            deleteCollectionByQuery('okrs')
        ]);

        await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'employees', empId));

        setEmployeeToDelete(null);
        if(selectedEmployee?.id === empId) {
            setSelectedEmployee(null);
            setView('dashboard');
        }

    } catch (error) {
        console.error("Error deleting employee", error);
        alert("Erreur lors de la suppression complète.");
    } finally {
        setIsDeletingEmployee(false);
    }
  };

  const handleAddNote = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!noteContent.trim()) return;
    if (!user || !selectedEmployee) return;

    setIsSubmittingNote(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'notes'), {
        employeeId: selectedEmployee.id,
        content: noteContent,
        tag: noteTag,
        category: noteCategory,
        date: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
      setNoteContent('');
      setSuccessMsg("Note enregistrée !");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (error) {
      console.error("Error adding note", error);
      setErrorMsg("Échec de l'enregistrement.");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const startEditing = (note) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditTag(note.tag);
    setEditCategory(note.category);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditContent('');
  };

  const handleUpdateNote = async () => {
    if (!user || !editingNoteId || !editContent.trim()) return;
    setIsUpdatingNote(true);
    try {
      const noteRef = doc(db, 'artifacts', appId, 'users', user.uid, 'notes', editingNoteId);
      await updateDoc(noteRef, {
        content: editContent,
        tag: editTag,
        category: editCategory,
        updatedAt: serverTimestamp()
      });
      setEditingNoteId(null);
    } catch (error) {
      console.error("Error updating note", error);
      alert("Impossible de modifier la note.");
    } finally {
      setIsUpdatingNote(false);
    }
  };

  const confirmDeleteNote = async () => {
    if (!user || !noteToDelete) return;
    setIsDeletingNote(true);
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'notes', noteToDelete.id));
      setNoteToDelete(null); 
    } catch (error) {
      console.error("Error deleting note", error);
      alert("Erreur lors de la suppression.");
    } finally {
      setIsDeletingNote(false);
    }
  };

  const handleDeleteItem = async (collectionName, id) => {
    if(!window.confirm("Supprimer cet élément ?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, collectionName, id));
    } catch (e) { console.error(e); }
  };

  // --- AI Generation Logic ---

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

  // --- AI Features ---

  const handleRewriteNote = async () => {
    if(!noteContent.trim()) return;
    setIsRewriting(true);
    try {
        let finalPrompt = prompts.rewrite; 
        finalPrompt = finalPrompt.replace(/{{CONTENT}}/g, noteContent);
        const rewritenText = await callGemini(finalPrompt);
        setNoteContent(rewritenText.trim());
    } catch(e) {
        console.error(e);
        alert("Erreur lors de la reformulation. Vérifiez votre clé API.");
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
    
    const notesList = notes.map(n => `- ${new Date(n.date).toLocaleDateString()} [${n.tag}/${n.category}]: "${n.content}"`).join('\n');
    let finalPrompt = prompts.report; 
    finalPrompt = finalPrompt.replace(/{{NOM}}/g, selectedEmployee.name);
    finalPrompt = finalPrompt.replace(/{{ROLE}}/g, selectedEmployee.role);
    finalPrompt = finalPrompt.replace(/{{NOTES}}/g, notesList);

    try {
        const aiResponse = await callGemini(finalPrompt);
        setGeneratedReport({ prompt: finalPrompt, response: aiResponse });
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'reports'), {
          employeeId: selectedEmployee.id,
          content: aiResponse,
          promptUsed: finalPrompt,
          createdAt: serverTimestamp(),
          date: new Date().toISOString()
        });
        setEmployeeTab('history');
    } catch (error) {
        console.error("AI Generation failed", error);
        alert("Erreur lors de la génération. Vérifiez votre clé API.");
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
        const jsonStr = aiResponseRaw.replace(/```json|```/g, '').trim();
        const generatedOkrs = JSON.parse(jsonStr);

        if(Array.isArray(generatedOkrs)) {
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
        console.error("OKR Generation failed", error);
        alert("Erreur de génération. Vérifiez le prompt JSON et votre clé API.");
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
        const jsonStr = aiResponseRaw.replace(/```json|```/g, '').trim();
        const recommendations = JSON.parse(jsonStr);

        if(Array.isArray(recommendations)) {
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
        console.error("Training Generation failed", error);
        alert("Erreur d'analyse. Vérifiez le prompt JSON et votre clé API.");
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
       const jsonStr = aiResponseRaw.replace(/```json|```/g, '').trim();
       const recommendations = JSON.parse(jsonStr);

       if(Array.isArray(recommendations)) {
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
       console.error("Reading Generation failed", error);
       alert("Erreur d'analyse. Vérifiez le prompt JSON et votre clé API.");
    } finally {
       setIsGeneratingReading(false);
    }
  };


  if (loading) {
    return <div className="h-screen flex items-center justify-center text-blue-600"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="flex h-screen bg-gray-50 text-slate-800 font-sans overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
            <BookOpen className="fill-current" />
            <span>ManagerLog</span>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-gray-400">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          
          {/* Menu Principal */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Général</h3>
            <button
              onClick={() => { setSelectedEmployee(null); setView('dashboard'); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${view === 'dashboard' && !selectedEmployee ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Users size={16} /> Vue d'ensemble
            </button>
            <button
              onClick={() => { setView('settings'); setSelectedEmployee(null); setMobileMenuOpen(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${view === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Settings size={16} /> Configuration IA
            </button>
          </div>

          {/* Liste Employés */}
          <div className="flex justify-between items-center mb-2 px-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mon Équipe</h3>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors"
            >
              <UserPlus size={16} />
            </button>
          </div>

          <div className="space-y-1">
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => { setSelectedEmployee(emp); setView('employee'); setGeneratedReport(null); setMobileMenuOpen(false); setEmployeeTab('journal'); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${selectedEmployee?.id === emp.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <img src={emp.avatar} alt={emp.name} className="w-8 h-8 rounded-full border border-gray-100" />
                <div className="truncate flex-1">
                  <div className="truncate">{emp.name}</div>
                  <div className="text-xs text-gray-400 truncate font-normal">{emp.role}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-100">
             <button onClick={() => window.location.reload()} className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 w-full px-2">
                <LogOut size={14} /> <span>Rafraîchir l'app</span>
             </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full">
        
        {/* HEADER (Mobile Only) */}
        <div className="md:hidden bg-white border-b p-4 flex items-center gap-3 shrink-0">
          <button onClick={() => setMobileMenuOpen(true)} className="text-gray-600 p-1 -ml-1 hover:bg-gray-100 rounded-lg">
            <Menu size={24}/>
          </button>
          <span className="font-bold text-gray-800 truncate">
            {view === 'settings' ? 'Configuration' : selectedEmployee ? selectedEmployee.name : 'Tableau de Bord'}
          </span>
        </div>

        {/* --- VIEW: SETTINGS --- */}
        {view === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
            <div className="max-w-5xl mx-auto h-full flex flex-col">
              <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <Sparkles className="text-indigo-600" /> Configuration de l'IA
                </h1>
                <p className="text-gray-500 mt-2">
                  Personnalisez les instructions (Prompts) données à Gemini pour chaque module de l'application.
                </p>
              </header>

              {/* --- DIAGNOSTIC ZONE (NEW) --- */}
              <div className="mb-8 bg-orange-50 border border-orange-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-orange-800 mb-2 flex items-center gap-2">
                      <Wifi size={20}/> Diagnostic Système
                  </h3>
                  <p className="text-sm text-orange-700 mb-4">
                      Utilisez cette zone si vous rencontrez des problèmes de connexion ou de chargement infini.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                      <div className="flex items-center gap-2 text-sm text-gray-600 bg-white px-3 py-2 rounded border">
                          <ShieldCheck size={16} className={user ? "text-green-500" : "text-red-500"}/>
                          {user ? `Connecté (ID: ${user.uid.substring(0,5)}...)` : "Non connecté"}
                      </div>
                      <Button onClick={handleTestConnection} icon={Database} variant="secondary">
                          Tester Connexion Firebase
                      </Button>
                  </div>
                  {diagStatus && (
                      <div className="mt-4 p-3 bg-white rounded border border-gray-200 text-sm font-mono">
                          {diagStatus}
                      </div>
                  )}
              </div>

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
                <div className="flex-1 p-6 flex flex-col h-[600px] md:h-auto">
                    <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-800">
                        <div className="flex items-start gap-3">
                            <Bot size={20} className="mt-0.5 shrink-0" />
                            <div>
                                <strong className="block mb-1">Variables dynamiques disponibles :</strong>
                                {settingsTab === 'rewrite' ? (
                                    <ul className="list-disc list-inside space-y-1 text-xs md:text-sm">
                                        <li><code>{`{{CONTENT}}`}</code> : Le texte brut de la note à reformuler (Obligatoire).</li>
                                    </ul>
                                ) : (
                                    <ul className="list-disc list-inside space-y-1 text-xs md:text-sm">
                                        <li><code>{`{{NOM}}`}</code> : Nom du collaborateur</li>
                                        <li><code>{`{{ROLE}}`}</code> : Poste du collaborateur</li>
                                        <li><code>{`{{NOTES}}`}</code> : L'historique des notes (Obligatoire).</li>
                                    </ul>
                                )}
                                {['training', 'reading', 'okr'].includes(settingsTab) && (
                                    <p className="mt-2 text-xs font-bold text-red-600">⚠ Attention : Pour ce module, conservez impérativement le format JSON demandé dans le prompt.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <textarea
                        value={prompts[settingsTab]}
                        onChange={(e) => setPrompts(prev => ({ ...prev, [settingsTab]: e.target.value }))}
                        className="flex-1 w-full p-4 font-mono text-sm bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                    />

                    <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
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
          <div className="flex-1 overflow-y-auto p-6 md:p-10">
             <header className="mb-10 max-w-4xl mx-auto">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Tableau de Bord</h1>
              <p className="text-gray-500">Gérez vos notes et préparez vos évaluations sans stress.</p>
            </header>
            <div className="max-w-4xl mx-auto">
              {employees.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                   <div className="bg-blue-50 p-4 rounded-full mb-4"><Users className="h-8 w-8 text-blue-500" /></div>
                   <h3 className="text-xl font-bold text-gray-900 mb-2">Votre équipe est vide</h3>
                   <Button onClick={() => setIsAddModalOpen(true)} icon={Plus}>Ajouter un collaborateur</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <button onClick={() => setIsAddModalOpen(true)} className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all group h-full min-h-[160px]">
                    <Plus size={24} className="text-gray-400 group-hover:text-blue-600 mb-2" />
                    <span className="font-medium text-gray-600 group-hover:text-blue-700">Ajouter un membre</span>
                  </button>
                  {employees.map(emp => (
                    <div key={emp.id} onClick={() => { setSelectedEmployee(emp); setView('employee'); }} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all cursor-pointer relative group">
                      <div className="flex items-center gap-4">
                        <img src={emp.avatar} alt={emp.name} className="w-14 h-14 rounded-full border-2 border-white shadow-md" />
                        <div>
                          <h3 className="font-bold text-gray-900">{emp.name}</h3>
                          <p className="text-sm text-gray-500">{emp.role}</p>
                        </div>
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
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* TOP BAR */}
            <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex justify-between items-center shadow-sm z-10 shrink-0">
              <div className="flex items-center gap-4">
                <img src={selectedEmployee.avatar} className="w-10 h-10 rounded-full hidden md:block" />
                <div>
                  <h2 className="font-bold text-gray-900 text-lg md:text-xl leading-tight">{selectedEmployee.name}</h2>
                  <p className="text-xs md:text-sm text-gray-500">{selectedEmployee.role}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                  <Button 
                    onClick={() => { setView('report'); generateRealAIReport(); }} 
                    icon={Sparkles}
                    className="bg-indigo-600 hover:bg-indigo-700 text-sm"
                  >
                    <span className="hidden md:inline">Générer Bilan avec Gemini</span>
                    <span className="md:hidden">Bilan</span>
                  </Button>
                  <button 
                     onClick={() => setEmployeeToDelete(selectedEmployee)}
                     className="p-2 text-red-200 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                     title="Supprimer ce collaborateur"
                  >
                     <Trash2 size={20} />
                  </button>
              </div>
            </div>

            {/* TABS */}
            <div className="bg-white border-b border-gray-200 px-4 md:px-8 flex gap-6 overflow-x-auto">
              <button onClick={() => setEmployeeTab('journal')} className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 shrink-0 ${employeeTab === 'journal' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <FileText size={16}/> Journal ({notes.length})
              </button>
              <button onClick={() => setEmployeeTab('okrs')} className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 shrink-0 ${employeeTab === 'okrs' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Target size={16}/> Objectifs ({okrs.length})
              </button>
              <button onClick={() => setEmployeeTab('history')} className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 shrink-0 ${employeeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <History size={16}/> Historique ({reportsHistory.length})
              </button>
              <button onClick={() => setEmployeeTab('training')} className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 shrink-0 ${employeeTab === 'training' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <GraduationCap size={16}/> Formations ({trainings.length})
              </button>
              <button onClick={() => setEmployeeTab('reading')} className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 shrink-0 ${employeeTab === 'reading' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Library size={16}/> Lectures ({readings.length})
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto bg-white">
              <div className="max-w-4xl mx-auto w-full p-4 md:p-8">
                
                {/* === TAB: JOURNAL === */}
                {employeeTab === 'journal' && (
                  <>
                    {/* INPUT */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8 ring-1 ring-gray-100 focus-within:ring-blue-100 transition-all">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Nouvelle Note</h3>
                        {successMsg && <span className="text-xs text-green-600 flex items-center gap-1 font-bold"><CheckCircle2 size={12} /> {successMsg}</span>}
                      </div>
                      <div className="relative">
                        <textarea
                            className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all outline-none resize-none text-sm mb-3 pr-12"
                            rows="3"
                            placeholder="Qu'a fait ce collaborateur ? (ex: 'En retard à la réunion ce matin...')"
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter' && e.ctrlKey) handleAddNote(); }}
                        ></textarea>
                        {/* Magic Rewrite Button */}
                        <button 
                            onClick={handleRewriteNote}
                            disabled={!noteContent.trim() || isRewriting}
                            className="absolute right-2 bottom-5 p-1.5 bg-white border border-indigo-100 rounded-md text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                            title="Reformuler avec l'IA"
                        >
                            {isRewriting ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                        </button>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                        <div className="flex gap-2 w-full sm:w-auto">
                          <select value={noteTag} onChange={(e) => setNoteTag(e.target.value)} className="text-sm p-2 rounded bg-gray-50 border border-gray-200">
                            <option value="Succès">👍 Succès</option>
                            <option value="Amélioration">⚠️ À Améliorer</option>
                            <option value="Neutre">📝 Neutre</option>
                          </select>
                          <select value={noteCategory} onChange={(e) => setNoteCategory(e.target.value)} className="text-sm p-2 rounded bg-gray-50 border border-gray-200">
                            <option value="Technique">🛠 Technique</option>
                            <option value="Soft Skills">🤝 Soft Skills</option>
                            <option value="Management">📊 Management</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                            {noteContent.trim() && (
                                <Button variant="ghost" size="sm" onClick={handleRewriteNote} disabled={isRewriting} icon={Wand2}>
                                    {isRewriting ? "Réécriture..." : "Reformuler"}
                                </Button>
                            )}
                            <Button onClick={handleAddNote} icon={Save} disabled={!noteContent.trim()} isLoading={isSubmittingNote}>Enregistrer</Button>
                        </div>
                      </div>
                    </div>

                    {/* TIMELINE */}
                    <div className="space-y-6 pl-2 pb-10">
                      {notes.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">Aucune note pour le moment.</div>
                      ) : (
                        notes.map((note) => (
                          <div key={note.id} className="relative pl-8 group animate-in slide-in-from-bottom-2 duration-300">
                            <div className="absolute left-[11px] top-8 bottom-[-24px] w-px bg-gray-200 last:hidden"></div>
                            <div className={`absolute left-0 top-2 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center ${note.tag === 'Succès' ? 'bg-green-500' : note.tag === 'Amélioration' ? 'bg-orange-500' : 'bg-gray-400'}`}></div>
                            
                            {/* CARD CONTENT */}
                            <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all">
                              
                              {editingNoteId === note.id ? (
                                // --- EDIT MODE ---
                                <div className="space-y-3">
                                  <textarea
                                    className="w-full p-2 bg-white border border-blue-300 rounded-md text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                                    rows="3"
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                  />
                                  <div className="flex gap-2">
                                      <select value={editTag} onChange={(e) => setEditTag(e.target.value)} className="text-xs p-1.5 rounded border border-gray-300">
                                        <option value="Succès">👍 Succès</option>
                                        <option value="Amélioration">⚠️ À Améliorer</option>
                                        <option value="Neutre">📝 Neutre</option>
                                      </select>
                                      <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="text-xs p-1.5 rounded border border-gray-300">
                                        <option value="Technique">🛠 Technique</option>
                                        <option value="Soft Skills">🤝 Soft Skills</option>
                                        <option value="Management">📊 Management</option>
                                      </select>
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <Button size="sm" variant="ghost" onClick={cancelEditing}>Annuler</Button>
                                    <Button size="sm" variant="success" icon={Check} onClick={handleUpdateNote} isLoading={isUpdatingNote}>Valider</Button>
                                  </div>
                                </div>
                              ) : (
                                // --- DISPLAY MODE ---
                                <>
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-wrap gap-2 items-center">
                                      <span className="text-xs font-bold text-gray-400">{new Date(note.date).toLocaleDateString()}</span>
                                      <Badge type={note.tag} /><Badge type={note.category} />
                                    </div>
                                    <div className="flex gap-1">
                                      <button onClick={() => startEditing(note)} className="text-gray-300 hover:text-blue-600 p-1 transition-colors" title="Modifier">
                                        <Edit size={14} />
                                      </button>
                                      <button 
                                        onClick={() => setNoteToDelete(note)} // OPEN CONFIRM MODAL
                                        className="text-gray-300 hover:text-red-500 p-1 transition-colors" 
                                        title="Supprimer"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{note.content}</p>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}

                {/* === TAB: OKRS (NEW) === */}
                {employeeTab === 'okrs' && (
                  <div className="space-y-6">
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-start gap-3">
                       <div className="bg-white p-2 rounded-full text-indigo-600 mt-1"><Target size={18}/></div>
                       <div>
                          <h4 className="font-bold text-indigo-800 text-sm">Objectifs Intelligents (OKRs)</h4>
                          <p className="text-sm text-indigo-700 mt-1">L'IA analyse vos notes pour suggérer 3 objectifs majeurs et des résultats clés mesurables pour le prochain trimestre.</p>
                       </div>
                    </div>
                    
                    {okrs.length === 0 ? (
                       <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                         <Target className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                         <p className="text-gray-500 mb-4">Aucun objectif défini.</p>
                         <Button onClick={generateOkrs} icon={Sparkles} isLoading={isGeneratingOkrs} variant="magic">Générer des OKRs ✨</Button>
                       </div>
                    ) : (
                       <>
                        <div className="flex justify-end">
                            <Button variant="ghost" size="sm" onClick={generateOkrs} isLoading={isGeneratingOkrs} icon={RefreshCw}>Générer à nouveau ✨</Button>
                        </div>
                        <div className="grid gap-4">
                          {okrs.map(item => (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-indigo-200 transition-colors">
                               <div className="flex justify-between items-start mb-2">
                                  <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                    <Target size={20} className="text-indigo-500" /> 
                                    <SafeText content={item.objective} />
                                  </h3>
                                  <button onClick={() => handleDeleteItem('okrs', item.id)} className="text-gray-300 hover:text-red-500"><X size={16}/></button>
                               </div>
                               
                               <div className="mt-4 bg-gray-50 p-3 rounded-lg">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Résultats Clés (Key Results)</h4>
                                    <ul className="space-y-2">
                                        {item.keyResults && Array.isArray(item.keyResults) && item.keyResults.map((kr, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                                <ArrowRight size={14} className="mt-1 text-indigo-400 shrink-0" />
                                                <SafeText content={kr} />
                                            </li>
                                        ))}
                                    </ul>
                               </div>
                               {item.rationale && (
                                   <p className="text-xs text-gray-400 mt-3 italic">Basé sur : <SafeText content={item.rationale} /></p>
                               )}
                            </div>
                          ))}
                        </div>
                       </>
                    )}
                  </div>
                )}

                {/* === TAB: HISTORY === */}
                {employeeTab === 'history' && (
                  <div className="space-y-4">
                    {reportsHistory.length === 0 ? (
                       <div className="text-center py-12 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">Aucun bilan généré pour le moment.</div>
                    ) : (
                      reportsHistory.map(report => (
                        <div key={report.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
                            <div className="flex items-center gap-2 text-gray-500">
                              <Clock size={16} />
                              <span className="text-sm font-medium">Généré le {new Date(report.date).toLocaleDateString()}</span>
                            </div>
                            <Button variant="ghost" icon={FileText} onClick={() => navigator.clipboard.writeText(report.content)}>Copier</Button>
                          </div>
                          <div className="prose prose-indigo prose-sm max-w-none text-gray-700">
                             <div className="whitespace-pre-wrap font-serif bg-gray-50 p-4 rounded-lg border border-gray-100 max-h-96 overflow-y-auto">{report.content}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* === TAB: TRAINING === */}
                {employeeTab === 'training' && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex items-start gap-3">
                       <div className="bg-white p-2 rounded-full text-blue-600 mt-1"><Sparkles size={18}/></div>
                       <div>
                          <h4 className="font-bold text-blue-800 text-sm">L'IA au service de la montée en compétence</h4>
                          <p className="text-sm text-blue-700 mt-1">L'IA analyse vos notes pour identifier les lacunes (soft skills ou techniques) et propose des sujets pertinents sur LinkedIn Learning.</p>
                       </div>
                    </div>
                    
                    {trainings.length === 0 ? (
                       <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                         <GraduationCap className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                         <p className="text-gray-500 mb-4">Aucune recommandation pour le moment.</p>
                         <Button onClick={generateTrainingRecommendations} icon={Search} isLoading={isGeneratingTraining}>Analyser les besoins</Button>
                       </div>
                    ) : (
                       <>
                        <div className="flex justify-end">
                            <Button variant="ghost" size="sm" onClick={generateTrainingRecommendations} isLoading={isGeneratingTraining} icon={RefreshCw}>Relancer l'analyse</Button>
                        </div>
                        <div className="grid gap-4">
                          {trainings.map(item => (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-blue-200 transition-colors">
                               <div className="flex justify-between items-start mb-2">
                                  <h3 className="font-bold text-gray-800 text-lg"><SafeText content={item.topic} /></h3>
                                  <button onClick={() => handleDeleteItem('trainings', item.id)} className="text-gray-300 hover:text-red-500"><X size={16}/></button>
                               </div>
                               <p className="text-sm text-gray-600 mb-4 italic">"<SafeText content={item.reason} />"</p>
                               <div className="flex justify-start">
                                  <a 
                                    href={`https://www.linkedin.com/learning/search?keywords=${encodeURIComponent(item.keywords)}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 bg-[#0a66c2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#004182] transition-colors"
                                  >
                                    <ExternalLink size={16}/> Voir cours sur LinkedIn
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
                  <div className="space-y-6">
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 flex items-start gap-3">
                       <div className="bg-white p-2 rounded-full text-orange-600 mt-1"><Book size={18}/></div>
                       <div>
                          <h4 className="font-bold text-orange-800 text-sm">Lectures Inspirantes</h4>
                          <p className="text-sm text-orange-700 mt-1">Des livres sélectionnés pour inspirer ce collaborateur ou l'aider à surmonter ses défis spécifiques.</p>
                       </div>
                    </div>
                    
                    {readings.length === 0 ? (
                       <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                         <Library className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                         <p className="text-gray-500 mb-4">Aucune lecture suggérée.</p>
                         <Button onClick={generateReadingRecommendations} icon={Search} isLoading={isGeneratingReading} variant="secondary">Suggérer des livres</Button>
                       </div>
                    ) : (
                       <>
                        <div className="flex justify-end">
                            <Button variant="ghost" size="sm" onClick={generateReadingRecommendations} isLoading={isGeneratingReading} icon={RefreshCw}>Nouvelles suggestions</Button>
                        </div>
                        <div className="grid gap-4">
                          {readings.map(item => (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-orange-200 transition-colors group">
                               <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <h3 className="font-bold text-gray-900 text-lg"><SafeText content={item.title} /></h3>
                                    <p className="text-sm text-gray-500 font-medium">de <SafeText content={item.author} /></p>
                                  </div>
                                  <button onClick={() => handleDeleteItem('readings', item.id)} className="text-gray-300 hover:text-red-500"><X size={16}/></button>
                                </div>
                               <p className="text-sm text-gray-600 mb-4 italic mt-2">"<SafeText content={item.reason} />"</p>
                               <div className="flex justify-start">
                                  <a 
                                    href={`https://www.amazon.fr/s?k=${encodeURIComponent(item.keywords)}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 bg-[#FF9900] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#e68a00] shadow-sm transition-colors"
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
            <input type="text" placeholder="Ex: Julie Dupont" className="w-full p-2.5 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} autoFocus />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Poste / Rôle</label>
            <input type="text" placeholder="Ex: Développeur Senior" className="w-full p-2.5 bg-white rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none" value={newEmployeeRole} onChange={(e) => setNewEmployeeRole(e.target.value)} />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={!newEmployeeName.trim()} isLoading={isAddingEmployee}>Créer</Button>
          </div>
        </form>
      </Modal>
      
      {/* DELETE NOTE CONFIRM MODAL */}
      <Modal isOpen={!!noteToDelete} onClose={() => setNoteToDelete(null)} title="Confirmation de suppression">
        <div className="text-center space-y-4">
            <div className="mx-auto bg-red-100 w-12 h-12 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={24} />
            </div>
            <p className="text-gray-600">Êtes-vous sûr de vouloir supprimer cette note définitivement ? <br/> Cette action est irréversible.</p>
            <div className="flex gap-3 justify-center mt-4">
                <Button variant="secondary" onClick={() => setNoteToDelete(null)}>Annuler</Button>
                <Button variant="danger" onClick={confirmDeleteNote} isLoading={isDeletingNote}>Supprimer</Button>
            </div>
        </div>
      </Modal>

      {/* DELETE EMPLOYEE CONFIRM MODAL */}
      <Modal isOpen={!!employeeToDelete} onClose={() => setEmployeeToDelete(null)} title="Supprimer le collaborateur ?">
        <div className="text-center space-y-4">
            <div className="mx-auto bg-red-100 w-12 h-12 rounded-full flex items-center justify-center">
                <AlertTriangle className="text-red-600" size={24} />
            </div>
            <h3 className="font-bold text-gray-900">Attention, action irréversible !</h3>
            <p className="text-gray-600 text-sm">
              Vous êtes sur le point de supprimer <strong>{employeeToDelete?.name}</strong>.
              <br/>
              Cela effacera <strong>définitivement</strong> tout son historique : notes, bilans, formations et lectures recommandées.
            </p>
            <div className="flex gap-3 justify-center mt-4">
                <Button variant="secondary" onClick={() => setEmployeeToDelete(null)}>Annuler</Button>
                <Button variant="danger" onClick={handleDeleteEmployeeFull} isLoading={isDeletingEmployee}>Tout supprimer</Button>
            </div>
        </div>
      </Modal>

    </div>
  );
}