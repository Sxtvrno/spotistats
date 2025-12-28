import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {/* Future pages:
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<Settings />} />
        */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
