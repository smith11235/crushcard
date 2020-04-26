import consumer from "./consumer"

// TODO: launch only on game page
var game_id = window.location.pathname.substring(1);

const signalChannel = consumer.subscriptions.create(
  { channel: "SignalChannel", id: game_id }, 
  {
    connected() {
      console.log("Connected!");
    },
    disconnected() {
      console.log("Disconnected!")
    },
    received(data) {
      $(document).trigger("vidchat_message", data);
    }
  }
);

window.signal = function(data){
 signalChannel.send(data);
};

