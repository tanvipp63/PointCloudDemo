# PointCloudDemo
A generator of a video that goes through a point cloud scene. Useful for creating virtual demos. 
Front-end in ThreeJS, HTML, CSS.
Back-end in Python, Open3D, Vedo, OpenCV.
Pose-interpolation uses SQUAD and Catmull-romm.

## Future Dev
### User options
- Download a ply file as a substitute for points3d.txt from COLMAP
- Select camera poses to add in the app before interpolation as substitute for images.txt from COLMAP
- Option to modify camera parameters as a substitute for cameras.txt from COLMAP
- Adapt to OPENCV model of COLMAP input instead of just PINHOLE
- Choose background colour for rendering the video, changing the three.js display and the input into the frame generation
### UI
- Video player: shows the rendered video, with pause, play and scroll bar
- Disable/enable buttons according to the steps

## Dev notes (to delete)
Run the app using 'npm start'
Running backend by itself: 
source backend/env_backend/bin/activate
python backend/app.py --colmap_dir /home/tparu2/PointCloudDemoRestored/colmap_sample