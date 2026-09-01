import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { RequiredDocuments } from "./pages/RequiredDocuments";
import { CompletionPage } from "./pages/CompletionPage";
import { AdminPage } from "./pages/AdminPage";
import { OrgChartPage } from "./pages/OrgChartPage";
import { PageResolver } from "./pages/PageResolver";
import "./App.css";
import "./components/orgchart/orgchart.css";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/required-documents" element={<RequiredDocuments />} />
        <Route path="/completion" element={<CompletionPage />} />
        <Route path="/company-structure" element={<OrgChartPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/:pageKey" element={<PageResolver />} />
      </Route>
    </Routes>
  );
}

export default App;
