import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.152.2/examples/jsm/controls/OrbitControls.js?module';
import { PLYLoader } from 'https://unpkg.com/three@0.152.2/examples/jsm/loaders/PLYLoader.js?module';

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

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

/*Ply loading from backend*/
const loader = new PLYLoader();
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
  scene.add(points);

  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const center = new THREE.Vector3();
  bb.getCenter(center);
  controls.target.copy(center);
  camera.position.set(center.x, center.y, center.z + (bb.getSize(new THREE.Vector3()).length() * 1.2));
  controls.update();
});

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

const linkButton = document.getElementById('link-button');
const consoleDiv = document.getElementById('console');

linkButton.addEventListener('click', async () => {
  const folder = await window.electronAPI.selectFolder();
  if (!folder) {
    const newLine = document.createElement('div');
    newLine.textContent = "Folder not found!\n";
    consoleDiv.appendChild(newLine);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
    return;
  }
  const newLine = document.createElement('div');
  newLine.textContent = `Selected folder: ${folder}. Running backend...\n`;
  consoleDiv.appendChild(newLine);
  consoleDiv.scrollTop = consoleDiv.scrollHeight;

  try {
    const result = await window.electronAPI.runPython(folder);
    const newLine = document.createElement('div');
    newLine.textContent = `\nBackend finished successfully:\n + ${result}`;
    consoleDiv.appendChild(newLine);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;

  } catch (err) {
    const result = await window.electronAPI.runPython(folder);
    const newLine = document.createElement('div');
    newLine.textContent = `\nError running backend:\n' + ${err.message}`;
    consoleDiv.appendChild(newLine);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
  }
});


window.electronAPI.onPythonLog((data) => {
  const newLine = document.createElement('div');
  newLine.textContent = data;
  consoleDiv.appendChild(newLine);
  consoleDiv.scrollTop = consoleDiv.scrollHeight; // auto scroll down
});

window.electronAPI.onPythonError((data) => {
  const newLine = document.createElement('div');
  newLine.textContent = 'ERROR: ' + data;
  newLine.style.color = 'red';
  consoleDiv.appendChild(newLine);
  consoleDiv.scrollTop = consoleDiv.scrollHeight; // auto scroll down
});