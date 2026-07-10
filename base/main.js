const carCanvas=document.getElementById("carCanvas");
carCanvas.width=200;
const networkCanvas=document.getElementById("networkCanvas");
networkCanvas.width=300;

const carCtx=carCanvas.getContext("2d");
const networkCtx=networkCanvas.getContext("2d");

let road,cars,bestCar,traffic,animationId,nextTrafficId=0;
let generation=parseInt(localStorage.getItem("generation"))||1;
let allDamagedTime=0;
const AUTO_RESTART_DELAY=3000;

function initSimulation(){
    road=new Road(carCanvas.width/2,carCanvas.width*0.9,CONFIG.laneCount);

    cars=generateCars(CONFIG.N);
    bestCar=cars[0];
    allDamagedTime=0;

    const savedBrain=localStorage.getItem("bestBrain");
    if(savedBrain){
        try{
            const parsed=JSON.parse(savedBrain);
            const expectedInputs=CONFIG.rayCount;
            const expectedHidden=CONFIG.hiddenNeurons;
            const compatible=parsed.levels&&
                parsed.levels.length===2&&
                parsed.levels[0].inputs.length===expectedInputs&&
                parsed.levels[0].outputs.length===expectedHidden&&
                parsed.levels[1].outputs.length===4;

            if(compatible){
                for(let i=0;i<cars.length;i++){
                    cars[i].brain=JSON.parse(savedBrain);
                    if(i!=0){
                        NeuralNetwork.mutate(cars[i].brain,CONFIG.mutationRate);
                    }
                }
            }else{
                localStorage.removeItem("bestBrain");
                localStorage.removeItem("generation");
                generation=1;
            }
        }catch(e){
            localStorage.removeItem("bestBrain");
        }
    }

    traffic=[];
    nextTrafficId=0;
    const startPositions=[-100,-300,-300,-500,-500,-700,-700];
    for(let i=0;i<startPositions.length;i++){
        const lane=Math.floor(Math.random()*CONFIG.laneCount);
        const t=new Car(road.getLaneCenter(lane),startPositions[i],30,50,"DUMMY",CONFIG.trafficSpeed,getRandomColor());
        t.trafficId=nextTrafficId++;
        traffic.push(t);
    }

    animationId=requestAnimationFrame(animate);
}

function restartSimulation(){
    if(animationId){
        cancelAnimationFrame(animationId);
    }
    initSimulation();
}

function save(){
    localStorage.setItem("bestBrain",
        JSON.stringify(bestCar.brain));
    generation++;
    localStorage.setItem("generation",generation);
}

function saveAndRestart(){
    save();
    restartSimulation();
}

function discard(){
    if(!confirm("Delete saved brain and reset generation? This cannot be undone.")) return;
    localStorage.removeItem("bestBrain");
    localStorage.removeItem("generation");
    generation=1;
}

function generateCars(N){
    const cars=[];
    for(let i=1;i<=N;i++){
        const c=new Car(road.getLaneCenter(1),100,30,50,"AI",CONFIG.maxSpeedAI);
        c.passedTraffic=new Set();
        c.overtakeCount=0;
        cars.push(c);
    }
    return cars;
}

function getFitness(car){
    const distance=100-car.y;
    return distance+car.overtakeCount*CONFIG.overtakeWeight;
}

function updateOvertakes(){
    for(let i=0;i<cars.length;i++){
        const car=cars[i];
        if(car.damaged) continue;
        for(let j=0;j<traffic.length;j++){
            const t=traffic[j];
            if(t.trafficId!==undefined&&!car.passedTraffic.has(t.trafficId)&&car.y<t.y){
                car.passedTraffic.add(t.trafficId);
                car.overtakeCount++;
            }
        }
    }
}

function spawnTraffic(){
    const minY=bestCar.y-800;
    for(let i=traffic.length-1;i>=0;i--){
        if(traffic[i].y>bestCar.y+500){
            traffic.splice(i,1);
        }
    }
    let furthest=traffic.length?Math.min(...traffic.map(t=>t.y)):bestCar.y;
    while(furthest>minY){
        const lane=Math.floor(Math.random()*road.laneCount);
        const offset=-150-Math.random()*100;
        const t=new Car(road.getLaneCenter(lane),furthest+offset,30,50,"DUMMY",CONFIG.trafficSpeed,getRandomColor());
        t.trafficId=nextTrafficId++;
        traffic.push(t);
        furthest+=offset;
    }
}

