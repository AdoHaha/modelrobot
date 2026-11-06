# Collision warnings

Enable **Collisions** above the preview to check the robot's explicit URDF
`<collision>` geometry. Possible overlaps turn the affected links red; the
status lists each pair. Disable the checkbox to restore the original materials.
Checking starts off and does not block joint motion or CSV playback.

In **Files**, choose **Pi collision demo** for a folded left hand overlapping
the torso, or **Pi robot (safe pose)** for a clear neutral pose. The Pi model has
collision shapes on its torso and every section of both arms, and its elbows bend about Y.

## Geometry and exclusions

- Boxes, spheres, cylinders, and locally loaded STL collision meshes are supported.
  URDF collision origins, fixed-axis roll/pitch/yaw, and signed mesh scales apply.
  Multiple collision shapes per link are supported.
- Each shape uses an oriented bounding box. Box tests use the separating-axis
  test from Three.js's `OBB`; spheres, cylinders and irregular STL meshes use
  conservative enclosing boxes and can warn before the actual surfaces meet.
  Touching boxes count as a possible collision.
- Fixed joints form rigid assemblies. Shapes within an assembly and shapes in
  directly neighboring assemblies are excluded to avoid warnings at ordinary
  joint connections. This is a viewer policy, not a URDF collision rule.
- Visual geometry is never substituted for missing collision tags. A link with
  collision geometry but no visual still appears in the status if it overlaps.
- Missing or unsupported collision shapes produce an **Incomplete** warning.
  Supported shapes continue to be checked.

Checks follow joint changes, CSV frames and applied URDF edits. A world-space
axis-aligned box rejects distant pairs before the oriented-box test; dirty
poses are checked at most once per 50 ms. There is no physics simulation,
continuous collision detection, distance measurement, or floor/environment test.
Fast movements can pass through an overlap between checked poses.

Collision-only STL files are included in the browser's saved robot assets.
No geometry is sent to a server for checking.

## Validation

`npm test` checks rotated-box separation, contact, containment, origin transforms,
mirrored STL scales, exclusions, material restoration, CSV changes, saved assets,
incomplete geometry and actual phone touch gestures. Shoulder-limit and crossed-arm
regressions verify arm/torso warnings even when the hands remain clear. The optional real-model
check also exercises the T12 model's 37 STL collision shapes:

```sh
node tests/check-external-robot.cjs /path/to/T12
```

The user-provided Ericson reference is downloaded locally as
`references/real-time-collision-detection.pdf`. That directory is excluded from
Git locally and from App Engine deployment. The collision algorithm uses the
existing Three.js implementation, whose `OBB` source references Ericson §4.4.1.
