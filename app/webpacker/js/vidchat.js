(function() {
  window.load_vidchat = function(){
    window.start_channel();
    new VidchatControls();
  }

  var VidchatControls = function(){
    var root = $(".webrtc");
    var start_button = root.find('#start_video');
    var end_button = root.find('#end_video');
    var current_player = root.data("index"); 
    var local_host = root.find("#video-" + current_player); 
    var local_stream;

    var start_call = function(e){
      e.preventDefault();
      navigator
        .mediaDevices
        .getUserMedia({ 
          video: { 
            width: { max: 115 },
            height: { max: 85 },
            frameRate: { max: 30 }
          },
          audio: true
        })
        .then(got_local_stream)
        .catch(e => console.log('getUserMedia() error: ', e));
      return false;
    }

    var got_local_stream = function(stream){
      // display our local video in the respective tag
      local_host[0].srcObject = stream;

      start_button.addClass("d-none");
      end_button.removeClass("d-none");

      var vidchat = new Vidchat(stream);
      vidchat.start();
    };

    var end_call = function(e){
      e.preventDefault();
      for (const track of local_host[0].srcObject.getTracks()) {
        track.stop();
      }
      end_button.addClass("d-none");
      start_button.removeClass("d-none");
      return false;
    };

    start_button.on("click", start_call);
    end_button.on('click', end_call);
  }

  class Vidpeer {
    constructor(other_player, stream){
      this.allow_ice = null;
      this.other_player = other_player;
      this.stream = stream;
      this.root = $(".webrtc");
      this.current_player = this.root.data("index"); 
      this.between = "(" + this.current_player + " <> " + this.other_player + ")";
      console.log("Creating Vidpeer between: " + this.between);

      var id = "video-" + this.other_player;
      this.root.find(".videos").append(
        "<br /><video id=\"" + id + "\" class=\"remote\" playsinline autoplay></video>"
      )
      this.remote_video = this.root.find("#" + id)[0];

      this.peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.stunprotocol.org",
            ]
          }
        ]
      });
  
      this.peer.addEventListener("icecandidate", (event) => {
        if(!event.candidate){ return; }
        console.log("Ice Found: " + this.between + " Ice Enabled: " + this.allow_ice)
        if(this.allow_ice === null){
          // TODO: queue it?
          console.log("-- ALERT!!! ICE NOT YET ALLOWED");
          return;
        }
        // when we discover a candidate, send it to the other party
        $(document).trigger("send_message", { 
          type: "webrtc_ice_candidate",
          message: JSON.parse(JSON.stringify(event.candidate)),
          to_index: this.other_player
        });
      }, false);

      this.peer.addEventListener("track", (event) => {
        // TODO: check if srcObject already set?
        console.log("Add Track: " + this.between, event.streams)
        if(this.remote_video.srcObject === null){
          this.remote_video.srcObject = event.streams[0];
        } else {
          console.log(" - Track already present!!!")
        }
      });

      this.addLocalStream();
    }

    async addLocalStream(){
      console.log("Add local stream to webrtc: " + this.between);
      for(const track of this.stream.getTracks()){
        this.peer.addTrack(track, this.stream);
      }
    }
    
    async createOffer(){
      console.log("Create Offer: " + this.between);
      var offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      offer = JSON.parse(JSON.stringify(offer))
      $(document).trigger("send_message", { 
        type: "webrtc_offer", 
        message: offer,
        to_index: this.other_player
      });
    }

    async acceptOffer(offer){
      console.log("Accept Offer: " + this.between);
      await this.peer.setRemoteDescription(offer);
      var answer = await this.peer.createAnswer();
      await this.peer.setLocalDescription(answer);
      answer = JSON.parse(JSON.stringify(answer));
      $(document).trigger("send_message", { 
        type: "webrtc_answer", 
        message: answer,
        to_index: this.other_player
      });
      this.allow_ice = true;
      //this.addLocalStream();
    }

    async acceptAnswer(answer){
      console.log("Accept Answer: " + this.between);
      await this.peer.setRemoteDescription(answer);
      this.allow_ice = true;
      //this.addLocalStream();
    }

    async addIce(ice){
      console.log("Add ICE: " + this.between);
      await this.peer.addIceCandidate(ice); 
    }
  }

  class Vidchat {
    constructor(stream){
      this.root = $(".webrtc");
      this.stream = stream;
      this.current_player = this.root.data("index"); 
      this.webrtc = []; // instance for each other connection pair

      $(document).on("vidchat_message", (e, message) => { 
        // TODO: rename received_message
        this.handle_message(message); 
      });
      $(document).on("send_message", (e, message) => { 
        this.send_message(message);
      });
    }

    send_message(message){
      // validate: type, message, to_index
      message['from_index'] = this.current_player;
      console.log("Vidchat Send Message", message);
      window.signal(message);
    }

    new_peer(other_player){
      if(this.webrtc[other_player]){ return this.webrtc[other_player]; }
      this.webrtc[other_player] = new Vidpeer(other_player, this.stream);
      return this.webrtc[other_player];
    }

    handle_message(message){
      if(message.from_index === this.current_player){
        return;
      } else if(message.to_index !== -1 && message.to_index !== this.current_player){
        return;
      } 

      var data = message.message;
      var other_player = message.from_index;
      var host = this.current_player < other_player;
  
      var peer = this.new_peer(other_player); 
      // ^ Should this be embedded in createOffer & acceptOffer

      if(message.type === "start_call"){
        if(!host){ // host always initiates
          $(document).trigger("send_message", { type: "start_call", to_index: other_player });
        } else {
          peer.createOffer()
        }
      } else if(message.type ===  'webrtc_offer'){
        if(host){ return } // only caller
        peer.acceptOffer(data);
      } else if(message.type === 'webrtc_answer'){
        if(!host){ return } // only host
        peer.acceptAnswer(data);
      } else if(message.type === "webrtc_ice_candidate"){
        peer.addIce(data)
      } else {
        console.log(message)
        alert("Unknown message from: " + other_player);
      }
    }

    start(){
      $(document).trigger("send_message", { type: "start_call", to_index: -1 });
    }
  }
}).call(this);
