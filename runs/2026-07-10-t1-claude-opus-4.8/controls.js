class Controls{
    constructor(type){
        this.forward=false;
        this.left=false;
        this.right=false;
        this.reverse=false;
        this.boost=false;

        if(type=="KEYS"){
            this.#addKeyboardListeners();
        }else if(type=="DUMMY"){
            this.forward=true;
        }
    }

    #addKeyboardListeners(){
        const set=(k,v)=>{
            switch(k){
                case "ArrowLeft": case "a": case "A": this.left=v; break;
                case "ArrowRight": case "d": case "D": this.right=v; break;
                case "ArrowUp": case "w": case "W": this.forward=v; break;
                case "ArrowDown": case "s": case "S": this.reverse=v; break;
                case "Shift": this.boost=v; break;
            }
        };
        this._down=(e)=>{
            if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key)) e.preventDefault();
            set(e.key,true);
        };
        this._up=(e)=>set(e.key,false);
        document.addEventListener("keydown",this._down);
        document.addEventListener("keyup",this._up);
    }

    reset(){
        this.forward=this.left=this.right=this.reverse=this.boost=false;
    }
}
