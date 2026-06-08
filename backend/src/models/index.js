import Unit from './Unit.js';
import Department from './Department.js';
import Position from './Position.js';
import Employee, { EMPLOYEE_KINDS } from './Employee.js';
import Profile, { ROLES } from './Profile.js';
import DocumentType from './DocumentType.js';
import DocCodeDepartment from './DocCodeDepartment.js';
import Counter from './Counter.js';
import Project from './Project.js';
import DocumentModel from './Document.js';
// Module 2 — Performance / OT
import WorkType from './WorkType.js';
import WorkLog from './WorkLog.js';
// Module 3 — Credit Facility
import Facility from './Facility.js';
import CreditLedger from './CreditLedger.js';
import CreditRequest from './CreditRequest.js';
import CashPlan from './CashPlan.js';
import CreditAudit from './CreditAudit.js';
// Module 4 — Onboarding
import OnboardingResource from './OnboardingResource.js';
import OnboardingPlanTemplate from './OnboardingPlanTemplate.js';
import NewHireJourney from './NewHireJourney.js';

export {
  Unit,
  Department,
  Position,
  Employee,
  EMPLOYEE_KINDS,
  Profile,
  ROLES,
  DocumentType,
  DocCodeDepartment,
  Counter,
  Project,
  DocumentModel as Document,
  WorkType,
  WorkLog,
  Facility,
  CreditLedger,
  CreditRequest,
  CashPlan,
  CreditAudit,
  OnboardingResource,
  OnboardingPlanTemplate,
  NewHireJourney,
};

const ALL = [
  Unit,
  Department,
  Position,
  Employee,
  Profile,
  DocumentType,
  DocCodeDepartment,
  Counter,
  Project,
  DocumentModel,
  WorkType,
  WorkLog,
  Facility,
  CreditLedger,
  CreditRequest,
  CashPlan,
  CreditAudit,
  OnboardingResource,
  OnboardingPlanTemplate,
  NewHireJourney,
];

/** Build all declared indexes (collation/compound/unique). Call once at boot. */
export async function syncIndexes() {
  for (const model of ALL) {
    await model.syncIndexes();
  }
}
