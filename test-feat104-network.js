// Test script for Feature #104: Network error shows user-friendly message
// This script will be run manually - it documents the test steps

// Steps:
// 1. Login as presidente (already done via Playwright)
// 2. Stop the backend server
// 3. Navigate to /ingresos to trigger data load failure
// 4. Verify NetworkError component is shown with friendly message
// 5. Restart the backend server
// 6. Click retry / wait for auto-retry
// 7. Verify the page recovers and shows data

console.log('Feature #104 test plan documented');
