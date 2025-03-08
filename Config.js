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
  PENDING: 'PENDING',      // Initial state
  APPROVED: 'APPROVED',    // Estimate is approved
  REJECTED: 'REJECTED',    // Estimate is rejected
  CANCELED: 'CANCELED',    // Estimate is canceled
  COMPLETED: 'COMPLETED',  // Work completed
  CLOSED: 'CLOSED'        // Final state
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
    [ESTIMATE_STATUSES.PENDING]: [
      ESTIMATE_STATUSES.APPROVED,
      ESTIMATE_STATUSES.REJECTED,
      ESTIMATE_STATUSES.CANCELED
    ],
    [ESTIMATE_STATUSES.APPROVED]: [
      ESTIMATE_STATUSES.COMPLETED,
      ESTIMATE_STATUSES.CANCELED
    ],
    [ESTIMATE_STATUSES.REJECTED]: [
      ESTIMATE_STATUSES.PENDING,
      ESTIMATE_STATUSES.CANCELED
    ],
    [ESTIMATE_STATUSES.COMPLETED]: [
      ESTIMATE_STATUSES.CLOSED
    ],
    [ESTIMATE_STATUSES.CANCELED]: [],  // No further transitions
    [ESTIMATE_STATUSES.CLOSED]: []     // No further transitions
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

// US States for dropdown options
const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' }
];

// Update getClientConstants to include all needed constants
function getClientConstants() {
  return {
    PROJECT_STATUSES,
    ESTIMATE_STATUSES,
    STATUS_TRANSITIONS,
    VENDOR_STATUSES,
    CUSTOMER_STATUSES,
    MODULE_ACCESS_STATUSES,
    US_STATES,
    VENDOR_TYPES
  };
}
