/**************************************
 * Code.js - Main Application Logic
 **************************************/

// ==========================================
// WEBAPP INITIALIZATION
// ==========================================

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('AKC LLC Management')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==========================================
// PROJECT MANAGEMENT
// ==========================================

function getProjects() {
  const context = 'getProjects';
  try {
    Logger.log('=== Starting getProjects ===');
    
    // Get projects from database with null check
    const projects = getActiveProjects();
    if (!projects) {
      Logger.log('getActiveProjects returned null');
      return createStandardResponse(false, null, 'No projects data available');
    }

    Logger.log(`Raw projects count: ${projects.length}`);
    
    // Basic validation
    if (!Array.isArray(projects)) {
      Logger.log('Projects is not an array');
      return createStandardResponse(false, null, 'Invalid projects data format');
    }

    // Log allowed statuses for debugging
    Logger.log(`Allowed statuses: ${JSON.stringify(MODULE_ACCESS_STATUSES)}`);
    
    // Validate each project has required fields
    const validProjects = projects.filter(p => {
      const isValid = p && 
                     p.id && 
                     p.name && 
                     typeof p.customerName !== 'undefined';
      if (!isValid) {
        Logger.log(`Invalid project found: ${JSON.stringify(p)}`);
      }
      return isValid;
    });

    Logger.log(`Valid projects count: ${validProjects.length}`);
    
    // Always return a valid response object
    return createStandardResponse(
      true, 
      validProjects, 
      validProjects.length === 0 ? 'No active projects found' : null
    );

  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return createStandardResponse(false, null, `Failed to get projects: ${error.message}`);
  }
}

function setWorkspacePermissions(folders) {
  const DOMAIN = 'austinkunzconstruction.com';

  // Helper function to set permissions on a single folder
  const setFolderPermission = (folderId) => {
    try {
      Logger.log('Setting permissions for folder: ' + folderId);
      
      // First verify we can access the folder
      const folder = DriveApp.getFolderById(folderId);
      Logger.log('Found folder: ' + folder.getName());
      
      // Create the permission using proven working configuration
      const permissionResource = {
        'type': 'domain',
        'role': 'writer',
        'domain': DOMAIN
      };

      const createResponse = Drive.Permissions.create(
        permissionResource,
        folderId,
        {
          'supportsAllDrives': true,
          'fields': 'id'
        }
      );
      
      Logger.log(`Permission created for ${folder.getName()} with ID: ${createResponse.id}`);
      return true;
    } catch (error) {
      Logger.log(`Error setting permissions for folder ${folderId}: ${error.message}`);
      return false;
    }
  };

  // Get all folder IDs to process
  const folderIds = new Set();

  // Add main folder
  if (folders.main) {
    folderIds.add(folders.main);
  } else if (folders.folderId) {
    folderIds.add(folders.folderId);
  }

  // Add subfolders
  if (folders.estimates) folderIds.add(folders.estimates);
  if (folders.materials) folderIds.add(folders.materials);
  if (folders.subInvoices) folderIds.add(folders.subInvoices);
  
  Logger.log('Processing permissions for folders: ' + Array.from(folderIds).join(', '));

  // Set permissions for each folder
  let allSuccessful = true;
  for (const folderId of folderIds) {
    if (!setFolderPermission(folderId)) {
      allSuccessful = false;
    }
  }
  
  return allSuccessful;
}

function createProject(data) {
  const context = 'createProject';
  try {
    // 1) Validate required fields
    const requiredFields = ['customerId', 'projectName'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error);
    }

    // 2) Get customer data to ensure we have all necessary info
    const customers = getCustomerData();
    const customer = customers.find(c => c.customerId === data.customerId);
    if (!customer) {
      return createStandardResponse(false, null, 'Customer not found');
    }

    // 3) Create project record with enriched data
    const result = createProjectRecord({
      ...data,
      customerName: customer.name, // Add customer name for folder creation
      customerInfo: customer // Pass full customer info if needed
    });

    // 4) Set workspace permissions on all created folders
    const permissionsResult = setWorkspacePermissions(result.data.folders);
    if (!permissionsResult) {
      Logger.log(`Warning: Permissions setting may have failed for some folders in project ${result.data.projectId}`);
    }

    // 5) Log activity with enriched data
    logSystemActivity(
      'PROJECT_CREATED',
      'PROJECT',
      result.data.projectId,
      {
        customerId: data.customerId,
        customerName: customer.name,
        projectName: data.projectName,
        folderId: result.data.folderId,
        folders: result.data.folders,
        status: result.data.status
      }
    );

    // 6) Return the newly created project (ensure folders is in data)
    return createStandardResponse(true, {
      ...result.data,
      folders: result.data.folders  // Ensure folders is included
    });
  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return handleError(error, context);
  }
}

// ==========================================
// TIME LOGGING
// ==========================================

function getTimeEntries() {
  const context = 'getTimeEntries';
  try {
    const sheet = getSheet(CONFIG.SHEETS.TIME_LOGS);
    if (!sheet) {
      return createStandardResponse(false, null, "Time Logs sheet not found");
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const entries = data.slice(1).map(row => {
      return {
        id: row[0],
        projectId: row[1],
        date: row[2],
        startTime: row[3],
        endTime: row[4],
        hours: row[5],
        submittingUser: row[6],
        forUserEmail: row[7],
        timestamp: row[8],
        type: row[9] || 'regular'
      };
    });

    return createStandardResponse(true, entries);
  } catch (error) {
    return handleError(error, context);
  }
}

function submitTimeLog(data) {
  const context = 'submitTimeLog';
  try {
    // Validate required fields
    const requiredFields = ['date', 'startTime', 'endTime', 'projectId'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error);
    }

    const submittingUser = Session.getActiveUser().getEmail();

    // Calculate hours
    const startTime = new Date(`${data.date} ${data.startTime}`);
    const endTime = new Date(`${data.date} ${data.endTime}`);
    const hours = (endTime - startTime) / (1000 * 60 * 60);

    if (hours <= 0) {
      return createStandardResponse(false, null, "End time must be after start time");
    }

    // Insert into DB
    const result = logTime({
      projectId: data.projectId,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      hours: hours,
      submittingUser,
      forUserEmail: data.forUserEmail || ''
    });

    // Log activity
    logSystemActivity(
      'TIME_LOG_CREATED',
      'TIME',
      result.id,
      {
        projectId: data.projectId,
        date: data.date,
        hours: hours,
        forUserEmail: data.forUserEmail || submittingUser,
        timeLogId: result.id
      }
    );

    return createStandardResponse(true, result);
  } catch (error) {
    return handleError(error, context);
  }
}

