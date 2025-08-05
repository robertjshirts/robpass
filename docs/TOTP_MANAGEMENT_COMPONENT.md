# TOTP Management Component

## Overview

The `TOTPManagement` component has been extracted from the `VaultDashboard` component to improve code organization and separation of concerns. This component handles all TOTP (Two-Factor Authentication) related functionality including status checking, real-time updates, and user interactions.

## Features

### 1. Real-time Status Updates
- Automatically checks TOTP status on component mount
- Periodic refresh every 30 seconds to catch external changes
- Listens for custom `totp-status-changed` events for immediate updates
- Provides visual indicators for enabled/disabled/unknown states

### 2. Event-driven Architecture
- Dispatches `totp-status-changed` events when TOTP is enabled/disabled
- Other components can listen for these events to stay synchronized
- Supports callback props for parent component notifications

### 3. Imperative API
- Exposes `refreshStatus()` method via React ref
- Parent components can trigger manual status refreshes
- Useful for immediate updates after TOTP operations

## Props Interface

```typescript
interface TOTPManagementProps {
  onTotpSettings?: () => void;
  onTotpStatusChange?: (enabled: boolean | null) => void;
}

export interface TOTPManagementRef {
  refreshStatus: () => void;
}
```

## Usage

### Basic Usage
```tsx
import TOTPManagement from './TOTPManagement';

function MyComponent() {
  return (
    <TOTPManagement 
      onTotpSettings={() => {
        // Handle TOTP settings click
      }}
    />
  );
}
```

### With Ref for Manual Control
```tsx
import { useRef } from 'react';
import TOTPManagement, { TOTPManagementRef } from './TOTPManagement';

function MyComponent() {
  const totpRef = useRef<TOTPManagementRef>(null);

  const handleRefresh = () => {
    totpRef.current?.refreshStatus();
  };

  return (
    <TOTPManagement 
      ref={totpRef}
      onTotpSettings={() => {
        // Handle TOTP settings click
      }}
      onTotpStatusChange={(enabled) => {
        console.log('TOTP status changed:', enabled);
      }}
    />
  );
}
```

## Integration with Other Components

### Event Dispatching
Components that modify TOTP status should dispatch the custom event:

```typescript
// After enabling/disabling TOTP
window.dispatchEvent(new CustomEvent('totp-status-changed'));
```

This has been implemented in:
- `TotpSetupModal.handleComplete()`
- `TotpManager.handleSetupSuccess()`
- `TotpManager.handleConfirmDisable()`

### Status Synchronization
The component automatically:
1. Checks status on mount
2. Refreshes every 30 seconds
3. Listens for `totp-status-changed` events
4. Calls `onTotpStatusChange` callback when status changes

## Visual States

### Loading State
- Shows pulsing blue indicator
- Displays "Checking..." text

### Enabled State
- Shows green indicator
- Displays "Enabled" text
- Button shows "Manage 2FA"
- Success message about account protection

### Disabled State
- Shows yellow indicator
- Displays "Disabled" text
- Button shows "Enable 2FA"
- Encouragement message to enable 2FA

### Unknown/Error State
- Shows gray indicator
- Displays "Unknown" text
- Error message about connection issues

## API Integration

The component integrates with the `/api/auth/totp/status` endpoint:

```typescript
const response = await fetch('/api/auth/totp/status', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${sessionToken}`
  }
});
```

Expected response format:
```json
{
  "success": true,
  "data": {
    "totp_enabled": boolean
  }
}
```

## Error Handling

- Gracefully handles network errors
- Falls back to "Unknown" state on API failures
- Logs errors to console for debugging
- Continues periodic refresh attempts

## Styling

The component uses Tailwind CSS classes and maintains the same visual design as the original TOTP section:
- Gradient background (blue to indigo)
- Responsive design
- Dark mode support
- Consistent spacing and typography

## Testing

A test suite is provided in `src/components/__tests__/TOTPManagement.test.tsx` that covers:
- Component rendering
- Status display logic
- Callback functionality
- Error handling

## Migration Notes

When migrating from the old VaultDashboard implementation:
1. Remove TOTP-related state variables (`totpEnabled`, `totpLoading`)
2. Remove `checkTotpStatus()` function
3. Remove TOTP status check from useEffect
4. Replace TOTP JSX section with `<TOTPManagement />` component
5. Update imports to include the new component

The component maintains full backward compatibility with existing functionality while providing better organization and real-time updates.
