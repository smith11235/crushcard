class DropNameFromGames < ActiveRecord::Migration[6.0]
  def change
    remove_column :games, :name
  end
end
