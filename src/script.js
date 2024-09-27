import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import GUI from "lil-gui";
import gsap from "gsap";

/**
 * Base
 */
// Debug
const gui = new GUI({ width: 340 });
gui.hide();
const debugObject = {};

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

// Loaders
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("./draco/");
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

/**
 * Sizes
 */
const sizes = {
	width: window.innerWidth,
	height: window.innerHeight,
	pixelRatio: Math.min(window.devicePixelRatio, 2),
};

window.addEventListener("resize", () => {
	// Update sizes
	sizes.width = window.innerWidth;
	sizes.height = window.innerHeight;
	sizes.pixelRatio = Math.min(window.devicePixelRatio, 2);

	// Materials
	if (particles && particles.material) {
		particles.material.uniforms.uResolution.value.set(
			sizes.width * sizes.pixelRatio,
			sizes.height * sizes.pixelRatio
		);
	}

	// Update camera
	camera.aspect = sizes.width / sizes.height;
	camera.updateProjectionMatrix();

	// Update renderer
	renderer.setSize(sizes.width, sizes.height);
	renderer.setPixelRatio(sizes.pixelRatio);
});

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
	35,
	sizes.width / sizes.height,
	0.1,
	100
);
camera.position.set(0, 0, 8 * 2);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
	canvas: canvas,
	antialias: true,
});

renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(sizes.pixelRatio);

debugObject.clearColor = "#160920";
gui.addColor(debugObject, "clearColor").onChange(() => {
	renderer.setClearColor(debugObject.clearColor);
});
renderer.setClearColor(debugObject.clearColor);

/**
 * Particles
 */
let particles = {};

