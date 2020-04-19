module GamesHelper
  def num_players
    @num_players ||= @game.num_players
  end

  def yours?(index)
    @is_playing && index == 0
  end
end