function createTimeEntry(data) {
  const context = 'createTimeEntry';
  try {
    // Validate required fields
    const requiredFields = ['date', 'projectId', 'hours', 'description', 'type'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error);
    }

    const submittingUser = Session.getActiveUser().getEmail();
    const timeEntryId = "TE" + new Date().getTime();

    // Insert into TIME_LOGS sheet
    const sheet = getSheet(CONFIG.SHEETS.TIME_LOGS);
    if (!sheet) {
      return createStandardResponse(false, null, "Time Logs sheet not found");
    }

    // Add the time entry row
    sheet.appendRow([
      timeEntryId,
      data.projectId,
      data.date,
      data.startTime || '',
      data.endTime || '',
      data.hours,
      submittingUser,
      data.forUserEmail || '',
      new Date(),
      data.type || 'regular',
      data.description
    ]);

    // Log activity
    logSystemActivity(
      'TIME_ENTRY_CREATED',
      'TIME',
      timeEntryId,
      {
        projectId: data.projectId,
        date: data.date,
        hours: data.hours,
        type: data.type,
        description: data.description,
        submittingUser
      }
    );

    return createStandardResponse(true, {
      id: timeEntryId,
      date: data.date,
      hours: data.hours,
      type: data.type,
      description: data.description
    });
  } catch (error) {
    return handleError(error, context);
  }
}

function updateTimeEntry(data) {
  const context = 'updateTimeEntry';
  try {
    // Validate required fields
    const requiredFields = ['id', 'date', 'projectId', 'hours', 'description', 'type'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error);
    }

    const sheet = getSheet(CONFIG.SHEETS.TIME_LOGS);
    if (!sheet) {
      return createStandardResponse(false, null, "Time Logs sheet not found");
    }

    // Find the row with the time entry ID
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const idCol = headers.indexOf('TimeEntryID');
    if (idCol === -1) {
      return createStandardResponse(false, null, "TimeEntryID column not found");
    }

    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][idCol] === data.id) {
        rowIndex = i + 1; // Adding 1 because sheet rows are 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      return createStandardResponse(false, null, "Time entry not found");
    }

    // Update the time entry fields
    const projectIdCol = headers.indexOf('ProjectID');
    const dateCol = headers.indexOf('Date');
    const startTimeCol = headers.indexOf('StartTime');
    const endTimeCol = headers.indexOf('EndTime');
    const hoursCol = headers.indexOf('Hours');
    const typeCol = headers.indexOf('Type');
    const descriptionCol = headers.indexOf('Description');

    if (projectIdCol !== -1) sheet.getRange(rowIndex, projectIdCol + 1).setValue(data.projectId);
    if (dateCol !== -1) sheet.getRange(rowIndex, dateCol + 1).setValue(data.date);
    if (startTimeCol !== -1) sheet.getRange(rowIndex, startTimeCol + 1).setValue(data.startTime || '');
    if (endTimeCol !== -1) sheet.getRange(rowIndex, endTimeCol + 1).setValue(data.endTime || '');
    if (hoursCol !== -1) sheet.getRange(rowIndex, hoursCol + 1).setValue(data.hours);
    if (typeCol !== -1) sheet.getRange(rowIndex, typeCol + 1).setValue(data.type || 'regular');
    if (descriptionCol !== -1) sheet.getRange(rowIndex, descriptionCol + 1).setValue(data.description);

    // Log activity
    logSystemActivity(
      'TIME_ENTRY_UPDATED',
      'TIME',
      data.id,
      {
        projectId: data.projectId,
        date: data.date,
        hours: data.hours,
        type: data.type,
        description: data.description,
        updatedBy: Session.getActiveUser().getEmail()
      }
    );

    return createStandardResponse(true, data);
  } catch (error) {
    return handleError(error, context);
  }
}

function deleteTimeEntry(id) {
  const context = 'deleteTimeEntry';
  try {
    if (!id) {
      return createStandardResponse(false, null, "Time entry ID is required");
    }

    const sheet = getSheet(CONFIG.SHEETS.TIME_LOGS);
    if (!sheet) {
      return createStandardResponse(false, null, "Time Logs sheet not found");
    }

    // Find the row with the time entry ID
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const idCol = headers.indexOf('TimeEntryID');
    if (idCol === -1) {
      return createStandardResponse(false, null, "TimeEntryID column not found");
    }

    let rowIndex = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][idCol] === id) {
        rowIndex = i + 1; // Adding 1 because sheet rows are 1-indexed
        break;
      }
    }

    if (rowIndex === -1) {
      return createStandardResponse(false, null, "Time entry not found");
    }

    // Delete the row
    sheet.deleteRow(rowIndex);

    // Log activity
    logSystemActivity(
      'TIME_ENTRY_DELETED',
      'TIME',
      id,
      {
        deletedBy: Session.getActiveUser().getEmail()
      }
    );

    return createStandardResponse(true, { id: id });
  } catch (error) {
    return handleError(error, context);
  }
}

// ==========================================
// MATERIALS RECEIPT MANAGEMENT
// ==========================================

function getMaterialsReceipts() {
  const context = 'getMaterialsReceipts';
  try {
    const sheet = getSheet(CONFIG.SHEETS.MATERIALS_RECEIPTS);
    if (!sheet) {
      return createStandardResponse(false, null, "Materials Receipts sheet not found");
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const receipts = data.slice(1).map(row => {
      return {
        id: row[0],
        projectId: row[1],
        vendorId: row[2],
        vendorName: row[3],
        amount: row[4],
        receiptDocURL: row[5],
        submittingUser: row[6],
        forUserEmail: row[7],
        timestamp: row[8]
      };
    });

    return createStandardResponse(true, receipts);
  } catch (error) {
    return handleError(error, context);
  }
}

function submitMaterialsReceipt(data) {
  const context = 'submitMaterialsReceipt';
  try {
    // Validate required fields
    const requiredFields = ['projectId', 'vendorId', 'vendorName', 'amount'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error);
    }

    // Validate amount is a positive number
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      return createStandardResponse(false, null, "Amount must be a positive number");
    }

    const submittingUser = Session.getActiveUser().getEmail();

    // Insert into DB
    const result = logMaterialsReceipt({
      projectId: data.projectId,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
      amount: amount,
      receiptDocURL: data.receiptDocURL || '',
      submittingUser,
      forUserEmail: data.forUserEmail || ''
    });

    // Optionally, if you want the 2-step approach like estimates:
    // (Already appended row, so now let's update if docURL is present)
    if (result && result.id && data.receiptDocURL) {
      updateMaterialsReceiptDocUrl(result.id, data.receiptDocURL, "");
    }

    // Log activity using standardized function
    logSystemActivity(
      'MATERIALS_RECEIPT_CREATED',
      'MATERIALS',
      result.id,
      {
        projectId: data.projectId,
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        amount: amount,
        receiptDocURL: data.receiptDocURL || '',
        forUserEmail: data.forUserEmail || submittingUser
      }
    );

    return createStandardResponse(true, {
      id: result.id,
      amount: formatCurrency(amount),
      timestamp: formatDate(new Date(), 'iso')
    });
  } catch (error) {
    return handleError(error, context);
  }
}