gltfLoader.load("./models.glb", (all) => {
	particles = {};
	particles.index = 0;
	const positions = all.scene.children.map(
		(c) => c.geometry.attributes.position
	);

	particles.max = 0;
	positions.forEach((element) => {
		if (element.count > particles.max) {
			particles.max = element.count;
		}
	});

	particles.positions = [];

	for (const p of positions) {
		let org = p.array;
		let newArr = new Float32Array(particles.max * 3);

		for (let i = 0; i < particles.max; i++) {
			let i3 = i * 3;
			if (i3 < org.length) {
				newArr[i3] = org[i3];
				newArr[i3 + 1] = org[i3 + 1];
				newArr[i3 + 2] = org[i3 + 2];
			} else {
				let rend = Math.floor(p.count * Math.random()) * 3;
				newArr[i3] = org[rend];
				newArr[i3 + 1] = org[rend + 1];
				newArr[i3 + 2] = org[rend + 2];
			}
		}

		particles.positions.push(new THREE.Float32BufferAttribute(newArr, 3));
	}
	let sizes = new Float32Array(particles.max);
	for (let i = 0; i < particles.max; i++) {
		sizes[i] = Math.random();
	}

	// Geometry
	particles.geometry = new THREE.BufferGeometry();
	particles.geometry.setAttribute(
		"position",
		particles.positions[particles.index]
	);
	particles.geometry.setAttribute("target", particles.positions[3]);
	particles.geometry.setAttribute("sizes", new THREE.BufferAttribute(sizes, 1));
	// Increase the velocity for more noticeable movement
	const velocities = new Float32Array(particles.max * 3);
	for (let i = 0; i < particles.max * 3; i++) {
		velocities[i] = (Math.random() - 0.1) * 0.2; // Increased from 0.001 to 0.01
	}
	particles.geometry.setAttribute(
		"velocity",
		new THREE.BufferAttribute(velocities, 3)
	);

	particles.colorA = "#ff7300";
	particles.colorB = "#0091ff";
	// Material
	particles.material = new THREE.ShaderMaterial({
		vertexShader: `
      //  Simplex 3D Noise 
      //  by Ian McEwan, Ashima Arts
      //
      vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
      vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

      float simplexNoise3d(vec3 v)
      {
          const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

          // First corner
          vec3 i  = floor(v + dot(v, C.yyy) );
          vec3 x0 =   v - i + dot(i, C.xxx) ;

          // Other corners
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );

          //  x0 = x0 - 0. + 0.0 * C 
          vec3 x1 = x0 - i1 + 1.0 * C.xxx;
          vec3 x2 = x0 - i2 + 2.0 * C.xxx;
          vec3 x3 = x0 - 1. + 3.0 * C.xxx;

          // Permutations
          i = mod(i, 289.0 ); 
          vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))  + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

          // Gradients
          // ( N*N points uniformly over a square, mapped onto an octahedron.)
          float n_ = 1.0/7.0; // N=7
          vec3  ns = n_ * D.wyz - D.xzx;

          vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);

          vec4 b0 = vec4( x.xy, y.xy );
          vec4 b1 = vec4( x.zw, y.zw );

          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));

          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);

          // Normalise gradients
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;

          // Mix final noise value
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
      }

      uniform vec2 uResolution;
      uniform float uSize;
      uniform float uProgress;
      uniform float uTime;
      attribute vec3 target;
      attribute vec3 velocity;
      varying vec3 vColor;
      attribute float sizes;
      uniform vec3 colorA;
      uniform vec3 colorB;
      void main()
      {
          float noiseTO = simplexNoise3d(position * 0.2);
          float noiseFROM = simplexNoise3d(target * 0.2);
          float noise = mix(noiseTO, noiseFROM, uProgress);
          noise = smoothstep(-1.0, 1.0, noise);
          vColor = mix(colorA, colorB, noise);
          float duration = 0.4;
          float delay = (1.0 - duration) * noise;
          float end = delay + duration;
          float progress = smoothstep(delay, end, uProgress);

          vec3 mixed = mix(position, target, progress) + vec3(
			simplexNoise3d(position * 0.05) * 0.1,
			simplexNoise3d(position * 0.1) * 0.1,
			simplexNoise3d(position * 0.15) * 0.1
		);
				
                // Apply more noticeable movement
				vec3 movement = velocity * sin(uTime+ mixed.x * 7.0 + mixed.y * 3.0 + mixed.z * 5.0) * 0.5;
				movement += vec3(
					simplexNoise3d(vec3(mixed.x * 0.05 + uTime, mixed.y * 0.1, mixed.z * 0.1)) * 0.002,
					simplexNoise3d(vec3(mixed.x * 0.1, mixed.y * 0.2 + uTime, mixed.z * 0.2)) * 0.002,
					simplexNoise3d(vec3(mixed.x * 0.15, mixed.y * 0.3, mixed.z * 0.3 + uTime)) * 0.002
				);
                mixed += movement;

                // Add a slight overall oscillation
                mixed += vec3(
                    sin(uTime * 0.5 + mixed.x) * 0.02,
                    cos(uTime * 0.5 + mixed.y) * 0.02,
                    sin(uTime * 0.5 + mixed.z) * 0.02
                );

          // Final position
          vec4 modelPosition = modelMatrix * vec4(mixed, 1.0);
          vec4 viewPosition = viewMatrix * modelPosition;
          vec4 projectedPosition = projectionMatrix * viewPosition;
          gl_Position = projectedPosition;

          // Point size
          gl_PointSize = sizes * uSize * uResolution.y;
          gl_PointSize *= (1.0 / - viewPosition.z);
      }
    `,
		fragmentShader: `
      varying vec3 vColor;

      void main()
      {
          vec2 uv = gl_PointCoord;
          float distanceTo = length(uv - vec2(0.5));
          float alpha = 0.05 / distanceTo - 0.1;
          gl_FragColor = vec4(vColor, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
      }
    `,
		uniforms: {
			uSize: new THREE.Uniform(0.4),
			uResolution: new THREE.Uniform(
				new THREE.Vector2(
					sizes.width * sizes.pixelRatio,
					sizes.height * sizes.pixelRatio
				)
			),
			uProgress: new THREE.Uniform(0.0),
			colorA: new THREE.Uniform(new THREE.Color(particles.colorA)),
			colorB: new THREE.Uniform(new THREE.Color(particles.colorB)),
			uTime: new THREE.Uniform(0.0),
		},
		blending: THREE.AdditiveBlending,
		depthWrite: false,
	});
	// Points
	particles.points = new THREE.Points(particles.geometry, particles.material);
	scene.add(particles.points);
	particles.points.frustumCulled = false;
	particles.morpher = (index) => {
		particles.geometry.attributes.position =
			particles.positions[particles.index];
		particles.geometry.attributes.target = particles.positions[index];
		gsap.fromTo(
			particles.material.uniforms.uProgress,
			{ value: 0 },
			{ value: 1, duration: 2.5 }
		);
		particles.index = index;
	};

	gui.add(particles.material.uniforms.uProgress, "value", 0, 1, 0.001).listen();
	gui.addColor(particles, "colorA").onChange(() => {
		particles.material.uniforms.colorA.value.set(particles.colorA);
	});
	gui.addColor(particles, "colorB").onChange(() => {
		particles.material.uniforms.colorB.value.set(particles.colorB);
	});
});
particles.morph0 = () => {
	particles.morpher(0);
};
particles.morph1 = () => {
	particles.morpher(1);
};
particles.morph2 = () => {
	particles.morpher(2);
};
particles.morph3 = () => {
	particles.morpher(3);
};
gui.add(particles, "morph0");
gui.add(particles, "morph1");
gui.add(particles, "morph2");
gui.add(particles, "morph3");

