# MyModelRobot usability review — 6 November 2026

Reviewer: GPT-6 Astra, independently inspecting the live site and a local revision.

## Findings

1. Applying a small URDF edit cleared the CSV, duplicated the saved robot, and reset the cursor. The editing session needed to remain intact.
2. The desktop editor was only 357 × 240 px. The files/library section pushed animation below the viewport; on phones editing and previewing required scrolling between them.
3. Fast trackball rotation allowed camera roll, with no visible explanation of orbit, pan or zoom gestures. Camera commands were duplicated across the sidebar and a fixed decorative cube.
4. Joint controls covered the model and truncated labels. Errors appeared within the long files panel, away from Apply.
5. CSV controls offered little guidance or validation feedback.

## Implemented changes

- Resizable workspace with URDF, Files, Joints and Animation tabs. The editor fills available height; line wrapping and a larger-editor mode are available.
- A bounded preview/editor split on phones and a side-by-side layout on short landscape screens. The divider supports dragging and arrow keys.
- Persistent Apply, Ctrl/Cmd+Enter, unapplied-edit status, and visible errors outside tab panels. Switching tabs keeps the editor draft.
- A stable document ID, explicit Save a copy, and non-disruptive geometry edits preserving CSV, cursor, scroll, joint pose and camera position.
- Upright Z-up OrbitControls with moderate sensitivity; orbit/pan/zoom hints, Fit, Home, zoom buttons and one standard-view selector beside the preview.
- Joints in their own panel with full labels and units guidance. CSV templates, validation, pose counts and disabled playback for invalid CSV. Warning badges remain visible when a related panel is closed.

## Verification

Astra's second review verified session preservation, CSV playback, error feedback, and usable layouts at 667 × 375 and 320 × 568, with no remaining observed blockers.

Automated Chromium checks cover URDF/STL import, saved records and copies, CSV restoration, Ctrl+Enter, cursor/scroll/pose/camera preservation, invalid XML, orbit, right-drag pan, wheel zoom, Fit, standard views, tab visibility, and resizing from 320 to 1440 px wide.

The external NASA/JPL T12 test verifies 37 STL visuals, 36 joints, zero-pose matrices, browser restoration and CSV-driven motion. Real-device touch and cross-browser testing have not been performed.
