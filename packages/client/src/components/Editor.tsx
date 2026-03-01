import { useEffect, useRef, useState, useCallback } from 'react';
import MonacoEditor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useCrdt } from '../hooks/useCrdt';
import { useWebSocket } from '../hooks/useWebSocket';
import type { InsertOp, DeleteOp } from '@crdts/crdt-core';

export function Editor({ docId, siteId }: { docId: string, siteId: string }) {
    const { text, localInsert, localDelete, applyRemote, initFromSequence } = useCrdt(siteId);
    const [cursors, setCursors] = useState<Record<string, { lineNumber: number, column: number }>>({});

    const handleCursor = useCallback((msg: { siteId: string, position: { lineNumber: number, column: number } }) => {
        setCursors(prev => ({ ...prev, [msg.siteId]: msg.position }));
    }, []);

    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const isApplyingRemote = useRef(false);
    const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);

    const handleRemoteOp = useCallback((op: InsertOp | DeleteOp) => {
        const events = applyRemote(op);
        const editor = editorRef.current;
        if (!editor || events.length === 0) return;
        const model = editor.getModel();
        if (!model) return;

        isApplyingRemote.current = true;
        const edits = events.map(event => {
            if (event.type === 'insert') {
                const pos = model.getPositionAt(event.index);
                return {
                    range: { startLineNumber: pos.lineNumber, startColumn: pos.column, endLineNumber: pos.lineNumber, endColumn: pos.column },
                    text: event.value,
                    forceMoveMarkers: true
                };
            } else {
                const startPos = model.getPositionAt(event.index);
                const endPos = model.getPositionAt(event.index + 1);
                return {
                    range: { startLineNumber: startPos.lineNumber, startColumn: startPos.column, endLineNumber: endPos.lineNumber, endColumn: endPos.column },
                    text: ''
                };
            }
        });

        editor.executeEdits('remote', edits);
        isApplyingRemote.current = false;
    }, [applyRemote]);

    const { connected, sendOp } = useWebSocket(docId, handleRemoteOp, initFromSequence, handleCursor);

    const handleEditorMount: OnMount = (editorInstance) => {
        editorRef.current = editorInstance;

        editorInstance.onDidChangeCursorPosition((e) => {
            sendOp({
                type: 'cursor',
                siteId,
                position: e.position
            });
        });
    };

    const handleEditorChange = (_value: string | undefined, ev: editor.IModelContentChangedEvent) => {
        if (isApplyingRemote.current) return;

        for (const change of ev.changes) {
            const index = change.rangeOffset;
            const textAdded = change.text;
            const lengthDeleted = change.rangeLength;

            for (let i = 0; i < lengthDeleted; i++) {
                const op = localDelete(index);
                if (op) sendOp(op);
            }

            for (let i = 0; i < textAdded.length; i++) {
                const char = textAdded[i];
                const op = localInsert(index + i, char);
                if (op) sendOp(op);
            }
        }
    };

    useEffect(() => {
        // Initial load sync only
        const editor = editorRef.current;
        if (editor && editor.getValue() === '' && text !== '') {
            isApplyingRemote.current = true;
            editor.setValue(text);
            isApplyingRemote.current = false;
        }
    }, [text]);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        if (!decorationsRef.current) {
            decorationsRef.current = editor.createDecorationsCollection();
        }

        const newDecorations = Object.entries(cursors)
            .filter(([id]) => id !== siteId)
            .map(([id, pos]) => ({
                range: {
                    startLineNumber: pos.lineNumber,
                    startColumn: pos.column,
                    endLineNumber: pos.lineNumber,
                    endColumn: pos.column,
                },
                options: {
                    className: 'remote-cursor',
                    hoverMessage: { value: `User: ${id}` },
                }
            }));

        decorationsRef.current.set(newDecorations);
    }, [cursors, siteId]);

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px', background: '#333', color: 'white', display: 'flex', gap: '1rem' }}>
                <span>Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}</span>
                <span>Document: {docId}</span>
                <span>User ID: {siteId}</span>
                <span style={{ marginLeft: 'auto' }}>
                    Other users: {Object.keys(cursors).filter(id => id !== siteId).join(', ') || 'None'}
                </span>
            </div>
            <div style={{ flex: 1 }}>
                <MonacoEditor
                    height="100%"
                    defaultLanguage="markdown"
                    theme="vs-dark"
                    onMount={handleEditorMount}
                    onChange={handleEditorChange}
                />
            </div>
        </div>
    );
}
