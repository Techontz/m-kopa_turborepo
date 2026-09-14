/**
 * Shared types for the Customer module (API contract: CUSTOMER_MODULE_IMPLEMENTATION §3 and §6, camelCase).
 */

export type FieldType = "text" | "textarea" | "number" | "currency" | "date" | "select" | "boolean";

/** One Step 2 question: a customer type's configured field or a standard field. */
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  dataSource?: string;
  dependsOn?: string;
  requiredWhen?: { field: string; equals: string[] };
  storesIn?: string;
  fullWidth?: boolean;
  placeholder?: string;
  helpText?: string;
  origin?: "configured" | "standard";
}

export type Sector = "employment" | "business" | "other";

/** Customer Type resource (API: GET /customer-types; stored in the customer_categories table). */
export interface CustomerType {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  formTitle?: string | null;
  isActive: boolean;
  sortOrder: number;
  riskTier?: string | null;
  sector: Sector | null;
  requiredDocuments?: string[];
  optionalDocuments?: string[];
  requiresSector?: boolean;
  requiresEmployer?: boolean;
  requiresContract?: boolean;
  requiresSalary?: boolean;
  dynamicFormSchema: FieldDef[] | null;
  omittedStandardFields: string[] | null;
  requiresExtraApproval?: boolean;
  customerCount?: number;
  deletedAt?: string | null;
}

/** Requirement profile as returned by GET /registration/requirements. */
export interface RequirementProfile {
  accountTypeId: number | null;
  accountTypeName?: string | null;
  customerCategoryId?: number | null;
  isDefault?: boolean;
  requiresEmploymentDetails: boolean;
  requiresBusinessDetails: boolean;
  requiresBankAccount: boolean;
  requiresCardDetails: boolean;
  minGuarantors: number;
  minNextOfKin: number;
  requiresCustomerCategory: boolean;
  requiresMaritalStatus: boolean;
  requiresAddress: boolean;
  requiresIdentityDocument: boolean;
  requiresCategoryDocuments: boolean;
  categoryDocumentsEnforcedFrom?: string | null;
  requiresFaceVerification: boolean;
  requiresNidaVerification: boolean;
  requiresOtpVerification: boolean;
  guidance: string | null;
}

export interface MasterRow {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  parentId?: number | null;
}

export type MasterData = Record<string, MasterRow[]>;

export interface GeoRow {
  id: number;
  name: string;
}

export interface RegistrationOptions {
  branches: Array<{ id: number; name: string }>;
  lockedBranchId: number | null;
  officers: Array<{ id: number; name: string; branchId: number | null }>;
  currentEmployeeId: number;
  canAssignOfficer: boolean;
}

export interface DraftResource {
  id: number;
  label: string;
  phone: string | null;
  step: number;
  branchId: number;
  createdById: number;
  createdByName: string | null;
  branchName?: string | null;
  isOwn?: boolean;
  customerId: number | null;
  submittedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  payload?: unknown;
}

export interface NextOfKinResource {
  id: number;
  name: string;
  relationship: string | null;
  phone: string | null;
  address: string | null;
}

export interface GuarantorResource {
  id: number;
  name: string;
  phone: string | null;
  nidaNumber: string | null;
  relationship: string | null;
  address: string | null;
  occupation: string | null;
}

export interface DocumentResource {
  id: number;
  customerId: number;
  documentType: string;
  filePath?: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: number | string | null;
  uploadedByName?: string | null;
  createdAt: string | null;
  downloadUrl?: string;
}

export type ScanCheckName =
  | "oneFaceDetected"
  | "eyesOpen"
  | "centered"
  | "correctDistance"
  | "goodLighting"
  | "sharpImage"
  | "poseStraight"
  | "poseLeft"
  | "poseRight"
  | "poseUp"
  | "poseDown";