function getVendorsForClient() {
  const context = 'getVendorsForClient';
  try {
    Logger.log('=== Starting getVendorsForClient ===');
    const vendors = getVendors();
    Logger.log(`Retrieved ${vendors ? vendors.length : 0} vendors`);
    Logger.log('First vendor:', vendors && vendors.length > 0 ? JSON.stringify(vendors[0]) : 'No vendors found');
    return createStandardResponse(true, vendors);
  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return handleError(error, context);
  }
}

function createVendorForClient(data) {
  const context = 'createVendorForClient';
  try {
    Logger.log('=== Starting createVendorForClient ===');
    Logger.log('Input data: ' + JSON.stringify(data));

    // Validate input - expanded for all fields
    if (!data || !data.vendorName) {
      Logger.log('Error: Missing vendorName in input');
      return createStandardResponse(false, null, 'Vendor name is required');
    }

    // Clean and format data
    const cleanedData = {
      vendorName: data.vendorName.trim(),
      address: (data.address || '').trim(),
      city: (data.city || '').trim(),
      state: (data.state || '').trim(),
      zip: (data.zip || '').trim(),
      email: (data.email || '').trim(),
      phone: (data.phone || '').trim()
    };

    // Create vendor
    Logger.log('Creating vendor with data: ' + JSON.stringify(cleanedData));
    const result = createVendor(cleanedData);
    Logger.log('Create vendor result: ' + JSON.stringify(result));

    if (!result || !result.success) {
      Logger.log('Error: Vendor creation failed');
      return createStandardResponse(false, null, 'Failed to create vendor');
    }

    // Log activity
    logSystemActivity(
      'VENDOR_CREATED',
      'VENDOR',
      result.data.vendorId,
      cleanedData
    );

    Logger.log('Vendor created successfully: ' + JSON.stringify(result.data));
    
    // Return standardized response with all vendor data
    return createStandardResponse(true, {
      vendorId: result.data.vendorId,
      vendorName: cleanedData.vendorName,
      address: cleanedData.address,
      city: cleanedData.city,
      state: cleanedData.state,
      zip: cleanedData.zip,
      email: cleanedData.email,
      phone: cleanedData.phone,
      status: 'ACTIVE'
    });

  } catch (error) {
    Logger.log('Error in createVendorForClient: ' + error.message);
    Logger.log('Stack: ' + error.stack);
    return createStandardResponse(false, null, error.message);
  }
}

// ==========================================
// SUBCONTRACTOR MANAGEMENT
// ==========================================

function getSubcontractorsForClient() {
  try {
    const subcontractors = getSubcontractors();
    return { success: true, data: subcontractors };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function submitSubInvoice(data) {
  const context = 'submitSubInvoice';
  try {
    const requiredFields = ['projectId', 'projectName', 'subId', 'subName', 'invoiceAmount'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error);
    }

    const submittingUser = Session.getActiveUser().getEmail();

    // Validate amount
    const amount = parseFloat(data.invoiceAmount);
    if (isNaN(amount) || amount <= 0) {
      return createStandardResponse(false, null, "Invoice amount must be a positive number");
    }

    const result = logSubInvoice({
      projectId: data.projectId,
      projectName: data.projectName,
      subId: data.subId,
      subName: data.subName,
      invoiceAmount: amount,
      invoiceDocURL: data.invoiceDocURL || '',
      submittingUser
    });

    // Optionally update the doc URL after logging
    if (result && result.id && data.invoiceDocURL) {
      updateSubInvoiceDocUrl(result.id, data.invoiceDocURL, "");
    }

    logSystemActivity(
      'SUBINVOICE_CREATED',
      'SUBINVOICE',
      result.id,
      {
        projectId: data.projectId,
        projectName: data.projectName,
        subId: data.subId,
        subName: data.subName,
        invoiceAmount: formatCurrency(amount),
        invoiceDocURL: data.invoiceDocURL || ''
      }
    );

    return createStandardResponse(true, {
      id: result.id,
      amount: formatCurrency(amount)
    });
  } catch (error) {
    return handleError(error, context);
  }
}

function createSubcontractor(data) {
  const context = 'createSubcontractor';
  try {
    Logger.log('Creating subcontractor with data:', data);
    const result = Database.createSubcontractor(data);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create subcontractor');
    }

    // Log activity
    logSystemActivity(
      'SUBCONTRACTOR_CREATED',
      'SUBCONTRACTOR',
      result.data.subId,
      {
        ...result.data,
        createdBy: Session.getActiveUser().getEmail()
      }
    );

    return createStandardResponse(true, result.data);
  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    return createStandardResponse(false, null, error.message);
  }
}

// ==========================================
// CUSTOMER MANAGEMENT
// ==========================================

function getCustomersForClient() {
  try {
    Logger.log('=== Starting getCustomersForClient ===');
    // Use the consolidated getCustomers function from Database.js
    const customers = getCustomers();
    return createStandardResponse(true, customers);
  } catch (error) {
    Logger.log('ERROR in getCustomersForClient:', error.message);
    Logger.log('Stack:', error.stack);
    return createStandardResponse(false, null, `Error getting customers: ${error.message}`);
  }
}

// Utility function for standard response format
function createStandardResponse(success, data = null, error = null) {
  const response = { success };
  if (success) {
    response.data = data;
  } else {
    response.error = error || 'Unknown error occurred';
  }
  return response;
}

