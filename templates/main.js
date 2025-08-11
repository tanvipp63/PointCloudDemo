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
  // Some PLYs provide colors in a "color" attribute — PointsMaterial can use them
  const hasColors = !!geometry.getAttribute('color');
  if (!hasColors) {
    // Optionally set a fallback color
    geometry.setAttribute('color',
      new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(0.5), 3)
    );
  }

  // Use THREE.Points for point clouds (fast). If PLY is a mesh, use THREE.Mesh + material
  const material = new THREE.PointsMaterial({
    size: 0.01,
    vertexColors: true,
    sizeAttenuation: true
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // auto-fit camera to point cloud bounds
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
	// cube.rotation.x += 0.01;
	// cube.rotation.y += 0.01;

	renderer.render( scene, camera );

}

/*Controls*/
controls.keys = {
	LEFT: 'ArrowLeft', //left arrow
	UP: 'ArrowUp', // up arrow
	RIGHT: 'ArrowRight', // right arrow
	BOTTOM: 'ArrowDown' // down arrow
}
