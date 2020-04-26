import consumer from "./consumer"


window.start_channel = function(){
  // TODO: launch only on game page
  var game_id = window.location.pathname.substring(1);
  window.signalChannel = consumer.subscriptions.create(
    { channel: "SignalChannel", id: game_id }, 
    {
      connected() {
        console.log("Channel Connected!");
      },
      disconnected() {
        console.log("Channel Disconnected!")
      },
      received(data) {
        $(document).trigger("vidchat_message", data);
      }
    }
  );
}

window.signal = function(data){
 window.signalChannel.send(data);
};

