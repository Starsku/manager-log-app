import { useState, useEffect } from 'react';
import { collectionGroup, query, orderBy, getDocs } from 'firebase/firestore';
import { ListChecks, Mail, Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';

const AdminPage = ({ db, t, userProfile }) => {
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!db || !userProfile.isAdmin) {
            setLoading(false);
            return;
        }

        const fetchAllUsers = async () => {
            try {
                setLoading(true);
                setError(null);

                // Requête sur le collectionGroup 'profile' avec tri par lastLoginAt
                const q = query(
                    collectionGroup(db, 'profile'), 
                    orderBy('lastLoginAt', 'desc')
                );
                
                const querySnapshot = await getDocs(q);
                
                const usersData = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    // L'UID est le parent du parent (users -> uid -> profile -> account)
                    const uid = doc.ref.parent.parent?.id;
                    if (uid) {
                        usersData.push({
                            uid: uid,
                            email: data.email || 'N/A',
                            isAdmin: data.isAdmin || false,
                            isPaid: data.isPaid || false,
                            createdAt: data.createdAt,
                            lastLoginAt: data.lastLoginAt,
                            name: data.name || ''
                        });
                    }
                });

                setAllUsers(usersData);
            } catch (e) {
                console.error("Erreur lors du chargement des utilisateurs:", e);
                setError("Échec du chargement des utilisateurs. Vérifiez les règles Firestore.");
            } finally {
                setLoading(false);
            }
        };

        fetchAllUsers();
    }, [db, userProfile.isAdmin]);

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
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <ListChecks className="text-red-600" /> Administration
                </h1>
                <p className="text-gray-500 mt-2">
                    Gestion des utilisateurs ({allUsers.length} utilisateur{allUsers.length > 1 ? 's' : ''})
                </p>
            </header>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">
                    ⚠️ {error}
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
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-2">
                                            <Mail size={14} />
                                            Utilisateur
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} />
                                            Création
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-2">
                                            <Clock size={14} />
                                            Dernière connexion
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Payant
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Admin
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {allUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                            Aucun utilisateur trouvé
                                        </td>
                                    </tr>
                                ) : (
                                    allUsers.map(user => (
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
                                                {user.isPaid ? (
                                                    <CheckCircle className="inline text-green-600" size={20} />
                                                ) : (
                                                    <XCircle className="inline text-gray-300" size={20} />
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {user.isAdmin ? (
                                                    <CheckCircle className="inline text-red-600" size={20} />
                                                ) : (
                                                    <XCircle className="inline text-gray-300" size={20} />
                                                )}
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
