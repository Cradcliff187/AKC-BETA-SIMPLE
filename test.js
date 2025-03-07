function testDashboardSetup() {
  Logger.log('=== Testing Dashboard Setup ===');
  
  // 1. Test sheet access
  const sheets = {
    customers: CONFIG.SHEETS.CUSTOMERS,
    vendors: CONFIG.SHEETS.VENDORS,
    subcontractors: CONFIG.SHEETS.SUBCONTRACTORS,
    projects: CONFIG.SHEETS.PROJECTS
  };

  Logger.log('Testing sheet access and headers:');
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  Object.entries(sheets).forEach(([name, sheetName]) => {
    try {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        Logger.log(`- ${name}: NOT FOUND`);
        return;
      }

      const lastColumn = sheet.getLastColumn();
      const lastRow = sheet.getLastRow();
      
      if (lastColumn > 0 && lastRow > 0) {
        const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
        Logger.log(`- ${name} (${sheetName}): OK`);
        Logger.log(`  Headers: [${headers.join(', ')}]`);
      } else {
        Logger.log(`- ${name} (${sheetName}): OK (No headers found)`);
      }

    } catch (e) {
      Logger.log(`- ${name}: ERROR - ${e.message}`);
    }
  });

  // 2. Test data retrieval
  Logger.log('\nTesting data retrieval:');
  try {
    const analytics = getDashboardAnalytics();
    Logger.log('Dashboard Analytics Result:');
    Logger.log(JSON.stringify(analytics, null, 2));
  } catch (e) {
    Logger.log(`Error getting analytics: ${e.message}`);
  }

  // 3. Test component data
  Logger.log('\nTesting individual components:');
  const components = ['Customers', 'Vendors', 'Subcontractors'];
  
  components.forEach(comp => {
    try {
      const func = `get${comp}ForClient`;
      Logger.log(`Testing ${func}:`);
      const result = this[func]();
      Logger.log(`- Success: ${result.success}`);
      Logger.log(`- Data count: ${result.data ? result.data.length : 0}`);
      if (result.data && result.data.length > 0) {
        Logger.log(`- Sample record: ${JSON.stringify(result.data[0])}`);
      }
    } catch (e) {
      Logger.log(`- Error testing ${comp}: ${e.message}`);
    }
  });
}
