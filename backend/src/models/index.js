import Unit from './Unit.js';
import Department from './Department.js';
import Position from './Position.js';
import Employee from './Employee.js';
import Profile, { ROLES } from './Profile.js';
import DocumentType from './DocumentType.js';
import DocCodeDepartment from './DocCodeDepartment.js';
import Counter from './Counter.js';
import Project from './Project.js';
import DocumentModel from './Document.js';

export {
  Unit,
  Department,
  Position,
  Employee,
  Profile,
  ROLES,
  DocumentType,
  DocCodeDepartment,
  Counter,
  Project,
  DocumentModel as Document,
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
];

/** Build all declared indexes (collation/compound/unique). Call once at boot. */
export async function syncIndexes() {
  for (const model of ALL) {
    await model.syncIndexes();
  }
}
