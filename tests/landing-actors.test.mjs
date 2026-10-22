import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import * as THREE from "three";

const require = createRequire(import.meta.url);
const flightApi = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/landingDroneFlight.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: flightApi });

test("shared visor preserves status styling, throttles loading uploads and disposes GPU resources", () => {
  for (const [status, text, color] of [
    ["error", "Error....Error.....", "#FFD600"],
    ["restricted", "Access Restricted!!!", "#FF3B30"],
    ["loading", "loading....", "#00FF88"],
  ]) {
    const effects = [], frames = [], draws = [];
    const context = { clearRect() {}, fillText(text) { draws.push({ text, color: this.fillStyle }); } };
    const canvas = { width: 0, height: 0, getContext: () => context };
    const hooks = {
      useRef: current => ({ current }), useMemo: create => create(),
      useEffect: callback => effects.push(callback), memo: React.memo,
    };
    const exports = {};
    const source = fs.readFileSync("components/landing/GuardianRobot3D.tsx", "utf8") + "\nexport { VisorStatusDisplay };";
    vm.runInNewContext(ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { exports, document: { createElement: () => canvas }, require: name => {
      if (name === "react") return hooks;
      if (name === "three") return THREE;
      if (name === "@/lib/landingDroneFlight") return flightApi;
      if (name === "@react-three/fiber") return { useFrame: callback => frames.push(callback) };
      return require(name);
    } });
    const tree = exports.VisorStatusDisplay({ status });
    const material = tree.props.children.props;
    material.ref.current = { opacity: 1 };
    const texture = material.map, geometry = tree.props.geometry;
    let textureDisposed = false, geometryDisposed = false;
    texture.addEventListener("dispose", () => { textureDisposed = true; });
    geometry.addEventListener("dispose", () => { geometryDisposed = true; });
    const cleanup = effects.map(effect => effect());
    assert.deepEqual(draws[0], { text, color });
    const frame = time => frames[0]({ clock: { getElapsedTime: () => time } });
    frame(.01);
    const uploads = texture.version, drawCount = draws.length;
    frame(.02); frame(.03);
    assert.equal(texture.version, uploads, "unchanged text must not upload a texture every frame");
    assert.equal(draws.length, drawCount);
    frame(.4);
    assert.equal(texture.version, uploads + (status === "loading" ? 1 : 0));
    assert.ok(material.ref.current.opacity >= .5 && material.ref.current.opacity <= 1);
    if (status === "loading") assert.equal(draws.at(-1).text, "loading..");
    cleanup.forEach(dispose => dispose?.());
    assert.ok(textureDisposed && geometryDisposed);
  }
});

// Exercise the actual actor hierarchy and flight callbacks without requiring a GPU.
function actors() {
  const frames = [];
  const hooks = {
    useRef: current => ({ current }), useMemo: create => create(),
    useCallback: callback => callback, useEffect() {},
    useState: value => [value, () => {}], memo: React.memo,
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync("components/landing/GuardianRobot3D.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, console, require: name => {
    if (name === "react") return hooks;
    if (name === "three") return THREE;
    if (name === "@/lib/landingDroneFlight") return flightApi;
    if (name === "@react-three/fiber") return {
      useFrame: callback => frames.push(callback),
      useThree: () => ({ camera: new THREE.PerspectiveCamera(), size: { width: 1200, height: 800 }, gl: { domElement: {} }, raycaster: new THREE.Raycaster() }),
    };
    return require(name);
  } });
  const mouseRef = { current: { x: 0, y: 0 } };
  const tree = exports.default({ mouseRef, stage: 5, enter: true });
  frames.length = 0;
  const drones = [];

  function mount(element, parent) {
    if (Array.isArray(element)) { element.forEach(child => mount(child, parent)); return; }
    if (!element?.props) return;
    if (element.type?.type?.name === "AutonomousDrone") {
      const before = frames.length;
      const drone = element.type.type(element.props);
      const wrapper = mount(drone, parent);
      const object = wrapper.getObjectByName("drone-" + element.props.config.id);
      drones.push({ object, wrapper, obstacle: element.props.obstacle, update: frames[before] });
      return wrapper;
    }
    // Other components are decorative; only group transforms affect these actors.
    if (typeof element.type === "function") return;
    if (element.type !== "group") { mount(element.props.children, parent); return; }
    const group = new THREE.Group();
    group.name = element.props.name || "";
    if (element.props.position) group.position.fromArray(element.props.position);
    if (element.props.rotation) group.rotation.set(...element.props.rotation);
    if (typeof element.props.scale === "number") group.scale.setScalar(element.props.scale);
    else if (element.props.scale) group.scale.fromArray(element.props.scale);
    if (element.props.ref) element.props.ref.current = group;
    parent.add(group);
    mount(element.props.children, group);
    return group;
  }
  const scene = new THREE.Scene();
  mount(tree, scene);
  return { scene, drones, mouseRef, robot: scene.getObjectByName("landing-guardian-robot") };
}

