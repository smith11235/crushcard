class Game < ApplicationRecord

  MIN_PLAYERS=3

  def max_players
    config[:max_players].to_i
  end

  def total_rounds
    t = config[:total_rounds] # validated 2-10
    if num_players > 5
      (Card::DECK_SIZE / t) # 6 => 8, 7 => 7, 8 => 6
    else
      t
    end
  end

  def set_up(options)
    tr = options.delete('total_rounds').to_i
    tr = 10 if tr < 2 || tr > 10

    state = {
      total_rounds: tr,
      rounds_played: 0,
      dealer_index: 0,
      waiting_on: nil, # creator 
      waiting_on_index: 0,
      waiting_on_reason: "Game to start",
      waiting_on_chime: nil,
      players: [],
      names: [],
      score: [],
      deck: [],
      player_hands: [],
      winner_index: nil,
      winners: [],
      last_to_lead_with_trump: nil
    }
    options.each do |k, v|
      state.merge! k.to_sym => v
    end

    # TODO: stringify all keys - json field 
    save_state state
  end

  def already_started?
    # TODO: is this correct?
    config[:cards_in_play].present? 
  end

  def too_many_players?
    num_players >= max_players
  end

  def add_player(user_id, user_name)
    user_name = user_name.strip
    if user_id.nil?
      return false
    elsif user_name.blank?
      return false
    elsif already_started?
      return false
    elsif too_many_players?
      return false
    elsif config[:players].include?(user_id)
      return false
    end

    config[:players].push user_id
    config[:waiting_on] = user_id if num_players.size == 1 # first to join is first dealer

    while config[:names].include?(user_name)
      # make sure username is unique by appending random numbers
      user_name += rand(10).to_s
    end
    config[:names].push user_name
    save_state
  end

  def add_waiting_info(index, reason)
    player = config[:players][index]
    config.merge!(
      waiting_on: player, 
      waiting_on_index: index,
      waiting_on_reason: reason,
      waiting_on_chime: true
    )
  end

  def set_new_dealer
    # Could use dealer_index + 1 % size
    config[:dealer_index] = config[:rounds_played] % num_players
    config[:dealer] = config[:players][config[:dealer_index]] # deprecated - use index
  end

  def enough_players?
    num_players >= MIN_PLAYERS && num_players <= max_players
  end
  
  def deal_cards
    # shuffle deck
    config[:deck] = Card.get_shuffled_deck

    # reset bids hash and determine who bids first
    # person to the 'left' of the dealer bids first
    config[:bids] = []

    # next player is always +1 on dealer (could use waiting_on_index?)
    to_left = (config[:dealer_index] + 1) % config[:players].size
    add_waiting_info(to_left, "Bid")
    
    # deal cards first to player on 'right' of dealer (TODO)
    config[:player_hands] = [] # reset
    config[:players].each_with_index do |p, i|
      config[:player_hands][i] = config[:deck].slice!(0..(num_cards_per_player-1))
    end
    
    # the next card in the deck is trump
    # whatever suit is trump is valued higher than non-trump suits
    # an Ace as trump means there is "no trump"
    config[:trump_card] = config[:deck].slice! 0

    # set a few default values
    config[:cards_in_play] = []
    config[:first_suit_played] = nil
    config[:tricks_taken] = []

    save_state config
  end

  def player_index(player_id)
    config[:players].index(player_id)
  end

  def player_up?(current_user)
    current_user_index = player_index(current_user)

    waiting_user = config[:waiting_on] # deprecated
    waiting_user_index = config[:waiting_on_index]
    info = "##{current_user_index} vs ##{waiting_user_index} - #{current_user} vs #{waiting_user}"
    if current_user_index != waiting_user_index 
      false
    elsif current_user != waiting_user # deprecated
      #raise "SHOULD NOT GET HERE"
      #false
      true
    else
      true
    end
  end

  def num_cards_per_player
    case config[:rounds_direction] 
    when 'down'
      total_rounds - config[:rounds_played]
    when 'up'
      1 + config[:rounds_played]
    when 'both'
      # in this scenario - total rounds == max card round
      if config[:rounds_played] < total_rounds # on way up
        1 + config[:rounds_played] # keep going up
      else # on way down
        total_rounds - (config[:rounds_played] % total_rounds) - 1
      end
    end
  end

  def game_over?
    if config[:rounds_direction] == 'both'
      config[:rounds_played] == (total_rounds * 2) - 1
    else
      config[:rounds_played] == total_rounds
    end
  end

  def bid_in_range?(bid)
    bid = bid.to_i if bid.is_a?(String)
    bid >= 0 && bid <= num_cards_per_player
  end

  def total_bids
    (config[:bids] || []).compact.sum 
  end

  def invalid_dealer_bid?(user_id, bid)
    return false if config[:bids_total] == 'win'

    bid = bid.to_i if bid.is_a?(String)
    # dealer cannot bid the same amount as the number of cards dealt
    is_dealer = player_index(user_id) == config[:dealer_index]
    return false unless is_dealer

    bid_total = bid + total_bids
    all_add_up = bid_total == num_cards_per_player
    all_add_up
  end

  def set_first_to_play_hand
    left_of_dealer = next_player_index(config[:dealer_index])
    next_up = if config[:first_to_play] == 'highest'
                max_bid = config[:bids].max
                bidder = nil
                iterate_through_list_with_start_index(left_of_dealer, config[:bids]) do |bid,i|
                  if max_bid == bid
                    bidder = i
                    break 
                  end
                end
                bidder
              else
                left_of_dealer
              end
    add_waiting_info(next_up, "Play")
  end
  
  def last_to_lead_with_trump?(index)
    config[:last_to_lead_with_trump] == index
  end

  # player either bids or plays a card if it's their turn
  def player_action user_id, user_input=nil
    return false unless player_up?(user_id)
    current_player_index = player_index(user_id)
    
    # check if we are in bidding or playing a card
    if !done_bidding?
      bid = user_input.to_i
      if !bid_in_range?(bid) 
        return false
      elsif invalid_dealer_bid?(user_id, bid)
        return false
      end
      
      # record the bid
      config[:bids][current_player_index] = bid

      if config[:dealer_index] == current_player_index # dealer is last to bid, bidding is done
        set_first_to_play_hand
      else
        to_left = next_player_index config[:waiting_on_index]
        add_waiting_info(to_left, "Bid")
      end

    elsif !config[:player_hands][current_player_index].empty?
      # player is playing a card
      card = user_input
      
      # ensure that the card is in their inventory
      return false unless config[:player_hands][current_player_index].any? { |player_card| player_card == card }

      # ensure that the card is actually playable
      if config[:first_suit_played].nil?
        config[:first_suit_played] = card.suit
        if config[:first_suit_played] == config[:trump_card].suit && !ignore_trump? 
          config[:last_to_lead_with_trump] = current_player_index
        end
      end
      playable_cards = get_playable_cards(config[:player_hands][current_player_index])
      # TODO: add a message here?
      return false unless playable_cards.include? card
      
      # actually play the card
      config[:cards_in_play][current_player_index] = config[:player_hands][current_player_index].delete(card)

      set_winner_card_index(current_player_index) # is this correct...
      # check to see if all players have played a card
      if all_players_played_a_card?
        add_waiting_info(config[:winner_index], 'Clear')
      else
        # set next player to play a card
        next_up = next_player_index(current_player_index)
        add_waiting_info(next_up, "Play")
      end
    end
    
    save_state config 
  end

  def set_winner_card_index(index)
    # all cards played?
    #if config[:cards_in_play].size == config[:players].size
    highest_card = get_highest_card(config[:cards_in_play], config[:first_suit_played], config[:trump_card], index+1)
    config[:winner_index] = config[:cards_in_play].find_index(highest_card)
  end

  # clear the table of cards and calculate who won the trick/game
  def clear_table user_id
    return false unless player_up?(user_id)
    current_player_index = player_index(user_id)

    winner_index = config[:winner_index]
    config[:tricks_taken][winner_index] ||= []
    config[:tricks_taken][winner_index].push config[:cards_in_play]

    # reset variables
    config[:winner_index] = nil
    config[:cards_in_play] = []
    config[:first_suit_played] = nil
    

    # check to see if we're done with this round
    if config[:player_hands].first.empty?
      # increment rounds played
      config[:rounds_played] += 1

      # determine scores
      config[:bids].each_with_index do |bid, i|
        tricks = config[:tricks_taken][i] || []
        player_score = if tricks.size < bid
          if config[:underbid] == 'lose'
            tricks.size - bid 
          else
            0
          end
        elsif tricks.size > bid
          tricks.size
        else
          bid + 10
        end
        config[:score][i] ||= []
        config[:score][i].push player_score
      end
      
      # check to see if that was the last round (game over)
      if game_over?
        # game is over, determine who won
        # winners list is necessary since there can be ties
        config[:winners] = []
        highest_score = nil
        config[:score].each_with_index do |score, i|
          player_score = score.inject :+ # add up score from each round
          if highest_score.nil? || player_score >= highest_score
            # clear winners list if there's a new high score
            config[:winners].clear if highest_score.present? && player_score > highest_score
            # set new high score and record as winner
            highest_score = player_score
            config[:winners].push config[:players][i]
          end
        end
      else
        set_new_dealer
        deal_cards
      end
    else
      add_waiting_info(winner_index, "First")
    end

    save_state 
  end

  def config
    @config ||= load_state
  end
  # TODO: make this a db:JSON field for easier reference, remove config
  def load_state
    return YAML.load(self.state)
  end
  def save_state new_state = config
    self.state = new_state.to_yaml
    self.save
  end

  def show_hints?
    config[:hints] == 'yes'
  end

  def ignore_trump?
    return false if config[:trump_card].nil?
    rule_enabled = config[:ace_of_trump] == 'no_trump'
    is_ace = config[:trump_card].value_name =~ /ace/i
    rule_enabled && is_ace
  end

  def get_highest_card cards, first_suit_played, trump, start_index
    return cards.first if cards.size <= 1

    # if trump was played, ignore other cards
    # an ace indicates no trump, so ignore it if that's the case
    trump_cards = ignore_trump? ? [] : cards.compact.select { |c| c.suit == trump.suit }

    # if trump wasn't played or there is no trump (ace),
    # only cards that are the same suit as the first card played matter
    same_suit_cards = cards.compact.select { |c| c.suit == first_suit_played }
    card_set = trump_cards.empty? ? same_suit_cards : trump_cards
    
    # now simply get the highest card left
    return card_set.max
  end
  
  def get_playable_cards cards # for a players hand
    first_suit = config[:first_suit_played]
    # player can play any card if they are the first to play a card
    # or if they only have a single card left
    return cards if first_suit.nil? || cards.size == 1
    # player must play the same suit as the first card played
    playable_cards = cards.select { |card| card.suit == first_suit }
    # if player doesn't have any of the same suit as the first card played
    # they can play any card
    playable_cards = cards if playable_cards.empty?
    return playable_cards
  end

  def iterate_through_list_with_start_index start_index, list
    # start_index is profile index of 'first spot checked'
    list.size.times do |offset|
      index = (start_index + offset) % list.size
      yield list[index], index
    end
  end

  def num_players
    config[:players].size
  end

  # returns the index of the next player
  def next_player_index(current_index)
    (current_index + 1) % num_players
  end

  def get_next_player current_player 
    # aka: next up from config[:waiting_on]
    next_up = next_player_index(players.find_index(current_player))
    return players[next_up]
  end

  # returns true if the input array is the same size as the number of
  # players we have, and doesn't include nil
  def player_size_and_nil_check arr
    return arr.present? && (arr.compact.size == num_players)
  end

  # return true or false if we're done bidding
  # done bidding if there are the same number of valids bids
  # as there are players in the game
  def done_bidding? 
    return player_size_and_nil_check(config[:bids])
  end

  def all_players_played_a_card?
    return player_size_and_nil_check(config[:cards_in_play])
  end
