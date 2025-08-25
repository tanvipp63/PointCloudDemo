# PointCloudDemo
Desktop app that takes a video or image and visualises the point cloud in real time. Useful for demo applications.

## Instructions
Run the app using 'npm start'
Running backend by itself: 
source backend/env_backend/bin/activate
python backend/app.py --colmap_dir /home/tparu2/PointCloudDemoRestored/colmap_sample

## To do
Download for video

## Future Dev
Download a ply file to use instead of points3d.txt from COLMAP
Select camera poses to add in the app before interpolation as substitute for images.txt
Choose background colour for rendering the video, changing the three.js display and the input into the frame generation
Video player