function createCustomer(data) {
  const context = 'createCustomer';
  try {
    // Validate required fields
    if (!data || !data.name) {
      return createStandardResponse(false, null, 'Customer name is required');
    }

    // Clean data
    const cleanedData = {
      name: data.name.trim(),
      address: (data.address || '').trim(),
      city: (data.city || '').trim(),
      state: (data.state || '').trim(),
      zip: (data.zip || '').trim(),
      email: (data.email || '').trim(),
      phone: (data.phone || '').trim()
    };

    Logger.log('Creating customer with data:', cleanedData);

    // Create customer record
    const result = createCustomerRecord(cleanedData);
    
    if (!result || !result.success) {
      Logger.log('Customer creation failed:', result);
      return createStandardResponse(false, null, 'Failed to create customer record');
    }

    // Log activity
    logSystemActivity(
      'CUSTOMER_CREATED',
      'CUSTOMER',
      result.data.customerId,
      cleanedData
    );

    Logger.log('Customer created successfully:', result.data);
    return createStandardResponse(true, result.data);

  } catch (error) {
    Logger.log(`Error in ${context}:`, error);
    return createStandardResponse(false, null, error.message || 'Failed to create customer');
  }
}

// ==========================================
// FILE UPLOAD HANDLERS
// ==========================================

function uploadReceiptFile(base64Data, folderId, fileType = 'MATREC') {
  const context = 'uploadReceiptFile';
  try {
    // Extensive logging
    Logger.log('=== Upload Receipt File Start ===');
    Logger.log('Received base64Data length: ' + base64Data.length);
    Logger.log('Folder ID: ' + folderId);
    Logger.log('Folder ID Type: ' + typeof folderId);
    Logger.log('File Type: ' + fileType);

    // Validate required inputs
    if (!base64Data || !folderId) {
      Logger.log('Missing base64 data or folder ID');
      return createStandardResponse(false, null, "Missing base64 data or folder ID");
    }

    // Validate folder ID
    if (typeof folderId !== 'string' || folderId.trim() === '') {
      Logger.log('Invalid folder ID format');
      return createStandardResponse(false, null, "Invalid folder ID format");
    }

    // More robust MIME type extraction
    const mimeTypeMatch = base64Data.match(/^data:(.*?);base64,/);
    if (!mimeTypeMatch) {
      Logger.log('Invalid base64 data format');
      return createStandardResponse(false, null, "Invalid base64 data format");
    }

    const mimeType = mimeTypeMatch[1];
    const fileExtension = mimeType.split('/')[1];

    Logger.log('Detected MIME Type: ' + mimeType);
    Logger.log('File Extension: ' + fileExtension);

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(mimeType)) {
      Logger.log('Disallowed file type: ' + mimeType);
      return createStandardResponse(false, null, `File type ${mimeType} is not allowed`);
    }

    // Generate unique file ID
    const timestamp = new Date().getTime();
    const fileId = `${fileType}-${timestamp}`;

    // Additional error handling for base64 decoding
    let decodedData;
    try {
      decodedData = Utilities.base64Decode(base64Data.split(",")[1]);
      Logger.log('Successfully decoded base64 data');
    } catch (decodeError) {
      Logger.log('Base64 decoding error: ' + decodeError.message);
      return createStandardResponse(false, null, "Failed to decode base64 data");
    }

    // Create blob
    const fileBlob = Utilities.newBlob(
      decodedData,
      mimeType,
      `${fileId}.${fileExtension}`
    );

    // Validate file size (10MB max)
    const sizeValidation = validateFileSize(fileBlob.getBytes().length);
    if (!sizeValidation.valid) {
      Logger.log('File size validation failed');
      return createStandardResponse(false, null, sizeValidation.error);
    }

    // Verify folder exists with comprehensive debugging
    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
      Logger.log('Folder verified: ' + folder.getName());
      Logger.log('Folder ID: ' + folder.getId());
    } catch (folderError) {
      Logger.log('Folder verification failed: ' + folderError.message);
      return createStandardResponse(false, null, "Invalid folder ID: " + folderId);
    }

    // Upload to Drive with enhanced error handling
    let uploadedFile;
    try {
      const fileMetadata = {
        name: fileBlob.getName(),
        parents: [folderId],
        mimeType: fileBlob.getContentType()
      };

      uploadedFile = Drive.Files.create(fileMetadata, fileBlob, {
        supportsAllDrives: true
      });
      Logger.log('File uploaded successfully');
      Logger.log('File ID: ' + uploadedFile.id);
      Logger.log('File Name: ' + uploadedFile.name);
      Logger.log('File Type: ' + uploadedFile.mimeType);
      Logger.log('File Size: ' + uploadedFile.size);
      
      // Create the document URL
      const docUrl = `https://drive.google.com/file/d/${uploadedFile.id}/view`;
      Logger.log('Generated document URL:', docUrl);

      // Log activity
      logSystemActivity(
        'FILE_UPLOADED',
        'FILE_STORAGE',
        uploadedFile.id,
        {
          fileName: uploadedFile.name,
          fileType: fileType,
          mimeType: uploadedFile.mimeType,
          size: uploadedFile.size,
          originalFolderId: folderId,
          docUrl: docUrl
        }
      );

      // Return successful response
      return createStandardResponse(true, {
        url: docUrl,
        name: uploadedFile.name,
        mimeType: uploadedFile.mimeType,
        id: fileId,
        folderId: folderId,
        fileId: uploadedFile.id
      });

    } catch (uploadError) {
      Logger.log('Drive upload error: ' + uploadError.message);
      Logger.log('Full error object: ' + JSON.stringify(uploadError));
      return createStandardResponse(false, null, "Failed to upload file to Drive: " + uploadError.message);
    }

  } catch (error) {
    Logger.log('=== Unexpected Error in uploadReceiptFile ===');
    Logger.log('Error Message: ' + error.message);
    Logger.log('Error Stack: ' + error.stack);
    console.error('Unexpected error:', error);
    return handleError(error, context);
  }
}

function extractFolderIdFromUrl(folderUrl) {
  const urlPatterns = [
    /\/folders\/([a-zA-Z0-9-_]+)/,
    /\/drive\/folders\/([a-zA-Z0-9-_]+)/, 
    /id=([a-zA-Z0-9-_]+)/
  ];
  for (let pattern of urlPatterns) {
    const match = folderUrl.match(pattern);
    if (match && match[1]) return match[1];
  }
  throw new Error("Could not extract folder ID from the provided URL");
}

