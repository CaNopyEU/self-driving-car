import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js";
import {CONFIG} from "./config.js";
import {lerp} from "./utils.js";

function makeRoadMaterial(color,emissive,intensity){
    return new THREE.MeshStandardMaterial({
        color,
        roughness:0.92,
        metalness:0.05,
        emissive,
        emissiveIntensity:intensity
    });
}

export class Road{
    constructor(scene){
        this.scene=scene;
        this.roadWidth=CONFIG.laneCount*CONFIG.laneWidth;
        this.totalHalfWidth=this.roadWidth/2+CONFIG.shoulderWidth;
        this.segmentLength=CONFIG.roadSegmentLength;
        this.segments=[];
        this.roadGroup=new THREE.Group();
        this.roadGroup.position.y=-0.02;
        scene.add(this.roadGroup);
        this.#build();
    }

    #build(){
        const asphaltMaterial=makeRoadMaterial("#11131b","#120f21",0.55);
        const shoulderMaterial=makeRoadMaterial("#1a1d28","#20163c",0.4);
        const laneMarkerMaterial=new THREE.MeshBasicMaterial({color:"#ffe99a"});
        const railMaterial=new THREE.MeshStandardMaterial({
            color:"#6e93ff",
            emissive:"#6e93ff",
            emissiveIntensity:0.7,
            roughness:0.2,
            metalness:0.6
        });

        for(let i=0;i<CONFIG.visibleSegments;i++){
            const segment=new THREE.Group();

            const roadMesh=new THREE.Mesh(
                new THREE.BoxGeometry(this.roadWidth,0.1,this.segmentLength),
                asphaltMaterial
            );
            segment.add(roadMesh);

            const shoulderMesh=new THREE.Mesh(
                new THREE.BoxGeometry(this.roadWidth+CONFIG.shoulderWidth*2,0.06,this.segmentLength),
                shoulderMaterial
            );
            shoulderMesh.position.y=-0.06;
            segment.add(shoulderMesh);

            for(let lane=1;lane<CONFIG.laneCount;lane++){
                const marker=new THREE.Mesh(
                    new THREE.BoxGeometry(0.12,0.04,this.segmentLength*0.45),
                    laneMarkerMaterial
                );
                marker.position.set(-this.roadWidth/2+lane*CONFIG.laneWidth,0.07,0);
                segment.add(marker);
            }

            for(const side of [-1,1]){
                const rail=new THREE.Mesh(
                    new THREE.BoxGeometry(0.12,0.28,this.segmentLength),
                    railMaterial
                );
                rail.position.set(side*(this.totalHalfWidth+0.25),0.2,0);
                segment.add(rail);

                const postLight=new THREE.PointLight(side<0?"#58dbff":"#ff59a7",5,15,2);
                postLight.position.set(side*(this.totalHalfWidth+0.55),1.6,0);
                segment.add(postLight);

                const orb=new THREE.Mesh(
                    new THREE.SphereGeometry(0.11,12,12),
                    new THREE.MeshBasicMaterial({color:side<0?"#58dbff":"#ff59a7"})
                );
                orb.position.copy(postLight.position);
                segment.add(orb);
            }

            this.roadGroup.add(segment);
            this.segments.push(segment);
        }
    }

    getLaneCenter(index){
        return -this.roadWidth/2+CONFIG.laneWidth*(index+0.5);
    }

    update(playerDistance){
        const loopLength=this.segmentLength*this.segments.length;
        for(let i=0;i<this.segments.length;i++){
            const segment=this.segments[i];
            const worldZ=i*this.segmentLength;
            let relativeZ=worldZ-(playerDistance%loopLength);
            if(relativeZ<-this.segmentLength){
                relativeZ+=loopLength;
            }
            segment.position.z=relativeZ-this.segmentLength*2;
        }
        this.roadGroup.position.x=lerp(this.roadGroup.position.x,0,0.1);
    }
}