/**
 * Animate
 */
const clock = new THREE.Clock();

const tick = () => {
	const elapsedTime = clock.getElapsedTime();

	// Update controls
	controls.update();

	if (particles.material && particles.material.uniforms.uResolution) {
		particles.material.uniforms.uResolution.value.set(
			sizes.width * sizes.pixelRatio,
			sizes.height * sizes.pixelRatio
		);
	}

	// Update time uniform for particle movement
	if (particles.material && particles.material.uniforms.uTime) {
		particles.material.uniforms.uTime.value = elapsedTime;
	}

	// Render normal scene
	renderer.render(scene, camera);

	// Call tick again on the next frame
	window.requestAnimationFrame(tick);
};

tick();
// a function that generates a random hex color
function getRandomColor(n) {
	var letters = "0123456789ABCDEF";
	var color = "#";
	for (var i = 0; i < 6; i++) {
		color += letters[Math.floor(Math.random() * n)];
	}
	return color;
}
function randomizeColors() {
	const randomColorA = new THREE.Color(getRandomColor(16));
	const randomColorB = new THREE.Color(getRandomColor(15));

	gsap.to(particles.material.uniforms.colorA.value, {
		r: randomColorA.r,
		g: randomColorA.g,
		b: randomColorA.b,
		duration: 2.5,
		onUpdate: () => {
			particles.material.uniforms.colorA.value.copy(
				particles.material.uniforms.colorA.value
			);
		},
	});

	gsap.to(particles.material.uniforms.colorB.value, {
		r: randomColorB.r,
		g: randomColorB.g,
		b: randomColorB.b,
		duration: 2.5,
		onUpdate: () => {
			particles.material.uniforms.colorB.value.copy(
				particles.material.uniforms.colorB.value
			);
		},
	});
}

document.addEventListener("DOMContentLoaded", () => {
	window.addEventListener("keydown", (event) => {
		if (event.key == "h") {
			gui.visible ? gui.hide() : gui.show();
			gui.visible = !gui.visible;
		}
	});

	setInterval(() => {
		// pick random morth
		if (particles) {
			let rand = 0;
			do {
				rand = Math.floor(Math.random() * 4);
			} while (rand == particles.index);
			particles.morpher(rand);
			// a random hex color
			randomizeColors();
		}
	}, 4000);
});
