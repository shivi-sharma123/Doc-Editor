import { useState } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { DocumentList } from './components/DocumentList';
import { Editor } from './components/Editor';

function EditorRoute() {
  const { id } = useParams();

  const [siteId] = useState(() => Math.random().toString(36).substring(2, 9));

  if (!id) return null;
  return <Editor docId={id} siteId={siteId} />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DocumentList />} />
        <Route path="/:id" element={<EditorRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
