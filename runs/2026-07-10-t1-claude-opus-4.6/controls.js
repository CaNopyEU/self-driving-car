class Controls{
    constructor(type){
        this.forward=false;
        this.left=false;
        this.right=false;
        this.reverse=false;
        if(type==="KEYS") this.#addKeyboardListeners();
        if(type==="DUMMY") this.forward=true;
    }
    #addKeyboardListeners(){
        document.addEventListener("keydown",(e)=>{
            switch(e.key){
                case "ArrowLeft":case "a":case "A": this.left=true;break;
                case "ArrowRight":case "d":case "D": this.right=true;break;
                case "ArrowUp":case "w":case "W": this.forward=true;break;
                case "ArrowDown":case "s":case "S": this.reverse=true;break;
            }
        });
        document.addEventListener("keyup",(e)=>{
            switch(e.key){
                case "ArrowLeft":case "a":case "A": this.left=false;break;
                case "ArrowRight":case "d":case "D": this.right=false;break;
                case "ArrowUp":case "w":case "W": this.forward=false;break;
                case "ArrowDown":case "s":case "S": this.reverse=false;break;
            }
        });
    }
}
