(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RoomPhysics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  const EPS = 1e-8;
  const DEFAULTS = Object.freeze({ friction:0.65, restitution:0.15,
    linearDamping:0.12, angularDamping:0.45, angularVelocity:[0,0,0], collider:true });
  function params(obj) {
    if (!obj.physics) obj.physics = {mass:0,gravity:true,velocity:[0,0,0]};
    const p = obj.physics;
    for (const k of ['friction','restitution','linearDamping','angularDamping']) {
      if (!Number.isFinite(p[k])) p[k] = DEFAULTS[k];
    }
    if (!Array.isArray(p.velocity) || p.velocity.length !== 3 || p.velocity.some(v=>!Number.isFinite(v))) p.velocity=[0,0,0];
    if (!Array.isArray(p.angularVelocity) || p.angularVelocity.length !== 3 || p.angularVelocity.some(v=>!Number.isFinite(v))) p.angularVelocity=[0,0,0];
    if (typeof p.collider !== 'boolean') p.collider=true;
    return p;
  }
  function matrix(o) { // Renderer model rotation order: Y, X, Z.
    const r=o.rotation||[0,0,0];
    const [x,y,z]=r, cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
    return [
      cy*cz+sy*sx*sz, -cy*sz+sy*sx*cz, sy*cx,
      cx*sz, cx*cz, -sx,
      -sy*cz+cy*sx*sz, sy*sz+cy*sx*cz, cy*cx
    ];
  }
  function bounds(o) {
    const b=o.boundingBox||{cx:0,cy:0,cz:0,rx:0.5,ry:0.5,rz:0.5}, s=o.scale||[1,1,1];
    const local=[b.cx*s[0],b.cy*s[1],b.cz*s[2]];
    const half=[Math.max(0.005,Math.abs(b.rx*s[0])),Math.max(0.005,Math.abs(b.ry*s[1])),Math.max(0.005,Math.abs(b.rz*s[2]))];
    const m=matrix(o);
    const c=[0,1,2].map(i => o.position[i]+m[i*3]*local[0]+m[i*3+1]*local[1]+m[i*3+2]*local[2]);
    const h=[0,1,2].map(i => Math.abs(m[i*3])*half[0]+Math.abs(m[i*3+1])*half[1]+Math.abs(m[i*3+2])*half[2]);
    const sphere=o.type==='sphere' && Math.abs(s[0]-s[1])<1e-5 && Math.abs(s[0]-s[2])<1e-5;
    return {c,h,r:Math.max(...half),sphere};
  }
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const length=a=>Math.hypot(a[0],a[1],a[2]);
  function contact(a,b) {
    // Return normal pointing from A to B; separate detection from response.
    if (a.sphere && b.sphere) {
      const diff=b.c.map((v,i)=>v-a.c[i]), dist=length(diff), depth=a.r+b.r-dist;
      if(depth<=0)return null;
      return {n:dist>EPS?diff.map(x=>x/dist):[0,1,0],depth};
    }
    if (a.sphere!==b.sphere) {
      const sp=a.sphere?a:b, box=a.sphere?b:a, fromA=a.sphere;
      const closest=sp.c.map((v,i)=>clamp(v,box.c[i]-box.h[i],box.c[i]+box.h[i]));
      const delta=sp.c.map((v,i)=>v-closest[i]);
      const distance=length(delta);
      if(distance>sp.r) return null;
      let n,depth;
      if(distance>EPS) { n=delta.map(v=>v/distance); depth=sp.r-distance; }
      else {
        const inner=sp.c.map((v,i)=>box.h[i]-Math.abs(v-box.c[i]));
        const axis=inner.indexOf(Math.min(...inner));
        n=[0,0,0]; n[axis]=(sp.c[axis]>=box.c[axis]?1:-1);
        depth=sp.r+inner[axis];
      }
      return {n:fromA?n.map(v=>-v):n,depth};
    }
    const overlaps=[0,1,2].map(i=>a.h[i]+b.h[i]-Math.abs(b.c[i]-a.c[i]));
    if(overlaps.some(v=>v<=0)) return null;
    const axis=overlaps.indexOf(Math.min(...overlaps));
    const n=[0,0,0]; n[axis]=(b.c[axis]>=a.c[axis]?1:-1);
    return {n,depth:overlaps[axis]};
  }
  // Continuous swept AABB for *translating* dynamic bodies against static
  // colliders. Rotation-enclosing AABBs are intentionally conservative.
  // Unlike bounded microsteps this also handles a very thin wall in one tick.
  function sweepStatic(body, before, displacement, statics) {
    if (displacement.every(d => Math.abs(d) < EPS)) return null;
    let earliest = 1, normal = null, hitObject = null;
    for (const stationary of statics) {
      if (stationary === body || stationary.level !== body.level) continue;
      const other = bounds(stationary);
      // The existing overlap solver handles objects initially intersecting.
      // Sweep tests must not trap a body *inside* furniture it is escaping.
      if (contact(before, other)) continue;
      let entry = -Infinity, exit = Infinity, axis = -1;
      let impossible = false;
      for (let k = 0; k < 3; k++) {
        const lo = other.c[k] - other.h[k] - before.h[k];
        const hi = other.c[k] + other.h[k] + before.h[k];
        const d = displacement[k];
        if (Math.abs(d) < EPS) {
          if (before.c[k] < lo || before.c[k] > hi) {impossible = true; break;}
          continue;
        }
        const near = Math.min((lo - before.c[k]) / d, (hi - before.c[k]) / d);
        const far = Math.max((lo - before.c[k]) / d, (hi - before.c[k]) / d);
        if (near > entry) {entry = near; axis = k;}
        exit = Math.min(exit, far);
      }
      if (impossible || axis < 0 || entry < 0 || entry > earliest || entry > exit || exit < 0) continue;
      earliest = entry;
      normal = [0,0,0];
      normal[axis] = displacement[axis] > 0 ? -1 : 1;
      // The collision response needs the body's original physical properties.
      // Kinematic bodies have no velocity in the impulse solver.
      hitObject = stationary;
    }
    return normal ? {time:earliest, normal, other:hitObject} : null;
  }
  // Relative-motion CCD catches fast dynamic/dynamic crossings even when
  // both endpoints are disjoint (ordinary overlap tests cannot observe them).
  function sweepMovingPair(beforeA, beforeB, relativeDisplacement) {
    if (contact(beforeA, beforeB)) return null; // handled by overlap solver
    let nearTime=-Infinity, farTime=Infinity, normalAxis=-1;
    for (let k=0;k<3;k++) {
      const low=beforeB.c[k]-beforeB.h[k]-beforeA.h[k];
      const high=beforeB.c[k]+beforeB.h[k]+beforeA.h[k];
      const delta=relativeDisplacement[k];
      if (Math.abs(delta)<EPS) {
        if (beforeA.c[k]<low || beforeA.c[k]>high) return null;
        continue;
      }
      const entry=Math.min((low-beforeA.c[k])/delta,(high-beforeA.c[k])/delta);
      const exit=Math.max((low-beforeA.c[k])/delta,(high-beforeA.c[k])/delta);
      if (entry>nearTime) {nearTime=entry;normalAxis=k;}
      farTime=Math.min(farTime,exit);
    }
    if (normalAxis<0 || nearTime<0 || nearTime>1 || nearTime>farTime || farTime<0) return null;
    const normal=[0,0,0]; // outward from B to A
    normal[normalAxis]=relativeDisplacement[normalAxis]>0?-1:1;
    return {time:nearTime,normal};
  }
  function active(o) {return !o.hidden && o.physics && o.physics.collider!==false;}
  function invMass(o) {return o && !o.hidden && !o.locked && o.physics && o.physics.mass>0 ? 1/o.physics.mass:0;}
  function respond(a,b,c) {
    const ia=invMass(a),ib=invMass(b),invSum=ia+ib;
    if(!invSum)return;
    const correction=Math.max(c.depth-0.0005,0)*0.85/invSum;
    if (correction>0) for(let i=0;i<3;i++) {
      a.position[i]-=c.n[i]*correction*ia;
      b.position[i]+=c.n[i]*correction*ib;
    }
    // An immovable body must have zero effective velocity at contact.
    // Project files can retain old velocities after mass becomes zero or the
    // object becomes locked. Treating those as motion creates phantom impulses.
    const va=ia>0?params(a).velocity:[0,0,0];
    const vb=ib>0?params(b).velocity:[0,0,0];
    const rel=vb.map((v,i)=>v-va[i]);
    const normalSpeed=dot(rel,c.n);
    if(normalSpeed>=0)return;
    const rest=Math.min(a.physics.restitution,b.physics.restitution);
    const impulse=-(1+(Math.abs(normalSpeed)>0.35?rest:0))*normalSpeed/invSum;
    for(let i=0;i<3;i++) {va[i]-=c.n[i]*impulse*ia;vb[i]+=c.n[i]*impulse*ib;}
    const tangent=rel.map((v,i)=>v-normalSpeed*c.n[i]);
    const tlen=length(tangent);
    if(tlen>EPS) {
      const friction=Math.sqrt(a.physics.friction*b.physics.friction);
      const jt=Math.min(tlen/invSum,impulse*friction);
      for(let i=0;i<3;i++) {
        const delta=tangent[i]/tlen*jt;
        va[i]+=delta*ia; vb[i]-=delta*ib;
      }
    }
  }
  class World {
    constructor(opts={}) {
      this.fixedStep=opts.fixedStep||1/120; this.maxSubsteps=opts.maxSubsteps||12;
      this.gravity=opts.gravity||[0,-9.81,0]; this.accumulator=0;
      this.lastContacts=0;
    }
    reset() {this.accumulator=0;this.lastContacts=0;}
    advance(delta,objects,levels, editingObject=null) {
      if(!Number.isFinite(delta)||delta<=0)return 0;
      // Handle tab sleep/alt-tab gracefully, avoid runaway catchup spiral.
      this.accumulator=Math.min(this.accumulator+Math.min(delta,0.1),this.fixedStep*this.maxSubsteps);
      let n=0;
      while(this.accumulator+EPS>=this.fixedStep && n<this.maxSubsteps) {
        this.step(this.fixedStep,objects,levels,editingObject);
        this.accumulator-=this.fixedStep; n++;
      }
      return n;
    }
    step(dt,objects,levels,editingObject=null) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      // Discrete overlap tests alone allow fast bodies to cross a thin wall
      // entirely between 120 Hz ticks. Subdivide just the fast-moving frames,
      // proportional to the travelling body's smallest collision dimension.
      // No extra work for a single free-falling body (floor uses a half-space).
      // This is conservative substepping, not guaranteed continuous collision
      // detection for arbitrarily thin geometry or teleportation. A bounded
      // 64 microstep limit also covers the minimum 0.01-scale editor geometry;
      // do not turn every render frame into an unbounded catch-up loop.
      const bodiesByFloor=new Map();
      for (const o of objects) if (o && active(o)) {
        bodiesByFloor.set(o.level,(bodiesByFloor.get(o.level)||0)+1);
      }
      let substeps=1;
      for(const o of objects) {
        if(!o || o===editingObject || !active(o) || invMass(o)===0 ||
           (bodiesByFloor.get(o.level)||0)<2) continue;
        const p=params(o), b=bounds(o);
        for(let axis=0;axis<3;axis++) {
          const travel=Math.abs(p.velocity[axis]+(p.gravity?this.gravity[axis]*dt:0))*dt;
          const safeTravel=Math.max(0.02,0.75*b.h[axis]);
          if (Number.isFinite(travel)) {
            substeps=Math.max(substeps,Math.min(64,Math.ceil(travel/safeTravel)));
          }
        }
      }
      for(let i=0;i<substeps;i++) this._stepDiscrete(dt/substeps,objects,levels,editingObject);
    }
    _stepDiscrete(dt,objects,levels,editingObject=null) {
      const candidates=[];
      const previousPositions=new Map();
      for(const o of objects) {
        if(!o || !Array.isArray(o.position) || o.hidden || !o.physics)continue;
        params(o);
        if(!o.position.every(Number.isFinite))continue;
        candidates.push(o);
        if(invMass(o)===0 || o===editingObject)continue;
        previousPositions.set(o, [...o.position]);
        const p=o.physics;
        if(p.gravity) for(let i=0;i<3;i++)p.velocity[i]+=this.gravity[i]*dt;
        const drag=Math.exp(-clamp(p.linearDamping,0,10)*dt);
        const angularDrag=Math.exp(-clamp(p.angularDamping,0,10)*dt);
        for(let i=0;i<3;i++) {
          p.velocity[i]=clamp(p.velocity[i]*drag,-120,120);
          o.position[i]=clamp(o.position[i]+p.velocity[i]*dt,-1e7,1e7);
          p.angularVelocity[i]=clamp(p.angularVelocity[i]*angularDrag,-25,25);
          // Rotation has the same finite ±1e7 range as the .rvproj validator.
          // This is normally irrelevant, but a legacy object already close to
          // the limit must not become unsaveable while physics is running.
          const newAngle=o.rotation[i]+p.angularVelocity[i]*dt;
          o.rotation[i]=clamp(newAngle,-1e7,1e7);
          if ((newAngle!==o.rotation[i] && Math.sign(p.angularVelocity[i])===Math.sign(newAngle)) ||
              Math.abs(p.angularVelocity[i])<0.0001) p.angularVelocity[i]=0;
        }
      }
      // Resolve continuous crossings of static geometry before the ordinary
      // overlap/contact solver, including thin walls a microstep can skip.
      // Objects with collision disabled intentionally retain their old floor
      // support semantics, but do not collide with static scene objects.
      const statics=candidates.filter(o => o !== editingObject && active(o) && invMass(o)===0);
      for (const [o, oldPosition] of previousPositions) {
        if (!active(o) || !statics.length) continue;
        const displacement=o.position.map((v,i)=>v-oldPosition[i]);
        const previous={...o,position:oldPosition};
        const hit=sweepStatic(o,bounds(previous),displacement,statics);
        if (!hit) continue;
        const lengthMoved=Math.hypot(...displacement);
        const t=Math.max(0,hit.time-0.00001/Math.max(lengthMoved,EPS));
        for(let k=0;k<3;k++)o.position[k]=oldPosition[k]+displacement[k]*t;
        const p=o.physics, speed=dot(p.velocity,hit.normal);
        if (speed<0) {
          const restitution=Math.min(p.restitution,hit.other.physics.restitution);
          for(let k=0;k<3;k++) p.velocity[k]-=(1+restitution)*speed*hit.normal[k];
        }
      }
      // Continuous dynamic/dynamic contacts: relative motion can exchange the
      // positions of two narrow objects without ever overlapping at a sample.
      // Swept X intervals limit the candidate search. Rotated boxes and spheres
      // use their conservative enclosing AABBs here (not exact shape casts).
      const moving=[...previousPositions.keys()].filter(o=>active(o));
      const swept=moving.map(o=>{
        const old=previousPositions.get(o), b=bounds({...o,position:old});
        const d=o.position.map((v,i)=>v-old[i]);
        return {o,old,b,d,
          low:Math.min(b.c[0],b.c[0]+d[0])-b.h[0],
          high:Math.max(b.c[0],b.c[0]+d[0])+b.h[0]};
      }).sort((a,b)=>a.low-b.low);
      const impacts=[];
      for(let i=0;i<swept.length;i++) {
        const a=swept[i];
        for(let j=i+1;j<swept.length;j++) {
          const b=swept[j];
          if (b.low>a.high) break;
          if (a.o.level!==b.o.level) continue;
          if ([1,2].some(k=>Math.max(
              Math.min(a.b.c[k],a.b.c[k]+a.d[k])-a.b.h[k],
              Math.min(b.b.c[k],b.b.c[k]+b.d[k])-b.b.h[k]) > Math.min(
              Math.max(a.b.c[k],a.b.c[k]+a.d[k])+a.b.h[k],
              Math.max(b.b.c[k],b.b.c[k]+b.d[k])+b.b.h[k]))) continue;
          const relative=a.d.map((v,k)=>v-b.d[k]);
          const hit=sweepMovingPair(a.b,b.b,relative);
          if(hit) impacts.push({a,b,hit,relative});
        }
      }
      // Process earliest hits first. A body may not be rolled back twice from
      // the same initial pose (which would teleport it through the first hit).
      // Later contacts are handled on the following fixed microstep.
      impacts.sort((a,b)=>a.hit.time-b.hit.time);
      const resolved=new Set();
      for (const {a,b,hit,relative} of impacts) {
        if(resolved.has(a.o) || resolved.has(b.o))continue;
        resolved.add(a.o);resolved.add(b.o);
        const t=Math.max(0,hit.time-0.00001/Math.max(length(relative),EPS));
        for(let k=0;k<3;k++) {
          a.o.position[k]=a.old[k]+a.d[k]*t;
          b.o.position[k]=b.old[k]+b.d[k]*t;
        }
        respond(a.o,b.o,{n:hit.normal.map(v=>-v),depth:0});
      }
      // Floor is an implicit zero-thickness supporting half-space for every level.
      // Only a moving body's floor applies; floors don't block objects on other levels.
      for(const o of candidates) {
        if(invMass(o)===0 || o===editingObject)continue;
        const floor=levels[o.level]?.height;
        if(!Number.isFinite(floor))continue;
        const b=bounds(o),bottom=b.c[1]-b.h[1];
        if(bottom < floor) {
          o.position[1]+=floor-bottom;
          const p=o.physics;
          if(p.velocity[1]<0) p.velocity[1]=Math.abs(p.velocity[1])>0.35 ? -p.velocity[1]*Math.min(0.9,p.restitution) : 0;
          p.velocity[0]*=Math.max(0,1-p.friction*dt*8);
          p.velocity[2]*=Math.max(0,1-p.friction*dt*8);
        }
      }
      // Sweep-and-prune broadphase on X; excludes unrelated floors and static/static.
      const entries=candidates.filter(active).map(o=>({o,b:bounds(o)}));
      entries.sort((a,b)=>a.b.c[0]-a.b.h[0]-(b.b.c[0]-b.b.h[0]));
      const contacts=[];
      for(let i=0;i<entries.length;i++) {
        const A=entries[i];
        for(let j=i+1;j<entries.length;j++) {
          const B=entries[j];
          if(B.b.c[0]-B.b.h[0] > A.b.c[0]+A.b.h[0])break;
          if(A.o.level!==B.o.level || (invMass(A.o)===0 && invMass(B.o)===0))continue;
          if(A.o===editingObject || B.o===editingObject)continue;
          const c=contact(A.b,B.b);
          if(c)contacts.push({a:A.o,b:B.o,c});
        }
      }
      this.lastContacts=contacts.length;
      for(let iteration=0;iteration<4;iteration++) {
        for(const {a,b} of contacts) {
          const c=contact(bounds(a),bounds(b));
          if(c)respond(a,b,c);
        }
      }
      // Contacts are resolved *after* the first floor support pass. A ceiling
      // or another rigid body can push the moving body back under the floor;
      // enforce floor support again after all collision corrections. When a
      // static ceiling leaves insufficient space, prioritize the level floor
      // over the ceiling (the two constraints cannot both be satisfied).
      // Do not apply floor friction twice within one microstep.
      for(const o of candidates) if(invMass(o)>0) {
        const floor=levels[o.level]?.height;
        if(Number.isFinite(floor)) {
          const b=bounds(o), bottom=b.c[1]-b.h[1];
          if(bottom<floor) {
            o.position[1]+=floor-bottom;
            if(o.physics.velocity[1]<0)o.physics.velocity[1]=0;
          }
        }
      }
      // Floor projection and contacts can also push coordinates beyond the
      // .rvproj v1 limits. Keep the saved project representable.
      for(const o of candidates) if(invMass(o)>0) {
        const v=o.physics.velocity;
        for(let k=0;k<3;k++) {
          if(o.position[k]>1e7) {o.position[k]=1e7;if(v[k]>0)v[k]=0;}
          else if(o.position[k]<-1e7) {o.position[k]=-1e7;if(v[k]<0)v[k]=0;}
          if(Math.abs(v[k])<0.001)v[k]=0;
        }
      }
    }
  }
  return {World, bounds, contact, defaults:DEFAULTS, params};
});
