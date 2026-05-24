// rebma-web/src/utils/export.ts

export const exportToCSV = (data: any[], headers: string[], fileName: string) => {
  const csvRows = [];
  // Header row
  csvRows.push(headers.map(h => `"${h.toUpperCase()}"`).join(','));
  
  // Data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] !== undefined && row[header] !== null ? row[header] : '';
      let strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
      // Escape double quotes
      const escaped = strVal.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (title: string, data: any[], headers: string[]) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Popup blocker prevented report window from opening.");
    return;
  }
  
  let rowsHtml = '';
  data.forEach(row => {
    rowsHtml += '<tr>';
    headers.forEach(header => {
      let val = row[header] !== undefined && row[header] !== null ? row[header] : '';
      if (typeof val === 'object') {
        val = JSON.stringify(val);
      }
      rowsHtml += `<td>${val}</td>`;
    });
    rowsHtml += '</tr>';
  });
  
  printWindow.document.write(`
    <html>
      <head>
        <title>REMBA IMPEX GHANA LIMITED - ${title}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1e293b; background: #ffffff; }
          .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #0298d0; padding-bottom: 15px; margin-bottom: 20px; }
          .title-area h1 { margin: 0; font-size: 24px; color: #064e29; }
          .title-area p { margin: 5px 0 0 0; font-size: 12px; color: #64748b; }
          .meta-info { text-align: right; font-size: 11px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 25px; }
          th, td { border: 1px solid #e2e8f0; padding: 12px 10px; text-align: left; font-size: 11px; }
          th { background-color: #f8fafc; color: #334155; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer { margin-top: 50px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div class="title-area">
            <h1>REMBA IMPEX GHANA LIMITED</h1>
            <p>${title} Report - Confidential Internal Document</p>
          </div>
          <div class="meta-info">
            <p><strong>Date Generated:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h.replace(/([A-Z])/g, ' $1').trim()}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        
        <div class="footer">
          REMBA IMPEX GHANA LIMITED Enterprise Resource Planning. This document is system-generated and confidential.
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};