function drawHUD(time){
    const alive=cars.filter(c=>!c.damaged).length;
    const distance=Math.round(100-bestCar.y);
    const passed=bestCar.overtakeCount||0;
    const fitness=Math.round(getFitness(bestCar));

    carCtx.save();
    carCtx.font="bold 13px monospace";
    carCtx.textAlign="left";
    carCtx.fillStyle="rgba(0,0,0,0.5)";
    carCtx.fillRect(4,4,130,100);
    carCtx.fillStyle="#fff";
    carCtx.fillText("Gen: "+generation,12,20);
    carCtx.fillText("Alive: "+alive+"/"+CONFIG.N,12,36);
    carCtx.fillText("Dist: "+distance,12,52);
    carCtx.fillText("Passed: "+passed,12,68);
    carCtx.fillStyle="#ff0";
    carCtx.fillText("Fit: "+fitness,12,84);
    carCtx.fillStyle=localStorage.getItem("bestBrain")?"#6f6":"#f66";
    carCtx.fillText(localStorage.getItem("bestBrain")?"Brain: saved":"Brain: none",12,100);
    carCtx.restore();

    if(alive===0){
        if(allDamagedTime===0) allDamagedTime=time;
        const elapsed=time-allDamagedTime;
        const remaining=Math.max(0,Math.ceil((AUTO_RESTART_DELAY-elapsed)/1000));

        carCtx.save();
        carCtx.font="bold 16px sans-serif";
        carCtx.textAlign="center";
        carCtx.fillStyle="rgba(0,0,0,0.6)";
        carCtx.fillRect(carCanvas.width/2-90,carCanvas.height/2-30,180,50);
        carCtx.fillStyle="#f66";
        carCtx.fillText("All cars crashed!",carCanvas.width/2,carCanvas.height/2-8);
        carCtx.font="13px sans-serif";
        carCtx.fillStyle="#ccc";
        carCtx.fillText("Restarting in "+remaining+"s...",carCanvas.width/2,carCanvas.height/2+12);
        carCtx.restore();

        if(elapsed>=AUTO_RESTART_DELAY){
            restartSimulation();
            return;
        }
    }else{
        allDamagedTime=0;
    }
}

function animate(time){
    if(CONFIG.paused){
        carCanvas.height=window.innerHeight;
        networkCanvas.height=window.innerHeight;
        carCtx.save();
        carCtx.translate(0,-bestCar.y+carCanvas.height*0.7);
        road.draw(carCtx);
        for(let i=0;i<traffic.length;i++) traffic[i].draw(carCtx);
        carCtx.globalAlpha=CONFIG.nonBestOpacity;
        for(let i=0;i<cars.length;i++) cars[i].draw(carCtx);
        carCtx.globalAlpha=1;
        bestCar.draw(carCtx,CONFIG.showSensors);
        carCtx.restore();
        drawHUD(time);
        networkCtx.lineDashOffset=-time/50;
        Visualizer.drawNetwork(networkCtx,bestCar.brain);
        animationId=requestAnimationFrame(animate);
        return;
    }

    for(let s=0;s<CONFIG.simSpeed;s++){
        for(let i=0;i<traffic.length;i++){
            traffic[i].update(road.borders,[]);
        }
        for(let i=0;i<cars.length;i++){
            cars[i].update(road.borders,traffic);
        }
        updateOvertakes();
        bestCar=cars.reduce((best,car)=>getFitness(car)>getFitness(best)?car:best);
        spawnTraffic();
    }

    carCanvas.height=window.innerHeight;
    networkCanvas.height=window.innerHeight;

    carCtx.save();
    carCtx.translate(0,-bestCar.y+carCanvas.height*0.7);

    road.draw(carCtx);
    for(let i=0;i<traffic.length;i++){
        traffic[i].draw(carCtx);
    }
    carCtx.globalAlpha=CONFIG.nonBestOpacity;
    for(let i=0;i<cars.length;i++){
        cars[i].draw(carCtx);
    }
    carCtx.globalAlpha=1;
    bestCar.draw(carCtx,CONFIG.showSensors);

    carCtx.restore();

    drawHUD(time);

    networkCtx.lineDashOffset=-time/50;
    Visualizer.drawNetwork(networkCtx,bestCar.brain);
    animationId=requestAnimationFrame(animate);
}

initSimulation();
