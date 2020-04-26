(function() {
  window.load_vidchat = function(){
    new Vidchat();
  }

  var Vidchat = function(){
    var root = $(".webrtc");
    var current_player = root.data("index"); // Profile, not seat number (aka seat number always 0)
    var started = false;// this local host
    var ice = null, offer = null, answer = null, offer_s = null, answer_s = null;
  
    var start_button = root.find('#start_video');
    var end_button;
    var local_host;
  
    // TODO: make current_player comparisons
    // between any 2 players - the 'lower index' is the offer index
    // aka: compare current_player vs other_user
    var webrtc = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            "stun:stun.stunprotocol.org",
          ]
        }
      ]
    });

    var end_call = function(e){
      e.preventDefault();
      started = false;
      for (const track of local_host[0].srcObject.getTracks()) {
        track.stop();
      }
      end_button.addClass("d-none");
      start_button.removeClass("d-none");
      return false;
    };

    var got_local_stream = function(local_stream){
      // display our local video in the respective tag
      local_host[0].srcObject = local_stream;
      
      for(const track of local_host[0].srcObject.getTracks()){
        webrtc.addTrack(track, local_stream);
      }
      
      send_message("start_call", null, -1);
      started = true;
      start_button.addClass("d-none");
      end_button.removeClass("d-none");
      $(document).trigger("poll_for_update"); // override polling process in case its not running
      // Temporary - until websockets
    };
  
    var start_call = function(e){
      e.preventDefault();
      window.start_channel();

      end_button = root.find('#end_video');
      end_button.on('click', end_call);
      local_host = root.find("#video-" + current_player);
  
      navigator
        .mediaDevices
        .getUserMedia({ 
          //video: true, 
          video: { // throttle bandwidth usage?
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
  
    start_button.on("click", start_call);
   
    async function send_message(type, message, to_index){
      // TODO: some messages need a to_index
      // send offer, send answer
      var msg = {
        type: type, message: message,
        from_index: current_player,
        to_index: to_index
      }
      window.signal(msg);
    }
  
    async function handle_message(message) {
      var data = message.message;
      console.log("HandleMessage: From #" + message.from_index + " - " + message.type);
      // TODO: make sure video entry exists, show connecting 
      var host = current_player < message.from_index;

      if(message.type === "start_call"){
        if(!host){ 
          send_message("start_call", null, -1);
        }  else {
          //if(!offer){
            offer = await webrtc.createOffer();
            await webrtc.setLocalDescription(offer);
          //}
          offer_s = JSON.parse(JSON.stringify(offer))
          send_message('webrtc_offer', offer_s, message.from_index);
        }
      } else if(message.type ===  'webrtc_offer'){
        if(host){ return } // only caller
        //if(!answer){
        console.log("Set remote description from Offer +++++++");
          await webrtc.setRemoteDescription(data);
          answer = await webrtc.createAnswer();
          await webrtc.setLocalDescription(answer);
        //}
        answer_s = JSON.parse(JSON.stringify(answer))
        send_message("webrtc_answer", answer_s, message.from_index);
      } else if(message.type === 'webrtc_answer'){
        if(!host){ return } // only host
        console.log("Set remote description from Answer --------");
        await webrtc.setRemoteDescription(data);
      } else if(message.type === "webrtc_ice_candidate"){
        //if(!ice){
          ice = data
          await webrtc.addIceCandidate(data); 
        //}
      } else {
        console.log(message)
        alert("Unknown message");
      }
    }
  
    $(document).on("vidchat_message", function(e, data){
      console.log("Vidchat message received by #" + current_player, data);
      if(!started){
        console.log("  - ignoring - not started");
      } else if(data.from_index === current_player){
        console.log("  - ignoring - self message");
      } else if(data.to_index !== -1 && data.to_index !== current_player){
        console.log("  - ignoring - for other party", current_player, data.to_index);
      } else { 
        handle_message(data)
      }
    });

    var get_video = function(user_index){
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
  
    webrtc.addEventListener("iceconnectionstatechange", (event) => {
      // TODO: webrtc.user_index attribute
      var state = webrtc.iceConnectionState;
      console.log(`connection state change w/ peer: ${state}`);
      if (state === "failed" || state === "closed" || state === "disconnected") {
        root.find(".videos").empty();
      }
    });

    webrtc.addEventListener("icecandidate", (event) => {
      if(!event.candidate){
        return;
      }
      // when we discover a candidate, send it to the other
      // party through the signalling server
      send_message(
        "webrtc_ice_candidate",
        JSON.parse(JSON.stringify(event.candidate)),
        -1
      );
    });
  
    // do i need a webrtc for each remote person? probably
    // I think we need a webrtc instance between every pair
    webrtc.addEventListener("track", (event) => {
      console.log("Add Remote Track", event, event.streams)

      // TODO: event needs to get/check 'other_user_index'
      var other_user_index = current_player === 0 ? 1 : 0;
      var remote_video = get_video(other_user_index);

      // TODO: do we need to add multiple tracks here?
      //for (const track of event.streams) {

      remote_video[0].srcObject = event.streams[0];
    });
  }
}).call(this);
