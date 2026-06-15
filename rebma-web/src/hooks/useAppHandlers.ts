interface AppHandlersState {
  setIsQuickActionOpen: (v: boolean) => void;
  setActiveDepartment: (dept: string) => void;
  setActiveSubTab: (tab: string) => void;
  setActiveMobileView: (v: string) => void;
  setIsSidebarOpen: (v: boolean) => void;
  addNotification: (msg: string) => void;
  alert: (msg: string) => void;
}

export function useAppHandlers(state: AppHandlersState) {
  const {
    setIsQuickActionOpen,
    setActiveDepartment,
    setActiveSubTab,
    setActiveMobileView,
    setIsSidebarOpen,
    addNotification,
    alert,
  } = state;

  const handleQuickAction = (actionName: string, dept: string) => {
    setIsQuickActionOpen(false);

    if (dept === 'HR') {
      if (actionName === 'Add New Staff' || actionName === 'Approve Pending Staff') {
        setActiveDepartment('HR'); sessionStorage.setItem('rebma-last-dept', 'HR');
        setActiveSubTab('Employees'); setActiveMobileView('dashboard');
      } else if (actionName === 'Log Attendance') {
        setActiveDepartment('HR'); sessionStorage.setItem('rebma-last-dept', 'HR');
        setActiveSubTab('Attendance'); setActiveMobileView('dashboard');
      } else if (actionName === 'Schedule Meeting') {
        setActiveDepartment('BOARDROOM'); sessionStorage.setItem('rebma-last-dept', 'BOARDROOM');
        setActiveSubTab('Meetings'); setActiveMobileView('dashboard');
      } else if (actionName === 'Send Announcement') {
        setActiveDepartment('BOARDROOM'); sessionStorage.setItem('rebma-last-dept', 'BOARDROOM');
        setActiveSubTab('Announcements'); setActiveMobileView('dashboard');
      }
    } else if (dept === 'CEO') {
      if (actionName === 'View Reports') {
        setActiveDepartment('CEO'); sessionStorage.setItem('rebma-last-dept', 'CEO');
        setActiveSubTab('Overview'); setActiveMobileView('dashboard');
      } else if (actionName === 'Schedule Boardroom') {
        setActiveDepartment('BOARDROOM'); sessionStorage.setItem('rebma-last-dept', 'BOARDROOM');
        setActiveSubTab('Meetings'); setActiveMobileView('dashboard');
      } else if (actionName === 'Send Alert') {
        addNotification("CEO Broadcast Alert sent to all departments.");
        alert("Broadcast Alert sent to all departments.");
      } else if (actionName === 'View All Departments') {
        setIsSidebarOpen(true);
      }
    } else if (dept === 'OPERATIONS') {
      if (actionName === 'Log Cargo Intake') {
        setActiveDepartment('OPERATIONS'); sessionStorage.setItem('rebma-last-dept', 'OPERATIONS');
        setActiveSubTab('PortIngestion'); setActiveMobileView('dashboard');
      } else if (actionName === 'Create Fulfillment Ticket' || actionName === 'Release to Dispatch') {
        setActiveDepartment('OPERATIONS'); sessionStorage.setItem('rebma-last-dept', 'OPERATIONS');
        setActiveSubTab('Releases'); setActiveMobileView('dashboard');
      } else if (actionName === 'Flag Discrepancy') {
        addNotification("Discrepancy flagged on latest cargo record.");
        alert("Discrepancy flagged successfully.");
      }
    } else if (dept === 'FINANCE') {
      if (actionName === 'Record Payment') {
        setActiveDepartment('FINANCE'); sessionStorage.setItem('rebma-last-dept', 'FINANCE');
        setActiveSubTab('RecordPayment'); setActiveMobileView('dashboard');
      } else if (actionName === 'Create Invoice') {
        setActiveDepartment('FINANCE'); sessionStorage.setItem('rebma-last-dept', 'FINANCE');
        setActiveSubTab('Invoices'); setActiveMobileView('dashboard');
      } else if (actionName === 'Approve Credit Order') {
        setActiveDepartment('FINANCE'); sessionStorage.setItem('rebma-last-dept', 'FINANCE');
        setActiveSubTab('Evaluation'); setActiveMobileView('dashboard');
      } else if (actionName === 'View Ledger') {
        setActiveDepartment('FINANCE'); sessionStorage.setItem('rebma-last-dept', 'FINANCE');
        setActiveSubTab('Tickets'); setActiveMobileView('dashboard');
      }
    } else if (dept === 'MARKETING') {
      if (actionName === 'Create Order') {
        setActiveDepartment('MARKETING'); sessionStorage.setItem('rebma-last-dept', 'MARKETING');
        setActiveSubTab('CreateOrder'); setActiveMobileView('dashboard');
      } else if (actionName === 'Register Customer') {
        setActiveDepartment('MARKETING'); sessionStorage.setItem('rebma-last-dept', 'MARKETING');
        setActiveSubTab('RegisterCustomer'); setActiveMobileView('dashboard');
      } else if (actionName === 'View Pipeline') {
        setActiveDepartment('MARKETING'); sessionStorage.setItem('rebma-last-dept', 'MARKETING');
        setActiveSubTab('SalesHistory'); setActiveMobileView('dashboard');
      } else if (actionName === 'Export Report') {
        addNotification("Exported marketing pipeline report.");
        alert("Marketing pipeline report exported successfully.");
      }
    } else if (dept === 'PRODUCTION') {
      if (actionName === 'Request Materials') {
        setActiveDepartment('PRODUCTION'); sessionStorage.setItem('rebma-last-dept', 'PRODUCTION');
        setActiveSubTab('Requisition'); setActiveMobileView('dashboard');
      } else if (actionName === 'Update WIP Status') {
        setActiveDepartment('PRODUCTION'); sessionStorage.setItem('rebma-last-dept', 'PRODUCTION');
        setActiveSubTab('WIPStock'); setActiveMobileView('dashboard');
      } else if (actionName === 'Log Output') {
        addNotification("Logged output production units.");
        alert("Output production units logged successfully.");
      } else if (actionName === 'View Requisitions') {
        setActiveDepartment('PRODUCTION'); sessionStorage.setItem('rebma-last-dept', 'PRODUCTION');
        setActiveSubTab('RawMaterials'); setActiveMobileView('dashboard');
      }
    } else if (dept === 'DISPATCH') {
      if (actionName === 'Assign Delivery') {
        setActiveDepartment('DISPATCH'); sessionStorage.setItem('rebma-last-dept', 'DISPATCH');
        setActiveSubTab('Deliveries'); setActiveMobileView('dashboard');
      } else if (actionName === 'Update GPS') {
        addNotification("Updated GPS coordinates for active delivery.");
        alert("GPS coordinates updated.");
      } else if (actionName === 'Mark Delivered') {
        setActiveDepartment('DISPATCH'); sessionStorage.setItem('rebma-last-dept', 'DISPATCH');
        setActiveSubTab('DispatchHistory'); setActiveMobileView('dashboard');
      } else if (actionName === 'View Fleet') {
        setActiveDepartment('DISPATCH'); sessionStorage.setItem('rebma-last-dept', 'DISPATCH');
        setActiveSubTab('DriverLogs'); setActiveMobileView('dashboard');
      }
    } else if (dept === 'RECEPTION') {
      if (actionName === 'Check In Visitor' || actionName === 'Check Out Visitor' || actionName === "View Today's Log") {
        setActiveDepartment('RECEPTION'); sessionStorage.setItem('rebma-last-dept', 'RECEPTION');
        setActiveSubTab('VisitorLog'); setActiveMobileView('dashboard');
      } else if (actionName === 'Log Staff Attendance') {
        setActiveDepartment('RECEPTION'); sessionStorage.setItem('rebma-last-dept', 'RECEPTION');
        setActiveSubTab('EmployeeCheckin'); setActiveMobileView('dashboard');
      }
    } else if (dept === 'LOGISTICS') {
      if (actionName === 'Add Shipment' || actionName === 'Update Route') {
        setActiveDepartment('LOGISTICS'); sessionStorage.setItem('rebma-last-dept', 'LOGISTICS');
        setActiveSubTab('Dispatch'); setActiveMobileView('dashboard');
      } else if (actionName === 'View Supply Chain') {
        addNotification("Supply chain network is operating optimally.");
        alert("Supply chain status: Operational");
      } else if (actionName === 'Export Manifest') {
        addNotification("Logistics manifest exported successfully.");
        alert("Manifest exported.");
      }
    } else if (dept === 'MANAGEMENT') {
      if (actionName === 'Approve Intake') {
        setActiveDepartment('MANAGEMENT'); sessionStorage.setItem('rebma-last-dept', 'MANAGEMENT');
        setActiveSubTab('CargoApproval'); setActiveMobileView('dashboard');
      } else if (actionName === 'Set Price') {
        setActiveDepartment('MANAGEMENT'); sessionStorage.setItem('rebma-last-dept', 'MANAGEMENT');
        setActiveSubTab('SetPrices'); setActiveMobileView('dashboard');
      } else if (actionName === 'Approve Credit') {
        setActiveDepartment('MANAGEMENT'); sessionStorage.setItem('rebma-last-dept', 'MANAGEMENT');
        setActiveSubTab('CreditApproval'); setActiveMobileView('dashboard');
      } else if (actionName === 'View Audit Log') {
        setActiveDepartment('MANAGEMENT'); sessionStorage.setItem('rebma-last-dept', 'MANAGEMENT');
        setActiveSubTab('Ledger'); setActiveMobileView('dashboard');
      }
    }
  };

  return { handleQuickAction };
}
