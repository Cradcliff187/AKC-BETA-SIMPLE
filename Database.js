/**************************************
 * Database.gs - Data Access Layer
 **************************************/

// ==========================================
// PROJECT FUNCTIONS
// ==========================================
function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  if (!sheet) throw new Error(`${sheetName} sheet not found`);
  const data = sheet.getDataRange().getValues();
  if (!data || data.length === 0) throw new Error(`No data found in ${sheetName} sheet`);
  return { sheet, headers: data[0], rows: data.slice(1) };
}

function getSheet(sheetName) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return spreadsheet.getSheetByName(sheetName);
}

function getActiveProjects() {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.PROJECTS);

  const projectIdCol = headers.indexOf("ProjectID");
  const projectNameCol = headers.indexOf("ProjectName");
  const statusCol = headers.indexOf("Status");
  const customerNameCol = headers.indexOf("CustomerName");
  const folderIdCol = headers.indexOf("FolderID");
  const jobIdCol = headers.indexOf("JobID");
  const estimatesFolderCol = headers.indexOf("EstimatesFolderID");
  const materialsFolderCol = headers.indexOf("MaterialsFolderID");
  const subInvoicesFolderCol = headers.indexOf("SubInvoicesFolderID");
  const docUrlCol = headers.indexOf("DocUrl");
  const jobDescriptionCol = headers.indexOf("JobDescription");
  const siteLocationAddressCol = headers.indexOf("SiteLocationAddress");
  const siteLocationCityCol = headers.indexOf("SiteLocationCity");
  const siteLocationStateCol = headers.indexOf("SiteLocationState");
  const siteLocationZipCol = headers.indexOf("SiteLocationZip");

  return rows.map(row => ({
    id: row[projectIdCol],
    projectId: row[projectIdCol],
    name: row[projectNameCol],
    status: row[statusCol],
    jobId: row[jobIdCol] || '',
    folderId: row[folderIdCol],
    estimatesFolderId: row[estimatesFolderCol],
    materialsFolderId: row[materialsFolderCol],
    subInvoicesFolderId: row[subInvoicesFolderCol],
    docUrl: row[docUrlCol] || `https://drive.google.com/drive/folders/${row[folderIdCol]}`,
    customerName: row[customerNameCol] || '',
    jobDescription: row[jobDescriptionCol] || '',
    siteLocationAddress: row[siteLocationAddressCol] || '',
    siteLocationCity: row[siteLocationCityCol] || '',
    siteLocationState: row[siteLocationStateCol] || '',
    siteLocationZip: row[siteLocationZipCol] || ''
  }));
}

function createProjectRecord(data) {
  const sheet = getSheet(CONFIG.SHEETS.PROJECTS);
  if (!sheet) throw new Error('Could not open Projects sheet');

  const projectId = generateProjectID();
  const now = new Date();
  const userEmail = Session.getActiveUser().getEmail();
  const initialStatus = PROJECT_STATUSES.PENDING;  // Use constant from config

  // Create folder structure with more robust error handling
  Logger.log('Creating project folders...');
  try {
    const folderName = `${data.customerId}-${projectId}-${data.projectName}`;
    const parentFolder = DriveApp.getFolderById(CONFIG.FOLDERS.PARENT_ID);
    const projectFolder = parentFolder.createFolder(folderName);
    const folderId = projectFolder.getId();

    const estimatesFolder = projectFolder.createFolder('Estimates');
    const materialsFolder = projectFolder.createFolder('Materials');
    const subInvoicesFolder = projectFolder.createFolder('SubInvoices');

    const estimatesFolderId = estimatesFolder.getId();
    const materialsFolderId = materialsFolder.getId();
    const subInvoicesFolderId = subInvoicesFolder.getId();

    // Ensure the project is created with an explicit initial status
    const rowData = [
      projectId,                          // ProjectID          - 1
      data.customerId,                    // CustomerID         - 2
      data.projectName,                   // ProjectName        - 3
      initialStatus,                      // Status             - 4
      folderId,                          // FolderID           - 5
      now,                               // CreatedOn          - 6
      userEmail,                         // CreatedBy          - 7
      '',                                // JobID              - 8
      now,                               // LastModified       - 9
      userEmail,                         // LastModifiedBy     - 10
      estimatesFolderId,                 // EstimatesFolderID  - 11
      materialsFolderId,                 // MaterialsFolderID  - 12
      subInvoicesFolderId,              // SubInvoicesFolderID- 13
      `https://drive.google.com/drive/folders/${folderId}`,  // DocURL - 14
      data.customerName || '',           // CustomerName       - 15
      data.jobDescription || '',         // JobDescription    - 16
      data.siteLocationAddress || '',    // SiteLocationAddress- 17
      data.siteLocationCity || '',       // SiteLocationCity   - 18
      data.siteLocationState || '',       // SiteLocationState- 19
      data.siteLocationZip || ''         // SiteLocationZip   - 20
    ];

    sheet.appendRow(rowData);

    // Add delay and verify project creation
    Utilities.sleep(2000);
    
    // Verify project was created
    const verifyData = sheet.getDataRange().getValues();
    const projectRow = verifyData.find(row => row[0] === projectId);
    
    if (!projectRow) {
      throw new Error('Project creation verification failed');
    }

    return {
      success: true,
      data: {
        projectId,
        customerId: data.customerId,
        projectName: data.projectName,
        status: initialStatus,
        folderId,
        createdOn: now.toISOString(),
        createdBy: userEmail,
        docUrl: `https://drive.google.com/drive/folders/${folderId}`,  // Add to return data
        folders: {  // Move folders inside data object
          main: folderId,
          estimates: estimatesFolderId,
          materials: materialsFolderId,
          subInvoices: subInvoicesFolderId
        }
      }
    };
  } catch (error) {
    Logger.log(`Error in createProjectRecord: ${error.message}`);
    throw error;
  }
}

function getProjectsByStatus(status) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.PROJECTS);
  
  const projectIdCol = headers.indexOf("ProjectID");
  const projectNameCol = headers.indexOf("ProjectName");
  const statusCol = headers.indexOf("Status");
  const customerNameCol = headers.indexOf("CustomerName");
  
  return rows
    .filter(row => row[statusCol] === status)
    .map(row => ({
      projectId: row[projectIdCol],
      name: row[projectNameCol],
      status: row[statusCol],
      customerName: row[customerNameCol] || ''
    }));
}