// ==========================================
// ESTIMATE DOCUMENT GENERATION
// ==========================================
function generateEstimateDocument(data) {
  try {
    Logger.log("=== Starting generateEstimateDocument ===");
    Logger.log("Input data: " + JSON.stringify(data));

    let finalEstimateId = data.estimateId || generateEstimateID(data.projectId);
    data.estimateId = finalEstimateId;

    // **IMPORTANT**: Use the folder ID passed in (e.g. the Estimates subfolder ID)
    const templateDoc = DriveApp.getFileById(CONFIG.TEMPLATES.ESTIMATE.TEMPLATE_DOC_ID);
    const folderId = data.projectFolderId || CONFIG.FOLDERS.PARENT_ID;  // <--- updated
    const projectFolder = DriveApp.getFolderById(folderId);

    const baseName = `Estimate-${finalEstimateId}`;
    const newDocFile = templateDoc.makeCopy(baseName, projectFolder);
    const doc = DocumentApp.openById(newDocFile.getId());
    const body = doc.getBody();
    // **IMPORTANT**: Use the folder ID passed in (e.g. the Estimates subfolder ID)
    // Replace standard placeholders
    const replacements = {
      '{{EstimateNumber}}': finalEstimateId,
      '{{Date}}': new Date().toLocaleDateString(),
      '{{CustomerName}}': data.customerName || '',
      '{{CustomerAddress}}': data.customerAddress || '',
      '{{CustomerCityStateZip}}': `${data.customerCity || ''}, ${data.customerState || ''} ${data.customerZip || ''}`,
      // Add new site location placeholders
      '{{SiteLocationAddress}}': data.siteLocationAddress || data.customerAddress || '',
      '{{SiteLocationCity}}': data.siteLocationCity || data.customerCity || '',
      '{{SiteLocationState}}': data.siteLocationState || data.customerState || '',
      '{{SiteLocationZip}}': data.siteLocationZip || data.customerZip || '',
      '{{PONumber}}': data.poNumber || '',
      '{{JobDescription}}': data.jobDescription || '',
      '{{EstimateAmount}}': formatCurrency(data.estimateAmount || 0),
      '{{ContingencyAmount}}': formatCurrency(data.contingencyAmount || 0)
    };
    for (let [placeholder, value] of Object.entries(replacements)) {
      body.replaceText(placeholder, value);
    }

    // Fill service items table (if any)
    const tables = body.getTables();
    for (let table of tables) {
      const headerText = table.getCell(0, 0).getText().trim();
      if (headerText === 'ITEM/SERVICE') {
        Logger.log("Found service items table");
        const safeParse = (str) => parseFloat(String(str).replace(/[^0-9.]/g, '')) || 0;

        for (let i = 0; i < data.tableItems.length && i < (table.getNumRows() - 1); i++) {
          const rowIndex = i + 1;
          const item = data.tableItems[i];
          const numericRate = safeParse(item.rate);
          const numericAmount = safeParse(item.amount);

          table.getCell(rowIndex, 0).clear().setText(item.itemService || '');
          table.getCell(rowIndex, 1).clear().setText(item.description || '');
          table.getCell(rowIndex, 2).clear().setText(item.qtyHours || '');
          table.getCell(rowIndex, 3).clear().setText(formatCurrency(numericRate));
          table.getCell(rowIndex, 4).clear().setText(formatCurrency(numericAmount));

          Logger.log(`Wrote row ${rowIndex}: ${JSON.stringify(item)}`);
        }

        // Clear leftover rows
        for (let i = data.tableItems.length + 1; i < table.getNumRows(); i++) {
          for (let j = 0; j < 5; j++) {
            table.getCell(i, j).clear();
          }
        }
        break;
      }
    }

    // Save & create PDF
    doc.saveAndClose();
    Utilities.sleep(1500); // ensure changes propagate
    const docFile = DriveApp.getFileById(newDocFile.getId());
    const pdfBlob = docFile.getAs('application/pdf');
    pdfBlob.setName(`${baseName}.pdf`);
    const savedPdf = projectFolder.createFile(pdfBlob);

    return {
      success: true,
      data: {
        docUrl: savedPdf.getUrl(),
        docId: savedPdf.getId(),
        estimateId: finalEstimateId
      }
    };

  } catch (error) {
    Logger.log(`Error in generateEstimateDocument: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
}

// Add new helper function to update project site location
function updateProjectSiteLocation(projectId, siteLocation) {
  const sheet = getSheet(CONFIG.SHEETS.PROJECTS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const projectIdCol = headers.indexOf('ProjectID');
  const siteAddressCol = headers.indexOf('SiteLocationAddress');
  const siteCityCol = headers.indexOf('SiteLocationCity');
  const siteStateCol = headers.indexOf('SiteLocationState');
  const siteZipCol = headers.indexOf('SiteLocationZip');

  const rowIndex = data.findIndex(row => row[projectIdCol] === projectId);
  if (rowIndex === -1) return;
  
  sheet.getRange(rowIndex + 1, siteAddressCol + 1).setValue(siteLocation.address);
  sheet.getRange(rowIndex + 1, siteCityCol + 1).setValue(siteLocation.city);
  sheet.getRange(rowIndex + 1, siteStateCol + 1).setValue(siteLocation.state);
  sheet.getRange(rowIndex + 1, siteZipCol + 1).setValue(siteLocation.zip);
}
  
// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function testGetTemplate() {
  Logger.log("Template Doc ID: " + CONFIG.TEMPLATES.ESTIMATE.TEMPLATE_DOC_ID);
  const file = DriveApp.getFileById(CONFIG.TEMPLATES.ESTIMATE.TEMPLATE_DOC_ID);
  Logger.log("Template URL: " + file.getUrl());
}

// ==========================================
// DATA SCHEMA AND STATUS CHANGE FUNCTIONS
// ==========================================

// Add to Code.gs - New client-facing functions
function updateEstimateStatusForClient(data) {
  const context = 'updateEstimateStatusForClient';
  try {
    Logger.log(`Starting status update for estimate ${data.estimateId} to ${data.newStatus}`);
    
    if (!data.estimateId || !data.newStatus) {
      throw new Error('Estimate ID and new status are required');
    }

    // Update status in spreadsheet
    const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const estimateIdCol = headers.indexOf("EstimateID");
    const statusCol = headers.indexOf("Status");
    
    const rowIndex = values.findIndex(row => row[estimateIdCol] === data.estimateId);
    if (rowIndex === -1) {
      throw new Error('Estimate not found');
    }

    // Get current status for validation
    const currentStatus = values[rowIndex][statusCol];

    // Validate the status transition
    validateStatusTransition(currentStatus, data.newStatus, 'ESTIMATE');

    // Update the status
    sheet.getRange(rowIndex + 1, statusCol + 1).setValue(data.newStatus);
    
    Logger.log(`Successfully updated estimate ${data.estimateId} status to ${data.newStatus}`);

    // Log activity
    logSystemActivity(
      'ESTIMATE_STATUS_CHANGED',
      'ESTIMATE',
      data.estimateId,
      {
        oldStatus: currentStatus,
        newStatus: data.newStatus,
        updatedBy: Session.getActiveUser().getEmail()
      }
    );

    return createStandardResponse(true, {
      estimateId: data.estimateId,
      oldStatus: currentStatus,
      newStatus: data.newStatus
    });
    
  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return createStandardResponse(false, null, error.message);
  }
}

function updateProjectStatusForClient(data) {
  const context = 'updateProjectStatusForClient';
  try {
    Logger.log(`Starting status update for project ${data.projectId} to ${data.newStatus}`);
    
    if (!data.projectId || !data.newStatus) {
      throw new Error('Project ID and new status are required');
    }

    // Get project using the new helper function
    const project = getProjectById(data.projectId);
    if (!project) {
      throw new Error(`Project ${data.projectId} not found`);
    }

    Logger.log(`Found project. Current status: ${project.status}`);

    // Validate the status transition
    validateStatusTransition(project.status, data.newStatus, 'PROJECT');

    // Update status in spreadsheet
    const sheet = getSheet(CONFIG.SHEETS.PROJECTS);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const projectIdCol = headers.indexOf("ProjectID");
    const statusCol = headers.indexOf("Status");
    
    const rowIndex = values.findIndex(row => row[projectIdCol] === data.projectId);
    if (rowIndex === -1) {
      throw new Error('Project row not found');
    }

    // Update the status
    sheet.getRange(rowIndex + 1, statusCol + 1).setValue(data.newStatus);
    
    Logger.log(`Successfully updated project ${data.projectId} status to ${data.newStatus}`);

    // Log the status change
    logSystemActivity(
      'PROJECT_STATUS_CHANGED',
      'PROJECT',
      data.projectId,
      {
        oldStatus: project.status,
        newStatus: data.newStatus,
        updatedBy: Session.getActiveUser().getEmail()
      }
    );

    return createStandardResponse(true, {
      projectId: data.projectId,
      oldStatus: project.status,
      newStatus: data.newStatus
    });
    
  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return createStandardResponse(false, null, error.message);
  }
}

// Helper function to check for open items
function checkForOpenItems(projectId) {
  // Add your logic to check for open items
  // Return true if there are open items, false otherwise
  return false;
}

function loadPreviousEstimateVersion(data) {
  const context = 'loadPreviousEstimateVersion';
  try {
    // Validate required fields
    const requiredFields = ['projectId', 'previousEstimateId'];
    const validation = validateRequiredFields(data, requiredFields);
    if (!validation.valid) {
      return createStandardResponse(false, null, validation.error);
    }

    // Get previous estimate data
    const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
    const estimates = sheet.getDataRange().getValues();
    const headers = estimates[0];

    const estimateRow = estimates.find(row => 
      row[headers.indexOf('EstimateID')] === data.previousEstimateId
    );

    if (!estimateRow) {
      return createStandardResponse(false, null, 'Previous estimate not found');
    }

    // Create template for new version - updated to remove unused fields
    const templateData = {
      projectId: data.projectId,
      estimateAmount: estimateRow[headers.indexOf('EstimateAmount')],
      contingencyAmount: estimateRow[headers.indexOf('ContingencyAmount')],
      siteLocationAddress: estimateRow[headers.indexOf('SiteLocationAddress')] || '',
      siteLocationCity: estimateRow[headers.indexOf('SiteLocationCity')] || '',
      siteLocationState: estimateRow[headers.indexOf('SiteLocationState')] || '',
      siteLocationZip: estimateRow[headers.indexOf('SiteLocationZip')] || ''
    };

    return createStandardResponse(true, templateData);
  } catch (error) {
    return handleError(error, context);
  }
}

function getModuleVisibility(projectId) {
  const context = 'getModuleVisibility';
  try {
    const sheet = getSheet(CONFIG.SHEETS.PROJECTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const projectIdCol = headers.indexOf('ProjectID');
    const statusCol = headers.indexOf('Status');
    
    const projectRow = data.find(row => row[projectIdCol] === projectId);
    if (!projectRow) {
      return createStandardResponse(false, null, 'Project not found');
    }

    const status = projectRow[statusCol];
    // Only show modules if project is APPROVED or IN_PROGRESS
    const modulesEnabled = ['APPROVED', 'IN_PROGRESS'].includes(status);

    return createStandardResponse(true, {
      timeLogging: modulesEnabled,
      materialsReceipts: modulesEnabled,
      subInvoices: modulesEnabled
    });
  } catch (error) {
    return handleError(error, context);
  }
}

// ==========================================
// CUSTOMER MANAGEMENT MODULE
// ==========================================

function getCustomerDetailsForClient(customerId) {
  const context = 'getCustomerDetailsForClient';
  try {
    const customers = getCustomerData();
    const customer = customers.find(c => c.customerId === customerId);
    
    if (!customer) {
      return createStandardResponse(false, null, 'Customer not found');
    }

    const enrichedCustomer = enrichCustomerData(customer);
    return createStandardResponse(true, enrichedCustomer);
  } catch (error) {
    return handleError(error, context);
  }
}

function updateCustomerStatus(data) {
  const context = 'updateCustomerStatus';
  try {
    const sheet = getSheet(CONFIG.SHEETS.CUSTOMERS);
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const customerIdCol = headers.indexOf("CustomerID");
    let statusCol = headers.indexOf("Status");
    const rowIndex = values.findIndex(row => row[customerIdCol] === data.customerId);
    // If Status column not found by name, use last column
    if (statusCol === -1) {
      statusCol = headers.length - 1;
    }

    Logger.log(`CustomerID column: ${customerIdCol}`);
    Logger.log(`Status column: ${statusCol}`);

    if (rowIndex === -1) {
      throw new Error('Customer not found');
    }

    // Update status with proper range validation
    if (rowIndex >= 0 && statusCol >= 0) {
      sheet.getRange(rowIndex + 1, statusCol + 1).setValue(data.newStatus);
      return createStandardResponse(true, {
        status: data.newStatus
      });
    } else {
      throw new Error('Invalid row or column index');
    }
  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return handleError(error, context);
  }
}

function getEstimateSheetHeaders() {
  const sheet = getSheet(CONFIG.SHEETS.ESTIMATES);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log("Estimate Sheet Headers: " + headers.join(", "));
  return createStandardResponse(true, headers);
}

function createAndSaveEstimate(data) {
  const context = 'createAndSaveEstimate';
  try {
    Logger.log(`=== ${context} called ===`);
    Logger.log(`Data received: ${JSON.stringify(data)}`);

    // 1) Log the estimate to the DB
    Logger.log('Logging estimate...');
    const logResult = logEstimate({
      ...data,
      totalAmount: parseFloat(data.amount) || 0,
      contingencyAmount: parseFloat(data.contingencyAmount) || 0,
      customerName: data.customerName, // Ensure customerName is passed through
      projectName: data.projectName, // Make sure this is included
      // Use the correct site location data based on selection
      siteLocationAddress: data.usePrimaryAddress ? data.customerAddress : data.siteLocationAddress,
      siteLocationCity: data.usePrimaryAddress ? data.customerCity : data.siteLocationCity,
      siteLocationState: data.usePrimaryAddress ? data.customerState : data.siteLocationState,
      siteLocationZip: data.usePrimaryAddress ? data.customerZip : data.siteLocationZip
    });

    const finalEstimateId = logResult.estimateId;

    // 2) Generate the document
    Logger.log('Generating estimate document...');
    const docResult = generateEstimateDocument({
      ...data,
      estimateId: finalEstimateId,
      projectFolderId: data.projectFolderId || (data.folders && data.folders.estimates)
    });

    if (!docResult.success) {
      throw new Error(docResult.error || 'Failed to generate estimate document');
    }

    // 3) Update doc URL & ID in database
    Logger.log(`Updating estimate doc URL for ID: ${finalEstimateId}`);
    const docUrl = docResult.data.docUrl;
    const docId = docResult.data.docId;
    updateEstimateDocUrl(finalEstimateId, docUrl, docId);

    // 4) Update project's site location if different from customer address
    if (!data.usePrimaryAddress) {
      updateProjectSiteLocation(data.projectId, {
        address: data.siteLocationAddress,
        city: data.siteLocationCity,
        state: data.siteLocationState,
        zip: data.siteLocationZip
      });
    }

    return {
      success: true,
      data: {
        estimateId: finalEstimateId,
        docUrl: docUrl,
        docId: docId
      }
    };
  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return { success: false, error: error.message };
  }
}

function getDashboardAnalytics() {
  try {
    const projects = getActiveProjects();
    const estimates = getEstimates();
    
    return createStandardResponse(true, {
      projects: {
        active: projects.filter(p => p.status === PROJECT_STATUSES.IN_PROGRESS).length,
        approved: projects.filter(p => p.status === PROJECT_STATUSES.APPROVED).length,
        total: projects.length
      },
      estimates: {
        pending: estimates.filter(e => e.status === ESTIMATE_STATUSES.PENDING).length,
        total: estimates.length
      }
    });
  } catch (error) {
    Logger.log('Error in getDashboardAnalytics:', error);
    return handleError(error, 'getDashboardAnalytics');
  }
}

// Fix getEstimates to include all necessary fields
function getEstimates() {
  const { headers, rows } = getSheetData(CONFIG.SHEETS.ESTIMATES);
  
  const estimateIdCol = headers.indexOf('EstimateID');
  const statusCol = headers.indexOf('Status');
  const projectIdCol = headers.indexOf('ProjectID');
  const customerNameCol = headers.indexOf('CustomerName');
  const amountCol = headers.indexOf('EstimateAmount');
  const dateCreatedCol = headers.indexOf('DateCreated');
  
  return rows.map(row => ({
    id: row[estimateIdCol], // For consistent id field
    estimateId: row[estimateIdCol], // Keep both for compatibility
    projectId: row[projectIdCol],
    status: row[statusCol],
    customerName: row[customerNameCol] || '',
    amount: row[amountCol] || 0,
    dateCreated: row[dateCreatedCol] ? new Date(row[dateCreatedCol]) : new Date()
  }));
}

// Fix getProjectsByStatus
function getProjectsByStatus(status) {
  const context = 'getProjectsByStatus';
  try {
    Logger.log(`Getting projects with status: ${status}`);
    
    // Get all projects
    const { headers, rows } = getSheetData(CONFIG.SHEETS.PROJECTS);
    
    const projectIdCol = headers.indexOf('ProjectID');
    const nameCol = headers.indexOf('ProjectName');
    const statusCol = headers.indexOf('Status');
    const customerNameCol = headers.indexOf('CustomerName');

    // Filter and map to include all required fields
    const filteredProjects = rows
      .filter(row => row[statusCol] === status)
      .map(row => ({
        id: row[projectIdCol],
        projectId: row[projectIdCol],
        name: row[nameCol],        // Project Name
        projectName: row[nameCol], // Include both for compatibility
        status: row[statusCol],
        customerName: row[customerNameCol] || ''
      }));

    Logger.log(`Found ${filteredProjects.length} projects with status ${status}`);
    
    return createStandardResponse(true, filteredProjects);
  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return createStandardResponse(false, [], error.message);
  }
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
    const projectNameCol = headers.indexOf('ProjectName');  // Make sure this exists

    const filteredEstimates = rows
      .filter(row => row[statusCol] === status)
      .map(row => ({
        id: row[estimateIdCol],
        estimateId: row[estimateIdCol],
        projectName: row[projectNameCol] || 'N/A',  // Project Name
        customerName: row[customerNameCol] || 'N/A',
        status: row[statusCol],
        amount: row[amountCol] || 0
      }));

    Logger.log(`Found ${filteredEstimates.length} estimates with status ${status}`);
    return createStandardResponse(true, filteredEstimates);
  } catch (error) {
    Logger.log(`Error in ${context}: ${error.message}`);
    Logger.log(`Stack: ${error.stack}`);
    return createStandardResponse(false, [], error.message);
  }
}

function getProjectDetails(projectId) {
  const context = 'getProjectDetails';
  try {
    const { headers, rows } = getSheetData(CONFIG.SHEETS.PROJECTS);
    
    const projectIdCol = headers.indexOf('ProjectID');
    const nameCol = headers.indexOf('ProjectName');
    const statusCol = headers.indexOf('Status');
    const customerNameCol = headers.indexOf('CustomerName');
    const jobDescriptionCol = headers.indexOf('JobDescription');
    const docUrlCol = headers.indexOf('DocUrl');
    const folderIdCol = headers.indexOf('FolderID');

    const projectRow = rows.find(row => row[projectIdCol] === projectId);
    
    if (!projectRow) {
      return createStandardResponse(false, null, 'Project not found');
    }

    return createStandardResponse(true, {
      id: projectRow[projectIdCol],
      name: projectRow[nameCol],
      status: projectRow[statusCol],
      customerName: projectRow[customerNameCol] || '',
      jobDescription: projectRow[jobDescriptionCol] || '',
      docUrl: projectRow[docUrlCol] || `https://drive.google.com/drive/folders/${projectRow[folderIdCol]}`,
      folderId: projectRow[folderIdCol]
    });
  } catch (error) {
    return handleError(error, context);
  }
}

