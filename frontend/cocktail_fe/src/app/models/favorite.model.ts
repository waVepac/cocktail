export interface FavoriteDrink {
  id: string;
  name: string;
  thumbnail: string;
}

export interface FavoriteModel {
  userId: number;
  favorite: FavoriteDrink;
  active: boolean;
}

export interface FavoriteToggleResponse extends FavoriteModel {
  message: string;
}
