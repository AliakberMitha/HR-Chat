import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import ChatPage from "./pages/ChatPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
