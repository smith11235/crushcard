module GamesHelper
  def num_players
    @num_players ||= @game.num_players
  end
end