function getEstimateDetails(estimateId) {
  const context = 'getEstimateDetails';
  try {
    const { headers, rows } = getSheetData(CONFIG.SHEETS.ESTIMATES);
    
    const estimateIdCol = headers.indexOf('EstimateID');
    const projectIdCol = headers.indexOf('ProjectID');
    const statusCol = headers.indexOf('Status');
    const customerNameCol = headers.indexOf('CustomerName');
    const amountCol = headers.indexOf('EstimateAmount');
    const docUrlCol = headers.indexOf('DocUrl');
    const jobDescriptionCol = headers.indexOf('JobDescription');

    const estimateRow = rows.find(row => row[estimateIdCol] === estimateId);
    
    if (!estimateRow) {
      return createStandardResponse(false, null, 'Estimate not found');
    }

    return createStandardResponse(true, {
      id: estimateRow[estimateIdCol],
      projectId: estimateRow[projectIdCol],
      status: estimateRow[statusCol],
      customerName: estimateRow[customerNameCol] || '',
      amount: estimateRow[amountCol] || 0,
      docUrl: estimateRow[docUrlCol] || '',
      jobDescription: estimateRow[jobDescriptionCol] || ''
    });
  } catch (error) {
    return handleError(error, context);
  }
}

// ==========================================
// ENHANCED CONTACT CARD FUNCTIONS
// ==========================================

