import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function DocumentList() {
    const [docs, setDocs] = useState<{ id: string; clients: number; length: number }[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetch('http://localhost:3001/documents')
            .then(res => res.json())
            .then(setDocs)
            .catch(console.error);
    }, []);

    const createNewDoc = async () => {
        try {
            const res = await fetch('http://localhost:3001/documents', { method: 'POST' });
            const { id } = await res.json();
            navigate(`/${id}`);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h1>CRDT Editor Rooms</h1>
            <button onClick={createNewDoc} style={{ padding: '10px 20px', cursor: 'pointer', marginBottom: '20px' }}>
                Create New Document
            </button>

            <h2>Active Documents</h2>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {docs.map(doc => (
                    <li key={doc.id} style={{ margin: '10px 0', border: '1px solid #ccc', padding: '10px' }}>
                        <strong>{doc.id}</strong> - {doc.clients} users connected - {doc.length} characters
                        <button onClick={() => navigate(`/${doc.id}`)} style={{ marginLeft: '10px' }}>
                            Join
                        </button>
                    </li>
                ))}
                {docs.length === 0 && <p>No documents yet.</p>}
            </ul>
        </div>
    );
}
