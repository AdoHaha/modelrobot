MyModelRobot
==========

MyModelRobot is an online application for designing and viewing robots described in URDF ( Unified Robot Description Format) used in ROS. 

The tool focus in on simplicity of use, especially for teaching and rapid prototyping. The tool is used in Lodz University of Technology robotics curriculum (basics of robotics, mobile robotics and project work).

The main viewer supports URDF primitives and locally loaded STL meshes. You can move robot's joints using sliders and animate robots via CSV files also you can view robots using Augmented Reality (AR)

![Screen from MyModelRobot App](screen.png)

You can see a working demo at [http://mymodelrobot.appspot.com/](http://mymodelrobot.appspot.com/)

Browser robot library and STL meshes
-----------------------------------

Use **URDF and STL files** to select a URDF/XML file and its ASCII or binary
STL meshes, or choose a folder to preserve mesh paths. STL files can also be
added before or after loading the URDF. Mesh references resolve by path and,
when unique, by filename, including `package://` references. Ambiguous or missing
meshes are listed in the viewer. URDF mesh scale, visual origin and material
are applied; STL coordinates are not automatically converted from millimeters.

Each loaded robot is saved automatically in IndexedDB with its referenced mesh
bytes. Use **Saved robots → Open** to restore it, **Save in browser** to update
its name, and **Delete saved robot** to remove its saved copy. Storage belongs
to this browser and site; clearing site data removes it. Local files are not
uploaded to the server. Existing server saves contain URDF only.

The main viewer bundles Three.js 0.187.0, its TrackballControls and STLLoader
locally. The camera-based AR page retains its legacy runtime for compatibility
with the existing AR library; local mesh robots are supported in the main viewer.

Build and check with Node.js 22+ and Python 3 with Jinja2 installed:

```sh
npm ci
npm run build
npx playwright install chromium
npm test
```

Deploy to Google App Engine with the personal account explicitly selected:

```sh
gcloud auth login reinadesu@gmail.com --no-launch-browser
bash scripts/deploy_google.sh --quiet
```
