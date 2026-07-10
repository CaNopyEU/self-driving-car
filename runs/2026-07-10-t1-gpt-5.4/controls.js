class Controls{
    constructor(){
        this.forward=false;
        this.left=false;
        this.right=false;
        this.reverse=false;
        this.boost=false;
        this.#addKeyboardListeners();
    }

    #addKeyboardListeners(){
        document.addEventListener("keydown",(event)=>{
            this.#setKey(event,true);
        });

        document.addEventListener("keyup",(event)=>{
            this.#setKey(event,false);
        });
    }

    #setKey(event,pressed){
        switch(event.key.toLowerCase()){
            case "arrowleft":
            case "a":
                this.left=pressed;
                event.preventDefault();
                break;
            case "arrowright":
            case "d":
                this.right=pressed;
                event.preventDefault();
                break;
            case "arrowup":
            case "w":
                this.forward=pressed;
                event.preventDefault();
                break;
            case "arrowdown":
            case "s":
                this.reverse=pressed;
                event.preventDefault();
                break;
            case " ":
                this.boost=pressed;
                event.preventDefault();
                break;
        }
    }
}