test("drones keep autonomous world-space flight through robot drag, scale, pose and pointer changes", () => {
  const control = actors(), interactive = actors();
  assert.equal(control.drones.length, 6);
  for (let frame = 0; frame < 400; frame++) {
    interactive.robot.position.set(Math.sin(frame) * 8, Math.cos(frame) * 5, 2);
    interactive.robot.rotation.set(frame * .1, frame * .2, -frame * .05);
    interactive.robot.scale.setScalar(2 + frame % 4);
    interactive.mouseRef.current = { x: Math.sin(frame), y: Math.cos(frame) };
    for (const fixture of [control, interactive]) {
      fixture.drones.forEach(drone => drone.update({}, 1 / 60));
      fixture.scene.updateMatrixWorld(true);
    }
    control.drones.forEach((drone, index) => {
      const other = interactive.drones[index].object;
      assert.ok(drone.object.getWorldPosition(new THREE.Vector3()).distanceTo(other.getWorldPosition(new THREE.Vector3())) < 1e-10);
      assert.ok(drone.object.getWorldQuaternion(new THREE.Quaternion()).angleTo(other.getWorldQuaternion(new THREE.Quaternion())) < 1e-7);
    });
  }
  const before = interactive.drones.map(drone => drone.object.position.clone());
  for (let frame = 0; frame < 60; frame++) interactive.drones.forEach(drone => drone.update({}, 1 / 60));
  assert.ok(interactive.drones.every((drone, index) => drone.object.position.distanceTo(before[index]) > .05), "every drone continues flying while the robot is held");
});

test("real actors expose a burst and falling hull on impact, then reuse the live drone", () => {
  const fixture = actors(), drone = fixture.drones[0];
  for (let frame = 0; frame < 330; frame++) drone.update({}, 1 / 60);
  const robot = drone.obstacle.current;
  robot.active = true;
  Object.assign(robot.body, drone.object.position, { radius: .2 });
  robot.head.x = 100; robot.head.radius = .2;
  drone.update({}, 1 / 60);
  assert.equal(drone.object.visible, false);
  const wreck = drone.wrapper.getObjectByName("drone-wreck-1"), burst = drone.wrapper.getObjectByName("drone-burst-1");
  assert.equal(wreck.visible, true); assert.equal(burst.visible, true);
  const originalY = wreck.position.y;
  for (let frame = 0; frame < 55; frame++) {
    flightApi.advanceRobotImpact(robot, 1 / 60);
    drone.update({}, 1 / 60);
  }
  assert.equal(drone.object.visible, true, "replacement enters before the damaged hull has faded away");
  assert.equal(wreck.visible, true); assert.ok(wreck.position.y < originalY);
  assert.equal(burst.visible, false);
  for (let frame = 0; frame < 90; frame++) {
    flightApi.advanceRobotImpact(robot, 1 / 60);
    drone.update({}, 1 / 60);
  }
  assert.equal(wreck.visible, false);
});

