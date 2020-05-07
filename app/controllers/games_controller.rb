class GamesController < ApplicationController

  before_action :set_game, except: [:index, :new, :create]

  def game_redirect(notice)
    redirect_to game_url(id: @game.id), notice: notice
  end

  def default_url_options(options = {})
    if params[:debug]
      { debug: true } 
    else
      {}
    end.merge(protocol: :https)
  end

  def morph
    morph_to = params[:index].to_i
    new_id = @game.config[:players][morph_to]
    session[:id] = new_id
    @_current_user = new_id
    show
  end

  def player_up?
    @game.player_up?(@_current_user)
  end

  def invalid_user?
    !player_up?
  end

  def expected_user
    return nil unless @game.config.try(:[],:players).present?
    expected_user = @game.config[:players].index(@game.config[:waiting_on])
    expected_user = @game.config[:names][expected_user]
    expected_user
  end

  def add_cpu_player
    user_id = SecureRandom.uuid()
    user_name = 'cpu'
    # add_player #TODO - call add_player
    if @game.add_player(user_id, user_name)
      game_redirect 'CPU Joined the game!'
    else
      game_redirect 'Failed to add CPU to the game'
    end
  end

  def add_player
    if params[:force] == 'true' # debug helper for development
      session[:id] = SecureRandom.uuid()
      @_current_user = session[:id]
    end
      
    if @game.add_player(@_current_user, params[:username])
      if params[:force] == 'true' # for debug helper
        game_redirect "Added player" 
      else
        show 
      end
    else
      render json: { message: 'Failed to join the game' }
    end
  end

  def start
    error = nil
    if !@game.enough_players?
      error = "Must have between #{Game::MIN_PLAYERS} and #{@game.max_players} players to start"
    elsif @game.config[:first_dealer_index].nil?
      @game.deal_for_highest_card
      @notice = "Highest card deals first"
    elsif @game.config[:deck].nil? || @game.config[:deck].empty?
      @game.deal_cards
      @notice = "Game started!"
    else
      error = 'Game has already started'
    end

    if error
      render json: {message: error}
    else
      show
    end
  end

  def deal
    if @game.clear_table(@_current_user)
      show
    else
      render json: {message: "You are not the dealer"}
    end
  end

  def player_action
    error = nil

    if invalid_user?
      error = "It's not your turn, waiting for \"#{expected_user}\""
    elsif @game.config[:waiting_on_reason] == "Clear"
      error = "Waiting for next hand." 
    elsif params[:bid]
      if @game.done_bidding?
        error = 'Bidding is over'
      elsif !@game.bid_in_range?(params[:bid]) 
        error = "Bid must be between 0 and #{@game.num_cards_per_player}"
      elsif @game.invalid_dealer_bid?(@_current_user, params[:bid])
        error = "Can bid anything BUT #{params[:bid]}" 
      elsif @game.player_action(@_current_user, params[:bid])
        @notice = "Placed bid!"
      else
        @error = "Could not place bid, please try refreshing the page"
      end
    else
      card = Card.new(params[:suit], params[:value])
      if @game.player_action(@_current_user, card)
        @notice = "Played card!"
      elsif !@game.done_bidding?
        error = "Please make a bid"
      else
        error = "You must follow the first suit played: \"#{@game.config[:first_suit_played]}\""
      end
    end

    if error.present?
      render json: { message: error }
    else
      show
    end
  end

  # GET /games
  # GET /games.json
  def index
  end

  # GET /games/1
  # GET /games/1.json
  def is_playing?
    @is_playing ||= @game.config[:players].include?(@_current_user) 
  end

  def current_user_name
    if is_playing?
      i = @game.config[:players].index(@_current_user)
      @game.config[:names][i]
    else 
      "ANONYMOUS"
    end
  end

  def show
    # Refresh game in memory after commiting action
    @game = Game.find(@game.id) if params[:action] != 'show'

    @board_updated = if params[:updated].nil? # hard page hit - from browser
                       #puts "No updated param".red
                       true
                     else
                       last_update = DateTime.parse(params[:updated])
                       # TODO: add milliseconds to the serialization of updated
                       #updated = @game.updated_at > last_update # add milliseconds for precision
                       #puts "Last fetched: #{params[:updated]}".red
                       #puts "Updated: Diff: #{@game.updated_at - last_update}".red
                       updated = (@game.updated_at - last_update) > 0.5 # ignore milisecond rounding errors
                       #puts "Updated: #{updated} (#{@game.updated_at} - #{last_update} = #{@game.updated_at - last_update})".red
                       updated
                     end

    @enough_players = @game.enough_players?
    @game_started = @enough_players && !@game.config[:bids].nil?
  
    js_data = if @board_updated
                process_show
                if request.xhr?
                  { html: json_board }
                else
                  nil
                end
              else
                nil
              end

    if request.xhr? 
      render :json => js_data 
    else # direct page hit
      puts "RENDER BOARD FOR DIRECT HIT".red
      render 'show'
    end
  end

  def json_board
    puts "RENDER BOARD FOR JSON".red
    render_to_string(partial: "board_info", formats: ["html"])
  end

  # GET /games/new
  def new
    @game = Game.new
  end

  def toggle_hints
    @game.config[:hints] = @game.show_hints? ? 'no' : 'yes'
    @game.save_state
    game_redirect "Set Show Hints: #{@game.config[:hints]}"
  end

  def create
    @game = Game.new
    @game.set_up(game_options)
    if @game.add_player(@_current_user, params[:username])
      game_redirect 'Game created. Share this URL with your friends.'
    else
      new
    end
  end

  private
    def process_show
      @dealt = @game.config[:player_hands].present?

      @can_start_game = (!@game_started) && @game.config[:players].first == @_current_user && @enough_players # can deal
  
      @winners = @game.config[:winners].map{|player| @game.config[:names][@game.config[:players].index(player)] } rescue nil
      player_index = @game.player_index(@_current_user) || 0
  
      # round number
      @round = @game.config[:total_rounds] - @game.config[:rounds_played]
  
      # names/scores around the board
      # add in different order so the user is always on the bottom
      @names = []
      @indexes = []
      @total_scores = []
      @round_scores = []
      @played_cards = []

      # Convert static profile order to relative current user ordering, current_user=0
      @game.iterate_through_list_with_start_index(player_index, @game.config[:players]) do |user_id, i|
        @indexes.push @game.config[:players].index(user_id)
        # TODO: remove need for names, scores, round scores, use indexes and raw info

        bid_avail = @game.config[:bids] && @game.config[:bids][i]
        tricks_taken = (@game.config[:tricks_taken] && @game.config[:tricks_taken][i]) ? @game.config[:tricks_taken][i].size : 0
        tricks_taken = "??" unless bid_avail
        bid = bid_avail ? @game.config[:bids][i] : '??'
        score = 0
        if @game.config[:score] && @game.config[:score][i]
          score = @game.config[:score][i].sum
        end
        bid_info = "Taken #{tricks_taken} / #{bid} Bid" 
        bid_color = if (!bid_avail) || tricks_taken == bid
                      :white
                    else
                      bid > tricks_taken ? :red : :yellow
                    end

        @played_cards.push(@game.config[:cards_in_play][i]) if @game.config[:cards_in_play].present?
        @names.push @game.config[:names][i] 
        @total_scores.push score
        @round_scores.push [bid_info, bid_color]
      end
  
      @places = []
      @total_scores.each_with_index do |score, i|
        @places[i] = @total_scores.select{|t| t > score}.count + 1
      end
      
      # players hand - TODO: relabel
      @cards = []
      if is_playing?
        @cards = @game.config[:player_hands][player_index] || @cards
      end
      @cards.sort! { |a,b| a.suit_order b }

      # game status (ie. who we're waiting on)
      @done_bidding = @game.done_bidding?
      if @game.config[:waiting_on_index] 
        @waiting_on_index = @game.config[:waiting_on_index]
        @waiting_on = if @waiting_on_index 
                        @game.config[:waiting_on_reason]
                      else
                        "Table to clear" # TODO: move into game
                      end
      end
      @waiting_on_you = @waiting_on_index == @indexes[0] # seat 0 is the up-next user?
      if @waiting_on_you && @game.config[:waiting_on_chime]
        @game.config[:waiting_on_chime] = nil
        @game.save_state
        @chime = true
      end
    
      # show ace of spades if game hasnt started
      @trump = @game.config[:trump_card] # || Card.new('Spades', 12)
  
      @poll = !@game_started # waiting room - everyone is waiting for updates
      @poll = !@waiting_on_you unless @poll

    end

    # Use callbacks to share common setup or constraints between actions.
    def set_game
      @game = Game.find_by(id: params[:id])
      if @game.nil?
        # TODO: make notice work
        redirect_to root_path(anchor: :games), notice: "Sorry, that game does not exist" 
      end
    end

    # Never trust parameters from the scary internet, only allow the white list through.
    def game_options
      params.permit(*t("options", locale: :en).keys).to_h
    end
end
