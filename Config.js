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
  CURRENT_CUSTOMER_YEAR: new Date().getFullYear().toString().slice(-2)  // Changed to 2-digit year
};


// === Status Constants ===
const PROJECT_STATUSES = {
  PENDING: 'PENDING',      // Initial state when project is created
  APPROVED: 'APPROVED',    // Project is approved but work hasn't started
  IN_PROGRESS: 'IN_PROGRESS', // Work is actively being done
  COMPLETED: 'COMPLETED',  // Work is finished
  CANCELED: 'CANCELED'     // Project was canceled
};

const ESTIMATE_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED'
};

// Update vendor statuses to only have ACTIVE and INACTIVE
const VENDOR_STATUSES = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE'
};

// Define valid status transitions
const STATUS_TRANSITIONS = {
  PROJECT: {
    [PROJECT_STATUSES.PENDING]: [PROJECT_STATUSES.APPROVED, PROJECT_STATUSES.CANCELED],
    [PROJECT_STATUSES.APPROVED]: [PROJECT_STATUSES.IN_PROGRESS, PROJECT_STATUSES.CANCELED],
    [PROJECT_STATUSES.IN_PROGRESS]: [PROJECT_STATUSES.COMPLETED, PROJECT_STATUSES.CANCELED],
    [PROJECT_STATUSES.COMPLETED]: [PROJECT_STATUSES.CLOSED],
    [PROJECT_STATUSES.CANCELED]: [],
    [PROJECT_STATUSES.CLOSED]: []
  },
  ESTIMATE: {
    [ESTIMATE_STATUSES.PENDING]: [ESTIMATE_STATUSES.APPROVED, ESTIMATE_STATUSES.REJECTED, ESTIMATE_STATUSES.CANCELED],
    [ESTIMATE_STATUSES.APPROVED]: [ESTIMATE_STATUSES.COMPLETED, ESTIMATE_STATUSES.CANCELED],
    [ESTIMATE_STATUSES.REJECTED]: [ESTIMATE_STATUSES.PENDING, ESTIMATE_STATUSES.CANCELED],
    [ESTIMATE_STATUSES.COMPLETED]: [ESTIMATE_STATUSES.CLOSED],
    [ESTIMATE_STATUSES.CANCELED]: [],
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

// Add vendor type constants after CUSTOMER_STATUSES
const VENDOR_TYPES = {
  VENDOR: 'Vend',
  SUBCONTRACTOR: 'Sub'
};