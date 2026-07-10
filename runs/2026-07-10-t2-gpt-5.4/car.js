import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js";
import {CONFIG} from "./config.js";
import {approach, clamp, lerp} from "./utils.js";

const PLAYER_BODY_COLOR="#ff4fb3";
const PLAYER_GLOW_COLOR="#ffbd59";
const TRAFFIC_COLORS=["#64d2ff","#6eff9f","#ffd86e","#b98cff","#ff7d7d"];

function createBodyMaterial(color,emissiveColor,intensity){
    return new THREE.MeshStandardMaterial({
        color,
        metalness:0.18,
        roughness:0.35,
        emissive:emissiveColor,
        emissiveIntensity:intensity
    });
}

function createCarModel({color,glowColor,isTruck=false}){
    const group=new THREE.Group();
    const bodyLength=isTruck?4.8:3.4;
    const cabinLength=isTruck?2.1:1.5;
    const width=isTruck?2.1:1.8;
    const height=isTruck?1.3:1;

    const base=new THREE.Mesh(
        new THREE.BoxGeometry(width,0.8,bodyLength),
        createBodyMaterial(color,glowColor,0.45)
    );
    base.position.y=0.75;
    group.add(base);

    const cabin=new THREE.Mesh(
        new THREE.BoxGeometry(width*0.78,height,cabinLength),
        new THREE.MeshStandardMaterial({
            color:isTruck?"#dfe8ff":"#d6ebff",
            roughness:0.15,
            metalness:0.05,
            transparent:true,
            opacity:0.92
        })
    );
    cabin.position.set(0,1.35,isTruck?0.1:-0.15);
    group.add(cabin);

    const wheelGeometry=new THREE.CylinderGeometry(0.38,0.38,0.42,18);
    const wheelMaterial=new THREE.MeshStandardMaterial({color:"#14161c",roughness:0.88});
    const wheelOffsets=[
        [-width/2-0.04,0.38,-bodyLength*0.28],
        [width/2+0.04,0.38,-bodyLength*0.28],
        [-width/2-0.04,0.38,bodyLength*0.28],
        [width/2+0.04,0.38,bodyLength*0.28]
    ];

    for(const [x,y,z] of wheelOffsets){
        const wheel=new THREE.Mesh(wheelGeometry,wheelMaterial);
        wheel.rotation.z=Math.PI/2;
        wheel.position.set(x,y,z);
        group.add(wheel);
    }

    const headlightMaterial=new THREE.MeshBasicMaterial({color:"#fff3b0"});
    const taillightMaterial=new THREE.MeshBasicMaterial({color:"#ff4265"});
    const lightGeometry=new THREE.BoxGeometry(0.26,0.12,0.16);
    for(const side of [-1,1]){
        const headlight=new THREE.Mesh(lightGeometry,headlightMaterial);
        headlight.position.set(side*0.55,0.78,-bodyLength/2-0.05);
        group.add(headlight);

        const taillight=new THREE.Mesh(lightGeometry,taillightMaterial);
        taillight.position.set(side*0.55,0.78,bodyLength/2+0.05);
        group.add(taillight);
    }

    return group;
}

export class PlayerCar{
    constructor(road){
        this.road=road;
        this.mesh=createCarModel({color:PLAYER_BODY_COLOR,glowColor:PLAYER_GLOW_COLOR});
        this.mesh.position.set(0,0,0);
        this.speed=CONFIG.startPlayerSpeed;
        this.steer=0;
        this.x=0;
        this.distance=0;
        this.boost=CONFIG.boostMax;
        this.crashed=false;
    }

    reset(){
        this.speed=CONFIG.startPlayerSpeed;
        this.steer=0;
        this.x=0;
        this.distance=0;
        this.boost=CONFIG.boostMax;
        this.crashed=false;
        this.mesh.position.set(0,0,0);
        this.mesh.rotation.set(0,0,0);
    }

