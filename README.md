<a href="./demo/icon.png"><img src="./demo/icon.png" alt="logo" class="center"></a>

# PointCloudDemo
<table style="width:100%;">
  <tr>
    <td style="width: 50%">
        <a href="./demo/app.gif"><img src="./demo/app.gif" alt="GUI demo"></a>
    </td>
    <td style="width: 50%">
        <a href="./demo/pointclouddemo_rgb.gif"><img src="./demo/pointclouddemo_rgb.gif" alt="Video demo"></a>
    </td>
  </tr>
</table>
A generator of a video that goes through a point cloud scene. Useful for creating virtual demos. 
Front-end in ThreeJS, HTML, CSS, Electron.
Back-end in Python, Open3D, Vedo, OpenCV, Ffmpeg.
Pose-interpolation uses SQUAD and Catmull-romm.

# Setup
## 0.0 Installation
See release notes. Currently only compatible with Linux OS.
- To run AppImage: chmod +x PointCloudDemo-1.0.0.AppImage && ./PointCloudDemo-1.0.0.AppImage
- To install .deb: sudo apt install ./PointCloudDemo_1.0.0_amd64.deb

## 1.0 Using the GUI
### Controls
| Control | Use
|---------|---------|
| W/S, Scroll wheel | Zoom in/out |
| A/D | Move left/right |
| Click and drag | Rotate scene using ThreeJS Orbital Controls|
### 2.0 How to use the app
1. Prepare a folder with colmap files (images.txt, cameras.txt, points3d.txt). The images.txt will be used to load poses in order of timestamps (based on the image name, in the format frame_%06d.jpg or frame_%06d.png).
2. Click, 'Link COLMAP TXT folder': Choose the folder with colmap files (images.txt, cameras.txt, points3d.txt): The app will load the poses, interpolate new poses and render frames for a video. Wait until this process completes in the Console
3. Click, 'Render video': Creates video using frames. Wait until this process completes in the Console
4. Click, 'Download video': Downloads the final video locally

## 3.0 Future Dev
### 3.1 User options
- Download a ply file as a substitute for points3d.txt from COLMAP
- Select camera poses to add in the app before interpolation as substitute for images.txt from COLMAP
- Option to modify camera parameters as a substitute for cameras.txt from COLMAP
- Adapt to OPENCV model of COLMAP input instead of just PINHOLE
- Option to render a depth video in addition to rgb
- Choose background colour for rendering the video, changing the three.js display and the input into the frame generation
### 3.2 UI
- Video player: shows the rendered video, with pause, play and scroll bar
- Disable/enable buttons according to the steps, to prevent accidentally starting other processes

<!-- ## Dev notes (to delete)
Run the app using 'npm start'
Running backend by itself: 
source backend/env_backend/bin/activate
Generate frames:
python backend/app.py --colmap_dir /home/tparu2/PointCloudDemoRestored/colmap_sample --generate_frames --output_dir ./outputs 
Render video:
python backend/app.py --render_rgb --output_dir ./outputs

To use executable, replace python with ./backend/dist/app 

Build app by runnign pyinstaller app.spec (pyinstaller is in the env_backend)-->
