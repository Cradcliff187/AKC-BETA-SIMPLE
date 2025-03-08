function testGetVendorDetails() {
  // Replace with an actual vendor ID from your system
  const testVendorId = "VEND-001"; 
  
  try {
    Logger.log("=== Starting testGetVendorDetails ===");
    Logger.log("Testing with vendor ID: " + testVendorId);
    
    // Get basic vendor info first
    Logger.log("Fetching vendor data...");
    const vendors = getVendors();
    Logger.log("All vendors count: " + vendors.length);
    
    // Print all vendor IDs to help debug
    Logger.log("Available vendor IDs: " + vendors.map(v => v.vendorId).join(", "));
    
    const vendor = vendors.find(v => v.vendorId === testVendorId);
    Logger.log("Found vendor: " + (vendor ? JSON.stringify(vendor) : "NOT FOUND"));
    
    if (!vendor) {
      throw new Error('Vendor not found: ' + testVendorId);
    }
    
    // Get materials receipts
    Logger.log("Fetching materials receipts...");
    // Check if materials receipts sheet exists
    const sheet = getSheet(CONFIG.SHEETS.MATERIALS_RECEIPTS);
    if (!sheet) {
      throw new Error("Materials Receipts sheet not found");
    }
    
    // Log sheet structure
    const headers = sheet.getDataRange().getValues()[0];
    Logger.log("Materials receipt headers: " + headers.join(", "));
    
    // Test the new function
    const receipts = getMaterialsReceiptsByVendor(testVendorId);
    Logger.log("Found receipts count: " + receipts.length);
    
    if (receipts.length > 0) {
      Logger.log("First receipt sample: " + JSON.stringify(receipts[0]));
    }
    
    // Test full function
    const result = getVendorDetails(testVendorId);
    Logger.log("Full getVendorDetails result: " + JSON.stringify(result));
    
    return "Test completed successfully. Check logs for details.";
  } catch (error) {
    Logger.log("ERROR in testGetVendorDetails: " + error.message);
    Logger.log("Stack: " + error.stack);
    return "Test failed: " + error.message;
  }
}