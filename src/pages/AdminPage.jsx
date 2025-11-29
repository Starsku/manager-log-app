import { useState, useEffect } from 'react';
import { collectionGroup, query, getDocs, doc, updateDoc, collection, serverTimestamp, setDoc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { ListChecks, Mail, Calendar, Clock, CheckCircle, XCircle, Users, FileText, ClipboardList, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';

const AdminPage = ({ db, t, userProfile, appId }) => {
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);
    const [sortField, setSortField] = useState('lastLoginAt');
    const [sortDirection, setSortDirection] = useState('desc');
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if (!db || !userProfile.isAdmin) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribes = [];
        const processedUsers = new Set(); // Pour éviter les doublons
        
        // Fonction pour créer un listener pour un utilisateur
        const createUserListener = (uid, initialData) => {
            const profileRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'account');
            const unsub = onSnapshot(profileRef, (snap) => {
                if (snap.exists()) {
                    const updatedData = snap.data();
                    console.log(`[AdminPage] Mise à jour profil ${uid}, lastLoginAt:`, updatedData.lastLoginAt);
                    setAllUsers(prev => {
                        const exists = prev.find(u => u.uid === uid);
                        if (exists) {
                            // Mise à jour
                            return prev.map(u => 
                                u.uid === uid ? { 
                                    ...u, 
                                    email: updatedData.email || u.email,
                                    isPaid: updatedData.isPaid || false,
                                    lastLoginAt: updatedData.lastLoginAt,
                                    createdAt: updatedData.createdAt || u.createdAt,
                                    name: updatedData.name || u.name
                                } : u
                            );
                        } else {
                            // Nouvel utilisateur détecté
                            console.log(`[AdminPage] Nouvel utilisateur détecté: ${uid}`);
                            return [...prev, initialData];
                        }
                    });
                }
            });
            unsubscribes.push(unsub);
        };
        
        // Listener sur collectionGroup pour détecter les nouveaux utilisateurs
        const q = collectionGroup(db, 'profile');
        const mainUnsubscribe = onSnapshot(q, async (querySnapshot) => {
            console.log(`[AdminPage] Snapshot reçu: ${querySnapshot.size} documents`);
            
            const newUserPromises = [];
            
            querySnapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                const uid = docSnapshot.ref.parent.parent?.id;
                
                // Ne traiter que les documents "account" non encore traités
                if (uid && docSnapshot.id === 'account' && !processedUsers.has(uid)) {
                    processedUsers.add(uid);
                    console.log(`[AdminPage] Traitement nouvel utilisateur: ${uid}`);
                    
                    const userDataPromise = (async () => {
                        try {
                            // Vérifier admin
                            const adminDocRef = doc(db, 'systems', 'admins', 'users', uid);
                            const adminDoc = await getDoc(adminDocRef);
                            const isAdmin = adminDoc.exists();
                            
                            // Compter stats
                            const [employeesSnap, notesSnap, reportsSnap] = await Promise.all([
                                getDocs(collection(db, 'artifacts', appId, 'users', uid, 'employees')),
                                getDocs(collection(db, 'artifacts', appId, 'users', uid, 'notes')),
                                getDocs(collection(db, 'artifacts', appId, 'users', uid, 'reports'))
                            ]);
                            
                            const userData = {
                                uid: uid,
                                email: data.email || 'N/A',
                                isAdmin: isAdmin,
                                isPaid: data.isPaid || false,
                                createdAt: data.createdAt,
                                lastLoginAt: data.lastLoginAt,
                                name: data.name || '',
                                employeesCount: employeesSnap.size,
                                notesCount: notesSnap.size,
                                reportsCount: reportsSnap.size
                            };
                            
                            // Créer listener pour cet utilisateur
                            createUserListener(uid, userData);
                            
                            return userData;
                        } catch (e) {
                            console.error(`Erreur stats pour ${uid}:`, e);
                            return null;
                        }
                    })();
                    
                    newUserPromises.push(userDataPromise);
                }
            });
            
            if (newUserPromises.length > 0) {
                const newUsers = (await Promise.all(newUserPromises)).filter(u => u !== null);
                if (newUsers.length > 0) {
                    console.log(`[AdminPage] Ajout de ${newUsers.length} nouveaux utilisateurs`);
                    setAllUsers(prev => {
                        const existingUids = new Set(prev.map(u => u.uid));
                        const uniqueNewUsers = newUsers.filter(u => !existingUids.has(u.uid));
                        return [...prev, ...uniqueNewUsers];
                    });
                }
            }
            
            setLoading(false);
        }, (error) => {
            console.error("Erreur listener collectionGroup:", error);
            setError(`Erreur temps réel: ${error.message}`);
            setLoading(false);
        });
        
        unsubscribes.push(mainUnsubscribe);

        return () => {
            console.log(`[AdminPage] Nettoyage de ${unsubscribes.length} listeners`);
            unsubscribes.forEach(unsub => unsub());
        };
    }, [db, userProfile.isAdmin, appId, refreshKey]);
    
    const refreshData = () => {
        // Force le rechargement en incrémentant refreshKey
        setRefreshKey(prev => prev + 1);
    };

    const handleSort = (field) => {
        if (sortField === field) {
            // Inverser la direction si on clique sur la même colonne
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // Nouvelle colonne, tri descendant par défaut
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const getSortedUsers = () => {
        const sorted = [...allUsers].sort((a, b) => {
            let valueA, valueB;

            switch (sortField) {
                case 'email':
                    valueA = a.email?.toLowerCase() || '';
                    valueB = b.email?.toLowerCase() || '';
                    break;
                case 'createdAt':
                    valueA = a.createdAt?.seconds || 0;
                    valueB = b.createdAt?.seconds || 0;
                    break;
                case 'lastLoginAt':
                    valueA = a.lastLoginAt?.seconds || 0;
                    valueB = b.lastLoginAt?.seconds || 0;
                    break;
                case 'employeesCount':
                    valueA = a.employeesCount || 0;
                    valueB = b.employeesCount || 0;
                    break;
                case 'notesCount':
                    valueA = a.notesCount || 0;
                    valueB = b.notesCount || 0;
                    break;
                case 'reportsCount':
                    valueA = a.reportsCount || 0;
                    valueB = b.reportsCount || 0;
                    break;
                case 'isPaid':
                    valueA = a.isPaid ? 1 : 0;
                    valueB = b.isPaid ? 1 : 0;
                    break;
                case 'isAdmin':
                    valueA = a.isAdmin ? 1 : 0;
                    valueB = b.isAdmin ? 1 : 0;
                    break;
                default:
                    return 0;
            }

            if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
            if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) {
            return <ArrowUpDown size={14} className="inline ml-1 text-gray-400" />;
        }
        return sortDirection === 'asc' 
            ? <ArrowUp size={14} className="inline ml-1 text-indigo-600" />
            : <ArrowDown size={14} className="inline ml-1 text-indigo-600" />;
    };

    const handleToggleRole = async (uid, field, currentValue) => {
        try {
            const newValue = !currentValue;
            
            if (field === 'isPaid') {
                // Mettre à jour isPaid dans artifacts
                const docRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'account');
                await updateDoc(docRef, { 
                    isPaid: newValue,
                    lastUpdateByAdmin: serverTimestamp()
                });
            } else if (field === 'isAdmin') {
                // Mettre à jour UNIQUEMENT dans systems/admins/users
                const adminDocRef = doc(db, 'systems', 'admins', 'users', uid);
                
                if (newValue) {
                    // Ajouter l'utilisateur aux admins
                    await setDoc(adminDocRef, {
                        isAdmin: true,
                        createdAt: serverTimestamp()
                    });
                } else {
                    // Retirer l'utilisateur des admins
                    await deleteDoc(adminDocRef);
                }
            }
            
            // Mettre à jour localement
            setAllUsers(prev => prev.map(u => 
                u.uid === uid ? { ...u, [field]: newValue } : u
            ));
            
            setSuccessMsg(`${field === 'isPaid' ? 'Statut payant' : 'Statut admin'} mis à jour`);
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (e) {
            console.error("Erreur mise à jour:", e);
            setError(`Échec de la mise à jour: ${e.message}`);
            setTimeout(() => setError(null), 5000);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '-';
        try {
            return new Date(timestamp.seconds * 1000).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '-';
        }
    };

    if (!userProfile.isAdmin) {
        return (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <XCircle className="mx-auto text-red-500 mb-4" size={48} />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h2>
                    <p className="text-gray-500">Vous devez être administrateur pour accéder à cette page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50">
            <header className="mb-6 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <ListChecks className="text-red-600" /> Administration
                    </h1>
                    <p className="text-gray-500 mt-2">
                        Gestion des utilisateurs ({allUsers.length} utilisateur{allUsers.length > 1 ? 's' : ''})
                    </p>
                </div>
                <button
                    onClick={refreshData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    Actualiser
                </button>
            </header>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">
                    ⚠️ {error}
                </div>
            )}

            {successMsg && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-600 rounded-lg">
                    ✓ {successMsg}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th 
                                        onClick={() => handleSort('email')}
                                        className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Mail size={14} />
                                            Utilisateur
                                            <SortIcon field="email" />
                                        </div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('createdAt')}
                                        className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} />
                                            Création
                                            <SortIcon field="createdAt" />
                                        </div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('lastLoginAt')}
                                        className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Clock size={14} />
                                            Dernière connexion
                                            <SortIcon field="lastLoginAt" />
                                        </div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('employeesCount')}
                                        className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            <Users size={14} />
                                            Employés
                                            <SortIcon field="employeesCount" />
                                        </div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('notesCount')}
                                        className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            <ClipboardList size={14} />
                                            Notes
                                            <SortIcon field="notesCount" />
                                        </div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('reportsCount')}
                                        className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            <FileText size={14} />
                                            Bilans
                                            <SortIcon field="reportsCount" />
                                        </div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('isPaid')}
                                        className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            Payant
                                            <SortIcon field="isPaid" />
                                        </div>
                                    </th>
                                    <th 
                                        onClick={() => handleSort('isAdmin')}
                                        className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            Admin
                                            <SortIcon field="isAdmin" />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {allUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                                            Aucun utilisateur trouvé
                                        </td>
                                    </tr>
                                ) : (
                                    getSortedUsers().map(user => (
                                        <tr 
                                            key={user.uid} 
                                            className={user.isAdmin ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {user.email}
                                                        </div>
                                                        {user.name && (
                                                            <div className="text-sm text-gray-500">{user.name}</div>
                                                        )}
                                                        {user.uid === userProfile.uid && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 mt-1">
                                                                Vous
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(user.createdAt)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(user.lastLoginAt)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    {user.employeesCount || 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                    {user.notesCount || 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                                    {user.reportsCount || 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={user.isPaid || false}
                                                    onChange={() => handleToggleRole(user.uid, 'isPaid', user.isPaid)}
                                                    className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 focus:ring-2 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={user.isAdmin || false}
                                                    disabled={user.uid === userProfile.uid}
                                                    onChange={() => handleToggleRole(user.uid, 'isAdmin', user.isAdmin)}
                                                    className={`w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2 ${
                                                        user.uid === userProfile.uid ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                                                    }`}
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
