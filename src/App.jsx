import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, BookOpen, Plus, Save, Trash2, Sparkles, Menu, X, UserPlus, FileText, 
  ChevronRight, Briefcase, Loader2, AlertCircle, CheckCircle2, LogOut, Bot, 
  Settings, History, RefreshCw, Clock, Edit, Check, AlertTriangle, GraduationCap, 
  ExternalLink, Search, Book, Library, Target, Wand2, ArrowRight, PenTool,
  Wifi, Database, ShieldCheck, LogIn, Mail, Lock, Mic, MicOff, Pencil, Calendar,
  HelpCircle, Linkedin, Lightbulb, MousePointerClick, Globe, Filter, CheckSquare, Square,
  Download, ListChecks // Ajout de l'icône pour l'administration
} from 'lucide-react';
// On utilise le composant interne SEOMetaTags défini plus bas.
// Note: jsPDF est chargé via CDN dans useEffect pour éviter les erreurs de build.

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
  getDocs,
  orderBy, // AJOUTÉ : Nécessaire pour le tri admin
  collectionGroup // IMPÉRATIF pour la recherche admin
} from 'firebase/firestore';

// ==================================================================================
// 🔒 CONFIGURATION & TRADUCTIONS 🔒
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

// --- DICTIONNAIRE DE TRADUCTION COMPLET ---
const TRANSLATIONS = {
  fr: {
    auth: { subtitle: "Smarter insights. Stronger teams.", google_btn: "Continuer avec Google", or_email: "Ou via Email", email_placeholder: "Email", password_placeholder: "Mot de passe", login_btn: "Se connecter", signup_btn: "Créer mon compte", toggle_login: "J'ai déjà un compte", toggle_signup: "Pas encore de compte ? S'inscrire", copyright: "© 2025 Reviewiz.ai", login_error: "Erreur de connexion.", signup_error: "Erreur inscription." },
    sidebar: { general: "Général", support: "Support", team: "Mon Équipe", overview: "Vue d'ensemble", settings: "Configuration IA", help: "Aide", contact: "Contact", logout: "Se déconnecter", admin: "Administration" },
    dashboard: { title: "Tableau de Bord", subtitle: "Gérez vos notes et préparez vos évaluations sans stress.", empty_title: "Votre équipe est vide", empty_desc: "Commencez par ajouter votre premier collaborateur.", add_btn: "Ajouter un collaborateur", add_card: "Ajouter un membre", view_file: "Voir le dossier" },
    employee: { generate_btn: "Générer Bilan IA", generate_short: "Bilan", delete_tooltip: "Supprimer ce collaborateur", new_note_title: "Nouvelle Note", new_note_placeholder: "Qu'a fait ce collaborateur aujourd'hui ? (ex: 'Excellente présentation client...')", save_note: "Enregistrer la note", analyzing: "Analyser & Reformuler", stop_listening: "Stop", listen: "Dicter", edit_name: "Modifier le nom", generated_on: "Généré le", copy_text: "Copier", copy_success: "Copié !", download_pdf: "PDF" },
    tabs: { journal: "Journal", okrs: "Objectifs", history: "Bilans", training: "Formations", reading: "Lectures" },
    categories: { success: "Succès", improvement: "Amélioration", technical: "Technique", soft_skills: "Soft Skills", management: "Management" },
    filters: { filter_title: "Filtrer les notes", all: "Tout", type: "Type", category: "Catégorie" },
    actions: { mark_done: "Marquer comme terminé", mark_todo: "Marquer à faire", done: "Terminé", completed: "Complété" },
    help: { title: "Comment utiliser Reviewiz.ai?", subtitle: "Guide rapide pour maîtriser votre assistant RH en 4 étapes.", step1_title: "Créez votre équipe", step1_text_1: "Cliquez sur", step1_span: "+ Ajouter un collaborateur", step1_text_2: "dans le tableau de bord. Renseignez le nom et le poste de chaque membre.", step2_title: "Alimentez le journal", step2_text_1: "Au fil de l'eau, ajoutez des notes. Vous pouvez écrire ou utiliser le micro 🎙️. Utilisez le bouton", step2_span: "Analyser", step2_text_2: "pour que l'IA reformule et classe vos notes.", step3_title: "Générez des Bilans", step3_text_1: "Lors des entretiens, cliquez sur", step3_span: "Générer Bilan IA", step3_text_2: ". L'IA analyse l'historique pour rédiger une synthèse structurée et professionnelle.", step4_title: "Développez les talents", step4_text_1: "Utilisez les onglets", step4_span: "Formations, Lectures et Objectifs", step4_text_2: "pour obtenir des suggestions personnalisées par l'IA." },
    empty: { team_title: "Votre équipe est vide", notes_title: "Aucune note trouvée.", notes_desc: "Modifiez vos filtres ou ajoutez une note.", okr_title: "Aucun objectif défini.", okr_btn: "Générer des OKRs ✨", report_title: "Aucun bilan généré.", report_desc: "Cliquez sur 'Générer Bilan IA'.", training_title: "Aucune recommandation.", training_btn: "Analyser les besoins", reading_title: "Aucune lecture suggérée.", reading_btn: "Suggérer des livres" },
    modals: { add_title: "Nouveau Collaborateur", name_label: "Nom Complet", role_label: "Poste / Rôle", cancel: "Annuler", create: "Créer la fiche", delete_note_title: "Confirmation", delete_note_desc: "Supprimer cette note définitivement ?", delete_emp_title: "Supprimer ?", delete_emp_desc: "Tout l'historique sera effacé.", delete_btn: "Oui, supprimer", delete_all_btn: "Tout supprimer", warning_irreversible: "Attention, action irréversible !" },
    ai: { generating: "L'IA travaille...", generating_sub: "Analyse en cours.", saved_auto: "Sauvegardé automatiquement", regen: "Régénérer", why: "Pourquoi", see_linkedin: "Voir sur LinkedIn", see_amazon: "Voir sur Amazon", key_results: "Résultats Clés", based_on: "Basé sur" },
    settings: { title: "Configuration IA", subtitle: "Personnalisez les Prompts.", restore: "Restaurer défaut", save: "Sauvegarder", saved: "Sauvegardé" },
    admin: {
        title: "Tableau de Bord Administrateur",
        users: "Utilisateurs Inscrits",
        user_email: "Email",
        first_login: "Première Connexion",
        last_login: "Dernière Connexion",
        is_paid: "Payant",
        is_admin: "Admin",
        update: "Mettre à jour"
    }
  },
  en: {
    auth: { subtitle: "Smarter insights. Stronger teams.", google_btn: "Continue with Google", or_email: "Or via Email", email_placeholder: "Email", password_placeholder: "Password", login_btn: "Log In", signup_btn: "Create Account", toggle_login: "I already have an account", toggle_signup: "Sign up", copyright: "© 2025 Reviewiz.ai", login_error: "Login error.", signup_error: "Signup error." },
    sidebar: { general: "General", support: "Support", team: "My Team", overview: "Overview", settings: "AI Settings", help: "Help", contact: "Contact", logout: "Log out", admin: "Administration" },
    dashboard: { title: "Dashboard", subtitle: "Manage notes and prepare reviews without stress.", empty_title: "Your team is empty", empty_desc: "Start by adding your first team member.", add_btn: "Add Employee", add_card: "Add Member", view_file: "View Profile" },
    employee: { generate_btn: "Generate AI Review", generate_short: "Review", delete_tooltip: "Delete employee", new_note_title: "New Note", new_note_placeholder: "What happened today?", save_note: "Save Note", analyzing: "Analyze & Rewrite", stop_listening: "Stop", listen: "Dictate", edit_name: "Edit Name", generated_on: "Generated on", copy_text: "Copy", copy_success: "Copied!", download_pdf: "PDF" },
    tabs: { journal: "Journal", okrs: "OKRs", history: "Reviews", training: "Training", reading: "Books" },
    categories: { success: "Success", improvement: "Improvement", technical: "Technical", soft_skills: "Soft Skills", management: "Management" },
    filters: { filter_title: "Filter notes", all: "All", type: "Type", category: "Category" },
    actions: { mark_done: "Mark as done", mark_todo: "Mark as todo", done: "Done", completed: "Completed" },
    help: { title: "How to use Reviewiz.ai?", subtitle: "Quick guide to master your HR assistant in 4 steps.", step1_title: "Build your team", step1_text_1: "Click on", step1_span: "+ Add Employee", step1_text_2: "in the dashboard. Enter the name and role for each member.", step2_title: "Fill the journal", step2_text_1: "Regularly add notes. You can write or use the mic 🎙️. Use the button", step2_span: "Analyze", step2_text_2: "for AI to rewrite and categorize your notes.", step3_title: "Generate Reviews", step3_text_1: "During interviews, click on", step3_span: "Generate AI Review", step3_text_2: ". AI analyzes history to write a structured synthesis.", step4_title: "Develop Talent", step4_text_1: "Use the tabs", step4_span: "Training, Books, and OKRs", step4_text_2: "to get personalized AI suggestions."
    },
    empty: { team_title: "Your team is empty", notes_title: "No notes found.", notes_desc: "Check filters or add a note.", okr_title: "No objectives defined.", okr_btn: "Generate OKRs ✨", report_title: "No reports generated.", report_desc: "Click 'Generate AI Review'.", training_title: "No recommendations.", training_btn: "Analyze Needs", reading_title: "No books suggested.", reading_btn: "Suggest Books" },
    modals: { add_title: "New Employee", name_label: "Full Name", role_label: "Job Title", cancel: "Cancel", create: "Create Profile", delete_note_title: "Confirm Deletion", delete_note_desc: "Permanently delete this note?", delete_emp_title: "Delete Employee?", delete_emp_desc: "Entire history will be deleted.", delete_btn: "Yes, delete", delete_all_btn: "Delete Everything", warning_irreversible: "Warning: Irreversible!" },
    ai: { generating: "AI is working...", generating_sub: "Analyzing...", saved_auto: "Automatically saved", regen: "Regenerate", why: "Why", see_linkedin: "View on LinkedIn", see_amazon: "View on Amazon", key_results: "Key Results", based_on: "Based on" },
    settings: { title: "AI Settings", subtitle: "Customize Prompts.", restore: "Restore Defaults", save: "Save", saved: "Saved" },
    admin: {
        title: "Administrator Dashboard",
        users: "Registered Users",
        user_email: "Email",
        first_login: "First Login",
        last_login: "Last Login",
        is_paid: "Paid User",
        is_admin: "Admin",
        update: "Update"
    }
  },
  de: {
    auth: { subtitle: "Smarter insights. Stronger teams.", google_btn: "Weiter mit Google", or_email: "Oder per E-Mail", email_placeholder: "E-Mail", password_placeholder: "Passwort", login_btn: "Anmelden", signup_btn: "Konto erstellen", toggle_login: "Ich habe bereits ein Konto", toggle_signup: "Noch kein Konto? Registrieren", copyright: "© 2025 Reviewiz.ai", login_error: "Anmeldefehler.", signup_error: "Registrierungsfehler." },
    sidebar: { general: "Allgemein", support: "Support", team: "Mein Team", overview: "Übersicht", settings: "KI-Einstellungen", help: "Hilfe", contact: "Kontakt", logout: "Abmelden", admin: "Administration" },
    dashboard: { title: "Dashboard", subtitle: "Verwalten Sie Notizen und bereiten Sie Bewertungen stressfrei vor.", empty_title: "Ihr Team ist leer", empty_desc: "Beginnen Sie, indem Sie Ihren ersten Mitarbeiter hinzufügen.", add_btn: "Mitarbeiter hinzufügen", add_card: "Mitglied hinzufügen", view_file: "Profil ansehen" },
    employee: { generate_btn: "KI-Bericht generieren", generate_short: "Bericht", delete_tooltip: "Mitarbeiter löschen", new_note_title: "Neue Notiz", new_note_placeholder: "Was ist heute passiert?", save_note: "Notiz speichern", analyzing: "Analysieren & Umschreiben", stop_listening: "Stopp", listen: "Diktieren", edit_name: "Name bearbeiten", generated_on: "Erstellt am", copy_text: "Kopieren", copy_success: "Kopiert!", download_pdf: "PDF" },
    tabs: { journal: "Journal", okrs: "OKRs", history: "Berichte", training: "Schulungen", reading: "Bücher" },
    categories: { success: "Erfolg", improvement: "Verbesserung", technical: "Technisch", soft_skills: "Soft Skills", management: "Management" },
    filters: { filter_title: "Notizen filtern", all: "Alle", type: "Typ", category: "Kategorie" },
    actions: { mark_done: "Als erledigt markieren", mark_todo: "Als zu erledigen markieren", done: "Erledigt", completed: "Abgeschlossen" },
    help: { title: "Wie benutzt man Reviewiz.ai?", subtitle: "Kurzanleitung, um Ihren HR-Assistenten in 4 Schritten zu meistern.", step1_title: "Erstellen Sie Ihr Team", step1_text_1: "Klicken Sie auf", step1_span: "+ Ajouter", step1_text_2: "im Dashboard. Geben Sie Namen und Rolle jedes Mitglieds ein.", step2_title: "Füllen Sie das Journal", step2_text_1: "Fügen Sie regelmäßig Notizen hinzu. Sie können schreiben oder das Mikrofon 🎙️ nutzen. Klicken Sie auf", step2_span: "Analysieren", step2_text_2: "damit die KI umschreibt und kategorisiert.", step3_title: "Berichte generieren", step3_text_1: "Klicken Sie bei Gesprächen auf", step3_span: "KI-Bericht generieren", step3_text_2: ". Die KI analysiert den Verlauf und schreibt eine strukturierte Zusammenfassung.", step4_title: "Talente entwickeln", step4_text_1: "Nutzen Sie die Tabs", step4_span: "Schulungen, Bücher und OKRs", step4_text_2: "um personalisierte KI-Vorschläge zu erhalten." },
    modals: { add_title: "Neuer Mitarbeiter", name_label: "Vollständiger Name", role_label: "Position / Rolle", cancel: "Abbrechen", create: "Profil erstellen", delete_note_title: "Bestätigung", delete_note_desc: "Diese Notiz endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.", delete_emp_title: "Mitarbeiter löschen?", delete_emp_desc: "Der gesamte Verlauf wird gelöscht: Notizen, Berichte, Schulungs- und Leseempfehlungen.", delete_btn: "Ja, löschen", delete_all_btn: "Alles löschen", warning_irreversible: "Achtung: Irreversibel!" },
    ai: { generating: "Die KI arbeitet...", generating_sub: "Analyse läuft.", saved_auto: "Automatisch gespeichert", regen: "Neu generieren", why: "Warum", see_linkedin: "Auf LinkedIn ansehen", see_amazon: "Auf Amazon ansehen", key_results: "Schlüsselergebnisse (Key Results)", based_on: "Basierend auf" },
    settings: { title: "KI-Einstellungen", subtitle: "Passen Sie die Anweisungen (Prompts) an.", restore: "Standard wiederherstellen", save: "Speichern", saved: "Gespeichert" },
    admin: {
        title: "Administrator-Dashboard",
        users: "Registrierte Benutzer",
        user_email: "E-Mail",
        first_login: "Erste Anmeldung",
        last_login: "Letzte Anmeldung",
        is_paid: "Bezahlter Benutzer",
        is_admin: "Admin",
        update: "Aktualisieren"
    }
  }
};