export interface FaceScanResource {
  id: number;
  customerId: number;
  status: "passed" | "failed";
  qualityScore: number;
  brightnessScore: number;
  blurScore: number;
  distanceScore: number;
  centeringScore: number;
  eyesOpenScore: number;
  scannerVersion: string;
  livenessPassed: boolean;
  poseSequenceCompleted: boolean;
  checks: Partial<Record<ScanCheckName, boolean>>;
  captureDevice: string | null;
  captureResolution: string | null;
  captureDurationMs: number | null;
  reason: string | null;
  scannedById: number | null;
  scannedByName: string | null;
  scannedAt: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  isActive: boolean;
  imageUrl: string | null;
}

/** Customer resource (§6). Every captured value round-trips. */
export interface Customer {
  id: number;
  customerNumber: string | null;
  customerCode?: string | null;
  age?: number | null;
  nidaNumber: string | null;
  idTypeId: number | null;
  idTypeName: string | null;
  idNumber: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  dob: string | null;
  gender: string | null;
  phone: string;
  photoPath: string | null;
  photoUrl?: string | null;
  nidaVerifiedAt: string | null;
  otpVerifiedAt: string | null;
  faceVerifiedAt: string | null;
  faceScanId: number | null;
  faceScanStatus: string | null;
  faceScanQuality: number | null;
  faceScanVersion: string | null;
  faceScannedAt: string | null;
  faceScannedById: number | null;
  faceScannedByName: string | null;
  maritalStatus: string | null;
  maritalStatusId: number | null;
  maritalStatusName?: string | null;
  regionId: number | null;
  regionName?: string | null;
  districtId: number | null;
  districtName?: string | null;
  wardId: number | null;
  streetId: number | null;
  wardName: string | null;
  streetName: string | null;
  residenceType: string | null;
  alternativePhone: string | null;
  email: string | null;
  nationality: string | null;
  nationalIdNumber: string | null;
  tinNumber: string | null;
  passportNumber: string | null;
  voterIdNumber: string | null;
  driverLicenceNumber: string | null;
  workIdNumber: string | null;
  village: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  landmark: string | null;
  occupation: string | null;
  employer: string | null;
  monthlyIncome: number | null;
  employmentType: string | null;
  workType: string | null;
  placeOfEmployment: string | null;
  retirementDate: string | null;
  dependentsCount: number | null;
  basicSalary: number | null;
  takeHome: number | null;
  checkNumber: string | null;
  department: string | null;
  councilNumber: string | null;
  businessName: string | null;
  businessType: string | null;
  businessAddress: string | null;
  bankName: string | null;
  bankBranch: string | null;
  accountName: string | null;
  accountNumber: string | null;
  bankId: number | null;
  mobileMoneyProvider: string | null;
  mobileMoneyProviderId: number | null;
  walletNumber: string | null;
  paymentMethod: "mno" | "bank" | null;
  cardLastFour: string | null;
  customerCategoryId: number | null;
  categoryName: string | null;
  dynamicFormData: Record<string, unknown>;
  branchId: number;
  branchName: string | null;
  employeeId: number | null;
  employeeName?: string | null;
  registrationSource: string | null;
  kycStatus: "incomplete" | "completed" | string;
  status: string | null;
  loanStatus?: string | null;
  statusReason: string | null;
  statusRemarks: string | null;
  statusChangedAt: string | null;
  approvalStatus: "not_required" | "pending" | "approved" | "rejected" | string;
  approvedBy: number | string | null;
  approvedByName?: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdBy: number | string | null;
  createdByName?: string | null;
  createdAt: string | null;
  deletedAt: string | null;
  isMarked?: boolean;
  documents?: DocumentResource[];
  bankDetails?: { bankName: string | null; accountNumber: string | null; accountName: string | null; phoneNumber: string | null; checkNumber: string | null } | null;
  nextOfKin?: NextOfKinResource[];
  guarantors?: GuarantorResource[];
  documentsCount?: number;
  notesCount?: number;
  guarantorsCount?: number;
  nextOfKinCount?: number;
  groupId?: number | null;
  groupName?: string | null;
}

export interface PageMeta {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}
