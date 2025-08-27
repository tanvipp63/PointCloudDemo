import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.152.2/examples/jsm/controls/OrbitControls.js?module';
import { PLYLoader } from 'https://unpkg.com/three@0.152.2/examples/jsm/loaders/PLYLoader.js?module';

const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
container.appendChild( renderer.domElement );

/* Set up scene, camera and renderer */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set(0,0,0);
controls.update();
controls.listenToKeyEvents( window );


/* Dummy animation object */
// const geometry = new THREE.BoxGeometry( 1, 1, 1 );
// const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
// const cube = new THREE.Mesh( geometry, material );
// scene.add( cube );
// camera.position.z = 5; /* Offset camera so it is not on top of the cube */
// controls.update();

/*Animation function */
function animate() {
	renderer.render( scene, camera );
}

/*Controls*/
controls.keys = {
	LEFT: 'ArrowLeft', //left arrow
	UP: 'ArrowUp', // up arrow
	RIGHT: 'ArrowRight', // right arrow
	BOTTOM: 'ArrowDown' // down arrow
}

/* WASD */
const moveDist = 0.1; // tune speed

window.addEventListener('keydown', (e) => {
  const code = e.keyCode || e.which;
  if (code === 87 || code === 38) { // W
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir).multiplyScalar(moveDist);
    camera.position.add(dir);
    controls.target.add(dir);
    controls.update();
  } else if (code === 83 || code === 40) { // S
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir).multiplyScalar(-moveDist);
    camera.position.add(dir);
    controls.target.add(dir);
    controls.update();
  }
  else if (code === 65 || code === 37) { // A
    const right = new THREE.Vector3();
    camera.getWorldDirection(right);
    right.cross(camera.up).normalize().multiplyScalar(-moveDist); 
    camera.position.add(right);
    controls.target.add(right);
    controls.update();
  } else if (code === 68 || code === 39) { // D
    const right = new THREE.Vector3();
    camera.getWorldDirection(right);
    right.cross(camera.up).normalize().multiplyScalar(moveDist); 
    camera.position.add(right);
    controls.target.add(right);
    controls.update();
  }
});

/* console updater */
const consoleDiv = document.getElementById('console');

function appendConsoleLine(text, isError=false){
    const newLine = document.createElement('div');
    
    if (isError){
      newLine.textContent = 'ERROR: ' + text;
      newLine.style.color = 'red';
    } else{
      newLine.textContent = `\n${text}\n`;
    }
    consoleDiv.appendChild(newLine);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

/*Ply loading from backend*/
let currentPoints = null;
const loader = new PLYLoader();

function clearCurrentPointcloud() {
  if (currentPoints) {
    scene.remove(currentPoints);
    if (currentPoints.geometry) currentPoints.geometry.dispose();
    if (currentPoints.material) currentPoints.material.dispose();
    currentPoints = null;
  }
}

async function loadPointcloudFromUrl(fileUrl){
  try{
    appendConsoleLine(`Loading point cloud: ${fileUrl}`);
    loader.load('../outputs/pointcloud.ply', (geometry) => {
      const hasColors = !!geometry.getAttribute('color');
      if (!hasColors) {
        // Optionally set a fallback color
        geometry.setAttribute('color',
          new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(0.5), 3)
        );
      }

      const material = new THREE.PointsMaterial({
        size: 0.01,
        vertexColors: true,
        sizeAttenuation: true
      });

      const points = new THREE.Points(geometry, material);
      clearCurrentPointcloud();
      currentPoints = points;
      scene.add(points);

      geometry.computeBoundingBox();
      const bb = geometry.boundingBox;
      const center = new THREE.Vector3();
      bb.getCenter(center);
      controls.target.copy(center);
      camera.position.set(center.x, center.y, center.z + (bb.getSize(new THREE.Vector3()).length() * 1.2));
      controls.update();
      appendConsoleLine('Point cloud loaded.');
    });    
  } catch (err) {
    appendConsoleLine(`Error in loading pointcloud.ply: ${err.message}`);
  }
}

let reloadTimer = null;
const RELOAD_DEBOUNCE_MS = 600;
function scheduleReload(fileUrl) {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    loadPointcloudFromUrl(fileUrl);
  }, RELOAD_DEBOUNCE_MS);
}

if (window.electronAPI && window.electronAPI.onPointCloudGenerated) {
  window.electronAPI.onPointCloudGenerated((fileUrl) => {
    appendConsoleLine(`Detected pointcloud update: ${fileUrl}`);
    scheduleReload(fileUrl);
  });
}

/* Button functions */
const linkButton = document.getElementById('link-button');

linkButton.addEventListener('click', async () => {
  const folder = await window.electronAPI.selectFolder();
  if (!folder) {
    appendConsoleLine("Folder not found!", true)
    return;
  }
  appendConsoleLine(`Selected folder: ${folder}. Running backend...`);

  try {
    const result = await window.electronAPI.runPoseInterp(folder);
    appendConsoleLine("Backend finished successfully");
  } catch (err) {
    const result = await window.electronAPI.runPoseInterp(folder);
    appendConsoleLine(`Error running backend:\n' + ${err.message}`, true);
  }
});

const renderButton = document.getElementById('render-button');

renderButton.addEventListener('click', async () => {
  appendConsoleLine("Rendering video...");

  try {
    const result = await window.electronAPI.runRenderVideo();
    appendConsoleLine("Video created successfully");

  } catch (err) {
    const result = await window.electronAPI.runRenderVideo();
    appendConsoleLine(`Error running video render:\n' + ${err.message}`, true)
  }
});

const downloadButton = document.getElementById('download-button');

downloadButton.addEventListener('click', async () => {
  downloadButton.disabled = true;
  appendConsoleLine("Opening donwload dialogue...");

  try {
    const savedPath = await window.electronAPI.saveVideo();
    if (!savedPath) {
      appendConsoleLine("Save cancelled by user");
    } else {
      appendConsoleLine(`Video saved to: ${savedPath}`, true);      
    }
  } catch (err) {
    appendConsoleLine(`Error saving video: ' + ${err.message}`, true)      
  } finally {
    downloadButton.disabled = false;
  }
});


/* callbacks */
window.electronAPI.onPythonLog((data) => {
  appendConsoleLine(data);
});

window.electronAPI.onPythonError((data) => {
  appendConsoleLine(data, true);
});

/* window resizing */
function onWindowResize() {
  const width = container.clientWidth;
  const height = container.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height, false); // false avoids changing canvas style
  renderer.setPixelRatio(window.devicePixelRatio);
}

onWindowResize();
window.addEventListener('resize', onWindowResize);