/**************************************
 * Utils.gs - Standardized Utility Functions
 **************************************/

function createStandardResponse(success, data = null, error = null) {
  if (success) {
    return {
      success: true,
      data: data
    };
  } else {
    return {
      success: false,
      error: error instanceof Error ? error.message : error
    };
  }
}

function handleError(error, context) {
  Logger.log(`Error in ${context}: ${error.message}`);
  Logger.log(`Stack: ${error.stack}`);
  return createStandardResponse(false, null, error);
}

function validateRequiredFields(data, requiredFields) {
  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Missing required fields: ${missingFields.join(', ')}`
    };
  }

  return { valid: true };
}

function logSystemActivity(action, moduleType, referenceId, details = {}) {
  try {
    const userEmail = Session.getActiveUser().getEmail();
    const result = logActivity({
      action,
      moduleType,
      referenceId,
      userEmail,
      details,
      timestamp: new Date()
    });
    return createStandardResponse(true, result);
  } catch (error) {
    return handleError(error, 'logSystemActivity');
  }
}

function validateFileSize(size, maxSize = 10 * 1024 * 1024) { // Default 10MB
  if (size > maxSize) {
    return {
      valid: false,
      error: `File size (${(size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${maxSize / 1024 / 1024}MB)`
    };
  }
  return { valid: true };
}

function validateFileType(mimeType, allowedTypes) {
  if (!allowedTypes.includes(mimeType)) {
    return {
      valid: false,
      error: `File type ${mimeType} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
    };
  }
  return { valid: true };
}

function formatDate(date, format = 'short') {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  switch (format) {
    case 'short':
      return Utilities.formatDate(date, Session.getScriptTimeZone(), 'MM/dd/yyyy');
    case 'long':
      return Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMMM dd, yyyy');
    case 'iso':
      return date.toISOString();
    default:
      return date.toLocaleDateString();
  }
}

/**
 * Standardized currency formatting
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// Add this to utils.gs
function getTodayDate() {
  const today = new Date();
  // Format: YYYY-MM-DD
  return Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function validateStatusTransition(oldStatus, newStatus, type) {
  Logger.log(`Validating transition: ${type} ${oldStatus} -> ${newStatus}`);
  
  const transitions = STATUS_TRANSITIONS[type];
  if (!transitions) {
    throw new Error(`Invalid status type: ${type}`);
  }

  // Handle empty/null old status (treat as initial state)
  if (!oldStatus) {
    // For new records, allow setting to initial states
    const validInitialStates = type === 'PROJECT' ? 
      [PROJECT_STATUSES.PENDING] : 
      [ESTIMATE_STATUSES.DRAFT];
      
    if (!validInitialStates.includes(newStatus)) {
      throw new Error(`Invalid initial status: ${newStatus}`);
    }
    return true;
  }

  const allowedTransitions = transitions[oldStatus];
  if (!allowedTransitions) {
    throw new Error(`Invalid current status: ${oldStatus}`);
  }

  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(`Invalid status transition from ${oldStatus} to ${newStatus}`);
  }

  return true;
}

/**
 * Formats a phone number to (XXX) XXX-XXXX pattern
 * @param {string} phone - Raw phone number input
 * @returns {string} Formatted phone number
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  const cleaned = phone.toString().replace(/\D/g, '');
  
  // Check if we have a 10-digit number
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
  }
  
  // Return original if not 10 digits
  return phone;
}

// Add to Utils.js
function handleComponentError(error, context, showMessage) {
  console.error(`Error in ${context}:`, error);
  showMessage(error.message || `Error in ${context}`, 'error');
  return {
    success: false,
    error: error.message || `Error in ${context}`
  };
}