// ==========================================
// TIME LOGGING FUNCTIONS
// ==========================================

function logTime(data) {
  const sheet = getSheet(CONFIG.SHEETS.TIME_LOGS);
  if (!sheet) throw new Error("Time Logs sheet not found");

  const timeLogId = "TL" + new Date().getTime();
  sheet.appendRow([
    timeLogId,
    data.projectId,
    data.date,
    data.startTime,
    data.endTime,
    data.hours,
    data.submittingUser,
    data.forUserEmail,
    new Date()
  ]);

  return { id: timeLogId, hours: data.hours };
}

// ==========================================
// MATERIALS RECEIPT FUNCTIONS
// ==========================================

function logMaterialsReceipt(data) {
  const sheet = getSheet(CONFIG.SHEETS.MATERIALS_RECEIPTS);
  if (!sheet) throw new Error("Materials Receipts sheet not found");

  Logger.log('Logging materials receipt with data:', data);
  const receiptId = "MATREC-" + new Date().getTime();
  
  // Format the document URL if needed
  let docUrl = data.receiptDocURL || '';
  if (docUrl && !docUrl.startsWith('http')) {
    if (docUrl.includes('id=')) {
      const fileId = docUrl.split('id=')[1];
      docUrl = `https://drive.google.com/file/d/${fileId}/view`;
    } else if (docUrl.match(/^[A-Za-z0-9_-]+$/)) {
      docUrl = `https://drive.google.com/file/d/${docUrl}/view`;
    }
  }
  
  Logger.log('Formatted doc URL:', docUrl);

  sheet.appendRow([
    receiptId,
    data.projectId,
    data.vendorId,
    data.vendorName,
    data.amount,
    docUrl,
    data.submittingUser,
    data.forUserEmail,
    new Date()
  ]);

  // Log activity
  logActivity({
    action: 'MATERIALS_RECEIPT_CREATED',
    moduleType: 'MATERIALS',
    referenceId: receiptId,
    userEmail: data.submittingUser,
    details: {
      projectId: data.projectId,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
      amount: data.amount,
      receiptDocURL: docUrl,
      forUserEmail: data.forUserEmail || data.submittingUser
    }
  });

  return { id: receiptId };
}

// ==========================================
// SUBCONTRACTOR FUNCTIONS
// ==========================================

function getSubcontractors() {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.SUBCONTRACTORS);
  
  // Looks specifically for these column headers:
  const subIdCol = headers.indexOf("SubID");         // e.g. "Sub-001"
  const subNameCol = headers.indexOf("SubName");     // e.g. "John's Plumbing"
  const addressCol = headers.indexOf("Address");
  const cityCol = headers.indexOf("City");
  const stateCol = headers.indexOf("State");
  const zipCol = headers.indexOf("Zip");
  const emailCol = headers.indexOf("ContactEmail");
  const phoneCol = headers.indexOf("Phone");
  const statusCol = headers.indexOf("Status");
  
  if (subIdCol === -1 || subNameCol === -1) {
    throw new Error("Required columns not found in Subcontractors sheet");
  }

  // Returns array of objects with this structure:
  return rows.map(row => ({
    subId: row[subIdCol],
    subName: row[subNameCol],
    address: row[addressCol],
    city: row[cityCol],
    state: row[stateCol],
    zip: row[zipCol],
    contactEmail: row[emailCol],
    phone: row[phoneCol],
    status: row[statusCol] || 'Active'
  }));
}

function logSubInvoice(data) {
  const sheet = getSheet(CONFIG.SHEETS.SUBINVOICES);
  if (!sheet) throw new Error("Subinvoices sheet not found");

  const invoiceId = "SUBINV-" + new Date().getTime();
  sheet.appendRow([
    invoiceId,
    data.projectId,
    data.projectName,
    data.subId,
    data.subName,
    data.invoiceAmount,
    data.invoiceDocURL || '',
    data.submittingUser,
    new Date()
  ]);

  return { id: invoiceId };
}

function createSubcontractor(data) {
  const sheet = getSheet(CONFIG.SHEETS.SUBCONTRACTORS);
  if (!sheet) throw new Error("Subcontractors sheet not found");

  try {
    const newSubId = getNextSubId(sheet);

    sheet.appendRow([
      newSubId,
      data.subName || '',
      data.address || '',
      data.city || '',
      data.state || '',
      data.zip || '',
      data.contactEmail || '',
      data.phone || '',
      'Sub'  // QbVendorType - Always 'Sub' for subcontractors
    ]);

    // Return standardized response format
    return {
      success: true,
      data: {
        subId: newSubId,
        subName: data.subName || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        zip: data.zip || '',
        contactEmail: data.contactEmail || '',
        phone: data.phone || '',
        qbVendorType: 'Sub'
      }
    };
  } catch (error) {
    Logger.log('Error in createSubcontractor:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to create subcontractor'
    };
  }
}

// ==========================================
// CUSTOMER FUNCTIONS
// ==========================================

function getCustomerData() {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.CUSTOMERS);
  const customerIdCol = headers.indexOf("CustomerID");
  const nameCol = headers.indexOf("CustomerName");
  const addressCol = headers.indexOf("Address");
  const cityCol = headers.indexOf("City");
  const stateCol = headers.indexOf("State");
  const zipCol = headers.indexOf("Zip");
  const emailCol = headers.indexOf("ContactEmail");
  const phoneCol = headers.indexOf("Phone");
  const statusCol = headers.indexOf("Status");

  // Filter out invalid rows
  const validCustomers = rows.filter(row => {
    const customerId = row[customerIdCol];
    const customerName = row[nameCol];

    // Skip rows with invalid or undefined IDs
    if (!customerId || 
        customerId.toString().includes('undefined') || 
        customerId.toString().trim() === '') {
      return false;
    }

    // Skip rows with missing names
    if (!customerName || customerName.toString().trim() === '') {
      return false;
    }
    
    return true;
  }).map(row => ({
    customerId: row[customerIdCol],
    name: row[nameCol] || '',
    address: row[addressCol] || '',
    city: row[cityCol] || '',
    state: row[stateCol] || '',
    zip: row[zipCol] || '',
    email: row[emailCol] || '',
    phone: row[phoneCol] || '',
    status: row[statusCol] || CUSTOMER_STATUSES.ACTIVE  // Use constant instead of string
  }));

  // Log summary for debugging
  Logger.log(`Processed ${validCustomers.length} valid customers`);
  
  return validCustomers;
}

