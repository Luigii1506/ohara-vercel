export interface Listing {
  id: number;
  seller_id: number;
  title: string;
  description?: string;
  price: number;
  currency: string;
  status: "active" | "inactive" | "sold";
  condition:
    | "near_mint"
    | "lightly_played"
    | "moderately_played"
    | "heavily_played"
    | "damaged";
  language: string;
  quantity: number;
  image?: string;
  created_at: string;
  updated_at: string;
  items?: ListingItem[];
  property_values?: ListingPropertyValue[];
}

export interface ListingItem {
  id: number;
  listing_id: number;
  card_id: number;
  quantity: number;
  price: number;
  condition: string;
  language: string;
  is_first_edition: boolean;
  is_foil: boolean;
  image?: string;
  created_at: string;
  updated_at: string;
  card?: {
    id: number;
    name: string;
    code: string;
    rarity: string;
    set: string;
  };
}

export interface ListingPropertyValue {
  id: number;
  listing_id: number;
  property_id: number;
  value: string;
  property?: {
    id: number;
    name: string;
    type: string;
  };
}

export interface CreateListingDto {
  title: string;
  description?: string;
  price: number;
  currency?: string;
  condition: string;
  language?: string;
  quantity: number;
  status?: "active" | "inactive" | "sold";
}

export interface UpdateListingDto extends Partial<CreateListingDto> {}

export interface AddListingItemDto {
  card_id: number;
  quantity: number;
  price: number;
  condition: string;
  language?: string;
  is_first_edition?: boolean;
  is_foil?: boolean;
}

export interface UpdateListingItemDto extends Partial<AddListingItemDto> {}
