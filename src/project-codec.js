/* Room Viewer project format v1. Pure serializer/validator; no DOM or filesystem access. */
(function (root, factory) {
  const codec = factory();
  if (typeof module === 'object' && module.exports) module.exports = codec;
  else root.RoomProjectCodec = codec;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FORMAT = '3d-room-viewer-project';
  const VERSION = 1;
  const MAX_BYTES = 25 * 1024 * 1024;
  const MAX_OBJECTS = 10000;
  const MAX_ROOMS = 1000;
  const MAX_LEVELS = 100;

  function invalid(what) { throw new Error('Некорректный файл проекта: ' + what); }
  function plain(v, where) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) invalid(where);
    return v;
  }
  function num(v, where, min = -1e7, max = 1e7) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) invalid(where);
    return v;
  }
  function integer(v, where, min, max) {
    if (!Number.isSafeInteger(v) || v < min || v > max) invalid(where);
    return v;
  }
  function text(v, where, max = 200) {
    // All user-controlled text is escaped where rendered in HTML.
    // Keeping literal < and > here preserves legitimate object names and labels.
    if (typeof v !== 'string' || v.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v)) invalid(where + ' (недопустимый текст)');
    return v;
  }
  function bool(v, where) {
    if (typeof v !== 'boolean') invalid(where);
    return v;
  }
  function list(v, where, max) {
    if (!Array.isArray(v) || v.length > max) invalid(where);
    return v;
  }
  function vec(v, length, where, min = -1e7, max = 1e7) {
    if (!Array.isArray(v) || v.length !== length) invalid(where);
    return v.map((n, i) => num(n, where + '[' + i + ']', min, max));
  }
  function optionalTextList(v, where, maxItems) {
    if (v === null || v === undefined) return null;
    return list(v, where, maxItems).map((s, i) => text(s, where + '[' + i + ']'));
  }
  function flags(o, keys, where) {
    const result = {};
    for (const k of keys) result[k] = bool(o[k], where + '.' + k);
    return result;
  }
  function objectData(raw, idx, levelCount, validTypes) {
    const w = 'objects[' + idx + ']';
    const o = plain(raw, w);
    const type = text(o.type, w + '.type', 40);
    if (!validTypes.has(type)) invalid(w + ': неизвестная геометрия ' + type);
    const physics = plain(o.physics, w + '.physics');
    if (o.texturePreset !== undefined && !['generic','brick','wood','stone','metal','fabric','glass','sand','grass'].includes(o.texturePreset)) invalid(w+'.texturePreset');
    return {
      id: integer(o.id, w + '.id', 1, Number.MAX_SAFE_INTEGER),
      type,
      name: text(o.name, w + '.name'),
      position: vec(o.position, 3, w + '.position'),
      rotation: vec(o.rotation, 3, w + '.rotation'),
      scale: vec(o.scale, 3, w + '.scale', 0.01),
      color: vec(o.color, 3, w + '.color', 0, 1),
      metallic: num(o.metallic, w + '.metallic', 0, 1),
      roughness: num(o.roughness, w + '.roughness', 0, 1),
      opacity: num(o.opacity, w + '.opacity', 0, 1),
      emissive: num(o.emissive, w + '.emissive', 0, 100),
      category: text(o.category, w + '.category'),
      texturePreset: o.texturePreset === undefined ? 'generic' : text(o.texturePreset, w+'.texturePreset', 20),
      animType: integer(o.animType, w + '.animType', 0, 3),
      ...flags(o, ['hidden','locked','hasTexture','hasNormalMap','hasMixMap',
        'castShadow','receiveShadow','editable','selectable'], w),
      physics: {
        mass: num(physics.mass, w + '.physics.mass', 0, 1e7),
        velocity: vec(physics.velocity, 3, w + '.physics.velocity'),
        gravity: bool(physics.gravity, w + '.physics.gravity'),
        angularVelocity: physics.angularVelocity === undefined ? [0,0,0] : vec(physics.angularVelocity,3,w+'.physics.angularVelocity',-25,25),
        friction: physics.friction === undefined ? 0.65 : num(physics.friction,w+'.physics.friction',0,2),
        restitution: physics.restitution === undefined ? 0.15 : num(physics.restitution,w+'.physics.restitution',0,1),
        linearDamping: physics.linearDamping === undefined ? 0.12 : num(physics.linearDamping,w+'.physics.linearDamping',0,10),
        angularDamping: physics.angularDamping === undefined ? 0.45 : num(physics.angularDamping,w+'.physics.angularDamping',0,10),
        collider: physics.collider === undefined ? true : bool(physics.collider,w+'.physics.collider')
      },
      level: integer(o.level, w + '.level', 0, levelCount - 1),
      tags: list(o.tags, w + '.tags', 100).map((s, i) => text(s, w + '.tags[' + i + ']')),
      components: optionalTextList(o.components, w + '.components', 100)
    };
  }
  function cameraData(c) {
    c = plain(c, 'camera');
    return {
      distance: num(c.distance, 'camera.distance', 0.001),
      theta: num(c.theta, 'camera.theta'), phi: num(c.phi, 'camera.phi'),
      target: vec(c.target, 3, 'camera.target'),
      fov: num(c.fov, 'camera.fov', 1, 179),
      near: num(c.near, 'camera.near', 0.0001), far: num(c.far, 'camera.far', 0.001)
    };
  }
  function lightsData(input) {
    const l = plain(input, 'lights');
    const ambient = plain(l.ambient, 'lights.ambient');
    const directional = plain(l.directional, 'lights.directional');
    return {
      ambient: { color: vec(ambient.color, 3, 'lights.ambient.color', 0, 1), intensity: num(ambient.intensity, 'lights.ambient.intensity') },
      directional: { direction: vec(directional.direction, 3, 'lights.directional.direction'), color: vec(directional.color, 3, 'lights.directional.color', 0, 1), intensity: num(directional.intensity, 'lights.directional.intensity') },
      point: list(l.point, 'lights.point', 0), // Point lights are not implemented by the current renderer.
      cubemapRotation: num(l.cubemapRotation, 'lights.cubemapRotation')
    };
  }
  function compositionData(c) {
    c = plain(c, 'composition');
    const result = {};
    for (const k of ['exposure','contrast','saturation','sharpness','bloom','vignette']) result[k] = num(c[k], 'composition.' + k);
    return result;
  }
  function validate(input, validTypes) {
    const p = plain(input, 'корень');
    if (p.format !== FORMAT) invalid('неподдерживаемый формат. Нужен файл .rvproj, а не экспорт сцены');
    if (p.formatVersion !== VERSION) invalid('неподдерживаемая версия формата: ' + String(p.formatVersion));
    const s = plain(p.scene, 'scene');
    const levels = list(s.levels, 'levels', MAX_LEVELS).map((v, i) => {
      v = plain(v, 'levels[' + i + ']');
      return { id: integer(v.id, 'levels['+i+'].id', 1, 1000000),
        name: text(v.name, 'levels['+i+'].name'), height: num(v.height, 'levels['+i+'].height'), objects: [] };
    });
    if (!levels.length) invalid('должен быть хотя бы один этаж');
    if (new Set(levels.map(l => l.id)).size !== levels.length) invalid('повторяющийся ID этажа');
    const ids = new Set();
    const objects = list(s.objects, 'objects', MAX_OBJECTS).map((v, i) => {
      const o = objectData(v, i, levels.length, validTypes);
      if (ids.has(o.id)) invalid('повторяющийся ID объекта ' + o.id);
      ids.add(o.id);
      levels[o.level].objects.push(o.id); // Always rebuild stale indexes (RV-02).
      return o;
    });
    const rooms = list(s.rooms, 'rooms', MAX_ROOMS).map((v, i) => {
      v = plain(v, 'rooms[' + i + ']');
      const w = 'rooms[' + i + ']';
      const connections = list(v.connections, w + '.connections', 100).map((item, j) => {
        if (typeof item === 'number') return integer(item, w + '.connections['+j+']', 0, Number.MAX_SAFE_INTEGER);
        return text(item, w + '.connections['+j+']');
      });
      return {id: integer(v.id, w+'.id', 0, Number.MAX_SAFE_INTEGER), name: text(v.name, w+'.name'),
        width: num(v.width, w+'.width', 0.0001), height: num(v.height, w+'.height', 0.0001),
        depth: num(v.depth, w+'.depth', 0.0001), offset: vec(v.offset, 3, w+'.offset'), connections};
    });
    if (new Set(rooms.map(r => r.id)).size !== rooms.length) invalid('повторяющийся ID комнаты');
    const weather = plain(s.weatherEffects, 'weatherEffects');
    const weatherEffects = flags(weather, ['rain','snow','fog','wind'], 'weatherEffects');
    // Optional in v1 for backward compatibility with saved older projects.
    const renderSettings = s.renderSettings === undefined ? {grid:true} :
      flags(plain(s.renderSettings,'renderSettings'), ['grid'], 'renderSettings');
    const camera = cameraData(s.camera);
    if (camera.far <= camera.near) invalid('camera.far должен превышать near');
    return {
      format: FORMAT, formatVersion: VERSION, appVersion: text(p.appVersion, 'appVersion', 30),
      scene: { levels, objects, rooms,
        currentLevel: integer(s.currentLevel, 'currentLevel', 0, levels.length-1),
        camera, lights: lightsData(s.lights), composition: compositionData(s.composition),
        isDay: bool(s.isDay, 'isDay'), physicsEnabled: bool(s.physicsEnabled, 'physicsEnabled'),
        is360: bool(s.is360, 'is360'), isStereo: bool(s.isStereo, 'isStereo'), weatherEffects, renderSettings }
    };
  }
  function capture(engine) {
    const scene = {
      levels: engine.levels.map(l => ({id:l.id, name:l.name, height:l.height})),
      objects: engine.objects.map(o => ({
        id:o.id, type:o.type, name:o.name, position:[...o.position], rotation:[...o.rotation],
        scale:[...o.scale], color:[...o.color], metallic:o.metallic, roughness:o.roughness,
        opacity:o.opacity, emissive:o.emissive, category:o.category,
        texturePreset:o.texturePreset||'generic',
        animType:o.animType, hidden:o.hidden, locked:o.locked,
        hasTexture:o.hasTexture, hasNormalMap:o.hasNormalMap, hasMixMap:o.hasMixMap,
        castShadow:o.castShadow, receiveShadow:o.receiveShadow,
        editable:o.editable, selectable:o.selectable,
        physics: {mass:o.physics.mass, velocity:[...o.physics.velocity], gravity:o.physics.gravity,
          angularVelocity:[...(o.physics.angularVelocity||[0,0,0])],
          friction:o.physics.friction??0.65,restitution:o.physics.restitution??0.15,
          linearDamping:o.physics.linearDamping??0.12,angularDamping:o.physics.angularDamping??0.45,
          collider:o.physics.collider!==false},
        level:o.level, tags:[...(o.tags||[])], components:o.components ? [...o.components] : null
      })),
      rooms: engine.rooms.map(r => ({id:r.id, name:r.name, width:r.width, height:r.height,
        depth:r.depth, offset:[...r.offset], connections:[...r.connections]})),
      currentLevel:engine.currentLevel, camera:engine.camera, lights:engine.lights,
      composition:engine.composition, isDay:engine.isDay, physicsEnabled:engine.physicsEnabled,
      is360:engine.is360, isStereo:engine.isStereo, weatherEffects:engine.weatherEffects,
      renderSettings:engine.renderSettings||{grid:true}
    };
    return validate({format:FORMAT, formatVersion:VERSION, appVersion:'2.0.0', scene}, new Set(Object.keys(engine.geometries).filter(type => type !== 'grid')));
  }
  function encode(engine) {
    const serialized = JSON.stringify(capture(engine), null, 2);
    if (new TextEncoder().encode(serialized).length > MAX_BYTES) invalid('слишком большой проект');
    return serialized;
  }
  function decode(serialized, validTypes) {
    if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).length > MAX_BYTES) invalid('слишком большой файл');
    let parsed;
    try { parsed = JSON.parse(serialized); }
    catch (e) { invalid('ошибка JSON: ' + e.message); }
    return validate(parsed, new Set(validTypes));
  }
  return Object.freeze({FORMAT, VERSION, MAX_BYTES, capture, encode, decode});
});
