# Installation and Usage Guide

## MyModelRobot - Standalone Version

MyModelRobot is a web-based application for designing and viewing robots described in URDF (Unified Robot Description Format) used in ROS (Robot Operating System). This standalone version requires no server setup and works directly in your web browser.

## Features

- **URDF Visualization**: Load and visualize robot models described in URDF format
- **Interactive Controls**: Move robot joints using sliders
- **CSV Animation**: Animate robots using CSV files containing joint positions
- **Multiple Camera Views**: Switch between front, top, and side views
- **Augmented Reality (AR)**: View robots in AR mode (requires AR-capable device)
- **Screenshot Capture**: Take screenshots of your robot models
- **Trajectory Tracing**: Visualize the path of robot links during animation

## Quick Start (Standalone Version)

The standalone version is the easiest way to use MyModelRobot. It requires no installation or server setup.

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, or Edge)
- No internet connection required (once files are downloaded)

### Running the Standalone Version

1. **Download or clone this repository**
   ```bash
   git clone https://github.com/AdoHaha/modelrobot.git
   cd modelrobot
   ```

2. **Open the standalone file in your browser**
   
   Simply open `standalone.html` in your web browser:
   - **Option 1**: Double-click `standalone.html` in your file explorer
   - **Option 2**: Right-click `standalone.html` → "Open with" → Choose your browser
   - **Option 3**: Drag and drop `standalone.html` into your browser window

3. **Start using MyModelRobot**
   - The application will load with a default Pi Robot example
   - You can immediately start experimenting with the controls

### Using a Local Web Server (Optional but Recommended)

For better performance and to avoid potential CORS issues with some browsers, you can serve the files using a local web server:

**Using Python 3:**
```bash
python3 -m http.server 8000
```

Then open your browser to: `http://localhost:8000/standalone.html`

**Using Python 2:**
```bash
python -m SimpleHTTPServer 8000
```

**Using Node.js (http-server):**
```bash
npx http-server -p 8000
```

**Using PHP:**
```bash
php -S localhost:8000
```

## How to Use

### Loading a Robot

1. **Paste URDF content** into the "Robot's URDF" text area
2. Click the **"Load robot URDF"** button
3. The robot will appear in the 3D viewer on the right

### Example Robots

Click on the example robot links below the URDF text area:
- **Pi Robot** - A humanoid robot with multiple joints
- **R2D2** - A simple wheeled robot

### Controlling the Robot

- **Joint Sliders**: Once a robot is loaded, sliders appear for each moveable joint
- **Drag to rotate**: Use your mouse to rotate the camera view
- **Scroll to zoom**: Use mouse wheel or trackpad to zoom in/out

### Camera Controls

Click these buttons for preset camera angles:
- **Front view** - View robot from the front
- **Top view** - Bird's eye view from above
- **Side view** - View from the side

### Animation with CSV

1. **Prepare a CSV file** with joint positions:
   - First row: joint names (matching your URDF)
   - Subsequent rows: joint values (in radians)
   
   Example:
   ```csv
   torso_joint,head_pan_joint,head_tilt_joint
   0,0,0
   0.5,0.2,0.1
   1.0,0.4,0.2
   ```

2. **Paste CSV** into the "Robot's poses CSV" text area
3. Click **"Load CSV"**
4. Use playback controls:
   - **Play** - Start animation
   - **Pause** - Pause animation
   - **Stop** - Stop and reset
   - **< / >** - Step backward/forward through frames

### Advanced Features

#### Trajectory Tracing
1. Select a link from the dropdown menu
2. Click **"Trace"** to show the path the link follows during animation
3. Click **"Clear trajectory"** to remove the trace

#### Screenshots
Click the **"Make screenshot"** button to capture the current view

#### AR Mode
Click **"AR Mode"** to generate a QR code for viewing the robot in augmented reality (requires AR-capable device)

## Running the Server Version (Advanced)

If you want to run the full server version with database support:

### Prerequisites
- Python 3.x
- pip (Python package manager)

### Installation

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run with Flask:**
   ```bash
   cd flaskapp
   python simpleser.py
   ```

3. **Access the application:**
   Open your browser to `http://localhost:5000`

Note: The server version was designed for Google App Engine and may require additional configuration for database features to work locally.

## URDF Format

MyModelRobot uses the URDF format to describe robots. A basic URDF contains:

- **Links**: Physical parts of the robot (defined with geometry and visual properties)
- **Joints**: Connections between links (can be fixed, revolute, prismatic, etc.)

### Supported Geometries

- Box: `<box size="x y z"/>`
- Cylinder: `<cylinder radius="r" length="l"/>`
- Sphere: `<sphere radius="r"/>`

Note: Mesh files are not currently supported.

### Example URDF

See the files in the `testowe/` directory for complete examples.

## Browser Compatibility

MyModelRobot works best with modern browsers:
- ✅ Chrome/Chromium (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ⚠️ Internet Explorer (not supported)

## Troubleshooting

### Robot doesn't load
- Check that your URDF is valid XML
- Ensure all required tags are present (`<robot>`, `<link>`, `<joint>`)
- Check browser console for error messages (F12 → Console tab)

### Files not loading (404 errors)
- Make sure you're running from the repository root directory
- Use a local web server instead of opening the file directly
- Check that all required files are present in their directories

### Performance issues
- Reduce the complexity of your robot model
- Close other browser tabs
- Try a different browser (Chrome usually performs best)

## File Structure

```
modelrobot/
├── standalone.html          # Standalone version (start here!)
├── INSTALL.md              # This file
├── README.md               # Project overview
├── css/                    # Stylesheets
├── lib/                    # JavaScript libraries
├── scripts/                # Application JavaScript
├── testowe/                # Example URDF files
│   ├── pi_robot_urdf.xml
│   └── r2d2.xml
└── flaskapp/               # Server version (optional)
```

## Educational Use

MyModelRobot is used in robotics curriculum at Lodz University of Technology for:
- Basics of Robotics
- Mobile Robotics  
- Project Work

It's particularly useful for:
- Teaching URDF format
- Understanding robot kinematics
- Rapid prototyping of robot designs
- Visualizing ROS robot descriptions

## Support and Contributing

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/AdoHaha/modelrobot/issues)
- **Contributing**: Pull requests are welcome!

## License

See the repository for license information.

## Credits

MyModelRobot is built using:
- Three.js - 3D graphics
- Backbone.js - Application structure
- Bootstrap - UI components
- CodeMirror - Text editing
- jQuery - DOM manipulation

Scene setup based on Interactive 3D Graphics course materials by Eric Haines (Udacity).
