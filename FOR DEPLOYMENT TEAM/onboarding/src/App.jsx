import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import RequiredDocuments from './pages/RequiredDocuments.jsx';
import CompletionPage from './pages/CompletionPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import OrgChartPage from './pages/OrgChartPage.jsx';
import MeetOurTeamPage from './pages/MeetOurTeamPage.jsx';
import LifeOnSitePage from './pages/LifeOnSitePage.jsx';
import PageResolver from './pages/PageResolver.jsx';

// React Router 6. These are the same routes the module already had — <Routes>
// with a layout route and nested children is v6 syntax and is unchanged in
// v7, so the downgrade needed nothing here. What v7 added that this module
// never used were the data-router APIs (createBrowserRouter, loaders,
// actions); had any been present they would have had to come out.
//
// App.css is gone: everything it styled is a Tailwind utility in the JSX now,
// and the handful of rules Tailwind cannot express live in index.css.

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/required-documents" element={<RequiredDocuments />} />
        <Route path="/completion" element={<CompletionPage />} />
        <Route path="/company-structure" element={<OrgChartPage />} />
        {/* Both must stay above /:pageKey, which is a catch-all and would
            otherwise swallow them into the department resolver. */}
        <Route path="/meet-our-team" element={<MeetOurTeamPage />} />
        <Route path="/life-on-site" element={<LifeOnSitePage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/:pageKey" element={<PageResolver />} />
      </Route>
    </Routes>
  );
}