// --- PROMPTS (Identiques) ---
const PROMPT_TEMPLATES = {
  fr: {
    // PROMPT BIENTOT MIS À JOUR
    report: `Tu agis en tant que Manager expérimenté et coach. Tu es expert en gestion de la performance et tu formules des feedbacks constructifs, motivants et factuels.
Mon collaborateur est {{NOM}} (Poste : {{ROLE}}).
Tes notes brutes prises durant l'année : """{{NOTES}}"""

TA TÂCHE : Rédige le commentaire narratif de l'évaluation annuelle à la première personne du singulier ("Je"), en utilisant un langage professionnel, humain et équilibré.

DIRECTIVES RH :
1. Fais une Synthèse intelligente : Regroupe mes notes par thématiques (Compétences techniques, Savoir-être, Projets majeurs).
2. APPLIQUE la Méthode S.B.I. (Situation - Behavior - Impact) pour décrire les réalisations et les problèmes, mais SANS JAMAIS MENTIONNER L'ACRONYME S.B.I. DANS LE RAPPORT FINAL.
3. Anti-Biais : Accorde autant d'importance aux notes du début d'année qu'à celles de la fin (évite le biais de récence).
4. Orientation Futur : Pour chaque point d'amélioration identifié, suggère subtilement une piste de développement ou une compétence à renforcer.

STRUCTURE REQUISE :
# Synthèse globale de l'année
# Réalisations Clés et Points Forts
# Zones de Développement (Axes d'amélioration)
# Conclusion et Encouragement
IMPORTANT: Ne mentionne pas être une IA. Signe "Le Manager". Use standard Markdown (tables accepted).`,

    training: `Tu es un expert en Learning & Development chez LinkedIn Learning.\nAnalyse les notes suivantes concernant un collaborateur ({{NOM}}, {{ROLE}}) pour identifier ses lacunes techniques ou comportementales.\n\nNOTES BRUTES :\n{{NOTES}}\n\nTA MISSION :\nSuggère 3 à 5 cours précis et existants sur LinkedIn Learning.\nSois très spécifique sur les titres de cours.\nPour chaque recommandation, explique quel problème observé dans les notes cela va résoudre.\n\nFORMAT DE RÉPONSE ATTENDU (JSON UNIQUEMENT, sans markdown) :\n[\n  {\n    "topic": "Titre exact ou très proche du cours suggéré",
    "reason": "Explication basée sur un fait précis des notes (ex: Pour améliorer la gestion des conflits notée en juin)",
    "keywords": "Mots clés optimisés pour la barre de recherche LinkedIn Learning"
  }\n]`,
    reading: `Tu es un bibliothécaire expert en développement professionnel et management.\nAnalyse les notes suivantes concernant un collaborateur ({{NOM}}, {{ROLE}}).\n\nNOTES BRUTES :\n{{NOTES}}\n\nTA MISSION :\nSuggère exactement 3 livres (essais, business, psycho, tech) pertinents.\n- Si les notes sont positives : des livres pour aller plus loin, inspirer, ou sur le leadership.\n- Si les notes sont mitigées : des livres pour résoudre les problèmes identifiés (gestion du temps, communication, code clean...).\n\nFORMAT DE RÉPONSE ATTENDU (JSON UNIQUEMENT, sans markdown) :\n[\n  {\n    "title": "Titre du livre",
    "author": "Auteur",
    "reason": "Pourquoi ce livre ? (Basé sur un fait noté)",
    "keywords": "Mots clés pour recherche Amazon (Titre + Auteur)"
  }\n]`,
    okr: `Tu es un coach expert en performance et management par objectifs (OKRs).\nAnalyse l'historique des notes de {{NOM}} ({{ROLE}}) ci-dessous pour comprendre ses défis et ses forces actuels.\n\nNOTES BRUTES :\n{{NOTES}}\n\nTA MISSION :\nPropose 3 Objectifs (Objectives) trimestriels pertinents, accompagnés pour chacun de 2 Résultats Clés (Key Results) mesurables.\nCes objectifs doivent aider le collaborateur à franchir un cap l'année prochaine.\n\nFORMAT DE RÉPONSE ATTENDU (JSON UNIQUEMENT, sans markdown) :\n[\n  {\n    "objective": "L'objectif inspirant (ex: Devenir un référent technique sur le projet X)",
    "keyResults": ["KR1 mesurable", "KR2 mesurable"],
    "rationale": "Pourquoi cet objectif ? (basé sur les notes)"
  }\n]`,
    rewrite: `Tu es un expert en communication managériale. \nAnalyse la note brute ci-dessous.\n\nTA MISSION :\n1. Reformule le texte pour qu'il soit factuel, professionnel et constructif.\n2. Détermine si c'est un "Succès" (positif) ou "Amélioration" (négatif/constructif).\n3. Détermine la catégorie : "Technique", "Management" ou "Soft Skills".\n\nNOTE BRUTE: "{{CONTENT}}"\n\nRÉPONSE ATTENDUE (JSON UNIQUEMENT) :\n{\n  "rewritten": "Le texte reformulé ici",
  "tag": "Succès" ou "Amélioration",
  "category": "Technique" ou "Management" ou "Soft Skills"
}`
  },
  en: {
    // NOUVEAU PROMPT TRADUIT (EN)
    report: `You act as an experienced Manager and Coach. You are an expert in performance management and formulate constructive, motivating, and factual feedback.
My employee is {{NOM}} (Role: {{ROLE}}).
My raw notes taken throughout the year: """{{NOTES}}"""

YOUR TASK: Write the narrative comment for the annual review in the first person singular ("I"), using professional, human, and balanced language.

HR GUIDELINES:
1. Smart Synthesis: Group my notes by themes (Technical Skills, Soft Skills/Behaviors, Major Projects).
2. APPLY the S.B.I. Method (Situation - Behavior - Impact) when describing achievements or issues, but NEVER MENTION THE ACRONYM S.B.I. IN THE FINAL REPORT.
3. Anti-Bias: Give equal weight to notes from the beginning of the year as to those from the end (avoid recency bias).
4. Future Orientation: For each identified area for improvement, subtly suggest a development track or skill to strengthen for the coming year.

REQUIRED STRUCTURE:
# Global Year Synthesis
# Key Achievements and Strengths
# Development Areas (Areas for Improvement)
# Conclusion and Encouragement
IMPORTANT: Do not mention being an AI. Sign "The Manager". Use standard Markdown (tables accepted).`,

    training: `You are a Learning & Development expert at LinkedIn Learning.\nAnalyze the following notes for an employee ({{NOM}}, {{ROLE}}) to identify technical or behavioral gaps.\n\nRAW NOTES:\n{{NOTES}}\n\nYOUR MISSION:\nSuggest 3 to 5 specific and existing courses on LinkedIn Learning.\nBe very specific about course titles.\nFor each recommendation, explain what problem observed in the notes this will solve.\n\nEXPECTED RESPONSE FORMAT (JSON ONLY, no markdown):\n[\n  {\n    "topic": "Exact or very close title of the suggested course",
    "reason": "Explanation based on a specific fact from the notes (e.g., To improve conflict management noted in June)",
    "keywords": "Optimized keywords for LinkedIn Learning search bar"
  }\n]`,
    reading: `You are an expert librarian in professional development and management.\nAnalyze the following notes for an employee ({{NOM}}, {{ROLE}}).\n\nRAW NOTES:\n{{NOTES}}\n\nYOUR MISSION:\nSuggest exactly 3 relevant books (essays, business, psychology, tech).\n- If notes are positive: books to go further, inspire, or on leadership.\n- If notes are mixed: books to solve identified problems (time management, communication, clean code...).\n\nEXPECTED RESPONSE FORMAT (JSON ONLY, no markdown):\n[\n  {\n    "title": "Book Title",
    "author": "Author",
    "reason": "Why this book? (Based on a noted fact)",
    "keywords": "Keywords for Amazon search (Title + Author)"
  }\n]`,
    okr: `You are an expert coach in performance and management by objectives (OKRs).\nAnalyze the note history of {{NOM}} ({{ROLE}}) below to understand their current challenges and strengths.\n\nRAW NOTES:\n{{NOTES}}\n\nYOUR MISSION:\nPropose 3 relevant Quarterly Objectives, each accompanied by 2 measurable Key Results.\nThese objectives must help the employee reach a new level next year.\n\nEXPECTED RESPONSE FORMAT (JSON ONLY, no markdown):\n[\n  {\n    "objective": "Inspiring objective (e.g., Become a technical reference on project X)",
    "keyResults": ["Measurable KR1", "Measurable KR2"],
    "rationale": "Why this objective? (based on notes)"
  }\n]`,
    rewrite: `You are a managerial communication expert. \nAnalyze the raw note below.\n\nYOUR MISSION:\n1. Rewrite the text to be factual, professional, and constructive in English.\n2. Determine if it is "Succès" (Success) or "Amélioration" (Improvement).\n3. Determine the category: "Technique", "Management" or "Soft Skills".\n\nRAW NOTE: "{{CONTENT}}"\n\nEXPECTED RESPONSE (JSON ONLY) :\n{\n  "rewritten": "The rewritten text here",
  "tag": "Succès" or "Amélioration",
  "category": "Technique" or "Management" or "Soft Skills"
}`
  },
  de: {
    // NOUVEAU PROMPT TRADUIT (DE)
    report: `Sie agieren als erfahrener Manager und Coach. Sie sind Experte für Performance-Management und formulieren konstruktives, motivierendes und faktengestütztes Feedback.
Mein Mitarbeiter ist {{NOM}} (Rolle: {{ROLE}}).
Meine rohen Notizen, die ich das Jahr über gemacht habe: """{{NOTES}}"""

IHRE AUFGABE: Verfassen Sie den narrativen Kommentar für die jährliche Leistungsbeurteilung in der ersten Person Singular ("Ich"), unter Verwendung einer professionellen, menschlichen und ausgewogenen Sprache.

HR-RICHTLINIEN:
1. Intelligente Synthese: Gruppieren Sie die Notizen thematisch (Technische Fähigkeiten, Soft Skills/Verhalten, Hauptprojekte).
2. WENDEN SIE die S.B.I.-Methode (Situation - Verhalten - Auswirkung) an, wenn Sie Erfolge oder Probleme beschreiben, aber ERWÄHNEN SIE DAS AKRONYM S.B.I. NICHT IM ENDBERICHT.
3. Anti-Bias: Geben Sie Notizen vom Jahresanfang die gleiche Bedeutung wie Notizen vom Jahresende (Vermeidung von Rezenz-Bias).
4. Zukunftsorientierung: Schlagen Sie für jeden identifizierten Verbesserungsbereich subtil eine Entwicklungsmöglichkeit oder eine zu stärkende Kompetenz für das kommende Jahr vor.

ERFORDERLICHE STRUKTUR:
# Globale Jahressynthese
# Wichtigste Erfolge und Stärken
# Entwicklungsbereiche (Verbesserungspotenziale)
# Schlussfolgerung und Ermutigung
WICHTIG: Erwähnen Sie nicht, dass Sie eine KI sind. Unterschreiben Sie mit "Der Manager". Verwenden Sie Standard-Markdown (tables accepted).`,
    training: `Sie sind ein Experte für Learning & Development bei LinkedIn Learning.\nAnalysieren Sie die folgenden Notizen für einen Mitarbeiter ({{NOM}}, {{ROLE}}), um technische oder verhaltensbezogene Lücken zu identifizieren.\n\nROHE NOTIZEN:\n{{NOTES}}\n\nIHRE MISSION:\nSchlagen Sie 3 bis 5 spezifische und vorhandene Kurse auf LinkedIn Learning vor.\nSeien Sie sehr spezifisch bei den Kurstiteln.\nErklären Sie für jede Empfehlung, welches in den Notizen beobachtete Problem dadurch gelöst wird.\n\nERWARTETES ANTWORTFORMAT (JSON ONLY, no markdown):\n[\n  {\n    "topic": "Exakter oder sehr ähnlicher Titel des vorgeschlagenen Kurses",
    "reason": "Erklärung basierend auf einem spezifischen Fakt aus den Notizen (z.B. Zur Verbesserung des im Juni bemerkten Konfliktmanagements)",
    "keywords": "Optimierte Keywords für die LinkedIn Learning Suchleiste"
  }\n]`,
    reading: `Sie sind ein erfahrener Bibliothekar für berufliche Entwicklung und Management.\nAnalysieren Sie die folgenden Notizen für einen Mitarbeiter ({{NOM}}, {{ROLE}}).\n\nROHE NOTIZEN:\n{{NOTES}}\n\nIHRE MISSION:\nSchlagen Sie genau 3 relevante Bücher (essays, business, psychology, tech) vor.\n- Wenn die Notizen positiv sind: Bücher, um weiterzukommen, zu inspirieren ou über Führung.\n- Wenn die Notizen gemischt sind: Bücher zur Lösung identifizierter Probleme (Zeitmanagement, Kommunikation, Clean Code...).\n\nERWARTETES ANTWORTFORMAT (NUR JSON, kein Markdown):\n[\n  {\n    "title": "Buchtitel",
    "author": "Autor",
    "reason": "Warum dieses Buch? (Basierend auf einer notierten Tatsache)",
    "keywords": "Keywords für die Amazon-Suche (Titel + Autor)"
  }\n]`,
    okr: `Sie sind ein erfahrener Coach für Leistung und Management durch Ziele (OKRs).\nAnalysieren Sie den Notizverlauf von {{NOM}} ({{ROLE}}) unten, um seine aktuellen Herausforderungen und Stärken zu verstehen.\n\nROHE NOTIZEN:\n{{NOTES}}\n\nIHRE MISSION:\nPropose 3 relevante vierteljährliche Ziele vor, jeweils begleitet von 2 messbaren Schlüsselergebnissen (Key Results).\nDiese Ziele sollen dem Mitarbeiter helfen, im nächsten Jahr eine neue Stufe zu erreichen.\n\nERWARTETES ANTWORTFORMAT (NUR JSON, kein Markdown):\n[\n  {\n    "objective": "Inspirierendes Ziel (z.B. Technischer Referenzpunkt im Projekt X werden)",
    "keyResults": ["Messbares KR1", "Messbares KR2"],
    "rationale": "Warum dieses Ziel? (basierend auf Notizen)"
  }\n]`,
    rewrite: `Sie sind ein Experte für Führungskommunikation. \nAnalysieren Sie die rohe Notiz unten.\n\nIHRE MISSION:\n1. Formulieren Sie den Text so um, dass er sachlich, professionell und konstruktiv auf Deutsch ist.\n2. Bestimmen Sie, ob es sich um "Succès" (Erfolg) ou "Amélioration" (Verbesserung) handelt.\n3. Bestimmen Sie die Kategorie: "Technique", "Management" ou "Soft Skills".\n\nROHE NOTIZ: "{{CONTENT}}"\n\nRÉPONSE ATTENDUE (JSON UNIQUEMENT) :\n{\n  "rewritten": "Der umformulierte Text hier",
  "tag": "Succès" ou "Amélioration",
  "category": "Technique" ou "Management" ou "Soft Skills"
}`
  }
};


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
             {/* CORRECTION: utilisation de setLang (prop) au lieu de setLanguage */}
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