function getSubcontractorDetailsForClient(subId) {
  const context = 'getSubcontractorDetailsForClient';
  try {
    const subcontractors = getSubcontractors();
    const subcontractor = subcontractors.find(s => s.subId === subId);
    
    if (!subcontractor) {
      return createStandardResponse(false, null, 'Subcontractor not found');
    }

    const enrichedSubcontractor = enrichSubcontractorData(subcontractor);
    return createStandardResponse(true, enrichedSubcontractor);
  } catch (error) {
    return handleError(error, context);
  }
}

function getVendorDetailsForClient(vendorId) {
  const context = 'getVendorDetailsForClient';
  try {
    const vendors = getVendors();
    const vendor = vendors.find(v => v.vendorId === vendorId);
    
    if (!vendor) {
      return createStandardResponse(false, null, 'Vendor not found');
    }

    const enrichedVendor = enrichVendorData(vendor);
    return createStandardResponse(true, enrichedVendor);
  } catch (error) {
    return handleError(error, context);
  }
}

function getVendorDetails(vendorId) {
  const context = 'getVendorDetails';
  try {
    console.log('Getting details for vendor:', vendorId);
    
    // Get vendor from existing getVendors function and filter
    const vendors = getVendors();
    console.log('All vendors:', vendors);
    
    const vendor = vendors.find(v => v.vendorId === vendorId);
    console.log('Found vendor:', vendor);
    
    if (!vendor) {
      console.error('Vendor not found:', vendorId);
      return { 
        receipts: [], 
        metrics: { 
          receiptCount: 0, 
          totalSpent: 0, 
          uniqueProjects: 0, 
          recentPurchases: [], 
          categoryBreakdown: {} 
        },
        vendor: null
      };
    }
    
    // Get materials receipts for this vendor
    const receipts = getMaterialsReceiptsByVendor(vendorId);
    console.log('Found receipts:', receipts.length);
    
    // Calculate metrics
    const metrics = {
      receiptCount: receipts.length,
      totalSpent: receipts.reduce((sum, rec) => sum + (parseFloat(rec.amount) || 0), 0),
      uniqueProjects: [...new Set(receipts.map(rec => rec.projectId))].length,
      recentPurchases: receipts
        .sort((a, b) => new Date(b.createdOn || b.timestamp) - new Date(a.createdOn || a.timestamp))
        .slice(0, 5),
      categoryBreakdown: receipts.reduce((acc, rec) => {
        const category = rec.category || 'Uncategorized';
        if (!acc[category]) {
          acc[category] = { count: 0, total: 0 };
        }
        acc[category].count++;
        acc[category].total += parseFloat(rec.amount) || 0;
        return acc;
      }, {})
    };

    // Log the full details being returned
    console.log('Receipt sample:', receipts[0]);
    console.log('Recent purchases sample:', metrics.recentPurchases[0]);

    return { 
      receipts, 
      metrics,
      vendor
    };
  } catch (error) {
    console.error('Error in getVendorDetails:', error);
    return { 
      receipts: [], 
      metrics: { 
        receiptCount: 0, 
        totalSpent: 0, 
        uniqueProjects: 0, 
        recentPurchases: [], 
        categoryBreakdown: {} 
      },
      vendor: null
    };
  }
}

// Also update getMaterialsReceiptsByVendor to ensure consistent vendor information
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

function updateVendorNameForClient(vendorId, newName) {
  const context = 'updateVendorNameForClient';
  try {
    const result = updateVendorName(vendorId, newName);
    return createStandardResponse(true, result);
  } catch (error) {
    return handleError(error, context);
  }
}