function createCustomerRecord(data) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.CUSTOMERS);
    if (!sheet) throw new Error('Could not open Customers sheet');

    const customerId = generateCustomerID();
    const now = new Date();
    const userEmail = Session.getActiveUser().getEmail();
    const initialStatus = CUSTOMER_STATUSES.ACTIVE;

    // Format phone number before saving
    const formattedPhone = formatPhoneNumber(data.phone);

    // Add row to sheet
    sheet.appendRow([
      customerId,
      data.name || '',
      data.address || '',
      data.city || '',
      data.state || '',
      data.zip || '',
      data.email || '',
      formattedPhone,
      now,
      userEmail,
      initialStatus
    ]);

    // Return standardized success response
    return {
      success: true,
      data: {
        customerId: customerId,
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        email: data.email,
        phone: formattedPhone,
        createdOn: now,
        createdBy: userEmail,
        status: initialStatus
      }
    };

  } catch (error) {
    Logger.log('Error in createCustomerRecord:', error);
    return {
      success: false,
      error: error.message || 'Failed to create customer record'
    };
  }
}

// Customer Data Fetching
function getCustomers() {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.CUSTOMERS);
  const customerIdCol = headers.indexOf("CustomerID");
  const nameCol = headers.indexOf("CustomerName");
  const addressCol = headers.indexOf("Address");
  const cityCol = headers.indexOf("City");
  const stateCol = headers.indexOf("State");
  const zipCol = headers.indexOf("Zip");
  const emailCol = headers.indexOf("ContactEmail");
  const phoneCol = headers.indexOf("Phone");
  const statusCol = headers.indexOf("Status");
  
  return rows.map(row => ({
    customerId: row[customerIdCol],
    name: row[nameCol],
    address: row[addressCol],
    city: row[cityCol],
    state: row[stateCol],
    zip: row[zipCol],
    email: row[emailCol],
    phone: row[phoneCol],
    status: row[statusCol] || 'Active' // Default to Active if not set
  }));
}

