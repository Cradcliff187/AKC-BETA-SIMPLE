// Config.gs

const CONFIG = {
  // === Main Spreadsheet ID ===
  SPREADSHEET_ID: "1eSwZwz5uPGPVyHkXAt8TFQuS4fLAOqeX5b-PvhK2Ghg",

  // === Sheet Names ===
  SHEETS: {
    PROJECTS: "Projects",
    TIME_LOGS: "TimeLogs",
    MATERIALS_RECEIPTS: "MaterialsReceipts",
    SUBCONTRACTORS: "Subcontractors",
    SUBINVOICES: "Subinvoices",
    ESTIMATES: "Estimates",
    CUSTOMERS: "Customers",
    ACTIVITY_LOG: "ActivityLog",
    VENDORS: "Vendors"
  },

  // === Templates / Estimate Document References ===
  TEMPLATES: {
    ESTIMATE: {
      // Folder containing your main estimate template doc (if used)
      FOLDER_ID: "1whTNqMixlToIAzT4ZSqwH4c8b-PUxFoM",

      // The doc ID of your estimate template (used in generateEstimateDocument)
      TEMPLATE_DOC_ID: "1MiidTh2kRqm78tZRTijA1XyIjE9-wNv3ussHknB6Muc",

      // Prefix used when generating PDF file names (e.g. "EST-12345.pdf")
      FILE_NAME_PREFIX: "EST-"
    }
  },

  // === Folder Structure ===
  FOLDERS: {
    PARENT_ID: "0AFEjkvrWgRIaUk9PVA"
  },

  // === Dynamic Customer Year ===
  CURRENT_CUSTOMER_YEAR: new Date().getFullYear().toString()
};


// === Status Constants ===
const PROJECT_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED'
};

const ESTIMATE_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED'
};

// Define valid status transitions
const STATUS_TRANSITIONS = {
  PROJECT: {
    [PROJECT_STATUSES.PENDING]: [PROJECT_STATUSES.APPROVED, PROJECT_STATUSES.CANCELLED],
    [PROJECT_STATUSES.APPROVED]: [PROJECT_STATUSES.IN_PROGRESS, PROJECT_STATUSES.CANCELLED],
    [PROJECT_STATUSES.IN_PROGRESS]: [PROJECT_STATUSES.COMPLETED, PROJECT_STATUSES.CANCELLED],
    [PROJECT_STATUSES.COMPLETED]: [PROJECT_STATUSES.CLOSED],
    [PROJECT_STATUSES.CANCELLED]: [],
    [PROJECT_STATUSES.CLOSED]: []
  },
  ESTIMATE: {
    [ESTIMATE_STATUSES.PENDING]: [ESTIMATE_STATUSES.APPROVED, ESTIMATE_STATUSES.REJECTED, ESTIMATE_STATUSES.CANCELLED],
    [ESTIMATE_STATUSES.APPROVED]: [ESTIMATE_STATUSES.COMPLETED, ESTIMATE_STATUSES.CANCELLED],
    [ESTIMATE_STATUSES.REJECTED]: [ESTIMATE_STATUSES.PENDING, ESTIMATE_STATUSES.CANCELLED],
    [ESTIMATE_STATUSES.COMPLETED]: [ESTIMATE_STATUSES.CLOSED],
    [ESTIMATE_STATUSES.CANCELLED]: [],
    [ESTIMATE_STATUSES.CLOSED]: []
  }
};

// Statuses that allow module access (e.g., time logging, materials, etc.)
const MODULE_ACCESS_STATUSES = [PROJECT_STATUSES.APPROVED, PROJECT_STATUSES.IN_PROGRESS];

// Customer Status Constants
const CUSTOMER_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  PENDING: 'PENDING',
  ARCHIVED: 'ARCHIVED'
};