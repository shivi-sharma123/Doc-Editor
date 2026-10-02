import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, Plus, Radio, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DocumentSummary {
    id: string;
    clients: number;
    length: number;
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function DocumentList() {
    const navigate = useNavigate();

    const [documents, setDocuments] = useState<DocumentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDocuments = useCallback(async () => {
        try {
            setError(null);
            const response = await fetch(`${API_BASE}/documents`);
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            setDocuments(await response.json());
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Could not reach the collaboration server.'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDocuments();
        const timer = setInterval(loadDocuments, 4000);
        return () => clearInterval(timer);
    }, [loadDocuments]);

    const createDocument = useCallback(async () => {
        setCreating(true);
        try {
            setError(null);
            const response = await fetch(`${API_BASE}/documents`, { method: 'POST' });
            if (!response.ok) throw new Error(`Server responded with ${response.status}`);
            const { id } = await response.json();
            navigate(`/${id}`);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Could not reach the collaboration server.'
            );
            setCreating(false);
        }
    }, [navigate]);

    return (
        <div className="list-page">
            <header className="list-header">
                <div>
                    <span className="list-eyebrow">
                        <Radio size={14} />
                        Conflict-free collaborative editor
                    </span>
                    <h1>Documents</h1>
                    <p>
                        Every room is an independent RGA replica set. Open one document in two
                        windows and watch the edits converge without a central lock.
                    </p>
                </div>

                <button className="primary-button" onClick={createDocument} disabled={creating}>
                    {creating ? (
                        <Loader2 className="spin" size={16} />
                    ) : (
                        <Plus size={16} />
                    )}
                    Create New Document
                </button>
            </header>

            {error && <div className="list-error">{error}</div>}

            {loading ? (
                <div className="list-empty">
                    <Loader2 className="spin" size={18} />
                    Loading documents…
                </div>
            ) : documents.length === 0 ? (
                <div className="list-empty">
                    <FileText size={18} />
                    No documents yet. Create one to start editing.
                </div>
            ) : (
                <ul className="doc-grid">
                    {documents.map((doc) => (
                        <li key={doc.id}>
                            <button className="doc-card" onClick={() => navigate(`/${doc.id}`)}>
                                <FileText size={18} />
                                <span className="doc-name">{doc.id}</span>
                                <span className="doc-meta">
                                    {doc.length} chars
                                    <span className="doc-clients">
                                        <Users size={13} />
                                        {doc.clients}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}