// --- Admin Dashboard Component ---
const AdminDashboard = ({ users, updateRole, t, userProfile }) => {
    // Note: Le code du tableau de bord Admin est ici
    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <ListChecks className="text-red-600" /> {t('admin', 'title')}
                </h1>
                <p className="text-gray-500 mt-2">{t('admin', 'users')} ({users.length})</p>
            </header>

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase">{t('admin', 'user_email')}</th>
                            <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase">{t('admin', 'first_login')}</th>
                            <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase">{t('admin', 'last_login')}</th>
                            <th className="px-6 py-3 text-center font-bold text-gray-500 uppercase">{t('admin', 'is_paid')}</th>
                            <th className="px-6 py-3 text-center font-bold text-gray-500 uppercase">{t('admin', 'is_admin')}</th>
                            <th className="px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {users.map(user => (
                            <tr key={user.uid} className={user.isAdmin ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-800 font-medium">
                                    {user.email} 
                                    {user.uid === userProfile.uid && <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 font-bold">You</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {user.lastLoginAt ? new Date(user.lastLoginAt.seconds * 1000).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={user.isPaid || false} 
                                        onChange={() => updateRole(user.uid, 'isPaid', !user.isPaid)}
                                        className="rounded text-green-600 focus:ring-green-500"
                                    />
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <input 
                                        type="checkbox" 
                                        checked={user.isAdmin || false} 
                                        // Empêcher l'admin de se retirer lui-même son rôle (sécurité)
                                        disabled={user.uid === userProfile.uid}
                                        onChange={() => updateRole(user.uid, 'isAdmin', !user.isAdmin)}
                                        className="rounded text-red-600 focus:ring-red-500"
                                    />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {/* <Button size="sm" variant="secondary">{t('admin', 'update')}</Button> */}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
// --- END Admin Dashboard Component ---


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
  // Derive initial language once: user choice (localStorage) > browser detection > fallback fr
  const [lang, setLang] = useState(() => {
    try {
      const saved = localStorage.getItem('reviewiz_lang');
      if (saved) return saved;
      const browserLang = (typeof navigator !== 'undefined') ? (navigator.language || navigator.userLanguage) : 'fr';
      if (browserLang.startsWith('fr')) return 'fr';
      if (browserLang.startsWith('de')) return 'de';
      return 'en';
    } catch (e) {
      return 'fr';
    }
  }); // 'fr' ou 'en' ou 'de'

  // Flag to know if user explicitly selected a language (prevents any future auto override scenarios)
  const userSelectedLanguageRef = useRef(!!(() => { try { return localStorage.getItem('reviewiz_lang'); } catch(e) { return null; } })());
  
  // --- USER PROFILE & ADMIN STATE ---
  // Initialisation avec uid: null pour forcer l'attente du chargement de Firestore
  const [userProfile, setUserProfile] = useState({uid: null, isAdmin: false, isPaid: false});
  const [allUsers, setAllUsers] = useState([]); // Pour le dashboard admin

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

  // --- LANGUAGE UPDATE EFFECT (CORRECTION 1) ---
    useEffect(() => {
      setPrompts(prevPrompts => {
        // If the user has customized the prompts, keep them; otherwise load default prompts for the selected language.
        const isDefaultPrompt = [PROMPT_TEMPLATES.fr.report, PROMPT_TEMPLATES.en.report, PROMPT_TEMPLATES.de.report].includes(prevPrompts.report);
        if (!isDefaultPrompt) {
          return prevPrompts; // keep user's custom prompts
        }
        return initialPrompts; // load default initial prompts for the selected language
      });
    }, [lang, initialPrompts]);


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
      // CORRECTION: Changement de 'settings/profile' à 'profile/account' pour matcher l'index Firestore
      // L'index a été créé sur la collection 'profile'. Donc le document doit être DANS une collection 'profile'.
      const docRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'account');
      
      // On utilise getDoc (au lieu de onSnapshot) pour la création initiale, 
      // car onSnapshot peut causer des boucles si le doc n'existe pas encore.
      getDoc(docRef).then(s => {
          if (s.exists()) {
              setUserProfile({uid: uid, ...s.data()});
              setLoading(false); // Le profil a été trouvé
          } else {
              // Profil n'existe pas : on le crée et on met les dates/rôles par défaut
              const initialData = { 
                  uid: uid,
                  email: auth.currentUser?.email || 'N/A', 
                  isAdmin: false,
                  isPaid: false,
                  createdAt: serverTimestamp(),
                  lastLoginAt: serverTimestamp()
              };
              setDoc(docRef, initialData, { merge: true }).then(() => {
                 // Après la création réussie, on charge l'état local immédiatement
                 setUserProfile(initialData); 
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
      
      // On met en place le listener de temps réel APRES le chargement initial pour les MAJ futures
      const unsubListener = onSnapshot(docRef, (s) => {
          if (s.exists()) {
              setUserProfile({uid: uid, ...s.data()});
          }
      });
      return unsubListener;
  };
  
  const handleUpdateUserRole = async (uid, field, value) => {
      if (!userProfile.isAdmin) {
          alert("Accès refusé. Vous devez être administrateur pour modifier les rôles.");
          return;
      }
      try {
          // CORRECTION: Utilisation du bon chemin de collection 'profile'
          const docRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'account');
          await updateDoc(docRef, { [field]: value, lastUpdateByAdmin: serverTimestamp() });
          setSuccessMsg(t('admin', 'update') + ' ' + t('settings', 'saved'));
      } catch(e) {
          console.error("Error updating role:", e);
          setErrorMsg("Échec de la mise à jour.");
      }
  };

  // Synchroniser tous les utilisateurs pour la vue Admin (Accessible uniquement si admin)
  useEffect(() => {
      if (!user || !db || !userProfile.isAdmin || view !== 'admin') {
          setAllUsers([]);
          return;
      }
      
      const fetchAllUsersAdmin = async () => {
         try {
             // Utilisation de collectionGroup pour récupérer tous les profils de manière robuste
             // Votre index est sur la collection 'profile'.
             // La requête trie par lastLoginAt DESC.
             
             // CORRECTION MAJEURE: Requête directe sur la collection 'profile' avec tri
             const q = query(collectionGroup(db, 'profile'), orderBy('lastLoginAt', 'desc'));
             
             const querySnapshot = await getDocs(q);
             
             let usersData = [];
             querySnapshot.forEach((doc) => {
                 const data = doc.data();
                 // L'UID est le parent du parent (users -> uid -> profile -> account)
                 // doc.ref.parent.parent.id donne l'UID
                 const uid = doc.ref.parent.parent?.id;
                 if (uid) {
                     usersData.push({
                         uid: uid,
                         email: data.email || 'N/A',
                         isAdmin: data.isAdmin || false,
                         isPaid: data.isPaid || false,
                         createdAt: data.createdAt,
                         lastLoginAt: data.lastLoginAt
                     });
                 }
             });

             setAllUsers(usersData);

         } catch(e) {
             console.error("Erreur lors du chargement des utilisateurs Admin:", e);
             setErrorMsg("Échec du chargement des utilisateurs. Vérifiez les règles Firestore.");
         }
      };
      
      // On charge les utilisateurs quand la vue Admin est sélectionnée
      fetchAllUsersAdmin();
      
      // NOTE: Pas de temps réel sur cette lecture complexe pour l'instant.
      return () => {};
  }, [user, db, userProfile.isAdmin, view]);


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

      // VUE ADMIN (Accessible uniquement si l'utilisateur est admin)
      if (userProfile.isAdmin && view === 'admin') {
          return <AdminDashboard users={allUsers} updateRole={handleUpdateUserRole} t={t} userProfile={userProfile} />;
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
                  onClick={() => { setView('settings'); setSelectedEmployee(null); setMobileMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3
                    ${view === 'settings' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Settings size={18} /> {t('sidebar', 'settings')}
                </button>
                <button
                  onClick={() => { setView('help'); setSelectedEmployee(null); setMobileMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-3
                    ${view === 'help' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <HelpCircle size={18} /> {t('sidebar', 'help')}
                </button>
                
                {/* BOUTON ADMIN (Visible uniquement si l'utilisateur est admin) */}
                {userProfile.isAdmin && (
                    <button
                        onClick={() => { setView('admin'); setSelectedEmployee(null); setMobileMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-3 mt-4
                        ${view === 'admin' ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <ListChecks size={18} /> {t('sidebar', 'admin')}
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
                {view === 'settings' ? t('settings', 'title') : selectedEmployee ? selectedEmployee.name : t('dashboard', 'title')}
              </span>
            </div>

            {/* --- VUE ADMIN --- */}
            {view === 'admin' && <AdminDashboard users={allUsers} updateRole={handleUpdateUserRole} t={t} userProfile={userProfile} />}


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

            {/* --- VIEW: SETTINGS --- */}
            {view === 'settings' && (
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