end

# Needed here for yaml serialization to work..... why?
# TODO: make it all json, stringified
class Card
  include Comparable

  DECK_SIZE=52
  
  SUITS = %w{Spades Hearts Diamonds Clubs}
  attr_accessor :suit, :value, :playable

  # create a single card
  def initialize suit, value
    raise 'Invalid card suit' unless SUITS.include? suit
    raise 'Invalid card value' unless value.to_i >= 0 && value.to_i < 13
    @suit = suit
    @value = value
  end

=begin
  def to_json # to_yaml
    { suit: suit, value: value }
  end
=end

  def value_name
    card_names = %w[Two Three Four Five Six Seven Eight Nine Ten Jack Queen King Ace]
    return card_names[@value]
  end

  def abbreviated_name
    %w[2 3 4 5 6 7 8 9 10 J Q K A][@value]
  end
  
  def <=> other
    return 1 if other.nil?
    return 0 if @value.nil? && other.value.nil?
    return 1 if other.value.nil?
    return -1 if @value.nil?
    @value.to_i <=> other.value.to_i
  end

  def == other
    return false if other.nil?
    return false if (@value.nil? || other.value.nil?) && @value != other.value
    return (@value.to_i == other.value.to_i && @suit == other.suit)
  end
  
  def suit_order other
    if @suit != other.suit
      SUITS.index( @suit ) <=> SUITS.index( other.suit )
    else
      @value <=> other.value
    end
  end

  # creates a standard deck of 52 cards, Ace high
  # the '0' represents 2, and '12' is Ace
  def self.get_shuffled_deck
    cards = []
    SUITS.each do |suit|
      1..13.times do |i|
        cards.push Card.new(suit, i)
      end
    end
    # Note: Babs said the shuffle algorithm sucked
    # so added more shuffle ups
    cards.shuffle.shuffle.reverse.shuffle.shuffle.reverse
  end
end
