module GamesHelper

  def display_name(name)
    # TODO - add smaller font display for longer string
    name.truncate(20, omission: "...")
  end

  def num_players
    @num_players ||= @game.num_players
  end

  def yours?(index)
    @is_playing && index == 0
  end
end
