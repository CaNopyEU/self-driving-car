export class Controls{
    constructor(){
        this.left=false;
        this.right=false;
        this.accelerate=false;
        this.brake=false;
        this.boost=false;
        this.startPressed=false;
        this.restartPressed=false;

        this.#bind();
    }

    #bind(){
        window.addEventListener("keydown",(event)=>{
            if(event.repeat&&(event.code==="Enter"||event.code==="Space")){
                return;
            }

            switch(event.code){
                case "ArrowLeft":
                case "KeyA":
                    this.left=true;
                    break;
                case "ArrowRight":
                case "KeyD":
                    this.right=true;
                    break;
                case "ArrowUp":
                case "KeyW":
                    this.accelerate=true;
                    break;
                case "ArrowDown":
                case "KeyS":
                    this.brake=true;
                    break;
                case "ShiftLeft":
                case "ShiftRight":
                case "Space":
                    this.boost=true;
                    break;
                case "Enter":
                    this.startPressed=true;
                    this.restartPressed=true;
                    break;
            }
        });

        window.addEventListener("keyup",(event)=>{
            switch(event.code){
                case "ArrowLeft":
                case "KeyA":
                    this.left=false;
                    break;
                case "ArrowRight":
                case "KeyD":
                    this.right=false;
                    break;
                case "ArrowUp":
                case "KeyW":
                    this.accelerate=false;
                    break;
                case "ArrowDown":
                case "KeyS":
                    this.brake=false;
                    break;
                case "ShiftLeft":
                case "ShiftRight":
                case "Space":
                    this.boost=false;
                    break;
                case "Enter":
                    this.startPressed=false;
                    this.restartPressed=false;
                    break;
            }
        });
    }
}
