import { useParams } from "react-router-dom";
import { DepartmentLanding } from "./DepartmentLanding";
import { PhasePage } from "./PhasePage";

// React Router can't match two different dynamic routes at the same path
// depth (e.g. both "/:deptSlug" and "/:deptPrefix-:dayRange" for
// "/finance-team" vs "/finance-day-1-30") — so instead of fighting the
// router, this resolves both cases from ONE param and renders the right
// page, using the same key-shape convention the original app's PAGES
// object already relies on (a page key either ends in "-team" or matches
// "<dept>-day-<range>").
export function PageResolver() {
  const { pageKey } = useParams<{ pageKey: string }>();

  if (pageKey?.endsWith("-team") || pageKey === "property-asset-management") {
    return <DepartmentLanding />;
  }

  return <PhasePage />;
}
