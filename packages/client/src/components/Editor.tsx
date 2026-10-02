import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import { ArrowLeft, Loader2, PlugZap, Users, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCrdt, type RemoteCursor, type ViewEdit } from '../hooks/useCrdt';

const CURSOR_COLORS = ['orange', 'cyan', 'violet', 'lime', 'rose', 'amber'];
const MONACO_THEME = 'crdts-doc';

interface EditorProps {
    docId: string;
    siteId: string;
}

export function Editor({ docId, siteId }: EditorProps) {
    const navigate = useNavigate();

    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
    const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
    const decorationIdsRef = useRef<string[]>([]);
    const isApplyingRemoteRef = useRef(false);

    const [showOfflineHint, setShowOfflineHint] = useState(false);

    // Remote edits are applied to Monaco imperatively, so the view is kept in sync
    // without ever re-rendering the editor from React state.
    const handleViewEdit = useCallback((edits: ViewEdit[]) => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco) return;

        isApplyingRemoteRef.current = true;
        try {
            const model = editor.getModel();
            if (!model) return;

            if (edits.length === 1 && edits[0].type === 'replace') {
                model.setValue(edits[0].value);
                return;
            }

            const ranges: Parameters<typeof editor.executeEdits>[1] = [];
            for (const edit of edits) {
                if (edit.type === 'insert') {
                    ranges.push({
                        range: new monaco.Range(1, edit.index + 1, 1, edit.index + 1),
                        text: edit.value,
                        forceMoveMarkers: true
                    });
                } else if (edit.type === 'delete') {
                    ranges.push({
                        range: new monaco.Range(1, edit.index + 1, 1, edit.index + 2),
                        text: '',
                        forceMoveMarkers: true
                    });
                }
            }

            editor.executeEdits('crdt-remote', ranges);
        } finally {
            isApplyingRemoteRef.current = false;
        }
    }, []);

    const { ready, text, remoteCursors, peers, applyLocalText, broadcastCursor } = useCrdt(
        docId,
        siteId,
        handleViewEdit
    );

    const broadcastCursorRef = useRef(broadcastCursor);
    useEffect(() => {
        broadcastCursorRef.current = broadcastCursor;
    }, [broadcastCursor]);

    const handleMount = useCallback<OnMount>((editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;

        monaco.editor.defineTheme(MONACO_THEME, {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#16161d',
                'editorLineNumber.foreground': '#4b4b5a',
                'editorGutter.background': '#16161d'
            }
        });
        monaco.editor.setTheme(MONACO_THEME);

        editor.onDidChangeCursorPosition((event) => {
            broadcastCursorRef.current(event.position.lineNumber, event.position.column);
        });
    }, []);

    // Editing is disabled until the initial sync lands, so `defaultValue` alone is safe.
    useEffect(() => {
        editorRef.current?.updateOptions({ readOnly: !ready });
    }, [ready]);

    // Render every remote cursor as a labeled inline decoration.
    useEffect(() => {
        const monaco = monacoRef.current;
        const editor = editorRef.current;
        if (!monaco || !editor) return;

        decorationIdsRef.current = editor.deltaDecorations(
            decorationIdsRef.current,
            remoteCursors.map((cursor: RemoteCursor) => {
                const line = Math.min(Math.max(cursor.line, 1), editor.getModel()?.getLineCount() ?? 1);
                const maxColumn = editor.getModel()?.getLineMaxColumn(line) ?? 1;
                const column = Math.min(Math.max(cursor.column, 1), maxColumn);
                const color = CURSOR_COLORS[colorIndex(cursor.siteId)];

                return {
                    range: new monaco.Range(line, column, line, column),
                    options: {
                        stickiness: 1,
                        className: `remote-caret remote-caret-${color}`,
                        beforeContentClassName: `remote-caret-line remote-caret-line-${color}`,
                        after: {
                            content: ` ${cursor.name}`,
                            inlineClassName: `remote-caret-label remote-caret-label-${color}`
                        },
                        hoverMessage: { value: `**${cursor.name}**` }
                    }
                };
            })
        );
    }, [remoteCursors]);

    const connectionLabel = useMemo(() => {
        if (!ready) return 'Syncing with server…';
        return 'Live';
    }, [ready]);

    // The socket retries on its own, so surface a hint instead of an endless spinner.
    useEffect(() => {
        if (ready) {
            setShowOfflineHint(false);
            return;
        }
        const timer = setTimeout(() => setShowOfflineHint(true), 6000);
        return () => clearTimeout(timer);
    }, [ready]);

    return (
        <div className="editor-page">
            <header className="editor-header">
                <button className="ghost-button" onClick={() => navigate('/')}>
                    <ArrowLeft size={16} />
                    Documents
                </button>

                <div className="editor-title">
                    <h1>{docId}</h1>
                    <span className="editor-subtitle">
                        {connectionLabel} · {text.length} characters
                    </span>
                </div>

                <div className="editor-status">
                    <span className="status-pill" data-ready={ready}>
                        {ready ? <Wifi size={14} /> : <WifiOff size={14} />}
                        {connectionLabel}
                    </span>
                    <span className="status-pill">
                        <Users size={14} />
                        {peers.length} online
                    </span>
                </div>
            </header>

            <div className="editor-surface">
                {!ready && (
                    <div className="editor-overlay">
                        <Loader2 className="spin" size={22} />
                        <span>Loading document…</span>
                    </div>
                )}

                {showOfflineHint && (
                    <div className="editor-overlay editor-overlay-hint">
                        <PlugZap size={22} />
                        <span>
                            Still waiting for the relay server. Start it with{' '}
                            <code>npm run dev --workspace=packages/server</code>.
                        </span>
                    </div>
                )}

                <MonacoEditor
                    height="100%"
                    defaultLanguage="plaintext"
                    defaultValue=""
                    theme={MONACO_THEME}
                    onMount={handleMount}
                    onChange={(value) => {
                        if (isApplyingRemoteRef.current) return;
                        applyLocalText(value ?? '');
                    }}
                    loading={<span className="editor-loading">Loading editor…</span>}
                    options={{
                        fontSize: 15,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        minimap: { enabled: false },
                        automaticLayout: true,
                        padding: { top: 18, bottom: 18 },
                        scrollBeyondLastLine: false,
                        renderWhitespace: 'selection',
                        wordWrap: 'on',
                        cursorBlinking: 'smooth',
                        smoothScrolling: true,
                        overviewRulerLanes: 0,
                        renderLineHighlight: 'none'
                    }}
                />
            </div>

            <footer className="editor-footer">
                <span>You are editing as {siteId}</span>
                <span>Every keystroke is a CRDT operation broadcast to this room.</span>
            </footer>
        </div>
    );
}

function colorIndex(siteId: string): number {
    let hash = 0;
    for (let i = 0; i < siteId.length; i++) {
        hash = (hash * 33 + siteId.charCodeAt(i)) >>> 0;
    }
    return hash % CURSOR_COLORS.length;
}