test("free flight changes waypoints, clamps long frames, and keeps all simulation buffers", () => {
  const flight = flightApi.createDroneFlight(flightApi.DRONE_CONFIGS[0]);
  const robot = flightApi.createRobotObstacle();
  const buffers = [flight.position, flight.velocity, flight.target, flight.wreck, flight.burst];
  let targets = 0, previousAge = 0;
  for (let frame = 0; frame < 3600; frame++) {
    flightApi.stepDroneFlight(flight, robot, 1 / 60);
    if (flight.targetAge < previousAge) targets++;
    previousAge = flight.targetAge;
  }
  assert.ok(targets > 8, "drones steer toward fresh, seeded waypoints instead of repeating an orbit");
  const before = { ...flight.position };
  flightApi.stepDroneFlight(flight, robot, 60);
  assert.ok(Math.hypot(flight.position.x - before.x, flight.position.y - before.y, flight.position.z - before.z) < .1);
  assert.deepEqual([flight.position, flight.velocity, flight.target, flight.wreck, flight.burst].map((buffer, index) => buffer === buffers[index]), [true, true, true, true, true]);
});

test("collisions are rate-limited and fade a reusable wreck while a replacement launches", () => {
  const robot = flightApi.createRobotObstacle();
  robot.active = true; robot.body.radius = 1; robot.head.x = 100;
  const drones = flightApi.DRONE_CONFIGS.map(config => flightApi.createDroneFlight(config));
  drones.forEach(drone => {
    drone.delay = 0; drone.age = 5; drone.visible = true;
    Object.assign(drone.position, { x: .1, y: 0, z: 0 });
    drone.target.x = 3; drone.retargetAfter = 5;
    flightApi.stepDroneFlight(drone, robot, 1 / 60);
  });
  assert.equal(drones.filter(drone => drone.hit).length, 1, "one contact event per cooldown, including when several drones overlap");
  const drone = drones[0], wreck = drone.wreck;
  for (let frame = 0; frame < 45; frame++) {
    flightApi.advanceRobotImpact(robot, 1 / 60);
    flightApi.stepDroneFlight(drone, robot, 1 / 60);
  }
  assert.equal(drone.generation, 1); assert.equal(drone.visible, true);
  assert.equal(wreck.active, true); assert.ok(wreck.opacity > 0 && wreck.opacity < 1);
  assert.equal(drone.burst.active, false);
  for (let frame = 0; frame < 120; frame++) {
    flightApi.advanceRobotImpact(robot, 1 / 60);
    flightApi.stepDroneFlight(drone, robot, 1 / 60);
  }
  assert.equal(wreck.active, false); assert.equal(wreck.opacity, 0);
  assert.equal(drone.wreck, wreck, "effects are reused rather than appended to the scene");
});

test("six doubled drones emerge smoothly from below in staggered starts", () => {
  assert.equal(flightApi.DRONE_CONFIGS.length, 6);
  assert.deepEqual(Array.from(flightApi.DRONE_CONFIGS, config => config.scale), [3.6, 3.3, 3.5, 3.2, 3.6, 3.4]);
  const robot = flightApi.createRobotObstacle();
  const drones = flightApi.DRONE_CONFIGS.map(config => flightApi.createDroneFlight(config));
  const starts = [];
  for (let frame = 0; frame < 270; frame++) {
    drones.forEach((drone, index) => {
      const before = { ...drone.position }, wasVisible = drone.visible;
      flightApi.stepDroneFlight(drone, robot, 1 / 60);
      if (!wasVisible && drone.visible) starts[index] = frame;
      if (drone.age < 3.2) {
        assert.ok(drone.position.y >= before.y, "entry rises from below without reversing");
        assert.ok(Math.hypot(drone.position.x - before.x, drone.position.y - before.y, drone.position.z - before.z) < .22, "entry has no position jump");
      }
    });
  }
  assert.equal(starts.length, 6);
  assert.ok(starts.every((frame, index) => index === 0 || frame > starts[index - 1]));
  assert.ok(drones.every(drone => drone.age > 2.9), "all six enter during the opening sequence");
});