    update(delta,controls){
        const accelerateInput=controls.accelerate?CONFIG.acceleration:0;
        const brakeInput=controls.brake?CONFIG.braking:0;
        const boostReady=controls.boost&&this.boost>6&&this.speed>28;
        const boostInput=boostReady?CONFIG.boostPower:0;

        this.speed+=accelerateInput*delta;
        this.speed-=brakeInput*delta;
        this.speed-=CONFIG.drag*delta;
        this.speed+=boostInput*delta;
        this.speed=clamp(this.speed,16,CONFIG.maxPlayerSpeed+(boostReady?10:0));

        if(boostReady){
            this.boost=clamp(this.boost-CONFIG.boostDrain*delta,0,CONFIG.boostMax);
        }else{
            this.boost=clamp(this.boost+CONFIG.boostRecover*delta,0,CONFIG.boostMax);
        }

        const steerTarget=(controls.left?-1:0)+(controls.right?1:0);
        const steerDelta=(steerTarget===0?CONFIG.steerReturn:CONFIG.steerAcceleration)*delta;
        this.steer=approach(this.steer,steerTarget,steerDelta);
        this.steer=clamp(this.steer,-CONFIG.maxSteer,CONFIG.maxSteer);

        const edge=this.road.totalHalfWidth-1.2;
        const lateralSpeed=this.steer*(this.speed*0.35+7);
        this.x=clamp(this.x+lateralSpeed*delta,-edge,edge);
        this.distance+=this.speed*delta;

        this.mesh.position.x=lerp(this.mesh.position.x,this.x,0.18);
        this.mesh.position.y=0.18+Math.abs(this.steer)*0.03;
        this.mesh.rotation.z=-this.steer*0.16;
        this.mesh.rotation.y=-this.steer*0.22;

        return boostReady;
    }

    getBounds(){
        return {
            x:this.x,
            z:this.distance,
            halfWidth:CONFIG.collisionWidth,
            halfLength:CONFIG.collisionLength
        };
    }
}

export class TrafficCar{
    constructor(road,laneIndex,worldZ,speed,kind="car"){
        this.road=road;
        this.laneIndex=laneIndex;
        this.speed=speed;
        this.worldZ=worldZ;
        this.kind=kind;
        this.width=kind==="truck"?1.85:1.55;
        this.length=kind==="truck"?3.6:2.5;
        this.passed=false;
        this.nearMissed=false;
        this.swayPhase=Math.random()*Math.PI*2;
        this.currentSway=0;
        this.mesh=createCarModel({
            color:TRAFFIC_COLORS[Math.floor(Math.random()*TRAFFIC_COLORS.length)],
            glowColor:"#62d8ff",
            isTruck:kind==="truck"
        });
        this.mesh.position.y=0;
    }

    update(delta,playerDistance){
        this.worldZ-=this.speed*delta;
        const laneCenter=this.road.getLaneCenter(this.laneIndex);
        this.currentSway=this.kind==="swerve"?Math.sin(this.swayPhase+playerDistance*0.09)*0.55:0;
        this.mesh.position.set(laneCenter+this.currentSway,0,this.worldZ-playerDistance);
        this.mesh.rotation.y=this.currentSway*0.1;
    }

    recycle(laneIndex,worldZ,speed,kind){
        this.laneIndex=laneIndex;
        this.worldZ=worldZ;
        this.speed=speed;
        this.kind=kind;
        this.width=kind==="truck"?1.85:1.55;
        this.length=kind==="truck"?3.6:2.5;
        this.passed=false;
        this.nearMissed=false;
        this.swayPhase=Math.random()*Math.PI*2;
        this.currentSway=0;
    }

    getBounds(){
        return {
            x:this.road.getLaneCenter(this.laneIndex)+this.currentSway,
            z:this.worldZ,
            halfWidth:this.width,
            halfLength:this.length
        };
    }
}
