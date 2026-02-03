# Mobile Tinder-like Job Swiping Feature

## Overview

JobShaman now includes a mobile-optimized Tinder-like swiping interface for browsing jobs on touch devices. This feature is automatically enabled when:

- User is **logged in**
- Screen width is **smaller than 1024px** (mobile/tablet view)
- User is browsing the **job list** (ViewState.LIST)

## How It Works

### Swipe Gestures

The mobile swipe view supports multiple ways to interact:

#### Touch Gestures (Mobile/Tablet)
- **Swipe Left** or tap **Pass** button → Skip/Reject the job
- **Swipe Right** or tap **Save** button → Save the job to favorites
- **Tap Details** button → View full job details in expanded view

#### Keyboard Support (for testing on desktop)
- **Left Arrow** (`←`) → Pass (reject job)
- **Right Arrow** (`→`) → Save job

#### Mouse Support (for testing)
- Click and drag left/right on the card to simulate swipe
- Threshold: 50px drag distance triggers action

### User Interface

The mobile swipe view includes:

1. **Header** with:
   - Job counter (current / total)
   - Progress bar showing browsing progress
   - Swipe hint

2. **Job Card** displaying:
   - Job title and company
   - Quick info grid (location, salary, job type, JHI score)
   - Description preview (first 300 characters)
   - Hint to tap for full details
   - Visual swipe indicators (← X for pass, → ✓ for save)

3. **Action Buttons**:
   - **Pass** - Reject current job (red)
   - **Save** - Save current job (cyan/green if already saved)
   - **Details** - View full job details

### Features

- **Smooth Animations**: Cards rotate and fade based on swipe direction
- **Real-time Visual Feedback**: See X or checkmark while swiping
- **Infinite Scroll**: Automatically loads more jobs as you approach the end
- **Progress Tracking**: See how many jobs you've reviewed
- **Dark Mode Support**: Fully styled for both light and dark themes
- **Saved Status Indication**: Save button turns green when job is saved
- **Completion Screen**: Shows encouraging message when all jobs are reviewed with option to restart

### When It's Not Shown

The desktop view (sidebar + detail pane) is shown when:
- User is NOT logged in
- Screen width is ≥ 1024px (desktop/large laptop)
- ViewState is not LIST (e.g., PROFILE, MARKETPLACE, etc.)

All navigation tabs (Profile, Saved Jobs, Marketplace, etc.) remain fully accessible in the header.

## Component Architecture

### MobileSwipeJobBrowser Component

**Location**: `components/MobileSwipeJobBrowser.tsx`

**Props**:
```typescript
interface MobileSwipeJobBrowserProps {
    jobs: Job[];                    // Array of jobs to browse
    savedJobIds: string[];          // IDs of saved jobs
    onToggleSave: (jobId: string) => void;  // Called when saving/unsaving
    onJobSelect: (jobId: string | null) => void;  // Called to view full details
    isLoadingMore: boolean;         // Loading state
    hasMore: boolean;               // Whether more jobs available
    onLoadMore: () => void;         // Called to load more jobs
    theme: 'light' | 'dark';        // Current theme
}
```

**State Management**:
- `currentIndex`: Current position in job array
- `swipeState`: Tracks touch/mouse drag position and status
- `exitAnimation`: Tracks which direction card exited ('left' | 'right' | null)

**Key Methods**:
- `handleReject()`: Move to next job
- `handleSave()`: Save current job and move to next
- `handleTouchStart/Move/End()`: Touch gesture detection
- `handleMouseDown/Move/Up()`: Mouse drag detection

### Integration in App.tsx

The feature is integrated with:
1. **Import** of MobileSwipeJobBrowser component
2. **State** for `isMobileSwipeView` to track mobile detection
3. **useEffect** to detect screen size changes and auto-enable on mobile
4. **Conditional rendering** in renderContent() to show mobile or desktop view

## Responsive Behavior

```
Desktop (≥1024px):
├─ Header (AppHeader)
├─ Main Content
│  ├─ Left: JobListSidebar (filters, job list)
│  └─ Right: JobDetailView (full job details)
└─ Footer (AppFooter)

Mobile (<1024px, logged in):
├─ Header (AppHeader)
├─ Main Content
│  └─ MobileSwipeJobBrowser (full width)
└─ Footer (AppFooter)

Mobile (<1024px, logged out):
├─ Header (AppHeader)
├─ Main Content
│  ├─ Left: JobListSidebar (filters, job list)
│  └─ Right: JobDetailView (login prompt)
└─ Footer (AppFooter)
```

## Testing

### On Real Mobile Device
1. Open JobShaman on mobile browser
2. Log in with account
3. Job list should automatically show swipe interface
4. Swipe left/right to navigate jobs
5. Use Save button to save jobs
6. Tap Details to view full job information

### On Desktop (Simulate Mobile)
1. Open browser DevTools (F12)
2. Click Device Toolbar (Ctrl+Shift+M)
3. Select mobile device (e.g., iPhone 12)
4. Log in
5. Job list should show swipe interface
6. Use keyboard arrows to test: ← for pass, → for save
7. Or drag mouse left/right on job card

### Edge Cases
- **All jobs reviewed**: Shows completion screen
- **No jobs**: Shows empty state message
- **Switching to desktop**: Layout automatically updates to two-column view
- **Logging out**: Mobile view disabled, shows desktop layout
- **Window resize**: Automatically switches between mobile/desktop views

## Future Enhancements

Potential improvements:
- **Undo last action**: Go back to previous job
- **Stack animation**: Show next card slightly behind current
- **Settings**: User preference to always use desktop view
- **Saved jobs quick filter**: Swipe mode for viewing only saved jobs
- **Job recommendations**: ML-based reordering based on save patterns
- **Multi-card preview**: Peek at next 2-3 jobs
- **Haptic feedback**: Vibration feedback on swipe (mobile)

## Performance Considerations

- Jobs are loaded progressively via infinite scroll
- Card animations use Framer Motion for smooth 60fps performance
- Touch event listeners cleaned up on unmount
- Window resize listener debounced via resize event
- No unnecessary re-renders with proper React state management

## Browser Compatibility

Tested and compatible with:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile, etc.)

## Accessibility

- Keyboard support (arrow keys for swipe simulation)
- Button labels for screen readers
- High contrast colors for visibility
- Touch-friendly button sizes (min 44px)
- Alt text on all icons via title attributes

## Styling

The component uses:
- **Tailwind CSS** for responsive styling
- **Dark mode** support with theme-aware colors
- **Custom scrollbar** styling for job card overflow
- **Smooth animations** with Framer Motion
- **Gradient accents** for visual appeal

Color scheme:
- **Cyan** (#06b6d4): Primary action color
- **Green** (#16a34a): Saved state
- **Red** (#ef4444): Reject state
- **Slate**: Neutral text and backgrounds
