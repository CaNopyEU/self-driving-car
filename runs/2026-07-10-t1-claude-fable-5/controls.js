class Controls{
    constructor(type){
        this.forward=false;
        this.left=false;
        this.right=false;
        this.reverse=false;

        switch(type){
            case "KEYS":
                this.#addKeyboardListeners();
                break;
            case "DUMMY":
                this.forward=true;
                break;
            // "SMART": driven by neural network each frame
        }
    }

    #addKeyboardListeners(){
        const map=(key)=>{
            switch(key){
                case "ArrowLeft": case "a": case "A": return "left";
                case "ArrowRight": case "d": case "D": return "right";
                case "ArrowUp": case "w": case "W": return "forward";
                case "ArrowDown": case "s": case "S": return "reverse";
            }
            return null;
        };
        document.addEventListener("keydown",(event)=>{
            const dir=map(event.key);
            if(dir){
                this[dir]=true;
                event.preventDefault();
            }
        });
        document.addEventListener("keyup",(event)=>{
            const dir=map(event.key);
            if(dir) this[dir]=false;
        });
    }
}
