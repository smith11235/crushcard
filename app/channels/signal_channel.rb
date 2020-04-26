class SignalChannel < ApplicationCable::Channel
  # TODO: could replace game_# with Game.find(id)
  def subscribed
    # TODO: validate player is playing
    # player_index = @game.player_index(@_current_user)
    stream_from "game_#{params[:id]}"
  end

  def receive(data)
    puts "Signal Received: #{data.to_yaml}".green
    # migrate in the logic in games#webrtc
    ActionCable.server.broadcast(
      "game_#{params[:id]}", 
      data
    )
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