test("hull contact triggers at the armor edge, with sparks on the surface and an outward rebound", () => {
  const robot = flightApi.createRobotObstacle();
  robot.active = true; robot.body.radius = 1; robot.head.x = 100;
  const drone = flightApi.createDroneFlight({ id: 1, scale: 3.6, speed: 8 });
  drone.delay = 0; drone.age = 3.3; drone.visible = true; drone.retargetAfter = 20;
  Object.assign(drone.position, { x: 2, y: 0, z: 0 });
  Object.assign(drone.velocity, { x: -10, y: 0, z: 0 });
  Object.assign(drone.target, { x: -4, y: 0, z: 0 });
  flightApi.stepDroneFlight(drone, robot, .05);
  assert.equal(drone.hit, true, "first edge touch activates immediately after emergence");
  assert.ok(drone.wreck.position.x > 1 + 3.6 * .22, "the damaged hull stays outside the armor");
  assert.ok(Math.abs(drone.burst.position.x - 1.03) < 1e-9, "sparks originate on the armor instead of at the drone center or logo");
  assert.ok(drone.wreck.velocity.x > 0, "impact reverses inward velocity");
  assert.equal(drone.burst.normal.x, 1);
  assert.ok(Math.abs(drone.wreck.spin.z) > 1, "the impulse starts a mechanical tumble");
});

test("cooldown suppresses repeated explosions but never allows a drone through the robot", () => {
  const robot = flightApi.createRobotObstacle();
  robot.active = true; robot.body.radius = 1; robot.head.x = 100; robot.cooldown = .5;
  const drone = flightApi.createDroneFlight(flightApi.DRONE_CONFIGS[0]);
  drone.delay = 0; drone.age = 5; drone.visible = true;
  Object.assign(drone.position, { x: .2, y: 0, z: 0 });
  Object.assign(drone.velocity, { x: -2, y: 0, z: 0 });
  flightApi.stepDroneFlight(drone, robot, 1 / 60);
  assert.equal(drone.hit, false); assert.equal(drone.visible, true);
  assert.ok(drone.position.x > 1 + drone.config.scale * .22);
  assert.ok(drone.velocity.x > 0);
  assert.equal(drone.burst.active, false);
});

test("a near miss beyond the hull clearance does not trigger an effect", () => {
  const robot = flightApi.createRobotObstacle();
  robot.active = true; robot.body.radius = 1; robot.head.x = 100;
  const drone = flightApi.createDroneFlight(flightApi.DRONE_CONFIGS[0]);
  drone.delay = 0; drone.age = 5; drone.visible = true;
  Object.assign(drone.position, { x: 2.1, y: 0, z: 0 });
  Object.assign(drone.target, { x: 2.1, y: 3, z: 0 });
  flightApi.stepDroneFlight(drone, robot, .05);
  assert.equal(drone.hit, false); assert.equal(drone.wreck.active, false);
});

test("random flight covers the viewport and adapts its destinations after resize", () => {
  const flight = flightApi.createDroneFlight(flightApi.DRONE_CONFIGS[0]);
  const robot = flightApi.createRobotObstacle();
  flightApi.updateDroneViewport(flight, 12, 6);
  assert.ok(flight.position.y < -6);
  const visited = new Set();
  for (let frame = 0; frame < 36000; frame++) {
    flightApi.stepDroneFlight(flight, robot, 1 / 60);
    const { x, y } = flight.target;
    assert.ok(x >= flight.bounds.left && x <= flight.bounds.right);
    assert.ok(y >= flight.bounds.bottom && y <= flight.bounds.top);
    if (Math.abs(x) > 6 && Math.abs(y) > 2) visited.add(`${Math.sign(x)},${Math.sign(y)}`);
  }
  assert.equal(visited.size, 4, "waypoints reach all four screen quadrants, including the edges");
  flightApi.updateDroneViewport(flight, 3, 7);
  flightApi.stepDroneFlight(flight, robot, 1 / 60);
  assert.ok(Math.abs(flight.target.x) < 3);
  assert.ok(Math.abs(flight.target.y) < 7);
});