// Vendor Data Fetching
function getVendors() {
  Logger.log('=== Starting getVendors ===');
  try {
    const { headers, rows } = getSheetData(CONFIG.SHEETS.VENDORS);
    Logger.log(`Retrieved ${rows.length} rows from Vendors sheet`);
    Logger.log('Headers:', headers);

    const vendorIdCol = headers.indexOf("VendorID");
    const vendorNameCol = headers.indexOf("VendorName");
    const addressCol = headers.indexOf("Address");
    const cityCol = headers.indexOf("City");
    const stateCol = headers.indexOf("State");
    const zipCol = headers.indexOf("Zip");
    const emailCol = headers.indexOf("Email");
    const phoneCol = headers.indexOf("Phone");
    const statusCol = headers.indexOf("Status");
    const createdOnCol = headers.indexOf("CreatedOn");

    Logger.log('Column indices:', {
      vendorId: vendorIdCol,
      vendorName: vendorNameCol,
      address: addressCol,
      city: cityCol,
      state: stateCol,
      zip: zipCol,
      email: emailCol,
      phone: phoneCol,
      status: statusCol,
      createdOn: createdOnCol
    });

    const vendors = rows.map(row => ({
      vendorId: row[vendorIdCol],
      vendorName: row[vendorNameCol],
      address: row[addressCol],
      city: row[cityCol],
      state: row[stateCol],
      zip: row[zipCol],
      email: row[emailCol],
      phone: row[phoneCol],
      status: row[statusCol] || 'Active',
      createdDate: row[createdOnCol] || null
    }));

    Logger.log(`Mapped ${vendors.length} vendors`);
    if (vendors.length > 0) {
      Logger.log('First vendor:', JSON.stringify(vendors[0]));
    }

    return vendors;
  } catch (error) {
    Logger.log(`Error in getVendors: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    throw error;
  }
}

// ==========================================
// VENDOR FUNCTIONS
// ==========================================

function createVendor(data) {
  const sheet = getSheet(CONFIG.SHEETS.VENDORS);
  if (!sheet) throw new Error("Vendors sheet not found");

  const vendorId = generateVendorID();
  const now = new Date();
  const userEmail = Session.getActiveUser().getEmail();

  try {
    // Add the row to the sheet with all fields
    sheet.appendRow([
      vendorId,              // VendorID
      data.vendorName,       // VendorName
      data.address || '',    // Address
      data.city || '',      // City
      data.state || '',     // State
      data.zip || '',       // Zip
      data.email || '',     // Email
      data.phone || '',     // Phone
      data.status || 'ACTIVE', // Status
      now,                  // CreatedOn
      'Vend'               // QbVendorType
    ]);

    // Verify the vendor was created
    const verifyData = sheet.getDataRange().getValues();
    const vendorRow = verifyData.find(row => row[0] === vendorId);
    
    if (!vendorRow) {
      throw new Error('Vendor creation verification failed');
    }

    return {
      success: true,
      data: {
        vendorId: vendorId,
        vendorName: data.vendorName,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        email: data.email,
        phone: data.phone,
        status: 'ACTIVE',
        createdDate: now,
        qbVendorType: 'Vend'
      }
    };
  } catch (error) {
    Logger.log('Error in createVendor:', error.message);
    throw error;
  }
}

// ==========================================
// ACTIVITY LOGGING FUNCTIONS
// ==========================================

function logActivity(data) {
  const sheet = getSheet(CONFIG.SHEETS.ACTIVITY_LOG);
  if (!sheet) throw new Error("Activity Log sheet not found");

  const logId = `LOG-${new Date().getTime()}`;
  const timestamp = new Date();
  sheet.appendRow([
    logId,
    timestamp,
    data.action,
    data.userEmail,
    data.moduleType,
    data.referenceId,
    JSON.stringify(data.details),
    data.status || '',
    data.previousStatus || ''
  ]);

  return { logId, timestamp };
}

// ==========================================
// ID GENERATION FUNCTIONS
// ==========================================

function generateCustomerID() {
  const sheet = getSheet(CONFIG.SHEETS.CUSTOMERS);
  const data = sheet.getDataRange().getValues();
  const currentYear = new Date().getFullYear().toString().slice(-2); // Get last 2 digits
  Logger.log(`Generating Customer ID for year: ${currentYear}`);

  if (data.length <= 1) {
    Logger.log("No existing customers found, starting fresh.");
    return `${currentYear}-001`;  // First customer of the year (YY-XXX)
  }

  // Extract only valid customer IDs that match the new format YY-XXX
  const customerIds = data
    .slice(1)  // Ignore header row
    .map(row => row[0])  // Get only the customer ID column
    .filter(id => id && /^\d{2}-\d{3}$/.test(id));  // Match format YY-XXX

  Logger.log(`Found existing customer IDs: ${customerIds}`);

  // Get the highest existing sequence number for the current year
  const lastIdForYear = customerIds
    .filter(id => id.startsWith(currentYear)) // Only look at current year's IDs
    .sort()
    .pop();  // Get the last (highest) one

  if (!lastIdForYear) {
    Logger.log(`No customers found for ${currentYear}, starting at 001.`);
    return `${currentYear}-001`;
  }

  Logger.log(`Last customer ID for ${currentYear}: ${lastIdForYear}`);

  // Extract sequence number and increment
  const [year, sequence] = lastIdForYear.split('-');
  const nextSequence = (parseInt(sequence, 10) + 1).toString().padStart(3, '0');

  const newCustomerId = `${currentYear}-${nextSequence}`;
  Logger.log(`Generated new Customer ID: ${newCustomerId}`);
  return newCustomerId;
}

function generateProjectID() {
  const sheet = getSheet(CONFIG.SHEETS.PROJECTS);
  const data = sheet.getDataRange().getValues();
  const date = new Date();
  const yearLastTwo = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const yearMonth = `${yearLastTwo}${month}`;  // Changed from yyyyMM to yyMM

  if (data.length <= 1) return `PROJ-${yearMonth}-001`;

  const currentMonthProjects = data.slice(1)
    .filter(row => row[0].startsWith(`PROJ-${yearMonth}`));

  if (currentMonthProjects.length === 0) return `PROJ-${yearMonth}-001`;

  const lastProject = currentMonthProjects[currentMonthProjects.length - 1][0];
  const sequence = parseInt(lastProject.split('-')[2], 10) + 1;
  return `PROJ-${yearMonth}-${sequence.toString().padStart(3, '0')}`;
}

function getNextSubId(sheet) {
  if (sheet.getLastRow() < 2) return "Sub-001";

  // Get all existing sub IDs
  const data = sheet.getDataRange().getValues();
  const existingIds = data.slice(1).map(row => row[0]); // Skip header row
  
  // Filter for only Sub-XXX format IDs
  const subIds = existingIds.filter(id => /^Sub-\d{3}$/.test(id));
  
  if (subIds.length === 0) {
    // No properly formatted IDs exist yet, start with 001
    return "Sub-001";
  }

  // Find the highest number used
  const maxNum = Math.max(...subIds.map(id => {
    const match = id.match(/^Sub-(\d{3})$/);
    return match ? parseInt(match[1], 10) : 0;
  }));
  
  // Generate next number.
  return `Sub-${(maxNum + 1).toString().padStart(3, '0')}`;
}

function generateEstimateID(projectID) {
  const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
  const data = sheet.getDataRange().getValues();
  // Start from row 1 (exclude header). 
  // Column 0 might be EstimateID, Column 1 is ProjectID, etc.
  const projectEstimates = data.slice(1)
    .filter(row => row[1] === projectID)
    .map(row => row[0]); // the EstimateID

  if (projectEstimates.length === 0) {
    return `EST-${projectID}-1`;  // Uses project ID formats project 
  }

  const lastSequence = Math.max(...projectEstimates.map(id => {
    const parts = id.split('-');
    return parseInt(parts[parts.length - 1], 10);
  }));

  return `EST-${projectID}-${lastSequence + 1}`;
}

function generateVendorID() {
  const sheet = getSheet(CONFIG.SHEETS.VENDORS);
  if (sheet.getLastRow() < 2) return "VEND-001";

  // Get all existing vendor IDs
  const data = sheet.getDataRange().getValues();
  const existingIds = data.slice(1).map(row => row[0]); // Skip header row
  
  // Filter for only VEND-XXX format IDs
  const vendIds = existingIds.filter(id => /^VEND-\d{3}$/.test(id));
  
  if (vendIds.length === 0) {
    // No properly formatted IDs exist yet, start with 001
    return "VEND-001";
  }

  // Find the highest number used
  const maxNum = Math.max(...vendIds.map(id => {
    const match = id.match(/^VEND-(\d{3})$/);
    return match ? parseInt(match[1], 10) : 0;
  }));
  
  // Generate next number.
  return `VEND-${(maxNum + 1).toString().padStart(3, '0')}`;
}

// ==========================================
// STATUS MANAGEMENT FUNCTIONS
// ==========================================

function updateEstimateStatus(estimateId, newStatus, userEmail) {
  const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const estimateIdCol = headers.indexOf('EstimateID');
  const statusCol = headers.indexOf('Status');
  const projectIdCol = headers.indexOf('ProjectID');
  
  const rowIndex = data.findIndex(row => row[estimateIdCol] === estimateId);
  if (rowIndex === -1) {
    throw new Error(`Estimate ${estimateId} not found`);
  }
  
  const oldStatus = data[rowIndex][statusCol];
  validateStatusTransition(oldStatus, newStatus, 'ESTIMATE');  // This now uses the Utils.js version
  
  // Update status
  sheet.getRange(rowIndex + 1, statusCol + 1).setValue(newStatus);
  
  // Log activity
  logActivity({
    action: 'ESTIMATE_STATUS_CHANGED',
    moduleType: 'ESTIMATE', 
    referenceId: estimateId,
    userEmail: userEmail,
    details: {
      oldStatus: oldStatus,
      newStatus: newStatus
    }
  });
  
  return {
    estimateId: estimateId,
    oldStatus: oldStatus,
    newStatus: newStatus
  };
}

function updateProjectStatus(projectId, newStatus, userEmail) {
  const context = 'updateProjectStatus';
  try {
    const sheet = getSheet(CONFIG.SHEETS.PROJECTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const projectIdCol = headers.indexOf('ProjectID');
    const statusCol = headers.indexOf('Status');
    
    const rowIndex = data.findIndex(row => row[projectIdCol] === projectId);
    if (rowIndex === -1) {
      throw new Error(`Project ${projectId} not found`);
    }
    const oldStatus = data[rowIndex][statusCol];
    
    // Validate status transition
    try {
      validateStatusTransition(oldStatus, newStatus, 'PROJECT');  // This now uses the Utils.js version
    } catch (error) {
      Logger.log(`Status transition validation failed: ${error.message}`);
      Logger.log(`Old status: ${oldStatus}, New status: ${newStatus}`);
      throw error;
    }

    // Update status in spreadsheet
    sheet.getRange(rowIndex + 1, statusCol + 1).setValue(newStatus);
    
    // Log activity
    logActivity({
      action: 'PROJECT_STATUS_CHANGED',
      moduleType: 'PROJECT',
      referenceId: projectId,
      userEmail: userEmail,
      details: {
        oldStatus: oldStatus,
        newStatus: newStatus
      }
    });
    
    return {
      success: true,
      data: {
        projectId: projectId,
        oldStatus: oldStatus,
        newStatus: newStatus
      }
    };
  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
}

// ==========================================
// ESTIMATE FUNCTIONS
// ==========================================

function logEstimate(data) {
  Logger.log('=== logEstimate called ===');
  Logger.log('Data received:' + JSON.stringify(data));
  
  const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
  if (!sheet) {
    Logger.log('Estimates sheet not found');
    throw new Error("Estimates sheet not found");
  }

  let finalEstimateId = data.estimateId;
  if (!finalEstimateId) {
    if (!data.projectId) {
      Logger.log('Cannot generate EstimateID without a ProjectID');
      throw new Error("Cannot generate EstimateID without a ProjectID");
    }
    finalEstimateId = generateEstimateID(data.projectId);
    Logger.log('Generated new estimate ID: ' + finalEstimateId);
  }

  const now = new Date();
  const userEmail = Session.getActiveUser().getEmail();
  const initialStatus = 'PENDING';

  // Updated row data structure to match sheet columns exactly
  const rowData = [
    finalEstimateId,                // A: EstimateID
    data.projectId || '',           // B: ProjectID
    now,                            // C: DateCreated
    data.customerId || '',          // D: CustomerID
    parseFloat(data.estimateAmount) || parseFloat(data.totalAmount) || parseFloat(data.amount) || 0,   // E: EstimateAmount
    parseFloat(data.contingencyAmount) || 0,  // F: ContingencyAmount
    userEmail,                      // G: CreatedBy
    '',                            // H: DocUrl placeholder
    '',                            // I: DocId placeholder
    initialStatus,                 // J: Status
    '',                            // K: SentDate
    'true',                        // L: IsActive
    '',                            // M: ApprovedDate
    data.siteLocationAddress || '', // N: SiteLocationAddress
    data.siteLocationCity || '',    // O: SiteLocationCity
    data.siteLocationState || '',   // P: SiteLocationState
    data.siteLocationZip || '',     // Q: SiteLocationZip
    data.poNumber || '',            // R: PO#
    data.jobDescription || '',      // S: Job Description
    data.customerName || '',        // T: CustomerName
    data.projectName || ''          // U: ProjectName (NEW)
  ];

  sheet.appendRow(rowData);

  return {
    estimateId: finalEstimateId,
    createdOn: now,
    status: initialStatus
  };
}

function updateProjectDetails(projectId, data) {
  const sheet = getSheet(CONFIG.SHEETS.PROJECTS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  
  const projectIdCol = headers.indexOf('ProjectID');
  const jobDescriptionCol = headers.indexOf('JobDescription');
  const siteAddressCol = headers.indexOf('SiteLocationAddress');
  const siteCityCol = headers.indexOf('SiteLocationCity');
  const siteStateCol = headers.indexOf('SiteLocationState');
  const siteZipCol = headers.indexOf('SiteLocationZip');
  
  const rowIndex = values.findIndex(row => row[projectIdCol] === projectId);
  
  if (rowIndex === -1) {
    Logger.log(`Project ${projectId} not found`);
    return;
  }

  // Update each field if it exists in the sheet
  if (jobDescriptionCol !== -1) {
    sheet.getRange(rowIndex + 1, jobDescriptionCol + 1).setValue(data.jobDescription);
  }
  if (siteAddressCol !== -1) {
    sheet.getRange(rowIndex + 1, siteAddressCol + 1).setValue(data.siteLocationAddress);
  }
  if (siteCityCol !== -1) {
    sheet.getRange(rowIndex + 1, siteCityCol + 1).setValue(data.siteLocationCity);
  }
  if (siteStateCol !== -1) {
    sheet.getRange(rowIndex + 1, siteStateCol + 1).setValue(data.siteLocationState);
  }
  if (siteZipCol !== -1) {
    sheet.getRange(rowIndex + 1, siteZipCol + 1).setValue(data.siteLocationZip);
  }

  Logger.log(`Updated project ${projectId} with site location and job description details`);
}

function updateEstimateDocUrl(estimateId, docUrl, docId) {
  const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
  if (!sheet) throw new Error("Estimates sheet not found");

  const data = sheet.getDataRange().getValues();
  // Find row where EstimateID == estimateId (column 0, ignoring header)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEstimateId = row[0];
    if (rowEstimateId === estimateId) {
      sheet.getRange(i + 1, 8).setValue(docUrl);   // Column H (8)
      sheet.getRange(i + 1, 9).setValue(docId);    // Column I (9)
      break;
    }
  }
}

// ==========================================
// NEW: UPDATE DOC URL HELPERS FOR MATERIALS & SUBINVOICES
// ==========================================

function updateMaterialsReceiptDocUrl(receiptId, docUrl, docId) {
  const sheet = getSheet(CONFIG.SHEETS.MATERIALS_RECEIPTS);
  if (!sheet) throw new Error("Materials Receipts sheet not found");

  const data = sheet.getDataRange().getValues();
  // Column 0 is the receiptId
  // Column 5 is existing doc URL (1-based => column 6)
  // We'll store docId in column 10 (arbitrary example) if we want
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowReceiptId = row[0];
    if (rowReceiptId === receiptId) {
      sheet.getRange(i + 1, 6).setValue(docUrl);  // doc url at col 6
      // Put docId in col 10 if you added a new column for it
      sheet.getRange(i + 1, 10).setValue(docId);
      break;
    }
  }
}

function updateSubInvoiceDocUrl(invoiceId, docUrl, docId) {
  const sheet = getSheet(CONFIG.SHEETS.SUBINVOICES);
  if (!sheet) throw new Error("Subinvoices sheet not found");

  const data = sheet.getDataRange().getValues();
  // Column 0 is invoiceId
  // Column 6 is existing doc URL (1-based => column 7)
  // We'll store docId in column 10 if we want
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowInvoiceId = row[0];
    if (rowInvoiceId === invoiceId) {
      sheet.getRange(i + 1, 7).setValue(docUrl); // doc url at col 7
      sheet.getRange(i + 1, 10).setValue(docId); // if you have a new column
      break;
    }
  }
}

// ==========================================
// FUNCTIONS FOR CUSTOMER MANGEMENT MODULE
// ==========================================

function getCustomerProjects(customerId) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.PROJECTS);
  
  const projectIdCol = headers.indexOf("ProjectID");
  const customerIdCol = headers.indexOf("CustomerID");
  const nameCol = headers.indexOf("ProjectName");
  const statusCol = headers.indexOf("Status");
  const createdOnCol = headers.indexOf("CreatedOn");
  const jobIdCol = headers.indexOf("JobID");

  return rows
    .filter(row => row[customerIdCol] === customerId)
    .map(row => ({
      projectId: row[projectIdCol],
      name: row[nameCol],
      status: row[statusCol],
      createdOn: row[createdOnCol],
      jobId: row[jobIdCol] || ''
    }));
}

function getCustomerEstimates(customerId) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.ESTIMATES);
  const estimateIdCol = headers.indexOf("EstimateID");
  const projectIdCol = headers.indexOf("ProjectID");
  const customerIdCol = headers.indexOf("CustomerID");
  const dateCol = headers.indexOf("DateCreated");
  const amountCol = headers.indexOf("EstimatedAmount");
  const statusCol = headers.indexOf("Status");
  const versionCol = headers.indexOf("VersionNumber");
  const isActiveCol = headers.indexOf("IsActive");
  const approvedAmountCol = headers.indexOf("CurrentApprovedAmount");

  return rows
    .filter(row => row[customerIdCol] === customerId)
    .map(row => ({
      estimateId: row[estimateIdCol],
      projectId: row[projectIdCol],
      dateCreated: row[dateCol],
      amount: parseFloat(row[amountCol]) || 0,
      status: row[statusCol],
      versionNumber: row[versionCol],
      isActive: row[isActiveCol] === 'true',
      approvedAmount: parseFloat(row[approvedAmountCol]) || 0
    }));
}

function enrichCustomerData(customer) {
  // Get projects
  const projects = getCustomerProjects(customer.customerId);
  
  // Get estimates
  const estimates = getCustomerEstimates(customer.customerId);
  
  // Calculate metrics
  const activeProjects = projects.filter(p => p.status === 'IN_PROGRESS');
  const approvedEstimates = estimates.filter(e => e.status === 'APPROVED');
  const totalApprovedAmount = approvedEstimates.reduce((sum, e) => sum + e.approvedAmount, 0);
  
  return {
    ...customer,
    projects,
    estimates,
    metrics: {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      completedProjects: projects.filter(p => p.status === 'COMPLETED').length,
      totalEstimates: estimates.length,
      approvedEstimates: approvedEstimates.length,
      totalApprovedAmount,
      estimateConversionRate: estimates.length ? (approvedEstimates.length / estimates.length) * 100 : 0,
      averageProjectValue: projects.length ? totalApprovedAmount / projects.length : 0,
      lastActivity: projects.length ? new Date(Math.max(...projects.map(p => new Date(p.createdOn)))) : null
    }
  };
}

function getProjectById(projectId) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.PROJECTS);
  
  const projectIdCol = headers.indexOf("ProjectID");
  const projectNameCol = headers.indexOf("ProjectName");
  const statusCol = headers.indexOf("Status");
  const customerNameCol = headers.indexOf("CustomerName");
  const folderIdCol = headers.indexOf("FolderID");
  const jobIdCol = headers.indexOf("JobID");
  
  const projectRow = rows.find(row => row[projectIdCol] === projectId);
  
  if (!projectRow) return null;
  
  return {
    id: projectRow[projectIdCol],
    projectId: projectRow[projectIdCol],
    name: projectRow[projectNameCol],
    status: projectRow[statusCol],
    customerName: projectRow[customerNameCol] || '',
    folderId: projectRow[folderIdCol],
    jobId: projectRow[jobIdCol] || ''
  };
}

function getEstimateById(estimateId) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.ESTIMATES);
  
  const estimateIdCol = headers.indexOf("EstimateID");
  const projectIdCol = headers.indexOf("ProjectID");
  const statusCol = headers.indexOf("Status");
  const customerNameCol = headers.indexOf("CustomerName");
  const amountCol = headers.indexOf("EstimateAmount");
  const docUrlCol = headers.indexOf("DocUrl");
  const projectNameCol = headers.indexOf("ProjectName");  // Add this
  
  const estimateRow = rows.find(row => row[estimateIdCol] === estimateId);
  
  if (!estimateRow) return null;
  
  return {
    id: estimateRow[estimateIdCol],
    estimateId: estimateRow[estimateIdCol],
    projectId: estimateRow[projectIdCol],
    status: estimateRow[statusCol],
    customerName: estimateRow[customerNameCol] || '',
    amount: estimateRow[amountCol] || 0,
    docUrl: estimateRow[docUrlCol] || '',
    projectName: estimateRow[projectNameCol] || ''  // Add this
  };
}

function getEstimatesByStatus(status) {
  const context = 'getEstimatesByStatus';
  try {
    Logger.log(`Getting estimates with status: ${status}`);
    
    const { headers, rows } = getSheetData(CONFIG.SHEETS.ESTIMATES);
    
    const estimateIdCol = headers.indexOf('EstimateID');
    const projectIdCol = headers.indexOf('ProjectID');
    const statusCol = headers.indexOf('Status');
    const customerNameCol = headers.indexOf('CustomerName');
    const amountCol = headers.indexOf('EstimateAmount');
    const projectNameCol = headers.indexOf('ProjectName');  // Add this

    // Filter and map in one pass
    const filteredEstimates = rows
      .filter(row => row[statusCol] === status)
      .map(row => ({
        id: row[estimateIdCol],
        estimateId: row[estimateIdCol],
        projectId: row[projectIdCol] || '',
        name: `Estimate ${row[estimateIdCol]}`,
        status: row[statusCol],
        customerName: row[customerNameCol] || '',
        amount: row[amountCol] || 0,
        projectName: row[projectNameCol] || ''  // Add this
      }));

    Logger.log(`Found ${filteredEstimates.length} estimates with status ${status}`);
    return filteredEstimates;
    
  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    throw error;
  }
}

// ==========================================
// NEW: UPDATE CUSTOMER, SUBCONTRACTOR, AND VENDOR DATA
// ==========================================

function updateCustomerData(customerId, data) {
  const sheet = getSheet(CONFIG.SHEETS.CUSTOMERS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  
  const customerIdCol = headers.indexOf("CustomerID");
  const nameCol = headers.indexOf("CustomerName");
  const addressCol = headers.indexOf("Address");
  const cityCol = headers.indexOf("City");
  const stateCol = headers.indexOf("State");
  const zipCol = headers.indexOf("Zip");
  const emailCol = headers.indexOf("ContactEmail");
  const phoneCol = headers.indexOf("Phone");
  
  const rowIndex = values.findIndex(row => row[customerIdCol] === customerId);
  if (rowIndex === -1) throw new Error("Customer not found");
  
  // Update fields if provided
  if (data.name) sheet.getRange(rowIndex + 1, nameCol + 1).setValue(data.name);
  if (data.address) sheet.getRange(rowIndex + 1, addressCol + 1).setValue(data.address);
  if (data.city) sheet.getRange(rowIndex + 1, cityCol + 1).setValue(data.city);
  if (data.state) sheet.getRange(rowIndex + 1, stateCol + 1).setValue(data.state);
  if (data.zip) sheet.getRange(rowIndex + 1, zipCol + 1).setValue(data.zip);
  if (data.email) sheet.getRange(rowIndex + 1, emailCol + 1).setValue(data.email);
  if (data.phone) sheet.getRange(rowIndex + 1, phoneCol + 1).setValue(data.phone);
  
  return { success: true };
}

function updateSubcontractorData(subId, data) {
  const sheet = getSheet(CONFIG.SHEETS.SUBCONTRACTORS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  
  const subIdCol = headers.indexOf("SubID");
  const nameCol = headers.indexOf("SubName");
  const addressCol = headers.indexOf("Address");
  const cityCol = headers.indexOf("City");
  const stateCol = headers.indexOf("State");
  const zipCol = headers.indexOf("Zip");
  const emailCol = headers.indexOf("ContactEmail");
  const phoneCol = headers.indexOf("Phone");
  
  const rowIndex = values.findIndex(row => row[subIdCol] === subId);
  if (rowIndex === -1) throw new Error("Subcontractor not found");
  
  if (data.subName) sheet.getRange(rowIndex + 1, nameCol + 1).setValue(data.subName);
  if (data.address) sheet.getRange(rowIndex + 1, addressCol + 1).setValue(data.address);
  if (data.city) sheet.getRange(rowIndex + 1, cityCol + 1).setValue(data.city);
  if (data.state) sheet.getRange(rowIndex + 1, stateCol + 1).setValue(data.state);
  if (data.zip) sheet.getRange(rowIndex + 1, zipCol + 1).setValue(data.zip);
  if (data.contactEmail) sheet.getRange(rowIndex + 1, emailCol + 1).setValue(data.contactEmail);
  if (data.phone) sheet.getRange(rowIndex + 1, phoneCol + 1).setValue(data.phone);
  
  return { success: true };
}

function updateVendorData(vendorId, data) {
  const sheet = getSheet(CONFIG.SHEETS.VENDORS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  
  const vendorIdCol = headers.indexOf("VendorID");
  const nameCol = headers.indexOf("VendorName");
  const addressCol = headers.indexOf("Address");
  const cityCol = headers.indexOf("City");
  const stateCol = headers.indexOf("State");
  const zipCol = headers.indexOf("Zip");
  const emailCol = headers.indexOf("Email");
  const phoneCol = headers.indexOf("Phone");
  
  const rowIndex = values.findIndex(row => row[vendorIdCol] === vendorId);
  if (rowIndex === -1) throw new Error("Vendor not found");
  
  if (data.vendorName) sheet.getRange(rowIndex + 1, nameCol + 1).setValue(data.vendorName);
  if (data.address) sheet.getRange(rowIndex + 1, addressCol + 1).setValue(data.address);
  if (data.city) sheet.getRange(rowIndex + 1, cityCol + 1).setValue(data.city);
  if (data.state) sheet.getRange(rowIndex + 1, stateCol + 1).setValue(data.state);
  if (data.zip) sheet.getRange(rowIndex + 1, zipCol + 1).setValue(data.zip);
  if (data.email) sheet.getRange(rowIndex + 1, emailCol + 1).setValue(data.email);
  if (data.phone) sheet.getRange(rowIndex + 1, phoneCol + 1).setValue(data.phone);
  
  return { success: true };
}

// ==========================================
// ENHANCED SUBCONTRACTOR FUNCTIONS
// ==========================================

function getSubcontractorDetails(subId) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.SUBINVOICES);
  
  // Get all invoices for this subcontractor
  const subIdCol = headers.indexOf("SubID");
  const projectIdCol = headers.indexOf("ProjectID");
  const amountCol = headers.indexOf("InvoiceAmount");
  const dateCol = headers.indexOf("DateCreated");
  const statusCol = headers.indexOf("Status");
  
  const invoices = rows
    .filter(row => row[subIdCol] === subId)
    .map(row => ({
      projectId: row[projectIdCol],
      amount: parseFloat(row[amountCol]) || 0,
      date: row[dateCol],
      status: row[statusCol]
    }));

  // Calculate metrics
  const metrics = {
    invoiceCount: invoices.length,
    totalInvoiced: invoices.reduce((sum, inv) => sum + inv.amount, 0),
    uniqueProjects: [...new Set(invoices.map(inv => inv.projectId))].length,
    recentInvoices: invoices
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5),
    projectBreakdown: invoices.reduce((acc, inv) => {
      if (!acc[inv.projectId]) {
        acc[inv.projectId] = {
          count: 0,
          total: 0
        };
      }
      acc[inv.projectId].count++;
      acc[inv.projectId].total += inv.amount;
      return acc;
    }, {})
  };

  return { invoices, metrics };
}

function enrichSubcontractorData(subcontractor) {
  const { invoices, metrics } = getSubcontractorDetails(subcontractor.subId);
  
  // Get project details for active projects
  const projectIds = [...new Set(invoices.map(inv => inv.projectId))];
  const projects = getProjectsByIds(projectIds);
  
  const activeProjects = projects.filter(p => p.status === 'IN_PROGRESS');
  const completedProjects = projects.filter(p => p.status === 'COMPLETED');

  return {
    ...subcontractor,
    metrics: {
      ...metrics,
      activeProjects: activeProjects.length,
      completedProjects: completedProjects.length
    },
    recentInvoices: metrics.recentInvoices,
    projects: projects
  };
}

// ==========================================
// ENHANCED VENDOR FUNCTIONS
// ==========================================

function getVendorDetails(vendorId) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.MATERIALS_RECEIPTS);
  
  // Get all receipts for this vendor
  const vendorIdCol = headers.indexOf("VendorID");
  const projectIdCol = headers.indexOf("ProjectID");
  const amountCol = headers.indexOf("Amount");
  const dateCol = headers.indexOf("DateCreated");
  const categoryCol = headers.indexOf("Category");
  const receiptIdCol = headers.indexOf("ReceiptID");
  const receiptDocURLCol = headers.indexOf("ReceiptDocURL");
  
  const receipts = rows
    .filter(row => row[vendorIdCol] === vendorId)
    .map(row => ({
      id: row[receiptIdCol],
      receiptId: row[receiptIdCol],
      projectId: row[projectIdCol],
      amount: parseFloat(row[amountCol]) || 0,
      date: row[dateCol],
      category: row[categoryCol] || 'Uncategorized',
      receiptDocURL: row[receiptDocURLCol] || ''
    }));

  // Calculate metrics
  const metrics = {
    receiptCount: receipts.length,
    totalSpent: receipts.reduce((sum, rec) => sum + rec.amount, 0),
    uniqueProjects: [...new Set(receipts.map(rec => rec.projectId))].length,
    recentPurchases: receipts
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5),
    categoryBreakdown: receipts.reduce((acc, rec) => {
      const category = rec.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = {
          count: 0,
          total: 0
        };
      }
      acc[category].count++;
      acc[category].total += rec.amount;
      return acc;
    }, {})
  };

  return { receipts, metrics };
}

function enrichVendorData(vendor) {
  const { receipts, metrics } = getVendorDetails(vendor.vendorId);
  
  // Get project details
  const projectIds = [...new Set(receipts.map(rec => rec.projectId))];
  const projects = getProjectsByIds(projectIds);

  return {
    ...vendor,
    metrics,
    recentPurchases: metrics.recentPurchases,
    projects: projects
  };
}

// Helper function to get projects by IDs
function getProjectsByIds(projectIds) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.PROJECTS);
  
  const projectIdCol = headers.indexOf("ProjectID");
  const nameCol = headers.indexOf("ProjectName");
  const statusCol = headers.indexOf("Status");
  
  return rows
    .filter(row => projectIds.includes(row[projectIdCol]))
    .map(row => ({
      projectId: row[projectIdCol],
      name: row[nameCol],
      status: row[statusCol]
    }));
}

function getVendorById(vendorId) {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.VENDORS);
  
  const vendorIdCol = headers.indexOf("VendorID");
  const vendorNameCol = headers.indexOf("VendorName");
  const addressCol = headers.indexOf("Address");
  const cityCol = headers.indexOf("City");
  const stateCol = headers.indexOf("State");
  const zipCol = headers.indexOf("Zip");
  const emailCol = headers.indexOf("Email");
  const phoneCol = headers.indexOf("Phone");
  const statusCol = headers.indexOf("Status");
  const createdOnCol = headers.indexOf("CreatedOn");
  const categoryCol = headers.indexOf("Category") || -1;
  
  const vendorRow = rows.find(row => row[vendorIdCol] === vendorId);
  
  if (!vendorRow) return null;
  
  return {
    vendorId: vendorRow[vendorIdCol],
    vendorName: vendorRow[vendorNameCol],
    address: vendorRow[addressCol],
    city: vendorRow[cityCol],
    state: vendorRow[stateCol],
    zip: vendorRow[zipCol],
    email: vendorRow[emailCol],
    phone: vendorRow[phoneCol],
    status: vendorRow[statusCol] || 'Active',
    createdDate: vendorRow[createdOnCol] || null,
    category: categoryCol !== -1 ? vendorRow[categoryCol] : ''
  };
}

function getMaterialsReceiptsByVendor(vendorId) {
  const sheet = getSheet(CONFIG.SHEETS.MATERIALS_RECEIPTS);
  if (!sheet) {
    console.error('Materials Receipts sheet not found');
    return [];
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // Find column indices based on headers
  const receiptIdCol = headers.indexOf("ReceiptID");
  const projectIdCol = headers.indexOf("ProjectID");
  const vendorIdCol = headers.indexOf("VendorID");
  const vendorNameCol = headers.indexOf("VendorName");
  const amountCol = headers.indexOf("Amount");
  const receiptDocURLCol = headers.indexOf("ReceiptDocURL");
  const submittingUserCol = headers.indexOf("SubmittingUser");
  const timestampCol = headers.indexOf("Timestamp");
  const descriptionCol = headers.indexOf("Description");  // May not exist
  
  console.log('Searching for receipts with vendorId:', vendorId);
  
  // Filter rows for this vendor
  const vendorReceipts = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (row[vendorIdCol] === vendorId) {
      vendorReceipts.push({
        id: row[receiptIdCol],
        projectId: row[projectIdCol],
        vendorId: row[vendorIdCol],
        vendorName: row[vendorNameCol],
        amount: row[amountCol],
        receiptDocURL: row[receiptDocURLCol] || '',
        submittingUser: row[submittingUserCol] || '',
        timestamp: row[timestampCol],
        createdOn: row[timestampCol],
        description: descriptionCol !== -1 ? row[descriptionCol] : 'Materials purchase'
      });
    }
  }
  
  console.log(`Found ${vendorReceipts.length} receipts for vendor ${vendorId}`);
  return vendorReceipts;
}

function updateVendorName(vendorId, newName) {
  const sheet = getSheet(CONFIG.SHEETS.VENDORS);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  
  const vendorIdCol = headers.indexOf("VendorID");
  const nameCol = headers.indexOf("VendorName");
  
  const rowIndex = values.findIndex(row => row[vendorIdCol] === vendorId);
  if (rowIndex === -1) throw new Error("Vendor not found");
  
  // Update the vendor name
  sheet.getRange(rowIndex + 1, nameCol + 1).setValue(newName);
  
  return { success: true };
}



