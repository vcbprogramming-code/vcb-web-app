import { useParams } from 'react-router-dom';
import DepartmentLanding from './DepartmentLanding.jsx';
import PhasePage from './PhasePage.jsx';

// React Router cannot match two different dynamic routes at the same path
// depth (both "/:deptSlug" and "/:deptPrefix-:dayRange" for "/finance-team"
// vs "/finance-day-1-30") — so rather than fighting the router, this resolves
// both cases from ONE param, using the same key-shape convention the original
// app's PAGES object already relies on: a page key either ends in "-team" or
// matches "<dept>-day-<range>".
//
// property-asset-management is the one landing key that breaks the "-team"
// pattern, so it is named explicitly. Same reason ALL_DEPARTMENTS spells
// landingPageKey out per department instead of deriving it.

export default function PageResolver() {
  const { pageKey } = useParams();

  if (pageKey?.endsWith('-team') || pageKey === 'property-asset-management') {
    return <DepartmentLanding />;
  }

  return <PhasePage />;
}
