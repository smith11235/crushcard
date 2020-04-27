(function() {
  window.load_vidchat = function(){
    var root = $(".webrtc");
    new VidchatControls(root);
  }

  var VidchatControls = function(root){
    var start_button = root.find('#start_video');
    var end_button = root.find('#end_video');
    var current_player = root.data("index"); 
    var local_host = root.find("#video-" + current_player); 
    var local_stream;

    var start_call = function(e){
      e.preventDefault();
      window.start_channel();

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

      new Vidchat(root, stream);

      start_button.addClass("d-none");
      end_button.removeClass("d-none");
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

  var Vidchat = function(root, stream){
    var current_player = root.data("index"); 
    var webrtc = []; // instance per other host

    async function new_peer(other_player){
      if(webrtc[other_player]){ return webrtc[other_player]; }

      console.log("New Peer for: " + other_player);
      var peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.stunprotocol.org",
            ]
          }
        ]
      });

      //peer.data("other_player", other_player);
      //console.log("Setting up other_player peer: " + peer.data("other_player"));

      for(const track of stream.getTracks()){
        // TODO: should this be after listeners are set?
        peer.addTrack(track, stream);
      }

      peer.addEventListener("icecandidate", (event) => {
        if(!event.candidate){ return; }
        console.log("For peer: " + other_player);
        //console.log(this.data("other_player"));
        // when we discover a candidate, send it to the other parties
        send_message(
          "webrtc_ice_candidate",
          JSON.parse(JSON.stringify(event.candidate)),
          other_player
        );
      });
      peer.addEventListener("track", (event) => {
        console.log("Add Remote Track", event, event.streams)
        console.log("For peer: " + other_player);
        //console.log(this.data("other_player"));
        // TODO: event needs to get/check 'other_user_index'
        var remote_video = get_video(other_player);
        remote_video[0].srcObject = event.streams[0];
      });

      webrtc[other_player] = peer;
      return peer;
    };
  
    async function send_message(type, message, to_index){
      var msg = {
        type: type, message: message,
        from_index: current_player,
        to_index: to_index
      }
      window.signal(msg);
    }
  
    async function handle_message(message) {
      var data = message.message;
      var other_player = message.from_index;
      var host = current_player < other_player;

      console.log("HandleMessage: From #" + other_player + " - " + message.type);

      var peer = await new_peer(other_player);

      if(message.type === "start_call"){
        if(!host){ // host always initiates
          send_message("start_call", null, other_player);
        } else {
          var offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          offer = JSON.parse(JSON.stringify(offer))
          send_message('webrtc_offer', offer, other_player);
        }
      } else if(message.type ===  'webrtc_offer'){
        if(host){ return } // only caller
        await peer.setRemoteDescription(data);
        var answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        answer = JSON.parse(JSON.stringify(answer));
        send_message("webrtc_answer", answer, other_player);
      } else if(message.type === 'webrtc_answer'){
        if(!host){ return } // only host
        console.log("Set remote description from Answer --------");
        await peer.setRemoteDescription(data);
      } else if(message.type === "webrtc_ice_candidate"){
        await peer.addIceCandidate(data); 
      } else {
        console.log(message)
        alert("Unknown message from: " + other_player);
      }
    }
  
    $(document).on("vidchat_message", function(e, data){
      console.log("Vidchat message received by #" + current_player, data);
      if(data.from_index === current_player){
        console.log("  - ignoring - self message");
      } else if(data.to_index !== -1 && data.to_index !== current_player){
        console.log("  - ignoring - for other party", current_player, data.to_index);
      } else { 
        handle_message(data)
      }
    });

    var get_video = function(user_index){
      // TODO: put this in new_peer
      var id = "video-" + user_index;
      var remote_video = root.find("#" + id);
      if(remote_video.length === 0){
        root.find(".videos").append(
          "<br /><video id=\"" + id + "\" class=\"remote\" playsinline autoplay></video>"
        )
      }
      remote_video = root.find("#" + id);
      if(remote_video.length === 0){
        alert("Failed to find remove video box");
      }
      return remote_video;
    }
  
    send_message("start_call", null, -1); 
  }
}).call(this);
