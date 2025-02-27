function analyzeTemplateStructure() {
  try {
    // Get the template doc
    const doc = DocumentApp.openById(CONFIG.TEMPLATES.ESTIMATE.TEMPLATE_DOC_ID);
    const body = doc.getBody();
    let analysis = [];
    let depth = 0;

    // Helper function to add indented entries to analysis
    const addEntry = (text) => {
      analysis.push('  '.repeat(depth) + text);
    };

    // Analyze document margins
    addEntry('=== Document Settings ===');
    addEntry(`Margins (pt) - Top: ${body.getMarginTop()}, Bottom: ${body.getMarginBottom()}, Left: ${body.getMarginLeft()}, Right: ${body.getMarginRight()}`);
    addEntry('=== Document Elements ===');

    // Analyze each element in the body
    for (let i = 0; i < body.getNumChildren(); i++) {
      const element = body.getChild(i);
      const type = element.getType();
      
      // Start element analysis
      addEntry(`Element ${i + 1}: ${type}`);
      depth++;

      switch (type) {
        case DocumentApp.ElementType.PARAGRAPH:
          analyzeParagraph(element, addEntry);
          break;
          
        case DocumentApp.ElementType.TABLE:
          analyzeTable(element, addEntry);
          break;
          
        case DocumentApp.ElementType.LIST_ITEM:
          analyzeListItem(element, addEntry);
          break;

        case DocumentApp.ElementType.PAGE_BREAK:
          addEntry('** PAGE BREAK **');
          break;
      }
      
      depth--;
      addEntry('---'); // Separator between elements
    }

    // Log the analysis
    Logger.log('\nTemplate Structure Analysis:\n' + analysis.join('\n'));
    return analysis.join('\n');

  } catch (error) {
    Logger.log('Error analyzing template: ' + error.message);
    throw new Error('Failed to analyze template: ' + error.message);
  }
}

function analyzeParagraph(paragraph, addEntry) {
  const text = paragraph.getText();
  const style = paragraph.getAttributes();
  
  // Basic paragraph info
  addEntry(`Text: "${text}"`);
  addEntry(`Alignment: ${style[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT] || 'DEFAULT'}`);
  
  // Spacing
  addEntry(`Spacing Before: ${style[DocumentApp.Attribute.SPACING_BEFORE] || 0}pt`);
  addEntry(`Spacing After: ${style[DocumentApp.Attribute.SPACING_AFTER] || 0}pt`);
  addEntry(`Line Spacing: ${style[DocumentApp.Attribute.LINE_SPACING] || 'DEFAULT'}`);
  
  // Font settings
  if (text.length > 0) {
    const firstPosition = paragraph.getText().length - 1;
    const textStyle = paragraph.getAttributes();
    addEntry(`Font Family: ${textStyle[DocumentApp.Attribute.FONT_FAMILY] || 'DEFAULT'}`);
    addEntry(`Font Size: ${textStyle[DocumentApp.Attribute.FONT_SIZE] || 'DEFAULT'}`);
    addEntry(`Bold: ${textStyle[DocumentApp.Attribute.BOLD] || false}`);
    addEntry(`Italic: ${textStyle[DocumentApp.Attribute.ITALIC] || false}`);
  }

  // Check for placeholders
  if (text.includes('{{')) {
    addEntry('Contains placeholder(s):');
    const placeholders = text.match(/{{.*?}}/g);
    placeholders.forEach(p => addEntry(`  - ${p}`));
  }
}

function analyzeTable(table, addEntry) {
  addEntry(`Table: ${table.getNumRows()} rows × ${table.getRow(0).getNumCells()} columns`);
  addEntry('Border Width: ' + table.getBorderWidth());
  
  // Analyze each row
  for (let i = 0; i < table.getNumRows(); i++) {
    const row = table.getRow(i);
    addEntry(`Row ${i + 1}:`);
    
    // Analyze each cell
    for (let j = 0; j < row.getNumCells(); j++) {
      const cell = row.getCell(j);
      addEntry(`  Cell ${j + 1}:`);
      addEntry(`    Width: ${cell.getWidth()}`);
      addEntry(`    Padding - Top: ${cell.getPaddingTop()}, Bottom: ${cell.getPaddingBottom()}, Left: ${cell.getPaddingLeft()}, Right: ${cell.getPaddingRight()}`);
      
      // Get cell content
      const numChildren = cell.getNumChildren();
      if (numChildren > 0) {
        addEntry('    Content:');
        for (let k = 0; k < numChildren; k++) {
          const child = cell.getChild(k);
          if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
            addEntry(`      "${child.asParagraph().getText()}"`);
          }
        }
      }
    }
  }
}

function analyzeListItem(item, addEntry) {
  addEntry(`List Item: "${item.getText()}"`);
  addEntry(`Nesting Level: ${item.getNestingLevel()}`);
  addEntry(`Glyph Type: ${item.getGlyphType()}`);
  
  const textStyle = item.getAttributes();
  addEntry(`Font Size: ${textStyle[DocumentApp.Attribute.FONT_SIZE] || 'DEFAULT'}`);
  addEntry(`Bold: ${textStyle[DocumentApp.Attribute.BOLD] || false}`);
}

// Function to execute the analysis and show results in the log
function runTemplateAnalysis() {
  try {
    const analysis = analyzeTemplateStructure();
    Logger.log('Analysis completed successfully. Check the logs for details.');
    return analysis;
  } catch (error) {
    Logger.log('Error running analysis: ' + error.message);
    throw error;
  }
}